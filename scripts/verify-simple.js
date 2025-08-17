import fetch from 'node-fetch';

// Configuration
const API_KEY = 'NBBRKU4DMW8DI9WE28EDAFJWYI1B8UQUMV';
const BASE_URL = 'https://api-sepolia.basescan.org/api';

// Simple contracts that can be verified without flattening
const simpleContracts = [
  {
    name: 'CrapsSettlementSimple',
    address: '0xe156b261025e74a19b298c9d94260c744ae85d7f',
    sourceCode: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title CrapsSettlementSimple
 * @notice Simplified settlement contract for craps game
 * @dev Minimal implementation to fit within size constraints
 */
contract CrapsSettlementSimple is AccessControl {
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    
    // Game state
    uint8 public lastDie1;
    uint8 public lastDie2;
    uint8 public lastTotal;
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @notice Settle a dice roll (simplified implementation)
     * @param die1 First die value
     * @param die2 Second die value
     * @return payouts Always returns 0 (minimal implementation)
     */
    function settleRoll(uint8 die1, uint8 die2) 
        external 
        onlyRole(GAME_ROLE) 
        returns (uint256) 
    {
        require(die1 >= 1 && die1 <= 6, "Invalid die1");
        require(die2 >= 1 && die2 <= 6, "Invalid die2");
        
        lastDie1 = die1;
        lastDie2 = die2;
        lastTotal = die1 + die2;
        
        return 0; // Minimal implementation
    }
    
    /**
     * @notice Get last roll results
     */
    function getLastRoll() external view returns (uint8, uint8, uint8) {
        return (lastDie1, lastDie2, lastTotal);
    }
}`,
    contractName: 'CrapsSettlementSimple',
    constructorArgs: '',
  }
];

// Contracts with standard source that need manual verification
const complexContracts = [
  {
    name: 'BOTToken',
    address: '0xedbce0a53a24f9e5f4684937ed3ee64e936cd048',
    contractName: 'BOTToken',
    info: 'Use manual verification - complex with multiple imports',
  },
  {
    name: 'Treasury',
    address: '0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a',
    contractName: 'Treasury', 
    info: 'Use manual verification - complex with multiple imports',
  },
  {
    name: 'CrapsBets',
    address: '0x7283196cb2aa54ebca3ec2198eb5a86215e627cb',
    contractName: 'CrapsBets',
    info: 'Use manual verification - complex with multiple imports',
  },
  {
    name: 'CrapsGame',
    address: '0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a',
    contractName: 'CrapsGame',
    info: 'Use manual verification - complex with multiple imports',
  },
];

async function verifyContract(contract) {
  console.log(`\n📝 Verifying ${contract.name}...`);
  
  try {
    const params = new URLSearchParams({
      module: 'contract',
      action: 'verifysourcecode',
      apikey: API_KEY,
    });

    const data = new URLSearchParams({
      codeformat: 'solidity-single-file',
      sourceCode: contract.sourceCode,
      contractaddress: contract.address,
      contractname: contract.contractName,
      compilerversion: 'v0.8.28+commit.7893614a',
      optimizationUsed: '1',
      runs: '1',
      evmversion: 'paris',
      licenseType: '3',
      constructorArguements: contract.constructorArgs,
    });

    const response = await fetch(`${BASE_URL}?${params}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: data,
    });

    const result = await response.json();
    
    if (result.status === '1') {
      console.log(`✅ ${contract.name} verification submitted successfully!`);
      console.log(`   GUID: ${result.result}`);
      return { success: true, guid: result.result };
    } else {
      console.log(`❌ ${contract.name} verification failed:`, result.result);
      return { success: false, error: result.result };
    }
  } catch (error) {
    console.error(`❌ Error verifying ${contract.name}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function checkVerificationStatus(contractName, guid) {
  const params = new URLSearchParams({
    module: 'contract',
    action: 'checkverifystatus',
    guid: guid,
    apikey: API_KEY,
  });

  try {
    const response = await fetch(`${BASE_URL}?${params}`);
    const result = await response.json();
    
    if (result.status === '1') {
      console.log(`✅ ${contractName} verification completed!`);
    } else {
      console.log(`ℹ️ ${contractName} status:`, result.result);
    }
  } catch (error) {
    console.error(`Error checking ${contractName}:`, error.message);
  }
}

async function main() {
  console.log('🚀 Starting simplified contract verification...\n');
  
  // Verify simple contracts
  console.log('📝 Verifying simple contracts...');
  for (const contract of simpleContracts) {
    const result = await verifyContract(contract);
    if (result.success) {
      setTimeout(() => checkVerificationStatus(contract.name, result.guid), 10000);
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  // Show manual verification instructions for complex contracts
  console.log('\n📋 Manual verification required for complex contracts:\n');
  for (const contract of complexContracts) {
    console.log(`${contract.name}: ${contract.address}`);
    console.log(`  📍 Verify at: https://sepolia.basescan.org/verifyContract?a=${contract.address}`);
    console.log(`  ℹ️ ${contract.info}\n`);
  }
  
  console.log('📚 Manual Verification Steps:');
  console.log('1. Go to BaseScan verification URL');
  console.log('2. Select "Via Standard JSON Input"');
  console.log('3. Upload the contract\'s JSON artifact from artifacts/contracts/...');
  console.log('4. Add constructor arguments if needed');
  console.log('5. Submit for verification\n');
  
  console.log('🔗 Useful links:');
  console.log('- Verification Guide: ./deployment/VERIFICATION_GUIDE.md');
  console.log('- Deployment Report: ./deployment/DEPLOYMENT_STATUS_REPORT.md');
}

main().catch(console.error);