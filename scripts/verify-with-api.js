import axios from 'axios';

const API_KEY = 'NBBRKU4DMW8DI9WE28EDAFJWYI1B8UQUMV';
const BASE_URL = 'https://api-sepolia.basescan.org/api';

// Contracts to verify
const contracts = [
  {
    name: 'BOT Token',
    address: '0xedbce0a53a24f9e5f4684937ed3ee64e936cd048',
    contractPath: 'contracts/token/BOTToken.sol:BOTToken',
  },
  {
    name: 'Treasury',
    address: '0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a',
    contractPath: 'contracts/treasury/Treasury.sol:Treasury',
  },
  {
    name: 'StakingPool',
    address: '0xc1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc2',
    contractPath: 'contracts/staking/StakingPool.sol:StakingPool',
  },
  {
    name: 'CrapsGame',
    address: '0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a',
    contractPath: 'contracts/game/CrapsGame.sol:CrapsGame',
  },
  {
    name: 'CrapsBets',
    address: '0x7283196cb2aa54ebca3ec2198eb5a86215e627cb',
    contractPath: 'contracts/game/CrapsBets.sol:CrapsBets',
  },
];

async function checkVerificationStatus(address) {
  try {
    const response = await axios.get(BASE_URL, {
      params: {
        module: 'contract',
        action: 'getabi',
        address: address,
        apikey: API_KEY,
      },
    });
    
    if (response.data.status === '1') {
      return true; // Already verified
    }
    return false;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('📊 Checking verification status on Base Sepolia...\n');
  
  for (const contract of contracts) {
    const isVerified = await checkVerificationStatus(contract.address);
    console.log(`${contract.name}: ${contract.address}`);
    console.log(`  Status: ${isVerified ? '✅ Verified' : '❌ Not verified'}`);
    
    if (!isVerified) {
      console.log(`  To verify: npx hardhat verify --network baseSepolia ${contract.address}`);
    }
    console.log('');
  }
  
  console.log('\nℹ️  Note: Use manual verification at https://sepolia.basescan.org/verifyContract');
  console.log('   if automatic verification fails.');
}

main().catch(console.error);