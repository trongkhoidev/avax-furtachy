// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC8004Reputation} from "../interfaces/IERC8004.sol";
import {ForecastRegistry} from "./ForecastRegistry.sol";

interface IScoredGovernor {
    function proposalOutcome(uint256 proposalId) external view returns (uint8);
}

contract ReputationReporter {
    string public constant TAG1 = "futara-forecast";
    IERC8004Reputation public immutable reputation;
    ForecastRegistry public immutable forecasts;
    mapping(address => mapping(uint256 => mapping(uint256 => bool))) public reported;

    error InvalidConfiguration();
    error ProposalNotFinalized();
    error ForecastNotRevealed();
    error AlreadyReported();
    error BatchTooLarge();
    error UnknownGovernor();

    event ForecastScored(address indexed governor, uint256 indexed proposalId, uint256 indexed agentId, uint16 pPassBps, uint8 outcome, uint256 score);

    constructor(IERC8004Reputation reputation_, ForecastRegistry forecasts_) {
        if (address(reputation_) == address(0) || address(forecasts_) == address(0)) revert InvalidConfiguration();
        reputation = reputation_;
        forecasts = forecasts_;
    }

    function report(address governor, uint256 proposalId, uint256 agentId) external returns (uint256 score) {
        return _report(governor, proposalId, agentId);
    }

    function reportBatch(address governor, uint256 proposalId, uint256[] calldata agentIds) external {
        if (agentIds.length > 50) revert BatchTooLarge();
        for (uint256 i; i < agentIds.length; ++i) _report(governor, proposalId, agentIds[i]);
    }

    function _report(address governor, uint256 proposalId, uint256 agentId) private returns (uint256 score) {
        if (!forecasts.isAuthorizedGovernor(governor)) revert UnknownGovernor();
        if (reported[governor][proposalId][agentId]) revert AlreadyReported();
        uint8 outcome = IScoredGovernor(governor).proposalOutcome(proposalId);
        if (outcome != 1 && outcome != 2) revert ProposalNotFinalized();
        ForecastRegistry.Forecast memory forecast = forecasts.getForecast(governor, proposalId, agentId);
        if (!forecast.revealed) revert ForecastNotRevealed();
        uint256 realized = outcome == 1 ? 10_000 : 0;
        uint256 difference = forecast.pPassBps > realized ? forecast.pPassBps - realized : realized - forecast.pPassBps;
        score = 10_000 - (difference * difference / 10_000);
        reported[governor][proposalId][agentId] = true;
        string memory tag2 = string.concat(_toString(block.chainid), ":", _toHexAddress(governor), ":", _toString(proposalId));
        reputation.giveFeedback(agentId, int128(int256(score)), 2, TAG1, tag2, "", "", bytes32(0));
        emit ForecastScored(governor, proposalId, agentId, forecast.pPassBps, outcome, score);
    }

    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) return "0";
        uint256 digits;
        uint256 temp = value;
        while (temp != 0) { ++digits; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) { buffer[--digits] = bytes1(uint8(48 + value % 10)); value /= 10; }
        return string(buffer);
    }

    function _toHexAddress(address account) private pure returns (string memory) {
        bytes16 symbols = "0123456789abcdef";
        bytes memory buffer = new bytes(42);
        buffer[0] = "0";
        buffer[1] = "x";
        for (uint256 i; i < 20; ++i) {
            uint8 value = uint8(uint160(account) >> (8 * (19 - i)));
            buffer[2 + i * 2] = symbols[value >> 4];
            buffer[3 + i * 2] = symbols[value & 0x0f];
        }
        return string(buffer);
    }
}
