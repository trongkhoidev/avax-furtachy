// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {DecisionAMM} from "../src/market/DecisionAMM.sol";
import {ConditionalVault} from "../src/market/ConditionalVault.sol";
import {ConditionalToken} from "../src/market/ConditionalToken.sol";
import {FutaraFactory} from "../src/core/FutaraFactory.sol";
import {Raise} from "../src/core/Raise.sol";
import {ProjectToken} from "../src/core/ProjectToken.sol";
import {Treasury} from "../src/core/Treasury.sol";
import {FutarchyGovernor} from "../src/core/FutarchyGovernor.sol";
import {PerformancePackage, ISpotOracle} from "../src/core/PerformancePackage.sol";
import {FutaraTypes} from "../src/libraries/FutaraTypes.sol";
import {ForecastRegistry, IForecastFactory} from "../src/agents/ForecastRegistry.sol";
import {ReputationReporter} from "../src/agents/ReputationReporter.sol";
import {IERC8004Identity, IERC8004Reputation} from "../src/interfaces/IERC8004.sol";
import {IFutaraFactory} from "../src/interfaces/IFutaraFactory.sol";

interface Vm {
    function warp(uint256 timestamp) external;
    function prank(address sender) external;
    function expectRevert(bytes4 selector) external;
}

contract TestToken is ERC20 {
    uint8 private immutable _decimals;
    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) { _decimals = decimals_; }
    function decimals() public view override returns (uint8) { return _decimals; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract MockAgentIdentity is IERC8004Identity {
    address public owner;
    constructor(address owner_) { owner = owner_; }
    function ownerOf(uint256) external view returns (address) { return owner; }
    function getAgentWallet(uint256) external pure returns (address) { return address(0); }
}

contract MockForecastFactory is IForecastFactory {
    mapping(address => uint256) public projectIdOf;
    function setGovernor(address governor, uint256 projectId) external { projectIdOf[governor] = projectId; }
}

contract MockForecastGovernor {
    uint64 public tradingEnd;
    uint8 public outcome = 1;
    constructor(uint64 end_) { tradingEnd = end_; }
    function forecastWindow(uint256) external view returns (uint8, uint64, uint64, uint64) { return (2, 0, 0, tradingEnd); }
    function proposalOutcome(uint256) external view returns (uint8) { return outcome; }
}

contract MockFeedbackRegistry is IERC8004Reputation {
    uint256 public calls;
    function giveFeedback(uint256, int128, uint8, string calldata, string calldata, string calldata, string calldata, bytes32) external { calls++; }
}

contract MockSpotOracle {
    uint256 public price;
    function setPrice(uint256 price_) external { price = price_; }
    function consult(uint32) external view returns (uint256) { return price; }
}

contract FutaraProtocolTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 private constant E18 = 1e18;
    uint256 private constant E6 = 1e6;
    uint256 private constant START = 1_800_000_000;

    TestToken private usdc;
    TestToken private token;
    DecisionAMM private ammImplementation;

    function setUp() public {
        vm.warp(START);
        usdc = new TestToken("USD Coin", "USDC", 6);
        token = new TestToken("Project Token", "EDU", 18);
        ammImplementation = new DecisionAMM();
        DecisionAMM amm = _newAmm(address(token), address(usdc), address(this), false);
        token.mint(address(this), 10_000 * E18);
        usdc.mint(address(this), 10_000 * E6);
        token.approve(address(amm), type(uint256).max);
        usdc.approve(address(amm), type(uint256).max);
        amm.addLiquidity(1_000 * E18, 1_000 * E6, 1, address(this));
    }

    function testSwapUsesConstantProductFormulaAndKeepsInputFeeInPool() public {
        DecisionAMM amm = _newAmm(address(token), address(usdc), address(this), false);
        token.mint(address(this), 1_000 * E18);
        usdc.mint(address(this), 1_000 * E6);
        token.approve(address(amm), type(uint256).max);
        usdc.approve(address(amm), type(uint256).max);
        amm.addLiquidity(1_000 * E18, 1_000 * E6, 1, address(this));

        uint256 amountIn = 100 * E6;
        uint256 expectedOut = amm.getAmountOut(true, amountIn);
        uint256 quoteBefore = usdc.balanceOf(address(amm));
        uint256 baseBefore = token.balanceOf(address(this));
        uint256 actualOut = amm.swapExactQuoteForBase(amountIn, expectedOut, address(this), uint64(block.timestamp));

        require(actualOut == expectedOut, "quote mismatch");
        require(token.balanceOf(address(this)) == baseBefore + actualOut, "recipient output mismatch");
        require(usdc.balanceOf(address(amm)) == quoteBefore + amountIn, "fee/input not retained");
        require(amm.reserveBase() == 1_000 * E18 - actualOut, "base reserve mismatch");
        require(amm.reserveQuote() == 1_100 * E6, "quote reserve mismatch");
    }

    function testSwapRejectsExpiredDeadlineAndInsufficientOutput() public {
        DecisionAMM amm = _newAmm(address(token), address(usdc), address(this), false);
        token.mint(address(this), 1_000 * E18);
        usdc.mint(address(this), 1_000 * E6);
        token.approve(address(amm), type(uint256).max);
        usdc.approve(address(amm), type(uint256).max);
        amm.addLiquidity(1_000 * E18, 1_000 * E6, 1, address(this));
        usdc.approve(address(amm), type(uint256).max);

        vm.expectRevert(DecisionAMM.Expired.selector);
        amm.swapExactQuoteForBase(E6, 0, address(this), uint64(block.timestamp - 1));
        vm.expectRevert(DecisionAMM.InsufficientOutput.selector);
        amm.swapExactQuoteForBase(E6, type(uint256).max, address(this), uint64(block.timestamp));
    }

    function testConditionalMarketOnlyTradesAndAddsLiquidityDuringTrading() public {
        DecisionAMM amm = _newAmm(address(token), address(usdc), address(this), true);
        token.mint(address(this), 1_000 * E18);
        usdc.mint(address(this), 1_000 * E6);
        token.approve(address(amm), type(uint256).max);
        usdc.approve(address(amm), type(uint256).max);
        amm.addLiquidity(1_000 * E18, 1_000 * E6, 1, address(this));

        vm.expectRevert(DecisionAMM.TradingNotStarted.selector);
        amm.swapExactQuoteForBase(E6, 0, address(this), uint64(block.timestamp + 200));
        uint64 start = uint64(block.timestamp + 10);
        uint64 end = uint64(block.timestamp + 110);
        amm.startTwap(start, end, amm.spotPriceE18(), amm.spotPriceE18() / 100);
        amm.swapExactQuoteForBase(E6, 0, address(this), end);
        amm.addLiquidity(E18, E6, 1, address(this));
        vm.warp(end);
        vm.expectRevert(DecisionAMM.TradingEnded.selector);
        amm.swapExactQuoteForBase(E6, 0, address(this), end);
        vm.expectRevert(DecisionAMM.TradingEnded.selector);
        amm.addLiquidity(E18, E6, 1, address(this));
    }

    function testTwapClampsPriceChangeToConfiguredPerUpdateLimit() public {
        DecisionAMM amm = _newAmm(address(token), address(usdc), address(this), true);
        token.mint(address(this), 2_000 * E18);
        usdc.mint(address(this), 2_000 * E6);
        token.approve(address(amm), type(uint256).max);
        usdc.approve(address(amm), type(uint256).max);
        amm.addLiquidity(1_000 * E18, 1_000 * E6, 1, address(this));
        uint256 seed = amm.spotPriceE18();
        uint256 maxDelta = seed / 100;
        uint64 twapStart = uint64(block.timestamp + 10);
        uint64 end = uint64(block.timestamp + 110);
        amm.startTwap(twapStart, end, seed, maxDelta);

        vm.warp(twapStart);
        amm.swapExactQuoteForBase(500 * E6, 0, address(this), end);
        vm.warp(end);
        uint256 twap = amm.finalizeTwap(end);
        require(twap == seed + maxDelta, "observation was not clamped");
    }

    function testConditionalVaultSplitMergeResolveAndRedeemMaintainBacking() public {
        ConditionalToken tokenImplementation = new ConditionalToken();
        ConditionalVault vaultImplementation = new ConditionalVault();
        ConditionalVault vault = ConditionalVault(Clones.clone(address(vaultImplementation)));
        vault.initialize(usdc, address(this), 1, address(tokenImplementation), "USDC");
        uint256 amount = 100 * E6;
        usdc.mint(address(this), amount);
        usdc.approve(address(vault), amount);
        vault.split(amount, address(this));
        _assertVaultBacking(vault, amount);
        vault.merge(40 * E6, address(this));
        _assertVaultBacking(vault, 60 * E6);

        vm.expectRevert(ConditionalVault.NotResolved.selector);
        vault.redeem(address(this));
        vault.resolve(FutaraTypes.Outcome.Pass);
        uint256 redeemed = vault.redeem(address(this));
        require(redeemed == 60 * E6, "wrong redemption amount");
        require(usdc.balanceOf(address(vault)) == 0, "underlying not redeemed");
        require(vault.failToken().totalSupply() == 60 * E6, "losing supply changed");
    }

    function testTreasuryOperatorBudgetIsBoundedAndResetsAfterPeriod() public {
        Treasury implementation = new Treasury();
        Treasury treasury = Treasury(payable(Clones.clone(address(implementation))));
        address operator = address(0xBEEF);
        address recipient = address(0xCAFE);
        uint32 period = 30 days;
        treasury.initialize(1, address(this), usdc, token, operator, 5_000 * E6, period);
        usdc.mint(address(treasury), 10_000 * E6);

        vm.prank(operator);
        treasury.claimBudget(5_000 * E6, recipient);
        require(usdc.balanceOf(recipient) == 5_000 * E6, "budget claim missing");
        vm.expectRevert(Treasury.BudgetExceeded.selector);
        vm.prank(operator);
        treasury.claimBudget(1, recipient);

        vm.warp(block.timestamp + period);
        vm.prank(operator);
        treasury.claimBudget(5_000 * E6, recipient);
        require(usdc.balanceOf(recipient) == 10_000 * E6, "budget did not reset");
    }

    function testFounderPackageUnlocksSequentialPriceMilestonesAndReleasesOnce() public {
        PerformancePackage implementation = new PerformancePackage();
        PerformancePackage package_ = PerformancePackage(Clones.clone(address(implementation)));
        MockSpotOracle oracle = new MockSpotOracle();
        uint16[] memory multiples = new uint16[](2);
        uint16[] memory unlocks = new uint16[](2);
        multiples[0] = 200;
        multiples[1] = 400;
        unlocks[0] = 5_000;
        unlocks[1] = 5_000;
        package_.initialize(token, address(0xBEEF), address(0xCAFE), ISpotOracle(address(oracle)), E18, uint64(block.timestamp), 100, 10, multiples, unlocks, 1_000 * E18);
        token.mint(address(package_), 1_000 * E18);

        vm.expectRevert(PerformancePackage.CliffNotReached.selector);
        package_.unlockNext();
        vm.warp(block.timestamp + 100);
        oracle.setPrice(2 * E18 - 1);
        vm.expectRevert(PerformancePackage.MilestoneNotReached.selector);
        package_.unlockNext();

        oracle.setPrice(2 * E18);
        package_.unlockNext();
        require(package_.release() == 500 * E18, "first tranche incorrect");
        vm.expectRevert(PerformancePackage.NothingToRelease.selector);
        package_.release();

        oracle.setPrice(4 * E18);
        package_.unlockNext();
        require(package_.release() == 500 * E18, "second tranche incorrect");
        require(token.balanceOf(address(0xCAFE)) == 1_000 * E18, "beneficiary allocation mismatch");
    }

    function testFactoryBlocksDocumentedDilutivePoolAndAcceptsCorrectedAllocation() public {
        FutaraFactory factory = _newFactory();
        (FutaraTypes.TokenConfig memory tokenCfg, FutaraTypes.FutarchyParams memory params, FutaraTypes.BudgetConfig memory budget, FutaraTypes.FounderConfig memory founder) = _configs(uint64(block.timestamp + 100), uint64(block.timestamp + 1_000));
        FutaraTypes.RaiseConfig memory raiseCfg = _raiseConfig(uint64(block.timestamp + 100), uint64(block.timestamp + 1_000), 2_000);

        vm.expectRevert(FutaraFactory.InvalidConfiguration.selector);
        factory.createProject(tokenCfg, raiseCfg, params, budget, founder, "demo://educhain", bytes32(0));

        raiseCfg.liquidityUsdcBps = 3_000;
        uint256 id = factory.createProject(tokenCfg, raiseCfg, params, budget, founder, "demo://educhain", bytes32(0));
        require(id == 1 && factory.projectCount() == 1, "valid seed rejected");
    }

    function testRaiseOversubscriptionClaimsProRataAndRefundsExcess() public {
        FutaraFactory factory = _newFactory();
        uint64 start = uint64(block.timestamp + 10);
        uint64 end = start + 100;
        (FutaraTypes.TokenConfig memory tokenCfg, FutaraTypes.FutarchyParams memory params, FutaraTypes.BudgetConfig memory budget, FutaraTypes.FounderConfig memory founder) = _configs(start, end);
        FutaraTypes.RaiseConfig memory raiseCfg = _raiseConfig(start, end, 3_000);
        uint256 id = factory.createProject(tokenCfg, raiseCfg, params, budget, founder, "demo://educhain", bytes32(0));
        Raise raise = Raise(factory.getProject(id).raise);
        address alice = address(0xA11CE);
        address bob = address(0xB0B);
        usdc.mint(alice, 100_000 * E6);
        usdc.mint(bob, 160_000 * E6);
        vm.warp(start);
        vm.prank(alice);
        usdc.approve(address(raise), type(uint256).max);
        vm.prank(alice);
        raise.contribute(100_000 * E6);
        vm.prank(bob);
        usdc.approve(address(raise), type(uint256).max);
        vm.prank(bob);
        raise.contribute(160_000 * E6);
        vm.warp(end);
        raise.finalize();

        (uint256 aliceTokens, uint256 aliceRefund) = raise.previewClaim(alice);
        (uint256 bobTokens, uint256 bobRefund) = raise.previewClaim(bob);
        require(aliceTokens > 0 && bobTokens > aliceTokens, "pro rata token allocations wrong");
        require(aliceRefund > 0 && bobRefund > aliceRefund, "pro rata refunds wrong");
        vm.prank(alice);
        raise.claim();
        vm.prank(bob);
        raise.claim();
        require(TestToken(raise.token()).balanceOf(alice) == aliceTokens, "alice claim mismatch");
        require(TestToken(raise.token()).balanceOf(bob) == bobTokens, "bob claim mismatch");
        require(usdc.balanceOf(alice) == aliceRefund && usdc.balanceOf(bob) == bobRefund, "refund mismatch");

        vm.expectRevert(FutaraFactory.OnlyGovernor.selector);
        factory.registerProposalMarkets(id, 1, address(1), address(2), address(3), address(4));
    }

    function testRaiseBelowMinimumCanBeRefunded() public {
        FutaraFactory factory = _newFactory();
        uint64 start = uint64(block.timestamp + 10);
        uint64 end = start + 100;
        (FutaraTypes.TokenConfig memory tokenCfg, FutaraTypes.FutarchyParams memory params, FutaraTypes.BudgetConfig memory budget, FutaraTypes.FounderConfig memory founder) = _configs(start, end);
        FutaraTypes.RaiseConfig memory raiseCfg = _raiseConfig(start, end, 3_000);
        uint256 id = factory.createProject(tokenCfg, raiseCfg, params, budget, founder, "demo://failed", bytes32(0));
        Raise raise = Raise(factory.getProject(id).raise);
        address backer = address(0xBACC);
        usdc.mint(backer, 40_000 * E6);
        vm.warp(start);
        vm.prank(backer);
        usdc.approve(address(raise), type(uint256).max);
        vm.prank(backer);
        raise.contribute(40_000 * E6);
        vm.warp(end);
        raise.finalize();
        vm.prank(backer);
        raise.refund();
        require(usdc.balanceOf(backer) == 40_000 * E6, "refund missing");
    }

    function testProposalPassExecutesTreasuryActionOnlyAfterTwapResolution() public {
        FutaraFactory factory = _newFactory();
        uint64 raiseStart = uint64(block.timestamp + 10);
        uint64 raiseEnd = raiseStart + 100;
        (FutaraTypes.TokenConfig memory tokenCfg, FutaraTypes.FutarchyParams memory params, FutaraTypes.BudgetConfig memory budget, FutaraTypes.FounderConfig memory founder) = _configs(raiseStart, raiseEnd);
        FutaraTypes.RaiseConfig memory raiseCfg = _raiseConfig(raiseStart, raiseEnd, 3_000);
        uint256 projectId = factory.createProject(tokenCfg, raiseCfg, params, budget, founder, "demo://governed", bytes32(0));
        Raise raise = Raise(factory.getProject(projectId).raise);

        usdc.mint(address(this), 200_000 * E6);
        usdc.approve(address(raise), type(uint256).max);
        vm.warp(raiseStart);
        raise.contribute(200_000 * E6);
        vm.warp(raiseEnd);
        raise.finalize();
        raise.claim();

        IFutaraFactory.ProjectInfo memory project = factory.getProject(projectId);
        ProjectToken projectToken = ProjectToken(project.token);
        FutarchyGovernor governor = FutarchyGovernor(project.governor);
        projectToken.approve(address(governor), type(uint256).max);
        usdc.mint(address(this), 70_000 * E6);
        usdc.approve(address(governor), type(uint256).max);

        address recipient = address(0xBEEF);
        FutaraTypes.Action[] memory actions = new FutaraTypes.Action[](1);
        actions[0] = FutaraTypes.Action({
            target: project.treasury,
            value: 0,
            data: abi.encodeWithSignature("transferERC20(address,address,uint256)", address(usdc), recipient, 30_000 * E6)
        });
        uint256 proposalId = governor.propose(actions, "ipfs://proposal", keccak256("proposal"), 50_000 * E6, 1_300_000 * E18);

        uint64 tradingStart = uint64(block.timestamp + params.warmup);
        vm.warp(tradingStart);
        governor.activate(proposalId);
        uint64 tradingEnd = tradingStart + params.tradingPeriod;
        (address usdcVault,, address passAmm, address failAmm) = governor.getMarket(proposalId);
        usdc.approve(usdcVault, type(uint256).max);
        ConditionalVault(usdcVault).split(20_000 * E6, address(this));
        ConditionalVault(usdcVault).passToken().approve(passAmm, type(uint256).max);

        vm.warp(tradingStart + params.twapStartDelay + 1);
        DecisionAMM(passAmm).swapExactQuoteForBase(20_000 * E6, 0, address(this), tradingEnd);
        for (uint256 i; i < 40; ++i) {
            vm.warp(block.timestamp + params.minUpdateInterval);
            DecisionAMM(passAmm).crank();
            DecisionAMM(failAmm).crank();
        }

        require(block.timestamp < tradingEnd, "test exceeded trading window");
        vm.warp(tradingEnd);
        governor.finalize(proposalId);
        require(governor.proposalOutcome(proposalId) == uint8(FutaraTypes.Outcome.Pass), "TWAP did not pass threshold");
        require(usdc.balanceOf(recipient) == 30_000 * E6, "passed action did not execute");
    }

    function testForecastsAndReputationRejectUnknownGovernors() public {
        MockAgentIdentity identity = new MockAgentIdentity(address(this));
        MockForecastFactory factory = new MockForecastFactory();
        uint64 tradingEnd = uint64(block.timestamp + 100);
        MockForecastGovernor governor = new MockForecastGovernor(tradingEnd);
        ForecastRegistry forecasts = new ForecastRegistry(IERC8004Identity(address(identity)), 300, IForecastFactory(address(factory)));
        MockFeedbackRegistry feedback = new MockFeedbackRegistry();
        ReputationReporter reporter = new ReputationReporter(IERC8004Reputation(address(feedback)), forecasts);

        bytes32 salt = keccak256("forecast salt");
        bytes32 commitment = keccak256(abi.encode(address(governor), 3, 7, uint16(7_200), salt));
        vm.expectRevert(ForecastRegistry.UnknownGovernor.selector);
        forecasts.commit(address(governor), 3, 7, commitment);
        vm.expectRevert(ReputationReporter.UnknownGovernor.selector);
        reporter.report(address(governor), 3, 7);

        factory.setGovernor(address(governor), 1);
        forecasts.commit(address(governor), 3, 7, commitment);
        vm.warp(tradingEnd);
        forecasts.reveal(address(governor), 3, 7, 7_200, salt);
        uint256 score = reporter.report(address(governor), 3, 7);
        require(score == 9_216 && feedback.calls() == 1, "forecast was not scored correctly");
        vm.expectRevert(ReputationReporter.AlreadyReported.selector);
        reporter.report(address(governor), 3, 7);
    }

    function _newAmm(address base, address quote, address controller, bool locked) private returns (DecisionAMM amm) {
        amm = DecisionAMM(Clones.clone(address(ammImplementation)));
        amm.initialize(base, quote, 30, controller, locked, 10);
    }

    function _newFactory() private returns (FutaraFactory) {
        return new FutaraFactory(usdc, address(new Raise()), address(new ProjectToken()), address(new Treasury()), address(new FutarchyGovernor()), address(new DecisionAMM()), address(new ConditionalVault()), address(new ConditionalToken()), address(new PerformancePackage()));
    }

    function _configs(uint64 start, uint64 end) private pure returns (FutaraTypes.TokenConfig memory tokenCfg, FutaraTypes.FutarchyParams memory params, FutaraTypes.BudgetConfig memory budget, FutaraTypes.FounderConfig memory founder) {
        start; end;
        tokenCfg = FutaraTypes.TokenConfig({name: "EduChain", symbol: "EDU", totalSupply: 10_000_000 * E18, allocation: FutaraTypes.Allocation({saleBps: 5_000, liquidityBps: 1_500, treasuryBps: 2_000, founderBps: 1_500})});
        params = FutaraTypes.FutarchyParams({warmup: 30, tradingPeriod: 900, twapStartDelay: 180, executionWindow: 300, minUpdateInterval: 10, maxObsChangeBps: 200, thresholdBps: 300, ammFeeBps: 30, proposalBond: 10_000 * E18, minLiquidityUsdc: 50_000 * E6});
        budget = FutaraTypes.BudgetConfig({operator: address(0xBEEF), monthlyBudget: 5_000 * E6, budgetPeriod: 120});
        uint16[] memory milestones = new uint16[](4);
        uint16[] memory unlocks = new uint16[](4);
        milestones[0] = 200; milestones[1] = 400; milestones[2] = 800; milestones[3] = 1_600;
        unlocks[0] = 2_500; unlocks[1] = 2_500; unlocks[2] = 2_500; unlocks[3] = 2_500;
        founder = FutaraTypes.FounderConfig({beneficiary: address(0xCAFE), cliff: 0, twapWindow: 300, milestoneMultipliersX100: milestones, unlockBps: unlocks});
    }

    function _raiseConfig(uint64 start, uint64 end, uint16 liquidityBps) private pure returns (FutaraTypes.RaiseConfig memory) {
        return FutaraTypes.RaiseConfig({minRaise: 50_000 * E6, hardCap: 200_000 * E6, minContribution: E6, startTime: start, endTime: end, liquidityUsdcBps: liquidityBps, liquidityPremiumBps: 0});
    }

    function _assertVaultBacking(ConditionalVault vault, uint256 expected) private view {
        require(usdc.balanceOf(address(vault)) == expected, "vault underlying mismatch");
        require(vault.passToken().totalSupply() == expected, "pass supply mismatch");
        require(vault.failToken().totalSupply() == expected, "fail supply mismatch");
    }
}
