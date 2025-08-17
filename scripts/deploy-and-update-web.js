#!/usr/bin/env node

/**
 * Deploy contracts and update web app configuration
 * This script deploys all contracts and updates the web app's environment
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const COLOR = {
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  RESET: '\x1b[0m'
};

function log(message, color = COLOR.RESET) {
  console.log(`${color}${message}${COLOR.RESET}`);
}

function updateWebConfig(contractAddresses) {
  const webEnvPath = path.join(process.cwd(), 'web', '.env.local');
  
  // Read existing env file
  let envContent = '';
  if (fs.existsSync(webEnvPath)) {
    envContent = fs.readFileSync(webEnvPath, 'utf8');
  }
  
  // Update contract addresses
  const addressMappings = {
    'NEXT_PUBLIC_BOT_TOKEN_ADDRESS': contractAddresses.botToken,
    'NEXT_PUBLIC_CRAPS_GAME_ADDRESS': contractAddresses.crapsGame,
    'NEXT_PUBLIC_BOT_MANAGER_ADDRESS': contractAddresses.botManager,
    'NEXT_PUBLIC_VAULT_FACTORY_ADDRESS': contractAddresses.vaultFactory,
    'NEXT_PUBLIC_STAKING_POOL_ADDRESS': contractAddresses.stakingPool,
    'NEXT_PUBLIC_TREASURY_ADDRESS': contractAddresses.treasury,
    'NEXT_PUBLIC_GACHA_MINT_PASS_ADDRESS': contractAddresses.gachaMintPass,
    'NEXT_PUBLIC_BOT_BETTING_ESCROW_ADDRESS': contractAddresses.botBettingEscrow,
  };
  
  // Update each address in the env file
  Object.entries(addressMappings).forEach(([key, value]) => {
    if (value) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      const newLine = `${key}=${value}`;
      
      if (envContent.match(regex)) {
        envContent = envContent.replace(regex, newLine);
      } else {
        envContent += `\n${newLine}`;
      }
    }
  });
  
  // Write updated env file
  fs.writeFileSync(webEnvPath, envContent);
  log(`✅ Updated ${webEnvPath}`, COLOR.GREEN);
}

async function main() {
  try {
    log('🚀 Starting Barely Human deployment and web setup...', COLOR.CYAN);
    
    // Step 1: Compile contracts
    log('\n📦 Compiling contracts...', COLOR.YELLOW);
    execSync('npm run compile', { stdio: 'inherit' });
    
    // Step 2: Start Hardhat node (if not running)
    log('\n🏗️  Checking Hardhat node...', COLOR.YELLOW);
    try {
      execSync('curl -s http://127.0.0.1:8545 > /dev/null');
      log('✅ Hardhat node is running', COLOR.GREEN);
    } catch {
      log('⚠️  Starting Hardhat node...', COLOR.YELLOW);
      execSync('npm run node &', { stdio: 'inherit' });
      // Wait for node to start
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Step 3: Deploy contracts
    log('\n🚀 Deploying contracts to local network...', COLOR.YELLOW);
    const deployOutput = execSync('npm run deploy:local', { encoding: 'utf8' });
    
    // Parse deployment output to extract contract addresses
    // This assumes the deployment script outputs JSON with addresses
    const addressRegex = /"(\w+)": "0x[a-fA-F0-9]{40}"/g;
    const contractAddresses = {};
    let match;
    
    while ((match = addressRegex.exec(deployOutput)) !== null) {
      const [, contractName, address] = match;
      contractAddresses[contractName] = address;
    }
    
    log('📋 Deployed contract addresses:', COLOR.BLUE);
    Object.entries(contractAddresses).forEach(([name, address]) => {
      log(`   ${name}: ${address}`, COLOR.BLUE);
    });
    
    // Step 4: Install web dependencies (if needed)
    const webPackageJsonPath = path.join(process.cwd(), 'web', 'package.json');
    if (fs.existsSync(webPackageJsonPath)) {
      const webNodeModulesPath = path.join(process.cwd(), 'web', 'node_modules');
      if (!fs.existsSync(webNodeModulesPath)) {
        log('\n📦 Installing web dependencies...', COLOR.YELLOW);
        execSync('npm run web:install', { stdio: 'inherit' });
      }
    }
    
    // Step 5: Update web configuration
    log('\n⚙️  Updating web configuration...', COLOR.YELLOW);
    updateWebConfig(contractAddresses);
    
    // Step 6: Deploy escrow contract (optional)
    try {
      log('\n🏦 Deploying escrow contract...', COLOR.YELLOW);
      const escrowOutput = execSync('npm run deploy:escrow', { encoding: 'utf8' });
      
      // Extract escrow address if available
      const escrowMatch = escrowOutput.match(/BotBettingEscrow deployed to: (0x[a-fA-F0-9]{40})/);
      if (escrowMatch) {
        contractAddresses.botBettingEscrow = escrowMatch[1];
        updateWebConfig(contractAddresses);
        log(`✅ Escrow deployed to: ${escrowMatch[1]}`, COLOR.GREEN);
      }
    } catch (error) {
      log('⚠️  Escrow deployment failed (optional)', COLOR.YELLOW);
    }
    
    // Step 7: Build web app
    log('\n🏗️  Building web application...', COLOR.YELLOW);
    execSync('npm run web:build', { stdio: 'inherit' });
    
    log('\n🎉 Deployment complete!', COLOR.GREEN);
    log('\n📋 Next steps:', COLOR.CYAN);
    log('   1. Start the web app: npm run web:dev', COLOR.CYAN);
    log('   2. Start bot orchestrator: npm run bots', COLOR.CYAN);
    log('   3. Open http://localhost:3000 in your browser', COLOR.CYAN);
    log('   4. Connect your wallet and start playing!', COLOR.CYAN);
    
    // Create summary file
    const summaryPath = path.join(process.cwd(), 'deployment-summary.json');
    const summary = {
      timestamp: new Date().toISOString(),
      network: 'hardhat-local',
      chainId: 31337,
      rpcUrl: 'http://127.0.0.1:8545',
      contractAddresses,
      webUrl: 'http://localhost:3000',
      status: 'success'
    };
    
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    log(`\n📄 Deployment summary saved to: ${summaryPath}`, COLOR.BLUE);
    
  } catch (error) {
    log(`\n❌ Deployment failed: ${error.message}`, COLOR.RED);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('\n👋 Deployment interrupted', COLOR.YELLOW);
  process.exit(0);
});

main().catch(console.error);