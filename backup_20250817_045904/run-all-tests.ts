#!/usr/bin/env npx tsx
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const testFiles = [
  'test/BOTToken.working.test.ts',
  'test/StakingPool.working.test.ts',
  'test/Treasury.test.ts',
  'test/CrapsVault.test.ts',
  'test/CrapsGame.test.ts'
];

async function runTest(testFile: string): Promise<TestResult> {
  const startTime = Date.now();
  const testName = path.basename(testFile, '.test.ts').replace('.working', '');
  
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 Running ${testName} tests...`);
    console.log(`${'='.repeat(60)}`);
    
    const test = spawn('npx', ['hardhat', 'run', testFile], {
      stdio: 'pipe',
      shell: true
    });
    
    let output = '';
    let errorOutput = '';
    
    test.stdout.on('data', (data) => {
      const str = data.toString();
      output += str;
      process.stdout.write(str);
    });
    
    test.stderr.on('data', (data) => {
      const str = data.toString();
      errorOutput += str;
      process.stderr.write(str);
    });
    
    test.on('exit', (code) => {
      const duration = Date.now() - startTime;
      const passed = code === 0;
      
      resolve({
        name: testName,
        passed,
        error: passed ? undefined : errorOutput || output,
        duration
      });
    });
  });
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    BARELY HUMAN TEST SUITE                   ║
║                  Running All Contract Tests                  ║
╚══════════════════════════════════════════════════════════════╝
  `);
  
  const results: TestResult[] = [];
  
  // Check if all test files exist
  for (const file of testFiles) {
    if (!fs.existsSync(file)) {
      console.log(`⚠️  Test file not found: ${file}`);
    }
  }
  
  // Run tests sequentially
  for (const testFile of testFiles) {
    if (fs.existsSync(testFile)) {
      const result = await runTest(testFile);
      results.push(result);
    }
  }
  
  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 TEST SUMMARY');
  console.log(`${'='.repeat(60)}\n`);
  
  const totalTests = results.length;
  const passedTests = results.filter(r => r.passed).length;
  const failedTests = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  
  // Individual results
  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    const status = result.passed ? 'PASSED' : 'FAILED';
    const time = (result.duration / 1000).toFixed(2);
    console.log(`${icon} ${result.name.padEnd(20)} ${status.padEnd(8)} (${time}s)`);
  });
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📈 OVERALL RESULTS`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`⏱️  Total Time: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`📊 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (failedTests > 0) {
    console.log(`\n${'='.repeat(60)}`);
    console.log('❌ FAILED TESTS:');
    console.log(`${'='.repeat(60)}`);
    results.filter(r => !r.passed).forEach(result => {
      console.log(`\n${result.name}:`);
      console.log(result.error?.slice(0, 500));
    });
  }
  
  const exitCode = failedTests > 0 ? 1 : 0;
  
  if (exitCode === 0) {
    console.log(`\n🎉 All tests passed successfully!`);
  } else {
    console.log(`\n❌ ${failedTests} test(s) failed. Please fix the issues above.`);
  }
  
  process.exit(exitCode);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});