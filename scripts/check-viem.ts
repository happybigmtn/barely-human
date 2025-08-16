import hre from "hardhat";

async function main() {
  console.log("Checking Hardhat Runtime Environment...\n");
  
  // Check what's available on hre
  console.log("hre properties:", Object.keys(hre));
  
  // Check if viem is available
  console.log("\nhre.viem exists?", hre.viem !== undefined);
  
  // Check network
  console.log("\nhre.network properties:", Object.keys(hre.network));
  
  // Try to access viem through network
  if (hre.network.connect) {
    console.log("\nTrying network.connect()...");
    try {
      const connection = await hre.network.connect();
      console.log("Connection properties:", Object.keys(connection));
      
      if (connection.viem) {
        console.log("viem found in connection!");
        const viem = connection.viem;
        console.log("viem properties:", Object.keys(viem));
      }
    } catch (e) {
      console.error("Error connecting:", e.message);
    }
  }
  
  // Check if there's a viem property after importing the plugin
  const { viem } = hre as any;
  console.log("\nDirect viem access:", viem !== undefined);
  
  if (viem) {
    console.log("viem methods available:", Object.keys(viem));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });