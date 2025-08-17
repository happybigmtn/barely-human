import { ethers } from "hardhat";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log(chalk.bold.cyan("\n🚀 Deploying Barely Human Casino to Base Sepolia\n"));
  
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  
  console.log(chalk.gray("Deployer address:"), deployer.address);
  console.log(chalk.gray("Deployer balance:"), ethers.formatEther(balance), "ETH");
  console.log(chalk.gray("Network:"), "Base Sepolia (84532)\n");
  
  const contracts = {};
  const deploymentLog = [];
  
  try {
    // ==================== 1. Deploy BOT Token ====================
    console.log(chalk.yellow("Deploying BOT Token..."));
    const BOTToken = await ethers.getContractFactory("BOTToken");
    const botToken = await BOTToken.deploy(
      deployer.address, // treasury (will update)
      deployer.address, // liquidity 
      deployer.address, // stakingRewards (will update)
      deployer.address, // team
      deployer.address  // community
    );
    await botToken.waitForDeployment();
    contracts.BOTToken = await botToken.getAddress();
    console.log(chalk.green(`✅ BOT Token deployed at: ${contracts.BOTToken}`));
    deploymentLog.push({ name: "BOTToken", address: contracts.BOTToken });
    
    // ==================== 2. Deploy Libraries ====================
    console.log(chalk.yellow("Deploying libraries..."));
    
    const VaultFactoryLib = await ethers.getContractFactory("VaultFactoryLib");
    const vaultFactoryLib = await VaultFactoryLib.deploy();
    await vaultFactoryLib.waitForDeployment();
    contracts.VaultFactoryLib = await vaultFactoryLib.getAddress();
    
    const CrapsSettlementLib = await ethers.getContractFactory("CrapsSettlementLib");
    const crapsSettlementLib = await CrapsSettlementLib.deploy();
    await crapsSettlementLib.waitForDeployment();
    contracts.CrapsSettlementLib = await crapsSettlementLib.getAddress();
    
    console.log(chalk.green("✅ Libraries deployed"));
    deploymentLog.push({ name: "VaultFactoryLib", address: contracts.VaultFactoryLib });
    deploymentLog.push({ name: "CrapsSettlementLib", address: contracts.CrapsSettlementLib });
    
    // ==================== 3. Deploy Treasury ====================
    console.log(chalk.yellow("Deploying Treasury..."));
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(
      contracts.BOTToken,
      deployer.address, // development wallet
      deployer.address  // insurance wallet
    );
    await treasury.waitForDeployment();
    contracts.Treasury = await treasury.getAddress();
    console.log(chalk.green(`✅ Treasury deployed at: ${contracts.Treasury}`));
    deploymentLog.push({ name: "Treasury", address: contracts.Treasury });
    
    // ==================== 4. Deploy StakingPool ====================
    console.log(chalk.yellow("Deploying StakingPool..."));
    const StakingPool = await ethers.getContractFactory("StakingPool");
    const stakingPool = await StakingPool.deploy(
      contracts.BOTToken,
      contracts.Treasury
    );
    await stakingPool.waitForDeployment();
    contracts.StakingPool = await stakingPool.getAddress();
    console.log(chalk.green(`✅ StakingPool deployed at: ${contracts.StakingPool}`));
    deploymentLog.push({ name: "StakingPool", address: contracts.StakingPool });
    
    // ==================== 5. Deploy VaultFactory ====================
    console.log(chalk.yellow("Deploying VaultFactory..."));
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
    console.log(chalk.green(`✅ VaultFactory deployed at: ${contracts.VaultFactory}`));
    deploymentLog.push({ name: "VaultFactory", address: contracts.VaultFactory });
    
    // ==================== 6. Deploy Game Contracts ====================
    console.log(chalk.yellow("Deploying game contracts..."));
    
    // Deploy CrapsGameV2Plus with VRF config
    const CrapsGameV2Plus = await ethers.getContractFactory("CrapsGameV2Plus");
    const crapsGame = await CrapsGameV2Plus.deploy(
      process.env.VRF_COORDINATOR_ADDRESS,
      BigInt(process.env.VRF_SUBSCRIPTION_ID),
      process.env.VRF_KEY_HASH,
      200000n
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
    
    console.log(chalk.green("✅ Game contracts deployed"));
    deploymentLog.push({ name: "CrapsGameV2Plus", address: contracts.CrapsGameV2Plus });
    deploymentLog.push({ name: "BotManager", address: contracts.BotManager });
    deploymentLog.push({ name: "CrapsBets", address: contracts.CrapsBets });
    deploymentLog.push({ name: "CrapsSettlement", address: contracts.CrapsSettlement });
    
    // ==================== 7. Deploy NFT Contracts ====================
    console.log(chalk.yellow("Deploying NFT contracts..."));
    
    // Deploy GachaMintPassV2Plus
    const GachaMintPassV2Plus = await ethers.getContractFactory("GachaMintPassV2Plus");
    const mintPass = await GachaMintPassV2Plus.deploy(
      "Barely Human Mint Pass",
      "BHMP",
      process.env.VRF_COORDINATOR_ADDRESS,
      BigInt(process.env.VRF_SUBSCRIPTION_ID),
      process.env.VRF_KEY_HASH,
      200000n
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
    
    console.log(chalk.green("✅ NFT contracts deployed"));
    deploymentLog.push({ name: "GachaMintPassV2Plus", address: contracts.GachaMintPassV2Plus });
    deploymentLog.push({ name: "GenerativeArtNFT", address: contracts.GenerativeArtNFT });
    
    // ==================== 8. Deploy Escrow ====================
    console.log(chalk.yellow("Deploying BotBettingEscrow..."));
    const BotBettingEscrow = await ethers.getContractFactory("BotBettingEscrow");
    const escrow = await BotBettingEscrow.deploy(
      contracts.BOTToken,
      contracts.BotManager,
      contracts.Treasury
    );
    await escrow.waitForDeployment();
    contracts.BotBettingEscrow = await escrow.getAddress();
    console.log(chalk.green(`✅ BotBettingEscrow deployed at: ${contracts.BotBettingEscrow}`));
    deploymentLog.push({ name: "BotBettingEscrow", address: contracts.BotBettingEscrow });
    
    // ==================== 9. Deploy Cross-Chain (LayerZero) ====================
    console.log(chalk.yellow("Deploying cross-chain contracts..."));
    const layerZeroEndpoint = "0x6EDCE65403992e310A62460808c4b910D972f10f"; // Base Sepolia LZ endpoint
    
    const OmniVaultCoordinator = await ethers.getContractFactory("OmniVaultCoordinator");
    const omniCoordinator = await OmniVaultCoordinator.deploy(
      layerZeroEndpoint,
      contracts.VaultFactory,
      contracts.BOTToken
    );
    await omniCoordinator.waitForDeployment();
    contracts.OmniVaultCoordinator = await omniCoordinator.getAddress();
    console.log(chalk.green(`✅ OmniVaultCoordinator deployed at: ${contracts.OmniVaultCoordinator}`));
    deploymentLog.push({ name: "OmniVaultCoordinator", address: contracts.OmniVaultCoordinator });
    
    // ==================== 10. Deploy Uniswap V4 Hook ====================
    console.log(chalk.yellow("Deploying Uniswap V4 hook..."));
    const BotSwapFeeHookV4Final = await ethers.getContractFactory("BotSwapFeeHookV4Final");
    const swapHook = await BotSwapFeeHookV4Final.deploy(
      contracts.Treasury,
      contracts.BOTToken
    );
    await swapHook.waitForDeployment();
    contracts.BotSwapFeeHookV4Final = await swapHook.getAddress();
    console.log(chalk.green(`✅ BotSwapFeeHook deployed at: ${contracts.BotSwapFeeHookV4Final}`));
    deploymentLog.push({ name: "BotSwapFeeHookV4Final", address: contracts.BotSwapFeeHookV4Final });
    
    // ==================== 11. Configuration & Setup ====================
    console.log(chalk.yellow("\nConfiguring contracts..."));
    
    // Grant roles
    const treasuryContract = await ethers.getContractAt("Treasury", contracts.Treasury);
    const DISTRIBUTOR_ROLE = await treasuryContract.DISTRIBUTOR_ROLE();
    await treasuryContract.grantRole(DISTRIBUTOR_ROLE, contracts.StakingPool);
    
    // Set game contract in VaultFactory
    const vaultFactoryContract = await ethers.getContractAt("VaultFactoryMinimal", contracts.VaultFactory);
    await vaultFactoryContract.setGameContract(contracts.CrapsGameV2Plus);
    await vaultFactoryContract.setBotManager(contracts.BotManager);
    
    // Set contracts in game
    const gameContract = await ethers.getContractAt("CrapsGameV2Plus", contracts.CrapsGameV2Plus);
    await gameContract.setBetsContract(contracts.CrapsBets);
    await gameContract.setSettlementContract(contracts.CrapsSettlement);
    
    // Initialize bot manager
    const botManagerContract = await ethers.getContractAt("BotManager", contracts.BotManager);
    await botManagerContract.initializeBots();
    
    // Deploy all bot vaults
    await vaultFactoryContract.deployAllBots();
    
    // Fund contracts with initial BOT tokens
    const tokenContract = await ethers.getContractAt("BOTToken", contracts.BOTToken);
    const initialSupply = ethers.parseUnits("1000000", 18); // 1M BOT
    await tokenContract.transfer(contracts.Treasury, initialSupply / 10n);
    await tokenContract.transfer(contracts.StakingPool, initialSupply / 10n);
    
    console.log(chalk.green("✅ Contracts configured successfully"));
    
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
    
  } catch (error) {
    console.error(chalk.red("Deployment failed:"), error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });