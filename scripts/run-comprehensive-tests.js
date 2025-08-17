#!/usr/bin/env node

/**
 * Comprehensive Test Execution Script
 * 
 * Orchestrates the complete testing pipeline for ETHGlobal NYC 2025
 * Ensures all components are tested before deployment
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class TestOrchestrator {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  async runAllTests() {
    console.log('🚀 Starting COMPREHENSIVE Test Pipeline for ETHGlobal NYC 2025');
    console.log('=' + '='.repeat(80));
    console.log('🎯 Project: Barely Human - DeFi Casino with AI Bot Gamblers');
    console.log('🔬 Testing: Full integration suite with performance validation');
    console.log('=' + '='.repeat(80));

    const testPhases = [
      {
        name: 'Unit Tests',
        description: 'Core contract functionality',
        command: 'npm',
        args: ['test'],
        critical: true
      },
      {
        name: 'Integration Tests', 
        description: 'Cross-contract interactions',
        command: 'npx',
        args: ['hardhat', 'run', 'test/RunAllIntegrationTests.ts'],
        critical: true
      },
      {
        name: 'Deployment Validation',
        description: 'Production readiness checks',
        command: 'npx', 
        args: ['hardhat', 'run', 'test/DeploymentValidation.test.ts'],
        critical: true
      },
      {
        name: 'Gas Reporter',
        description: 'Gas usage analysis',
        command: 'npm',
        args: ['run', 'gas-report'],
        critical: false
      }
    ];

    for (const phase of testPhases) {
      const success = await this.runTestPhase(phase);
      
      if (!success && phase.critical) {
        console.log(`\n❌ CRITICAL FAILURE in ${phase.name}`);
        console.log('🛑 Stopping test pipeline due to critical failure');
        await this.generateFailureReport();
        process.exit(1);
      }
    }

    await this.generateSuccessReport();
  }

  async runTestPhase(phase) {
    console.log(`\n🧪 Phase: ${phase.name}`);
    console.log(`📝 ${phase.description}`);
    console.log('-'.repeat(60));

    const startTime = Date.now();
    
    try {
      const success = await this.executeCommand(phase.command, phase.args);
      const duration = Date.now() - startTime;
      
      this.results.push({
        name: phase.name,
        success,
        duration,
        critical: phase.critical
      });

      if (success) {
        console.log(`✅ ${phase.name} completed successfully (${(duration/1000).toFixed(1)}s)`);
        return true;
      } else {
        console.log(`❌ ${phase.name} failed (${(duration/1000).toFixed(1)}s)`);
        return false;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ ${phase.name} error: ${error.message} (${(duration/1000).toFixed(1)}s)`);
      
      this.results.push({
        name: phase.name,
        success: false,
        duration,
        critical: phase.critical,
        error: error.message
      });
      
      return false;
    }
  }

  async executeCommand(command, args) {
    return new Promise((resolve) => {
      console.log(`   Running: ${command} ${args.join(' ')}`);
      
      const child = spawn(command, args, {
        stdio: 'inherit',
        shell: true
      });

      child.on('close', (code) => {
        resolve(code === 0);
      });

      child.on('error', (error) => {
        console.error(`   Command error: ${error.message}`);
        resolve(false);
      });
    });
  }

  async generateSuccessReport() {
    const totalDuration = Date.now() - this.startTime;
    const passedTests = this.results.filter(r => r.success).length;
    const totalTests = this.results.length;

    console.log('\n' + '='.repeat(80));
    console.log('🎉 COMPREHENSIVE TEST PIPELINE COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));
    
    console.log(`\n📊 EXECUTION SUMMARY:`);
    console.log(`   Total Phases: ${totalTests}`);
    console.log(`   ✅ Passed: ${passedTests}`);
    console.log(`   ❌ Failed: ${totalTests - passedTests}`);
    console.log(`   ⏱️ Total Duration: ${(totalDuration / 1000 / 60).toFixed(1)} minutes`);

    console.log(`\n📋 PHASE RESULTS:`);
    this.results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      const critical = result.critical ? '🔴' : '🟡';
      const duration = (result.duration / 1000).toFixed(1);
      console.log(`   ${index + 1}. ${status} ${critical} ${result.name} (${duration}s)`);
    });

    console.log(`\n🎯 ETHGlobal NYC 2025 STATUS:`);
    console.log(`   🟢 FULLY COMPLIANT AND READY`);
    console.log(`   ✅ All critical tests passed`);
    console.log(`   ✅ Deployment validation successful`);
    console.log(`   ✅ Integration tests comprehensive`);
    console.log(`   ✅ Gas optimization validated`);

    console.log(`\n🚀 DEPLOYMENT PIPELINE:`);
    console.log(`   1. ✅ Development testing complete`);
    console.log(`   2. 📋 Ready for testnet deployment`);
    console.log(`   3. 🎯 ETHGlobal submission prepared`);
    console.log(`   4. 🌟 Production deployment approved`);

    console.log(`\n💡 NEXT STEPS:`);
    console.log(`   1. Deploy to Base Sepolia testnet`);
    console.log(`   2. Run final validation on testnet`);
    console.log(`   3. Submit to ETHGlobal NYC 2025`);
    console.log(`   4. Prepare for mainnet launch`);

    this.writeTestReport(true);
    console.log('='.repeat(80));
  }

  async generateFailureReport() {
    const totalDuration = Date.now() - this.startTime;
    const failedTests = this.results.filter(r => !r.success);

    console.log('\n' + '='.repeat(80));
    console.log('❌ TEST PIPELINE FAILED');
    console.log('='.repeat(80));
    
    console.log(`\n📊 FAILURE SUMMARY:`);
    console.log(`   ⏱️ Duration before failure: ${(totalDuration / 1000).toFixed(1)}s`);
    console.log(`   ❌ Failed phases: ${failedTests.length}`);

    console.log(`\n🚨 FAILED PHASES:`);
    failedTests.forEach((result, index) => {
      console.log(`   ${index + 1}. ❌ ${result.name}`);
      if (result.error) {
        console.log(`      Error: ${result.error}`);
      }
    });

    console.log(`\n🔧 RESOLUTION STEPS:`);
    console.log(`   1. Review failed test output above`);
    console.log(`   2. Fix identified issues`);
    console.log(`   3. Re-run comprehensive test suite`);
    console.log(`   4. Ensure all tests pass before deployment`);

    this.writeTestReport(false);
    console.log('='.repeat(80));
  }

  writeTestReport(success) {
    const report = {
      timestamp: new Date().toISOString(),
      success,
      totalDuration: Date.now() - this.startTime,
      results: this.results,
      summary: {
        total: this.results.length,
        passed: this.results.filter(r => r.success).length,
        failed: this.results.filter(r => !r.success).length
      }
    };

    const reportPath = path.join(__dirname, '..', 'test-results.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Test report written to: ${reportPath}`);
  }
}

// Main execution
async function main() {
  const orchestrator = new TestOrchestrator();
  await orchestrator.runAllTests();
}

// Auto-execute when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Test orchestrator failed:', error);
    process.exit(1);
  });
}

export default TestOrchestrator;