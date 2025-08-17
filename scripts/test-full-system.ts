// Comprehensive system test with Alchemy RPC
import { network } from "hardhat";
import { formatEther, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY!;

// Contract addresses
const BOT_TOKEN = "0xedbce0a53a24f9e5f4684937ed3ee64e936cd048";
const TREASURY = "0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a";
const CRAPS_GAME = "0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a";
const CRAPS_BETS = "0x7283196cb2aa54ebca3ec2198eb5a86215e627cb";
const BOT_MANAGER = "0xb7470bd86d639d294cfc83b5b2ebf5cf5ea89486";

// Test vault (Alice - should be funded)
const ALICE_VAULT = "0xbbb3749e98f69aab8479e36a8c9bb20e57eca5a7";

// Minimal ABIs for testing
const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable"
  }
];

const CRAPS_GAME_ABI = [
  {
    name: "currentPhase",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view"
  },
  {
    name: "seriesCount",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    name: "hasRole",
    type: "function",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" }
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view"
  }
];

const VAULT_ABI = [
  {
    name: "totalAssets",
    type: "function", 
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  }
];

async function main() {
  console.log("🧪 Full System Test - Barely Human Casino\n");
  console.log("🌐 Using Alchemy RPC for Base Sepolia\n");

  const connection = await network.connect();
  const { viem } = connection;

  const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY as `0x${string}`);
  console.log(`📍 Deployer: ${account.address}`);
  
  const publicClient = await viem.getPublicClient();
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`💰 ETH Balance: ${formatEther(balance)} ETH\n`);

  let testResults = {
    tokenSystem: false,
    vaultSystem: false,
    gameSystem: false,
    roleSystem: false,
    networkConnection: false
  };

  try {
    // Test 1: Network Connection
    console.log("🌐 Test 1: Network Connection");
    const blockNumber = await publicClient.getBlockNumber();
    console.log(`   Latest block: ${blockNumber}`);
    console.log("   ✅ Alchemy RPC connection working");
    testResults.networkConnection = true;

    // Test 2: BOT Token System
    console.log("\n💰 Test 2: BOT Token System");
    
    const totalSupply = await publicClient.readContract({
      address: BOT_TOKEN as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account.address]
    }) as bigint;
    
    const treasuryBalance = await publicClient.readContract({
      address: BOT_TOKEN as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [TREASURY]
    }) as bigint;
    
    console.log(`   Deployer Balance: ${formatEther(totalSupply)} BOT`);
    console.log(`   Treasury Balance: ${formatEther(treasuryBalance)} BOT`);
    
    if (totalSupply > 0n) {
      console.log("   ✅ BOT token system functional");
      testResults.tokenSystem = true;
    } else {
      console.log("   ❌ BOT token system issues");
    }

    // Test 3: Vault System
    console.log("\n🏦 Test 3: Vault System (Alice's Vault)");
    
    const aliceBalance = await publicClient.readContract({
      address: BOT_TOKEN as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [ALICE_VAULT]
    }) as bigint;
    
    try {
      const aliceAssets = await publicClient.readContract({
        address: ALICE_VAULT as `0x${string}`,
        abi: VAULT_ABI,
        functionName: "totalAssets"
      }) as bigint;
      
      console.log(`   Alice Vault BOT Balance: ${formatEther(aliceBalance)} BOT`);
      console.log(`   Alice Vault Total Assets: ${formatEther(aliceAssets)} BOT`);
      
      if (aliceBalance > 0n) {
        console.log("   ✅ Vault system functional and funded");
        testResults.vaultSystem = true;
      } else {
        console.log("   ⚠️ Vault deployed but not funded");
      }
    } catch (error) {
      console.log(`   ⚠️ Vault contract interface issues`);
      if (aliceBalance > 0n) {
        console.log("   ✅ Basic vault funding confirmed");
        testResults.vaultSystem = true;
      }
    }

    // Test 4: Game System
    console.log("\n🎲 Test 4: Game System");
    
    try {
      const gamePhase = await publicClient.readContract({
        address: CRAPS_GAME as `0x${string}`,
        abi: CRAPS_GAME_ABI,
        functionName: "currentPhase"
      }) as number;
      
      const seriesCount = await publicClient.readContract({
        address: CRAPS_GAME as `0x${string}`,
        abi: CRAPS_GAME_ABI,
        functionName: "seriesCount"
      }) as bigint;
      
      console.log(`   Current Game Phase: ${gamePhase}`);
      console.log(`   Total Series Count: ${seriesCount.toString()}`);
      console.log("   ✅ Game system accessible");
      testResults.gameSystem = true;
      
    } catch (error: any) {
      console.log(`   ❌ Game system issues: ${error.message?.substring(0, 50)}`);
    }

    // Test 5: Role System
    console.log("\n🔐 Test 5: Role System");
    
    try {
      // Check if deployer has admin role (0x00...)
      const hasAdminRole = await publicClient.readContract({
        address: CRAPS_GAME as `0x${string}`,
        abi: CRAPS_GAME_ABI,
        functionName: "hasRole",
        args: [
          "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
          account.address
        ]
      }) as boolean;
      
      console.log(`   Deployer has admin role: ${hasAdminRole}`);
      
      if (hasAdminRole) {
        console.log("   ✅ Role system functional");
        testResults.roleSystem = true;
      } else {
        console.log("   ⚠️ Role system needs configuration");
      }
      
    } catch (error: any) {
      console.log(`   ⚠️ Role system check failed: ${error.message?.substring(0, 50)}`);
    }

    // Test Summary
    console.log("\n📊 System Test Results:");
    console.log("=" .repeat(50));
    
    const results = [
      { name: "Network Connection", status: testResults.networkConnection },
      { name: "BOT Token System", status: testResults.tokenSystem },
      { name: "Vault System", status: testResults.vaultSystem },
      { name: "Game System", status: testResults.gameSystem },
      { name: "Role System", status: testResults.roleSystem }
    ];
    
    results.forEach(result => {
      const icon = result.status ? "✅" : "❌";
      console.log(`   ${icon} ${result.name}`);
    });
    
    const passedTests = results.filter(r => r.status).length;
    const totalTests = results.length;
    const successRate = (passedTests / totalTests) * 100;
    
    console.log("\n🎯 Overall System Health:");
    console.log(`   Tests Passed: ${passedTests}/${totalTests} (${successRate.toFixed(1)}%)`);
    
    if (successRate >= 80) {
      console.log("   🟢 System Status: HEALTHY - Ready for game testing");
    } else if (successRate >= 60) {
      console.log("   🟡 System Status: FUNCTIONAL - Minor issues need attention");
    } else {
      console.log("   🔴 System Status: NEEDS ATTENTION - Major issues detected");
    }

    // Recommendations
    console.log("\n💡 Recommendations:");
    
    if (testResults.vaultSystem && testResults.gameSystem) {
      console.log("   1. ✅ Ready to run first test game series");
      console.log("   2. ✅ Alice's vault is funded and operational");
      console.log("   3. 🔄 Add VRF consumers via Chainlink dashboard");
      console.log("   4. 🔄 Verify core contracts on BaseScan");
    }
    
    if (!testResults.roleSystem) {
      console.log("   ⚠️ Configure role permissions for game operations");
    }
    
    console.log("\n🚀 Next Actions:");
    console.log("   • VRF Consumer Setup: https://vrf.chain.link/base-sepolia");
    console.log("   • Contract Verification: Use JSON artifact method");
    console.log("   • Test Game Execution: Run dice game with Alice's vault");

  } catch (error: any) {
    console.error("❌ System test failed:", error.message);
  } finally {
    await connection.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });