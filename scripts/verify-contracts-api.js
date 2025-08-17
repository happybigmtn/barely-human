import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const API_KEY = 'NBBRKU4DMW8DI9WE28EDAFJWYI1B8UQUMV';
const BASE_URL = 'https://api-sepolia.basescan.org/api';
const CHAIN_ID = '84532'; // Base Sepolia
const COMPILER_VERSION = 'v0.8.28+commit.7893614a';
const EVM_VERSION = 'paris'; // Hardhat default for newer versions

// Helper function to read contract source
function readContractSource(contractName) {
  // Try to read flattened file first
  const flattenedPath = path.join(__dirname, '..', 'flattened', `${contractName}_flattened.sol`);
  if (fs.existsSync(flattenedPath)) {
    return fs.readFileSync(flattenedPath, 'utf8');
  }
  
  // Fallback to original source
  const sourcePath = path.join(__dirname, '..', 'contracts', `${contractName}.sol`);
  return fs.readFileSync(sourcePath, 'utf8');
}

// Contract configurations
const contracts = [
  {
    name: 'CrapsBets',
    address: '0x7283196cb2aa54ebca3ec2198eb5a86215e627cb',
    sourcePath: 'contracts/game/CrapsBets.sol',
    contractName: 'CrapsBets',
    constructorArgs: '',
  },
  {
    name: 'CrapsSettlementSimple',
    address: '0xe156b261025e74a19b298c9d94260c744ae85d7f',
    sourcePath: 'contracts/game/CrapsSettlementSimple.sol',
    contractName: 'CrapsSettlementSimple',
    constructorArgs: '',
  },
  {
    name: 'BOTToken',
    address: '0xedbce0a53a24f9e5f4684937ed3ee64e936cd048',
    sourcePath: 'contracts/token/BOTToken.sol',
    contractName: 'BOTToken',
    // Constructor arguments ABI encoded (without 0x prefix)
    constructorArgs: '000000000000000000000000b46d347e7c99ade1eaa5d001a73b33ce7ab2588a00000000000000000000000061286f80b60e4dba60e923a975dee8b84f92d6cb000000000000000000000000c1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc200000000000000000000000061286f80b60e4dba60e923a975dee8b84f92d6cb00000000000000000000000061286f80b60e4dba60e923a975dee8b84f92d6cb',
  },
  {
    name: 'Treasury',
    address: '0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a',
    sourcePath: 'contracts/treasury/Treasury.sol',
    contractName: 'Treasury',
    constructorArgs: '000000000000000000000000edbce0a53a24f9e5f4684937ed3ee64e936cd04800000000000000000000000061286f80b60e4dba60e923a975dee8b84f92d6cb00000000000000000000000061286f80b60e4dba60e923a975dee8b84f92d6cb',
  },
  {
    name: 'StakingPool',
    address: '0xc1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc2',
    sourcePath: 'contracts/staking/StakingPool.sol',
    contractName: 'StakingPool',
    constructorArgs: '000000000000000000000000edbce0a53a24f9e5f4684937ed3ee64e936cd048000000000000000000000000b46d347e7c99ade1eaa5d001a73b33ce7ab2588a00000000000000000000000061286f80b60e4dba60e923a975dee8b84f92d6cb',
  },
  {
    name: 'CrapsGame',
    address: '0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a',
    sourcePath: 'contracts/game/CrapsGame.sol',
    contractName: 'CrapsGame',
    constructorArgs: '000000000000000000000000d5d517abe5cf79b7e95ec98db0f0277788aff6340000000000000000000000000000000000000000000000000000000000000001474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c',
  },
];

async function verifyContract(contract) {
  console.log(`\n📝 Verifying ${contract.name}...`);
  
  try {
    // Read source code (use contract name for flattened file)
    const sourceCode = readContractSource(contract.contractName);
    
    // Prepare verification parameters
    const params = new URLSearchParams({
      module: 'contract',
      action: 'verifysourcecode',
      apikey: API_KEY,
    });

    // Prepare form data
    const data = new URLSearchParams({
      chainId: CHAIN_ID,
      codeformat: 'solidity-single-file',
      sourceCode: sourceCode,
      contractaddress: contract.address,
      contractname: `${contract.sourcePath}:${contract.contractName}`, // Full contract path
      compilerversion: COMPILER_VERSION,
      optimizationUsed: '1', // Optimization enabled as per hardhat.config.ts
      runs: '1', // Optimizer runs set to 1 for smallest bytecode
      evmversion: EVM_VERSION,
      licenseType: '3', // MIT License
      constructorArguements: contract.constructorArgs, // Note: API uses "Arguements" (typo in their API)
    });

    // Submit verification
    const response = await fetch(`${BASE_URL}?${params}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: data,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.status === '1') {
      console.log(`✅ ${contract.name} verification submitted successfully!`);
      console.log(`   GUID: ${result.result}`);
      
      // Check verification status after a delay
      setTimeout(() => checkVerificationStatus(contract.name, result.result), 5000);
    } else {
      console.log(`❌ ${contract.name} verification failed:`, result.result);
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Error verifying ${contract.name}:`, error.message);
    return null;
  }
}

async function checkVerificationStatus(contractName, guid) {
  try {
    const params = new URLSearchParams({
      module: 'contract',
      action: 'checkverifystatus',
      guid: guid,
      apikey: API_KEY,
    });

    const response = await fetch(`${BASE_URL}?${params}`);
    const result = await response.json();
    
    if (result.status === '1') {
      console.log(`✅ ${contractName} verified successfully!`);
    } else if (result.result === 'Pending in queue') {
      console.log(`⏳ ${contractName} verification pending...`);
      // Check again after delay
      setTimeout(() => checkVerificationStatus(contractName, guid), 10000);
    } else {
      console.log(`ℹ️ ${contractName} status:`, result.result);
    }
  } catch (error) {
    console.error(`Error checking status for ${contractName}:`, error.message);
  }
}

async function verifyAll() {
  console.log('🚀 Starting contract verification on Base Sepolia...');
  console.log(`📍 Chain ID: ${CHAIN_ID}`);
  console.log(`🔑 API Key: ${API_KEY.substring(0, 6)}...${API_KEY.substring(API_KEY.length - 4)}\n`);
  
  // Verify contracts sequentially to avoid rate limiting
  for (const contract of contracts) {
    await verifyContract(contract);
    // Wait between submissions to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n✅ All verification requests submitted!');
  console.log('📊 Check verification status at: https://sepolia.basescan.org');
}

// Also export a function to check existing verification status
export async function checkAllVerificationStatus() {
  console.log('📊 Checking verification status of all contracts...\n');
  
  for (const contract of contracts) {
    try {
      const params = new URLSearchParams({
        module: 'contract',
        action: 'getabi',
        address: contract.address,
        apikey: API_KEY,
      });

      const response = await fetch(`${BASE_URL}?${params}`);
      const result = await response.json();
      
      if (result.status === '1') {
        console.log(`✅ ${contract.name}: Verified`);
      } else {
        console.log(`❌ ${contract.name}: Not verified`);
      }
    } catch (error) {
      console.log(`⚠️ ${contract.name}: Error checking status`);
    }
  }
}

// Run verification
verifyAll().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});