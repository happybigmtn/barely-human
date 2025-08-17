# Barely Human - Wallet Funding Instructions

## Deployer Wallet Address
0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB

## Networks & Funding

### Base Sepolia (Testnet)
- **Chain ID**: 84532
- **RPC URL**: https://sepolia.base.org
- **Explorer**: https://sepolia.basescan.org/address/0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB

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
- **Explorer**: https://basescan.org/address/0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB

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
```bash
# Check wallet balance
npx hardhat run scripts/check-balance.ts --network baseSepolia

# Deploy all contracts
npx hardhat run scripts/deploy-base-sepolia-viem.ts --network baseSepolia

# Verify contracts on BaseScan
npx hardhat verify --network baseSepolia <CONTRACT_ADDRESS>

# Deploy to mainnet (when ready)
npx hardhat run scripts/deploy-base-mainnet-viem.ts --network baseMainnet
```

Created: 2025-08-16T23:06:45.962Z
