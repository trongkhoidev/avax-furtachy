// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {FutaraTypes} from "../libraries/FutaraTypes.sol";
import {IFutaraFactory} from "../interfaces/IFutaraFactory.sol";
import {Treasury} from "./Treasury.sol";
import {ConditionalVault} from "../market/ConditionalVault.sol";
import {ConditionalToken} from "../market/ConditionalToken.sol";
import {DecisionAMM} from "../market/DecisionAMM.sol";

interface ISpotConsult { function consult(uint32 secondsAgo) external view returns (uint256); function spotPriceE18() external view returns (uint256); }

contract FutarchyGovernor is Initializable {
    using SafeERC20 for IERC20;

    uint256 private constant BPS = 10_000;
    uint256 private constant PRICE_SCALE = 1e30;

    error ProposalActive();
    error InsufficientLiquidity();
    error SlippageOnSeed();
    error WarmupNotOver();
    error TradingNotOver();
    error WrongState();
    error ExecutionExpired();
    error ActionsMismatch();
    error OnlyTreasury();
    error OnlyProposer();
    error ReentrantExecution();

    uint256 public projectId;
    IFutaraFactory public factory;
    Treasury public treasury;
    IERC20 public usdc;
    IERC20 public token;
    ISpotConsult public spotAmm;
    FutaraTypes.FutarchyParams public params;
    uint256 public proposalCount;
    uint256 public activeProposalId;
    address public vaultImpl;
    address public conditionalTokenImpl;
    address public ammImpl;
    bool private _executing;

    struct Proposal {
        address proposer;
        string descriptionURI;
        bytes32 descriptionHash;
        bytes32 actionsHash;
        FutaraTypes.ProposalState state;
        FutaraTypes.Outcome outcome;
        uint64 createdAt;
        uint64 tradingStart;
        uint64 tradingEnd;
        uint64 executionDeadline;
        uint256 bond;
        address vaultUsdc;
        address vaultToken;
        address passAmm;
        address failAmm;
        uint256 seedPriceE18;
        uint256 twapPassE18;
        uint256 twapFailE18;
    }

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => FutaraTypes.Action[]) private _actions;

    event ProposalCreated(uint256 indexed id, address indexed proposer, string uri, bytes32 descriptionHash, address vaultUsdc, address vaultToken, address passAmm, address failAmm, uint256 seedPriceE18);
    event ProposalActivated(uint256 indexed id, uint64 tradingStart, uint64 tradingEnd);
    event ProposalFinalized(uint256 indexed id, FutaraTypes.Outcome outcome, uint256 twapPass, uint256 twapFail);
    event ProposalExecuted(uint256 indexed id);
    event ProposalExecutionFailed(uint256 indexed id, bytes reason);
    event ProposalCancelled(uint256 indexed id);
    event ParamsUpdated(FutaraTypes.FutarchyParams params);

    constructor() { _disableInitializers(); }

    function initialize(uint256 projectId_, address factory_, address treasury_, IERC20 usdc_, IERC20 token_, address spotAmm_, FutaraTypes.FutarchyParams calldata params_, address vaultImpl_, address conditionalTokenImpl_, address ammImpl_) external initializer {
        require(factory_ != address(0) && treasury_ != address(0) && address(usdc_) != address(0) && address(token_) != address(0) && spotAmm_ != address(0), "invalid governor config");
        projectId = projectId_;
        factory = IFutaraFactory(factory_);
        treasury = Treasury(payable(treasury_));
        usdc = usdc_;
        token = token_;
        spotAmm = ISpotConsult(spotAmm_);
        params = params_;
        vaultImpl = vaultImpl_;
        conditionalTokenImpl = conditionalTokenImpl_;
        ammImpl = ammImpl_;
    }

    function propose(FutaraTypes.Action[] calldata actions, string calldata uri, bytes32 hash, uint256 liqUsdc, uint256 maxLiqToken) external returns (uint256 id) {
        if (activeProposalId != 0) revert ProposalActive();
        if (liqUsdc < params.minLiquidityUsdc || actions.length == 0) revert InsufficientLiquidity();
        uint256 seedPrice = spotAmm.consult(params.minUpdateInterval * 5);
        if (seedPrice == 0) seedPrice = spotAmm.spotPriceE18();
        if (seedPrice == 0) revert SlippageOnSeed();
        uint256 liqToken = Math.mulDiv(liqUsdc, PRICE_SCALE, seedPrice);
        if (liqToken == 0 || liqToken > maxLiqToken) revert SlippageOnSeed();

        id = ++proposalCount;
        token.safeTransferFrom(msg.sender, address(this), params.proposalBond);
        usdc.safeTransferFrom(msg.sender, address(this), liqUsdc);
        token.safeTransferFrom(msg.sender, address(this), liqToken);
        address vaultUsdc = Clones.clone(vaultImpl);
        address vaultToken = Clones.clone(vaultImpl);
        address passAmm = Clones.clone(ammImpl);
        address failAmm = Clones.clone(ammImpl);
        // Announce the child addresses before vault/AMM initialization emits activity logs.
        // A Ponder factory source can then index those clone events from the first log onward.
        factory.registerProposalMarkets(projectId, id, vaultUsdc, vaultToken, passAmm, failAmm);
        ConditionalVault(vaultUsdc).initialize(usdc, address(this), id, conditionalTokenImpl, "USDC");
        ConditionalVault(vaultToken).initialize(token, address(this), id, conditionalTokenImpl, "EDU");
        usdc.forceApprove(vaultUsdc, liqUsdc);
        token.forceApprove(vaultToken, liqToken);
        ConditionalVault(vaultUsdc).split(liqUsdc, address(this));
        ConditionalVault(vaultToken).split(liqToken, address(this));

        ConditionalToken pUsdc = ConditionalVault(vaultUsdc).passToken();
        ConditionalToken fUsdc = ConditionalVault(vaultUsdc).failToken();
        ConditionalToken pToken = ConditionalVault(vaultToken).passToken();
        ConditionalToken fToken = ConditionalVault(vaultToken).failToken();
        DecisionAMM(passAmm).initialize(address(pToken), address(pUsdc), params.ammFeeBps, address(this), true, params.minUpdateInterval);
        DecisionAMM(failAmm).initialize(address(fToken), address(fUsdc), params.ammFeeBps, address(this), true, params.minUpdateInterval);
        pToken.approve(passAmm, liqToken);
        pUsdc.approve(passAmm, liqUsdc);
        fToken.approve(failAmm, liqToken);
        fUsdc.approve(failAmm, liqUsdc);
        DecisionAMM(passAmm).addLiquidity(liqToken, liqUsdc, 1, msg.sender);
        DecisionAMM(failAmm).addLiquidity(liqToken, liqUsdc, 1, msg.sender);

        Proposal storage proposal = proposals[id];
        proposal.proposer = msg.sender;
        proposal.descriptionURI = uri;
        proposal.descriptionHash = hash;
        proposal.actionsHash = keccak256(abi.encode(actions));
        proposal.state = FutaraTypes.ProposalState.Pending;
        proposal.createdAt = uint64(block.timestamp);
        proposal.bond = params.proposalBond;
        proposal.vaultUsdc = vaultUsdc;
        proposal.vaultToken = vaultToken;
        proposal.passAmm = passAmm;
        proposal.failAmm = failAmm;
        proposal.seedPriceE18 = seedPrice;
        for (uint256 i; i < actions.length; ++i) _actions[id].push(actions[i]);
        activeProposalId = id;
        emit ProposalCreated(id, msg.sender, uri, hash, vaultUsdc, vaultToken, passAmm, failAmm, seedPrice);
    }

    function activate(uint256 id) external {
        Proposal storage proposal = proposals[id];
        if (proposal.state != FutaraTypes.ProposalState.Pending) revert WrongState();
        if (block.timestamp < uint256(proposal.createdAt) + params.warmup) revert WarmupNotOver();
        proposal.tradingStart = uint64(block.timestamp);
        proposal.tradingEnd = uint64(block.timestamp + params.tradingPeriod);
        uint64 start = uint64(block.timestamp + params.twapStartDelay);
        uint256 maxDelta = proposal.seedPriceE18 * params.maxObsChangeBps / BPS;
        DecisionAMM(proposal.passAmm).startTwap(start, proposal.tradingEnd, proposal.seedPriceE18, maxDelta);
        DecisionAMM(proposal.failAmm).startTwap(start, proposal.tradingEnd, proposal.seedPriceE18, maxDelta);
        proposal.state = FutaraTypes.ProposalState.Trading;
        emit ProposalActivated(id, proposal.tradingStart, proposal.tradingEnd);
    }

    function finalize(uint256 id) external {
        Proposal storage proposal = proposals[id];
        if (proposal.state != FutaraTypes.ProposalState.Trading) revert WrongState();
        if (block.timestamp < proposal.tradingEnd) revert TradingNotOver();
        uint256 passTwap = DecisionAMM(proposal.passAmm).finalizeTwap(proposal.tradingEnd);
        uint256 failTwap = DecisionAMM(proposal.failAmm).finalizeTwap(proposal.tradingEnd);
        FutaraTypes.Outcome outcome = passTwap * BPS > failTwap * (BPS + params.thresholdBps) ? FutaraTypes.Outcome.Pass : FutaraTypes.Outcome.Fail;
        proposal.twapPassE18 = passTwap;
        proposal.twapFailE18 = failTwap;
        proposal.outcome = outcome;
        proposal.state = outcome == FutaraTypes.Outcome.Pass ? FutaraTypes.ProposalState.Passed : FutaraTypes.ProposalState.Failed;
        proposal.executionDeadline = uint64(block.timestamp + params.executionWindow);
        activeProposalId = 0;
        ConditionalVault(proposal.vaultUsdc).resolve(outcome);
        ConditionalVault(proposal.vaultToken).resolve(outcome);
        DecisionAMM(proposal.passAmm).close();
        DecisionAMM(proposal.failAmm).close();
        if (proposal.bond > 0) token.safeTransfer(proposal.proposer, proposal.bond);
        emit ProposalFinalized(id, outcome, passTwap, failTwap);
        if (outcome == FutaraTypes.Outcome.Pass) {
            try this.execute(id) {} catch (bytes memory reason) { emit ProposalExecutionFailed(id, reason); }
        }
    }

    function execute(uint256 id) external {
        if (_executing) revert ReentrantExecution();
        Proposal storage proposal = proposals[id];
        if (proposal.state != FutaraTypes.ProposalState.Passed) revert WrongState();
        if (block.timestamp > proposal.executionDeadline) revert ExecutionExpired();
        _executing = true;
        proposal.state = FutaraTypes.ProposalState.ExecutionFailed;
        FutaraTypes.Action[] memory actions = _actions[id];
        treasury.execute(id, actions);
        proposal.state = FutaraTypes.ProposalState.Executed;
        _executing = false;
        emit ProposalExecuted(id);
    }

    function markExecutionFailed(uint256 id) external {
        Proposal storage proposal = proposals[id];
        if (proposal.state != FutaraTypes.ProposalState.Passed || block.timestamp <= proposal.executionDeadline) revert WrongState();
        proposal.state = FutaraTypes.ProposalState.ExecutionFailed;
    }

    function cancel(uint256 id) external {
        Proposal storage proposal = proposals[id];
        if (proposal.proposer != msg.sender) revert OnlyProposer();
        if (proposal.state != FutaraTypes.ProposalState.Pending) revert WrongState();
        proposal.state = FutaraTypes.ProposalState.Cancelled;
        activeProposalId = 0;
        ConditionalVault(proposal.vaultUsdc).resolve(FutaraTypes.Outcome.Fail);
        ConditionalVault(proposal.vaultToken).resolve(FutaraTypes.Outcome.Fail);
        DecisionAMM(proposal.passAmm).close();
        DecisionAMM(proposal.failAmm).close();
        if (proposal.bond > 0) token.safeTransfer(msg.sender, proposal.bond);
        emit ProposalCancelled(id);
    }

    function setParams(FutaraTypes.FutarchyParams calldata params_) external {
        if (msg.sender != address(treasury)) revert OnlyTreasury();
        if (activeProposalId != 0) revert ProposalActive();
        require(params_.tradingPeriod > params_.twapStartDelay && params_.thresholdBps <= 2_000 && params_.ammFeeBps <= 100, "invalid parameters");
        params = params_;
        emit ParamsUpdated(params_);
    }

    function getActions(uint256 id) external view returns (FutaraTypes.Action[] memory) { return _actions[id]; }

    function getMarket(uint256 id) external view returns (address vaultUsdc, address vaultToken, address passAmm, address failAmm) {
        Proposal storage proposal = proposals[id];
        return (proposal.vaultUsdc, proposal.vaultToken, proposal.passAmm, proposal.failAmm);
    }

    function forecastWindow(uint256 id) external view returns (uint8 proposalState, uint64 createdAt, uint64 tradingStart, uint64 tradingEnd) {
        Proposal storage proposal = proposals[id];
        return (uint8(proposal.state), proposal.createdAt, proposal.tradingStart, proposal.tradingEnd);
    }

    function proposalOutcome(uint256 id) external view returns (uint8) {
        return uint8(proposals[id].outcome);
    }
}
