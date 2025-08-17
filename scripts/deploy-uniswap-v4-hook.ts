import { network } from "hardhat";
import { formatEther, parseEther, encodeFunctionData } from "viem";
import fs from "fs";
import path from "path";
import { UNISWAP_V4_BASE_SEPOLIA, FEE_TIERS, TICK_SPACINGS, HOOK_FLAGS } from "../config/uniswap-v4-base-sepolia";

async function main() {
    console.log("🦄 Deploying Uniswap V4 Hook to Base Sepolia...\n");

    // Connect to network
    const connection = await network.connect();
    const { viem } = connection;

    try {
        // Get clients
        const publicClient = await viem.getPublicClient();
        const [deployer] = await viem.getWalletClients();
        
        console.log("📍 Network:", await publicClient.getChainId() === 84532 ? "Base Sepolia" : "Unknown");
        console.log("👤 Deployer:", deployer.account.address);
        
        const balance = await publicClient.getBalance({ address: deployer.account.address });
        console.log("💰 Balance:", formatEther(balance), "ETH\n");

        // Check if we're on Base Sepolia
        const chainId = await publicClient.getChainId();
        if (chainId !== 84532) {
            throw new Error(`Wrong network! Expected Base Sepolia (84532), got ${chainId}`);
        }

        // Load deployed addresses (assumes BOT token and Treasury are already deployed)
        const deploymentPath = path.join(__dirname, "../deployments/base-sepolia.json");
        let deployments: any = {};
        
        if (fs.existsSync(deploymentPath)) {
            deployments = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
        }

        const botTokenAddress = deployments.BOTToken || process.env.BOT_TOKEN_ADDRESS;
        const treasuryAddress = deployments.Treasury || process.env.TREASURY_ADDRESS;

        if (!botTokenAddress || !treasuryAddress) {
            throw new Error("BOT Token and Treasury must be deployed first!");
        }

        console.log("📝 Using contracts:");
        console.log("  BOT Token:", botTokenAddress);
        console.log("  Treasury:", treasuryAddress);
        console.log("  PoolManager:", UNISWAP_V4_BASE_SEPOLIA.PoolManager);
        console.log();

        // Deploy the hook contract
        console.log("🚀 Deploying BotSwapFeeHookV4Updated...");
        
        const hookContract = await viem.deployContract(
            "BotSwapFeeHookV4Updated",
            [
                UNISWAP_V4_BASE_SEPOLIA.PoolManager,
                botTokenAddress,
                treasuryAddress
            ]
        );

        console.log("✅ Hook deployed to:", hookContract.address);
        console.log();

        // Calculate the required hook address pattern
        // For beforeSwap and afterSwap with return delta
        const requiredFlags = 
            HOOK_FLAGS.BEFORE_SWAP | 
            HOOK_FLAGS.AFTER_SWAP | 
            HOOK_FLAGS.BEFORE_SWAP_RETURN_DELTA;

        console.log("🔍 Hook address analysis:");
        console.log("  Address:", hookContract.address);
        console.log("  Required flags:", requiredFlags.toString(16));
        
        // Note: In production, you'd use CREATE2 to deploy at a specific address
        // that has the correct flag bits set
        console.log("  ⚠️  Note: Hook address should be deployed with CREATE2 to ensure correct flags");
        console.log();

        // Create a pool with the hook
        console.log("🏊 Creating BOT/ETH pool with hook...");
        
        const poolKey = {
            currency0: "0x0000000000000000000000000000000000000000", // ETH (native)
            currency1: botTokenAddress,
            fee: FEE_TIERS.MEDIUM, // 0.3%
            tickSpacing: TICK_SPACINGS[FEE_TIERS.MEDIUM],
            hooks: hookContract.address
        };

        console.log("Pool configuration:");
        console.log("  Token0: ETH (native)");
        console.log("  Token1: BOT");
        console.log("  Fee:", FEE_TIERS.MEDIUM / 10000, "%");
        console.log("  Tick Spacing:", poolKey.tickSpacing);
        console.log("  Hook:", poolKey.hooks);
        console.log();

        // Initialize the pool
        const sqrtPriceX96 = BigInt("79228162514264337593543950336"); // 1:1 price
        
        console.log("📊 Initializing pool...");
        
        const initData = encodeFunctionData({
            abi: [{
                name: "initialize",
                type: "function",
                inputs: [
                    {
                        name: "key",
                        type: "tuple",
                        components: [
                            { name: "currency0", type: "address" },
                            { name: "currency1", type: "address" },
                            { name: "fee", type: "uint24" },
                            { name: "tickSpacing", type: "int24" },
                            { name: "hooks", type: "address" }
                        ]
                    },
                    { name: "sqrtPriceX96", type: "uint160" },
                    { name: "hookData", type: "bytes" }
                ]
            }],
            functionName: "initialize",
            args: [poolKey, sqrtPriceX96, "0x"]
        });

        const initTx = await deployer.sendTransaction({
            to: UNISWAP_V4_BASE_SEPOLIA.PoolManager,
            data: initData
        });

        await publicClient.waitForTransactionReceipt({ hash: initTx });
        console.log("✅ Pool initialized!");
        console.log();

        // Enable the pool in the hook
        console.log("🔧 Enabling pool in hook...");
        
        const enableTx = await hookContract.write.setPoolEnabled([poolKey, true]);
        await publicClient.waitForTransactionReceipt({ hash: enableTx });
        
        console.log("✅ Pool enabled for fee collection!");
        console.log();

        // Save deployment info
        const deployment = {
            ...deployments,
            BotSwapFeeHookV4: hookContract.address,
            UniswapV4: {
                PoolManager: UNISWAP_V4_BASE_SEPOLIA.PoolManager,
                UniversalRouter: UNISWAP_V4_BASE_SEPOLIA.UniversalRouter,
                PositionManager: UNISWAP_V4_BASE_SEPOLIA.PositionManager,
                Quoter: UNISWAP_V4_BASE_SEPOLIA.Quoter,
                Permit2: UNISWAP_V4_BASE_SEPOLIA.Permit2,
                BotEthPool: {
                    currency0: poolKey.currency0,
                    currency1: poolKey.currency1,
                    fee: poolKey.fee,
                    tickSpacing: poolKey.tickSpacing,
                    hooks: poolKey.hooks
                }
            },
            timestamp: new Date().toISOString(),
            network: "base-sepolia",
            chainId: 84532
        };

        // Ensure deployments directory exists
        const deploymentsDir = path.dirname(deploymentPath);
        if (!fs.existsSync(deploymentsDir)) {
            fs.mkdirSync(deploymentsDir, { recursive: true });
        }

        fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
        console.log("💾 Deployment info saved to:", deploymentPath);
        console.log();

        // Print summary
        console.log("=" .repeat(60));
        console.log("🎉 DEPLOYMENT COMPLETE!");
        console.log("=" .repeat(60));
        console.log();
        console.log("📋 Summary:");
        console.log("  Hook Address:", hookContract.address);
        console.log("  Pool Manager:", UNISWAP_V4_BASE_SEPOLIA.PoolManager);
        console.log("  BOT/ETH Pool Created:", "✅");
        console.log("  Fee Collection:", "2% on BOT swaps");
        console.log();
        console.log("📝 Next Steps:");
        console.log("  1. Add liquidity using PositionManager");
        console.log("  2. Test swaps through UniversalRouter");
        console.log("  3. Monitor fees collected in Treasury");
        console.log();
        console.log("🔗 View on BaseScan:");
        console.log(`  https://sepolia.basescan.org/address/${hookContract.address}`);
        console.log();

    } catch (error) {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    } finally {
        await connection.close();
    }
}

// Execute deployment
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

export default main;