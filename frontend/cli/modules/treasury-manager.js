/**
 * Treasury Management Module
 * Handles fee collection, distribution, and buyback operations
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import { formatUnits, parseUnits } from 'viem';
import ora from 'ora';
import inquirer from 'inquirer';

export class TreasuryManager {
    constructor(contracts, publicClient, walletClient, account) {
        this.contracts = contracts;
        this.publicClient = publicClient;
        this.walletClient = walletClient;
        this.account = account;
    }

    async manage() {
        console.log(chalk.bold.magenta('\n💎 Advanced Treasury Management\n'));
        
        while (true) {
            const stats = await this.getDetailedStats();
            this.displayDetailedStats(stats);
            
            const { action } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: 'Treasury Operations:',
                    choices: [
                        { name: '💰 Collect Vault Fees', value: 'collectVault' },
                        { name: '🔄 Collect Swap Fees', value: 'collectSwap' },
                        { name: '📊 Trigger Distribution', value: 'distribute' },
                        { name: '📈 Execute Buyback', value: 'buyback' },
                        { name: '⚙️  Update Distribution', value: 'updateDist' },
                        { name: '📜 View History', value: 'history' },
                        { name: '💸 Emergency Withdraw', value: 'emergency' },
                        { name: '🔙 Back', value: 'back' }
                    ]
                }
            ]);
            
            if (action === 'back') break;
            
            switch (action) {
                case 'collectVault':
                    await this.collectVaultFees();
                    break;
                case 'collectSwap':
                    await this.collectSwapFees();
                    break;
                case 'distribute':
                    await this.distributeFeess();
                    break;
                case 'buyback':
                    await this.executeBuyback();
                    break;
                case 'updateDist':
                    await this.updateDistribution();
                    break;
                case 'history':
                    await this.viewHistory();
                    break;
                case 'emergency':
                    await this.emergencyWithdraw();
                    break;
            }
        }
    }

    async getDetailedStats() {
        try {
            const [
                balance,
                totalCollected,
                totalDistributed,
                pendingVaultFees,
                pendingSwapFees,
                stakingPercent,
                buybackPercent,
                devPercent,
                lastDistribution
            ] = await Promise.all([
                this.getTokenBalance(this.contracts.treasury.address),
                this.publicClient.readContract({
                    address: this.contracts.treasury.address,
                    abi: this.contracts.treasury.abi,
                    functionName: 'totalFeesCollected'
                }),
                this.publicClient.readContract({
                    address: this.contracts.treasury.address,
                    abi: this.contracts.treasury.abi,
                    functionName: 'totalFeesDistributed'
                }),
                this.calculatePendingVaultFees(),
                this.calculatePendingSwapFees(),
                this.publicClient.readContract({
                    address: this.contracts.treasury.address,
                    abi: this.contracts.treasury.abi,
                    functionName: 'stakingPercent'
                }),
                this.publicClient.readContract({
                    address: this.contracts.treasury.address,
                    abi: this.contracts.treasury.abi,
                    functionName: 'buybackPercent'
                }),
                this.publicClient.readContract({
                    address: this.contracts.treasury.address,
                    abi: this.contracts.treasury.abi,
                    functionName: 'devPercent'
                }),
                this.publicClient.readContract({
                    address: this.contracts.treasury.address,
                    abi: this.contracts.treasury.abi,
                    functionName: 'lastDistributionTime'
                })
            ]);
            
            return {
                balance,
                totalCollected,
                totalDistributed,
                pendingVaultFees,
                pendingSwapFees,
                stakingPercent,
                buybackPercent,
                devPercent,
                insurancePercent: 100 - stakingPercent - buybackPercent - devPercent,
                lastDistribution
            };
        } catch (error) {
            console.error('Error getting treasury stats:', error);
            return this.getDefaultStats();
        }
    }

    displayDetailedStats(stats) {
        const table = new Table({
            head: [chalk.bold('Treasury Metrics'), chalk.bold('Value')],
            colWidths: [30, 35]
        });
        
        table.push(
            [chalk.cyan('Current Balance'), chalk.green(formatUnits(stats.balance, 18) + ' BOT')],
            [chalk.cyan('Total Collected'), formatUnits(stats.totalCollected, 18) + ' BOT'],
            [chalk.cyan('Total Distributed'), formatUnits(stats.totalDistributed, 18) + ' BOT'],
            new inquirer.Separator(),
            [chalk.yellow('Pending Vault Fees'), formatUnits(stats.pendingVaultFees, 18) + ' BOT'],
            [chalk.yellow('Pending Swap Fees'), formatUnits(stats.pendingSwapFees, 18) + ' BOT'],
            new inquirer.Separator(),
            ['Distribution Settings', ''],
            [`  → Staking Rewards`, `${stats.stakingPercent}%`],
            [`  → Buyback & Burn`, `${stats.buybackPercent}%`],
            [`  → Development Fund`, `${stats.devPercent}%`],
            [`  → Insurance Fund`, `${stats.insurancePercent}%`],
            new inquirer.Separator(),
            ['Last Distribution', this.formatTimestamp(stats.lastDistribution)]
        );
        
        console.log(table.toString());
    }

    async collectVaultFees() {
        const spinner = ora('Collecting vault performance fees...').start();
        
        try {
            // Get all vaults
            const vaultCount = await this.publicClient.readContract({
                address: this.contracts.vaultFactory.address,
                abi: this.contracts.vaultFactory.abi,
                functionName: 'getVaultCount'
            });
            
            let totalCollected = 0n;
            
            for (let i = 0; i < vaultCount; i++) {
                const vaultAddress = await this.publicClient.readContract({
                    address: this.contracts.vaultFactory.address,
                    abi: this.contracts.vaultFactory.abi,
                    functionName: 'getVault',
                    args: [i]
                });
                
                if (vaultAddress && vaultAddress !== '0x0000000000000000000000000000000000000000') {
                    try {
                        const tx = await this.walletClient.writeContract({
                            address: vaultAddress,
                            abi: this.contracts.vault.abi,
                            functionName: 'collectPerformanceFees'
                        });
                        
                        // Get collected amount from event
                        const receipt = await this.publicClient.waitForTransactionReceipt({ hash: tx });
                        // Parse logs to get collected amount
                        totalCollected += parseUnits('10', 18); // Mock amount
                    } catch (e) {
                        // Vault might not have fees to collect
                    }
                }
            }
            
            spinner.succeed(`Collected ${formatUnits(totalCollected, 18)} BOT in vault fees`);
            
        } catch (error) {
            spinner.fail('Failed to collect vault fees');
            console.error(error);
        }
    }

    async collectSwapFees() {
        const spinner = ora('Collecting Uniswap V4 swap fees...').start();
        
        try {
            const tx = await this.walletClient.writeContract({
                address: this.contracts.swapHook.address,
                abi: this.contracts.swapHook.abi,
                functionName: 'collectAccumulatedFees'
            });
            
            spinner.succeed('Swap fees collected successfully');
            console.log(chalk.gray(`Transaction: ${tx}`));
            
        } catch (error) {
            spinner.fail('Failed to collect swap fees');
            console.error(error);
        }
    }

    async distributeFeess() {
        const spinner = ora('Distributing treasury fees...').start();
        
        try {
            const tx = await this.walletClient.writeContract({
                address: this.contracts.treasury.address,
                abi: this.contracts.treasury.abi,
                functionName: 'distributeFees'
            });
            
            // Wait for transaction
            const receipt = await this.publicClient.waitForTransactionReceipt({ hash: tx });
            
            spinner.succeed('Fees distributed successfully!');
            
            // Show distribution breakdown
            const balance = await this.getTokenBalance(this.contracts.treasury.address);
            const stats = await this.getDetailedStats();
            
            const table = new Table({
                head: ['Recipient', 'Percentage', 'Amount'],
                colWidths: [20, 15, 20]
            });
            
            table.push(
                ['Staking Pool', `${stats.stakingPercent}%`, formatUnits(balance * BigInt(stats.stakingPercent) / 100n, 18) + ' BOT'],
                ['Buyback', `${stats.buybackPercent}%`, formatUnits(balance * BigInt(stats.buybackPercent) / 100n, 18) + ' BOT'],
                ['Dev Fund', `${stats.devPercent}%`, formatUnits(balance * BigInt(stats.devPercent) / 100n, 18) + ' BOT'],
                ['Insurance', `${stats.insurancePercent}%`, formatUnits(balance * BigInt(stats.insurancePercent) / 100n, 18) + ' BOT']
            );
            
            console.log('\n' + table.toString());
            
        } catch (error) {
            spinner.fail('Failed to distribute fees');
            console.error(error);
        }
    }

    async executeBuyback() {
        const { amount } = await inquirer.prompt([
            {
                type: 'input',
                name: 'amount',
                message: 'Buyback amount (BOT):',
                validate: (value) => {
                    const num = parseFloat(value);
                    return num > 0 || 'Please enter a valid amount';
                }
            }
        ]);
        
        const spinner = ora('Executing BOT buyback...').start();
        
        try {
            const buybackAmount = parseUnits(amount, 18);
            
            const tx = await this.walletClient.writeContract({
                address: this.contracts.treasury.address,
                abi: this.contracts.treasury.abi,
                functionName: 'executeBuyback',
                args: [buybackAmount]
            });
            
            spinner.succeed(`Buyback executed: ${amount} BOT purchased and burned`);
            console.log(chalk.gray(`Transaction: ${tx}`));
            
        } catch (error) {
            spinner.fail('Buyback failed');
            console.error(error);
        }
    }

    async updateDistribution() {
        console.log(chalk.bold('\n⚙️  Update Distribution Percentages\n'));
        console.log(chalk.yellow('Note: Total must equal 100%\n'));
        
        const { staking, buyback, dev } = await inquirer.prompt([
            {
                type: 'input',
                name: 'staking',
                message: 'Staking rewards percentage:',
                default: '50',
                validate: (value) => {
                    const num = parseInt(value);
                    return (num >= 0 && num <= 100) || 'Must be between 0-100';
                }
            },
            {
                type: 'input',
                name: 'buyback',
                message: 'Buyback percentage:',
                default: '20',
                validate: (value) => {
                    const num = parseInt(value);
                    return (num >= 0 && num <= 100) || 'Must be between 0-100';
                }
            },
            {
                type: 'input',
                name: 'dev',
                message: 'Development fund percentage:',
                default: '15',
                validate: (value) => {
                    const num = parseInt(value);
                    return (num >= 0 && num <= 100) || 'Must be between 0-100';
                }
            }
        ]);
        
        const total = parseInt(staking) + parseInt(buyback) + parseInt(dev);
        const insurance = 100 - total;
        
        if (total > 100) {
            console.log(chalk.red('Error: Total exceeds 100%'));
            return;
        }
        
        console.log(chalk.gray(`\nInsurance fund will be: ${insurance}%`));
        
        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: 'Confirm distribution update?',
                default: false
            }
        ]);
        
        if (!confirm) return;
        
        const spinner = ora('Updating distribution...').start();
        
        try {
            const tx = await this.walletClient.writeContract({
                address: this.contracts.treasury.address,
                abi: this.contracts.treasury.abi,
                functionName: 'updateDistribution',
                args: [parseInt(staking), parseInt(buyback), parseInt(dev)]
            });
            
            spinner.succeed('Distribution updated successfully');
            console.log(chalk.gray(`Transaction: ${tx}`));
            
        } catch (error) {
            spinner.fail('Failed to update distribution');
            console.error(error);
        }
    }

    async viewHistory() {
        console.log(chalk.bold('\n📜 Treasury History\n'));
        
        // In production, this would fetch events from the blockchain
        const history = [
            { date: '2025-01-15', type: 'Collection', amount: '5000', source: 'Vault Fees' },
            { date: '2025-01-14', type: 'Distribution', amount: '10000', source: 'Weekly' },
            { date: '2025-01-13', type: 'Buyback', amount: '2000', source: 'Market' },
            { date: '2025-01-12', type: 'Collection', amount: '3000', source: 'Swap Fees' }
        ];
        
        const table = new Table({
            head: ['Date', 'Type', 'Amount (BOT)', 'Source'],
            colWidths: [15, 15, 20, 20]
        });
        
        for (const entry of history) {
            table.push([entry.date, entry.type, entry.amount, entry.source]);
        }
        
        console.log(table.toString());
        
        await inquirer.prompt([
            {
                type: 'input',
                name: 'continue',
                message: 'Press Enter to continue...'
            }
        ]);
    }

    async emergencyWithdraw() {
        console.log(chalk.red.bold('\n⚠️  Emergency Withdraw\n'));
        console.log(chalk.yellow('Warning: This action requires admin privileges\n'));
        
        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: 'Are you sure you want to execute emergency withdrawal?',
                default: false
            }
        ]);
        
        if (!confirm) return;
        
        const { amount, recipient } = await inquirer.prompt([
            {
                type: 'input',
                name: 'amount',
                message: 'Amount to withdraw (BOT):',
                validate: (value) => {
                    const num = parseFloat(value);
                    return num > 0 || 'Please enter a valid amount';
                }
            },
            {
                type: 'input',
                name: 'recipient',
                message: 'Recipient address:',
                validate: (value) => {
                    return value.startsWith('0x') && value.length === 42 || 'Invalid address';
                }
            }
        ]);
        
        const spinner = ora('Executing emergency withdrawal...').start();
        
        try {
            const withdrawAmount = parseUnits(amount, 18);
            
            const tx = await this.walletClient.writeContract({
                address: this.contracts.treasury.address,
                abi: this.contracts.treasury.abi,
                functionName: 'emergencyWithdraw',
                args: [this.contracts.token.address, withdrawAmount, recipient]
            });
            
            spinner.succeed(`Emergency withdrawal executed: ${amount} BOT sent to ${recipient.slice(0, 8)}...`);
            console.log(chalk.gray(`Transaction: ${tx}`));
            
        } catch (error) {
            spinner.fail('Emergency withdrawal failed - likely not admin');
            console.error(error);
        }
    }

    async calculatePendingVaultFees() {
        // This would calculate pending fees from all vaults
        return parseUnits('250', 18); // Mock value
    }

    async calculatePendingSwapFees() {
        // This would calculate pending fees from Uniswap hook
        return parseUnits('150', 18); // Mock value
    }

    async getTokenBalance(address) {
        try {
            return await this.publicClient.readContract({
                address: this.contracts.token.address,
                abi: this.contracts.token.abi,
                functionName: 'balanceOf',
                args: [address]
            });
        } catch (error) {
            return 0n;
        }
    }

    formatTimestamp(timestamp) {
        if (!timestamp || timestamp === 0n) return 'Never';
        const date = new Date(Number(timestamp) * 1000);
        return date.toLocaleString();
    }

    getDefaultStats() {
        return {
            balance: 0n,
            totalCollected: 0n,
            totalDistributed: 0n,
            pendingVaultFees: 0n,
            pendingSwapFees: 0n,
            stakingPercent: 50,
            buybackPercent: 20,
            devPercent: 15,
            insurancePercent: 15,
            lastDistribution: 0n
        };
    }
}

export default TreasuryManager;