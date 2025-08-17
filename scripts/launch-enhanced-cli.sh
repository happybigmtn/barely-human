#!/bin/bash

# Launch Enhanced Barely Human Casino CLI
# Complete interface for all smart contracts

echo "🎰 Barely Human Casino - Enhanced Edition"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Please install Node.js first: https://nodejs.org"
    exit 1
fi

# Check if deployment exists
if [ ! -f "deployments/local-deployment.json" ]; then
    echo -e "${YELLOW}⚠️  No deployment found${NC}"
    echo ""
    echo "Would you like to deploy contracts first? (y/n)"
    read -r response
    
    if [[ "$response" == "y" ]]; then
        echo -e "${CYAN}📦 Deploying contracts...${NC}"
        npx hardhat run scripts/deploy-local-complete.ts
        
        if [ $? -ne 0 ]; then
            echo -e "${RED}❌ Deployment failed${NC}"
            exit 1
        fi
        
        echo -e "${GREEN}✅ Contracts deployed successfully${NC}"
        echo ""
    else
        echo -e "${RED}Cannot proceed without deployed contracts${NC}"
        exit 1
    fi
fi

# Check which CLI to launch
echo "Select Casino Interface:"
echo ""
echo "1) 🎮 Enhanced CLI - Full Contract Suite (NEW)"
echo "2) 💬 Interactive CLI - Chat with AI Bots"
echo "3) 🎲 Simple CLI - Basic Game Functions"
echo "4) 📊 Analytics Only - View Statistics"
echo "5) 🏦 Treasury Manager - Advanced Treasury Ops"
echo "6) 🤖 Bot Arena - Bot vs Bot Battles"
echo "7) 🌐 Cross-Chain Hub - Multi-Network Ops"
echo ""
echo -n "Enter choice [1-7]: "
read -r choice

case $choice in
    1)
        echo -e "${GREEN}🚀 Launching Enhanced Casino CLI...${NC}"
        echo ""
        node frontend/cli/enhanced-casino-cli.js
        ;;
    2)
        echo -e "${CYAN}💬 Launching Interactive Bot Chat...${NC}"
        echo ""
        node frontend/cli/interactive-casino-cli.js
        ;;
    3)
        echo -e "${BLUE}🎲 Launching Simple Casino...${NC}"
        echo ""
        node frontend/cli/simple-casino-cli.js
        ;;
    4)
        echo -e "${MAGENTA}📊 Launching Analytics Dashboard...${NC}"
        echo ""
        node frontend/cli/enhanced-casino-cli.js --analytics-only
        ;;
    5)
        echo -e "${YELLOW}🏦 Launching Treasury Manager...${NC}"
        echo ""
        node frontend/cli/enhanced-casino-cli.js --treasury-only
        ;;
    6)
        echo -e "${RED}🤖 Launching Bot Arena...${NC}"
        echo ""
        node frontend/cli/enhanced-casino-cli.js --bot-arena
        ;;
    7)
        echo -e "${CYAN}🌐 Launching Cross-Chain Hub...${NC}"
        echo ""
        node frontend/cli/enhanced-casino-cli.js --cross-chain
        ;;
    *)
        echo -e "${RED}Invalid choice. Exiting...${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}Thanks for playing Barely Human Casino!${NC}"
echo "Visit us at: https://github.com/barely-human/casino"