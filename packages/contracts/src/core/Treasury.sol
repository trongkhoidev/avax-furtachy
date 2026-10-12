// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {FutaraTypes} from "../libraries/FutaraTypes.sol";

contract Treasury is Initializable {
    using SafeERC20 for IERC20;

    error OnlyGovernor();
    error OnlySelf();
    error OnlyOperator();
    error BudgetExceeded();
    error ActionFailed(uint256 index, bytes reason);

    uint256 public projectId;
    address public governor;
    IERC20 public usdc;
    IERC20 public token;
    address public operator;
    uint256 public monthlyBudget;
    uint32 public budgetPeriod;
    uint64 public currentPeriodStart;
    uint256 public claimedThisPeriod;

    event Executed(uint256 indexed proposalId, uint256 actionCount);
    event BudgetClaimed(address indexed to, uint256 amount, uint64 periodStart);
    event BudgetChanged(uint256 amount);
    event OperatorChanged(address indexed operator);

    constructor() { _disableInitializers(); }

    function initialize(uint256 projectId_, address governor_, IERC20 usdc_, IERC20 token_, address operator_, uint256 budget_, uint32 period_) external initializer {
        require(governor_ != address(0) && address(usdc_) != address(0) && address(token_) != address(0) && operator_ != address(0) && period_ != 0, "invalid treasury config");
        projectId = projectId_;
        governor = governor_;
        usdc = usdc_;
        token = token_;
        operator = operator_;
        monthlyBudget = budget_;
        budgetPeriod = period_;
        currentPeriodStart = uint64(block.timestamp);
    }

    function execute(uint256 proposalId, FutaraTypes.Action[] calldata actions) external {
        if (msg.sender != governor) revert OnlyGovernor();
        for (uint256 i; i < actions.length; ++i) {
            (bool ok, bytes memory reason) = actions[i].target.call{value: actions[i].value}(actions[i].data);
            if (!ok) revert ActionFailed(i, reason);
        }
        emit Executed(proposalId, actions.length);
    }

    function transferERC20(IERC20 asset, address to, uint256 amount) external {
        if (msg.sender != address(this)) revert OnlySelf();
        asset.safeTransfer(to, amount);
    }

    function approveERC20(IERC20 asset, address spender, uint256 amount) external {
        if (msg.sender != address(this)) revert OnlySelf();
        asset.forceApprove(spender, amount);
    }

    function setMonthlyBudget(uint256 amount) external {
        if (msg.sender != address(this)) revert OnlySelf();
        monthlyBudget = amount;
        emit BudgetChanged(amount);
    }

    function setOperator(address operator_) external {
        if (msg.sender != address(this)) revert OnlySelf();
        require(operator_ != address(0), "zero operator");
        operator = operator_;
        emit OperatorChanged(operator_);
    }

    function claimBudget(uint256 amount, address to) external {
        if (msg.sender != operator) revert OnlyOperator();
        if (block.timestamp >= uint256(currentPeriodStart) + budgetPeriod) {
            currentPeriodStart = uint64(block.timestamp);
            claimedThisPeriod = 0;
        }
        if (amount == 0 || claimedThisPeriod + amount > monthlyBudget) revert BudgetExceeded();
        claimedThisPeriod += amount;
        usdc.safeTransfer(to, amount);
        emit BudgetClaimed(to, amount, currentPeriodStart);
    }

    receive() external payable {}
}
