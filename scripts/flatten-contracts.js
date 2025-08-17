import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Contracts to flatten
const contracts = [
  'contracts/game/CrapsBets.sol',
  'contracts/game/CrapsSettlementSimple.sol',
  'contracts/token/BOTToken.sol',
  'contracts/treasury/Treasury.sol',
  'contracts/staking/StakingPool.sol',
  'contracts/game/CrapsGame.sol',
];

async function flattenContract(contractPath) {
  const contractName = path.basename(contractPath, '.sol');
  const outputPath = path.join(__dirname, '..', 'flattened', `${contractName}_flattened.sol`);
  
  try {
    // Create flattened directory if it doesn't exist
    const flattenedDir = path.join(__dirname, '..', 'flattened');
    if (!fs.existsSync(flattenedDir)) {
      fs.mkdirSync(flattenedDir, { recursive: true });
    }
    
    // Use hardhat flatten
    const { stdout } = await execAsync(`npx hardhat flatten ${contractPath}`);
    
    // Remove duplicate SPDX license identifiers and pragma statements
    const cleaned = stdout
      .split('\n')
      .filter((line, index, arr) => {
        // Keep first SPDX license
        if (line.includes('// SPDX-License-Identifier:')) {
          return arr.findIndex(l => l.includes('// SPDX-License-Identifier:')) === index;
        }
        // Keep first pragma
        if (line.includes('pragma solidity')) {
          return arr.findIndex(l => l.includes('pragma solidity')) === index;
        }
        return true;
      })
      .join('\n');
    
    fs.writeFileSync(outputPath, cleaned);
    console.log(`✅ Flattened ${contractName} to ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error(`❌ Error flattening ${contractPath}:`, error.message);
    return null;
  }
}

async function flattenAll() {
  console.log('📝 Flattening contracts for verification...\n');
  
  for (const contract of contracts) {
    await flattenContract(contract);
  }
  
  console.log('\n✅ All contracts flattened!');
}

flattenAll().catch(console.error);