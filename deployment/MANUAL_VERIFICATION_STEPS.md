# 🔍 Manual Contract Verification - Step by Step Guide

**Date**: August 17, 2025  
**Network**: Base Sepolia (Chain ID: 84532)  
**Status**: CrapsSettlementSimple ✅ (automated), Others require manual verification

---

## ✅ Already Verified
- **CrapsSettlementSimple**: `0xe156b261025e74a19b298c9d94260c744ae85d7f` - ✅ Verified automatically

---

## 📋 Manual Verification Required

### 1. BOT Token (Priority: HIGH)
- **Address**: `0xedbce0a53a24f9e5f4684937ed3ee64e936cd048`
- **Verify URL**: https://sepolia.basescan.org/verifyContract?a=0xedbce0a53a24f9e5f4684937ed3ee64e936cd048

**Steps**:
1. Click "Via Standard JSON Input"
2. **Contract Name**: `contracts/token/BOTToken.sol:BOTToken`
3. **Compiler**: `v0.8.28+commit.7893614a`
4. **File**: Upload `artifacts/contracts/token/BOTToken.sol/BOTToken.json`
5. **Constructor Arguments** (ABI encoded):
   ```
   000000000000000000000000b46d347e7c99ade1eaa5d001a73b33ce7ab2588a
   00000000000000000000000061286f80b60e4dba60e923a975dee8b84f92d6cb
   000000000000000000000000c1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc2
   00000000000000000000000061286f80b60e4dba60e923a975dee8b84f92d6cb
   00000000000000000000000061286f80b60e4dba60e923a975dee8b84f92d6cb
   ```

### 2. Treasury (Priority: HIGH)
- **Address**: `0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a`
- **Verify URL**: https://sepolia.basescan.org/verifyContract?a=0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a

**Steps**:
1. Click "Via Standard JSON Input"
2. **Contract Name**: `contracts/treasury/Treasury.sol:Treasury`
3. **Compiler**: `v0.8.28+commit.7893614a`
4. **File**: Upload `artifacts/contracts/treasury/Treasury.sol/Treasury.json`
5. **Constructor Arguments**:
   ```
   000000000000000000000000edbce0a53a24f9e5f4684937ed3ee64e936cd048
   00000000000000000000000061286f80b60e4dba60e923a975dee8b84f92d6cb
   00000000000000000000000061286f80b60e4dba60e923a975dee8b84f92d6cb
   ```

### 3. CrapsGame (Priority: HIGH)
- **Address**: `0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a`
- **Verify URL**: https://sepolia.basescan.org/verifyContract?a=0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a

**Steps**:
1. Click "Via Standard JSON Input"
2. **Contract Name**: `contracts/game/CrapsGame.sol:CrapsGame`
3. **Compiler**: `v0.8.28+commit.7893614a`
4. **File**: Upload `artifacts/contracts/game/CrapsGame.sol/CrapsGame.json`
5. **Constructor Arguments**:
   ```
   000000000000000000000000d5d517abe5cf79b7e95ec98db0f0277788aff634
   0000000000000000000000000000000000000000000000000000000000000001
   474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c
   ```

### 4. CrapsBets (Priority: MEDIUM)
- **Address**: `0x7283196cb2aa54ebca3ec2198eb5a86215e627cb`
- **Verify URL**: https://sepolia.basescan.org/verifyContract?a=0x7283196cb2aa54ebca3ec2198eb5a86215e627cb

**Steps**:
1. Click "Via Standard JSON Input"
2. **Contract Name**: `contracts/game/CrapsBets.sol:CrapsBets`
3. **Compiler**: `v0.8.28+commit.7893614a`
4. **File**: Upload `artifacts/contracts/game/CrapsBets.sol/CrapsBets.json`
5. **No Constructor Arguments**

### 5. StakingPool (Priority: MEDIUM)
- **Address**: `0xc1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc2`
- **Verify URL**: https://sepolia.basescan.org/verifyContract?a=0xc1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc2

**Steps**:
1. Click "Via Standard JSON Input"
2. **Contract Name**: `contracts/staking/StakingPool.sol:StakingPool`
3. **Compiler**: `v0.8.28+commit.7893614a`
4. **File**: Upload `artifacts/contracts/staking/StakingPool.sol/StakingPool.json`
5. **Constructor Arguments**:
   ```
   000000000000000000000000edbce0a53a24f9e5f4684937ed3ee64e936cd048
   000000000000000000000000b46d347e7c99ade1eaa5d001a73b33ce7ab2588a
   00000000000000000000000061286f80b60e4dba60e923a975dee8b84f92d6cb
   ```

---

## 🛠️ JSON Artifact Method (Recommended)

### Why Use JSON Artifacts?
- ✅ Includes all dependencies automatically
- ✅ Exact compiler settings preserved
- ✅ No need to flatten contracts
- ✅ Higher success rate

### Where to Find Artifacts?
```
artifacts/contracts/
├── token/BOTToken.sol/BOTToken.json
├── treasury/Treasury.sol/Treasury.json
├── game/CrapsGame.sol/CrapsGame.json
├── game/CrapsBets.sol/CrapsBets.json
└── staking/StakingPool.sol/StakingPool.json
```

### Upload Instructions:
1. Go to contract verification URL
2. Select "Via Standard JSON Input"
3. Click "Choose File" and upload the .json artifact
4. Fill in contract name (format: `path/to/contract.sol:ContractName`)
5. Add constructor arguments if needed
6. Submit

---

## 📊 Constructor Arguments Reference

### Address Mappings:
- **BOT Token**: `0xedbce0a53a24f9e5f4684937ed3ee64e936cd048`
- **Treasury**: `0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a`
- **StakingPool**: `0xc1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc2`
- **Deployer**: `0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB`
- **VRF Coordinator**: `0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634`

### ABI Encoding Tool:
Use https://abi.hashex.org or:
```javascript
// Example for BOT Token constructor
const args = [
  "0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a", // treasury
  "0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB", // liquidity
  "0xc1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc2", // staking
  "0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB", // team
  "0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB"  // community
];
```

---

## ⚡ Quick Commands

### Check if Contract is Verified:
```bash
node scripts/verify-with-api.js
```

### Generate Constructor Arguments:
```bash
# For BOT Token
npx hardhat verify --network baseSepolia 0xedbce0a53a24f9e5f4684937ed3ee64e936cd048 \
  --constructor-args scripts/constructor-args/bot-token.js --dry-run
```

---

## 🎯 Verification Checklist

### High Priority (Launch Critical):
- [ ] BOT Token - Users need to see contract code
- [ ] Treasury - Transparency for fee collection
- [ ] CrapsGame - Core game logic verification

### Medium Priority (Nice to Have):
- [ ] CrapsBets - Betting logic transparency
- [ ] StakingPool - Staking mechanism clarity

### Low Priority (Backend):
- [ ] Vault contracts (10 individual vaults)
- [ ] NFT contracts
- [ ] Factory contracts

---

## 🚨 Troubleshooting

### Common Issues:
1. **Constructor Arguments**: Must be ABI-encoded without 0x prefix
2. **Contract Name**: Must include full path like `contracts/token/BOTToken.sol:BOTToken`
3. **Compiler Version**: Must match exactly `v0.8.28+commit.7893614a`
4. **JSON Upload**: Use artifacts from `artifacts/contracts/` directory

### If Verification Fails:
1. Try Blockscout: https://base-sepolia.blockscout.com
2. Check constructor arguments encoding
3. Verify compiler version matches
4. Try single-file upload with flattened contract

---

## 🔗 Quick Links

- [BaseScan Verification](https://sepolia.basescan.org/verifyContract)
- [Blockscout Alternative](https://base-sepolia.blockscout.com)
- [ABI Encoder Tool](https://abi.hashex.org)
- [Constructor Args Reference](./VERIFICATION_GUIDE.md)

---

**Next Steps After Verification**:
1. ✅ Add VRF consumers (BotManager, GachaMintPass)
2. ✅ Fund bot vaults with BOT tokens
3. ✅ Test game functionality
4. ✅ Deploy to mainnet