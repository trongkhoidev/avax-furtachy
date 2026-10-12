// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ISpotOracle {
    function consult(uint32 secondsAgo) external view returns (uint256 twapE18);
}

interface ITreasuryAddress {
    function governor() external view returns (address);
}

contract PerformancePackage is Initializable {
    using SafeERC20 for IERC20;

    error OnlyTreasury();
    error CliffNotReached();
    error MilestoneNotReached();
    error NothingToRelease();

    IERC20 public token;
    address public treasury;
    address public beneficiary;
    ISpotOracle public spotAmm;
    uint256 public raisePriceE18;
    uint64 public startTime;
    uint32 public cliff;
    uint32 public twapWindow;
    uint16[] private _multipliersX100;
    uint16[] private _unlockBps;
    uint256 public totalAllocation;
    uint256 public unlockedTranches;
    uint256 public released;

    event TrancheUnlocked(uint256 indexed tranche, uint256 multiplierX100, uint256 twapE18);
    event TokensReleased(address indexed beneficiary, uint256 amount);
    event BeneficiaryChanged(address indexed beneficiary);

    constructor() { _disableInitializers(); }

    function initialize(IERC20 token_, address treasury_, address beneficiary_, ISpotOracle spotAmm_, uint256 raisePriceE18_, uint64 startTime_, uint32 cliff_, uint32 twapWindow_, uint16[] calldata multipliers_, uint16[] calldata unlockBps_, uint256 totalAllocation_) external initializer {
        require(address(token_) != address(0) && treasury_ != address(0) && beneficiary_ != address(0) && address(spotAmm_) != address(0), "invalid package config");
        require(multipliers_.length != 0 && multipliers_.length == unlockBps_.length, "invalid milestones");
        uint256 sum;
        for (uint256 i; i < unlockBps_.length; ++i) { sum += unlockBps_[i]; _multipliersX100.push(multipliers_[i]); _unlockBps.push(unlockBps_[i]); }
        require(sum == 10_000, "unlock allocation must equal 100%");
        token = token_;
        treasury = treasury_;
        beneficiary = beneficiary_;
        spotAmm = spotAmm_;
        raisePriceE18 = raisePriceE18_;
        startTime = startTime_;
        cliff = cliff_;
        twapWindow = twapWindow_;
        totalAllocation = totalAllocation_;
    }

    function unlockNext() external {
        if (block.timestamp < uint256(startTime) + cliff) revert CliffNotReached();
        if (unlockedTranches >= _multipliersX100.length) revert MilestoneNotReached();
        uint256 twap = spotAmm.consult(twapWindow);
        uint256 required = raisePriceE18 * _multipliersX100[unlockedTranches] / 100;
        if (twap < required) revert MilestoneNotReached();
        uint256 tranche = unlockedTranches++;
        emit TrancheUnlocked(tranche, _multipliersX100[tranche], twap);
    }

    function release() external returns (uint256 amount) {
        uint256 unlockedBps;
        for (uint256 i; i < unlockedTranches; ++i) unlockedBps += _unlockBps[i];
        uint256 available = totalAllocation * unlockedBps / 10_000;
        if (available <= released) revert NothingToRelease();
        amount = available - released;
        released = available;
        token.safeTransfer(beneficiary, amount);
        emit TokensReleased(beneficiary, amount);
    }

    function setBeneficiary(address beneficiary_) external {
        if (msg.sender != treasury) revert OnlyTreasury();
        require(beneficiary_ != address(0), "zero beneficiary");
        beneficiary = beneficiary_;
        emit BeneficiaryChanged(beneficiary_);
    }

    function milestoneCount() external view returns (uint256) { return _multipliersX100.length; }
    function milestone(uint256 index) external view returns (uint16 multiplierX100, uint16 unlockBps) { return (_multipliersX100[index], _unlockBps[index]); }
}
