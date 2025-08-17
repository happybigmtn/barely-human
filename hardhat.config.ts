import { configVariable } from "hardhat/config";
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";
import * as dotenv from "dotenv";

dotenv.config();

export default {
  plugins: [hardhatToolboxViem],
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1,  // Minimum runs for smallest bytecode
      },
      viaIR: true,  // Enable for stack too deep issues
      metadata: {
        bytecodeHash: "none",  // Disable metadata hash for consistent bytecode
        useLiteralContent: true,  // Include source code in metadata
      },
      outputSelection: {
        "*": {
          "*": [
            "abi",
            "evm.bytecode",
            "evm.deployedBytecode", 
            "evm.methodIdentifiers",
            "metadata"
          ],
          "": [
            "ast"
          ]
        }
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
    baseSepolia: {
      type: "http",
      chainType: "op",
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 84532,
    },
    base: {
      type: "http",
      chainType: "op",
      url: "https://mainnet.base.org",
      accounts: [configVariable("BASE_MAINNET_PRIVATE_KEY")],
      chainId: 8453,
    },
    arbitrumSepolia: {
      type: "http",
      chainType: "generic",
      url: process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 421614,
    },
  },
  etherscan: {
    apiKey: {
      baseSepolia: process.env.BASESCAN_API_KEY || "NBBRKU4DMW8DI9WE28EDAFJWYI1B8UQUMV",
      base: process.env.BASESCAN_API_KEY || "NBBRKU4DMW8DI9WE28EDAFJWYI1B8UQUMV",
      arbitrumSepolia: process.env.ARBISCAN_API_KEY || "VRHE5MXG3N93VAW5M8M1I6VDRF15FZ94A8",
    },
    customChains: [
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org",
        },
      },
      {
        network: "arbitrumSepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io",
        },
      },
    ],
  },
  test: {
    solidity: {
      timeout: 40000,
    },
  },
};
