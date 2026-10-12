// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {FutaraTypes} from "../libraries/FutaraTypes.sol";

interface IFutaraFactory {
    struct ProjectInfo {
        address founder;
        address raise;
        address token;
        address treasury;
        address governor;
        address spotAmm;
        address performancePackage;
        string metadataURI;
        bytes32 metadataHash;
        FutaraTypes.TokenConfig tokenCfg;
        FutaraTypes.RaiseConfig raiseCfg;
        FutaraTypes.FutarchyParams params;
        FutaraTypes.BudgetConfig budget;
        FutaraTypes.FounderConfig founderCfg;
    }

    function deployLive(uint256 projectId, uint256 raisePriceE18) external returns (FutaraTypes.LiveAddrs memory live);
    function registerProposalMarkets(uint256 projectId, uint256 proposalId, address vaultUsdc, address vaultToken, address passAmm, address failAmm) external;
    function getProject(uint256 projectId) external view returns (ProjectInfo memory);
    function usdc() external view returns (IERC20);
    function forecastRegistry() external view returns (address);
    function projectIdOf(address contractAddress) external view returns (uint256);
}
