/**
 * Centralized Environment Configuration Management
 * Consolidates all environment variables and network-specific settings
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from project root
dotenv.config({ path: join(__dirname, '../../../.env') });

/**
 * Network configurations with complete environment settings
 */
export const NETWORKS = {
  local: {
    name: 'Local Hardhat',
    chainId: 31337,
    rpcUrl: process.env.LOCAL_RPC_URL || 'http://127.0.0.1:8545',
    deploymentFile: 'localhost.json',
    privateKey: process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    blockExplorer: null,
    gasSettings: {
      gasPrice: 'auto',
      gasLimit: 8000000
    }
  },
  
  baseSepolia: {
    name: 'Base Sepolia',
    chainId: 84532,
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    deploymentFile: 'base-sepolia-deployment.json',
    privateKey: process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    blockExplorer: 'https://sepolia.basescan.org',
    gasSettings: {
      gasPrice: 'auto',
      gasLimit: 2000000
    },
    vrfConfig: {
      coordinatorAddress: process.env.VRF_COORDINATOR_ADDRESS || '0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634',
      keyHash: process.env.VRF_KEY_HASH || '0x83250c5584ffa93feb6ee082981c5ebe484c865196750b39835ad4f13780435d',
      subscriptionId: process.env.VRF_SUBSCRIPTION_ID || '1'
    }
  }
};

/**
 * CLI Configuration Constants
 */
export const CLI_CONFIG = {
  MAX_BET_AMOUNT: process.env.MAX_BET_AMOUNT || "1000",
  MIN_BET_AMOUNT: process.env.MIN_BET_AMOUNT || "1",
  DEFAULT_FUNDING_AMOUNT: process.env.DEFAULT_FUNDING_AMOUNT || "10000",
  VAULT_DEPOSIT_AMOUNT: process.env.VAULT_DEPOSIT_AMOUNT || "1000",
  
  // Caching settings
  CACHE_TTL: parseInt(process.env.CACHE_TTL) || 300000, // 5 minutes
  ENABLE_CACHING: process.env.ENABLE_CACHING !== 'false',
  
  // Performance settings
  MAX_CONCURRENT_REQUESTS: parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 10,
  REQUEST_TIMEOUT: parseInt(process.env.REQUEST_TIMEOUT) || 30000,
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  ENABLE_GAS_REPORTING: process.env.ENABLE_GAS_REPORTING !== 'false'
};

/**
 * Contract-specific configurations
 */
export const CONTRACT_CONFIG = {
  BOTToken: {
    initialSupply: process.env.BOT_INITIAL_SUPPLY || "1000000000000000000000000000", // 1B with 18 decimals
    allocations: {
      treasury: 20,
      liquidity: 30,
      staking: 25,
      team: 15,
      community: 10
    }
  },
  
  CrapsGame: {
    minBetAmount: process.env.MIN_BET_AMOUNT || "1000000000000000000", // 1 BOT
    maxBetAmount: process.env.MAX_BET_AMOUNT || "10000000000000000000000", // 10K BOT
    rollCooldown: parseInt(process.env.ROLL_COOLDOWN) || 10,
    autoRollEnabled: process.env.AUTO_ROLL_ENABLED !== 'false'
  },
  
  BotManager: {
    maxBots: parseInt(process.env.MAX_BOTS) || 10,
    sessionTimeout: parseInt(process.env.BOT_SESSION_TIMEOUT) || 3600,
    maxBetPercentage: parseInt(process.env.MAX_BET_PERCENTAGE) || 1000, // 10%
    minBetPercentage: parseInt(process.env.MIN_BET_PERCENTAGE) || 10 // 0.1%
  }
};

/**
 * Deployment configurations for different environments
 */
export const DEPLOYMENT_CONFIG = {
  development: {
    verifyContracts: false,
    saveGasReport: true,
    enableDebug: true
  },
  
  staging: {
    verifyContracts: true,
    saveGasReport: true,
    enableDebug: false
  },
  
  production: {
    verifyContracts: true,
    saveGasReport: false,
    enableDebug: false
  }
};

/**
 * Get network configuration by name
 */
export function getNetworkConfig(networkName = 'local') {
  const config = NETWORKS[networkName];
  if (!config) {
    throw new Error(`Unknown network: ${networkName}. Available: ${Object.keys(NETWORKS).join(', ')}`);
  }
  return config;
}

/**
 * Get all environment variables for debugging
 */
export function getEnvironmentInfo() {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    availableNetworks: Object.keys(NETWORKS),
    cacheEnabled: CLI_CONFIG.ENABLE_CACHING,
    gasReportingEnabled: CLI_CONFIG.ENABLE_GAS_REPORTING,
    logLevel: CLI_CONFIG.LOG_LEVEL
  };
}

/**
 * Validate environment configuration
 */
export function validateEnvironment(networkName = 'local') {
  const config = getNetworkConfig(networkName);
  const issues = [];
  
  // Check required environment variables
  if (!config.rpcUrl) {
    issues.push(`Missing RPC URL for network: ${networkName}`);
  }
  
  if (!config.privateKey || config.privateKey === '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') {
    if (networkName !== 'local') {
      issues.push(`Using default private key for ${networkName}. Set DEPLOYER_PRIVATE_KEY for production networks.`);
    }
  }
  
  if (networkName === 'baseSepolia' && !config.vrfConfig.subscriptionId) {
    issues.push('Missing VRF_SUBSCRIPTION_ID for Base Sepolia network');
  }
  
  return {
    valid: issues.length === 0,
    issues,
    config
  };
}

export default {
  NETWORKS,
  CLI_CONFIG,
  CONTRACT_CONFIG,
  DEPLOYMENT_CONFIG,
  getNetworkConfig,
  getEnvironmentInfo,
  validateEnvironment
};