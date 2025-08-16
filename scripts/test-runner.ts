#!/usr/bin/env npx tsx
/**
 * Test runner that properly initializes Hardhat environment
 * before running Node.js tests with Viem
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('🧪 Running Hardhat Viem tests with Node.js test runner...\n');
  
  // Compile contracts first
  console.log('📦 Compiling contracts...');
  const compile = spawn('npx', ['hardhat', 'compile'], {
    stdio: 'inherit',
    shell: true
  });
  
  await new Promise((resolve, reject) => {
    compile.on('exit', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Compilation failed with code ${code}`));
      }
    });
  });
  
  console.log('\n🚀 Running tests...\n');
  
  // Run tests with Node.js test runner
  const testFiles = process.argv.slice(2);
  const testPath = testFiles.length > 0 
    ? testFiles 
    : ['test/contracts/**/*.test.ts'];
  
  const test = spawn('npx', ['tsx', '--test', ...testPath], {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      NODE_ENV: 'test'
    }
  });
  
  test.on('exit', (code) => {
    process.exit(code || 0);
  });
}

runTests().catch((error) => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});