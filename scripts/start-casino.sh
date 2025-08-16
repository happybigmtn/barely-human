#!/bin/bash

# Barely Human DeFi Casino Startup Script

echo "🎲 Starting Barely Human DeFi Casino..."
echo "======================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Check if node is running
check_node() {
    if lsof -Pi :8545 -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${GREEN}✓ Hardhat node is already running${NC}"
        return 0
    else
        echo -e "${YELLOW}○ Hardhat node is not running${NC}"
        return 1
    fi
}

# Start hardhat node in background
start_node() {
    echo -e "${CYAN}Starting Hardhat node...${NC}"
    npx hardhat node > logs/hardhat-node.log 2>&1 &
    NODE_PID=$!
    echo $NODE_PID > .node.pid
    
    # Wait for node to be ready
    echo -n "Waiting for node to be ready"
    for i in {1..30}; do
        if lsof -Pi :8545 -sTCP:LISTEN -t >/dev/null ; then
            echo ""
            echo -e "${GREEN}✓ Hardhat node started (PID: $NODE_PID)${NC}"
            return 0
        fi
        echo -n "."
        sleep 1
    done
    
    echo ""
    echo -e "${RED}✗ Failed to start Hardhat node${NC}"
    return 1
}

# Deploy contracts
deploy_contracts() {
    echo -e "${CYAN}Deploying contracts...${NC}"
    npm run deploy:local
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Contracts deployed successfully${NC}"
        return 0
    else
        echo -e "${RED}✗ Contract deployment failed${NC}"
        return 1
    fi
}

# Start CLI
start_cli() {
    echo ""
    echo -e "${CYAN}Starting Casino CLI...${NC}"
    echo "======================================="
    npm run cli
}

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down...${NC}"
    
    if [ -f .node.pid ]; then
        NODE_PID=$(cat .node.pid)
        if ps -p $NODE_PID > /dev/null; then
            echo "Stopping Hardhat node (PID: $NODE_PID)..."
            kill $NODE_PID
            rm .node.pid
        fi
    fi
    
    echo -e "${GREEN}✓ Cleanup complete${NC}"
    exit 0
}

# Trap SIGINT and SIGTERM
trap cleanup SIGINT SIGTERM

# Create logs directory if it doesn't exist
mkdir -p logs

# Main execution
echo "1. Checking environment..."

# Check or start node
if ! check_node; then
    if ! start_node; then
        echo -e "${RED}Failed to start Hardhat node. Exiting.${NC}"
        exit 1
    fi
fi

echo ""
echo "2. Deploying contracts..."
if ! deploy_contracts; then
    echo -e "${RED}Deployment failed. Exiting.${NC}"
    cleanup
    exit 1
fi

echo ""
echo "3. Starting Casino Interface..."
start_cli

# Cleanup on exit
cleanup