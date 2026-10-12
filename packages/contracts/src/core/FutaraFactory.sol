// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IFutaraFactory} from "../interfaces/IFutaraFactory.sol";
import {FutaraTypes} from "../libraries/FutaraTypes.sol";

interface IRaiseInitializer { function initialize(uint256, address, IERC20, FutaraTypes.RaiseConfig calldata, FutaraTypes.TokenConfig calldata) external; }
interface ITokenInitializer { function initialize(string calldata, string calldata, uint256, address) external; }
interface ITreasuryInitializer { function initialize(uint256, address, IERC20, IERC20, address, uint256, uint32) external; }
interface IAMMInitializer { function initialize(address, address, uint16, address, bool, uint32) external; }
interface IPerformanceInitializer { function initialize(IERC20, address, address, address, uint256, uint64, uint32, uint32, uint16[] calldata, uint16[] calldata, uint256) external; }
interface IGovernorInitializer { function initialize(uint256, address, address, IERC20, IERC20, address, FutaraTypes.FutarchyParams calldata, address, address, address) external; }

contract FutaraFactory is IFutaraFactory {
    using Math for uint256;

    error InvalidConfiguration();
    error OnlyRaise();
    error OnlyGovernor();
    error ProjectAlreadyLive();

    IERC20 public immutable override usdc;
    address public immutable raiseImpl;
    address public immutable tokenImpl;
    address public immutable treasuryImpl;
    address public immutable governorImpl;
    address public immutable ammImpl;
    address public immutable vaultImpl;
    address public immutable conditionalTokenImpl;
    address public immutable performanceImpl;
    address public immutable owner;
    address public override forecastRegistry;
    uint256 public projectCount;
    mapping(uint256 => ProjectInfo) private _projects;
    mapping(address => uint256) public override projectIdOf;

    event ProjectCreated(uint256 indexed projectId, address indexed founder, address raise, string metadataURI);
    event ProjectLive(uint256 indexed projectId, address token, address treasury, address governor, address spotAmm, address performancePackage);
    event ProposalMarketsCreated(uint256 indexed projectId, uint256 indexed proposalId, address indexed governor, address vaultUsdc, address vaultToken, address passAmm, address failAmm);
    event ForecastRegistryChanged(address indexed registry);

    constructor(IERC20 usdc_, address raiseImpl_, address tokenImpl_, address treasuryImpl_, address governorImpl_, address ammImpl_, address vaultImpl_, address conditionalTokenImpl_, address performanceImpl_) {
        if (address(usdc_) == address(0) || raiseImpl_ == address(0) || tokenImpl_ == address(0) || treasuryImpl_ == address(0) || governorImpl_ == address(0) || ammImpl_ == address(0) || vaultImpl_ == address(0) || conditionalTokenImpl_ == address(0) || performanceImpl_ == address(0)) revert InvalidConfiguration();
        usdc = usdc_;
        raiseImpl = raiseImpl_;
        tokenImpl = tokenImpl_;
        treasuryImpl = treasuryImpl_;
        governorImpl = governorImpl_;
        ammImpl = ammImpl_;
        vaultImpl = vaultImpl_;
        conditionalTokenImpl = conditionalTokenImpl_;
        performanceImpl = performanceImpl_;
        owner = msg.sender;
    }

    function setForecastRegistry(address registry) external {
        require(msg.sender == owner, "only owner");
        require(registry != address(0) && forecastRegistry == address(0) && projectCount == 0, "registry already configured");
        forecastRegistry = registry;
        emit ForecastRegistryChanged(registry);
    }

    function createProject(FutaraTypes.TokenConfig calldata tokenCfg, FutaraTypes.RaiseConfig calldata raiseCfg, FutaraTypes.FutarchyParams calldata params, FutaraTypes.BudgetConfig calldata budget, FutaraTypes.FounderConfig calldata founderCfg, string calldata metadataURI, bytes32 metadataHash) external returns (uint256 projectId) {
        _validate(tokenCfg, raiseCfg, params, budget, founderCfg);
        projectId = ++projectCount;
        address raise = Clones.clone(raiseImpl);
        ProjectInfo storage project = _projects[projectId];
        project.founder = msg.sender;
        project.raise = raise;
        project.metadataURI = metadataURI;
        project.metadataHash = metadataHash;
        project.tokenCfg = tokenCfg;
        project.raiseCfg = raiseCfg;
        project.params = params;
        project.budget = budget;
        project.founderCfg = founderCfg;
        IRaiseInitializer(raise).initialize(projectId, address(this), usdc, raiseCfg, tokenCfg);
        projectIdOf[raise] = projectId;
        emit ProjectCreated(projectId, msg.sender, raise, metadataURI);
    }

    function deployLive(uint256 projectId, uint256 raisePriceE18) external override returns (FutaraTypes.LiveAddrs memory live) {
        ProjectInfo storage p = _projects[projectId];
        if (msg.sender != p.raise) revert OnlyRaise();
        if (p.token != address(0)) revert ProjectAlreadyLive();
        if (raisePriceE18 == 0) revert InvalidConfiguration();

        live.token = Clones.clone(tokenImpl);
        live.treasury = Clones.clone(treasuryImpl);
        live.governor = Clones.clone(governorImpl);
        live.spotAmm = Clones.clone(ammImpl);
        live.performancePackage = Clones.clone(performanceImpl);

        ITokenInitializer(live.token).initialize(p.tokenCfg.name, p.tokenCfg.symbol, p.tokenCfg.totalSupply, p.raise);
        IAMMInitializer(live.spotAmm).initialize(live.token, address(usdc), p.params.ammFeeBps, live.treasury, false, p.params.minUpdateInterval);
        ITreasuryInitializer(live.treasury).initialize(projectId, live.governor, usdc, IERC20(live.token), p.budget.operator, p.budget.monthlyBudget, p.budget.budgetPeriod);
        IGovernorInitializer(live.governor).initialize(projectId, address(this), live.treasury, usdc, IERC20(live.token), live.spotAmm, p.params, vaultImpl, conditionalTokenImpl, ammImpl);

        IPerformanceInitializer(live.performancePackage).initialize(IERC20(live.token), live.treasury, p.founderCfg.beneficiary, live.spotAmm, raisePriceE18, uint64(block.timestamp), p.founderCfg.cliff, p.founderCfg.twapWindow, p.founderCfg.milestoneMultipliersX100, p.founderCfg.unlockBps, p.tokenCfg.totalSupply * p.tokenCfg.allocation.founderBps / 10_000);

        p.token = live.token;
        p.treasury = live.treasury;
        p.governor = live.governor;
        p.spotAmm = live.spotAmm;
        p.performancePackage = live.performancePackage;
        projectIdOf[live.token] = projectId;
        projectIdOf[live.treasury] = projectId;
        projectIdOf[live.governor] = projectId;
        emit ProjectLive(projectId, live.token, live.treasury, live.governor, live.spotAmm, live.performancePackage);
    }

    function getProject(uint256 projectId) external view override returns (ProjectInfo memory) { return _projects[projectId]; }

    /// @notice Re-emits proposal clone addresses from the fixed factory so indexers can discover second-level clones.
    function registerProposalMarkets(uint256 projectId, uint256 proposalId, address vaultUsdc, address vaultToken, address passAmm, address failAmm) external override {
        ProjectInfo storage p = _projects[projectId];
        if (projectId == 0 || msg.sender != p.governor) revert OnlyGovernor();
        if (proposalId == 0 || vaultUsdc == address(0) || vaultToken == address(0) || passAmm == address(0) || failAmm == address(0)) revert InvalidConfiguration();
        emit ProposalMarketsCreated(projectId, proposalId, msg.sender, vaultUsdc, vaultToken, passAmm, failAmm);
    }

    function _validate(FutaraTypes.TokenConfig calldata tokenCfg, FutaraTypes.RaiseConfig calldata raiseCfg, FutaraTypes.FutarchyParams calldata params, FutaraTypes.BudgetConfig calldata budget, FutaraTypes.FounderConfig calldata founderCfg) private view {
        uint256 allocationTotal = uint256(tokenCfg.allocation.saleBps) + tokenCfg.allocation.liquidityBps + tokenCfg.allocation.treasuryBps + tokenCfg.allocation.founderBps;
        if (allocationTotal != 10_000 || tokenCfg.allocation.saleBps == 0 || tokenCfg.allocation.liquidityBps == 0 || tokenCfg.totalSupply == 0 || bytes(tokenCfg.name).length == 0 || bytes(tokenCfg.symbol).length == 0) revert InvalidConfiguration();
        if (raiseCfg.minRaise == 0 || raiseCfg.hardCap < raiseCfg.minRaise || raiseCfg.minContribution == 0 || raiseCfg.minContribution > raiseCfg.hardCap || raiseCfg.endTime <= raiseCfg.startTime || raiseCfg.startTime < block.timestamp || raiseCfg.liquidityUsdcBps == 0 || raiseCfg.liquidityUsdcBps > 5_000) revert InvalidConfiguration();
        if (params.tradingPeriod <= params.twapStartDelay || params.executionWindow == 0 || params.thresholdBps > 2_000 || params.ammFeeBps > 100 || params.minUpdateInterval == 0 || params.maxObsChangeBps == 0 || params.maxObsChangeBps > 200 || params.minLiquidityUsdc == 0) revert InvalidConfiguration();
        if (budget.operator == address(0) || budget.budgetPeriod == 0 || founderCfg.beneficiary == address(0)) revert InvalidConfiguration();
        if (founderCfg.twapWindow == 0 || founderCfg.milestoneMultipliersX100.length == 0 || founderCfg.milestoneMultipliersX100.length != founderCfg.unlockBps.length) revert InvalidConfiguration();
        uint256 unlockTotal;
        for (uint256 i; i < founderCfg.unlockBps.length; ++i) unlockTotal += founderCfg.unlockBps[i];
        if (unlockTotal != 10_000) revert InvalidConfiguration();
        uint256 saleTokens = tokenCfg.totalSupply * tokenCfg.allocation.saleBps / 10_000;
        uint256 liquidityTokens = tokenCfg.totalSupply * tokenCfg.allocation.liquidityBps / 10_000;
        if (saleTokens == 0 || liquidityTokens == 0) revert InvalidConfiguration();
        uint256 raisePrice = Math.mulDiv(raiseCfg.hardCap, 1e30, saleTokens);
        uint256 poolUsdc = raiseCfg.hardCap * raiseCfg.liquidityUsdcBps / 10_000;
        uint256 poolPrice = Math.mulDiv(poolUsdc, 1e30, liquidityTokens);
        if (poolPrice < raisePrice) revert InvalidConfiguration();
        for (uint256 i; i < founderCfg.milestoneMultipliersX100.length; ++i) {
            if (founderCfg.milestoneMultipliersX100[i] < 100 || (i > 0 && founderCfg.milestoneMultipliersX100[i] <= founderCfg.milestoneMultipliersX100[i - 1])) revert InvalidConfiguration();
        }
    }
}
