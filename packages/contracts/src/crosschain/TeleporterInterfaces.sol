// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

struct TeleporterFeeInfo { address feeTokenAddress; uint256 amount; }

struct TeleporterMessageInput {
    bytes32 destinationBlockchainID;
    address destinationAddress;
    TeleporterFeeInfo feeInfo;
    uint256 requiredGasLimit;
    address[] allowedRelayerAddresses;
    bytes message;
}

interface ITeleporterMessenger {
    function sendCrossChainMessage(TeleporterMessageInput calldata messageInput) external returns (bytes32 messageID);
}

interface ITeleporterReceiver {
    function receiveTeleporterMessage(bytes32 sourceBlockchainID, address originSenderAddress, bytes calldata message) external;
}
