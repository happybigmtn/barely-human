const hre = require("hardhat");

async function main() {
    console.log("Testing BOT Token...\n");
    
    // Deploy using ethers v5 style
    const BOTToken = await hre.ethers.getContractFactory("BOTToken");
    
    // Get signers
    const [owner, treasury, liquidity, stakingRewards, team, community] = await hre.ethers.getSigners();
    
    console.log("Deploying BOT Token...");
    const token = await BOTToken.deploy(
        treasury.address,
        liquidity.address,
        stakingRewards.address,
        team.address,
        community.address
    );
    await token.deployed();
    
    console.log("✅ BOT Token deployed to:", token.address);
    
    // Test basic functionality
    console.log("\nTesting basic functionality:");
    
    const name = await token.name();
    console.log("  Name:", name);
    
    const symbol = await token.symbol();
    console.log("  Symbol:", symbol);
    
    const totalSupply = await token.totalSupply();
    console.log("  Total Supply:", hre.ethers.utils.formatEther(totalSupply), "BOT");
    
    // Check allocations
    console.log("\nChecking allocations:");
    const treasuryBalance = await token.balanceOf(treasury.address);
    const liquidityBalance = await token.balanceOf(liquidity.address);
    const stakingBalance = await token.balanceOf(stakingRewards.address);
    const teamBalance = await token.balanceOf(team.address);
    const communityBalance = await token.balanceOf(community.address);
    
    console.log("  Treasury (20%):", hre.ethers.utils.formatEther(treasuryBalance), "BOT");
    console.log("  Liquidity (30%):", hre.ethers.utils.formatEther(liquidityBalance), "BOT");
    console.log("  Staking (25%):", hre.ethers.utils.formatEther(stakingBalance), "BOT");
    console.log("  Team (15%):", hre.ethers.utils.formatEther(teamBalance), "BOT");
    console.log("  Community (10%):", hre.ethers.utils.formatEther(communityBalance), "BOT");
    
    // Test transfer
    console.log("\nTesting transfer:");
    const amount = hre.ethers.utils.parseEther("100");
    await token.connect(treasury).transfer(owner.address, amount);
    const ownerBalance = await token.balanceOf(owner.address);
    console.log("  Transferred 100 BOT to owner:", hre.ethers.utils.formatEther(ownerBalance), "BOT");
    
    // Test roles
    console.log("\nTesting roles:");
    const TREASURY_ROLE = await token.TREASURY_ROLE();
    const hasTreasuryRole = await token.hasRole(TREASURY_ROLE, treasury.address);
    console.log("  Treasury has TREASURY_ROLE:", hasTreasuryRole);
    
    const STAKING_ROLE = await token.STAKING_ROLE();
    const hasStakingRole = await token.hasRole(STAKING_ROLE, stakingRewards.address);
    console.log("  Staking has STAKING_ROLE:", hasStakingRole);
    
    // Test gas usage
    console.log("\nGas usage:");
    const tx = await token.connect(treasury).transfer(owner.address, amount);
    const receipt = await tx.wait();
    console.log("  Transfer gas used:", receipt.gasUsed.toString());
    
    console.log("\n✨ All tests passed!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Test failed:", error);
        process.exit(1);
    });