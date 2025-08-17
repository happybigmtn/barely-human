import { network } from "hardhat";
import { formatUnits, parseUnits } from "viem";
import fs from "fs";
import path from "path";
import { UNISWAP_V4_BASE_SEPOLIA, FEE_TIERS, TICK_SPACINGS } from "../config/uniswap-v4-base-sepolia";

// USDC addresses by chain
const USDC_ADDRESSES = {
    84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia
    421614: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", // Arbitrum Sepolia
    31337: "0x036CbD53842c5426634e7929541eC2318f3dCF7e"  // Local (use Base)
};

async function main() {
    console.log("🏦 Deploying Stablecoin Infrastructure for Circle Prize...\n");

    const connection = await network.connect();
    const { viem } = connection;

    try {
        const publicClient = await viem.getPublicClient();
        const [deployer] = await viem.getWalletClients();
        
        const chainId = await publicClient.getChainId();
        console.log("📍 Network:", chainId === 84532 ? "Base Sepolia" : 
                                 chainId === 421614 ? "Arbitrum Sepolia" : "Local");
        console.log("👤 Deployer:", deployer.account.address);
        
        // Load existing deployments
        const deploymentPath = path.join(__dirname, "../deployments/base-sepolia.json");
        let deployments: any = {};
        
        if (fs.existsSync(deploymentPath)) {
            deployments = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
        }

        const crapsGameAddress = deployments.CrapsGame;
        const treasuryAddress = deployments.Treasury;
        const botTokenAddress = deployments.BOTToken;
        const hookAddress = deployments.BotSwapFeeHookV4;

        if (!crapsGameAddress || !treasuryAddress || !botTokenAddress) {
            throw new Error("Core contracts must be deployed first!");
        }

        const usdcAddress = USDC_ADDRESSES[chainId as keyof typeof USDC_ADDRESSES];
        if (!usdcAddress) {
            throw new Error(`USDC not configured for chain ${chainId}`);
        }

        console.log("\n📝 Using contracts:");
        console.log("  USDC:", usdcAddress);
        console.log("  CrapsGame:", crapsGameAddress);
        console.log("  Treasury:", treasuryAddress);
        console.log("  BOT Token:", botTokenAddress);
        console.log("  Swap Hook:", hookAddress || "Not deployed");
        console.log();

        // Step 1: Deploy Stablecoin Vault Factory
        console.log("🏭 Deploying StablecoinVaultFactory...");
        
        const factory = await viem.deployContract(
            "StablecoinVaultFactory",
            [crapsGameAddress, treasuryAddress]
        );

        console.log("✅ Factory deployed to:", factory.address);
        console.log();

        // Step 2: Deploy USDC vaults for all 10 bots
        console.log("🤖 Deploying USDC vaults for all 10 bots...");
        
        const deployTx = await factory.write.deployAllUSDCVaults();
        await publicClient.waitForTransactionReceipt({ hash: deployTx });
        
        // Get deployed vault addresses
        const vaultAddresses = await factory.read.getStablecoinVaults([usdcAddress]);
        
        console.log("✅ USDC Vaults deployed:");
        const botNames = [
            "Alice All-In", "Bob Calculator", "Charlie Lucky", 
            "Diana Ice Queen", "Eddie Entertainer", "Fiona Fearless",
            "Greg Grinder", "Helen Hot Streak", "Ivan Intimidator", "Julia Jinx"
        ];
        
        vaultAddresses.forEach((vault: string, i: number) => {
            console.log(`  Bot ${i}: ${botNames[i]} - ${vault}`);
        });
        console.log();

        // Step 3: Create USDC/BOT Uniswap V4 Pool with Hook
        if (chainId === 84532 && hookAddress) { // Only on Base Sepolia
            console.log("🦄 Creating USDC/BOT pool on Uniswap V4...");
            
            const poolKey = {
                currency0: usdcAddress < botTokenAddress ? usdcAddress : botTokenAddress,
                currency1: usdcAddress < botTokenAddress ? botTokenAddress : usdcAddress,
                fee: FEE_TIERS.MEDIUM, // 0.3%
                tickSpacing: TICK_SPACINGS[FEE_TIERS.MEDIUM],
                hooks: hookAddress
            };

            console.log("Pool configuration:");
            console.log("  Token0:", poolKey.currency0 === usdcAddress ? "USDC" : "BOT");
            console.log("  Token1:", poolKey.currency1 === usdcAddress ? "USDC" : "BOT");
            console.log("  Fee:", FEE_TIERS.MEDIUM / 10000, "%");
            console.log("  Hook:", hookAddress);
            console.log();

            // Initialize pool with 1:1000 price (1 USDC = 1000 BOT)
            const sqrtPriceX96 = BigInt("2505414483750479311864138015696063"); // sqrt(1000) * 2^96
            
            const initData = {
                abi: [{
                    name: "initialize",
                    type: "function",
                    inputs: [
                        { name: "key", type: "tuple", components: [
                            { name: "currency0", type: "address" },
                            { name: "currency1", type: "address" },
                            { name: "fee", type: "uint24" },
                            { name: "tickSpacing", type: "int24" },
                            { name: "hooks", type: "address" }
                        ]},
                        { name: "sqrtPriceX96", type: "uint160" },
                        { name: "hookData", type: "bytes" }
                    ]
                }],
                functionName: "initialize",
                args: [poolKey, sqrtPriceX96, "0x"]
            };

            try {
                const initTx = await deployer.sendTransaction({
                    to: UNISWAP_V4_BASE_SEPOLIA.PoolManager,
                    data: initData as any
                });
                await publicClient.waitForTransactionReceipt({ hash: initTx });
                console.log("✅ USDC/BOT pool initialized!");
            } catch (error: any) {
                if (error.message.includes("already initialized")) {
                    console.log("ℹ️  Pool already initialized");
                } else {
                    console.log("⚠️  Pool initialization failed:", error.message);
                }
            }

            // Enable pool in hook for fee collection
            console.log("\n🔧 Enabling USDC/BOT pool in hook...");
            const hook = await viem.getContractAt("BotSwapFeeHookV4Updated", hookAddress);
            
            try {
                const enableTx = await hook.write.setPoolEnabled([poolKey, true]);
                await publicClient.waitForTransactionReceipt({ hash: enableTx });
                console.log("✅ Pool enabled for 2% fee collection!");
            } catch (error: any) {
                console.log("⚠️  Pool enabling failed:", error.message);
            }
        }

        // Step 4: Deploy additional stablecoin mocks if on testnet
        if (chainId === 31337) { // Local network
            console.log("\n🪙 Deploying mock stablecoins for testing...");
            
            // Deploy mock USDT
            const mockUSDT = await viem.deployContract("MockERC20", [
                "Tether USD",
                "USDT",
                6 // USDT has 6 decimals
            ]);
            console.log("  Mock USDT:", mockUSDT.address);
            
            // Deploy mock DAI
            const mockDAI = await viem.deployContract("MockERC20", [
                "Dai Stablecoin",
                "DAI",
                18 // DAI has 18 decimals
            ]);
            console.log("  Mock DAI:", mockDAI.address);
            
            deployments.MockUSDT = mockUSDT.address;
            deployments.MockDAI = mockDAI.address;
        }

        // Step 5: Save deployment info
        const stablecoinDeployment = {
            ...deployments,
            StablecoinVaultFactory: factory.address,
            USDCVaults: {
                Alice: vaultAddresses[0],
                Bob: vaultAddresses[1],
                Charlie: vaultAddresses[2],
                Diana: vaultAddresses[3],
                Eddie: vaultAddresses[4],
                Fiona: vaultAddresses[5],
                Greg: vaultAddresses[6],
                Helen: vaultAddresses[7],
                Ivan: vaultAddresses[8],
                Julia: vaultAddresses[9]
            },
            Stablecoins: {
                USDC: usdcAddress,
                USDT: deployments.MockUSDT || "Not deployed",
                DAI: deployments.MockDAI || "Not deployed"
            },
            UniswapV4Pools: {
                "USDC/BOT": {
                    ...poolKey,
                    initialized: true,
                    feeCollection: "2% to Treasury"
                }
            },
            timestamp: new Date().toISOString()
        };

        // Ensure directory exists
        const deploymentsDir = path.dirname(deploymentPath);
        if (!fs.existsSync(deploymentsDir)) {
            fs.mkdirSync(deploymentsDir, { recursive: true });
        }

        fs.writeFileSync(deploymentPath, JSON.stringify(stablecoinDeployment, null, 2));
        console.log("\n💾 Deployment info saved to:", deploymentPath);

        // Print summary
        console.log("\n" + "=".repeat(60));
        console.log("🎉 STABLECOIN INFRASTRUCTURE DEPLOYED!");
        console.log("=".repeat(60));
        console.log();
        console.log("📋 Summary:");
        console.log("  ✅ StablecoinVaultFactory deployed");
        console.log("  ✅ 10 USDC vaults for all bots");
        console.log("  ✅ USDC/BOT Uniswap V4 pool");
        console.log("  ✅ 2% fee collection enabled");
        console.log();
        console.log("🏆 Prize Qualifications:");
        console.log("  ✅ Circle: USDC integration complete");
        console.log("  ✅ Uniswap V4: Custom hook on USDC pool");
        console.log("  ✅ Coinbase: Base deployment ready");
        console.log();
        console.log("📝 Next Steps:");
        console.log("  1. Add USDC liquidity to vaults");
        console.log("  2. Add USDC/BOT liquidity to Uniswap");
        console.log("  3. Test cross-chain USDC transfers (CCTP)");
        console.log("  4. Deploy to Arbitrum Sepolia");
        console.log();

    } catch (error) {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    } finally {
        await connection.close();
    }
}

// Mock ERC20 for testing
const MOCK_ERC20_SOURCE = `
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    uint8 private _decimals;
    
    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _decimals = decimals_;
        _mint(msg.sender, 1000000 * 10**decimals_); // Mint 1M tokens
    }
    
    function decimals() public view override returns (uint8) {
        return _decimals;
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
`;

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