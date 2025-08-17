#!/usr/bin/env node
// Barely Human - Create Deployer Wallet for Base Sepolia Deployment using Viem

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔐 Creating Deployer Wallet for Barely Human using Viem...\n');

// Generate a new random private key
const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

// Create wallet client for Base Sepolia
const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http('https://sepolia.base.org')
});

// Wallet details
const walletInfo = {
  address: account.address,
  privateKey: privateKey,
  created: new Date().toISOString(),
  network: 'Base Sepolia',
  chainId: 84532,
  explorerUrl: `https://sepolia.basescan.org/address/${account.address}`
};

// Display wallet information
console.log('✅ New Deployer Wallet Created!\n');
console.log('═══════════════════════════════════════════════════════════════════\n');
console.log(`📍 Address: ${walletInfo.address}`);
console.log(`🔑 Private Key: ${walletInfo.privateKey}`);
console.log(`🌐 Network: ${walletInfo.network} (Chain ID: ${walletInfo.chainId})`);
console.log(`🔍 Explorer: ${walletInfo.explorerUrl}`);
console.log('\n═══════════════════════════════════════════════════════════════════\n');

// Save to secure file
const outputDir = path.join(__dirname, '..', 'deployment');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Save wallet info to JSON (excluding private key for safety)
const safeWalletInfo = {
  address: walletInfo.address,
  network: walletInfo.network,
  chainId: walletInfo.chainId,
  created: walletInfo.created,
  explorerUrl: walletInfo.explorerUrl
};

const walletFile = path.join(outputDir, 'deployer-wallet.json');
fs.writeFileSync(walletFile, JSON.stringify(safeWalletInfo, null, 2));
console.log(`📁 Wallet info saved to: ${walletFile}`);

// Save private key to separate secure file
const privateKeyFile = path.join(outputDir, '.deployer-private-key');
fs.writeFileSync(privateKeyFile, walletInfo.privateKey, { mode: 0o600 });
console.log(`🔐 Private key saved to: ${privateKeyFile}`);

// Create or update .env file
const envFile = path.join(__dirname, '..', '.env');
const envContent = `
# Barely Human - Deployment Configuration
# Generated: ${walletInfo.created}

# Deployer Wallet
DEPLOYER_ADDRESS=${walletInfo.address}
DEPLOYER_PRIVATE_KEY=${walletInfo.privateKey}

# Base Sepolia Network
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASE_SEPOLIA_CHAIN_ID=84532
BASE_SEPOLIA_EXPLORER=https://sepolia.basescan.org

# Base Mainnet Network (for future)
BASE_MAINNET_RPC_URL=https://mainnet.base.org
BASE_MAINNET_CHAIN_ID=8453
BASE_MAINNET_EXPLORER=https://basescan.org

# Chainlink VRF (Base Sepolia)
VRF_COORDINATOR_ADDRESS=0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634
VRF_KEY_HASH=0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c
VRF_SUBSCRIPTION_ID=
VRF_CALLBACK_GAS_LIMIT=200000

# API Keys (optional but recommended)
BASESCAN_API_KEY=
ALCHEMY_API_KEY=
INFURA_API_KEY=
`;

// Append to existing .env or create new
if (fs.existsSync(envFile)) {
  const existingEnv = fs.readFileSync(envFile, 'utf8');
  if (!existingEnv.includes('DEPLOYER_ADDRESS')) {
    fs.appendFileSync(envFile, envContent);
    console.log(`✅ Updated .env file with deployment configuration`);
  } else {
    console.log(`⚠️  .env file already contains DEPLOYER_ADDRESS, skipping update`);
  }
} else {
  fs.writeFileSync(envFile, envContent.trim());
  console.log(`✅ Created .env file with deployment configuration`);
}

// Add to .gitignore if not already there
const gitignoreFile = path.join(__dirname, '..', '.gitignore');
const gitignoreEntries = [
  '\n# Deployment secrets',
  'deployment/.deployer-private-key',
  'deployment/.deployer-mnemonic',
  '.env',
  '.env.local',
  '.env.production'
];

if (fs.existsSync(gitignoreFile)) {
  const gitignoreContent = fs.readFileSync(gitignoreFile, 'utf8');
  const entriesToAdd = gitignoreEntries.filter(entry => 
    !gitignoreContent.includes(entry.replace('\n# ', '').trim())
  );
  
  if (entriesToAdd.length > 0) {
    fs.appendFileSync(gitignoreFile, '\n' + entriesToAdd.join('\n'));
    console.log(`✅ Updated .gitignore with security entries`);
  }
}

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('📋 NEXT STEPS:');
console.log('═══════════════════════════════════════════════════════════════════\n');

console.log('1. 💰 FUND YOUR WALLET:');
console.log('   Send Base Sepolia ETH to:', walletInfo.address);
console.log('   \n   Get testnet ETH from:');
console.log('   • https://www.alchemy.com/faucets/base-sepolia');
console.log('   • https://faucet.quicknode.com/base/sepolia');
console.log('   • https://bwarelabs.com/faucets/base-sepolia');
console.log('   • Bridge from Sepolia: https://bridge.base.org/');

console.log('\n2. 🔗 CHAINLINK VRF SUBSCRIPTION:');
console.log('   • Go to: https://vrf.chain.link/base-sepolia');
console.log('   • Create a new subscription');
console.log('   • Fund it with LINK tokens');
console.log('   • Update VRF_SUBSCRIPTION_ID in .env file');

console.log('\n3. 🚀 DEPLOY CONTRACTS:');
console.log('   npx hardhat run scripts/deploy-base-sepolia-viem.ts --network baseSepolia');

console.log('\n4. ✅ VERIFY CONTRACTS:');
console.log('   npx hardhat verify --network baseSepolia <CONTRACT_ADDRESS>');

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('⚠️  SECURITY WARNINGS:');
console.log('═══════════════════════════════════════════════════════════════════\n');
console.log('• NEVER share your private key');
console.log('• NEVER commit .env or private key files to git');
console.log('• ALWAYS use hardware wallets for mainnet deployment');
console.log('• This wallet is for TESTNET use only initially');

console.log('\n═══════════════════════════════════════════════════════════════════');

// Create funding instructions file
const fundingInstructions = `# Barely Human - Wallet Funding Instructions

## Deployer Wallet Address
${walletInfo.address}

## Networks & Funding

### Base Sepolia (Testnet)
- **Chain ID**: 84532
- **RPC URL**: https://sepolia.base.org
- **Explorer**: https://sepolia.basescan.org/address/${walletInfo.address}

#### Get Base Sepolia ETH:
1. **Alchemy Faucet** (0.5 ETH/day)
   https://www.alchemy.com/faucets/base-sepolia
   
2. **QuickNode Faucet** (0.1 ETH/day)
   https://faucet.quicknode.com/base/sepolia
   
3. **Bware Labs Faucet** (0.1 ETH/day)
   https://bwarelabs.com/faucets/base-sepolia
   
4. **Bridge from Sepolia** (Recommended for larger amounts)
   - Get Sepolia ETH: https://sepoliafaucet.com/
   - Bridge to Base: https://bridge.base.org/

### Chainlink VRF Setup
1. Visit: https://vrf.chain.link/base-sepolia
2. Connect wallet and create subscription
3. Get LINK tokens: https://faucets.chain.link/base-sepolia
4. Fund subscription with 10+ LINK
5. Note subscription ID for deployment

### Base Mainnet (Production)
- **Chain ID**: 8453
- **RPC URL**: https://mainnet.base.org
- **Explorer**: https://basescan.org/address/${walletInfo.address}

## Recommended Funding Amounts

### For Testnet Deployment:
- **Base Sepolia ETH**: 0.5 ETH (for deployment gas)
- **LINK Tokens**: 20 LINK (for VRF subscription)

### For Mainnet Deployment:
- **Base ETH**: 0.1 ETH (for deployment gas)
- **LINK Tokens**: 100 LINK (for VRF subscription)

## Security Checklist
- [ ] Private key stored securely
- [ ] .env file not committed to git
- [ ] .gitignore updated
- [ ] Wallet funded with testnet ETH
- [ ] Chainlink VRF subscription created

## Deployment Commands Using Viem
\`\`\`bash
# Check wallet balance
npx hardhat run scripts/check-balance.ts --network baseSepolia

# Deploy all contracts
npx hardhat run scripts/deploy-base-sepolia-viem.ts --network baseSepolia

# Verify contracts on BaseScan
npx hardhat verify --network baseSepolia <CONTRACT_ADDRESS>

# Deploy to mainnet (when ready)
npx hardhat run scripts/deploy-base-mainnet-viem.ts --network baseMainnet
\`\`\`

Created: ${walletInfo.created}
`;

const fundingFile = path.join(outputDir, 'FUNDING_INSTRUCTIONS.md');
fs.writeFileSync(fundingFile, fundingInstructions);
console.log(`📖 Funding instructions saved to: ${fundingFile}\n`);

// Show wallet address for easy copying
console.log('📱 WALLET ADDRESS (for easy copying):');
console.log('═══════════════════════════════════════════════════════════════════');
console.log(walletInfo.address);
console.log('═══════════════════════════════════════════════════════════════════\n');

console.log('✅ Deployer wallet creation complete with Viem!');
console.log('📂 All files saved in:', outputDir);
console.log('\n🎯 Ready for Base Sepolia deployment once funded!\n');