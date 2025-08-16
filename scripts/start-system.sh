#!/bin/bash

# Start script for Barely Human DeFi Casino
# This script starts the complete system

echo "🎰 Starting Barely Human DeFi Casino System"
echo "=========================================="
echo ""

# Check if Hardhat node is running
if lsof -Pi :8545 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Hardhat node is already running on port 8545"
else
    echo "Starting Hardhat node..."
    npx hardhat node &
    HARDHAT_PID=$!
    sleep 5
    echo "✅ Hardhat node started (PID: $HARDHAT_PID)"
fi

echo ""
echo "🚀 Deploying contracts..."
npx hardhat run scripts/deploy-local-complete.ts

echo ""
echo "=========================================="
echo "🎮 System Ready!"
echo "=========================================="
echo ""
echo "Choose an option to interact with the casino:"
echo ""
echo "1. Interactive CLI (Simple)"
echo "   node frontend/cli/simple-casino-cli.js"
echo ""
echo "2. Interactive CLI (Full Featured)"
echo "   node frontend/cli/casino-cli.js"
echo ""
echo "3. Bot Orchestrator (Automated Play)"
echo "   node scripts/bot-orchestrator.js"
echo ""
echo "4. System Test"
echo "   node scripts/test-system.js"
echo ""
echo "=========================================="
echo "📚 Documentation:"
echo "   - README.md for project overview"
echo "   - docs/FULL_BLUEPRINT.md for complete specs"
echo "   - CLAUDE.md for development guidelines"
echo ""
echo "🎲 Happy gambling with AI bots!"