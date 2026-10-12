// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract GameConfig is Ownable {
    uint256 public rewardPerMatch;
    uint16 public marketplaceFeeBps;

    event ConfigChanged(string key, uint256 value);

    constructor(address executor) Ownable(executor) {}

    function setRewardPerMatch(uint256 value) external onlyOwner {
        rewardPerMatch = value;
        emit ConfigChanged("rewardPerMatch", value);
    }

    function setMarketplaceFeeBps(uint16 value) external onlyOwner {
        require(value <= 2_000, "fee too high");
        marketplaceFeeBps = value;
        emit ConfigChanged("marketplaceFeeBps", value);
    }
}
