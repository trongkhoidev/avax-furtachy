// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

contract ConditionalToken is Initializable, ERC20Upgradeable {
    error OnlyVault();

    address public vault;
    uint8 private _tokenDecimals;

    constructor() { _disableInitializers(); }

    function initialize(string calldata name_, string calldata symbol_, uint8 decimals_, address vault_) external initializer {
        require(vault_ != address(0), "zero vault");
        __ERC20_init(name_, symbol_);
        vault = vault_;
        _tokenDecimals = decimals_;
    }

    function decimals() public view override returns (uint8) { return _tokenDecimals; }

    function mint(address to, uint256 amount) external {
        if (msg.sender != vault) revert OnlyVault();
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        if (msg.sender != vault) revert OnlyVault();
        _burn(from, amount);
    }
}
