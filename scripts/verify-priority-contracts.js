// Verify priority contracts using BaseScan API
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const API_KEY = 'NBBRKU4DMW8DI9WE28EDAFJWYI1B8UQUMV';
const BASE_URL = 'https://api-sepolia.basescan.org/api';

// Priority contracts for verification
const contracts = [
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

async function checkVerificationStatus(address) {
  try {
    const response = await fetch(`${BASE_URL}?module=contract&action=getabi&address=${address}&apikey=${API_KEY}`);
    const result = await response.json();
    return result.status === '1';
  } catch (error) {
    return false;
  }
}

async function verifyContract(contract) {
  console.log(`\n📝 Verifying ${contract.name}...`);
  
  // Check if already verified
  const isVerified = await checkVerificationStatus(contract.address);
  if (isVerified) {
    console.log(`   ✅ ${contract.name} already verified!`);
    return { success: true, alreadyVerified: true };
  }

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
      console.log(`   ✅ ${contract.name} verification submitted!`);
      console.log(`   📝 GUID: ${result.result}`);
      return { success: true, guid: result.result };
    } else {
      console.log(`   ❌ ${contract.name} verification failed:`, result.result);
      return { success: false, error: result.result };
    }
  } catch (error) {
    console.error(`   ❌ Error verifying ${contract.name}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function checkVerificationResult(contractName, guid) {
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
      console.log(`   ✅ ${contractName} verification completed successfully!`);
    } else if (result.result === 'Pending in queue') {
      console.log(`   ⏳ ${contractName} verification pending...`);
    } else {
      console.log(`   ℹ️ ${contractName} status: ${result.result}`);
    }
  } catch (error) {
    console.error(`   ❌ Error checking ${contractName} status:`, error.message);
  }
}

async function main() {
  console.log('🔍 Priority Contract Verification\n');
  console.log('📍 Network: Base Sepolia');
  console.log(`🔑 API Key: ${API_KEY.substring(0, 6)}...${API_KEY.substring(API_KEY.length - 4)}\n`);

  // Verify contracts
  for (const contract of contracts) {
    const result = await verifyContract(contract);
    
    if (result.success && result.guid) {
      // Check status after delay
      setTimeout(() => checkVerificationResult(contract.name, result.guid), 10000);
    }
    
    // Wait between submissions
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  console.log('\n📋 Manual Verification Guide for Complex Contracts:');
  console.log('=========================================================\n');
  
  const manualContracts = [
    {
      name: 'BOT Token',
      address: '0xedbce0a53a24f9e5f4684937ed3ee64e936cd048',
      method: 'JSON Artifact Upload'
    },
    {
      name: 'Treasury',
      address: '0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a',
      method: 'JSON Artifact Upload'
    },
    {
      name: 'CrapsGame',
      address: '0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a',
      method: 'JSON Artifact Upload'
    },
    {
      name: 'CrapsBets',
      address: '0x7283196cb2aa54ebca3ec2198eb5a86215e627cb',
      method: 'JSON Artifact Upload'
    },
    {
      name: 'StakingPool',
      address: '0xc1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc2',
      method: 'JSON Artifact Upload'
    }
  ];

  console.log('For contracts with complex imports, use manual verification:\n');
  
  manualContracts.forEach(contract => {
    console.log(`📝 ${contract.name}:`);
    console.log(`   Address: ${contract.address}`);
    console.log(`   Method: ${contract.method}`);
    console.log(`   Verify: https://sepolia.basescan.org/verifyContract?a=${contract.address}`);
    console.log(`   Guide: ./deployment/MANUAL_VERIFICATION_STEPS.md\n`);
  });

  console.log('🔗 Quick Links:');
  console.log('   • Manual Verification Guide: ./deployment/MANUAL_VERIFICATION_STEPS.md');
  console.log('   • JSON Artifacts: ./artifacts/contracts/');
  console.log('   • BaseScan Verify: https://sepolia.basescan.org/verifyContract');
  console.log('   • Blockscout Alternative: https://base-sepolia.blockscout.com\n');

  console.log('✅ Verification process initiated!');
  console.log('⏳ Check results in 1-2 minutes');
}

main().catch(console.error);