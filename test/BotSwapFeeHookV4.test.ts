import { network } from "hardhat";
import { parseEther, formatEther, getAddress } from "viem";
import assert from "assert";

describe("BotSwapFeeHookV4 Tests", () => {
    let connection: any;
    let viem: any;
    let publicClient: any;
    let walletClients: any[];
    let hookContract: any;
    let botToken: any;
    let treasury: any;
    let mockPoolManager: any;

    before(async () => {
        connection = await network.connect();
        viem = connection.viem;
        publicClient = await viem.getPublicClient();
        walletClients = await viem.getWalletClients();
    });

    after(async () => {
        if (connection) {
            await connection.close();
        }
    });

    beforeEach(async () => {
        // Deploy BOT token
        botToken = await viem.deployContract("BOTToken", []);
        console.log("BOT Token deployed:", botToken.address);

        // Deploy Treasury
        treasury = await viem.deployContract("Treasury", [
            botToken.address,
            walletClients[0].account.address // staking pool placeholder
        ]);
        console.log("Treasury deployed:", treasury.address);

        // Deploy a mock PoolManager for testing
        // In production, this would be the actual Uniswap V4 PoolManager
        mockPoolManager = await viem.deployContract("MockPoolManager", []);
        console.log("Mock PoolManager deployed:", mockPoolManager.address);

        // Deploy the hook
        hookContract = await viem.deployContract("BotSwapFeeHookV4Updated", [
            mockPoolManager.address,
            botToken.address,
            treasury.address
        ]);
        console.log("Hook deployed:", hookContract.address);
    });

    describe("Deployment", () => {
        it("Should deploy with correct parameters", async () => {
            const botTokenAddress = await hookContract.read.botToken();
            assert.equal(
                getAddress(botTokenAddress),
                getAddress(botToken.address),
                "BOT token address mismatch"
            );

            const treasuryAddress = await hookContract.read.treasury();
            assert.equal(
                getAddress(treasuryAddress),
                getAddress(treasury.address),
                "Treasury address mismatch"
            );
        });

        it("Should have correct fee percentage", async () => {
            const feePercentage = await hookContract.read.FEE_PERCENTAGE();
            assert.equal(feePercentage, 200n, "Fee should be 200 basis points (2%)");
        });
    });

    describe("Hook Permissions", () => {
        it("Should return correct hook permissions", async () => {
            const permissions = await hookContract.read.getHookPermissions();
            
            // Check that beforeSwap and afterSwap are enabled
            assert.equal(permissions.beforeSwap, true, "beforeSwap should be enabled");
            assert.equal(permissions.afterSwap, true, "afterSwap should be enabled");
            assert.equal(permissions.beforeSwapReturnDelta, true, "beforeSwapReturnDelta should be enabled");
            
            // Check that other hooks are disabled
            assert.equal(permissions.beforeInitialize, false, "beforeInitialize should be disabled");
            assert.equal(permissions.afterInitialize, false, "afterInitialize should be disabled");
        });
    });

    describe("Pool Management", () => {
        it("Should enable and disable pools", async () => {
            const poolKey = {
                currency0: "0x0000000000000000000000000000000000000000",
                currency1: botToken.address,
                fee: 3000, // 0.3%
                tickSpacing: 60,
                hooks: hookContract.address
            };

            // Enable pool
            await hookContract.write.setPoolEnabled([poolKey, true]);
            
            const stats = await hookContract.read.getPoolStats([poolKey]);
            assert.equal(stats[0], true, "Pool should be enabled");
        });

        it("Should reject pools without BOT token", async () => {
            const poolKey = {
                currency0: "0x0000000000000000000000000000000000000001",
                currency1: "0x0000000000000000000000000000000000000002",
                fee: 3000,
                tickSpacing: 60,
                hooks: hookContract.address
            };

            try {
                await hookContract.write.setPoolEnabled([poolKey, true]);
                assert.fail("Should have rejected pool without BOT token");
            } catch (error: any) {
                assert(error.message.includes("NoBotTokenInPool"), "Should revert with NoBotTokenInPool");
            }
        });
    });

    describe("Fee Calculation", () => {
        it("Should calculate 2% fee correctly", async () => {
            const amount = parseEther("100");
            const expectedFee = parseEther("2"); // 2% of 100

            const calculatedFee = await hookContract.read.calculateFee([amount]);
            assert.equal(calculatedFee, expectedFee, "Fee calculation incorrect");
        });

        it("Should handle small amounts", async () => {
            const amount = parseEther("0.01");
            const expectedFee = parseEther("0.0002"); // 2% of 0.01

            const calculatedFee = await hookContract.read.calculateFee([amount]);
            assert.equal(calculatedFee, expectedFee, "Small amount fee calculation incorrect");
        });
    });

    describe("Treasury Management", () => {
        it("Should allow admin to update treasury", async () => {
            const newTreasury = walletClients[1].account.address;
            
            await hookContract.write.setTreasury([newTreasury]);
            
            const updatedTreasury = await hookContract.read.treasury();
            assert.equal(
                getAddress(updatedTreasury),
                getAddress(newTreasury),
                "Treasury not updated"
            );
        });

        it("Should reject zero address treasury", async () => {
            try {
                await hookContract.write.setTreasury(["0x0000000000000000000000000000000000000000"]);
                assert.fail("Should have rejected zero address");
            } catch (error: any) {
                assert(error.message.includes("InvalidTreasury"), "Should revert with InvalidTreasury");
            }
        });
    });

    describe("Access Control", () => {
        it("Should have correct admin role", async () => {
            const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
            const hasRole = await hookContract.read.hasRole([
                DEFAULT_ADMIN_ROLE,
                walletClients[0].account.address
            ]);
            assert.equal(hasRole, true, "Deployer should have admin role");
        });

        it("Should have fee manager role", async () => {
            const FEE_MANAGER_ROLE = await hookContract.read.FEE_MANAGER_ROLE();
            const hasRole = await hookContract.read.hasRole([
                FEE_MANAGER_ROLE,
                walletClients[0].account.address
            ]);
            assert.equal(hasRole, true, "Deployer should have fee manager role");
        });
    });

    describe("Statistics", () => {
        it("Should track total fees collected", async () => {
            const totalFees = await hookContract.read.totalFeesCollected();
            assert.equal(totalFees, 0n, "Initial fees should be zero");
        });

        it("Should return global stats", async () => {
            const stats = await hookContract.read.getGlobalStats();
            
            assert.equal(stats[0], 0n, "Total collected should be zero");
            assert.equal(stats[1], 200n, "Fee percentage should be 200");
            assert.equal(
                getAddress(stats[2]),
                getAddress(treasury.address),
                "Treasury address mismatch"
            );
            assert.equal(
                getAddress(stats[3]),
                getAddress(mockPoolManager.address),
                "Pool manager address mismatch"
            );
        });
    });
});

// Mock PoolManager contract for testing
const MOCK_POOL_MANAGER_ABI = `
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract MockPoolManager {
    function take(address currency, address to, uint256 amount) external {
        // Mock implementation
    }
    
    function settle(address currency) external returns (uint256) {
        // Mock implementation
        return 0;
    }
    
    function mint(address currency, address to, uint256 amount) external {
        // Mock implementation
    }
}
`;

console.log("\n🧪 Uniswap V4 Hook Test Suite");
console.log("=" .repeat(50));
console.log("Run with: npx hardhat run test/BotSwapFeeHookV4.test.ts");
console.log();