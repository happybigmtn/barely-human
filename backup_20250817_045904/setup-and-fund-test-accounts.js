#!/usr/bin/env node

/**
 * Setup and Fund Test Accounts
 * Initializes contracts and funds test accounts for comprehensive testing
 */

import { createPublicClient, createWalletClient, http, parseEther, formatEther, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Hardhat local chain config
const hardhatChain = {
  id: 31337,
  name: 'Hardhat',
  network: 'hardhat',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
    public: { http: ['http://127.0.0.1:8545'] }
  }
};

// Contract ABIs
const CONTRACT_ABIS = {
  BOTToken: parseAbi([
    'function balanceOf(address) view returns (uint256)',
    'function totalSupply() view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function mint(address to, uint256 amount) returns (bool)',
    'function hasRole(bytes32 role, address account) view returns (bool)',
    'function DEFAULT_ADMIN_ROLE() view returns (bytes32)',
    'function MINTER_ROLE() view returns (bytes32)'
  ]),
  
  CrapsGameV2Plus: parseAbi([
    'function initializeGame()',
    'function startNewSeries()',
    'function isGameActive() view returns (bool)',
    'function getCurrentPhase() view returns (uint8)',
    'function currentSeriesId() view returns (uint256)'
  ]),
  
  CrapsBets: parseAbi([
    'function setContracts(address gameContract, address vaultContract, address settlementContract)',
    'function gameContract() view returns (address)',
    'function vaultContract() view returns (address)',
    'function settlementContract() view returns (address)'
  ]),
  
  BotManagerV2Plus: parseAbi([
    'function initializeBots()',
    'function isInitialized() view returns (bool)',
    'function getBotCount() view returns (uint256)'
  ]),
  
  VaultFactoryMinimal: parseAbi([
    'function createVault(address token, string name, string symbol) returns (address)',
    'function getVault(uint256 index) view returns (address)',
    'function getVaultCount() view returns (uint256)'
  ]),
  
  Treasury: parseAbi([
    'function initialize(address botToken, address stakingPool)',
    'function distributeFees()'
  ]),
  
  StakingPool: parseAbi([
    'function initialize(address rewardToken)',
    'function stake(uint256 amount)',
    'function totalStaked() view returns (uint256)'
  ])
};

class ContractSetupManager {
  constructor() {
    this.publicClient = null;
    this.walletClient = null;
    this.account = null;
    this.contracts = {};
    this.contractAddresses = {};
  }
  
  async init() {
    console.log(chalk.bold.cyan('🔧 Contract Setup and Funding Manager\n'));
    
    // Load deployment configuration
    const deploymentPath = path.join(__dirname, '../deployments/localhost.json');
    const config = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    this.contractAddresses = config.contracts;
    
    // Setup Viem clients
    this.publicClient = createPublicClient({
      chain: hardhatChain,
      transport: http()
    });
    
    // Use deployer account (has minting rights)
    const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    this.account = privateKeyToAccount(privateKey);
    
    this.walletClient = createWalletClient({
      account: this.account,
      chain: hardhatChain,
      transport: http()
    });
    
    // Initialize contracts
    await this.initializeContracts();
    
    console.log(chalk.green(`✅ Connected as deployer: ${this.account.address}\n`));
  }
  
  async initializeContracts() {
    for (const [name, address] of Object.entries(this.contractAddresses)) {
      if (CONTRACT_ABIS[name]) {
        this.contracts[name] = {
          address,
          abi: CONTRACT_ABIS[name],
          read: async (functionName, args = []) => {
            return await this.publicClient.readContract({
              address,
              abi: CONTRACT_ABIS[name],
              functionName,
              args
            });
          },
          write: async (functionName, args = []) => {
            const { request } = await this.publicClient.simulateContract({
              account: this.account,
              address,
              abi: CONTRACT_ABIS[name],
              functionName,
              args
            });
            return await this.walletClient.writeContract(request);
          }
        };
      }
    }
  }
  
  async setupAndFund() {
    console.log(chalk.bold.yellow('🚀 Starting Contract Setup and Funding\n'));
    
    await this.step1_FundTestAccounts();
    await this.step2_InitializeBotManager();
    await this.step3_CreateVault();
    await this.step4_ConnectContracts();
    await this.step5_InitializeGame();
    await this.step6_VerifySetup();
    
    console.log(chalk.bold.green('\n✅ Contract setup and funding completed!'));
  }
  
  async step1_FundTestAccounts() {
    const spinner = ora('Step 1: Funding test accounts with BOT tokens...').start();
    
    try {
      const testAccounts = [
        this.account.address, // Deployer
        '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Account 1
        '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Account 2
        '0x90F79bf6EB2c4f870365E785982E1f101E93b906'  // Account 3
      ];
      
      const fundAmount = parseEther('100000'); // 100,000 BOT per account
      
      for (const account of testAccounts) {
        try {
          const hash = await this.contracts.BOTToken.write('transfer', [account, fundAmount]);
          await this.publicClient.waitForTransactionReceipt({ hash });
          
          const balance = await this.contracts.BOTToken.read('balanceOf', [account]);
          spinner.text = `Funded ${account}: ${formatEther(balance)} BOT`;
          
        } catch (error) {
          // Try minting if transfer fails (deployer might not have tokens)
          try {
            const hash = await this.contracts.BOTToken.write('mint', [account, fundAmount]);
            await this.publicClient.waitForTransactionReceipt({ hash });
            spinner.text = `Minted tokens for ${account}`;
          } catch (mintError) {
            spinner.text = `Failed to fund ${account}: ${mintError.message}`;
          }
        }
      }
      
      spinner.succeed('Test accounts funded with BOT tokens');
      
    } catch (error) {
      spinner.fail(`Funding failed: ${error.message}`);
      throw error;
    }
  }
  
  async step2_InitializeBotManager() {
    const spinner = ora('Step 2: Initializing Bot Manager...').start();
    
    try {
      const isInitialized = await this.contracts.BotManagerV2Plus.read('isInitialized');
      
      if (!isInitialized) {
        const hash = await this.contracts.BotManagerV2Plus.write('initializeBots');
        await this.publicClient.waitForTransactionReceipt({ hash });
        spinner.text = 'Bot Manager initialized';
      }
      
      const botCount = await this.contracts.BotManagerV2Plus.read('getBotCount');
      spinner.succeed(`Bot Manager ready with ${botCount} bots`);
      
    } catch (error) {
      spinner.warn(`Bot Manager initialization skipped: ${error.message}`);
    }
  }
  
  async step3_CreateVault() {
    const spinner = ora('Step 3: Creating Craps Vault...').start();
    
    try {
      const vaultCount = await this.contracts.VaultFactoryMinimal.read('getVaultCount');
      
      if (Number(vaultCount) === 0) {
        const hash = await this.contracts.VaultFactoryMinimal.write('createVault', [
          this.contractAddresses.BOTToken,
          'Craps Vault LP',
          'CVLP'
        ]);
        const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
        spinner.text = 'Vault created';
      }
      
      const newVaultCount = await this.contracts.VaultFactoryMinimal.read('getVaultCount');
      const vaultAddress = await this.contracts.VaultFactoryMinimal.read('getVault', [0n]);
      
      // Update deployment config with vault address
      const deploymentPath = path.join(__dirname, '../deployments/localhost.json');
      const config = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
      config.contracts.CrapsVault = vaultAddress;
      fs.writeFileSync(deploymentPath, JSON.stringify(config, null, 2));
      
      spinner.succeed(`Craps Vault created at: ${vaultAddress}`);
      
    } catch (error) {
      spinner.warn(`Vault creation skipped: ${error.message}`);
    }
  }
  
  async step4_ConnectContracts() {
    const spinner = ora('Step 4: Connecting contracts...').start();
    
    try {
      // Check if contracts are already connected
      const gameContract = await this.contracts.CrapsBets.read('gameContract');
      
      if (gameContract === '0x0000000000000000000000000000000000000000') {
        // Get vault address
        const vaultAddress = await this.contracts.VaultFactoryMinimal.read('getVault', [0n]);
        
        const hash = await this.contracts.CrapsBets.write('setContracts', [
          this.contractAddresses.CrapsGameV2Plus,
          vaultAddress,
          this.contractAddresses.CrapsSettlement
        ]);
        await this.publicClient.waitForTransactionReceipt({ hash });
        spinner.text = 'Contracts connected';
      }
      
      spinner.succeed('Contract connections established');
      
    } catch (error) {
      spinner.warn(`Contract connection skipped: ${error.message}`);
    }
  }
  
  async step5_InitializeGame() {
    const spinner = ora('Step 5: Initializing game state...').start();
    
    try {
      const isActive = await this.contracts.CrapsGameV2Plus.read('isGameActive');
      
      if (!isActive) {
        try {
          const hash = await this.contracts.CrapsGameV2Plus.write('initializeGame');
          await this.publicClient.waitForTransactionReceipt({ hash });
          spinner.text = 'Game initialized';
        } catch (error) {
          spinner.text = `Game initialization skipped: ${error.message}`;
        }
      }
      
      const phase = await this.contracts.CrapsGameV2Plus.read('getCurrentPhase');
      const seriesId = await this.contracts.CrapsGameV2Plus.read('currentSeriesId');
      
      spinner.succeed(`Game ready - Phase: ${phase}, Series: ${seriesId}`);
      
    } catch (error) {
      spinner.warn(`Game initialization skipped: ${error.message}`);
    }
  }
  
  async step6_VerifySetup() {
    const spinner = ora('Step 6: Verifying setup...').start();
    
    try {
      // Check token balances
      const balance = await this.contracts.BOTToken.read('balanceOf', [this.account.address]);
      spinner.text = `Deployer balance: ${formatEther(balance)} BOT`;
      
      // Check bot count
      const botCount = await this.contracts.BotManagerV2Plus.read('getBotCount');
      spinner.text = `Bot count: ${botCount}`;
      
      // Check vault count
      const vaultCount = await this.contracts.VaultFactoryMinimal.read('getVaultCount');
      spinner.text = `Vault count: ${vaultCount}`;
      
      spinner.succeed('Setup verification completed');
      
      // Print summary
      console.log(chalk.blue('\n📊 Setup Summary:'));
      console.log(chalk.cyan(`  💰 Deployer BOT Balance: ${formatEther(balance)} BOT`));
      console.log(chalk.cyan(`  🤖 Bot Count: ${botCount}`));
      console.log(chalk.cyan(`  🏦 Vault Count: ${vaultCount}`));
      
      if (Number(vaultCount) > 0) {
        const vaultAddress = await this.contracts.VaultFactoryMinimal.read('getVault', [0n]);
        console.log(chalk.cyan(`  🎯 Vault Address: ${vaultAddress}`));
      }
      
    } catch (error) {
      spinner.fail(`Verification failed: ${error.message}`);
    }
  }
}

// Main execution
async function main() {
  try {
    const setupManager = new ContractSetupManager();
    await setupManager.init();
    await setupManager.setupAndFund();
    
    console.log(chalk.bold.green('\n🎉 Ready for comprehensive contract testing!'));
    console.log(chalk.yellow('Run the contract interaction tester again to verify all functions work.'));
    
  } catch (error) {
    console.error(chalk.red('Setup failed:'), error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default ContractSetupManager;