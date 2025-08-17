import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hardhatChain } from '../../config/chains.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * User Wallet Manager for Interactive Casino CLI
 * Handles wallet creation, import, funding, and secure storage
 */

export class WalletManager {
    constructor() {
        this.walletsDir = path.join(__dirname, '../../wallets');
        this.deployments = this.loadDeployments();
        this.publicClient = null;
        this.currentWallet = null;
        
        // Ensure wallets directory exists
        if (!fs.existsSync(this.walletsDir)) {
            fs.mkdirSync(this.walletsDir, { recursive: true });
        }
    }
    
    loadDeployments() {
        const deploymentPath = path.join(__dirname, '../../deployments/localhost.json');
        if (!fs.existsSync(deploymentPath)) {
            throw new Error('No deployment found. Run deployment script first.');
        }
        return JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    }
    
    async initialize() {
        this.publicClient = createPublicClient({
            chain: hardhatChain,
            transport: http('http://127.0.0.1:8545')
        });
    }
    
    /**
     * Simple encryption for wallet storage (development only)
     */
    encryptPrivateKey(privateKey, password) {
        const cipher = crypto.createCipher('aes192', password);
        let encrypted = cipher.update(privateKey, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }
    
    decryptPrivateKey(encryptedKey, password) {
        try {
            const decipher = crypto.createDecipher('aes192', password);
            let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (error) {
            throw new Error('Invalid password or corrupted wallet file');
        }
    }
    
    /**
     * Generate a new wallet
     */
    generateWallet(name, password) {
        console.log(`🔐 Generating new wallet: ${name}...`);
        
        // Generate secure private key
        const privateKey = '0x' + crypto.randomBytes(32).toString('hex');
        const account = privateKeyToAccount(privateKey);
        
        // Encrypt private key
        const encryptedKey = this.encryptPrivateKey(privateKey, password);
        
        const walletData = {
            name,
            address: account.address,
            encryptedPrivateKey: encryptedKey,
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString(),
            version: '1.0'
        };
        
        // Save wallet file
        const walletPath = path.join(this.walletsDir, `${name.toLowerCase()}.json`);
        fs.writeFileSync(walletPath, JSON.stringify(walletData, null, 2));
        
        console.log(`✅ Wallet created: ${account.address}`);
        console.log(`💾 Saved to: ${walletPath}`);
        
        return {
            name,
            address: account.address,
            path: walletPath
        };
    }
    
    /**
     * Import existing wallet from private key
     */
    importWallet(name, privateKey, password) {
        console.log(`📥 Importing wallet: ${name}...`);
        
        // Validate private key
        if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
            throw new Error('Invalid private key format');
        }
        
        const account = privateKeyToAccount(privateKey);
        
        // Encrypt private key
        const encryptedKey = this.encryptPrivateKey(privateKey, password);
        
        const walletData = {
            name,
            address: account.address,
            encryptedPrivateKey: encryptedKey,
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString(),
            version: '1.0',
            imported: true
        };
        
        // Save wallet file
        const walletPath = path.join(this.walletsDir, `${name.toLowerCase()}.json`);
        fs.writeFileSync(walletPath, JSON.stringify(walletData, null, 2));
        
        console.log(`✅ Wallet imported: ${account.address}`);
        console.log(`💾 Saved to: ${walletPath}`);
        
        return {
            name,
            address: account.address,
            path: walletPath
        };
    }
    
    /**
     * Load and unlock wallet
     */
    async loadWallet(name, password) {
        console.log(`🔓 Loading wallet: ${name}...`);
        
        const walletPath = path.join(this.walletsDir, `${name.toLowerCase()}.json`);
        
        if (!fs.existsSync(walletPath)) {
            throw new Error(`Wallet '${name}' not found`);
        }
        
        const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
        
        // Decrypt private key
        const privateKey = this.decryptPrivateKey(walletData.encryptedPrivateKey, password);
        const account = privateKeyToAccount(privateKey);
        
        // Verify address matches
        if (account.address.toLowerCase() !== walletData.address.toLowerCase()) {
            throw new Error('Wallet integrity check failed');
        }
        
        // Create wallet client
        const walletClient = createWalletClient({
            account,
            chain: hardhatChain,
            transport: http('http://127.0.0.1:8545')
        });
        
        // Update last used
        walletData.lastUsed = new Date().toISOString();
        fs.writeFileSync(walletPath, JSON.stringify(walletData, null, 2));
        
        this.currentWallet = {
            name: walletData.name,
            address: account.address,
            account,
            walletClient,
            data: walletData
        };
        
        console.log(`✅ Wallet loaded: ${account.address}`);
        return this.currentWallet;
    }
    
    /**
     * List available wallets
     */
    listWallets() {
        const walletFiles = fs.readdirSync(this.walletsDir).filter(f => f.endsWith('.json'));
        
        if (walletFiles.length === 0) {
            return [];
        }
        
        const wallets = walletFiles.map(file => {
            const walletPath = path.join(this.walletsDir, file);
            const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
            return {
                name: walletData.name,
                address: walletData.address,
                createdAt: walletData.createdAt,
                lastUsed: walletData.lastUsed,
                imported: walletData.imported || false
            };
        });
        
        return wallets.sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed));
    }
    
    /**
     * Check wallet balances
     */
    async checkBalances(address = null) {
        const targetAddress = address || this.currentWallet?.address;
        if (!targetAddress) {
            throw new Error('No wallet loaded or address provided');
        }
        
        const ethBalance = await this.publicClient.getBalance({ address: targetAddress });
        
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
            args: [targetAddress]
        });
        
        return {
            address: targetAddress,
            eth: ethBalance,
            botToken: botTokenBalance,
            ethFormatted: formatEther(ethBalance),
            botTokenFormatted: formatEther(botTokenBalance)
        };
    }
    
    /**
     * Request funding for current wallet
     */
    async requestFunding(amount = null) {
        if (!this.currentWallet) {
            throw new Error('No wallet loaded');
        }
        
        console.log(`💰 Requesting funding for ${this.currentWallet.address}...`);
        
        // Default funding amounts
        const ethAmount = amount?.eth || parseEther("0.05");
        const botAmount = amount?.bot || parseEther("5000");
        
        try {
            // Import and use the funding manager
            const { WalletFundingManager } = await import('../scripts/fund-accounts.ts');
            const fundingManager = new WalletFundingManager();
            
            await fundingManager.initialize();
            
            // Create user wallet in funding system
            fundingManager.createUserWallet(
                this.currentWallet.name,
                this.currentWallet.name,
                this.currentWallet.account.privateKey
            );
            
            // Fund the wallet
            const success = await fundingManager.fundUserAccount(this.currentWallet.name, true);
            
            await fundingManager.cleanup();
            
            if (success) {
                console.log('✅ Funding successful!');
                return await this.checkBalances();
            } else {
                throw new Error('Funding failed');
            }
            
        } catch (error) {
            console.error('❌ Funding request failed:', error.message);
            throw error;
        }
    }
    
    /**
     * Send ETH transaction
     */
    async sendETH(to, amount) {
        if (!this.currentWallet) {
            throw new Error('No wallet loaded');
        }
        
        console.log(`💸 Sending ${formatEther(amount)} ETH to ${to}...`);
        
        const hash = await this.currentWallet.walletClient.sendTransaction({
            to,
            value: amount
        });
        
        const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
        
        console.log(`✅ Transaction sent: ${hash}`);
        return receipt;
    }
    
    /**
     * Send BOT tokens
     */
    async sendBOT(to, amount) {
        if (!this.currentWallet) {
            throw new Error('No wallet loaded');
        }
        
        console.log(`🪙 Sending ${formatEther(amount)} BOT to ${to}...`);
        
        const hash = await this.currentWallet.walletClient.writeContract({
            address: this.deployments.contracts.BOTToken,
            abi: [
                {
                    name: "transfer",
                    type: "function",
                    stateMutability: "nonpayable",
                    inputs: [
                        { name: "to", type: "address" },
                        { name: "amount", type: "uint256" }
                    ],
                    outputs: [{ name: "", type: "bool" }]
                }
            ],
            functionName: "transfer",
            args: [to, amount]
        });
        
        const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
        
        console.log(`✅ Transfer sent: ${hash}`);
        return receipt;
    }
    
    /**
     * Approve BOT token spending
     */
    async approveBOT(spender, amount) {
        if (!this.currentWallet) {
            throw new Error('No wallet loaded');
        }
        
        console.log(`✅ Approving ${formatEther(amount)} BOT for ${spender}...`);
        
        const hash = await this.currentWallet.walletClient.writeContract({
            address: this.deployments.contracts.BOTToken,
            abi: [
                {
                    name: "approve",
                    type: "function",
                    stateMutability: "nonpayable",
                    inputs: [
                        { name: "spender", type: "address" },
                        { name: "amount", type: "uint256" }
                    ],
                    outputs: [{ name: "", type: "bool" }]
                }
            ],
            functionName: "approve",
            args: [spender, amount]
        });
        
        const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
        
        console.log(`✅ Approval sent: ${hash}`);
        return receipt;
    }
    
    /**
     * Export wallet (show private key)
     */
    exportWallet(name, password) {
        console.log(`🔑 Exporting wallet: ${name}...`);
        
        const walletPath = path.join(this.walletsDir, `${name.toLowerCase()}.json`);
        
        if (!fs.existsSync(walletPath)) {
            throw new Error(`Wallet '${name}' not found`);
        }
        
        const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
        
        // Decrypt private key
        const privateKey = this.decryptPrivateKey(walletData.encryptedPrivateKey, password);
        
        console.log(`⚠️  PRIVATE KEY (keep secure): ${privateKey}`);
        console.log(`📍 Address: ${walletData.address}`);
        
        return {
            privateKey,
            address: walletData.address,
            name: walletData.name
        };
    }
    
    /**
     * Delete wallet
     */
    deleteWallet(name, password) {
        console.log(`🗑️  Deleting wallet: ${name}...`);
        
        const walletPath = path.join(this.walletsDir, `${name.toLowerCase()}.json`);
        
        if (!fs.existsSync(walletPath)) {
            throw new Error(`Wallet '${name}' not found`);
        }
        
        // Verify password first
        const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
        this.decryptPrivateKey(walletData.encryptedPrivateKey, password);
        
        // Delete file
        fs.unlinkSync(walletPath);
        
        // Clear current wallet if it's the one being deleted
        if (this.currentWallet && this.currentWallet.name === name) {
            this.currentWallet = null;
        }
        
        console.log(`✅ Wallet '${name}' deleted`);
    }
    
    /**
     * Get current wallet info
     */
    getCurrentWallet() {
        return this.currentWallet;
    }
    
    /**
     * Sign message
     */
    async signMessage(message) {
        if (!this.currentWallet) {
            throw new Error('No wallet loaded');
        }
        
        const signature = await this.currentWallet.walletClient.signMessage({
            message
        });
        
        return signature;
    }
    
    /**
     * Interactive wallet setup for CLI
     */
    async setupWalletInteractive() {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const question = (query) => new Promise(resolve => rl.question(query, resolve));
        
        try {
            console.log('\n🎮 Welcome to Barely Human Casino!');
            console.log('Let\'s set up your wallet...\n');
            
            const wallets = this.listWallets();
            
            if (wallets.length > 0) {
                console.log('📁 Existing wallets:');
                wallets.forEach((wallet, index) => {
                    const lastUsed = new Date(wallet.lastUsed).toLocaleString();
                    console.log(`  ${index + 1}. ${wallet.name} (${wallet.address}) - ${lastUsed}`);
                });
                console.log(`  ${wallets.length + 1}. Create new wallet`);
                console.log(`  ${wallets.length + 2}. Import existing wallet\n`);
                
                const choice = await question('Choose an option: ');
                const choiceNum = parseInt(choice);
                
                if (choiceNum >= 1 && choiceNum <= wallets.length) {
                    // Load existing wallet
                    const selectedWallet = wallets[choiceNum - 1];
                    const password = await question(`Enter password for ${selectedWallet.name}: `);
                    
                    await this.loadWallet(selectedWallet.name, password);
                    
                } else if (choiceNum === wallets.length + 1) {
                    // Create new wallet
                    const name = await question('Enter wallet name: ');
                    const password = await question('Enter password: ');
                    
                    this.generateWallet(name, password);
                    await this.loadWallet(name, password);
                    
                } else if (choiceNum === wallets.length + 2) {
                    // Import wallet
                    const name = await question('Enter wallet name: ');
                    const privateKey = await question('Enter private key: ');
                    const password = await question('Enter password: ');
                    
                    this.importWallet(name, privateKey, password);
                    await this.loadWallet(name, password);
                }
                
            } else {
                console.log('No existing wallets found.\n');
                
                const choice = await question('1. Create new wallet\n2. Import existing wallet\nChoose: ');
                
                if (choice === '1') {
                    const name = await question('Enter wallet name: ');
                    const password = await question('Enter password: ');
                    
                    this.generateWallet(name, password);
                    await this.loadWallet(name, password);
                    
                } else if (choice === '2') {
                    const name = await question('Enter wallet name: ');
                    const privateKey = await question('Enter private key: ');
                    const password = await question('Enter password: ');
                    
                    this.importWallet(name, privateKey, password);
                    await this.loadWallet(name, password);
                }
            }
            
            // Check if wallet needs funding
            if (this.currentWallet) {
                const balances = await this.checkBalances();
                console.log(`\n💰 Current balances:`);
                console.log(`   ETH: ${balances.ethFormatted}`);
                console.log(`   BOT: ${balances.botTokenFormatted}`);
                
                if (parseFloat(balances.ethFormatted) < 0.01 || parseFloat(balances.botTokenFormatted) < 100) {
                    const fundChoice = await question('\n💸 Wallet needs funding. Request funding? (y/n): ');
                    if (fundChoice.toLowerCase() === 'y') {
                        await this.requestFunding();
                    }
                }
            }
            
        } finally {
            rl.close();
        }
        
        return this.currentWallet;
    }
}

export default WalletManager;