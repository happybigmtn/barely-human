// Deploy Individual Vaults Directly (Bypass Factory Issue)
import { network } from "hardhat";
import { formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY!;
const BOT_TOKEN_ADDRESS = "0xedbce0a53a24f9e5f4684937ed3ee64e936cd048";
const BOT_MANAGER_ADDRESS = "0xb7470bd86d639d294cfc83b5b2ebf5cf5ea89486";

const BOT_CONFIGURATIONS = [
  { id: 0, name: "Alice" },
  { id: 1, name: "Bob" },
  { id: 2, name: "Charlie" },
  { id: 3, name: "Diana" },
  { id: 4, name: "Eddie" },
  { id: 5, name: "Fiona" },
  { id: 6, name: "Greg" },
  { id: 7, name: "Helen" },
  { id: 8, name: "Ivan" },
  { id: 9, name: "Julia" }
];

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log("🚀 Deploying individual bot vaults directly (bypassing factory)...\n");

  const connection = await network.connect();
  const { viem } = connection;

  const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY as `0x${string}`);
  const publicClient = await viem.getPublicClient();

  console.log(`📍 Deployer: ${account.address}`);
  console.log(`💰 Balance: ${formatEther(await publicClient.getBalance({ address: account.address }))} ETH\n`);

  const deployedVaults: { [key: number]: string } = {};
  let successCount = 0;

  try {
    console.log("📦 Deploying CrapsVault contracts individually...\n");

    for (const bot of BOT_CONFIGURATIONS) {
      try {
        console.log(`🤖 Deploying vault for ${bot.name} (ID: ${bot.id})...`);
        
        const vault = await viem.deployContract("CrapsVault", [
          BOT_TOKEN_ADDRESS,    // asset (BOT token)
          BigInt(bot.id),       // botId
          bot.name,             // botName
          BOT_MANAGER_ADDRESS   // botManager
        ]);
        
        deployedVaults[bot.id] = vault.address;
        successCount++;
        
        console.log(`   ✅ ${bot.name} Vault: ${vault.address}`);
        console.log(`   Transaction: ${vault.transactionHash}\n`);
        
        // Small delay between deployments
        await sleep(2000);
        
      } catch (error: any) {
        console.log(`   ❌ Failed to deploy ${bot.name} vault: ${error.message?.substring(0, 150)}\n`);
      }
    }

    // Summary
    console.log("═══════════════════════════════════════════════════════════════════");
    console.log("🎉 INDIVIDUAL VAULT DEPLOYMENT COMPLETE!");
    console.log("═══════════════════════════════════════════════════════════════════");
    
    console.log(`📊 Results: ${successCount}/10 vaults deployed successfully\n`);

    if (successCount > 0) {
      console.log("📋 Deployed Vault Addresses:");
      Object.entries(deployedVaults).forEach(([botId, address]) => {
        const bot = BOT_CONFIGURATIONS.find(b => b.id === parseInt(botId));
        console.log(`   ${bot?.name}: ${address}`);
      });

      // Create deployment info for saving
      const deploymentInfo = {
        network: "Base Sepolia",
        chainId: 84532,
        deployer: account.address,
        timestamp: new Date().toISOString(),
        deployment_method: "individual_direct_deployment",
        reason: "VaultFactory getBotName() function reverting",
        contracts: {
          BOTToken: BOT_TOKEN_ADDRESS,
          BotManager: BOT_MANAGER_ADDRESS,
          ...Object.fromEntries(
            Object.entries(deployedVaults).map(([botId, address]) => [
              `BotVault_${botId}`,
              address
            ])
          )
        },
        notes: {
          factory_issue: "VaultFactoryMinimal getBotName() function reverts",
          solution: "Direct individual vault deployment",
          next_steps: [
            "Update bot vaults with game contract permissions",
            "Fund vaults with initial BOT tokens",
            "Test vault functionality",
            "Consider deploying fixed VaultFactory if needed"
          ]
        }
      };

      // Save deployment info
      const deploymentDir = path.join(process.cwd(), "deployment");
      if (!fs.existsSync(deploymentDir)) {
        fs.mkdirSync(deploymentDir, { recursive: true });
      }
      
      const deploymentFile = path.join(deploymentDir, "individual-vault-deployment.json");
      fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

      console.log(`\n💾 Deployment info saved to: ${deploymentFile}`);

      // Provide JSON format for easy copying
      console.log("\n📋 Vault Addresses (JSON format):");
      console.log("{");
      Object.entries(deployedVaults).forEach(([botId, address], index, array) => {
        const comma = index < array.length - 1 ? "," : "";
        console.log(`  "BotVault_${botId}": "${address}"${comma}`);
      });
      console.log("}");

      // Next steps
      console.log("\n📝 Next Steps:");
      console.log("1. Update each vault with game contract permissions");
      console.log("2. Fund vaults with initial BOT tokens for operation");
      console.log("3. Test vault deposit/withdraw functionality");
      console.log("4. Connect vaults to BotManager for automated betting");
      console.log("5. Deploy a fixed VaultFactory if centralized management needed");

      if (successCount === 10) {
        console.log("\n🎉 ALL 10 BOT VAULTS SUCCESSFULLY DEPLOYED!");
        console.log("✅ The vault deployment issue has been RESOLVED!");
      }
    }

    const finalBalance = await publicClient.getBalance({ address: account.address });
    console.log(`\n💰 Remaining Balance: ${formatEther(finalBalance)} ETH`);

  } catch (error) {
    console.error("❌ Individual deployment failed:", error);
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