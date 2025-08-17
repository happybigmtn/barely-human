import { network } from "hardhat";
import { formatEther } from "viem";
import fs from "fs";
import path from "path";

/**
 * Balance monitoring and alerting system for Barely Human DeFi Casino
 * Checks ETH and BOT token balances for all accounts
 */

interface BalanceReport {
    address: string;
    name: string;
    type: 'deployer' | 'treasury' | 'bot' | 'user' | 'vault';
    ethBalance: bigint;
    botTokenBalance: bigint;
    ethFormatted: string;
    botTokenFormatted: string;
    warnings: string[];
    needsRefill: boolean;
}

interface BalanceThresholds {
    deployer: { eth: bigint; bot: bigint };
    treasury: { eth: bigint; bot: bigint };
    bot: { eth: bigint; bot: bigint };
    user: { eth: bigint; bot: bigint };
    vault: { eth: bigint; bot: bigint };
}

const DEFAULT_THRESHOLDS: BalanceThresholds = {
    deployer: {
        eth: formatEther.parse ? formatEther.parse("0.5") : parseEther("0.5"),
        bot: formatEther.parse ? formatEther.parse("100000") : parseEther("100000")
    },
    treasury: {
        eth: formatEther.parse ? formatEther.parse("0.1") : parseEther("0.1"),
        bot: formatEther.parse ? formatEther.parse("50000") : parseEther("50000")
    },
    bot: {
        eth: formatEther.parse ? formatEther.parse("0.01") : parseEther("0.01"),
        bot: formatEther.parse ? formatEther.parse("1000") : parseEther("1000")
    },
    user: {
        eth: formatEther.parse ? formatEther.parse("0.005") : parseEther("0.005"),
        bot: formatEther.parse ? formatEther.parse("500") : parseEther("500")
    },
    vault: {
        eth: formatEther.parse ? formatEther.parse("0.0") : parseEther("0.0"),
        bot: formatEther.parse ? formatEther.parse("5000") : parseEther("5000")
    }
};

// Fallback for parseEther if not available
function parseEther(value: string): bigint {
    return BigInt(parseFloat(value) * 1e18);
}

export class BalanceChecker {
    private connection: any;
    private viem: any;
    private publicClient: any;
    private walletClients: any[];
    private deployments: any;
    private thresholds: BalanceThresholds;
    
    constructor(customThresholds?: Partial<BalanceThresholds>) {
        this.thresholds = { ...DEFAULT_THRESHOLDS, ...customThresholds };
        this.loadDeployments();
    }
    
    private loadDeployments() {
        const deploymentPath = path.join(process.cwd(), "deployments", "localhost.json");
        if (!fs.existsSync(deploymentPath)) {
            throw new Error("No deployment found. Run deployment script first.");
        }
        this.deployments = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    }
    
    async initialize() {
        console.log("🔍 Initializing Balance Checker...\n");
        
        this.connection = await network.connect();
        this.viem = this.connection.viem;
        this.publicClient = await this.viem.getPublicClient();
        this.walletClients = await this.viem.getWalletClients();
        
        console.log("✅ Balance Checker initialized");
    }
    
    async cleanup() {
        if (this.connection) {
            await this.connection.close();
        }
    }
    
    /**
     * Check balance for a specific address
     */
    async checkAddressBalance(address: string, name: string, type: keyof BalanceThresholds): Promise<BalanceReport> {
        const ethBalance = await this.publicClient.getBalance({ address });
        
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
            args: [address]
        });
        
        const threshold = this.thresholds[type];
        const warnings: string[] = [];
        let needsRefill = false;
        
        // Check for low balances
        if (ethBalance < threshold.eth) {
            warnings.push(`Low ETH: ${formatEther(ethBalance)} < ${formatEther(threshold.eth)}`);
            needsRefill = true;
        }
        
        if (botTokenBalance < threshold.bot) {
            warnings.push(`Low BOT: ${formatEther(botTokenBalance)} < ${formatEther(threshold.bot)}`);
            needsRefill = true;
        }
        
        // Check for suspicious zero balances
        if (ethBalance === 0n && type !== 'vault') {
            warnings.push("CRITICAL: Zero ETH balance - cannot send transactions!");
            needsRefill = true;
        }
        
        return {
            address,
            name,
            type,
            ethBalance,
            botTokenBalance,
            ethFormatted: formatEther(ethBalance),
            botTokenFormatted: formatEther(botTokenBalance),
            warnings,
            needsRefill
        };
    }
    
    /**
     * Load wallet information from file
     */
    loadWalletInfo(): { botWallets: Map<number, any>; userWallets: Map<string, any> } {
        const walletPath = path.join(process.cwd(), "wallets.json");
        
        if (fs.existsSync(walletPath)) {
            const walletInfo = JSON.parse(fs.readFileSync(walletPath, "utf8"));
            return {
                botWallets: new Map(walletInfo.botWallets || []),
                userWallets: new Map(walletInfo.userWallets || [])
            };
        }
        
        return {
            botWallets: new Map(),
            userWallets: new Map()
        };
    }
    
    /**
     * Check all account balances
     */
    async checkAllBalances(): Promise<BalanceReport[]> {
        console.log("📊 Checking all account balances...\n");
        
        const reports: BalanceReport[] = [];
        
        // Check deployer account
        const [deployer] = this.walletClients;
        reports.push(await this.checkAddressBalance(
            deployer.account.address,
            "Deployer",
            "deployer"
        ));
        
        // Check treasury contract
        if (this.deployments.contracts.Treasury) {
            reports.push(await this.checkAddressBalance(
                this.deployments.contracts.Treasury,
                "Treasury Contract",
                "treasury"
            ));
        }
        
        // Check bot wallets
        const { botWallets, userWallets } = this.loadWalletInfo();
        
        for (const [botId, botWallet] of botWallets) {
            reports.push(await this.checkAddressBalance(
                botWallet.address,
                `Bot ${botId}`,
                "bot"
            ));
        }
        
        // Check user wallets
        for (const [userId, userWallet] of userWallets) {
            reports.push(await this.checkAddressBalance(
                userWallet.address,
                `User ${userId}`,
                "user"
            ));
        }
        
        // Check bot vaults
        if (this.deployments.contracts.BotVaults) {
            for (let i = 0; i < this.deployments.contracts.BotVaults.length; i++) {
                const vaultAddress = this.deployments.contracts.BotVaults[i];
                reports.push(await this.checkAddressBalance(
                    vaultAddress,
                    `Bot Vault ${i}`,
                    "vault"
                ));
            }
        }
        
        return reports;
    }
    
    /**
     * Generate detailed balance report
     */
    generateReport(reports: BalanceReport[]): string {
        let output = "";
        
        output += "=" * 80 + "\n";
        output += "💰 BALANCE REPORT - " + new Date().toISOString() + "\n";
        output += "=" * 80 + "\n\n";
        
        // Summary statistics
        const totalAccounts = reports.length;
        const accountsNeedingRefill = reports.filter(r => r.needsRefill).length;
        const criticalAccounts = reports.filter(r => r.warnings.some(w => w.includes("CRITICAL"))).length;
        
        output += "📈 SUMMARY:\n";
        output += `  Total Accounts: ${totalAccounts}\n`;
        output += `  Need Refill: ${accountsNeedingRefill}\n`;
        output += `  Critical: ${criticalAccounts}\n\n`;
        
        // Group by type
        const groupedReports = reports.reduce((acc, report) => {
            if (!acc[report.type]) acc[report.type] = [];
            acc[report.type].push(report);
            return acc;
        }, {} as Record<string, BalanceReport[]>);
        
        // Display each group
        for (const [type, typeReports] of Object.entries(groupedReports)) {
            output += `🏷️  ${type.toUpperCase()} ACCOUNTS:\n`;
            output += "-" * 50 + "\n";
            
            for (const report of typeReports) {
                const status = report.needsRefill ? "⚠️ " : "✅";
                output += `${status} ${report.name}\n`;
                output += `   Address: ${report.address}\n`;
                output += `   ETH: ${report.ethFormatted}\n`;
                output += `   BOT: ${report.botTokenFormatted}\n`;
                
                if (report.warnings.length > 0) {
                    output += `   Warnings:\n`;
                    for (const warning of report.warnings) {
                        output += `     ⚠️  ${warning}\n`;
                    }
                }
                output += "\n";
            }
        }
        
        // Recommendations
        output += "💡 RECOMMENDATIONS:\n";
        output += "-" * 30 + "\n";
        
        if (criticalAccounts > 0) {
            output += "🚨 CRITICAL: Some accounts have zero ETH and cannot send transactions!\n";
            output += "   Run: npm run fund-accounts emergency\n\n";
        }
        
        if (accountsNeedingRefill > 0) {
            output += "💰 Fund accounts that need refill:\n";
            output += "   Run: npm run fund-accounts monitor\n\n";
        }
        
        if (accountsNeedingRefill === 0) {
            output += "✅ All accounts have sufficient balances!\n\n";
        }
        
        return output;
    }
    
    /**
     * Save balance report to file
     */
    saveReport(report: string) {
        const reportsDir = path.join(process.cwd(), "reports");
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const reportPath = path.join(reportsDir, `balance-report-${timestamp}.txt`);
        
        fs.writeFileSync(reportPath, report);
        console.log(`💾 Balance report saved to: ${reportPath}`);
    }
    
    /**
     * Monitor balances continuously
     */
    async startMonitoring(intervalMinutes: number = 5) {
        console.log(`🔄 Starting balance monitoring every ${intervalMinutes} minutes...\n`);
        
        const monitor = async () => {
            try {
                const reports = await this.checkAllBalances();
                const accountsNeedingRefill = reports.filter(r => r.needsRefill);
                
                if (accountsNeedingRefill.length > 0) {
                    console.log(`⚠️  ${accountsNeedingRefill.length} accounts need refill:`);
                    for (const report of accountsNeedingRefill) {
                        console.log(`   ${report.name}: ${report.warnings.join(", ")}`);
                    }
                    console.log("   Run 'npm run fund-accounts monitor' to refill\n");
                } else {
                    console.log("✅ All accounts have sufficient balances");
                }
                
            } catch (error) {
                console.error("❌ Error during monitoring:", error.message);
            }
        };
        
        // Run initial check
        await monitor();
        
        // Set up interval
        const interval = setInterval(monitor, intervalMinutes * 60 * 1000);
        
        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log("\n🛑 Stopping balance monitoring...");
            clearInterval(interval);
            this.cleanup().then(() => process.exit(0));
        });
        
        return interval;
    }
    
    /**
     * Get accounts that need immediate attention
     */
    async getUrgentAccounts(): Promise<BalanceReport[]> {
        const reports = await this.checkAllBalances();
        return reports.filter(report => 
            report.warnings.some(warning => warning.includes("CRITICAL")) ||
            (report.ethBalance === 0n && report.type !== 'vault')
        );
    }
}

/**
 * CLI function to run balance checking operations
 */
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || "check";
    
    const balanceChecker = new BalanceChecker();
    
    try {
        await balanceChecker.initialize();
        
        switch (command) {
            case "check":
                console.log("📊 Checking all balances...");
                const reports = await balanceChecker.checkAllBalances();
                const reportText = balanceChecker.generateReport(reports);
                console.log(reportText);
                break;
                
            case "save":
                console.log("📊 Checking balances and saving report...");
                const allReports = await balanceChecker.checkAllBalances();
                const fullReport = balanceChecker.generateReport(allReports);
                console.log(fullReport);
                balanceChecker.saveReport(fullReport);
                break;
                
            case "urgent":
                console.log("🚨 Checking for urgent funding needs...");
                const urgentAccounts = await balanceChecker.getUrgentAccounts();
                if (urgentAccounts.length > 0) {
                    console.log(`⚠️  ${urgentAccounts.length} accounts need IMMEDIATE funding:`);
                    for (const account of urgentAccounts) {
                        console.log(`   ${account.name}: ${account.warnings.join(", ")}`);
                    }
                    console.log("\n🚨 Run: npm run fund-accounts emergency");
                } else {
                    console.log("✅ No urgent funding needs detected");
                }
                break;
                
            case "monitor":
                const intervalMinutes = parseInt(args[1]) || 5;
                console.log(`🔄 Starting continuous monitoring (${intervalMinutes}min intervals)...`);
                await balanceChecker.startMonitoring(intervalMinutes);
                break;
                
            case "address":
                const address = args[1];
                const name = args[2] || "Unknown";
                const type = (args[3] as keyof BalanceThresholds) || "user";
                if (!address) {
                    console.error("Please provide address: npm run check-balances address <address> [name] [type]");
                    process.exit(1);
                }
                const singleReport = await balanceChecker.checkAddressBalance(address, name, type);
                console.log(`📊 Balance for ${singleReport.name}:`);
                console.log(`   Address: ${singleReport.address}`);
                console.log(`   ETH: ${singleReport.ethFormatted}`);
                console.log(`   BOT: ${singleReport.botTokenFormatted}`);
                if (singleReport.warnings.length > 0) {
                    console.log(`   Warnings: ${singleReport.warnings.join(", ")}`);
                }
                break;
                
            default:
                console.log("Available commands:");
                console.log("  check                     - Check all balances");
                console.log("  save                      - Check and save report");
                console.log("  urgent                    - Show accounts needing immediate funding");
                console.log("  monitor [minutes]         - Continuous monitoring (default 5min)");
                console.log("  address <addr> [name] [type] - Check specific address");
        }
        
    } catch (error) {
        console.error("❌ Balance check failed:", error);
    } finally {
        await balanceChecker.cleanup();
    }
}

// Run if called directly
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

export default BalanceChecker;
export { BalanceChecker, DEFAULT_THRESHOLDS };
export type { BalanceReport, BalanceThresholds };