// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {FutaraTypes} from "../libraries/FutaraTypes.sol";
import {IFutaraFactory} from "../interfaces/IFutaraFactory.sol";
import {DecisionAMM} from "../market/DecisionAMM.sol";

contract Raise is Initializable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error NotActive();
    error BelowMinContribution();
    error AlreadyFinalized();
    error RaiseNotEnded();
    error NothingToClaim();
    error NotFailed();
    error ClaimWindowClosed();
    error NothingToSweep();

    uint256 private constant BPS = 10_000;
    uint64 public constant CLAIM_WINDOW = 90 days;
    IERC20 public usdc;
    IFutaraFactory public factory;
    uint256 public projectId;
    FutaraTypes.RaiseConfig public cfg;
    FutaraTypes.TokenConfig public tokenCfg;
    FutaraTypes.RaiseState public state;
    uint256 public totalContributed;
    uint256 public acceptedTotal;
    uint256 public contributorCount;
    uint64 public claimDeadline;
    mapping(address => uint256) public contributed;
    mapping(address => bool) public claimed;
    address public token;
    address public treasury;

    event Contributed(address indexed user, uint256 amount, uint256 totalContributed);
    event RaiseFailed(uint256 totalContributed);
    event RaiseFinalized(uint256 acceptedTotal, uint256 priceE18, address token);
    event Claimed(address indexed user, uint256 tokens, uint256 refundUsdc);
    event Refunded(address indexed user, uint256 amount);
    event DustSwept(address indexed treasury, uint256 tokenAmount, uint256 usdcAmount);

    constructor() { _disableInitializers(); }

    function initialize(uint256 projectId_, address factory_, IERC20 usdc_, FutaraTypes.RaiseConfig calldata cfg_, FutaraTypes.TokenConfig calldata tokenCfg_) external initializer {
        require(factory_ != address(0) && address(usdc_) != address(0), "invalid raise config");
        projectId = projectId_;
        factory = IFutaraFactory(factory_);
        usdc = usdc_;
        cfg = cfg_;
        tokenCfg = tokenCfg_;
        state = block.timestamp >= cfg_.startTime ? FutaraTypes.RaiseState.Active : FutaraTypes.RaiseState.Pending;
    }

    function contribute(uint256 amount) public nonReentrant {
        if (state == FutaraTypes.RaiseState.Finalized || state == FutaraTypes.RaiseState.Failed) revert AlreadyFinalized();
        if (block.timestamp < cfg.startTime || block.timestamp >= cfg.endTime) revert NotActive();
        if (amount < cfg.minContribution) revert BelowMinContribution();
        state = FutaraTypes.RaiseState.Active;
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        if (contributed[msg.sender] == 0) contributorCount++;
        contributed[msg.sender] += amount;
        totalContributed += amount;
        emit Contributed(msg.sender, amount, totalContributed);
    }

    function contributeWithPermit(uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external {
        IERC20Permit(address(usdc)).permit(msg.sender, address(this), amount, deadline, v, r, s);
        contribute(amount);
    }

    function finalize() external nonReentrant {
        if (state == FutaraTypes.RaiseState.Finalized || state == FutaraTypes.RaiseState.Failed) revert AlreadyFinalized();
        if (block.timestamp < cfg.endTime) revert RaiseNotEnded();
        if (totalContributed < cfg.minRaise) {
            state = FutaraTypes.RaiseState.Failed;
            emit RaiseFailed(totalContributed);
            return;
        }
        acceptedTotal = totalContributed < cfg.hardCap ? totalContributed : cfg.hardCap;
        uint256 saleTokens = tokenCfg.totalSupply * tokenCfg.allocation.saleBps / BPS;
        uint256 raisePriceE18 = Math.mulDiv(acceptedTotal, 1e30, saleTokens);
        FutaraTypes.LiveAddrs memory live = factory.deployLive(projectId, raisePriceE18);
        token = live.token;
        treasury = live.treasury;
        uint256 liquidityTokens = tokenCfg.totalSupply * tokenCfg.allocation.liquidityBps / BPS;
        uint256 treasuryTokens = tokenCfg.totalSupply * tokenCfg.allocation.treasuryBps / BPS;
        uint256 founderTokens = tokenCfg.totalSupply * tokenCfg.allocation.founderBps / BPS;
        // Per-wallet floor rounding can make aggregate refunds exceed the nominal excess by
        // at most one USDC base unit per contributor. Keep that bounded dust in the raise
        // until claims close instead of transferring it to the treasury prematurely.
        uint256 roundingReserve = totalContributed > cfg.hardCap ? contributorCount : 0;
        uint256 deployableAccepted = acceptedTotal > roundingReserve ? acceptedTotal - roundingReserve : 0;
        uint256 usdcForPool = deployableAccepted * cfg.liquidityUsdcBps / BPS;
        uint256 poolPriceE18 = Math.mulDiv(raisePriceE18, BPS + cfg.liquidityPremiumBps, BPS);
        uint256 tokensForPool = poolPriceE18 == 0 ? 0 : Math.mulDiv(usdcForPool, 1e30, poolPriceE18);
        if (tokensForPool > liquidityTokens) tokensForPool = liquidityTokens;
        treasuryTokens += liquidityTokens - tokensForPool;
        uint256 treasuryUsdc = deployableAccepted - usdcForPool;

        IERC20 projectToken = IERC20(live.token);
        if (tokensForPool > 0 && usdcForPool > 0) {
            projectToken.forceApprove(live.spotAmm, tokensForPool);
            usdc.forceApprove(live.spotAmm, usdcForPool);
            DecisionAMM(live.spotAmm).addLiquidity(tokensForPool, usdcForPool, 1, live.treasury);
        }
        if (treasuryTokens > 0) projectToken.safeTransfer(live.treasury, treasuryTokens);
        if (founderTokens > 0) projectToken.safeTransfer(live.performancePackage, founderTokens);
        if (treasuryUsdc > 0) usdc.safeTransfer(live.treasury, treasuryUsdc);
        state = FutaraTypes.RaiseState.Finalized;
        claimDeadline = uint64(block.timestamp + CLAIM_WINDOW);
        emit RaiseFinalized(acceptedTotal, raisePriceE18, live.token);
    }

    function previewClaim(address user) public view returns (uint256 tokens, uint256 refundUsdc) {
        uint256 deposit = contributed[user];
        if (deposit == 0) return (0, 0);
        if (state == FutaraTypes.RaiseState.Finalized && block.timestamp > claimDeadline) return (0, 0);
        if (state == FutaraTypes.RaiseState.Failed) return (0, deposit);
        if (state != FutaraTypes.RaiseState.Finalized) return (0, 0);
        uint256 accepted = totalContributed <= cfg.hardCap ? deposit : Math.mulDiv(deposit, cfg.hardCap, totalContributed);
        refundUsdc = deposit - accepted;
        uint256 saleTokens = tokenCfg.totalSupply * tokenCfg.allocation.saleBps / BPS;
        tokens = acceptedTotal == 0 ? 0 : Math.mulDiv(accepted, saleTokens, acceptedTotal);
    }

    function claim() external nonReentrant {
        if (state != FutaraTypes.RaiseState.Finalized || claimed[msg.sender]) revert NothingToClaim();
        if (block.timestamp > claimDeadline) revert ClaimWindowClosed();
        (uint256 tokens, uint256 refundUsdc) = previewClaim(msg.sender);
        if (tokens == 0 && refundUsdc == 0) revert NothingToClaim();
        claimed[msg.sender] = true;
        if (tokens > 0) IERC20(token).safeTransfer(msg.sender, tokens);
        if (refundUsdc > 0) usdc.safeTransfer(msg.sender, refundUsdc);
        emit Claimed(msg.sender, tokens, refundUsdc);
    }

    function refund() external nonReentrant {
        if (state != FutaraTypes.RaiseState.Failed) revert NotFailed();
        uint256 amount = contributed[msg.sender];
        if (amount == 0 || claimed[msg.sender]) revert NothingToClaim();
        claimed[msg.sender] = true;
        usdc.safeTransfer(msg.sender, amount);
        emit Refunded(msg.sender, amount);
    }

    function sweepDust() external nonReentrant {
        if (state != FutaraTypes.RaiseState.Finalized || block.timestamp <= claimDeadline) revert ClaimWindowClosed();
        uint256 tokenAmount = IERC20(token).balanceOf(address(this));
        uint256 usdcAmount = usdc.balanceOf(address(this));
        if (tokenAmount == 0 && usdcAmount == 0) revert NothingToSweep();
        if (tokenAmount > 0) IERC20(token).safeTransfer(treasury, tokenAmount);
        if (usdcAmount > 0) usdc.safeTransfer(treasury, usdcAmount);
        emit DustSwept(treasury, tokenAmount, usdcAmount);
    }
}
