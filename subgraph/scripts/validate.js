#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Validation script for The Graph subgraph configuration
 * Checks for common issues before deployment
 */

console.log('🔍 Validating Barely Human Casino Subgraph...\n');

let hasErrors = false;
let hasWarnings = false;

function error(message) {
  console.error(`❌ ERROR: ${message}`);
  hasErrors = true;
}

function warning(message) {
  console.warn(`⚠️  WARNING: ${message}`);
  hasWarnings = true;
}

function success(message) {
  console.log(`✅ ${message}`);
}

// Check required files exist
const requiredFiles = [
  'schema.graphql',
  'subgraph.template.yaml',
  'package.json',
  'src/utils/helpers.ts'
];

const requiredDirs = [
  'src/mappings',
  'abis',
  'config'
];

console.log('📁 Checking file structure...');
for (const file of requiredFiles) {
  if (fs.existsSync(file)) {
    success(`Found ${file}`);
  } else {
    error(`Missing required file: ${file}`);
  }
}

for (const dir of requiredDirs) {
  if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
    success(`Found directory ${dir}`);
  } else {
    error(`Missing required directory: ${dir}`);
  }
}

// Check mapping files
console.log('\n📝 Checking mapping files...');
const expectedMappings = [
  'crapsGame.ts',
  'crapsBets.ts', 
  'crapsSettlement.ts',
  'botManager.ts',
  'vaultFactory.ts',
  'crapsVault.ts',
  'stakingPool.ts',
  'treasury.ts',
  'gachaMintPass.ts',
  'botBettingEscrow.ts',
  'botSwapFeeHookV4.ts',
  'botToken.ts'
];

for (const mapping of expectedMappings) {
  const mappingPath = path.join('src/mappings', mapping);
  if (fs.existsSync(mappingPath)) {
    success(`Found mapping ${mapping}`);
  } else {
    error(`Missing mapping file: ${mapping}`);
  }
}

// Check ABI files
console.log('\n📋 Checking ABI files...');
const expectedABIs = [
  'BOTToken.json',
  'CrapsGame.json',
  'CrapsBets.json',
  'CrapsSettlement.json',
  'BotManager.json',
  'VaultFactory.json',
  'CrapsVault.json',
  'StakingPool.json',
  'Treasury.json',
  'GachaMintPass.json',
  'BotBettingEscrow.json',
  'BotSwapFeeHookV4.json'
];

for (const abi of expectedABIs) {
  const abiPath = path.join('abis', abi);
  if (fs.existsSync(abiPath)) {
    success(`Found ABI ${abi}`);
    
    // Validate ABI is valid JSON
    try {
      const abiContent = fs.readFileSync(abiPath, 'utf8');
      JSON.parse(abiContent);
      success(`ABI ${abi} is valid JSON`);
    } catch (e) {
      error(`ABI ${abi} is not valid JSON: ${e.message}`);
    }
  } else {
    error(`Missing ABI file: ${abi}`);
  }
}

// Check config files
console.log('\n⚙️  Checking config files...');
const configFiles = ['local.json', 'base-sepolia.json', 'base.json'];

for (const configFile of configFiles) {
  const configPath = path.join('config', configFile);
  if (fs.existsSync(configPath)) {
    success(`Found config ${configFile}`);
    
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      // Check required config fields
      if (!config.network) {
        warning(`Config ${configFile} missing 'network' field`);
      }
      
      if (!config.contracts) {
        warning(`Config ${configFile} missing 'contracts' field`);
      } else {
        // Check if all expected contracts are present
        for (const abi of expectedABIs) {
          const contractName = abi.replace('.json', '');
          if (!config.contracts[contractName]) {
            warning(`Config ${configFile} missing contract address for ${contractName}`);
          } else if (config.contracts[contractName] === '0x0000000000000000000000000000000000000000') {
            warning(`Config ${configFile} has zero address for ${contractName}`);
          }
        }
      }
      
      if (!config.startBlocks) {
        warning(`Config ${configFile} missing 'startBlocks' field`);
      }
      
    } catch (e) {
      error(`Config ${configFile} is not valid JSON: ${e.message}`);
    }
  } else {
    warning(`Missing config file: ${configFile}`);
  }
}

// Check package.json
console.log('\n📦 Checking package.json...');
if (fs.existsSync('package.json')) {
  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    // Check required scripts
    const requiredScripts = ['codegen', 'build', 'deploy:local', 'deploy:base-sepolia', 'deploy:base'];
    for (const script of requiredScripts) {
      if (pkg.scripts && pkg.scripts[script]) {
        success(`Found script: ${script}`);
      } else {
        warning(`Missing package.json script: ${script}`);
      }
    }
    
    // Check dependencies
    const requiredDeps = ['@graphprotocol/graph-cli', '@graphprotocol/graph-ts'];
    for (const dep of requiredDeps) {
      if ((pkg.dependencies && pkg.dependencies[dep]) || (pkg.devDependencies && pkg.devDependencies[dep])) {
        success(`Found dependency: ${dep}`);
      } else {
        warning(`Missing dependency: ${dep}`);
      }
    }
    
  } catch (e) {
    error(`package.json is not valid JSON: ${e.message}`);
  }
}

// Check schema.graphql
console.log('\n📊 Checking GraphQL schema...');
if (fs.existsSync('schema.graphql')) {
  const schemaContent = fs.readFileSync('schema.graphql', 'utf8');
  
  // Check for required entities
  const requiredEntities = [
    'Protocol',
    'User', 
    'Bot',
    'GameSeries',
    'DiceRoll',
    'Bet',
    'Vault',
    'LPPosition',
    'StakingPool',
    'StakingPosition',
    'Treasury',
    'DailyMetric',
    'HourlyMetric'
  ];
  
  for (const entity of requiredEntities) {
    if (schemaContent.includes(`type ${entity}`)) {
      success(`Found entity: ${entity}`);
    } else {
      warning(`Missing entity in schema: ${entity}`);
    }
  }
  
  // Check for ID fields
  const entityMatches = schemaContent.match(/type\s+(\w+)\s*@entity/g);
  if (entityMatches) {
    for (const match of entityMatches) {
      const entityName = match.match(/type\s+(\w+)/)[1];
      const entityBlock = schemaContent.split(`type ${entityName}`)[1]?.split('type ')[0];
      if (entityBlock && !entityBlock.includes('id: ')) {
        warning(`Entity ${entityName} might be missing ID field`);
      }
    }
  }
  
} else {
  error('schema.graphql file not found');
}

// Check template
console.log('\n📝 Checking subgraph template...');
if (fs.existsSync('subgraph.template.yaml')) {
  const templateContent = fs.readFileSync('subgraph.template.yaml', 'utf8');
  
  // Check for placeholders
  const placeholders = templateContent.match(/{{[^}]+}}/g);
  if (placeholders) {
    success(`Found ${placeholders.length} placeholders in template`);
    
    // Check for common placeholders
    const expectedPlaceholders = ['{{network}}', '{{BOTToken}}', '{{CrapsGame}}'];
    for (const placeholder of expectedPlaceholders) {
      if (templateContent.includes(placeholder)) {
        success(`Found expected placeholder: ${placeholder}`);
      } else {
        warning(`Missing expected placeholder: ${placeholder}`);
      }
    }
  } else {
    warning('No placeholders found in template - is this intentional?');
  }
  
  // Check for required sections
  const requiredSections = ['specVersion:', 'schema:', 'dataSources:'];
  for (const section of requiredSections) {
    if (templateContent.includes(section)) {
      success(`Found section: ${section}`);
    } else {
      error(`Missing required section: ${section}`);
    }
  }
} else {
  error('subgraph.template.yaml file not found');
}

// Summary
console.log('\n📊 Validation Summary');
console.log('===================');

if (hasErrors) {
  console.error(`❌ Found ${hasErrors} error(s) - fix these before deploying`);
}

if (hasWarnings) {
  console.warn(`⚠️  Found ${hasWarnings} warning(s) - review these issues`);
}

if (!hasErrors && !hasWarnings) {
  console.log('🎉 All checks passed! Subgraph is ready for deployment.');
} else if (!hasErrors) {
  console.log('✅ No critical errors found. Warnings should be reviewed but deployment can proceed.');
}

console.log('\n🚀 Next steps:');
console.log('1. Update config files with actual contract addresses');
console.log('2. Copy ABIs from your contracts build directory');
console.log('3. Run: npm run codegen && npm run build');
console.log('4. Deploy with: ./scripts/deploy.sh <network>');

process.exit(hasErrors ? 1 : 0);