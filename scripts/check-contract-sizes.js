import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    const artifactsPath = path.join(__dirname, '..', 'artifacts', 'contracts');
    
    const contracts = [
        'game/CrapsSettlement.sol/CrapsSettlement.json',
        'game/CrapsGame.sol/CrapsGame.json',
        'game/CrapsBets.sol/CrapsBets.json',
        'game/BotManager.sol/BotManager.json',
        'vault/VaultFactoryOptimized.sol/VaultFactoryOptimized.json',
        'token/BOTToken.sol/BOTToken.json',
        'staking/StakingPool.sol/StakingPool.json',
        'treasury/Treasury.sol/Treasury.json'
    ];
    
    console.log('Contract Sizes (24,576 byte limit for mainnet):\n');
    console.log('Contract'.padEnd(30) + 'Size (bytes)'.padEnd(15) + 'Status');
    console.log('-'.repeat(60));
    
    for (const contractPath of contracts) {
        try {
            const fullPath = path.join(artifactsPath, contractPath);
            const artifact = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
            const bytecode = artifact.deployedBytecode;
            const sizeInBytes = bytecode.length / 2 - 1; // Each byte is 2 hex chars, minus 0x
            const status = sizeInBytes > 24576 ? '❌ Too Large' : '✅ OK';
            const contractName = contractPath.split('/').pop().replace('.json', '');
            
            console.log(
                contractName.padEnd(30) +
                sizeInBytes.toFixed(0).padEnd(15) +
                status
            );
        } catch (e) {
            // Contract might not exist
        }
    }
}

main().catch(console.error);