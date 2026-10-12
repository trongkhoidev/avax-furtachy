// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ITeleporterReceiver} from "./TeleporterInterfaces.sol";
import {FutaraTypes} from "../libraries/FutaraTypes.sol";

contract L1GovernanceExecutor is ITeleporterReceiver {
    address public immutable teleporter;
    bytes32 public immutable hubBlockchainID;
    address public immutable hubMessenger;
    uint256 public lastNonce;

    error OnlyTeleporter();
    error WrongSource();
    error WrongSender();
    error OutOfOrder();
    error InvalidMessage();
    error ActionFailed(uint256 index, bytes reason);

    event Executed(uint256 indexed nonce, uint256 indexed proposalId, uint256 actionCount);

    constructor(address teleporter_, bytes32 hubBlockchainID_, address hubMessenger_) {
        require(teleporter_ != address(0) && hubBlockchainID_ != bytes32(0) && hubMessenger_ != address(0), "invalid executor config");
        teleporter = teleporter_;
        hubBlockchainID = hubBlockchainID_;
        hubMessenger = hubMessenger_;
    }

    function receiveTeleporterMessage(bytes32 sourceBlockchainID, address originSenderAddress, bytes calldata message) external {
        if (msg.sender != teleporter) revert OnlyTeleporter();
        if (sourceBlockchainID != hubBlockchainID) revert WrongSource();
        if (originSenderAddress != hubMessenger) revert WrongSender();
        (uint256 n, uint256 proposalId, FutaraTypes.Action[] memory actions) = abi.decode(message, (uint256, uint256, FutaraTypes.Action[]));
        if (n != lastNonce + 1 || actions.length == 0) revert OutOfOrder();
        lastNonce = n;
        for (uint256 i; i < actions.length; ++i) {
            (bool ok, bytes memory result) = actions[i].target.call{value: actions[i].value}(actions[i].data);
            if (!ok) revert ActionFailed(i, result);
        }
        emit Executed(n, proposalId, actions.length);
    }
}
