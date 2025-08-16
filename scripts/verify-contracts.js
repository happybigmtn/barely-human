const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("📝 Verifying contracts on BaseScan...\n");
    
    // Load the most recent deployment
    const deploymentsDir = "./deployments";
    const files = fs.readdirSync(deploymentsDir)
        .filter(f => f.startsWith("base-sepolia-"))
        .sort((a, b) => b.localeCompare(a));
    
    if (files.length === 0) {
        console.error("❌ No deployment files found!");
        process.exit(1);
    }
    
    const deploymentFile = path.join(deploymentsDir, files[0]);
    const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
    
    console.log("Using deployment:", deploymentFile);
    console.log("Network:", deployment.network);
    console.log("Timestamp:", deployment.timestamp);
    console.log();
    
    const contracts = [
        {
            name: "BOTToken",
            address: deployment.contracts.BOTToken,
            constructorArguments: [
                process.env.TEAM_WALLET || "0x0000000000000000000000000000000000000001",
                process.env.DEV_WALLET || "0x0000000000000000000000000000000000000002",
                process.env.INSURANCE_WALLET || "0x0000000000000000000000000000000000000003"
            ]
        },
        {
            name: "Treasury",
            address: deployment.contracts.Treasury,
            constructorArguments: [
                deployment.contracts.BOTToken,
                process.env.DEV_WALLET || "0x0000000000000000000000000000000000000002",
                process.env.INSURANCE_WALLET || "0x0000000000000000000000000000000000000003"
            ]
        },
        {
            name: "StakingPool",
            address: deployment.contracts.StakingPool,
            constructorArguments: [
                deployment.contracts.BOTToken,
                deployment.contracts.BOTToken,
                deployment.contracts.Treasury
            ]
        },
        {
            name: "CrapsGame",
            address: deployment.contracts.CrapsGame,
            constructorArguments: [
                deployment.config.CHAINLINK_VRF_COORDINATOR,
                deployment.config.CHAINLINK_SUBSCRIPTION_ID,
                deployment.config.CHAINLINK_KEY_HASH
            ]
        },
        {
            name: "CrapsBets",
            address: deployment.contracts.CrapsBets,
            constructorArguments: [deployment.contracts.CrapsGame]
        },
        {
            name: "CrapsSettlement",
            address: deployment.contracts.CrapsSettlement,
            constructorArguments: [deployment.contracts.CrapsGame]
        },
        {
            name: "BotManager",
            address: deployment.contracts.BotManager,
            constructorArguments: []
        },
        {
            name: "VaultFactoryLib",
            address: deployment.contracts.VaultFactoryLib,
            constructorArguments: []
        },
        {
            name: "VaultFactoryOptimized",
            address: deployment.contracts.VaultFactory,
            constructorArguments: [
                deployment.contracts.BOTToken,
                deployment.contracts.CrapsGame,
                deployment.contracts.BotManager,
                deployment.contracts.Treasury
            ],
            libraries: {
                VaultFactoryLib: deployment.contracts.VaultFactoryLib
            }
        }
    ];
    
    for (const contract of contracts) {
        console.log(`Verifying ${contract.name}...`);
        try {
            await hre.run("verify:verify", {
                address: contract.address,
                constructorArguments: contract.constructorArguments,
                libraries: contract.libraries
            });
            console.log(`✅ ${contract.name} verified!\n`);
        } catch (error) {
            if (error.message.includes("Already Verified")) {
                console.log(`✅ ${contract.name} already verified!\n`);
            } else {
                console.error(`❌ Failed to verify ${contract.name}:`, error.message, "\n");
            }
        }
    }
    
    console.log("✅ Verification complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });