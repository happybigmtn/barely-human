import EmergencyFundingManager from './emergency-fund-fix.js';

/**
 * Test script to run emergency funding fix
 * This solves the "sender's balance is: 0" crisis
 */

async function main() {
    console.log("🚨 TESTING EMERGENCY FUNDING FIX");
    console.log("This will solve the 'sender's balance is: 0' crisis\n");
    
    const emergencyManager = new EmergencyFundingManager();
    
    try {
        await emergencyManager.initialize();
        console.log("✅ Emergency manager initialized\n");
        
        const success = await emergencyManager.executeEmergencyFix();
        
        if (success) {
            console.log("🎉 SUCCESS! Emergency funding completed");
            console.log("All bot accounts should now have sufficient funding");
            console.log("Bots can now send transactions and place bets");
            console.log("\nNext steps:");
            console.log("• Start the interactive CLI: npm run cli:interactive");
            console.log("• Watch bots play: npm run bots");
            console.log("• Check balances: npm run balance:check");
        } else {
            console.log("⚠️  PARTIAL SUCCESS: Some accounts may still need funding");
            console.log("Consider running this script again or checking logs");
        }
        
    } catch (error) {
        console.error("❌ EMERGENCY FUNDING FAILED:", error.message);
        console.error("\nPossible solutions:");
        console.error("• Make sure Hardhat node is running: npm run node");
        console.error("• Redeploy contracts: npm run deploy:local");
        console.error("• Check if deployer account has ETH");
        process.exit(1);
    } finally {
        await emergencyManager.cleanup();
    }
}

main()
    .then(() => {
        console.log("\n✅ Emergency funding test completed");
        process.exit(0);
    })
    .catch((error) => {
        console.error("Fatal error:", error);
        process.exit(1);
    });