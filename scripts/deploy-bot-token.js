const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("========================================");
    console.log("BOT Token Deployment Script");
    console.log("========================================\n");
    
    // Get signers
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH\n");
    
    // Configuration for different networks
    const networkName = hre.network.name;
    console.log("Network:", networkName);
    
    let addresses;
    
    if (networkName === "localhost" || networkName === "hardhat") {
        // For local testing, use test addresses
        const signers = await ethers.getSigners();
        addresses = {
            treasury: signers[1].address,
            liquidity: signers[2].address,
            stakingRewards: signers[3].address,
            team: signers[4].address,
            community: signers[5].address
        };
        console.log("Using test addresses for local deployment");
    } else if (networkName === "baseSepolia") {
        // Base Sepolia testnet addresses
        addresses = {
            treasury: process.env.TREASURY_ADDRESS || deployer.address,
            liquidity: process.env.LIQUIDITY_ADDRESS || deployer.address,
            stakingRewards: process.env.STAKING_REWARDS_ADDRESS || deployer.address,
            team: process.env.TEAM_ADDRESS || deployer.address,
            community: process.env.COMMUNITY_ADDRESS || deployer.address
        };
        console.log("Using configured addresses for Base Sepolia");
    } else if (networkName === "base") {
        // Base mainnet addresses - MUST be configured before mainnet deployment
        addresses = {
            treasury: process.env.TREASURY_ADDRESS,
            liquidity: process.env.LIQUIDITY_ADDRESS,
            stakingRewards: process.env.STAKING_REWARDS_ADDRESS,
            team: process.env.TEAM_ADDRESS,
            community: process.env.COMMUNITY_ADDRESS
        };
        
        // Validate mainnet addresses
        for (const [key, value] of Object.entries(addresses)) {
            if (!value || value === ethers.ZeroAddress) {
                throw new Error(`Missing required address for ${key} on mainnet`);
            }
        }
        console.log("Using configured addresses for Base mainnet");
    } else {
        throw new Error(`Unsupported network: ${networkName}`);
    }
    
    console.log("\nAllocation addresses:");
    console.log("  Treasury:", addresses.treasury);
    console.log("  Liquidity:", addresses.liquidity);
    console.log("  Staking Rewards:", addresses.stakingRewards);
    console.log("  Team:", addresses.team);
    console.log("  Community:", addresses.community);
    console.log();
    
    // Deploy BOT Token
    console.log("Deploying BOT Token...");
    const BOTToken = await ethers.getContractFactory("BOTToken");
    
    const estimatedGas = await ethers.provider.estimateGas(
        await BOTToken.getDeployTransaction(
            addresses.treasury,
            addresses.liquidity,
            addresses.stakingRewards,
            addresses.team,
            addresses.community
        )
    );
    console.log("Estimated deployment gas:", estimatedGas.toString());
    
    const token = await BOTToken.deploy(
        addresses.treasury,
        addresses.liquidity,
        addresses.stakingRewards,
        addresses.team,
        addresses.community
    );
    
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();
    
    console.log("\n✅ BOT Token deployed to:", tokenAddress);
    
    // Verify deployment
    console.log("\nVerifying deployment...");
    const totalSupply = await token.totalSupply();
    console.log("  Total Supply:", ethers.formatEther(totalSupply), "BOT");
    
    const treasuryBalance = await token.balanceOf(addresses.treasury);
    const liquidityBalance = await token.balanceOf(addresses.liquidity);
    const stakingBalance = await token.balanceOf(addresses.stakingRewards);
    const teamBalance = await token.balanceOf(addresses.team);
    const communityBalance = await token.balanceOf(addresses.community);
    
    console.log("\nToken allocations:");
    console.log("  Treasury (20%):", ethers.formatEther(treasuryBalance), "BOT");
    console.log("  Liquidity (30%):", ethers.formatEther(liquidityBalance), "BOT");
    console.log("  Staking Rewards (25%):", ethers.formatEther(stakingBalance), "BOT");
    console.log("  Team (15%):", ethers.formatEther(teamBalance), "BOT");
    console.log("  Community (10%):", ethers.formatEther(communityBalance), "BOT");
    
    // Verify roles
    console.log("\nVerifying roles...");
    const TREASURY_ROLE = await token.TREASURY_ROLE();
    const STAKING_ROLE = await token.STAKING_ROLE();
    const PAUSER_ROLE = await token.PAUSER_ROLE();
    const DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();
    
    console.log("  Treasury has TREASURY_ROLE:", await token.hasRole(TREASURY_ROLE, addresses.treasury));
    console.log("  Staking has STAKING_ROLE:", await token.hasRole(STAKING_ROLE, addresses.stakingRewards));
    console.log("  Deployer has PAUSER_ROLE:", await token.hasRole(PAUSER_ROLE, deployer.address));
    console.log("  Deployer has DEFAULT_ADMIN_ROLE:", await token.hasRole(DEFAULT_ADMIN_ROLE, deployer.address));
    
    // Save deployment info
    const deploymentInfo = {
        network: networkName,
        tokenAddress: tokenAddress,
        deployer: deployer.address,
        addresses: addresses,
        totalSupply: totalSupply.toString(),
        deploymentTime: new Date().toISOString(),
        blockNumber: await ethers.provider.getBlockNumber()
    };
    
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir);
    }
    
    const filename = path.join(deploymentsDir, `bot-token-${networkName}.json`);
    fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\n📁 Deployment info saved to: ${filename}`);
    
    // Verify on Etherscan if not local
    if (networkName !== "localhost" && networkName !== "hardhat") {
        console.log("\n📝 To verify on Etherscan, run:");
        console.log(`npx hardhat verify --network ${networkName} ${tokenAddress} \\`);
        console.log(`  "${addresses.treasury}" \\`);
        console.log(`  "${addresses.liquidity}" \\`);
        console.log(`  "${addresses.stakingRewards}" \\`);
        console.log(`  "${addresses.team}" \\`);
        console.log(`  "${addresses.community}"`);
    }
    
    console.log("\n========================================");
    console.log("✨ Deployment Complete!");
    console.log("========================================");
    
    return {
        tokenAddress,
        deploymentInfo
    };
}

// Execute deployment
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });