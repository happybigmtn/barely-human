# 🔍 Contract Verification Guide - Base Sepolia

**Date**: August 17, 2025  
**Network**: Base Sepolia (Chain ID: 84532)  
**API Key**: NBBRKU4DMW8DI9WE28EDAFJWYI1B8UQUMV

---

## 📊 Verification Status

### Core Contracts (Priority 1)
| Contract | Address | Status | Verify Link |
|----------|---------|--------|-------------|
| BOT Token | `0xedbce0a53a24f9e5f4684937ed3ee64e936cd048` | ❌ | [Verify](https://sepolia.basescan.org/verifyContract?a=0xedbce0a53a24f9e5f4684937ed3ee64e936cd048) |
| Treasury | `0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a` | ❌ | [Verify](https://sepolia.basescan.org/verifyContract?a=0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a) |
| StakingPool | `0xc1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc2` | ❌ | [Verify](https://sepolia.basescan.org/verifyContract?a=0xc1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc2) |

### Game Contracts (Priority 2)
| Contract | Address | Status | Verify Link |
|----------|---------|--------|-------------|
| CrapsGame | `0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a` | ❌ | [Verify](https://sepolia.basescan.org/verifyContract?a=0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a) |
| CrapsBets | `0x7283196cb2aa54ebca3ec2198eb5a86215e627cb` | ❌ | [Verify](https://sepolia.basescan.org/verifyContract?a=0x7283196cb2aa54ebca3ec2198eb5a86215e627cb) |
| CrapsSettlementSimple | `0xe156b261025e74a19b298c9d94260c744ae85d7f` | ❌ | [Verify](https://sepolia.basescan.org/verifyContract?a=0xe156b261025e74a19b298c9d94260c744ae85d7f) |

---

## 🛠️ Manual Verification Instructions

### Step 1: BOT Token
1. Go to: https://sepolia.basescan.org/verifyContract?a=0xedbce0a53a24f9e5f4684937ed3ee64e936cd048
2. **Compiler Type**: Solidity (Single file)
3. **Compiler Version**: v0.8.28+commit.7893614a
4. **License**: MIT
5. **Constructor Arguments**:
   ```
   000000000000000000000000b46d347e7c99ade1eaa5d001a73b33ce7ab2588a  // Treasury
   00000000000000000000000061286f80b60e4dba60e923a975dee8b84f92d6cb  // Liquidity (deployer)
   000000000000000000000000c1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc2  // StakingPool
   00000000000000000000000061286f80b60e4dba60e923a975dee8b84f92d6cb  // Team (deployer)
   00000000000000000000000061286f80b60e4dba60e923a975dee8b84f92d6cb  // Community (deployer)
   ```

### Step 2: Treasury
1. Go to: https://sepolia.basescan.org/verifyContract?a=0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a
2. **Compiler Type**: Solidity (Single file)
3. **Compiler Version**: v0.8.28+commit.7893614a
4. **License**: MIT
5. **Constructor Arguments**:
   ```
   000000000000000000000000edbce0a53a24f9e5f4684937ed3ee64e936cd048  // BOT Token
   00000000000000000000000061286f80b60e4dba60e923a975dee8b84f92d6cb  // Owner (deployer)
   00000000000000000000000061286f80b60e4dba60e923a975dee8b84f92d6cb  // Owner (deployer)
   ```

### Step 3: CrapsBets
1. Go to: https://sepolia.basescan.org/verifyContract?a=0x7283196cb2aa54ebca3ec2198eb5a86215e627cb
2. **Compiler Type**: Solidity (Single file)
3. **Compiler Version**: v0.8.28+commit.7893614a
4. **License**: MIT
5. **No Constructor Arguments**

---

## 🚀 Automated Verification Commands

If manual verification doesn't work, try these commands with the API key:

```bash
# Export API key
export ETHERSCAN_API_KEY=NBBRKU4DMW8DI9WE28EDAFJWYI1B8UQUMV

# BOT Token
npx hardhat verify --network baseSepolia 0xedbce0a53a24f9e5f4684937ed3ee64e936cd048 \
  "0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a" \
  "0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB" \
  "0xc1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc2" \
  "0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB" \
  "0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB"

# Treasury
npx hardhat verify --network baseSepolia 0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a \
  "0xedbce0a53a24f9e5f4684937ed3ee64e936cd048" \
  "0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB" \
  "0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB"

# StakingPool
npx hardhat verify --network baseSepolia 0xc1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc2 \
  "0xedbce0a53a24f9e5f4684937ed3ee64e936cd048" \
  "0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a" \
  "0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB"

# CrapsGame
npx hardhat verify --network baseSepolia 0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a \
  "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634" \
  "1" \
  "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c"

# CrapsBets (no args)
npx hardhat verify --network baseSepolia 0x7283196cb2aa54ebca3ec2198eb5a86215e627cb

# CrapsSettlementSimple (no args)
npx hardhat verify --network baseSepolia 0xe156b261025e74a19b298c9d94260c744ae85d7f
```

---

## 📝 Compiler Settings

For all contracts, use these settings in manual verification:

- **Optimizer**: Enabled
- **Runs**: 1
- **EVM Version**: Paris
- **Via IR**: Enabled

---

## 🔗 Quick Links

- **BaseScan Sepolia**: https://sepolia.basescan.org
- **Verify Contract Page**: https://sepolia.basescan.org/verifyContract
- **Deployed Contracts List**: https://sepolia.basescan.org/address/0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB
- **API Documentation**: https://docs.basescan.org/api-endpoints/contracts

---

## ⚠️ Important Notes

1. **Blockscout Alternative**: If BaseScan verification fails, contracts can also be verified on Blockscout at https://base-sepolia.blockscout.com
2. **Constructor Arguments**: Must be ABI-encoded (remove 0x prefix)
3. **Source Code**: May need to flatten contracts if they have imports
4. **Libraries**: VaultFactoryLib at `0xde72434108dcbd4ddd164e3f9f347478ddcf16b6` may need separate verification

---

## 📊 Verification Priority

1. **High Priority** (User-facing):
   - BOT Token
   - CrapsGame
   - Bot Vaults

2. **Medium Priority** (Backend):
   - Treasury
   - StakingPool
   - BotManager

3. **Low Priority** (Support):
   - Libraries
   - Factories
   - Settlement contracts

---

**Next Steps After Verification**:
1. ✅ Add VRF consumers (BotManager, GachaMintPass)
2. ✅ Fund bot vaults with BOT tokens
3. ✅ Test game functionality
4. ✅ Deploy Uniswap V4 hooks