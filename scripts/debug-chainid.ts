import { createPublicClient, http } from 'viem';
import { localhost } from 'viem/chains';
import { hardhatChain } from '../config/chains.js';

async function main() {
    console.log("🔍 Debugging ChainId Issue...");
    
    // Test both localhost and hardhatChain configurations
    console.log(`📍 Localhost chain config: ${localhost.id}`);
    console.log(`📍 Hardhat chain config: ${hardhatChain.id}`);
    
    const publicClient = createPublicClient({
        chain: hardhatChain,
        transport: http('http://127.0.0.1:8545')
    });
    
    try {
        // Check what chainId the network is actually using
        const chainId = await publicClient.getChainId();
        console.log(`📍 Network chainId: ${chainId}`);
        console.log(`📍 Using hardhat chain config: ${hardhatChain.id}`);
        
        // Check what the network says
        const response = await fetch('http://127.0.0.1:8545', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_chainId',
                params: [],
                id: 1
            })
        });
        
        const data = await response.json();
        const actualChainId = parseInt(data.result, 16);
        console.log(`📍 Actual network chainId: ${actualChainId}`);
        
        if (chainId !== actualChainId) {
            console.log("❌ ChainId mismatch detected!");
        } else {
            console.log("✅ ChainId matches");
        }
        
    } catch (error) {
        console.log("❌ Error:", error.message);
    }
}

main().catch(console.error);