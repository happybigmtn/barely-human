/**
 * Custom chain configurations for Barely Human DeFi Casino
 * Fixes viem chain ID issues with local Hardhat network
 */

// Custom hardhat chain definition with correct chainId
export const hardhatChain = {
    id: 31337,
    name: 'Hardhat Local',
    nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18,
    },
    rpcUrls: {
        default: {
            http: ['http://127.0.0.1:8545'],
        },
        public: {
            http: ['http://127.0.0.1:8545'],
        },
    },
    blockExplorers: {
        default: {
            name: 'Hardhat Explorer',
            url: 'http://127.0.0.1:8545',
        },
    },
    testnet: true,
};

// Error handling utilities for contract calls
export const contractCallWithRetry = async (fn, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            console.warn(`Contract call attempt ${i + 1} failed:`, error.message);
            
            if (i === retries - 1) {
                throw new Error(`Contract call failed after ${retries} attempts: ${error.message}`);
            }
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

// Enhanced error logging for contract interactions
export const logContractError = (contractName, method, error) => {
    console.error(`❌ ${contractName}.${method} failed:`);
    console.error(`   Error: ${error.message}`);
    
    // Specific error handling for common issues
    if (error.message.includes('CALL_EXCEPTION')) {
        console.error('   💡 Tip: Check if the contract is deployed and the method signature is correct');
    } else if (error.message.includes('insufficient funds')) {
        console.error('   💡 Tip: Check account balance and gas limits');
    } else if (error.message.includes('nonce too low')) {
        console.error('   💡 Tip: Reset account nonce or wait for pending transactions');
    }
};

// Validation utilities
export const validateDeployment = (deployments) => {
    const requiredContracts = [
        'BOTToken',
        'CrapsGame', 
        'BotManager',
        'Treasury',
        'StakingPool'
    ];
    
    // Check for either VaultFactory or VaultFactoryOptimized
    const hasVaultFactory = deployments.contracts['VaultFactory'] || deployments.contracts['VaultFactoryOptimized'];
    if (!hasVaultFactory) {
        requiredContracts.push('VaultFactory or VaultFactoryOptimized');
    }
    
    const missing = requiredContracts.filter(contract => 
        !contract.includes('VaultFactory') && !deployments.contracts[contract]
    );
    
    if (missing.length > 0) {
        throw new Error(`Missing deployed contracts: ${missing.join(', ')}`);
    }
    
    // Validate chain ID
    if (deployments.chainId !== 31337) {
        console.warn(`⚠️  Warning: Expected chainId 31337, got ${deployments.chainId}`);
    }
    
    // Warn about VaultFactory vs VaultFactoryOptimized
    if (deployments.contracts['VaultFactory'] && !deployments.contracts['VaultFactoryOptimized']) {
        console.warn(`⚠️  Warning: Using VaultFactory instead of VaultFactoryOptimized (may exceed size limits)`);
    }
    
    return true;
};