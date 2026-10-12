// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {ConditionalToken} from "./ConditionalToken.sol";
import {FutaraTypes} from "../libraries/FutaraTypes.sol";

contract ConditionalVault is Initializable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error OnlyGovernor();
    error AlreadyResolved();
    error NotResolved();
    error NoWinningBalance();

    IERC20 public underlying;
    ConditionalToken public passToken;
    ConditionalToken public failToken;
    address public governor;
    uint256 public proposalId;
    FutaraTypes.Outcome public outcome;

    event Split(address indexed user, uint256 amount);
    event Merged(address indexed user, uint256 amount);
    event Resolved(FutaraTypes.Outcome outcome);
    event Redeemed(address indexed user, uint256 amount);

    constructor() { _disableInitializers(); }

    function initialize(IERC20 underlying_, address governor_, uint256 proposalId_, address conditionalTokenImpl, string calldata symbolPrefix) external initializer {
        require(address(underlying_) != address(0) && governor_ != address(0), "invalid address");
        underlying = underlying_;
        governor = governor_;
        proposalId = proposalId_;
        uint8 decimals_ = IERC20Metadata(address(underlying_)).decimals();
        address pass = Clones.clone(conditionalTokenImpl);
        address fail = Clones.clone(conditionalTokenImpl);
        ConditionalToken(pass).initialize(string.concat("PASS-", symbolPrefix), string.concat("p", symbolPrefix), decimals_, address(this));
        ConditionalToken(fail).initialize(string.concat("FAIL-", symbolPrefix), string.concat("f", symbolPrefix), decimals_, address(this));
        passToken = ConditionalToken(pass);
        failToken = ConditionalToken(fail);
    }

    function split(uint256 amount, address to) external nonReentrant {
        if (outcome != FutaraTypes.Outcome.Unresolved) revert AlreadyResolved();
        underlying.safeTransferFrom(msg.sender, address(this), amount);
        passToken.mint(to, amount);
        failToken.mint(to, amount);
        emit Split(to, amount);
    }

    function merge(uint256 amount, address to) external nonReentrant {
        if (outcome != FutaraTypes.Outcome.Unresolved) revert AlreadyResolved();
        passToken.burn(msg.sender, amount);
        failToken.burn(msg.sender, amount);
        underlying.safeTransfer(to, amount);
        emit Merged(msg.sender, amount);
    }

    function resolve(FutaraTypes.Outcome outcome_) external {
        if (msg.sender != governor) revert OnlyGovernor();
        if (outcome != FutaraTypes.Outcome.Unresolved || outcome_ == FutaraTypes.Outcome.Unresolved) revert AlreadyResolved();
        outcome = outcome_;
        emit Resolved(outcome_);
    }

    function redeem(address to) external nonReentrant returns (uint256 amount) {
        return _redeem(msg.sender, to);
    }

    function redeemToSelf() external nonReentrant returns (uint256 amount) {
        return _redeem(msg.sender, msg.sender);
    }

    function _redeem(address user, address to) private returns (uint256 amount) {
        if (outcome == FutaraTypes.Outcome.Unresolved) revert NotResolved();
        ConditionalToken winning = outcome == FutaraTypes.Outcome.Pass ? passToken : failToken;
        amount = winning.balanceOf(user);
        if (amount == 0) revert NoWinningBalance();
        winning.burn(user, amount);
        underlying.safeTransfer(to, amount);
        emit Redeemed(user, amount);
    }
}
