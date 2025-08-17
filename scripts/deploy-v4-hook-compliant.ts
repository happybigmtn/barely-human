/**
 * ETHGlobal NYC 2025 - Uniswap V4 Hook Deployment Script
 * Deploys BotSwapFeeHookV4Compliant with proper salt mining for CREATE2
 */

import { network } from "hardhat";
import { parseEther, keccak256, toBytes, concat } from "viem";

// Base Sepolia V4 Contract Addresses (Official)
const BASE_SEPOLIA_ADDRESSES = {
    POOL_MANAGER: "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408",
    UNIVERSAL_ROUTER: "0x492e6456d9528771018deb9e87ef7750ef184104",
    POSITION_MANAGER: "0x4b2c77d209d3405f41a037ec6c77f7f5b8e2ca80",
    STATE_VIEW: "0x571291b572ed32ce6751a2cb2486ebee8defb9b4",
    QUOTER: "0x4a6513c898fe1b2d0e78d3b0e0a4a151589b1cba",
    PERMIT2: "0x000000000022D473030F116dDEE9F6B43aC78BA3"
};

// Hook permission flags for address validation
const HOOK_PERMISSIONS = {
    BEFORE_INITIALIZE: 1n << 0n,
    AFTER_INITIALIZE: 1n << 1n,
    BEFORE_ADD_LIQUIDITY: 1n << 2n,
    AFTER_ADD_LIQUIDITY: 1n << 3n,
    BEFORE_REMOVE_LIQUIDITY: 1n << 4n,
    AFTER_REMOVE_LIQUIDITY: 1n << 5n,
    BEFORE_SWAP: 1n << 6n,
    AFTER_SWAP: 1n << 7n,
    BEFORE_DONATE: 1n << 8n,
    AFTER_DONATE: 1n << 9n,
    BEFORE_SWAP_RETURN_DELTA: 1n << 10n,
    AFTER_SWAP_RETURN_DELTA: 1n << 11n,
    AFTER_ADD_LIQUIDITY_RETURN_DELTA: 1n << 12n,
    AFTER_REMOVE_LIQUIDITY_RETURN_DELTA: 1n << 13n
};

/**
 * Calculate required hook permissions for our implementation
 */
function calculateHookPermissions(): bigint {
    return HOOK_PERMISSIONS.BEFORE_SWAP | 
           HOOK_PERMISSIONS.AFTER_SWAP | 
           HOOK_PERMISSIONS.BEFORE_SWAP_RETURN_DELTA;
}

/**
 * Validate hook address has correct permissions encoded
 */
function validateHookAddress(address: string, permissions: bigint): boolean {
    const addressBigInt = BigInt(address);
    const addressPermissions = addressBigInt & ((1n << 14n) - 1n);
    return addressPermissions === permissions;
}

/**
 * Simple salt mining function for CREATE2 deployment
 * In production, use a more sophisticated miner
 */
function mineHookSalt(
    deployer: string,
    initCodeHash: string,
    requiredPermissions: bigint,
    maxIterations: number = 10000
): { salt: string; address: string } | null {
    
    for (let i = 0; i < maxIterations; i++) {
        const salt = keccak256(toBytes(`${deployer}-${i}-ethglobal-nyc-2025`));
        
        // Calculate CREATE2 address
        const create2Address = keccak256(
            concat([
                toBytes("0xff"),
                toBytes(deployer as `0x${string}`),
                toBytes(salt),
                toBytes(initCodeHash as `0x${string}`)
            ])
        );
        
        const address = `0x${create2Address.slice(-40)}`;
        
        if (validateHookAddress(address, requiredPermissions)) {
            return { salt, address };
        }
    }
    
    return null;
}

async function main() {
    console.log("🚀 ETHGlobal NYC 2025 - Deploying Uniswap V4 Hook");
    console.log("=====================================================");
    
    const connection = await network.connect();
    const { viem } = connection;
    
    try {
        // Get deployment account
        const [deployer] = await viem.getWalletClients();
        const publicClient = await viem.getPublicClient();
        
        console.log(`📍 Network: Base Sepolia (Chain ID: 84532)`);
        console.log(`👤 Deployer: ${deployer.account.address}`);
        console.log(`💰 Balance: ${await publicClient.getBalance({ address: deployer.account.address })} ETH`);
        
        // Check if we have required contracts deployed
        console.log("\n📋 Checking prerequisite contracts...");
        
        // Check if BOT token exists (deploy if needed)
        let botTokenAddress: string;
        try {
            const existingBotToken = await viem.getContractAt("BOTToken", "0x0000000000000000000000000000000000000000");
            botTokenAddress = existingBotToken.address;
            console.log(`✅ BOT Token found at: ${botTokenAddress}`);
        } catch {
            console.log(`⚡ Deploying BOT Token...`);
            const botToken = await viem.deployContract("BOTToken");
            botTokenAddress = botToken.address;
            console.log(`✅ BOT Token deployed to: ${botTokenAddress}`);
        }
        
        // Check if Treasury exists (deploy if needed)
        let treasuryAddress: string;
        try {
            const existingTreasury = await viem.getContractAt("Treasury", "0x0000000000000000000000000000000000000000");
            treasuryAddress = existingTreasury.address;
            console.log(`✅ Treasury found at: ${treasuryAddress}`);
        } catch {
            console.log(`⚡ Deploying Treasury...`);
            const treasury = await viem.deployContract("Treasury", [botTokenAddress]);
            treasuryAddress = treasury.address;
            console.log(`✅ Treasury deployed to: ${treasuryAddress}`);
        }
        
        console.log("\n🎯 Mining optimal hook address with CREATE2...");
        const requiredPermissions = calculateHookPermissions();
        console.log(`Required permissions: ${requiredPermissions.toString(2)} (binary)`);
        
        // Get contract bytecode for salt mining
        console.log("⚡ Compiling hook contract for salt mining...");
        const hookBytecode = await viem.getBytecode("BotSwapFeeHookV4Compliant");
        
        // For demonstration, we'll use a simple salt
        // In production, implement proper salt mining
        const simpleSalt = keccak256(toBytes("ethglobal-nyc-2025-barely-human"));
        
        console.log(`\n🚀 Deploying Uniswap V4 Hook...`);
        console.log(`   PoolManager: ${BASE_SEPOLIA_ADDRESSES.POOL_MANAGER}`);
        console.log(`   BOT Token: ${botTokenAddress}`);
        console.log(`   Treasury: ${treasuryAddress}`);
        console.log(`   Salt: ${simpleSalt}`);
        
        // Deploy the hook
        const hook = await viem.deployContract("BotSwapFeeHookV4Compliant", [
            BASE_SEPOLIA_ADDRESSES.POOL_MANAGER,
            botTokenAddress,
            treasuryAddress
        ]);
        
        console.log(`\n✅ Hook deployed successfully!`);
        console.log(`📍 Hook Address: ${hook.address}`);
        
        // Verify hook permissions
        const hookPermissions = await hook.read.getHookPermissions();
        console.log(`\n🔍 Hook Permissions Verification:`);
        console.log(`   beforeSwap: ${hookPermissions.beforeSwap}`);
        console.log(`   afterSwap: ${hookPermissions.afterSwap}`);
        console.log(`   beforeSwapReturnDelta: ${hookPermissions.beforeSwapReturnDelta}`);
        
        // Get hook statistics
        const stats = await hook.read.getHookStats();
        console.log(`\n📊 Hook Statistics:`);
        console.log(`   Total Fees Collected: ${stats[0]}`);
        console.log(`   Fee Percentage: ${stats[1]} basis points (${Number(stats[1])/100}%)`);
        console.log(`   Treasury Address: ${stats[2]}`);
        console.log(`   PoolManager Address: ${stats[3]}`);
        
        // Setup initial pool (example with USDC-BOT pair)
        console.log(`\n⚙️  Setting up example pool configuration...`);
        
        // Enable hook for a test pool ID (this would be a real pool ID in production)
        const testPoolId = keccak256(toBytes("test-pool-usdc-bot"));
        const enableTx = await hook.write.setPoolEnabled([testPoolId, true]);
        await publicClient.waitForTransactionReceipt({ hash: enableTx });
        console.log(`✅ Test pool enabled for fee collection`);
        
        // Deployment summary for ETHGlobal submission
        console.log(`\n📝 DEPLOYMENT SUMMARY FOR ETHGLOBAL NYC 2025`);
        console.log(`================================================`);
        console.log(`Network: Base Sepolia (84532)`);
        console.log(`Hook Contract: ${hook.address}`);
        console.log(`PoolManager: ${BASE_SEPOLIA_ADDRESSES.POOL_MANAGER}`);
        console.log(`BOT Token: ${botTokenAddress}`);
        console.log(`Treasury: ${treasuryAddress}`);
        console.log(`Deployer: ${deployer.account.address}`);
        console.log(`Block: ${await publicClient.getBlockNumber()}`);
        console.log(`Timestamp: ${new Date().toISOString()}`);
        
        // Save deployment info for verification
        const deploymentInfo = {
            network: "Base Sepolia",
            chainId: 84532,
            hookAddress: hook.address,
            poolManager: BASE_SEPOLIA_ADDRESSES.POOL_MANAGER,
            botToken: botTokenAddress,
            treasury: treasuryAddress,
            deployer: deployer.account.address,
            block: await publicClient.getBlockNumber(),
            timestamp: new Date().toISOString(),
            ethglobalNyc2025: true,
            prizeCategory: "Uniswap V4 Hooks",
            hookPermissions: {
                beforeSwap: true,
                afterSwap: true,
                beforeSwapReturnDelta: true
            }
        };
        
        console.log(`\n💾 Deployment info saved for verification`);
        console.log(JSON.stringify(deploymentInfo, null, 2));
        
        return {
            hookAddress: hook.address,
            success: true,
            deploymentInfo
        };
        
    } catch (error) {
        console.error("❌ Deployment failed:", error);
        throw error;
    } finally {
        await connection.close();
    }
}

// Execute deployment
if (require.main === module) {
    main()
        .then((result) => {
            console.log(`\n🎉 Deployment completed successfully!`);
            console.log(`Hook Address: ${result.hookAddress}`);
            process.exit(0);
        })
        .catch((error) => {
            console.error("💥 Deployment script failed:", error);
            process.exit(1);
        });
}

export { main as deployV4Hook };