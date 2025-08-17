import { network } from "hardhat";
import { formatEther } from "viem";
import fs from "fs";
import path from "path";
import chalk from "chalk";

/**
 * Quick system diagnosis tool
 * Checks if the casino system is ready to play or needs fixes
 */

interface SystemCheck {
    name: string;
    passed: boolean;
    message: string;
    solution?: string;
}

export class SystemDiagnostic {
    private connection: any;
    private viem: any;
    private publicClient: any;
    private walletClients: any[];
    private deployments: any;
    private checks: SystemCheck[] = [];
    
    async initialize() {
        console.log(chalk.cyan("🔍 BARELY HUMAN CASINO - SYSTEM DIAGNOSTIC"));
        console.log(chalk.gray("=".repeat(50)));
        console.log("");
        
        try {
            this.connection = await network.connect();
            this.viem = this.connection.viem;
            this.publicClient = await this.viem.getPublicClient();
            this.walletClients = await this.viem.getWalletClients();
        } catch (error) {
            this.addCheck("Network Connection", false, "Cannot connect to Hardhat node", "npm run node");
            throw error;
        }
    }
    
    async cleanup() {
        if (this.connection) {
            await this.connection.close();
        }
    }
    
    private addCheck(name: string, passed: boolean, message: string, solution?: string) {
        this.checks.push({ name, passed, message, solution });
    }
    
    async runAllChecks() {
        console.log(chalk.yellow("Running system checks...\n"));
        
        await this.checkDeployments();
        await this.checkBotWallets();
        await this.checkBotFunding();
        await this.checkContractIntegration();
        await this.checkUserWalletSystem();
        
        this.generateReport();
        this.recommendActions();
    }
    
    async checkDeployments() {
        const deploymentPath = path.join(process.cwd(), "deployments", "localhost.json");
        
        if (!fs.existsSync(deploymentPath)) {
            this.addCheck(
                "Contract Deployment", 
                false, 
                "No deployment found", 
                "npm run deploy:local"
            );
            return;
        }
        
        try {
            this.deployments = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
            
            // Check if key contracts exist
            const requiredContracts = [
                'BOTToken', 'Treasury', 'StakingPool', 'VaultFactory', 
                'CrapsGame', 'BotManager', 'BotVaults'
            ];
            
            const missingContracts = requiredContracts.filter(
                contract => !this.deployments.contracts[contract]
            );
            
            if (missingContracts.length > 0) {
                this.addCheck(
                    "Contract Deployment",
                    false,
                    `Missing contracts: ${missingContracts.join(", ")}`,
                    "npm run deploy:local"
                );
            } else {
                this.addCheck(
                    "Contract Deployment",
                    true,
                    `All ${requiredContracts.length} contracts deployed`
                );
            }
            
        } catch (error) {
            this.addCheck(
                "Contract Deployment",
                false,
                "Deployment file corrupted",
                "npm run deploy:local"
            );
        }
    }
    
    async checkBotWallets() {
        const walletPath = path.join(process.cwd(), "wallets.json");
        
        if (!fs.existsSync(walletPath)) {
            this.addCheck(
                "Bot Wallets",
                false,
                "Bot wallets not found",
                "npm run fix:crisis"
            );
            return;
        }
        
        try {
            const walletInfo = JSON.parse(fs.readFileSync(walletPath, "utf8"));
            const botWallets = new Map(walletInfo.botWallets || []);
            
            if (botWallets.size < 10) {
                this.addCheck(
                    "Bot Wallets",
                    false,
                    `Only ${botWallets.size}/10 bot wallets found`,
                    "npm run fix:crisis"
                );
            } else {
                this.addCheck(
                    "Bot Wallets",
                    true,
                    `All 10 bot wallets generated`
                );
            }
            
        } catch (error) {
            this.addCheck(
                "Bot Wallets",
                false,
                "Wallet file corrupted",
                "npm run fix:crisis"
            );
        }
    }
    
    async checkBotFunding() {
        const walletPath = path.join(process.cwd(), "wallets.json");
        
        if (!fs.existsSync(walletPath) || !this.deployments) {
            this.addCheck(
                "Bot Funding",
                false,
                "Cannot check - missing prerequisites",
                "npm run fix:crisis"
            );
            return;
        }
        
        try {
            const walletInfo = JSON.parse(fs.readFileSync(walletPath, "utf8"));
            const botWallets = new Map(walletInfo.botWallets || []);
            
            let criticalCount = 0;
            let lowCount = 0;
            let totalChecked = 0;
            
            for (const [botId, botWallet] of botWallets) {
                if (totalChecked >= 10) break; // Only check first 10
                
                try {
                    const ethBalance = await this.publicClient.getBalance({ 
                        address: botWallet.address 
                    });
                    
                    const botTokenBalance = await this.publicClient.readContract({
                        address: this.deployments.contracts.BOTToken,
                        abi: [
                            {
                                name: "balanceOf",
                                type: "function",
                                stateMutability: "view",
                                inputs: [{ name: "account", type: "address" }],
                                outputs: [{ name: "", type: "uint256" }]
                            }
                        ],
                        functionName: "balanceOf",
                        args: [botWallet.address]
                    });
                    
                    // Critical: Cannot send transactions
                    if (ethBalance === 0n) {
                        criticalCount++;
                    }
                    // Low: May run out soon
                    else if (ethBalance < parseEther("0.01") || botTokenBalance < parseEther("1000")) {
                        lowCount++;
                    }
                    
                    totalChecked++;
                    
                } catch (error) {
                    criticalCount++; // Assume critical if we can't check
                }
            }
            
            if (criticalCount > 0) {
                this.addCheck(
                    "Bot Funding",
                    false,
                    `🚨 CRITICAL: ${criticalCount}/${totalChecked} bots have zero ETH (cannot send transactions)`,
                    "npm run fix:crisis"
                );
            } else if (lowCount > 0) {
                this.addCheck(
                    "Bot Funding",
                    false,
                    `⚠️ ${lowCount}/${totalChecked} bots have low balances`,
                    "npm run fund:bots"
                );
            } else {
                this.addCheck(
                    "Bot Funding",
                    true,
                    `All ${totalChecked} bots have sufficient funding`
                );
            }
            
        } catch (error) {
            this.addCheck(
                "Bot Funding",
                false,
                "Failed to check bot balances",
                "npm run fix:crisis"
            );
        }
    }
    
    async checkContractIntegration() {
        if (!this.deployments) {
            this.addCheck(
                "Contract Integration",
                false,
                "No deployment to check",
                "npm run deploy:local"
            );
            return;
        }
        
        try {
            // Check if BotManager is initialized
            const botManager = this.deployments.contracts.BotManager;
            
            const personality = await this.publicClient.readContract({
                address: botManager,
                abi: [
                    {
                        name: "getPersonality",
                        type: "function",
                        stateMutability: "view",
                        inputs: [{ name: "botId", type: "uint256" }],
                        outputs: [{ name: "", type: "string" }]
                    }
                ],
                functionName: "getPersonality",
                args: [0n]
            });
            
            if (personality && personality.length > 0) {
                this.addCheck(
                    "Contract Integration",
                    true,
                    "Bot personalities initialized"
                );
            } else {
                this.addCheck(
                    "Contract Integration",
                    false,
                    "Bot personalities not initialized",
                    "npm run deploy:local (redeploy)"
                );
            }
            
        } catch (error) {
            this.addCheck(
                "Contract Integration",
                false,
                "Contract calls failing",
                "npm run deploy:local"
            );
        }
    }
    
    async checkUserWalletSystem() {
        const walletDir = path.join(process.cwd(), "wallets");
        
        if (fs.existsSync(walletDir)) {
            const walletFiles = fs.readdirSync(walletDir).filter(f => f.endsWith('.json'));
            
            this.addCheck(
                "User Wallet System",
                true,
                `Wallet system ready (${walletFiles.length} user wallets)`
            );
        } else {
            this.addCheck(
                "User Wallet System",
                true,
                "Wallet system ready (no user wallets yet)"
            );
        }\n    }\n    \n    generateReport() {\n        console.log(chalk.cyan(\"\\n📊 DIAGNOSTIC REPORT\"));\n        console.log(chalk.gray(\"=\".repeat(30)));\n        \n        const passed = this.checks.filter(c => c.passed).length;\n        const total = this.checks.length;\n        const failed = total - passed;\n        \n        console.log(`\\n📈 Summary: ${passed}/${total} checks passed`);\n        \n        if (failed === 0) {\n            console.log(chalk.green(\"✅ SYSTEM READY - All checks passed!\"));\n        } else {\n            console.log(chalk.red(`❌ ${failed} ISSUES FOUND - System needs fixes`));\n        }\n        \n        console.log(\"\\n📋 Detailed Results:\");\n        \n        for (const check of this.checks) {\n            const status = check.passed ? chalk.green(\"✅\") : chalk.red(\"❌\");\n            console.log(`${status} ${check.name}: ${check.message}`);\n        }\n    }\n    \n    recommendActions() {\n        const failedChecks = this.checks.filter(c => !c.passed);\n        \n        if (failedChecks.length === 0) {\n            console.log(chalk.green(\"\\n🎉 READY TO PLAY!\"));\n            console.log(chalk.gray(\"=\".repeat(30)));\n            console.log(\"\\n🎮 Start the casino with:\");\n            console.log(chalk.cyan(\"npm run cli:interactive\"));\n            console.log(\"\\n🤖 Or watch bots play:\");\n            console.log(chalk.cyan(\"npm run bots\"));\n            return;\n        }\n        \n        console.log(chalk.yellow(\"\\n🔧 RECOMMENDED ACTIONS\"));\n        console.log(chalk.gray(\"=\".repeat(30)));\n        \n        // Prioritize critical issues\n        const criticalIssues = failedChecks.filter(c => \n            c.message.includes(\"CRITICAL\") || \n            c.message.includes(\"zero ETH\") ||\n            c.name === \"Contract Deployment\"\n        );\n        \n        if (criticalIssues.length > 0) {\n            console.log(chalk.red(\"\\n🚨 CRITICAL ISSUES (fix immediately):\"));\n            for (const issue of criticalIssues) {\n                console.log(chalk.red(`   • ${issue.name}: ${issue.message}`));\n                if (issue.solution) {\n                    console.log(chalk.yellow(`     Solution: ${issue.solution}`));\n                }\n            }\n            \n            console.log(chalk.yellow(\"\\n💡 Quick fix for funding issues:\"));\n            console.log(chalk.cyan(\"npm run fix:crisis\"));\n        }\n        \n        // Other issues\n        const otherIssues = failedChecks.filter(c => !criticalIssues.includes(c));\n        if (otherIssues.length > 0) {\n            console.log(chalk.yellow(\"\\n⚠️  Other issues:\"));\n            for (const issue of otherIssues) {\n                console.log(chalk.yellow(`   • ${issue.name}: ${issue.message}`));\n                if (issue.solution) {\n                    console.log(chalk.gray(`     Solution: ${issue.solution}`));\n                }\n            }\n        }\n        \n        console.log(chalk.gray(\"\\n📖 For detailed help, see:\"));\n        console.log(chalk.gray(\"docs/EMERGENCY_FUNDING_GUIDE.md\"));\n    }\n}\n\n/**\n * CLI function\n */\nasync function main() {\n    const diagnostic = new SystemDiagnostic();\n    \n    try {\n        await diagnostic.initialize();\n        await diagnostic.runAllChecks();\n        \n    } catch (error) {\n        console.error(chalk.red(\"\\n❌ Diagnostic failed:\"), error.message);\n        console.log(chalk.yellow(\"\\nBasic troubleshooting:\"));\n        console.log(chalk.yellow(\"• Check if Hardhat node is running: npm run node\"));\n        console.log(chalk.yellow(\"• Deploy contracts: npm run deploy:local\"));\n        console.log(chalk.yellow(\"• Run emergency fix: npm run fix:crisis\"));\n    } finally {\n        await diagnostic.cleanup();\n    }\n}\n\n// Run if called directly\nif (require.main === module) {\n    main()\n        .then(() => process.exit(0))\n        .catch((error) => {\n            console.error(error);\n            process.exit(1);\n        });\n}\n\nexport default SystemDiagnostic;