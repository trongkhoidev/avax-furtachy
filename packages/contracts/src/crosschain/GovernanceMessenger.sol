// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FutaraTypes} from "../libraries/FutaraTypes.sol";
import {ITeleporterMessenger, TeleporterFeeInfo, TeleporterMessageInput} from "./TeleporterInterfaces.sol";

contract GovernanceMessenger {
    ITeleporterMessenger public immutable teleporter;
    address public immutable treasury;
    mapping(bytes32 => address) public executorOf;
    uint256 public nonce;

    error OnlyTreasury();
    error UnknownL1();
    error InvalidConfiguration();

    event L1ExecutorSet(bytes32 indexed blockchainID, address executor);
    event GovernanceSent(bytes32 indexed blockchainID, bytes32 indexed messageID, uint256 nonce, uint256 proposalId);

    constructor(ITeleporterMessenger teleporter_, address treasury_) {
        if (address(teleporter_) == address(0) || treasury_ == address(0)) revert InvalidConfiguration();
        teleporter = teleporter_;
        treasury = treasury_;
    }

    modifier onlyTreasury() { if (msg.sender != treasury) revert OnlyTreasury(); _; }

    function setExecutor(bytes32 blockchainID, address executor) external onlyTreasury {
        if (blockchainID == bytes32(0) || executor == address(0)) revert InvalidConfiguration();
        executorOf[blockchainID] = executor;
        emit L1ExecutorSet(blockchainID, executor);
    }

    function sendToL1(bytes32 blockchainID, uint256 proposalId, FutaraTypes.Action[] calldata actions, uint256 requiredGasLimit) external onlyTreasury returns (bytes32 messageID) {
        address executor = executorOf[blockchainID];
        if (executor == address(0) || actions.length == 0 || requiredGasLimit == 0) revert UnknownL1();
        uint256 nextNonce = nonce + 1;
        address[] memory allowedRelayers = new address[](0);
        bytes memory payload = abi.encode(nextNonce, proposalId, actions);
        messageID = teleporter.sendCrossChainMessage(TeleporterMessageInput({
            destinationBlockchainID: blockchainID,
            destinationAddress: executor,
            feeInfo: TeleporterFeeInfo({feeTokenAddress: address(0), amount: 0}),
            requiredGasLimit: requiredGasLimit,
            allowedRelayerAddresses: allowedRelayers,
            message: payload
        }));
        nonce = nextNonce;
        emit GovernanceSent(blockchainID, messageID, nextNonce, proposalId);
    }
}
