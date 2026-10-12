// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";

contract ProjectToken is Initializable, ERC20Upgradeable, ERC20PermitUpgradeable {
    error InvalidMintRecipient();

    constructor() { _disableInitializers(); }

    function initialize(string calldata name_, string calldata symbol_, uint256 supply_, address mintTo) external initializer {
        if (mintTo == address(0)) revert InvalidMintRecipient();
        __ERC20_init(name_, symbol_);
        __ERC20Permit_init(name_);
        _mint(mintTo, supply_);
    }
}
