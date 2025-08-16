import hre from "hardhat";

/**
 * Gas usage reporter for Craps game contracts
 * Helps optimize gas consumption across all operations
 */
class GasReporter {
    constructor() {
        this.reports = [];
        this.contractReports = {};
    }

    /**
     * Record gas usage for a transaction
     */
    async recordTransaction(name, tx) {
        const receipt = await tx.wait();
        const gasUsed = receipt.gasUsed;
        const gasPrice = receipt.gasPrice || tx.gasPrice;
        const cost = gasUsed * gasPrice;
        
        this.reports.push({
            name,
            gasUsed: gasUsed.toString(),
            gasPrice: gasPrice ? gasPrice.toString() : "N/A",
            cost: ethers.formatEther(cost),
            block: receipt.blockNumber
        });
        
        return { gasUsed, cost };
    }

    /**
     * Record gas for contract deployment
     */
    async recordDeployment(contractName, deployTx) {
        const receipt = await deployTx.deploymentTransaction().wait();
        const gasUsed = receipt.gasUsed;
        
        if (!this.contractReports[contractName]) {
            this.contractReports[contractName] = {
                deployment: null,
                methods: {}
            };
        }
        
        this.contractReports[contractName].deployment = {
            gasUsed: gasUsed.toString(),
            bytecodeSize: receipt.contractAddress ? 
                (await ethers.provider.getCode(receipt.contractAddress)).length / 2 - 1 : 0
        };
        
        return gasUsed;
    }

    /**
     * Record gas for contract method
     */
    async recordMethod(contractName, methodName, tx) {
        const receipt = await tx.wait();
        const gasUsed = receipt.gasUsed;
        
        if (!this.contractReports[contractName]) {
            this.contractReports[contractName] = {
                deployment: null,
                methods: {}
            };
        }
        
        if (!this.contractReports[contractName].methods[methodName]) {
            this.contractReports[contractName].methods[methodName] = {
                calls: 0,
                totalGas: 0n,
                minGas: null,
                maxGas: null,
                avgGas: 0n
            };
        }
        
        const methodReport = this.contractReports[contractName].methods[methodName];
        methodReport.calls++;
        methodReport.totalGas += gasUsed;
        
        if (!methodReport.minGas || gasUsed < methodReport.minGas) {
            methodReport.minGas = gasUsed;
        }
        if (!methodReport.maxGas || gasUsed > methodReport.maxGas) {
            methodReport.maxGas = gasUsed;
        }
        
        methodReport.avgGas = methodReport.totalGas / BigInt(methodReport.calls);
        
        return gasUsed;
    }

    /**
     * Generate summary report
     */
    generateReport() {
        console.log("\n=== Gas Usage Report ===\n");
        
        // Contract deployment costs
        console.log("Contract Deployments:");
        console.log("-".repeat(60));
        for (const [contract, report] of Object.entries(this.contractReports)) {
            if (report.deployment) {
                console.log(`${contract}:`);
                console.log(`  Gas Used: ${report.deployment.gasUsed}`);
                console.log(`  Bytecode Size: ${report.deployment.bytecodeSize} bytes`);
            }
        }
        
        // Method gas costs
        console.log("\nContract Methods:");
        console.log("-".repeat(60));
        for (const [contract, report] of Object.entries(this.contractReports)) {
            if (Object.keys(report.methods).length > 0) {
                console.log(`\n${contract}:`);
                for (const [method, stats] of Object.entries(report.methods)) {
                    console.log(`  ${method}:`);
                    console.log(`    Calls: ${stats.calls}`);
                    console.log(`    Avg Gas: ${stats.avgGas}`);
                    console.log(`    Min Gas: ${stats.minGas}`);
                    console.log(`    Max Gas: ${stats.maxGas}`);
                }
            }
        }
        
        // Transaction summary
        if (this.reports.length > 0) {
            console.log("\nTransaction Summary:");
            console.log("-".repeat(60));
            
            const totalGas = this.reports.reduce((sum, r) => sum + BigInt(r.gasUsed), 0n);
            const avgGas = totalGas / BigInt(this.reports.length);
            
            console.log(`Total Transactions: ${this.reports.length}`);
            console.log(`Total Gas Used: ${totalGas}`);
            console.log(`Average Gas: ${avgGas}`);
            
            // Find most expensive operations
            const sorted = [...this.reports].sort((a, b) => 
                BigInt(b.gasUsed) - BigInt(a.gasUsed)
            );
            
            console.log("\nMost Expensive Operations:");
            for (let i = 0; i < Math.min(5, sorted.length); i++) {
                console.log(`  ${i + 1}. ${sorted[i].name}: ${sorted[i].gasUsed} gas`);
            }
        }
        
        console.log("\n" + "=".repeat(60) + "\n");
    }

    /**
     * Export report to JSON
     */
    exportToJSON() {
        return {
            timestamp: new Date().toISOString(),
            contracts: this.contractReports,
            transactions: this.reports,
            summary: {
                totalTransactions: this.reports.length,
                totalGasUsed: this.reports.reduce((sum, r) => sum + BigInt(r.gasUsed), 0n).toString(),
                averageGas: this.reports.length > 0 ? 
                    (this.reports.reduce((sum, r) => sum + BigInt(r.gasUsed), 0n) / BigInt(this.reports.length)).toString() : "0"
            }
        };
    }

    /**
     * Compare gas usage between two operations
     */
    compareOperations(op1Name, op2Name) {
        const op1 = this.reports.find(r => r.name === op1Name);
        const op2 = this.reports.find(r => r.name === op2Name);
        
        if (!op1 || !op2) {
            console.log("One or both operations not found");
            return null;
        }
        
        const gas1 = BigInt(op1.gasUsed);
        const gas2 = BigInt(op2.gasUsed);
        const difference = gas1 - gas2;
        const percentDiff = (difference * 100n) / gas2;
        
        console.log(`\nGas Comparison:`);
        console.log(`${op1Name}: ${gas1} gas`);
        console.log(`${op2Name}: ${gas2} gas`);
        console.log(`Difference: ${difference} gas (${percentDiff}%)`);
        
        return { gas1, gas2, difference, percentDiff };
    }

    /**
     * Analyze gas optimization opportunities
     */
    analyzeOptimizations() {
        console.log("\n=== Gas Optimization Analysis ===\n");
        
        const optimizations = [];
        
        // Check for expensive methods
        for (const [contract, report] of Object.entries(this.contractReports)) {
            for (const [method, stats] of Object.entries(report.methods)) {
                if (stats.avgGas > 100000n) {
                    optimizations.push({
                        contract,
                        method,
                        avgGas: stats.avgGas,
                        suggestion: "Consider optimizing storage access or computation"
                    });
                }
                
                if (stats.maxGas > stats.minGas * 2n) {
                    optimizations.push({
                        contract,
                        method,
                        variance: stats.maxGas - stats.minGas,
                        suggestion: "High gas variance - check for conditional logic optimization"
                    });
                }
            }
        }
        
        // Check deployment costs
        for (const [contract, report] of Object.entries(this.contractReports)) {
            if (report.deployment && BigInt(report.deployment.gasUsed) > 3000000n) {
                optimizations.push({
                    contract,
                    type: "deployment",
                    gasUsed: report.deployment.gasUsed,
                    suggestion: "Consider splitting contract or optimizing storage layout"
                });
            }
        }
        
        if (optimizations.length > 0) {
            console.log("Optimization Opportunities Found:");
            optimizations.forEach((opt, i) => {
                console.log(`\n${i + 1}. ${opt.contract}${opt.method ? '.' + opt.method : ''}`);
                console.log(`   Issue: ${opt.suggestion}`);
                if (opt.avgGas) console.log(`   Average Gas: ${opt.avgGas}`);
                if (opt.variance) console.log(`   Gas Variance: ${opt.variance}`);
                if (opt.gasUsed) console.log(`   Gas Used: ${opt.gasUsed}`);
            });
        } else {
            console.log("No major optimization opportunities identified");
        }
        
        console.log("\n" + "=".repeat(60) + "\n");
    }
}

// Singleton instance
const gasReporter = new GasReporter();

export default gasReporter;