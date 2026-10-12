// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {FutaraFactory} from "../src/core/FutaraFactory.sol";
import {FutaraRouter} from "../src/core/FutaraRouter.sol";
import {ForecastRegistry, IForecastFactory} from "../src/agents/ForecastRegistry.sol";
import {ReputationReporter} from "../src/agents/ReputationReporter.sol";
import {IERC8004Identity, IERC8004Reputation} from "../src/interfaces/IERC8004.sol";

interface Vm {
    function envUint(string calldata key) external view returns (uint256);
    function envAddress(string calldata key) external view returns (address);
    function envOr(string calldata key, address defaultValue) external view returns (address);
    function envOr(string calldata key, uint64 defaultValue) external view returns (uint64);
    function deployCode(string calldata artifactPath) external returns (address);
    function deployCode(string calldata artifactPath, bytes calldata args) external returns (address);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
    function createDir(string calldata path, bool recursive) external;
    function writeFile(string calldata path, string calldata data) external;
}

contract Deploy {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external {
        require(block.chainid == 43_113, "Fuji only");
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address usdc = vm.envAddress("USDC_ADDRESS");
        require(usdc != address(0) && usdc.code.length > 0, "USDC must be a deployed Fuji token");
        address identity = vm.envOr("ERC8004_IDENTITY_REGISTRY", address(0));
        address reputation = vm.envOr("ERC8004_REPUTATION_REGISTRY", address(0));
        require(reputation == address(0) || identity != address(0), "Identity registry required for reputation reporter");
        uint64 revealWindow = vm.envOr("FORECAST_REVEAL_WINDOW", uint64(86_400));
        vm.startBroadcast(deployerKey);

        address tokenImpl = vm.deployCode("src/core/ProjectToken.sol:ProjectToken");
        address raiseImpl = vm.deployCode("src/core/Raise.sol:Raise");
        address treasuryImpl = vm.deployCode("src/core/Treasury.sol:Treasury");
        address governorImpl = vm.deployCode("src/core/FutarchyGovernor.sol:FutarchyGovernor");
        address ammImpl = vm.deployCode("src/market/DecisionAMM.sol:DecisionAMM");
        address vaultImpl = vm.deployCode("src/market/ConditionalVault.sol:ConditionalVault");
        address conditionalTokenImpl = vm.deployCode("src/market/ConditionalToken.sol:ConditionalToken");
        address performanceImpl = vm.deployCode("src/core/PerformancePackage.sol:PerformancePackage");
        FutaraFactory factory = FutaraFactory(vm.deployCode(
            "src/core/FutaraFactory.sol:FutaraFactory",
            abi.encode(IERC20(usdc), raiseImpl, tokenImpl, treasuryImpl, governorImpl, ammImpl, vaultImpl, conditionalTokenImpl, performanceImpl)
        ));
        address forecastRegistry;
        address reputationReporter;
        if (identity != address(0)) {
            require(identity.code.length > 0, "Identity registry has no code on Fuji");
            ForecastRegistry forecasts = ForecastRegistry(vm.deployCode(
                "src/agents/ForecastRegistry.sol:ForecastRegistry", abi.encode(IERC8004Identity(identity), revealWindow, IForecastFactory(address(factory)))
            ));
            forecastRegistry = address(forecasts);
            if (reputation != address(0)) {
                require(reputation.code.length > 0, "Reputation registry has no code on Fuji");
                ReputationReporter reporter = ReputationReporter(vm.deployCode(
                    "src/agents/ReputationReporter.sol:ReputationReporter", abi.encode(IERC8004Reputation(reputation), forecasts)
                ));
                reputationReporter = address(reporter);
            }
        }
        FutaraRouter router = FutaraRouter(vm.deployCode("src/core/FutaraRouter.sol:FutaraRouter", abi.encode(factory)));

        if (forecastRegistry != address(0)) factory.setForecastRegistry(forecastRegistry);

        vm.stopBroadcast();
        vm.createDir("deployments", true);
        vm.writeFile("deployments/fuji.json", string.concat(
            "{\n  \"chainId\": 43113,\n  \"usdc\": \"", _hex(usdc), "\",\n",
            "  \"factory\": \"", _hex(address(factory)), "\",\n",
            "  \"router\": \"", _hex(address(router)), "\",\n",
            "  \"forecastRegistry\": ", _jsonAddress(forecastRegistry), ",\n",
            "  \"reputationReporter\": ", _jsonAddress(reputationReporter), ",\n",
            "  \"erc8004IdentityRegistry\": ", _jsonAddress(identity), ",\n",
            "  \"erc8004ReputationRegistry\": ", _jsonAddress(reputation), ",\n",
            "  \"implementations\": {\n",
            "    \"projectToken\": \"", _hex(tokenImpl), "\",\n",
            "    \"raise\": \"", _hex(raiseImpl), "\",\n",
            "    \"treasury\": \"", _hex(treasuryImpl), "\",\n",
            "    \"governor\": \"", _hex(governorImpl), "\",\n",
            "    \"amm\": \"", _hex(ammImpl), "\",\n",
            "    \"conditionalVault\": \"", _hex(vaultImpl), "\",\n",
            "    \"conditionalToken\": \"", _hex(conditionalTokenImpl), "\",\n",
            "    \"performancePackage\": \"", _hex(performanceImpl), "\"\n  }\n}\n"
        ));
    }

    function _hex(address account) private pure returns (string memory) {
        bytes16 symbols = "0123456789abcdef";
        bytes memory buffer = new bytes(42);
        buffer[0] = "0"; buffer[1] = "x";
        for (uint256 i; i < 20; ++i) {
            uint8 value = uint8(uint160(account) >> (8 * (19 - i)));
            buffer[2 + i * 2] = symbols[value >> 4];
            buffer[3 + i * 2] = symbols[value & 0x0f];
        }
        return string(buffer);
    }

    function _jsonAddress(address account) private pure returns (string memory) {
        return account == address(0) ? "null" : string.concat("\"", _hex(account), "\"");
    }
}
