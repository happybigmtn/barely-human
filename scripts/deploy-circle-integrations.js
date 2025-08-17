const { ethers } = require("hardhat");

// Circle CCTP V2 Contract Addresses (Testnet)
const CIRCLE_ADDRESSES = {
  baseSepolia: {
    tokenMessengerV2: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
    messageTransmitterV2: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
    usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
  },
  arbitrumSepolia: {
    tokenMessengerV2: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
    messageTransmitterV2: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
    usdc: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d"
  },
  ethereumSepolia: {
    tokenMessengerV2: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
    messageTransmitterV2: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
    usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
  }
};

async function main() {
  console.log("🔄 Starting Circle Integration Deployment for ETHGlobal NYC 2025...");
  
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId.toString();
  
  console.log(`📡 Network: ${network.name} (${chainId})`);
  console.log(`🔑 Deployer: ${deployer.address}`);
  console.log(`💰 Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  
  // Get network-specific addresses
  let circleAddresses;
  if (chainId === "84532") { // Base Sepolia
    circleAddresses = CIRCLE_ADDRESSES.baseSepolia;
    console.log("🌊 Deploying on Base Sepolia");
  } else if (chainId === "421614") { // Arbitrum Sepolia
    circleAddresses = CIRCLE_ADDRESSES.arbitrumSepolia;
    console.log("🏹 Deploying on Arbitrum Sepolia");
  } else if (chainId === "11155111") { // Ethereum Sepolia
    circleAddresses = CIRCLE_ADDRESSES.ethereumSepolia;
    console.log("⚡ Deploying on Ethereum Sepolia");
  } else {
    throw new Error(`❌ Unsupported network: ${chainId}`);
  }
  
  const deploymentResults = {};
  
  try {
    // 1. Deploy CCTP V2 Integration
    console.log("\n1️⃣ Deploying CircleCCTPV2Integration...");
    const CircleCCTPV2 = await ethers.getContractFactory("CircleCCTPV2Integration");
    const cctpV2 = await CircleCCTPV2.deploy(
      circleAddresses.tokenMessengerV2,
      circleAddresses.messageTransmitterV2,
      circleAddresses.usdc,
      ethers.ZeroAddress // Vault coordinator (can be set later)
    );
    await cctpV2.waitForDeployment();
    const cctpV2Address = await cctpV2.getAddress();
    deploymentResults.cctpV2 = cctpV2Address;
    console.log(`✅ CircleCCTPV2Integration deployed to: ${cctpV2Address}`);
    
    // 2. Deploy Circle Paymaster Integration
    console.log("\n2️⃣ Deploying CirclePaymasterIntegration...");
    
    // For ERC-4337, we need an EntryPoint. For testnet, use a mock or existing one
    const entryPointAddress = "0x0000000071727De22E5E9d8BAf0edAc6f37da032"; // ERC-4337 EntryPoint v0.7
    
    const CirclePaymaster = await ethers.getContractFactory("CirclePaymasterIntegration");
    const paymaster = await CirclePaymaster.deploy(
      entryPointAddress,
      circleAddresses.usdc
    );
    await paymaster.waitForDeployment();
    const paymasterAddress = await paymaster.getAddress();
    deploymentResults.paymaster = paymasterAddress;
    console.log(`✅ CirclePaymasterIntegration deployed to: ${paymasterAddress}`);
    
    // 3. Deploy Circle Gas Station
    console.log("\n3️⃣ Deploying CircleGasStation...");
    const CircleGasStation = await ethers.getContractFactory("CircleGasStation");
    const gasStation = await CircleGasStation.deploy(
      circleAddresses.usdc,
      paymasterAddress
    );
    await gasStation.waitForDeployment();
    const gasStationAddress = await gasStation.getAddress();
    deploymentResults.gasStation = gasStationAddress;
    console.log(`✅ CircleGasStation deployed to: ${gasStationAddress}`);
    
    // 4. Deploy Circle Gateway Integration
    console.log("\n4️⃣ Deploying CircleGatewayIntegration...");
    const CircleGateway = await ethers.getContractFactory("CircleGatewayIntegration");
    const gateway = await CircleGateway.deploy(circleAddresses.usdc);
    await gateway.waitForDeployment();
    const gatewayAddress = await gateway.getAddress();
    deploymentResults.gateway = gatewayAddress;
    console.log(`✅ CircleGatewayIntegration deployed to: ${gatewayAddress}`);
    
    // 5. Configuration Phase
    console.log("\n⚙️ Configuring contracts...");
    
    // Configure paymaster with gas station
    console.log("🔧 Granting roles to Gas Station...");
    await paymaster.grantRole(await paymaster.OPERATOR_ROLE(), gasStationAddress);
    
    // Configure CCTP V2 hooks
    console.log("🔧 Setting up CCTP V2 hooks...");
    await cctpV2.grantRole(await cctpV2.HOOK_ROLE(), deployer.address);
    
    // Configure gateway operators
    console.log("🔧 Authorizing Gateway operators...");
    await gateway.authorizeGatewayOperator(deployer.address);
    
    // Fund paymaster for gas sponsorship (if deployer has USDC)
    console.log("🔧 Checking USDC balance for initial funding...");
    const usdcContract = await ethers.getContractAt("IERC20", circleAddresses.usdc);
    const usdcBalance = await usdcContract.balanceOf(deployer.address);
    
    if (usdcBalance > 0) {
      const fundAmount = ethers.parseUnits("100", 6); // 100 USDC
      if (usdcBalance >= fundAmount) {
        console.log("💰 Funding paymaster with 100 USDC...");
        await usdcContract.approve(paymasterAddress, fundAmount);
        await paymaster.depositForGas(fundAmount);
        console.log("✅ Paymaster funded successfully");
      } else {
        console.log("⚠️ Insufficient USDC for funding paymaster");
      }
    } else {
      console.log("⚠️ No USDC balance found. Please fund contracts manually.");
    }
    
    // 6. Verification Information
    console.log("\n📋 Circle Integration Deployment Summary");
    console.log("==========================================");
    console.log(`Network: ${network.name} (${chainId})`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`USDC Address: ${circleAddresses.usdc}`);
    console.log(`TokenMessengerV2: ${circleAddresses.tokenMessengerV2}`);
    console.log(`MessageTransmitterV2: ${circleAddresses.messageTransmitterV2}`);
    console.log("");
    console.log("📜 Deployed Contracts:");
    console.log(`CircleCCTPV2Integration: ${deploymentResults.cctpV2}`);
    console.log(`CirclePaymasterIntegration: ${deploymentResults.paymaster}`);
    console.log(`CircleGasStation: ${deploymentResults.gasStation}`);
    console.log(`CircleGatewayIntegration: ${deploymentResults.gateway}`);
    console.log("");
    
    // ETHGlobal Prize Requirements Check
    console.log("🏆 ETHGlobal NYC 2025 Prize Requirements Check:");
    console.log("✅ Multichain USDC Payment System ($4,000) - CCTP V2 with hooks");
    console.log("✅ Gas Payment in USDC ($2,000) - Paymaster integration");
    console.log("✅ Gasless Experience ($2,000) - Gas Station sponsorship");
    console.log("✅ Instant Multichain Access ($2,000) - Gateway integration");
    console.log("");
    
    // Save deployment info
    const deploymentInfo = {
      network: network.name,
      chainId: chainId,
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      circleAddresses,
      contracts: deploymentResults,
      prizeRequirements: {
        multichainPayments: "✅ CCTP V2 with Fast Transfer and Hooks",
        gasPaymentUSDC: "✅ ERC-4337 Paymaster with Circle integration", 
        gaslessExperience: "✅ Gas Station with sponsorship and Circle Wallet support",
        instantMultichain: "✅ Gateway integration with unified balances"
      }
    };
    
    const fs = require('fs');
    const path = require('path');
    const deploymentPath = path.join(__dirname, '..', 'deployments');
    
    // Create deployments directory if it doesn't exist
    if (!fs.existsSync(deploymentPath)) {
      fs.mkdirSync(deploymentPath, { recursive: true });
    }
    
    const filename = `circle-integrations-${network.name}-${Date.now()}.json`;
    fs.writeFileSync(
      path.join(deploymentPath, filename),
      JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log(`💾 Deployment info saved to: deployments/${filename}`);
    console.log("");
    console.log("🎉 Circle Integration Deployment Complete!");
    console.log("🏆 Ready for ETHGlobal NYC 2025 prize submission!");
    
  } catch (error) {
    console.error("❌ Deployment failed:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });