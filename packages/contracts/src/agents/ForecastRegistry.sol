// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC8004Identity} from "../interfaces/IERC8004.sol";

interface IForecastGovernor {
    function forecastWindow(uint256 proposalId) external view returns (uint8 proposalState, uint64 createdAt, uint64 tradingStart, uint64 tradingEnd);
}

interface IForecastFactory { function projectIdOf(address contractAddress) external view returns (uint256); }

contract ForecastRegistry {
    uint64 public immutable revealWindow;
    IERC8004Identity public immutable identity;
    IForecastFactory public immutable factory;

    struct Forecast {
        bytes32 commitHash;
        uint64 committedAt;
        uint16 pPassBps;
        bool revealed;
    }

    mapping(address => mapping(uint256 => mapping(uint256 => Forecast))) public forecasts;
    mapping(address => mapping(uint256 => uint256[])) private _forecasters;

    error InvalidConfiguration();
    error NotAgentController();
    error ProposalNotTrading();
    error TradingNotEnded();
    error RevealWindowClosed();
    error InvalidForecast();
    error ForecastAlreadyRevealed();
    error UnknownGovernor();

    event ForecastCommitted(address indexed governor, uint256 indexed proposalId, uint256 indexed agentId, bytes32 hash);
    event ForecastRevealed(address indexed governor, uint256 indexed proposalId, uint256 indexed agentId, uint16 pPassBps);

    constructor(IERC8004Identity identity_, uint64 revealWindow_, IForecastFactory factory_) {
        if (address(identity_) == address(0) || address(factory_) == address(0) || revealWindow_ == 0) revert InvalidConfiguration();
        identity = identity_;
        revealWindow = revealWindow_;
        factory = factory_;
    }

    function commit(address governor, uint256 proposalId, uint256 agentId, bytes32 hash) external {
        if (governor == address(0) || hash == bytes32(0)) revert InvalidForecast();
        _requireGovernor(governor);
        _requireAgentController(agentId);
        (, , , uint64 tradingEnd) = IForecastGovernor(governor).forecastWindow(proposalId);
        (uint8 state,,,) = IForecastGovernor(governor).forecastWindow(proposalId);
        if (state != 2 || block.timestamp >= tradingEnd) revert ProposalNotTrading();
        Forecast storage forecast = forecasts[governor][proposalId][agentId];
        if (forecast.commitHash == bytes32(0)) _forecasters[governor][proposalId].push(agentId);
        if (forecast.revealed) revert ForecastAlreadyRevealed();
        forecast.commitHash = hash;
        forecast.committedAt = uint64(block.timestamp);
        emit ForecastCommitted(governor, proposalId, agentId, hash);
    }

    function reveal(address governor, uint256 proposalId, uint256 agentId, uint16 pPassBps, bytes32 salt) external {
        if (pPassBps > 10_000) revert InvalidForecast();
        _requireGovernor(governor);
        Forecast storage forecast = forecasts[governor][proposalId][agentId];
        if (forecast.commitHash == bytes32(0) || forecast.revealed) revert InvalidForecast();
        (, , , uint64 tradingEnd) = IForecastGovernor(governor).forecastWindow(proposalId);
        if (block.timestamp < tradingEnd) revert TradingNotEnded();
        if (block.timestamp > uint256(tradingEnd) + revealWindow) revert RevealWindowClosed();
        if (keccak256(abi.encode(governor, proposalId, agentId, pPassBps, salt)) != forecast.commitHash) revert InvalidForecast();
        forecast.pPassBps = pPassBps;
        forecast.revealed = true;
        emit ForecastRevealed(governor, proposalId, agentId, pPassBps);
    }

    function getForecast(address governor, uint256 proposalId, uint256 agentId) external view returns (Forecast memory) {
        return forecasts[governor][proposalId][agentId];
    }

    function forecastersOf(address governor, uint256 proposalId) external view returns (uint256[] memory) {
        return _forecasters[governor][proposalId];
    }

    function isAuthorizedGovernor(address governor) external view returns (bool) {
        return factory.projectIdOf(governor) != 0;
    }

    function _requireGovernor(address governor) private view {
        if (factory.projectIdOf(governor) == 0) revert UnknownGovernor();
    }

    function _requireAgentController(uint256 agentId) private view {
        try identity.ownerOf(agentId) returns (address owner) {
            if (msg.sender == owner) return;
        } catch {}
        try identity.getAgentWallet(agentId) returns (address wallet) {
            if (wallet != address(0) && msg.sender == wallet) return;
        } catch {}
        revert NotAgentController();
    }
}
