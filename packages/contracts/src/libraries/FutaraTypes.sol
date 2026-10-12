// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library FutaraTypes {
    enum RaiseState { Pending, Active, Failed, Succeeded, Finalized }
    enum ProposalState { None, Pending, Trading, Finalizable, Passed, Failed, Executed, ExecutionFailed, Cancelled }
    enum Outcome { Unresolved, Pass, Fail }

    struct Allocation {
        uint16 saleBps;
        uint16 liquidityBps;
        uint16 treasuryBps;
        uint16 founderBps;
    }

    struct RaiseConfig {
        uint256 minRaise;
        uint256 hardCap;
        uint256 minContribution;
        uint64 startTime;
        uint64 endTime;
        uint16 liquidityUsdcBps;
        uint16 liquidityPremiumBps;
    }

    struct TokenConfig {
        string name;
        string symbol;
        uint256 totalSupply;
        Allocation allocation;
    }

    struct FutarchyParams {
        uint32 warmup;
        uint32 tradingPeriod;
        uint32 twapStartDelay;
        uint32 executionWindow;
        uint32 minUpdateInterval;
        uint16 maxObsChangeBps;
        uint16 thresholdBps;
        uint16 ammFeeBps;
        uint256 proposalBond;
        uint256 minLiquidityUsdc;
    }

    struct BudgetConfig {
        address operator;
        uint256 monthlyBudget;
        uint32 budgetPeriod;
    }

    struct FounderConfig {
        address beneficiary;
        uint32 cliff;
        uint32 twapWindow;
        uint16[] milestoneMultipliersX100;
        uint16[] unlockBps;
    }

    struct Action {
        address target;
        uint256 value;
        bytes data;
    }

    struct LiveAddrs {
        address token;
        address treasury;
        address governor;
        address spotAmm;
        address performancePackage;
    }
}
