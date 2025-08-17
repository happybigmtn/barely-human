#!/bin/bash

# Complete CLI Testing Script
# Starts local node, deploys contracts, and tests all CLI functions

set -e

echo "🚀 Starting Complete CLI Test Suite"
echo "=================================="

# Kill any existing hardhat node
echo "🔄 Cleaning up existing processes..."
pkill -f "hardhat node" || true
sleep 2

# Start hardhat node in background
echo "🌐 Starting local Hardhat node..."
npx hardhat node --hostname 0.0.0.0 > hardhat-node.log 2>&1 &
NODE_PID=$!

# Wait for node to start
echo "⏳ Waiting for node to start..."
sleep 5

# Check if node is running
if ! curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' http://localhost:8545 > /dev/null; then
    echo "❌ Failed to start Hardhat node"
    kill $NODE_PID 2>/dev/null || true
    exit 1
fi

echo "✅ Hardhat node started successfully"

# Deploy contracts locally
echo "📦 Deploying contracts locally..."
if npm run deploy:local > deployment.log 2>&1; then
    echo "✅ Contracts deployed successfully"
else
    echo "❌ Contract deployment failed"
    echo "Deployment log:"
    cat deployment.log
    kill $NODE_PID 2>/dev/null || true
    exit 1
fi

# Test CLI in non-interactive mode
echo "🧪 Testing CLI functions..."
echo "=========================="

echo "Test 1: CLI Test Mode"
if npm run cli:test > cli-test.log 2>&1; then
    echo "✅ CLI test mode passed"
else
    echo "⚠️  CLI test mode had issues (check cli-test.log)"
fi

echo ""
echo "Test 2: Non-Interactive Mode"
if npm run cli:non-interactive > cli-noninteractive.log 2>&1; then
    echo "✅ Non-interactive mode passed"
else
    echo "⚠️  Non-interactive mode had issues (check cli-noninteractive.log)"
fi

echo ""
echo "Test 3: Quiet Mode"
if npm run cli:quiet > cli-quiet.log 2>&1; then
    echo "✅ Quiet mode passed"
else
    echo "⚠️  Quiet mode had issues (check cli-quiet.log)"
fi

# Display test results
echo ""
echo "📊 Test Results Summary"
echo "======================"

# Check for test results in logs
if grep -q "Pass Rate:" cli-test.log; then
    echo "CLI Test Results:"
    grep -A 5 -B 5 "Pass Rate:" cli-test.log | tail -10
else
    echo "⚠️  No test results found in CLI test log"
fi

# Count function tests
total_tests=0
passed_tests=0

for log in cli-test.log cli-noninteractive.log cli-quiet.log; do
    if [ -f "$log" ]; then
        passed=$(grep -c "✅.*PASSED" "$log" || echo "0")
        failed=$(grep -c "❌.*FAILED" "$log" || echo "0")
        total_tests=$((total_tests + passed + failed))
        passed_tests=$((passed_tests + passed))
    fi
done

if [ $total_tests -gt 0 ]; then
    pass_rate=$(echo "scale=1; $passed_tests * 100 / $total_tests" | bc -l)
    echo ""
    echo "Overall CLI Test Results:"
    echo "  Total Tests: $total_tests"
    echo "  Passed: $passed_tests"
    echo "  Failed: $((total_tests - passed_tests))"
    echo "  Pass Rate: ${pass_rate}%"
    
    if (( $(echo "$pass_rate >= 80" | bc -l) )); then
        echo "🎉 CLI testing successful!"
        result=0
    else
        echo "⚠️  Some CLI tests failed"
        result=1
    fi
else
    echo "⚠️  No test results to analyze"
    result=1
fi

# Cleanup
echo ""
echo "🧹 Cleaning up..."
kill $NODE_PID 2>/dev/null || true
wait $NODE_PID 2>/dev/null || true
echo "✅ Cleanup complete"

echo ""
echo "📁 Log files created:"
echo "  - hardhat-node.log"
echo "  - deployment.log"
echo "  - cli-test.log"
echo "  - cli-noninteractive.log"
echo "  - cli-quiet.log"

exit $result