#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Script to generate subgraph.yaml from template and network config
 * Usage: node scripts/prepare-subgraph.js <network>
 * Example: node scripts/prepare-subgraph.js base-sepolia
 */

const network = process.argv[2];

if (!network) {
  console.error('Usage: node scripts/prepare-subgraph.js <network>');
  console.error('Available networks: local, base-sepolia, base');
  process.exit(1);
}

const configPath = path.join(__dirname, '..', 'config', `${network}.json`);
const templatePath = path.join(__dirname, '..', 'subgraph.template.yaml');
const outputPath = path.join(__dirname, '..', 'subgraph.yaml');

// Check if config file exists
if (!fs.existsSync(configPath)) {
  console.error(`Config file not found: ${configPath}`);
  console.error('Available networks: local, base-sepolia, base');
  process.exit(1);
}

// Check if template exists
if (!fs.existsSync(templatePath)) {
  console.error(`Template file not found: ${templatePath}`);
  process.exit(1);
}

// Load network configuration
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
console.log(`Loading configuration for network: ${network}`);
console.log(`Network config:`, config);

// Load template
let template = fs.readFileSync(templatePath, 'utf8');

// Replace network name
template = template.replace(/{{network}}/g, config.network);

// Replace contract addresses
const contractReplacements = {
  'BOTToken': config.contracts.BOTToken || '0x0000000000000000000000000000000000000000',
  'CrapsGame': config.contracts.CrapsGame || '0x0000000000000000000000000000000000000000',
  'CrapsBets': config.contracts.CrapsBets || '0x0000000000000000000000000000000000000000',
  'CrapsSettlement': config.contracts.CrapsSettlement || '0x0000000000000000000000000000000000000000',
  'BotManager': config.contracts.BotManager || '0x0000000000000000000000000000000000000000',
  'VaultFactory': config.contracts.VaultFactory || '0x0000000000000000000000000000000000000000',
  'CrapsVault': config.contracts.CrapsVault || '0x0000000000000000000000000000000000000000',
  'StakingPool': config.contracts.StakingPool || '0x0000000000000000000000000000000000000000',
  'Treasury': config.contracts.Treasury || '0x0000000000000000000000000000000000000000',
  'GachaMintPass': config.contracts.GachaMintPass || '0x0000000000000000000000000000000000000000',
  'BotBettingEscrow': config.contracts.BotBettingEscrow || '0x0000000000000000000000000000000000000000',
  'BotSwapFeeHookV4': config.contracts.BotSwapFeeHookV4 || '0x0000000000000000000000000000000000000000'
};

// Replace start blocks
const blockReplacements = {
  'BOTToken': config.startBlocks.BOTToken || 0,
  'CrapsGame': config.startBlocks.CrapsGame || 0,
  'CrapsBets': config.startBlocks.CrapsBets || 0,
  'CrapsSettlement': config.startBlocks.CrapsSettlement || 0,
  'BotManager': config.startBlocks.BotManager || 0,
  'VaultFactory': config.startBlocks.VaultFactory || 0,
  'CrapsVault': config.startBlocks.CrapsVault || 0,
  'StakingPool': config.startBlocks.StakingPool || 0,
  'Treasury': config.startBlocks.Treasury || 0,
  'GachaMintPass': config.startBlocks.GachaMintPass || 0,
  'BotBettingEscrow': config.startBlocks.BotBettingEscrow || 0,
  'BotSwapFeeHookV4': config.startBlocks.BotSwapFeeHookV4 || 0
};

// Apply contract address replacements
for (const [contract, address] of Object.entries(contractReplacements)) {
  const regex = new RegExp(`{{${contract}}}`, 'g');
  template = template.replace(regex, address);
  console.log(`Replaced {{${contract}}} with ${address}`);
}

// Apply start block replacements
for (const [contract, block] of Object.entries(blockReplacements)) {
  const regex = new RegExp(`{{${contract}_startBlock}}`, 'g');
  template = template.replace(regex, block.toString());
  console.log(`Replaced {{${contract}_startBlock}} with ${block}`);
}

// Write the generated subgraph.yaml
fs.writeFileSync(outputPath, template);
console.log(`\n✅ Generated subgraph.yaml for network: ${network}`);
console.log(`📁 Output: ${outputPath}`);

// Verify that all placeholders have been replaced
const remainingPlaceholders = template.match(/{{[^}]+}}/g);
if (remainingPlaceholders) {
  console.warn('\n⚠️  Warning: Some placeholders were not replaced:');
  remainingPlaceholders.forEach(placeholder => {
    console.warn(`   ${placeholder}`);
  });
}

console.log('\n🚀 Ready to deploy! Run:');
console.log(`   graph codegen`);
console.log(`   graph build`);
console.log(`   graph deploy --product hosted-service your-github-username/barely-human-casino`);