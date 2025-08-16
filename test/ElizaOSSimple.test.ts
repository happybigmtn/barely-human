import { network } from "hardhat";
import assert from "assert";
import { readFileSync } from "fs";
import * as yaml from "js-yaml";

/**
 * Simplified ElizaOS test focusing on YAML personality files
 */
async function main() {
    console.log("🤖 Testing ElizaOS Bot Personalities\n");
    
    const connection = await network.connect();
    
    try {
        let testsPassed = 0;
        let testsFailed = 0;
        
        const runTest = async (name: string, fn: () => Promise<void>) => {
            try {
                await fn();
                console.log(`✅ ${name}`);
                testsPassed++;
            } catch (error: any) {
                console.log(`❌ ${name}: ${error.message}`);
                testsFailed++;
            }
        };
        
        // ============================================
        // TEST: Bot Personality YAML Files
        // ============================================
        console.log("🎭 Testing Bot Personality Files...\n");
        
        const botNames = [
            'alice_allin',
            'bob_calculator',
            'charlie_lucky',
            'diana_icequeen',
            'eddie_entertainer',
            'fiona_fearless',
            'greg_grinder',
            'helen_hotstreak',
            'ivan_intimidator',
            'julia_jinx'
        ];
        
        const personalities: any[] = [];
        
        for (const botName of botNames) {
            await runTest(`Load ${botName} personality`, async () => {
                const characterFile = readFileSync(
                    `./elizaos/characters/${botName}.yaml`,
                    'utf8'
                );
                const character = yaml.load(characterFile) as any;
                
                assert(character.name, "Character must have a name");
                assert(character.description, "Character must have a description");
                assert(character.personality, "Character must have personality traits");
                assert(character.betting_strategy, "Character must have betting strategy");
                
                personalities.push(character);
            });
        }
        
        // ============================================
        // TEST: Personality Traits
        // ============================================
        console.log("\n🧠 Testing Personality Traits...\n");
        
        await runTest("All bots have unique names", async () => {
            const names = personalities.map(p => p.name);
            const uniqueNames = new Set(names);
            assert.strictEqual(uniqueNames.size, 10);
        });
        
        await runTest("All bots have betting strategies", async () => {
            for (const p of personalities) {
                assert(p.betting_strategy.preferred_bets.length > 0);
                // Check for either min_bet_multiplier or max_bet_preference
                assert(p.betting_strategy.min_bet_multiplier > 0 || 
                       p.betting_strategy.max_bet_preference > 0);
            }
        });
        
        await runTest("Personality traits are valid", async () => {
            for (const p of personalities) {
                for (const trait of p.personality) {
                    assert(trait.trait, "Trait must have name");
                    assert(trait.level >= 0 && trait.level <= 100, "Trait level must be 0-100");
                }
            }
        });
        
        await runTest("Message examples exist", async () => {
            for (const p of personalities) {
                assert(p.message_examples && p.message_examples.length > 0, "Must have message examples");
                // message_examples are strings, not objects
                for (const msg of p.message_examples) {
                    assert(typeof msg === 'string' && msg.length > 0, "Message must be non-empty string");
                }
            }
        });
        
        // ============================================
        // TEST: Specific Bot Personalities
        // ============================================
        console.log("\n🎲 Testing Specific Bot Behaviors...\n");
        
        await runTest("Alice is aggressive", async () => {
            const alice = personalities.find(p => p.name.includes("Alice"));
            const aggressive = alice.personality.find((t: any) => t.trait === 'aggressive');
            assert(aggressive.level >= 90);
        });
        
        await runTest("Bob is analytical", async () => {
            const bob = personalities.find(p => p.name.includes("Bob"));
            const analytical = bob.personality.find((t: any) => t.trait === 'analytical');
            assert(analytical.level >= 90);
        });
        
        await runTest("Charlie is superstitious", async () => {
            const charlie = personalities.find(p => p.name.includes("Charlie"));
            const superstitious = charlie.personality.find((t: any) => t.trait === 'superstitious');
            assert(superstitious.level === 100);
        });
        
        await runTest("Different risk profiles", async () => {
            const riskLevels = personalities.map(p => 
                p.betting_strategy.min_bet_multiplier || p.betting_strategy.max_bet_preference
            );
            const uniqueRisks = new Set(riskLevels);
            assert(uniqueRisks.size >= 5, "Should have diverse risk profiles");
        });
        
        // ============================================
        // Summary
        // ============================================
        console.log("\n" + "=".repeat(60));
        console.log("📊 ELIZAOS PERSONALITY TEST SUMMARY");
        console.log("=".repeat(60));
        
        const total = testsPassed + testsFailed;
        const coverage = (testsPassed / total * 100).toFixed(1);
        
        console.log(`\n✅ Tests Passed: ${testsPassed}/${total}`);
        console.log(`❌ Tests Failed: ${testsFailed}/${total}`);
        console.log(`📈 Coverage: ${coverage}%`);
        
        if (testsFailed === 0) {
            console.log("\n🎉 ALL ELIZAOS PERSONALITY TESTS PASSED! 🎉");
            console.log("\nBot personalities are properly configured with:");
            console.log("  ✅ 10 unique AI personalities");
            console.log("  ✅ Valid personality traits");
            console.log("  ✅ Betting strategies defined");
            console.log("  ✅ Message examples included");
            console.log("  ✅ Diverse risk profiles");
        } else {
            console.log(`\n⚠️  ${testsFailed} tests failed. Review and fix.`);
        }
        
    } catch (error) {
        console.error("\n❌ Test suite failed:", error);
        throw error;
    } finally {
        await connection.close();
    }
}

// Run tests
main().catch(console.error);