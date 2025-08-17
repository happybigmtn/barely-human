#!/usr/bin/env node

import { ArtGeneratorUtils, BOT_PERSONALITIES } from './deterministic-generator.js';

console.log('🧪 Quick test of deterministic art generator...\n');

// Test 1: Deterministic consistency
console.log('Test 1: Deterministic consistency');
const seed1 = '0x123456789abcdef0';
const botId = 0;
const seriesId = 1;

const result1 = ArtGeneratorUtils.generateFromVRF(seed1, botId, seriesId);
const result2 = ArtGeneratorUtils.generateFromVRF(seed1, botId, seriesId);

if (result1.svg === result2.svg) {
  console.log('✅ Deterministic consistency: PASSED');
} else {
  console.log('❌ Deterministic consistency: FAILED');
}

// Test 2: Bot differentiation  
console.log('\nTest 2: Bot personality differentiation');
const results = [];
for (let i = 0; i < 3; i++) { // Test first 3 bots
  results.push(ArtGeneratorUtils.generateFromVRF(seed1, i, seriesId));
}

let allDifferent = true;
for (let i = 0; i < results.length; i++) {
  for (let j = i + 1; j < results.length; j++) {
    if (results[i].svg === results[j].svg) {
      allDifferent = false;
      break;
    }
  }
}

if (allDifferent) {
  console.log('✅ Bot differentiation: PASSED');
} else {
  console.log('❌ Bot differentiation: FAILED');
}

// Test 3: Output quality
console.log('\nTest 3: Output quality');
const testResult = ArtGeneratorUtils.generateFromVRF(seed1, 0, seriesId);

const svgValid = testResult.svg.startsWith('<svg') && testResult.svg.includes('</svg>');
const hasContent = testResult.svg.includes('<path');
const hasMetadata = testResult.metadata && testResult.metadata.name;

if (svgValid && hasContent && hasMetadata) {
  console.log('✅ Output quality: PASSED');
  console.log(`   SVG size: ${testResult.svg.length} chars`);
  console.log(`   Bot: ${testResult.metadata.attributes.find(a => a.trait_type === 'Bot')?.value}`);
  console.log(`   Theme: ${testResult.metadata.attributes.find(a => a.trait_type === 'Theme')?.value}`);
} else {
  console.log('❌ Output quality: FAILED');
  console.log(`   SVG valid: ${svgValid}`);
  console.log(`   Has content: ${hasContent}`);
  console.log(`   Has metadata: ${hasMetadata}`);
}

console.log('\n🎉 Quick test completed!');