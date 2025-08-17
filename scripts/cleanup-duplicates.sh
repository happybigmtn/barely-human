#!/bin/bash

# Cleanup Script for Barely Human Repository
# Removes duplicate contracts and scripts to maintain single source of truth

echo "🧹 Starting repository cleanup..."
echo "This will remove duplicate and legacy files."
echo ""

# Create backup directory
BACKUP_DIR="backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "📦 Creating backup in $BACKUP_DIR/"

# === CONTRACTS TO KEEP ===
# BOTToken.sol (original, not V2)
# Treasury.sol (original, not V2 or Optimized)
# BotManagerV2Plus.sol (latest version in use)
# CrapsGameV2Plus.sol (latest version in use)
# BettingVault.sol (new direct vault, no factory needed)
# CrapsVault.sol (keep as reference implementation)

# === CONTRACTS TO REMOVE ===
echo ""
echo "🗑️  Removing duplicate contracts..."

# Remove legacy vault contracts
contracts_to_remove=(
    "contracts/vault/VaultFactoryMinimal.sol"  # We use BettingVault directly
    "contracts/vault/VaultFactoryUltraOptimized.sol"  # Legacy optimization
    "contracts/vault/StablecoinVaultFactory.sol"  # Not needed
    "contracts/vault/USDCBotVault.sol"  # Not using USDC
    
    # Remove legacy game contracts
    "contracts/game/BotManager.sol"  # Using BotManagerV2Plus
    "contracts/game/BotManagerOptimized.sol"  # Legacy optimization
    "contracts/game/BotManagerUnified.sol"  # Legacy attempt
    "contracts/game/CrapsGame.sol"  # Using CrapsGameV2Plus
    "contracts/game/CrapsSettlementSimple.sol"  # Using full CrapsSettlement
    "contracts/game/CrapsBatchOperations.sol"  # Not needed
    
    # Remove duplicate token/treasury
    "contracts/token/BOTTokenV2.sol"  # Using original BOTToken
    "contracts/treasury/TreasuryV2.sol"  # Using original Treasury
    "contracts/treasury/TreasuryOptimized.sol"  # Legacy optimization
    
    # Remove unused NFT contract
    "contracts/nft/GachaMintPassV2Plus.sol"  # Keep original GachaMintPass if exists
)

for file in "${contracts_to_remove[@]}"; do
    if [ -f "$file" ]; then
        cp "$file" "$BACKUP_DIR/" 2>/dev/null
        rm "$file"
        echo "  ✓ Removed $file"
    fi
done

# === SCRIPTS TO REMOVE ===
echo ""
echo "🗑️  Removing temporary and test scripts..."

scripts_to_remove=(
    # Remove all test/setup scripts (keep only main deployment)
    "scripts/complete-contract-setup.js"
    "scripts/complete-setup-final.js"
    "scripts/simple-contract-fix.js"
    "scripts/setup-and-fund-test-accounts.js"
    "scripts/test-100-percent.js"
    
    # Remove temporary deployment scripts
    "scripts/deploy-local-simple.ts"
    "scripts/deploy-simple-local.ts"
    "scripts/deploy-with-rebate-system.ts"
    "scripts/redeploy-with-vault.js"
    
    # Remove test runners (keep main test suite)
    "scripts/comprehensive-test-runner.cjs"
    "scripts/run-200-tests.ts"
    "scripts/run-all-tests.ts"
    "scripts/run-all-viem-tests.ts"
    "scripts/run-optimized-tests.ts"
    "scripts/test-runner.ts"
    "scripts/debug-token-test.ts"
    "scripts/test-deployed-contracts.ts"
    "scripts/test-gas-usage.ts"
    "scripts/convert-tests-to-viem.ts"
    "scripts/test-cli-complete.sh"
)

for file in "${scripts_to_remove[@]}"; do
    if [ -f "$file" ]; then
        cp "$file" "$BACKUP_DIR/" 2>/dev/null
        rm "$file"
        echo "  ✓ Removed $file"
    fi
done

# === FRONTEND/CLI CLEANUP ===
echo ""
echo "🗑️  Removing duplicate CLI scripts..."

cli_to_remove=(
    "frontend/cli/final-working-test.js"
    "frontend/cli/maximum-functionality-test.js"
    "frontend/cli/contract-interaction-tester.js"
)

for file in "${cli_to_remove[@]}"; do
    if [ -f "$file" ]; then
        cp "$file" "$BACKUP_DIR/" 2>/dev/null
        rm "$file"
        echo "  ✓ Removed $file"
    fi
done

# === REMOVE TEMP DIRECTORY IF EXISTS ===
if [ -d "temp" ]; then
    echo ""
    echo "🗑️  Removing temp directory..."
    cp -r "temp" "$BACKUP_DIR/" 2>/dev/null
    rm -rf "temp"
    echo "  ✓ Removed temp directory"
fi

# === UPDATE MAIN DEPLOYMENT SCRIPT ===
echo ""
echo "📝 Updating main deployment script to use BettingVault..."

# Create updated deployment script
cat > scripts/deploy-main.ts << 'EOF'
import { network } from "hardhat";
import { parseEther, formatEther } from "viem";
import fs from 'fs';

async function main() {
    console.log("🎲 Deploying Barely Human DeFi Casino System...\n");
    
    // Connect to network using Hardhat 3.0 pattern
    const connection = await network.connect();
    const { viem } = connection;
    
    const publicClient = await viem.getPublicClient();
    const [deployer, treasury, liquidity, staking, team, community] = await viem.getWalletClients();
    
    console.log("Deployer address:", deployer.account.address);
    
    try {
        // Core Contracts
        const botToken = await viem.deployContract("BOTToken", [
            treasury.account.address,
            liquidity.account.address,
            staking.account.address,
            team.account.address,
            community.account.address
        ]);
        console.log("✅ BOT Token:", botToken.address);
        
        const mockVRF = await viem.deployContract("MockVRFCoordinatorV2Plus");
        console.log("✅ Mock VRF:", mockVRF.address);
        
        const treasuryContract = await viem.deployContract("Treasury", [
            botToken.address,
            deployer.account.address,
            deployer.account.address
        ]);
        console.log("✅ Treasury:", treasuryContract.address);
        
        const stakingPool = await viem.deployContract("StakingPool", [
            botToken.address,
            botToken.address,
            treasuryContract.address
        ]);
        console.log("✅ StakingPool:", stakingPool.address);
        
        // Game Contracts (V2Plus versions)
        const crapsGame = await viem.deployContract("CrapsGameV2Plus", [
            mockVRF.address,
            1n, // subscriptionId
            "0x0000000000000000000000000000000000000000000000000000000000000001" // keyHash
        ]);
        console.log("✅ CrapsGameV2Plus:", crapsGame.address);
        
        const crapsBets = await viem.deployContract("CrapsBets", [
            botToken.address,
            parseEther("1"),    // minBet
            parseEther("10000") // maxBet
        ]);
        console.log("✅ CrapsBets:", crapsBets.address);
        
        const crapsSettlement = await viem.deployContract("CrapsSettlement");
        console.log("✅ CrapsSettlement:", crapsSettlement.address);
        
        const botManager = await viem.deployContract("BotManagerV2Plus", [
            mockVRF.address,
            1n, // subscriptionId
            "0x0000000000000000000000000000000000000000000000000000000000000001", // keyHash
            crapsGame.address,
            crapsBets.address,
            treasuryContract.address
        ]);
        console.log("✅ BotManagerV2Plus:", botManager.address);
        
        // Deploy BettingVault (no factory needed!)
        const bettingVault = await viem.deployContract("BettingVault", [
            botToken.address,
            treasuryContract.address
        ]);
        console.log("✅ BettingVault:", bettingVault.address);
        
        // Configure connections
        await crapsBets.write.setContracts([
            crapsGame.address,
            bettingVault.address,
            crapsSettlement.address
        ]);
        
        await crapsSettlement.write.setContracts([
            crapsGame.address,
            crapsBets.address,
            treasuryContract.address
        ]);
        
        await bettingVault.write.grantBetsRole([crapsBets.address]);
        await bettingVault.write.grantGameRole([crapsGame.address]);
        
        await botManager.write.initializeBots();
        
        console.log("\n✅ Deployment complete!");
        
        // Save deployment info
        const deployment = {
            network: network.name,
            timestamp: new Date().toISOString(),
            contracts: {
                BOTToken: botToken.address,
                MockVRFV2Plus: mockVRF.address,
                Treasury: treasuryContract.address,
                StakingPool: stakingPool.address,
                CrapsGameV2Plus: crapsGame.address,
                CrapsBets: crapsBets.address,
                CrapsSettlement: crapsSettlement.address,
                BotManagerV2Plus: botManager.address,
                BettingVault: bettingVault.address
            }
        };
        
        fs.writeFileSync(
            `deployments/${network.name}.json`,
            JSON.stringify(deployment, null, 2)
        );
        
    } finally {
        await connection.close();
    }
}

main().catch(console.error);
EOF

echo "  ✓ Created streamlined deployment script"

# === SUMMARY ===
echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📊 Summary:"
echo "  • Removed duplicate vault contracts (keeping BettingVault.sol)"
echo "  • Removed legacy game contracts (keeping V2Plus versions)"
echo "  • Removed temporary test scripts"
echo "  • Removed duplicate token/treasury contracts"
echo "  • Created streamlined deployment script"
echo ""
echo "📦 Backup created in: $BACKUP_DIR/"
echo ""
echo "🎯 Final structure:"
echo "  • BettingVault.sol - Direct vault deployment (no factory)"
echo "  • BotManagerV2Plus.sol - Latest bot manager"
echo "  • CrapsGameV2Plus.sol - Latest game logic"
echo "  • Single deployment script: deploy-main.ts"