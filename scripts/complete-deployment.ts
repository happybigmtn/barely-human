// Complete Final Deployment
import { network } from "hardhat";
import { formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY!;

// Already deployed
const BOT_TOKEN_ADDRESS = "0xedbce0a53a24f9e5f4684937ed3ee64e936cd048";
const VAULT_FACTORY_ADDRESS = "0xf8fd06a8835c514c88280a34d387afa2e5fa2806";
const GACHA_MINT_PASS_ADDRESS = "0x72aeecc947dd61493e0af9d92cb008abc2a3c253";

async function main() {
  console.log("🚀 Completing deployment...\n");

  const connection = await network.connect();
  const { viem } = connection;

  const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY as `0x${string}`);
  console.log(`📍 Deployer: ${account.address}`);
  console.log(`💰 Balance: ${formatEther(await viem.getPublicClient().then(c => c.getBalance({ address: account.address })))} ETH\n`);

  const publicClient = await viem.getPublicClient();

  try {
    // Check if vaults were actually deployed
    console.log("📋 Checking deployed vaults...");
    const vaultCount = await publicClient.readContract({
      address: VAULT_FACTORY_ADDRESS as `0x${string}`,
      abi: [{
        name: "getVaultCount",
        type: "function",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view"
      }],
      functionName: "getVaultCount",
      args: []
    }) as bigint;
    
    console.log(`Found ${vaultCount} vaults deployed\n`);

    // Get vault addresses from allVaults array
    if (vaultCount > 0n) {
      console.log("📋 Bot Vault Addresses:");
      const allVaults = await publicClient.readContract({
        address: VAULT_FACTORY_ADDRESS as `0x${string}`,
        abi: [{
          name: "getAllVaults",
          type: "function",
          inputs: [],
          outputs: [{ name: "", type: "address[]" }],
          stateMutability: "view"
        }],
        functionName: "getAllVaults",
        args: []
      }) as string[];
      
      allVaults.forEach((vault, i) => {
        console.log(`   Bot ${i}: ${vault}`);
      });
    }

    // Deploy BarelyHumanArt with correct parameters
    console.log("\n📦 Deploying BarelyHumanArt...");
    const barelyHumanArt = await viem.deployContract("BarelyHumanArt", [
      "Barely Human Art",
      "BHA"
    ]);
    console.log(`✅ BarelyHumanArt: ${barelyHumanArt.address}`);

    // Deploy ArtRedemptionService
    console.log("\n📦 Deploying ArtRedemptionService...");
    const artRedemptionService = await viem.deployContract("ArtRedemptionService", [
      GACHA_MINT_PASS_ADDRESS,
      barelyHumanArt.address
    ]);
    console.log(`✅ ArtRedemptionService: ${artRedemptionService.address}`);

    // Final summary
    console.log("\n═══════════════════════════════════════════════════════════════════");
    console.log("🎉 DEPLOYMENT FULLY COMPLETE!");
    console.log("═══════════════════════════════════════════════════════════════════\n");
    
    console.log("📋 All Deployed Contracts:");
    console.log(`BOTToken: ${BOT_TOKEN_ADDRESS}`);
    console.log(`Treasury: 0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a`);
    console.log(`StakingPool: 0xc1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc2`);
    console.log(`CrapsGame: 0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a`);
    console.log(`CrapsBets: 0x7283196cb2aa54ebca3ec2198eb5a86215e627cb`);
    console.log(`CrapsSettlement: 0xe156b261025e74a19b298c9d94260c744ae85d7f`);
    console.log(`VaultFactory: ${VAULT_FACTORY_ADDRESS}`);
    console.log(`BotManager: 0xb7470bd86d639d294cfc83b5b2ebf5cf5ea89486`);
    console.log(`GachaMintPass: ${GACHA_MINT_PASS_ADDRESS}`);
    console.log(`BarelyHumanArt: ${barelyHumanArt.address}`);
    console.log(`ArtRedemptionService: ${artRedemptionService.address}`);
    console.log(`BotBettingEscrow: 0x8f6282ad809e81ababc0c65458105394419ba92e`);
    
    console.log("\n⚠️ IMPORTANT - ADD TO VRF SUBSCRIPTION:");
    console.log(`✅ CrapsGame: 0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a (Already added)`);
    console.log(`- BotManager: 0xb7470bd86d639d294cfc83b5b2ebf5cf5ea89486`);
    console.log(`- GachaMintPass: ${GACHA_MINT_PASS_ADDRESS}`);
    console.log(`\n🔗 Go to: https://vrf.chain.link/base-sepolia`);

    // Save final deployment
    const deploymentInfo = {
      network: "Base Sepolia",
      chainId: 84532,
      deployer: account.address,
      timestamp: new Date().toISOString(),
      status: "COMPLETE",
      contracts: {
        BOTToken: BOT_TOKEN_ADDRESS,
        Treasury: "0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a",
        StakingPool: "0xc1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc2",
        CrapsGame: "0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a",
        CrapsBets: "0x7283196cb2aa54ebca3ec2198eb5a86215e627cb",
        CrapsSettlement: "0xe156b261025e74a19b298c9d94260c744ae85d7f",
        VaultFactory: VAULT_FACTORY_ADDRESS,
        BotManager: "0xb7470bd86d639d294cfc83b5b2ebf5cf5ea89486",
        GachaMintPass: GACHA_MINT_PASS_ADDRESS,
        BarelyHumanArt: barelyHumanArt.address,
        ArtRedemptionService: artRedemptionService.address,
        BotBettingEscrow: "0x8f6282ad809e81ababc0c65458105394419ba92e",
        BotVaults: allVaults || []
      }
    };

    const deploymentFile = path.join(process.cwd(), "deployment", "base-sepolia-complete.json");
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

    const finalBalance = await publicClient.getBalance({ address: account.address });
    console.log(`\n💰 Remaining Balance: ${formatEther(finalBalance)} ETH`);

  } catch (error) {
    console.error("❌ Error:", error);
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