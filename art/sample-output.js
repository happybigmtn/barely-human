#!/usr/bin/env node

import { ArtGeneratorUtils, BOT_PERSONALITIES } from './deterministic-generator.js';
import fs from 'fs';

console.log('🎨 Generating sample artwork for each bot personality...\n');

const seed = '0x123456789abcdef0';
const seriesId = 1;

for (let botId = 0; botId < 10; botId++) {
  const bot = BOT_PERSONALITIES[botId];
  console.log(`Generating for Bot ${botId}: ${bot.name} (${bot.theme}/${bot.crackFormation})`);
  
  const result = ArtGeneratorUtils.generateFromVRF(seed, botId, seriesId);
  
  // Save SVG file
  const filename = `sample_bot_${botId}_${bot.name.replace(/\s+/g, '_').replace(/"/g, '')}.svg`;
  fs.writeFileSync(filename, result.svg);
  
  console.log(`  ✅ Saved: ${filename} (${result.svg.length} chars)`);
  console.log(`  🎯 Traits: ${result.traits.density}, ${result.traits.complexity}, ${result.traits.specialFeatures}`);
}

console.log('\n🎉 Sample generation complete! Check the SVG files in the current directory.');