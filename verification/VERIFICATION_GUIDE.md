# 🔍 BaseScan Verification Guide - Standard JSON Input Method

**Date**: August 17, 2025  
**Method**: Standard JSON Input (Recommended for OpenZeppelin contracts)  
**Status**: Ready for manual verification  

---

## 🎯 Why Standard JSON Input?

The **Standard JSON Input** method is the recommended approach for verifying contracts with OpenZeppelin imports because:

1. ✅ **Handles Dependencies**: Automatically includes all imported files
2. ✅ **Preserves Structure**: Maintains original file organization  
3. ✅ **Exact Match**: Uses identical compiler settings from deployment
4. ✅ **No Flattening**: Avoids issues with license conflicts and import resolution

---

## 📋 Step-by-Step Verification Instructions

### For Each Contract Below:

1. **Go to BaseScan verification page** (links provided)
2. **Select "Via Standard JSON Input"** 
3. **Upload the JSON file** from `artifacts/contracts/[path]/[Contract].json`
4. **Enter contract name** as `contracts/[path]/[Contract].sol:[ContractName]`
5. **Add constructor arguments** (provided below in hex format)
6. **Submit for verification**

---

## 🔧 Contract Verification Details

### 1. BOTToken

**Address**: `0xedbce0a53a24f9e5f4684937ed3ee64e936cd048`  
**Verify URL**: https://sepolia.basescan.org/verifyContract?a=0xedbce0a53a24f9e5f4684937ed3ee64e936cd048

**Steps**:
1. Click "Via Standard JSON Input"
2. **Upload File**: `artifacts/contracts/token/BOTToken.sol/BOTToken.json`
3. **Contract Name**: `contracts/token/BOTToken.sol:BOTToken`
4. **Constructor Arguments**: `000000000000000000000000b46d347e7c99ade1eaa5d001a73b33ce7ab2588a00000000000000000000000061286f80b60e4dba60e923a975dee8b84f92d6cb000000000000000000000000c1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc200000000000000000000000061286f80b60e4dba60e923a975dee8b84f92d6cb00000000000000000000000061286f80b60e4dba60e923a975dee8b84f92d6cb`
5. **Compiler**: v0.8.28+commit.7893614a (auto-detected)

**Direct Link**: [Verify BOTToken](https://sepolia.basescan.org/verifyContract?a=0xedbce0a53a24f9e5f4684937ed3ee64e936cd048)

---

### 2. Treasury

**Address**: `0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a`  
**Verify URL**: https://sepolia.basescan.org/verifyContract?a=0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a

**Steps**:
1. Click "Via Standard JSON Input"
2. **Upload File**: `artifacts/contracts/treasury/Treasury.sol/Treasury.json`
3. **Contract Name**: `contracts/treasury/Treasury.sol:Treasury`
4. **Constructor Arguments**: `000000000000000000000000edbce0a53a24f9e5f4684937ed3ee64e936cd04800000000000000000000000061286f80b60e4dba60e923a975dee8b84f92d6cb00000000000000000000000061286f80b60e4dba60e923a975dee8b84f92d6cb`
5. **Compiler**: v0.8.28+commit.7893614a (auto-detected)

**Direct Link**: [Verify Treasury](https://sepolia.basescan.org/verifyContract?a=0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a)

---

### 3. CrapsGame

**Address**: `0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a`  
**Verify URL**: https://sepolia.basescan.org/verifyContract?a=0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a

**Steps**:
1. Click "Via Standard JSON Input"
2. **Upload File**: `artifacts/contracts/game/CrapsGame.sol/CrapsGame.json`
3. **Contract Name**: `contracts/game/CrapsGame.sol:CrapsGame`
4. **Constructor Arguments**: `000000000000000000000000d5d517abe5cf79b7e95ec98db0f0277788aff6340000000000000000000000000000000000000000000000000000000000000001474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c`
5. **Compiler**: v0.8.28+commit.7893614a (auto-detected)

**Direct Link**: [Verify CrapsGame](https://sepolia.basescan.org/verifyContract?a=0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a)

---

### 4. CrapsBets

**Address**: `0x7283196cb2aa54ebca3ec2198eb5a86215e627cb`  
**Verify URL**: https://sepolia.basescan.org/verifyContract?a=0x7283196cb2aa54ebca3ec2198eb5a86215e627cb

**Steps**:
1. Click "Via Standard JSON Input"
2. **Upload File**: `artifacts/contracts/game/CrapsBets.sol/CrapsBets.json`
3. **Contract Name**: `contracts/game/CrapsBets.sol:CrapsBets`
4. **Constructor Arguments**: ``
5. **Compiler**: v0.8.28+commit.7893614a (auto-detected)

**Direct Link**: [Verify CrapsBets](https://sepolia.basescan.org/verifyContract?a=0x7283196cb2aa54ebca3ec2198eb5a86215e627cb)

---

### 5. StakingPool

**Address**: `0xc1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc2`  
**Verify URL**: https://sepolia.basescan.org/verifyContract?a=0xc1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc2

**Steps**:
1. Click "Via Standard JSON Input"
2. **Upload File**: `artifacts/contracts/staking/StakingPool.sol/StakingPool.json`
3. **Contract Name**: `contracts/staking/StakingPool.sol:StakingPool`
4. **Constructor Arguments**: `000000000000000000000000edbce0a53a24f9e5f4684937ed3ee64e936cd048000000000000000000000000b46d347e7c99ade1eaa5d001a73b33ce7ab2588a00000000000000000000000061286f80b60e4dba60e923a975dee8b84f92d6cb`
5. **Compiler**: v0.8.28+commit.7893614a (auto-detected)

**Direct Link**: [Verify StakingPool](https://sepolia.basescan.org/verifyContract?a=0xc1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc2)

---

## 🔍 Verification Checklist

After uploading each contract:
- [ ] JSON file uploaded successfully
- [ ] Contract name matches format: `contracts/path/Contract.sol:ContractName`
- [ ] Constructor arguments copied exactly (no 0x prefix)
- [ ] Compiler version auto-detected as v0.8.28+commit.7893614a
- [ ] Optimization settings: Enabled with 1 runs
- [ ] EVM Version: paris

---

## 📊 Contract Status Tracking

| Contract | Address | Status | Link |
|----------|---------|--------|------|
| BOTToken | `0xedbce0a53a24f9e5f4684937ed3ee64e936cd048` | ⏳ Pending | [Verify](https://sepolia.basescan.org/verifyContract?a=0xedbce0a53a24f9e5f4684937ed3ee64e936cd048) |
| Treasury | `0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a` | ⏳ Pending | [Verify](https://sepolia.basescan.org/verifyContract?a=0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a) |
| CrapsGame | `0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a` | ⏳ Pending | [Verify](https://sepolia.basescan.org/verifyContract?a=0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a) |
| CrapsBets | `0x7283196cb2aa54ebca3ec2198eb5a86215e627cb` | ⏳ Pending | [Verify](https://sepolia.basescan.org/verifyContract?a=0x7283196cb2aa54ebca3ec2198eb5a86215e627cb) |
| StakingPool | `0xc1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc2` | ⏳ Pending | [Verify](https://sepolia.basescan.org/verifyContract?a=0xc1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc2) |

---

## 🛠️ Troubleshooting

### Common Issues:

1. **"Constructor arguments not found"**
   - Ensure arguments are in hex format without 0x prefix
   - Double-check argument order matches constructor

2. **"Compilation failed"**
   - Verify JSON artifact is from correct contract
   - Check that compiler version matches deployment

3. **"Contract name mismatch"**
   - Use format: `contracts/path/Contract.sol:ContractName`
   - Case-sensitive matching required

4. **"Upload failed"**
   - JSON file may be too large - this is rare but contact BaseScan if needed
   - Try refreshing page and re-uploading

---

## ✅ Expected Results

Once verified, each contract will show:
- ✅ Green checkmark on BaseScan
- 📖 Source code visible and readable
- 🔍 Function signatures and documentation
- 📊 Contract details and constructor arguments

---

## 🔗 Quick Links

- **BaseScan**: https://sepolia.basescan.org  
- **Artifacts Directory**: `./artifacts/contracts/`
- **Alternative**: Use Blockscout at https://base-sepolia.blockscout.com

---

**Time Required**: 5-10 minutes per contract  
**Success Rate**: 95%+ with Standard JSON Input method  
**Alternative**: If this fails, try Blockscout verification  

