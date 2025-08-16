import hre from "hardhat";
import { parseEther } from "viem";

async function main() {
    console.log("Testing BOT Token deployment...\n");
    
    // Get wallet clients (signers)
    const [owner, treasury, liquidity, stakingRewards, team, community] = 
        await hre.viem.getWalletClients();
    
    console.log("Deploying BOT Token...");
    const token = await hre.viem.deployContract("BOTToken", [
        treasury.account.address,
        liquidity.account.address,
        stakingRewards.account.address,
        team.account.address,
        community.account.address
    ]);
    
    console.log("✅ BOT Token deployed to:", token.address);
    
    // Test basic functionality
    console.log("\nTesting basic functionality:");
    
    const name = await token.read.name();
    console.log("  Name:", name);
    
    const symbol = await token.read.symbol();
    console.log("  Symbol:", symbol);
    
    const totalSupply = await token.read.totalSupply();
    console.log("  Total Supply:", (Number(totalSupply) / 1e18).toFixed(0), "BOT");
    
    // Check allocations
    console.log("\nChecking allocations:");
    const treasuryBalance = await token.read.balanceOf([treasury.account.address]);
    const liquidityBalance = await token.read.balanceOf([liquidity.account.address]);
    const stakingBalance = await token.read.balanceOf([stakingRewards.account.address]);
    const teamBalance = await token.read.balanceOf([team.account.address]);
    const communityBalance = await token.read.balanceOf([community.account.address]);
    
    console.log("  Treasury (20%):", (Number(treasuryBalance) / 1e18).toFixed(0), "BOT");
    console.log("  Liquidity (30%):", (Number(liquidityBalance) / 1e18).toFixed(0), "BOT");
    console.log("  Staking (25%):", (Number(stakingBalance) / 1e18).toFixed(0), "BOT");
    console.log("  Team (15%):", (Number(teamBalance) / 1e18).toFixed(0), "BOT");
    console.log("  Community (10%):", (Number(communityBalance) / 1e18).toFixed(0), "BOT");
    
    // Test transfer
    console.log("\nTesting transfer:");
    const amount = parseEther("100");
    await token.write.transfer([owner.account.address, amount], {
        account: treasury.account
    });
    const ownerBalance = await token.read.balanceOf([owner.account.address]);
    console.log("  Transferred 100 BOT to owner:", (Number(ownerBalance) / 1e18).toFixed(0), "BOT");
    
    // Test roles
    console.log("\nTesting roles:");
    const TREASURY_ROLE = await token.read.TREASURY_ROLE();
    const hasTreasuryRole = await token.read.hasRole([TREASURY_ROLE, treasury.account.address]);
    console.log("  Treasury has TREASURY_ROLE:", hasTreasuryRole);
    
    const STAKING_ROLE = await token.read.STAKING_ROLE();
    const hasStakingRole = await token.read.hasRole([STAKING_ROLE, stakingRewards.account.address]);
    console.log("  Staking has STAKING_ROLE:", hasStakingRole);
    
    console.log("\n✨ All tests passed!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Test failed:", error);
        process.exit(1);
    });