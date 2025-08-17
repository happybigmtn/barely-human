// Deploy VRF 2.5 Updated Contracts
// Network: Base Sepolia
// Purpose: Deploy updated contracts with Chainlink VRF 2.5 integration

import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';
import { network } from 'hardhat';

dotenv.config();

// VRF 2.5 Configuration for Base Sepolia
const VRF_CONFIG = {
  coordinator: "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634", // Base Sepolia VRF 2.5 Coordinator
  keyHash: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c", // 150 gwei Key Hash
  subscriptionId: 1, // Replace with your actual subscription ID
  linkToken: "0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196" // Base Sepolia LINK token
};

// Contract addresses from previous deployment
const EXISTING_ADDRESSES = {
  BOTToken: "0xedbce0a53a24f9e5f4684937ed3ee64e936cd048",
  Treasury: "0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a", 
  StakingPool: "0xc1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc2",
  CrapsBets: "0x7283196cb2aa54ebca3ec2198eb5a86215e627cb",
  CrapsSettlementSimple: "0xe156b261025e74a19b298c9d94260c744ae85d7f"
};

async function main() {
  console.log('🎯 Deploying VRF 2.5 Updated Contracts');
  console.log('Network: Base Sepolia');
  console.log('VRF Version: 2.5');
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

  console.log(`🚀 Deploying from: ${account.address}`);
  console.log(`🔗 VRF Coordinator: ${VRF_CONFIG.coordinator}`);
  console.log(`🔑 Key Hash: ${VRF_CONFIG.keyHash}`);
  console.log(`🎫 Subscription ID: ${VRF_CONFIG.subscriptionId}`);
  console.log('');

  // Get Hardhat network connection for contract deployment
  const connection = await network.connect();
  const { viem } = connection;

  const deployedContracts: Record<string, string> = {};

  try {
    // 1. Deploy CrapsGameV2Plus
    console.log('📋 1. Deploying CrapsGameV2Plus...');
    
    const crapsGameV2Plus = await viem.deployContract("CrapsGameV2Plus", [
      VRF_CONFIG.coordinator,
      BigInt(VRF_CONFIG.subscriptionId),
      VRF_CONFIG.keyHash
    ]);

    deployedContracts.CrapsGameV2Plus = crapsGameV2Plus.address;
    console.log(`   ✅ CrapsGameV2Plus: ${crapsGameV2Plus.address}`);
    console.log('');

    // 2. Deploy BotManagerV2Plus  
    console.log('📋 2. Deploying BotManagerV2Plus...');
    
    const botManagerV2Plus = await viem.deployContract("BotManagerV2Plus", [
      VRF_CONFIG.coordinator,
      BigInt(VRF_CONFIG.subscriptionId), 
      VRF_CONFIG.keyHash
    ]);

    deployedContracts.BotManagerV2Plus = botManagerV2Plus.address;
    console.log(`   ✅ BotManagerV2Plus: ${botManagerV2Plus.address}`);
    console.log('');

    // 3. Deploy GachaMintPassV2Plus
    console.log('📋 3. Deploying GachaMintPassV2Plus...');
    
    const gachaMintPassV2Plus = await viem.deployContract("GachaMintPassV2Plus", [
      VRF_CONFIG.coordinator,
      BigInt(VRF_CONFIG.subscriptionId),
      VRF_CONFIG.keyHash,
      "https://nft.barelyhumanio.com/metadata/" // Base URI for NFT metadata
    ]);

    deployedContracts.GachaMintPassV2Plus = gachaMintPassV2Plus.address;
    console.log(`   ✅ GachaMintPassV2Plus: ${gachaMintPassV2Plus.address}`);
    console.log('');

    // 4. Initialize BotManager
    console.log('📋 4. Initializing BotManager...');
    
    const initTx = await walletClient.writeContract({
      address: botManagerV2Plus.address as `0x${string}`,
      abi: [{
        "name": "initializeBots",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [],
        "outputs": []
      }],
      functionName: 'initializeBots',
      args: []
    });

    const initReceipt = await publicClient.waitForTransactionReceipt({ hash: initTx });
    console.log(`   ✅ Bots initialized: ${initTx}`);
    console.log('');

    // 5. Grant roles
    console.log('📋 5. Configuring roles and permissions...');
    
    // Grant CrapsGame roles to BotManager and Settlement
    const gameRoles = [
      { role: 'OPERATOR_ROLE', contract: 'CrapsGameV2Plus', grantee: botManagerV2Plus.address },
      { role: 'SETTLEMENT_ROLE', contract: 'CrapsGameV2Plus', grantee: EXISTING_ADDRESSES.CrapsSettlementSimple },
      { role: 'GAME_ROLE', contract: 'GachaMintPassV2Plus', grantee: crapsGameV2Plus.address }
    ];

    for (const roleGrant of gameRoles) {
      try {
        const roleHash = `0x${Buffer.from(roleGrant.role).toString('hex').padEnd(64, '0')}`;
        const grantTx = await walletClient.writeContract({
          address: deployedContracts[roleGrant.contract] as `0x${string}`,
          abi: [{
            "name": "grantRole",
            "type": "function", 
            "stateMutability": "nonpayable",
            "inputs": [
              {"name": "role", "type": "bytes32"},
              {"name": "account", "type": "address"}
            ],
            "outputs": []
          }],
          functionName: 'grantRole',
          args: [roleHash as `0x${string}`, roleGrant.grantee as `0x${string}`]
        });
        
        await publicClient.waitForTransactionReceipt({ hash: grantTx });
        console.log(`   ✅ Granted ${roleGrant.role} to ${roleGrant.grantee.slice(0, 8)}...`);
      } catch (error) {
        console.log(`   ⚠️  Role grant failed for ${roleGrant.role}: ${error}`);
      }
    }

    console.log('');

    // Display deployment summary
    console.log('✅ VRF 2.5 Deployment Complete!');
    console.log('=====================================');
    console.log('');
    console.log('📊 Deployed Contracts:');
    for (const [name, address] of Object.entries(deployedContracts)) {
      console.log(`   ${name.padEnd(20)}: ${address}`);
    }
    console.log('');

    console.log('🔧 Configuration:');
    console.log(`   VRF Coordinator   : ${VRF_CONFIG.coordinator}`);
    console.log(`   Subscription ID   : ${VRF_CONFIG.subscriptionId}`);
    console.log(`   Key Hash         : ${VRF_CONFIG.keyHash}`);
    console.log(`   LINK Token       : ${VRF_CONFIG.linkToken}`);
    console.log('');

    console.log('📋 Next Steps (CRITICAL):');
    console.log('   1. Add these contracts as VRF consumers:');
    console.log(`      - CrapsGameV2Plus: ${deployedContracts.CrapsGameV2Plus}`);
    console.log(`      - BotManagerV2Plus: ${deployedContracts.BotManagerV2Plus}`);
    console.log(`      - GachaMintPassV2Plus: ${deployedContracts.GachaMintPassV2Plus}`);
    console.log('');
    console.log('   2. Fund VRF subscription with LINK tokens');
    console.log('   3. Test VRF integration with rollDice() calls');
    console.log('   4. Update frontend to use new contract addresses');
    console.log('');

    console.log('🌐 VRF Management Dashboard:');
    console.log('   https://vrf.chain.link/base-sepolia');
    console.log('');

    // Save deployment info
    const deploymentData = {
      network: "Base Sepolia",
      chainId: 84532,
      deployer: account.address,
      timestamp: new Date().toISOString(),
      vrfVersion: "2.5",
      vrfConfig: VRF_CONFIG,
      contracts: deployedContracts,
      existingContracts: EXISTING_ADDRESSES,
      nextSteps: [
        "Add contracts as VRF consumers",
        "Fund VRF subscription",
        "Test VRF integration",
        "Update frontend contracts"
      ]
    };

    // Write deployment log
    const fs = await import('fs');
    fs.writeFileSync(
      'deployment/vrf-2-5-deployment.json',
      JSON.stringify(deploymentData, null, 2)
    );

    console.log('💾 Deployment data saved to: deployment/vrf-2-5-deployment.json');

  } catch (error) {
    console.error('❌ Deployment failed:', error);
    throw error;
  } finally {
    await connection.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });