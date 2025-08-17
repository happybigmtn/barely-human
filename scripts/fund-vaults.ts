// Fund bot vaults with BOT tokens for testing
import { network } from "hardhat";
import { formatEther, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY!;

// Contract addresses
const BOT_TOKEN = "0xedbce0a53a24f9e5f4684937ed3ee64e936cd048";
const TREASURY = "0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a";

// Bot vault addresses (Alice first for testing)
const BOT_VAULTS = [
  { name: "Alice All-In", address: "0xbbb3749e98f69aab8479e36a8c9bb20e57eca5a7" },
  { name: "Bob Calculator", address: "0xd5e6deb92ce3c92094d71f882aa4b4413c84d963" },
  { name: "Charlie Lucky", address: "0x630b32e728213642696aca275adf99785f828f8f" },
  { name: "Diana Ice Queen", address: "0x5afc95bbffd63d3f710f65942c1e19dd1e02e96d" },
  { name: "Eddie Entertainer", address: "0xbe3640bc365bbbd494bd845cf7971763555224ef" },
];

// ERC20 ABI (minimal)
const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable"
  },
  {
    name: "decimals",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view"
  },
  {
    name: "totalSupply",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  }
];

async function main() {
  console.log("💰 Funding bot vaults with BOT tokens...\n");

  const connection = await network.connect();
  const { viem } = connection;

  const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY as `0x${string}`);
  console.log(`📍 Deployer: ${account.address}`);
  
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();
  
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`💰 ETH Balance: ${formatEther(balance)} ETH\n`);

  try {
    // Check BOT token details
    console.log("📊 BOT Token Status:");
    
    const totalSupply = await publicClient.readContract({
      address: BOT_TOKEN as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "totalSupply"
    }) as bigint;
    
    const decimals = await publicClient.readContract({
      address: BOT_TOKEN as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "decimals"
    }) as number;
    
    const deployerBalance = await publicClient.readContract({
      address: BOT_TOKEN as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account.address]
    }) as bigint;
    
    const treasuryBalance = await publicClient.readContract({
      address: BOT_TOKEN as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [TREASURY]
    }) as bigint;

    console.log(`   Total Supply: ${formatEther(totalSupply)} BOT`);
    console.log(`   Decimals: ${decimals}`);
    console.log(`   Deployer Balance: ${formatEther(deployerBalance)} BOT`);
    console.log(`   Treasury Balance: ${formatEther(treasuryBalance)} BOT\n`);

    // Check current vault balances
    console.log("🏦 Current Vault Balances:");
    for (const vault of BOT_VAULTS) {
      const vaultBalance = await publicClient.readContract({
        address: BOT_TOKEN as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [vault.address]
      }) as bigint;
      
      console.log(`   ${vault.name}: ${formatEther(vaultBalance)} BOT`);
    }

    // Determine funding strategy
    const fundingAmount = parseEther("100000"); // 100K BOT per vault for testing
    const totalNeeded = fundingAmount * BigInt(BOT_VAULTS.length);
    
    console.log("\n💡 Funding Strategy:");
    console.log(`   Amount per vault: ${formatEther(fundingAmount)} BOT`);
    console.log(`   Total needed: ${formatEther(totalNeeded)} BOT`);
    
    if (deployerBalance >= totalNeeded) {
      console.log("   ✅ Sufficient deployer balance for funding");
      
      // Fund vaults from deployer balance
      console.log("\n🚀 Funding vaults from deployer balance...");
      
      for (const vault of BOT_VAULTS) {
        try {
          console.log(`   Funding ${vault.name}...`);
          
          const tx = await walletClient.writeContract({
            address: BOT_TOKEN as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "transfer",
            args: [vault.address as `0x${string}`, fundingAmount],
            gas: 100000n
          });
          
          await publicClient.waitForTransactionReceipt({ hash: tx });
          console.log(`   ✅ ${vault.name} funded with ${formatEther(fundingAmount)} BOT`);
          
        } catch (error: any) {
          console.log(`   ❌ Failed to fund ${vault.name}: ${error.message?.substring(0, 50)}`);
        }
      }
      
    } else if (treasuryBalance >= totalNeeded) {
      console.log("   💡 Treasury has sufficient balance but needs approval");
      console.log("   ⚠️ Manual action required: Transfer from Treasury to vaults");
      
    } else {
      console.log("   ⚠️ Insufficient BOT tokens for full funding");
      console.log("   💡 Consider minting more tokens or reducing funding amount");
    }

    // Check final vault balances
    console.log("\n📈 Final Vault Balances:");
    for (const vault of BOT_VAULTS) {
      const vaultBalance = await publicClient.readContract({
        address: BOT_TOKEN as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [vault.address]
      }) as bigint;
      
      const status = vaultBalance > 0n ? "✅ Funded" : "❌ Empty";
      console.log(`   ${vault.name}: ${formatEther(vaultBalance)} BOT (${status})`);
    }

    console.log("\n🎯 Next Steps:");
    console.log("   1. Verify at least Alice's vault has BOT tokens");
    console.log("   2. Add VRF consumers via Chainlink dashboard");
    console.log("   3. Run first test game series");
    console.log("   4. Monitor vault balances during gameplay");

  } catch (error: any) {
    console.error("❌ Error funding vaults:", error.message);
  } finally {
    await connection.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });