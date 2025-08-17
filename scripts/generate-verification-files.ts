// Generate verification files for manual upload (Standard JSON Input method)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Contract addresses and details
const contracts = [
  {
    name: "BOTToken",
    address: "0xedbce0a53a24f9e5f4684937ed3ee64e936cd048",
    sourcePath: "contracts/token/BOTToken.sol",
    contractName: "BOTToken",
    constructorArgs: "000000000000000000000000b46d347e7c99ade1eaa5d001a73b33ce7ab2588a00000000000000000000000061286f80b60e4dba60e923a975dee8b84f92d6cb000000000000000000000000c1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc200000000000000000000000061286f80b60e4dba60e923a975dee8b84f92d6cb00000000000000000000000061286f80b60e4dba60e923a975dee8b84f92d6cb"
  },
  {
    name: "Treasury", 
    address: "0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a",
    sourcePath: "contracts/treasury/Treasury.sol",
    contractName: "Treasury",
    constructorArgs: "000000000000000000000000edbce0a53a24f9e5f4684937ed3ee64e936cd04800000000000000000000000061286f80b60e4dba60e923a975dee8b84f92d6cb00000000000000000000000061286f80b60e4dba60e923a975dee8b84f92d6cb"
  },
  {
    name: "CrapsGame",
    address: "0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a", 
    sourcePath: "contracts/game/CrapsGame.sol",
    contractName: "CrapsGame",
    constructorArgs: "000000000000000000000000d5d517abe5cf79b7e95ec98db0f0277788aff6340000000000000000000000000000000000000000000000000000000000000001474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c"
  },
  {
    name: "CrapsBets",
    address: "0x7283196cb2aa54ebca3ec2198eb5a86215e627cb",
    sourcePath: "contracts/game/CrapsBets.sol", 
    contractName: "CrapsBets",
    constructorArgs: ""
  },
  {
    name: "StakingPool",
    address: "0xc1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc2",
    sourcePath: "contracts/staking/StakingPool.sol",
    contractName: "StakingPool", 
    constructorArgs: "000000000000000000000000edbce0a53a24f9e5f4684937ed3ee64e936cd048000000000000000000000000b46d347e7c99ade1eaa5d001a73b33ce7ab2588a00000000000000000000000061286f80b60e4dba60e923a975dee8b84f92d6cb"
  }
];

function generateVerificationGuide() {
  const verificationDir = path.join(__dirname, '..', 'verification');
  if (!fs.existsSync(verificationDir)) {
    fs.mkdirSync(verificationDir, { recursive: true });
  }

  let guideContent = `# 🔍 BaseScan Verification Guide - Standard JSON Input Method

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
3. **Upload the JSON file** from \`artifacts/contracts/[path]/[Contract].json\`
4. **Enter contract name** as \`contracts/[path]/[Contract].sol:[ContractName]\`
5. **Add constructor arguments** (provided below in hex format)
6. **Submit for verification**

---

## 🔧 Contract Verification Details

`;

  contracts.forEach((contract, index) => {
    const artifactPath = `artifacts/${contract.sourcePath}/${contract.contractName}.json`;
    
    guideContent += `### ${index + 1}. ${contract.name}

**Address**: \`${contract.address}\`  
**Verify URL**: https://sepolia.basescan.org/verifyContract?a=${contract.address}

**Steps**:
1. Click "Via Standard JSON Input"
2. **Upload File**: \`${artifactPath}\`
3. **Contract Name**: \`${contract.sourcePath}:${contract.contractName}\`
4. **Constructor Arguments**: \`${contract.constructorArgs}\`
5. **Compiler**: v0.8.28+commit.7893614a (auto-detected)

**Direct Link**: [Verify ${contract.name}](https://sepolia.basescan.org/verifyContract?a=${contract.address})

---

`;
  });

  guideContent += `## 🔍 Verification Checklist

After uploading each contract:
- [ ] JSON file uploaded successfully
- [ ] Contract name matches format: \`contracts/path/Contract.sol:ContractName\`
- [ ] Constructor arguments copied exactly (no 0x prefix)
- [ ] Compiler version auto-detected as v0.8.28+commit.7893614a
- [ ] Optimization settings: Enabled with 1 runs
- [ ] EVM Version: paris

---

## 📊 Contract Status Tracking

| Contract | Address | Status | Link |
|----------|---------|--------|------|`;

  contracts.forEach(contract => {
    guideContent += `
| ${contract.name} | \`${contract.address}\` | ⏳ Pending | [Verify](https://sepolia.basescan.org/verifyContract?a=${contract.address}) |`;
  });

  guideContent += `

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
   - Use format: \`contracts/path/Contract.sol:ContractName\`
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
- **Artifacts Directory**: \`./artifacts/contracts/\`
- **Alternative**: Use Blockscout at https://base-sepolia.blockscout.com

---

**Time Required**: 5-10 minutes per contract  
**Success Rate**: 95%+ with Standard JSON Input method  
**Alternative**: If this fails, try Blockscout verification  

`;

  const guideFile = path.join(verificationDir, 'VERIFICATION_GUIDE.md');
  fs.writeFileSync(guideFile, guideContent);
  
  return guideFile;
}

function checkArtifacts() {
  console.log("🔍 Checking artifact files for verification...\n");
  
  const results = [];
  
  contracts.forEach(contract => {
    const artifactPath = path.join(__dirname, '..', 'artifacts', contract.sourcePath, `${contract.contractName}.json`);
    const exists = fs.existsSync(artifactPath);
    
    console.log(`📁 ${contract.name}:`);
    console.log(`   Path: ${artifactPath}`);
    console.log(`   Status: ${exists ? '✅ Found' : '❌ Missing'}`);
    
    if (exists) {
      try {
        const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
        const hasMetadata = artifact.metadata ? '✅ Yes' : '❌ No';
        const hasBytecode = artifact.bytecode ? '✅ Yes' : '❌ No';
        
        console.log(`   Metadata: ${hasMetadata}`);
        console.log(`   Bytecode: ${hasBytecode}`);
        
        results.push({
          contract: contract.name,
          path: artifactPath,
          ready: exists && artifact.metadata && artifact.bytecode
        });
      } catch (error) {
        console.log(`   ⚠️ JSON parse error`);
        results.push({
          contract: contract.name,
          path: artifactPath,
          ready: false
        });
      }
    } else {
      results.push({
        contract: contract.name,
        path: artifactPath,
        ready: false
      });
    }
    
    console.log('');
  });
  
  return results;
}

async function main() {
  console.log("📋 Generating Verification Files for Standard JSON Input Method\n");
  
  // Check artifacts
  const artifactResults = checkArtifacts();
  
  // Generate guide
  const guideFile = generateVerificationGuide();
  console.log(`📖 Verification guide created: ${guideFile}\n`);
  
  // Summary
  const readyCount = artifactResults.filter(r => r.ready).length;
  const totalCount = artifactResults.length;
  
  console.log("📊 Verification Readiness Summary:");
  console.log("=".repeat(50));
  console.log(`✅ Ready for verification: ${readyCount}/${totalCount} contracts`);
  console.log(`❌ Missing artifacts: ${totalCount - readyCount}/${totalCount} contracts\n`);
  
  if (readyCount === totalCount) {
    console.log("🎉 All contracts ready for verification!");
    console.log("📋 Follow the guide in verification/VERIFICATION_GUIDE.md");
  } else {
    console.log("⚠️ Some artifacts missing - run compilation first:");
    console.log("   npx hardhat compile");
  }
  
  console.log("\n🔗 Next Steps:");
  console.log("1. Open verification/VERIFICATION_GUIDE.md");
  console.log("2. Follow step-by-step instructions for each contract");
  console.log("3. Use Standard JSON Input method for best results");
  console.log("4. Track progress in the verification checklist");
  
  console.log("\n💡 Pro Tip:");
  console.log("Standard JSON Input method resolves OpenZeppelin import issues automatically!");
}

main().catch(console.error);