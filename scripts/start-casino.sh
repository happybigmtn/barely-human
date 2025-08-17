#!/bin/bash

# Barely Human Casino Startup Script
# Checks system status and guides user to the right action

echo "🎰 BARELY HUMAN CASINO - STARTUP SCRIPT"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored text
print_status() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Hardhat node is running
print_status "Checking if Hardhat node is running..."
if curl -s -o /dev/null http://localhost:8545; then
    print_success "Hardhat node is running ✅"
else
    print_error "Hardhat node is not running ❌"
    echo ""
    echo "Please start the Hardhat node first:"
    echo "  npm run node"
    echo ""
    exit 1
fi

# Check if contracts are deployed
print_status "Checking contract deployment..."
if [ -f "deployments/localhost.json" ]; then
    print_success "Contracts are deployed ✅"
else
    print_warning "Contracts not deployed"
    echo ""
    echo "Deploying contracts now..."
    npm run deploy:local
    
    if [ $? -eq 0 ]; then
        print_success "Contracts deployed successfully ✅"
    else
        print_error "Contract deployment failed ❌"
        exit 1
    fi
fi

# Run system diagnostic
print_status "Running system diagnostic..."
echo ""
npm run diagnose

# Check if diagnostic passed (simplified check)
if [ $? -eq 0 ]; then
    echo ""
    print_success "System diagnostic completed"
    echo ""
    echo "🎮 Choose how to start the casino:"
    echo ""
    echo "1. Interactive CLI (chat with AI bots):"
    echo "   ${CYAN}npm run cli:interactive${NC}"
    echo ""
    echo "2. Watch bots play automatically:"
    echo "   ${CYAN}npm run bots${NC}"
    echo ""
    echo "3. Simple CLI interface:"
    echo "   ${CYAN}npm run cli:simple${NC}"
    echo ""
    echo "4. Full casino experience:"
    echo "   ${CYAN}npm run play${NC}"
    echo ""
else
    echo ""
    print_warning "System diagnostic found issues"
    echo ""
    echo "🔧 Quick fixes:"
    echo ""
    echo "1. Fix funding crisis (recommended):"
    echo "   ${CYAN}npm run fix:crisis${NC}"
    echo ""
    echo "2. Check balances:"
    echo "   ${CYAN}npm run balance:check${NC}"
    echo ""
    echo "3. Emergency funding:"
    echo "   ${CYAN}npm run fund:emergency${NC}"
    echo ""
    echo "4. Full redeploy:"
    echo "   ${CYAN}npm run deploy:local${NC}"
    echo ""
fi

echo "📖 For detailed help, see: docs/EMERGENCY_FUNDING_GUIDE.md"
echo ""