// Verify contracts using Hardhat's built-in verification (proper way for OpenZeppelin imports)
import { network } from "hardhat";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Contracts to verify with their constructor arguments
const contracts = [
  {
    name: "BOTToken",
    address: "0xedbce0a53a24f9e5f4684937ed3ee64e936cd048",
    constructorArgs: [
      "0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a", // treasury
      "0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB", // liquidity (deployer)
      "0xc1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc2", // stakingPool
      "0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB", // team (deployer)
      "0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB"  // community (deployer)
    ]
  },
  {
    name: "Treasury",
    address: "0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a",
    constructorArgs: [
      "0xedbce0a53a24f9e5f4684937ed3ee64e936cd048", // botToken
      "0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB", // owner (deployer)
      "0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB"  // owner (deployer)
    ]
  },
  {
    name: "StakingPool",
    address: "0xc1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc2",
    constructorArgs: [
      "0xedbce0a53a24f9e5f4684937ed3ee64e936cd048", // botToken
      "0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a", // treasury
      "0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB"  // owner (deployer)
    ]
  },
  {
    name: "CrapsGame",
    address: "0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a",
    constructorArgs: [
      "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634", // vrfCoordinator
      "1", // subscriptionId (uint64 format)
      "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c" // keyHash
    ]
  },
  {
    name: "CrapsBets",
    address: "0x7283196cb2aa54ebca3ec2198eb5a86215e627cb",
    constructorArgs: []
  }
];

async function verifyContract(contract: any) {
  console.log(`\n📝 Verifying ${contract.name}...`);
  
  try {
    // Build the hardhat verify command
    const argsString = contract.constructorArgs.length > 0 
      ? contract.constructorArgs.map((arg: any) => `"${arg}"`).join(" ")
      : "";
    
    const command = `npx hardhat verify --network baseSepolia ${contract.address} ${argsString}`;
    
    console.log(`   🔧 Command: ${command}`);
    
    const { stdout, stderr } = await execAsync(command, { 
      cwd: process.cwd(),
      timeout: 120000 // 2 minute timeout
    });
    
    if (stdout.includes("Successfully verified") || stdout.includes("Already verified")) {
      console.log(`   ✅ ${contract.name} verification successful!`);
      if (stdout.includes("Already verified")) {
        console.log(`   ℹ️ Contract was already verified`);
      }
      return true;
    } else if (stdout.includes("Verifying...")) {
      console.log(`   ⏳ ${contract.name} verification submitted`);
      console.log(`   📝 Check BaseScan in a few minutes`);
      return true;
    } else {
      console.log(`   ⚠️ ${contract.name} verification response:`, stdout);
      return false;
    }
    
  } catch (error: any) {
    console.log(`   ❌ ${contract.name} verification failed:`);
    
    // Parse specific error messages
    const errorOutput = error.stdout || error.stderr || error.message;
    
    if (errorOutput.includes("Already verified")) {
      console.log(`   ✅ Contract was already verified`);
      return true;
    } else if (errorOutput.includes("Verifying...")) {
      console.log(`   ⏳ Verification submitted successfully`);
      return true;
    } else if (errorOutput.includes("constructor")) {
      console.log(`   🔧 Constructor argument issue - check parameter count/types`);
    } else if (errorOutput.includes("Compilation")) {
      console.log(`   🔧 Compilation issue - contract source may not match`);
    } else if (errorOutput.includes("API")) {
      console.log(`   🔧 API issue - check BaseScan API key configuration`);
    } else {
      console.log(`   🔧 Error details: ${errorOutput.substring(0, 200)}...`);
    }
    
    return false;
  }
}

async function main() {
  console.log("🔍 Hardhat-based Contract Verification\n");
  console.log("📍 Network: Base Sepolia");
  console.log("🔧 Method: Hardhat verification plugin with Standard JSON Input\n");
  
  console.log("💡 This method handles OpenZeppelin imports automatically by:");
  console.log("   • Using Standard JSON Input format");
  console.log("   • Including all source files and dependencies");
  console.log("   • Matching exact compiler settings from deployment\n");

  let successCount = 0;
  let totalCount = contracts.length;

  // Verify each contract
  for (const contract of contracts) {
    const success = await verifyContract(contract);
    if (success) successCount++;
    
    // Wait between verifications to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Verification Summary");
  console.log("=".repeat(60));
  console.log(`✅ Successful: ${successCount}/${totalCount} contracts`);
  console.log(`⚠️ Failed: ${totalCount - successCount}/${totalCount} contracts`);
  
  if (successCount === totalCount) {
    console.log("\n🎉 All contracts verified successfully!");
  } else if (successCount > 0) {
    console.log("\n🔄 Partial success - some contracts verified");
  } else {
    console.log("\n❌ No contracts verified - check configuration");
  }

  console.log("\n🔗 Verification Links:");
  contracts.forEach(contract => {
    console.log(`   ${contract.name}: https://sepolia.basescan.org/address/${contract.address}#code`);
  });

  console.log("\n💡 If verification failed:");
  console.log("   • Check that Hardhat config has correct BaseScan API key");
  console.log("   • Verify constructor arguments match deployment");
  console.log("   • Ensure compiler version matches (0.8.28)");
  console.log("   • Try manual verification via BaseScan web interface");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Verification process failed:", error.message);
    process.exit(1);
  });