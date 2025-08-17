import { network } from "hardhat";
import fs from "fs";
import path from "path";
import { createPublicClient, createWalletClient, http, parseUnits, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import chalk from "chalk";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

/**
 * ALTERNATIVE deployment script for Base Sepolia using Viem
 * NOTE: Main deployment script is deploy-base-sepolia.ts
 * This version provides an alternative viem-only approach
 * Deploys all 21 contracts with proper configuration
 */

async function main() {
  console.log(chalk.bold.cyan("\n🚀 Deploying Barely Human Casino to Base Sepolia\n"));
  
  // Setup account and clients
  const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`);
  
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL)
  });
  
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL)
  });
  
  // Get balance
  const balance = await publicClient.getBalance({ address: account.address });
  
  console.log(chalk.gray("Deployer address:"), account.address);
  console.log(chalk.gray("Deployer balance:"), formatEther(balance), "ETH");
  console.log(chalk.gray("Network:"), "Base Sepolia (84532)\n");
  
  if (balance < parseUnits("0.1", 18)) {
    console.log(chalk.red("⚠️  Low balance warning! You may need more ETH for deployment."));
  }
  
  // Connect to Hardhat runtime with viem
  const connection = await network.connect();
  const { viem } = connection;
  
  const contracts: any = {};
  const deploymentLog: any[] = [];
  
  try {
    // ==================== 1. Deploy BOT Token ====================
    console.log(chalk.yellow("Deploying BOT Token..."));
    // BOTToken needs 5 addresses: treasury, liquidity, stakingRewards, team, community
    // We'll use deployer address for now and update later
    const botToken = await viem.deployContract("BOTToken", [
      account.address, // treasury (will update)
      account.address, // liquidity 
      account.address, // stakingRewards (will update)
      account.address, // team
      account.address  // community
    ]);
    contracts.BOTToken = botToken.address;
    console.log(chalk.green(`✅ BOT Token deployed at: ${contracts.BOTToken}`));
    deploymentLog.push({ name: "BOTToken", address: contracts.BOTToken });
    
    // ==================== 2. Deploy Libraries ====================
    console.log(chalk.yellow("Deploying libraries..."));
    
    const vaultFactoryLib = await viem.deployContract("VaultFactoryLib");
    contracts.VaultFactoryLib = vaultFactoryLib.address;
    
    const crapsSettlementLib = await viem.deployContract("CrapsSettlementLib");
    contracts.CrapsSettlementLib = crapsSettlementLib.address;
    
    console.log(chalk.green("✅ Libraries deployed"));
    deploymentLog.push({ name: "VaultFactoryLib", address: contracts.VaultFactoryLib });
    deploymentLog.push({ name: "CrapsSettlementLib", address: contracts.CrapsSettlementLib });
    
    // ==================== 3. Deploy Treasury ====================
    console.log(chalk.yellow("Deploying Treasury..."));
    const treasury = await viem.deployContract("Treasury", [
      contracts.BOTToken,
      account.address, // development wallet
      account.address  // insurance wallet
    ]);
    contracts.Treasury = treasury.address;
    console.log(chalk.green(`✅ Treasury deployed at: ${contracts.Treasury}`));
    deploymentLog.push({ name: "Treasury", address: contracts.Treasury });
    
    // ==================== 4. Deploy StakingPool ====================
    console.log(chalk.yellow("Deploying StakingPool..."));
    const stakingPool = await viem.deployContract("StakingPool", [
      contracts.BOTToken,  // staking token
      contracts.BOTToken,  // reward token (same as staking)
      contracts.Treasury   // treasury
    ]);
    contracts.StakingPool = stakingPool.address;
    console.log(chalk.green(`✅ StakingPool deployed at: ${contracts.StakingPool}`));
    deploymentLog.push({ name: "StakingPool", address: contracts.StakingPool });
    
    // ==================== 5. Deploy VaultFactory ====================
    console.log(chalk.yellow("Deploying VaultFactory..."));
    const vaultFactory = await viem.deployContract("VaultFactoryMinimal", [
      contracts.BOTToken,
      contracts.Treasury
    ]);
    contracts.VaultFactory = vaultFactory.address;
    console.log(chalk.green(`✅ VaultFactory deployed at: ${contracts.VaultFactory}`));
    deploymentLog.push({ name: "VaultFactory", address: contracts.VaultFactory });
    
    // ==================== 6. Deploy Game Contracts ====================
    console.log(chalk.yellow("Deploying game contracts..."));
    
    // Deploy CrapsGameV2Plus with VRF config
    const crapsGame = await viem.deployContract("CrapsGameV2Plus", [
      process.env.VRF_COORDINATOR_ADDRESS as `0x${string}`,
      BigInt(process.env.VRF_SUBSCRIPTION_ID!),
      process.env.VRF_KEY_HASH as `0x${string}`
    ]);
    contracts.CrapsGameV2Plus = crapsGame.address;
    
    // Deploy BotManagerV2Plus (for VRF 2.5 compatibility)
    const botManager = await viem.deployContract("BotManagerV2Plus", [
      process.env.VRF_COORDINATOR_ADDRESS as `0x${string}`,  // vrfCoordinator
      BigInt(process.env.VRF_SUBSCRIPTION_ID!),  // subscriptionId (uint256)
      process.env.VRF_KEY_HASH as `0x${string}`  // keyHash
    ]);
    contracts.BotManager = botManager.address;
    
    // Deploy CrapsBets
    const crapsBets = await viem.deployContract("CrapsBets");
    contracts.CrapsBets = crapsBets.address;
    
    // Deploy CrapsSettlement
    const crapsSettlement = await viem.deployContract("CrapsSettlement");
    contracts.CrapsSettlement = crapsSettlement.address;
    
    console.log(chalk.green("✅ Game contracts deployed"));
    deploymentLog.push({ name: "CrapsGameV2Plus", address: contracts.CrapsGameV2Plus });
    deploymentLog.push({ name: "BotManager", address: contracts.BotManager });
    deploymentLog.push({ name: "CrapsBets", address: contracts.CrapsBets });
    deploymentLog.push({ name: "CrapsSettlement", address: contracts.CrapsSettlement });
    
    // ==================== 7. Deploy NFT Contracts ====================
    console.log(chalk.yellow("Deploying NFT contracts..."));
    
    // Deploy GachaMintPassV2Plus
    const mintPass = await viem.deployContract("GachaMintPassV2Plus", [
      process.env.VRF_COORDINATOR_ADDRESS as `0x${string}`,
      BigInt(process.env.VRF_SUBSCRIPTION_ID!),
      process.env.VRF_KEY_HASH as `0x${string}`,
      "https://api.barelyhuman.casino/nft/metadata/"  // baseTokenURI
    ]);
    contracts.GachaMintPassV2Plus = mintPass.address;
    
    // Deploy BarelyHumanArt
    const artNFT = await viem.deployContract("BarelyHumanArt", [
      "Barely Human Art",
      "BHART"
    ]);
    contracts.GenerativeArtNFT = artNFT.address;
    
    console.log(chalk.green("✅ NFT contracts deployed"));
    deploymentLog.push({ name: "GachaMintPassV2Plus", address: contracts.GachaMintPassV2Plus });
    deploymentLog.push({ name: "GenerativeArtNFT", address: contracts.GenerativeArtNFT });
    
    // ==================== 8. Deploy Escrow ====================
    console.log(chalk.yellow("Deploying BotBettingEscrow..."));
    const escrow = await viem.deployContract("BotBettingEscrow", [
      contracts.BOTToken,
      contracts.Treasury
    ]);
    contracts.BotBettingEscrow = escrow.address;
    console.log(chalk.green(`✅ BotBettingEscrow deployed at: ${contracts.BotBettingEscrow}`));
    deploymentLog.push({ name: "BotBettingEscrow", address: contracts.BotBettingEscrow });
    
    // ==================== 9. Deploy Cross-Chain (LayerZero) ====================
    console.log(chalk.yellow("Deploying cross-chain contracts..."));
    const layerZeroEndpoint = "0x6EDCE65403992e310A62460808c4b910D972f10f"; // Base Sepolia LZ endpoint
    
    const omniCoordinator = await viem.deployContract("OmniVaultCoordinator", [
      layerZeroEndpoint,
      contracts.VaultFactory,
      contracts.BOTToken
    ]);
    contracts.OmniVaultCoordinator = omniCoordinator.address;
    console.log(chalk.green(`✅ OmniVaultCoordinator deployed at: ${contracts.OmniVaultCoordinator}`));
    deploymentLog.push({ name: "OmniVaultCoordinator", address: contracts.OmniVaultCoordinator });
    
    // ==================== 10. Deploy Uniswap V4 Hook ====================
    console.log(chalk.yellow("Deploying Uniswap V4 hook..."));
    // Note: Using deployer address as placeholder for PoolManager (not deployed on testnet yet)
    const swapHook = await viem.deployContract("BotSwapFeeHookV4Final", [
      account.address,  // poolManager (placeholder - use deployer address)
      contracts.BOTToken,
      contracts.Treasury,
      contracts.StakingPool
    ]);
    contracts.BotSwapFeeHookV4Final = swapHook.address;
    console.log(chalk.green(`✅ BotSwapFeeHook deployed at: ${contracts.BotSwapFeeHookV4Final}`));
    deploymentLog.push({ name: "BotSwapFeeHookV4Final", address: contracts.BotSwapFeeHookV4Final });
    
    // ==================== 11. Configuration & Setup ====================
    console.log(chalk.yellow("\nConfiguring contracts..."));
    
    const walletClients = await viem.getWalletClients();
    const deployerClient = walletClients[0];
    
    // Grant roles
    const treasuryContract = await viem.getContractAt("Treasury", contracts.Treasury);
    const DISTRIBUTOR_ROLE = await treasuryContract.read.DISTRIBUTOR_ROLE();
    await treasuryContract.write.grantRole([DISTRIBUTOR_ROLE, contracts.StakingPool]);
    
    // Set game contract in VaultFactory
    const vaultFactoryContract = await viem.getContractAt("VaultFactoryMinimal", contracts.VaultFactory);
    await vaultFactoryContract.write.setGameContract([contracts.CrapsGameV2Plus]);
    await vaultFactoryContract.write.setBotManager([contracts.BotManager]);
    
    // Note: CrapsGameV2Plus doesn't have setBetsContract/setSettlementContract functions
    // These contracts work independently
    
    // Initialize bot manager
    const botManagerContract = await viem.getContractAt("BotManagerV2Plus", contracts.BotManager);
    await botManagerContract.write.initializeBots();
    
    // Deploy all bot vaults
    await vaultFactoryContract.write.deployAllBots();
    
    // Note: Token transfers are commented out as the deployer gets allocated tokens
    // in separate addresses during constructor. To fund contracts:
    // 1. Transfer tokens from allocation addresses to deployer
    // 2. Then transfer from deployer to contracts
    // const tokenContract = await viem.getContractAt("BOTToken", contracts.BOTToken);
    // const initialSupply = parseUnits("1000000", 18); // 1M BOT
    // await tokenContract.write.transfer([contracts.Treasury, initialSupply / 10n]);
    // await tokenContract.write.transfer([contracts.StakingPool, initialSupply / 10n]);
    
    console.log(chalk.green("✅ Contracts configured successfully"));
    
  } catch (error) {
    console.error(chalk.red("Deployment failed:"), error);
    await connection.close();
    process.exit(1);
  }
  
  // Close connection
  await connection.close();
  
  // ==================== 12. Save Deployment Info ====================
  const deploymentInfo = {
    network: "base-sepolia",
    chainId: 84532,
    deployer: account.address,
    timestamp: new Date().toISOString(),
    contracts: contracts,
    deploymentLog: deploymentLog,
    vrfConfig: {
      coordinator: process.env.VRF_COORDINATOR_ADDRESS,
      subscriptionId: process.env.VRF_SUBSCRIPTION_ID,
      keyHash: process.env.VRF_KEY_HASH
    }
  };
  
  const deploymentPath = path.join(__dirname, "../deployments/base-sepolia-deployment.json");
  fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  
  // ==================== Summary ====================
  console.log(chalk.bold.green("\n✅ Deployment Complete!\n"));
  console.log(chalk.bold("📋 Contract Addresses:"));
  
  console.table(deploymentLog);
  
  console.log(chalk.gray("\nDeployment info saved to:"), deploymentPath);
  console.log(chalk.yellow("\n⚠️  Next Steps:"));
  console.log("1. Add contracts as VRF consumers on Chainlink");
  console.log("2. Verify contracts on BaseScan");
  console.log("3. Run integration tests");
  console.log("4. Configure frontend to use Base Sepolia");
  
  return contracts;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });