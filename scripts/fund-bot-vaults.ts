// Fund Bot Vaults with BOT Tokens
// Network: Base Sepolia
// Purpose: Transfer BOT tokens to each vault for initial liquidity

import { createWalletClient, createPublicClient, http, parseEther, formatEther } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';

dotenv.config();

// Contract addresses from deployment
const ADDRESSES = {
  BOTToken: "0xedbce0a53a24f9e5f4684937ed3ee64e936cd048",
  Treasury: "0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a",
  BotVaults: {
    Alice: "0xbbb3749e98f69aab8479e36a8c9bb20e57eca5a7",
    Bob: "0xd5e6deb92ce3c92094d71f882aa4b4413c84d963", 
    Charlie: "0x630b32e728213642696aca275adf99785f828f8f",
    Diana: "0x5afc95bbffd63d3f710f65942c1e19dd1e02e96d",
    Eddie: "0xbe3640bc365bbbd494bd845cf7971763555224ef",
    Fiona: "0x08a2e185da382f8a8c81101ecdb9389767a93e32",
    Greg: "0xff915c886e0395c3b17f60c961ffbe9fb2939524",
    Helen: "0x857e21b68440dbcd6eee5ef606ce3c10f9590f33",
    Ivan: "0xfcc050bb159bfc49cefa59efddaa02fd7709df8f",
    Julia: "0xd168d2d603b946d86be55e1b949c08b3e9ee6fbf"
  }
};

// ERC20 ABI for transfers
const ERC20_ABI = [
  {
    "inputs": [{"name": "to", "type": "address"}, {"name": "amount", "type": "uint256"}],
    "name": "transfer",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "account", "type": "address"}],
    "name": "balanceOf", 
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

async function main() {
  console.log('🎯 Funding Bot Vaults with BOT Tokens');
  console.log('Network: Base Sepolia');
  console.log('');

  // Setup clients
  const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`);
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL)
  });
  
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia, 
    transport: http(process.env.BASE_SEPOLIA_RPC_URL)
  });

  console.log(`💰 Funding from: ${account.address}`);
  console.log('');

  // Check deployer BOT balance
  const deployerBalance = await publicClient.readContract({
    address: ADDRESSES.BOTToken as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address]
  });

  console.log(`📊 Deployer BOT Balance: ${formatEther(deployerBalance as bigint)} BOT`);
  console.log('');

  // Funding amount per vault (10,000 BOT each)
  const fundingAmount = parseEther('10000'); // 10,000 BOT tokens
  const totalNeeded = parseEther('100000'); // 10 vaults × 10,000 BOT

  if (deployerBalance < totalNeeded) {
    console.log('❌ Insufficient BOT balance for funding');
    console.log(`   Required: ${formatEther(totalNeeded)} BOT`);
    console.log(`   Available: ${formatEther(deployerBalance as bigint)} BOT`);
    return;
  }

  console.log('💸 Funding each vault with 10,000 BOT tokens...');
  console.log('');

  // Fund each bot vault
  for (const [botName, vaultAddress] of Object.entries(ADDRESSES.BotVaults)) {
    try {
      console.log(`🤖 Funding ${botName} vault...`);
      console.log(`   Address: ${vaultAddress}`);
      console.log(`   Amount: 10,000 BOT`);

      const hash = await walletClient.writeContract({
        address: ADDRESSES.BOTToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [vaultAddress as `0x${string}`, fundingAmount]
      });

      console.log(`   Transaction: ${hash}`);
      
      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      
      if (receipt.status === 'success') {
        console.log(`   ✅ ${botName} funded successfully`);
        
        // Check vault balance
        const vaultBalance = await publicClient.readContract({
          address: ADDRESSES.BOTToken as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [vaultAddress as `0x${string}`]
        });
        
        console.log(`   💰 Vault Balance: ${formatEther(vaultBalance as bigint)} BOT`);
      } else {
        console.log(`   ❌ ${botName} funding failed`);
      }
      
      console.log('');
      
      // Small delay between transactions
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.log(`   ❌ Error funding ${botName}: ${error}`);
      console.log('');
    }
  }

  // Final balance check
  const finalBalance = await publicClient.readContract({
    address: ADDRESSES.BOTToken as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address]
  });

  console.log('📊 Final Status:');
  console.log(`   Deployer Balance: ${formatEther(finalBalance as bigint)} BOT`);
  console.log(`   Total Distributed: ${formatEther((deployerBalance as bigint) - (finalBalance as bigint))} BOT`);
  console.log('');

  // Verify all vault balances
  console.log('🔍 Vault Balance Summary:');
  for (const [botName, vaultAddress] of Object.entries(ADDRESSES.BotVaults)) {
    const balance = await publicClient.readContract({
      address: ADDRESSES.BOTToken as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [vaultAddress as `0x${string}`]
    });
    
    console.log(`   ${botName.padEnd(8)}: ${formatEther(balance as bigint).padStart(8)} BOT`);
  }

  console.log('');
  console.log('✅ Bot vault funding complete!');
  console.log('');
  console.log('📋 Next Steps:');
  console.log('   1. Add VRF consumers (BotManager + GachaMintPass)');
  console.log('   2. Run comprehensive game testing');
  console.log('   3. Deploy Uniswap V4 hooks');
  console.log('   4. Start bot automation system');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });