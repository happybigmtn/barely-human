import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import ora from "ora";
import chalk from "chalk";

/**
 * Complete deployment script for Base Sepolia testnet
 * Deploys all 21 contracts with proper configuration
 */

async function main() {
  console.log(chalk.bold.cyan("\n🚀 Deploying Barely Human Casino to Base Sepolia\n"));
  
  // Get deployer
  const [deployer] = await ethers.getSigners();
  const balance = await deployer.provider.getBalance(deployer.address);
  
  console.log(chalk.gray("Deployer address:"), deployer.address);
  console.log(chalk.gray("Deployer balance:"), ethers.formatEther(balance), "ETH");
  console.log(chalk.gray("Network:"), "Base Sepolia (84532)\n");
  
  if (balance < ethers.parseEther("0.1")) {
    console.log(chalk.red("⚠️  Low balance warning! You may need more ETH for deployment."));
  }
  
  const contracts: any = {};
  const deploymentLog: any[] = [];
  
  // ==================== 1. Deploy BOT Token ====================
  const spinner1 = ora("Deploying BOT Token...").start();
  try {
    const BOTToken = await ethers.getContractFactory("BOTToken");
    const botToken = await BOTToken.deploy(deployer.address);
    await botToken.waitForDeployment();
    contracts.BOTToken = await botToken.getAddress();
    
    spinner1.succeed(`BOT Token deployed at: ${contracts.BOTToken}`);
    deploymentLog.push({ name: "BOTToken", address: contracts.BOTToken });
  } catch (error) {
    spinner1.fail("Failed to deploy BOT Token");
    console.error(error);
    process.exit(1);
  }
  
  // ==================== 2. Deploy Libraries ====================
  const spinner2 = ora("Deploying libraries...").start();
  try {
    // Deploy VaultFactoryLib
    const VaultFactoryLib = await ethers.getContractFactory("VaultFactoryLib");
    const vaultFactoryLib = await VaultFactoryLib.deploy();
    await vaultFactoryLib.waitForDeployment();
    contracts.VaultFactoryLib = await vaultFactoryLib.getAddress();
    
    // Deploy CrapsSettlementLib
    const CrapsSettlementLib = await ethers.getContractFactory("CrapsSettlementLib");
    const crapsSettlementLib = await CrapsSettlementLib.deploy();
    await crapsSettlementLib.waitForDeployment();
    contracts.CrapsSettlementLib = await crapsSettlementLib.getAddress();
    
    spinner2.succeed("Libraries deployed");
    deploymentLog.push({ name: "VaultFactoryLib", address: contracts.VaultFactoryLib });
    deploymentLog.push({ name: "CrapsSettlementLib", address: contracts.CrapsSettlementLib });
  } catch (error) {
    spinner2.fail("Failed to deploy libraries");
    console.error(error);
    process.exit(1);
  }
  
  // ==================== 3. Deploy Treasury ====================
  const spinner3 = ora("Deploying Treasury...").start();
  try {
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(contracts.BOTToken);
    await treasury.waitForDeployment();
    contracts.Treasury = await treasury.getAddress();
    
    spinner3.succeed(`Treasury deployed at: ${contracts.Treasury}`);
    deploymentLog.push({ name: "Treasury", address: contracts.Treasury });
  } catch (error) {
    spinner3.fail("Failed to deploy Treasury");
    console.error(error);
    process.exit(1);
  }
  
  // ==================== 4. Deploy StakingPool ====================
  const spinner4 = ora("Deploying StakingPool...").start();
  try {
    const StakingPool = await ethers.getContractFactory("StakingPool");
    const stakingPool = await StakingPool.deploy(
      contracts.BOTToken,
      contracts.Treasury
    );
    await stakingPool.waitForDeployment();
    contracts.StakingPool = await stakingPool.getAddress();
    
    spinner4.succeed(`StakingPool deployed at: ${contracts.StakingPool}`);
    deploymentLog.push({ name: "StakingPool", address: contracts.StakingPool });
  } catch (error) {
    spinner4.fail("Failed to deploy StakingPool");
    console.error(error);
    process.exit(1);
  }
  
  // ==================== 5. Deploy VaultFactory ====================
  const spinner5 = ora("Deploying VaultFactory...").start();
  try {
    const VaultFactoryMinimal = await ethers.getContractFactory("VaultFactoryMinimal", {
      libraries: {
        VaultFactoryLib: contracts.VaultFactoryLib
      }
    });
    const vaultFactory = await VaultFactoryMinimal.deploy(
      contracts.BOTToken,
      contracts.Treasury
    );
    await vaultFactory.waitForDeployment();
    contracts.VaultFactory = await vaultFactory.getAddress();
    
    spinner5.succeed(`VaultFactory deployed at: ${contracts.VaultFactory}`);
    deploymentLog.push({ name: "VaultFactory", address: contracts.VaultFactory });
  } catch (error) {
    spinner5.fail("Failed to deploy VaultFactory");
    console.error(error);
    process.exit(1);
  }
  
  // ==================== 6. Deploy Game Contracts ====================
  const spinner6 = ora("Deploying game contracts...").start();
  try {
    // Deploy CrapsGameV2Plus with VRF config
    const CrapsGameV2Plus = await ethers.getContractFactory("CrapsGameV2Plus");
    const crapsGame = await CrapsGameV2Plus.deploy(
      process.env.VRF_COORDINATOR_ADDRESS!, // VRF Coordinator on Base Sepolia
      BigInt(process.env.VRF_SUBSCRIPTION_ID!), // Subscription ID
      process.env.VRF_KEY_HASH!, // Key hash
      200000 // Callback gas limit
    );
    await crapsGame.waitForDeployment();
    contracts.CrapsGameV2Plus = await crapsGame.getAddress();
    
    // Deploy BotManager
    const BotManager = await ethers.getContractFactory("BotManager");
    const botManager = await BotManager.deploy(
      contracts.CrapsGameV2Plus,
      contracts.BOTToken
    );
    await botManager.waitForDeployment();
    contracts.BotManager = await botManager.getAddress();
    
    // Deploy CrapsBets
    const CrapsBets = await ethers.getContractFactory("CrapsBets");
    const crapsBets = await CrapsBets.deploy();
    await crapsBets.waitForDeployment();
    contracts.CrapsBets = await crapsBets.getAddress();
    
    // Deploy CrapsSettlement with library
    const CrapsSettlement = await ethers.getContractFactory("CrapsSettlement", {
      libraries: {
        CrapsSettlementLib: contracts.CrapsSettlementLib
      }
    });
    const crapsSettlement = await CrapsSettlement.deploy();
    await crapsSettlement.waitForDeployment();
    contracts.CrapsSettlement = await crapsSettlement.getAddress();
    
    spinner6.succeed("Game contracts deployed");
    deploymentLog.push({ name: "CrapsGameV2Plus", address: contracts.CrapsGameV2Plus });
    deploymentLog.push({ name: "BotManager", address: contracts.BotManager });
    deploymentLog.push({ name: "CrapsBets", address: contracts.CrapsBets });
    deploymentLog.push({ name: "CrapsSettlement", address: contracts.CrapsSettlement });
  } catch (error) {
    spinner6.fail("Failed to deploy game contracts");
    console.error(error);
    process.exit(1);
  }
  
  // ==================== 7. Deploy NFT Contracts ====================
  const spinner7 = ora("Deploying NFT contracts...").start();
  try {
    // Deploy GachaMintPassV2Plus
    const GachaMintPassV2Plus = await ethers.getContractFactory("GachaMintPassV2Plus");
    const mintPass = await GachaMintPassV2Plus.deploy(
      "Barely Human Mint Pass",
      "BHMP",
      process.env.VRF_COORDINATOR_ADDRESS!,
      BigInt(process.env.VRF_SUBSCRIPTION_ID!),
      process.env.VRF_KEY_HASH!,
      200000
    );
    await mintPass.waitForDeployment();
    contracts.GachaMintPassV2Plus = await mintPass.getAddress();
    
    // Deploy GenerativeArtNFT
    const GenerativeArtNFT = await ethers.getContractFactory("GenerativeArtNFT");
    const artNFT = await GenerativeArtNFT.deploy(
      "Barely Human Art",
      "BHART",
      contracts.GachaMintPassV2Plus
    );
    await artNFT.waitForDeployment();
    contracts.GenerativeArtNFT = await artNFT.getAddress();
    
    spinner7.succeed("NFT contracts deployed");
    deploymentLog.push({ name: "GachaMintPassV2Plus", address: contracts.GachaMintPassV2Plus });
    deploymentLog.push({ name: "GenerativeArtNFT", address: contracts.GenerativeArtNFT });
  } catch (error) {
    spinner7.fail("Failed to deploy NFT contracts");
    console.error(error);
    process.exit(1);
  }
  
  // ==================== 8. Deploy Escrow ====================
  const spinner8 = ora("Deploying BotBettingEscrow...").start();
  try {
    const BotBettingEscrow = await ethers.getContractFactory("BotBettingEscrow");
    const escrow = await BotBettingEscrow.deploy(
      contracts.BOTToken,
      contracts.BotManager,
      contracts.Treasury
    );
    await escrow.waitForDeployment();
    contracts.BotBettingEscrow = await escrow.getAddress();
    
    spinner8.succeed(`BotBettingEscrow deployed at: ${contracts.BotBettingEscrow}`);
    deploymentLog.push({ name: "BotBettingEscrow", address: contracts.BotBettingEscrow });
  } catch (error) {
    spinner8.fail("Failed to deploy BotBettingEscrow");
    console.error(error);
    process.exit(1);
  }
  
  // ==================== 9. Deploy Cross-Chain (LayerZero) ====================
  const spinner9 = ora("Deploying cross-chain contracts...").start();
  try {
    // For Base Sepolia, we'll use the LayerZero endpoint
    const layerZeroEndpoint = "0x6EDCE65403992e310A62460808c4b910D972f10f"; // Base Sepolia LZ endpoint
    
    const OmniVaultCoordinator = await ethers.getContractFactory("OmniVaultCoordinator");
    const omniCoordinator = await OmniVaultCoordinator.deploy(
      layerZeroEndpoint,
      contracts.VaultFactory,
      contracts.BOTToken
    );
    await omniCoordinator.waitForDeployment();
    contracts.OmniVaultCoordinator = await omniCoordinator.getAddress();
    
    spinner9.succeed(`OmniVaultCoordinator deployed at: ${contracts.OmniVaultCoordinator}`);
    deploymentLog.push({ name: "OmniVaultCoordinator", address: contracts.OmniVaultCoordinator });
  } catch (error) {
    spinner9.fail("Failed to deploy cross-chain contracts");
    console.error(error);
    process.exit(1);
  }
  
  // ==================== 10. Deploy Uniswap V4 Hook (Mock for testnet) ====================
  const spinner10 = ora("Deploying Uniswap V4 hook...").start();
  try {
    // Deploy a simplified version for testnet
    const BotSwapFeeHookV4Final = await ethers.getContractFactory("BotSwapFeeHookV4Final");
    const swapHook = await BotSwapFeeHookV4Final.deploy(
      contracts.Treasury,
      contracts.BOTToken
    );
    await swapHook.waitForDeployment();
    contracts.BotSwapFeeHookV4Final = await swapHook.getAddress();
    
    spinner10.succeed(`BotSwapFeeHook deployed at: ${contracts.BotSwapFeeHookV4Final}`);
    deploymentLog.push({ name: "BotSwapFeeHookV4Final", address: contracts.BotSwapFeeHookV4Final });
  } catch (error) {
    spinner10.fail("Failed to deploy Uniswap hook");
    console.error(error);
    process.exit(1);
  }
  
  // ==================== 11. Configuration & Setup ====================
  const spinner11 = ora("Configuring contracts...").start();
  try {
    // Grant roles
    const botToken = await ethers.getContractAt("BOTToken", contracts.BOTToken);
    const treasury = await ethers.getContractAt("Treasury", contracts.Treasury);
    const vaultFactory = await ethers.getContractAt("VaultFactoryMinimal", contracts.VaultFactory);
    const stakingPool = await ethers.getContractAt("StakingPool", contracts.StakingPool);
    const crapsGame = await ethers.getContractAt("CrapsGameV2Plus", contracts.CrapsGameV2Plus);
    const botManager = await ethers.getContractAt("BotManager", contracts.BotManager);
    
    // Grant Treasury role to StakingPool
    await treasury.grantRole(await treasury.DISTRIBUTOR_ROLE(), contracts.StakingPool);
    
    // Set game contract in VaultFactory
    await vaultFactory.setGameContract(contracts.CrapsGameV2Plus);
    await vaultFactory.setBotManager(contracts.BotManager);
    
    // Set contracts in game
    await crapsGame.setBetsContract(contracts.CrapsBets);
    await crapsGame.setSettlementContract(contracts.CrapsSettlement);
    
    // Initialize bot manager
    await botManager.initializeBots();
    
    // Deploy all bot vaults
    await vaultFactory.deployAllBots();
    
    // Fund contracts with initial BOT tokens
    const initialSupply = ethers.parseUnits("1000000", 18); // 1M BOT
    await botToken.transfer(contracts.Treasury, initialSupply / 10n); // 10% to treasury
    await botToken.transfer(contracts.StakingPool, initialSupply / 10n); // 10% to staking
    
    spinner11.succeed("Contracts configured successfully");
  } catch (error) {
    spinner11.fail("Failed to configure contracts");
    console.error(error);
  }
  
  // ==================== 12. Save Deployment Info ====================
  const deploymentInfo = {
    network: "base-sepolia",
    chainId: 84532,
    deployer: deployer.address,
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
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  
  // ==================== Summary ====================
  console.log(chalk.bold.green("\n✅ Deployment Complete!\n"));
  console.log(chalk.bold("📋 Contract Addresses:"));
  
  const table: any[] = [];
  for (const [name, address] of Object.entries(contracts)) {
    table.push([name, address]);
  }
  
  console.table(table);
  
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