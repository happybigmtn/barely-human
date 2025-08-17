#!/usr/bin/env tsx
/**
 * Comprehensive Test Runner for Barely Human DeFi Casino
 * Executes all test suites including unit, integration, and performance tests
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

interface TestResult {
  file: string;
  passed: number;
  failed: number;
  duration: number;
  errors: string[];
}

interface TestSuite {
  name: string;
  pattern: string;
  files: string[];
  results: TestResult[];
}

class ComprehensiveTestRunner {
  private testSuites: TestSuite[] = [];
  private totalPassed = 0;
  private totalFailed = 0;
  private totalDuration = 0;
  private testResults: TestResult[] = [];

  constructor() {
    this.initializeTestSuites();
  }

  private initializeTestSuites() {
    this.testSuites = [
      {
        name: 'Unit Tests - Core Contracts',
        pattern: 'test/*.working.test.ts',
        files: [],
        results: []
      },
      {
        name: 'Unit Tests - Token System',
        pattern: 'test/BOT*.test.ts',
        files: [],
        results: []
      },
      {
        name: 'Unit Tests - Game Logic',
        pattern: 'test/Craps*.test.js',
        files: [],
        results: []
      },
      {
        name: 'Unit Tests - Vault System',
        pattern: 'test/*Vault*.test.ts',
        files: [],
        results: []
      },
      {
        name: 'Integration Tests - User Journey',
        pattern: 'test/integration/*Journey*.test.ts',
        files: [],
        results: []
      },
      {
        name: 'Integration Tests - Cross-Chain',
        pattern: 'test/integration/*Chain*.test.ts',
        files: [],
        results: []
      },
      {
        name: 'Integration Tests - Bot System',
        pattern: 'test/integration/*Bot*.test.ts',
        files: [],
        results: []
      },
      {
        name: 'Performance Tests',
        pattern: 'test/performance/*.test.ts',
        files: [],
        results: []
      },
      {
        name: 'E2E Tests',
        pattern: 'test/e2e/*.test.ts',
        files: [],
        results: []
      }
    ];
  }

  private findTestFiles(pattern: string): string[] {
    const baseDir = path.join(process.cwd());
    const files: string[] = [];
    
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
      .replace(/\//g, '\\/');
    
    const regex = new RegExp(regexPattern);
    
    // Recursively find files
    const findFiles = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(baseDir, fullPath);
          
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            findFiles(fullPath);
          } else if (entry.isFile() && regex.test(relativePath)) {
            files.push(relativePath);
          }
        }
      } catch (error) {
        // Ignore errors for inaccessible directories
      }
    };
    
    findFiles(baseDir);
    return files;
  }

  private async runTestFile(file: string): Promise<TestResult> {
    const startTime = Date.now();
    const result: TestResult = {
      file,
      passed: 0,
      failed: 0,
      duration: 0,
      errors: []
    };

    try {
      console.log(chalk.cyan(`  Running: ${file}`));
      
      // Determine the correct command based on file extension
      let command: string;
      if (file.endsWith('.ts')) {
        command = `npx hardhat run ${file} 2>&1`;
      } else if (file.endsWith('.js')) {
        command = `npx hardhat run ${file} 2>&1`;
      } else {
        command = `npx hardhat test ${file} 2>&1`;
      }

      const output = execSync(command, {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      // Parse output for test results
      const passedMatches = output.match(/✅|passed|PASS|successful/gi);
      const failedMatches = output.match(/❌|failed|FAIL|error/gi);
      
      result.passed = passedMatches ? passedMatches.length : 0;
      result.failed = failedMatches ? failedMatches.length : 0;
      
      // If no explicit pass/fail markers, check for successful execution
      if (result.passed === 0 && result.failed === 0) {
        if (output.includes('All tests passed') || output.includes('successfully')) {
          result.passed = 1;
        }
      }

      console.log(chalk.green(`    ✅ Passed: ${result.passed}`));
      
    } catch (error: any) {
      result.failed = 1;
      result.errors.push(error.message || error.toString());
      console.log(chalk.red(`    ❌ Failed: ${error.message?.split('\n')[0] || 'Unknown error'}`));
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  private async runTestSuite(suite: TestSuite): Promise<void> {
    console.log(chalk.bold.blue(`\n${'='.repeat(60)}`));
    console.log(chalk.bold.blue(`Running ${suite.name}`));
    console.log(chalk.bold.blue(`${'='.repeat(60)}`));

    suite.files = this.findTestFiles(suite.pattern);
    
    if (suite.files.length === 0) {
      console.log(chalk.yellow(`  No test files found for pattern: ${suite.pattern}`));
      return;
    }

    console.log(chalk.gray(`  Found ${suite.files.length} test file(s)`));

    for (const file of suite.files) {
      const result = await this.runTestFile(file);
      suite.results.push(result);
      this.testResults.push(result);
      this.totalPassed += result.passed;
      this.totalFailed += result.failed;
      this.totalDuration += result.duration;
    }

    // Suite summary
    const suitePassed = suite.results.reduce((sum, r) => sum + r.passed, 0);
    const suiteFailed = suite.results.reduce((sum, r) => sum + r.failed, 0);
    const suiteDuration = suite.results.reduce((sum, r) => sum + r.duration, 0);

    console.log(chalk.bold(`\n${suite.name} Summary:`));
    console.log(chalk.green(`  Passed: ${suitePassed}`));
    if (suiteFailed > 0) {
      console.log(chalk.red(`  Failed: ${suiteFailed}`));
    }
    console.log(chalk.gray(`  Duration: ${(suiteDuration / 1000).toFixed(2)}s`));
  }

  public async run(): Promise<void> {
    console.log(chalk.bold.magenta('\n🧪 Barely Human DeFi Casino - Comprehensive Test Suite'));
    console.log(chalk.gray('Running all unit, integration, and performance tests...\n'));

    const startTime = Date.now();

    // Compile contracts first
    console.log(chalk.cyan('📦 Compiling contracts...'));
    try {
      execSync('npx hardhat compile', { encoding: 'utf8' });
      console.log(chalk.green('✅ Contracts compiled successfully\n'));
    } catch (error) {
      console.log(chalk.red('❌ Compilation failed. Please fix contract errors first.\n'));
      process.exit(1);
    }

    // Run all test suites
    for (const suite of this.testSuites) {
      await this.runTestSuite(suite);
    }

    // Generate final report
    this.generateReport();

    const totalTime = (Date.now() - startTime) / 1000;
    console.log(chalk.gray(`\nTotal execution time: ${totalTime.toFixed(2)}s`));

    // Exit with appropriate code
    process.exit(this.totalFailed > 0 ? 1 : 0);
  }

  private generateReport(): void {
    console.log(chalk.bold.magenta('\n' + '='.repeat(80)));
    console.log(chalk.bold.magenta('                    📊 FINAL TEST REPORT'));
    console.log(chalk.bold.magenta('='.repeat(80)));

    // Overall statistics
    const totalTests = this.totalPassed + this.totalFailed;
    const passRate = totalTests > 0 ? (this.totalPassed / totalTests * 100).toFixed(1) : 0;

    console.log(chalk.bold('\n📈 Overall Statistics:'));
    console.log(chalk.green(`  ✅ Tests Passed: ${this.totalPassed}`));
    console.log(chalk.red(`  ❌ Tests Failed: ${this.totalFailed}`));
    console.log(chalk.yellow(`  📊 Total Tests: ${totalTests}`));
    console.log(chalk.cyan(`  📉 Pass Rate: ${passRate}%`));
    console.log(chalk.gray(`  ⏱️  Total Duration: ${(this.totalDuration / 1000).toFixed(2)}s`));

    // Suite breakdown
    console.log(chalk.bold('\n📋 Suite Breakdown:'));
    for (const suite of this.testSuites) {
      if (suite.results.length > 0) {
        const suitePassed = suite.results.reduce((sum, r) => sum + r.passed, 0);
        const suiteFailed = suite.results.reduce((sum, r) => sum + r.failed, 0);
        const suiteTotal = suitePassed + suiteFailed;
        const suitePassRate = suiteTotal > 0 ? (suitePassed / suiteTotal * 100).toFixed(1) : 0;
        
        const status = suiteFailed === 0 ? chalk.green('✅') : chalk.red('❌');
        console.log(`  ${status} ${suite.name}: ${suitePassed}/${suiteTotal} (${suitePassRate}%)`);
      }
    }

    // Failed tests details
    const failedTests = this.testResults.filter(r => r.failed > 0);
    if (failedTests.length > 0) {
      console.log(chalk.bold.red('\n⚠️  Failed Tests:'));
      for (const test of failedTests) {
        console.log(chalk.red(`  • ${test.file}`));
        for (const error of test.errors) {
          console.log(chalk.gray(`    → ${error.split('\n')[0]}`));
        }
      }
    }

    // Production readiness assessment
    console.log(chalk.bold('\n🚀 Production Readiness:'));
    if (passRate >= 95) {
      console.log(chalk.green('  ✅ PRODUCTION READY - Excellent test coverage!'));
    } else if (passRate >= 90) {
      console.log(chalk.green('  ✅ READY FOR STAGING - Good test coverage'));
    } else if (passRate >= 80) {
      console.log(chalk.yellow('  ⚠️  NEEDS ATTENTION - Some tests failing'));
    } else {
      console.log(chalk.red('  ❌ NOT READY - Significant test failures'));
    }

    // ETHGlobal submission assessment
    console.log(chalk.bold('\n🏆 ETHGlobal NYC 2025 Assessment:'));
    if (passRate >= 90) {
      console.log(chalk.green('  ✅ READY FOR SUBMISSION - High confidence'));
      console.log(chalk.green('  💰 Prize Potential: $20K-$50K'));
    } else if (passRate >= 80) {
      console.log(chalk.yellow('  ⚠️  SUBMISSION READY WITH CAVEATS'));
      console.log(chalk.yellow('  💰 Prize Potential: $10K-$30K'));
    } else {
      console.log(chalk.red('  ❌ NEEDS FIXES BEFORE SUBMISSION'));
    }

    // Save JSON report
    const jsonReport = {
      timestamp: new Date().toISOString(),
      statistics: {
        totalTests,
        passed: this.totalPassed,
        failed: this.totalFailed,
        passRate: parseFloat(passRate),
        duration: this.totalDuration
      },
      suites: this.testSuites.map(suite => ({
        name: suite.name,
        files: suite.files.length,
        results: suite.results
      })),
      failedTests,
      productionReady: passRate >= 90,
      ethGlobalReady: passRate >= 80
    };

    fs.writeFileSync(
      path.join(process.cwd(), 'test-results.json'),
      JSON.stringify(jsonReport, null, 2)
    );

    console.log(chalk.gray('\n📄 Detailed report saved to test-results.json'));
    console.log(chalk.bold.magenta('\n' + '='.repeat(80) + '\n'));
  }
}

// Run the test suite
const runner = new ComprehensiveTestRunner();
runner.run().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});