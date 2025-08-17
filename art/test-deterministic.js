#!/usr/bin/env node

/**
 * Test script for the deterministic art generator
 * Ensures that outputs are deterministic while maintaining unique traits per bot
 */

import { BarelyHumanArtGenerator, ArtGeneratorUtils, BOT_PERSONALITIES } from './deterministic-generator.js';
import fs from 'fs';
import path from 'path';

// Test configuration
const TEST_SEEDS = [
  0x123456789abcdef0,
  0xfedcba9876543210,
  0x1111111111111111,
  0xaaaaaaaaaaaaaaaa,
  0x5555555555555555
];

const TEST_SERIES = 1;

/**
 * Test deterministic consistency
 */
function testDeterministicConsistency() {
  console.log('🧪 Testing deterministic consistency...');
  
  for (let botId = 0; botId < 10; botId++) {
    for (const seed of TEST_SEEDS) {
      // Generate the same artwork twice
      const result1 = ArtGeneratorUtils.generateFromVRF(`0x${seed.toString(16)}`, botId, TEST_SERIES);
      const result2 = ArtGeneratorUtils.generateFromVRF(`0x${seed.toString(16)}`, botId, TEST_SERIES);
      
      // Should be identical
      if (result1.svg !== result2.svg) {
        console.error(`❌ Deterministic test FAILED for bot ${botId}, seed ${seed.toString(16)}`);
        console.error('SVGs are different!');
        return false;
      }
      
      // Metadata should also be identical
      if (JSON.stringify(result1.metadata) !== JSON.stringify(result2.metadata)) {
        console.error(`❌ Metadata deterministic test FAILED for bot ${botId}, seed ${seed.toString(16)}`);
        return false;
      }
    }
  }
  
  console.log('✅ Deterministic consistency test PASSED');
  return true;
}

/**
 * Test bot personality differentiation
 */
function testBotPersonalityDifferentiation() {
  console.log('🎭 Testing bot personality differentiation...');
  
  const seed = TEST_SEEDS[0];
  const results = {};
  
  // Generate art for all 10 bots with the same seed
  for (let botId = 0; botId < 10; botId++) {
    results[botId] = ArtGeneratorUtils.generateFromVRF(`0x${seed.toString(16)}`, botId, TEST_SERIES);
  }
  
  // Verify all outputs are different
  for (let i = 0; i < 10; i++) {
    for (let j = i + 1; j < 10; j++) {
      if (results[i].svg === results[j].svg) {
        console.error(`❌ Bot differentiation FAILED: Bot ${i} and Bot ${j} produced identical art`);
        return false;
      }
      
      // Check that traits are different
      const traits1 = results[i].traits;
      const traits2 = results[j].traits;
      
      if (traits1.theme === traits2.theme && traits1.formation === traits2.formation) {
        console.error(`❌ Trait differentiation FAILED: Bot ${i} and Bot ${j} have identical theme/formation`);
        return false;
      }
    }
  }
  
  console.log('✅ Bot personality differentiation test PASSED');
  return true;
}

/**
 * Test trait distribution and rarity
 */
function testTraitDistribution() {
  console.log('🎲 Testing trait distribution and rarity...');
  
  const traitCounts = {
    density: {},
    complexity: {},
    specialFeatures: {},
    colorVariation: {}
  };
  
  const numSamples = 100;
  
  // Generate many samples to test distribution
  for (let i = 0; i < numSamples; i++) {
    const seed = Math.floor(Math.random() * 0xffffffffffff);
    const botId = i % 10;
    
    const result = ArtGeneratorUtils.generateFromVRF(`0x${seed.toString(16)}`, botId, TEST_SERIES);
    const traits = result.traits;
    
    // Count trait occurrences
    for (const [category, trait] of Object.entries(traits)) {
      if (traitCounts[category]) {
        traitCounts[category][trait] = (traitCounts[category][trait] || 0) + 1;
      }
    }
  }
  
  // Verify rare traits are actually rare
  console.log('📊 Trait distribution:');
  for (const [category, counts] of Object.entries(traitCounts)) {
    console.log(`  ${category}:`);
    for (const [trait, count] of Object.entries(counts)) {
      const percentage = (count / numSamples * 100).toFixed(1);
      console.log(`    ${trait}: ${count}/${numSamples} (${percentage}%)`);
    }
  }
  
  // Check that "Legendary" traits are rare (should be < 10%)
  const legendaryDensity = traitCounts.density?.['Maximum'] || 0;
  const legendaryComplexity = traitCounts.complexity?.['Legendary'] || 0;
  const legendaryFeatures = traitCounts.specialFeatures?.['Legendary'] || 0;
  
  if (legendaryDensity > numSamples * 0.1 || 
      legendaryComplexity > numSamples * 0.1 || 
      legendaryFeatures > numSamples * 0.1) {
    console.error('❌ Rarity distribution FAILED: Legendary traits are too common');
    return false;
  }
  
  console.log('✅ Trait distribution test PASSED');
  return true;
}

/**
 * Test SVG quality and complexity
 */
function testSVGQuality() {
  console.log('🎨 Testing SVG quality and complexity...');
  
  const seed = TEST_SEEDS[0];
  const results = [];
  
  // Test all bot personalities
  for (let botId = 0; botId < 10; botId++) {
    const result = ArtGeneratorUtils.generateFromVRF(`0x${seed.toString(16)}`, botId, TEST_SERIES);
    results.push({ botId, result });
    
    // Basic SVG validation
    const svg = result.svg;
    
    if (!svg.startsWith('<svg')) {
      console.error(`❌ SVG format FAILED for bot ${botId}: doesn't start with <svg`);
      return false;
    }
    
    if (!svg.includes('</svg>')) {
      console.error(`❌ SVG format FAILED for bot ${botId}: doesn't end with </svg>`);
      return false;
    }
    
    // Check for crack paths
    if (!svg.includes('<path')) {
      console.error(`❌ SVG content FAILED for bot ${botId}: no crack paths found`);
      return false;
    }
    
    // Check complexity - should have multiple elements
    const pathCount = (svg.match(/<path/g) || []).length;
    if (pathCount < 50) {
      console.error(`❌ SVG complexity FAILED for bot ${botId}: only ${pathCount} paths (expected >50)`);
      return false;
    }
    
    console.log(`  Bot ${botId} (${BOT_PERSONALITIES[botId].name}): ${pathCount} paths, ${svg.length} bytes`);
  }
  
  console.log('✅ SVG quality test PASSED');
  return true;
}

/**
 * Test performance and memory usage
 */
function testPerformance() {
  console.log('⚡ Testing performance and memory usage...');
  
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed;
  
  // Generate 20 artworks
  for (let i = 0; i < 20; i++) {
    const seed = Math.floor(Math.random() * 0xffffffffffff);
    const botId = i % 10;
    
    ArtGeneratorUtils.generateFromVRF(`0x${seed.toString(16)}`, botId, TEST_SERIES);
  }
  
  const endTime = Date.now();
  const endMemory = process.memoryUsage().heapUsed;
  
  const avgTime = (endTime - startTime) / 20;
  const memoryIncrease = (endMemory - startMemory) / 1024 / 1024; // MB
  
  console.log(`  Average generation time: ${avgTime.toFixed(1)}ms`);
  console.log(`  Memory increase: ${memoryIncrease.toFixed(1)}MB`);
  
  if (avgTime > 5000) { // 5 seconds per artwork is too slow
    console.error('❌ Performance FAILED: generation too slow');
    return false;
  }
  
  if (memoryIncrease > 100) { // 100MB increase is too much
    console.error('❌ Memory usage FAILED: too much memory used');
    return false;
  }
  
  console.log('✅ Performance test PASSED');
  return true;
}

/**
 * Generate sample outputs for visual inspection
 */
function generateSampleOutputs() {
  console.log('📁 Generating sample outputs...');
  
  const outputDir = path.join(__dirname, 'test-outputs');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
  
  const seed = TEST_SEEDS[0];
  
  for (let botId = 0; botId < 10; botId++) {
    const result = ArtGeneratorUtils.generateFromVRF(`0x${seed.toString(16)}`, botId, TEST_SERIES);
    const bot = BOT_PERSONALITIES[botId];
    
    // Save SVG
    const filename = `bot_${botId}_${bot.name.replace(/\s+/g, '_')}.svg`;
    fs.writeFileSync(path.join(outputDir, filename), result.svg);
    
    // Save metadata
    const metadataFilename = `bot_${botId}_${bot.name.replace(/\s+/g, '_')}_metadata.json`;
    fs.writeFileSync(path.join(outputDir, metadataFilename), JSON.stringify(result.metadata, null, 2));
  }
  
  console.log(`✅ Sample outputs saved to ${outputDir}`);
}

/**
 * Run all tests
 */
function runAllTests() {
  console.log('🚀 Starting deterministic art generator tests...\n');
  
  const tests = [
    { name: 'Deterministic Consistency', fn: testDeterministicConsistency },
    { name: 'Bot Personality Differentiation', fn: testBotPersonalityDifferentiation },
    { name: 'Trait Distribution', fn: testTraitDistribution },
    { name: 'SVG Quality', fn: testSVGQuality },
    { name: 'Performance', fn: testPerformance }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      if (test.fn()) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`❌ ${test.name} test CRASHED:`, error.message);
      failed++;
    }
    console.log('');
  }
  
  // Generate sample outputs regardless of test results
  generateSampleOutputs();
  
  console.log('📊 Test Summary:');
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  📁 Sample outputs generated`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests PASSED! The deterministic art generator is working correctly.');
    return true;
  } else {
    console.log('\n💥 Some tests FAILED. Please review the issues above.');
    return false;
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const success = runAllTests();
  process.exit(success ? 0 : 1);
}

export {
  runAllTests,
  testDeterministicConsistency,
  testBotPersonalityDifferentiation,
  testTraitDistribution,
  testSVGQuality,
  testPerformance,
  generateSampleOutputs
};