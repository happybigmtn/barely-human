#!/bin/bash

# Deployment script for The Graph subgraph
# Usage: ./scripts/deploy.sh <network> <subgraph-name>
# Example: ./scripts/deploy.sh base-sepolia barely-human-casino

set -e

NETWORK=$1
SUBGRAPH_NAME=${2:-"barely-human-casino"}

if [ -z "$NETWORK" ]; then
    echo "Usage: ./scripts/deploy.sh <network> [subgraph-name]"
    echo "Available networks: local, base-sepolia, base"
    exit 1
fi

echo "🚀 Deploying Barely Human Casino subgraph..."
echo "Network: $NETWORK"
echo "Subgraph: $SUBGRAPH_NAME"
echo ""

# Check if we have the required tools
if ! command -v graph &> /dev/null; then
    echo "❌ Graph CLI not found. Install with: npm install -g @graphprotocol/graph-cli"
    exit 1
fi

# Generate subgraph.yaml from template
echo "📝 Generating subgraph.yaml for network: $NETWORK"
node scripts/prepare-subgraph.js $NETWORK

if [ $? -ne 0 ]; then
    echo "❌ Failed to generate subgraph.yaml"
    exit 1
fi

# Generate types
echo "🔧 Generating types..."
graph codegen

if [ $? -ne 0 ]; then
    echo "❌ Codegen failed"
    exit 1
fi

# Build subgraph
echo "🏗️  Building subgraph..."
graph build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

# Deploy based on network
case $NETWORK in
    "local")
        echo "🏠 Deploying to local graph node..."
        echo "Make sure you have a local graph node running:"
        echo "  git clone https://github.com/graphprotocol/graph-node"
        echo "  cd graph-node/docker"
        echo "  docker-compose up"
        echo ""
        
        # Create subgraph on local node
        graph create --node http://localhost:8020/ $SUBGRAPH_NAME
        
        # Deploy to local node
        graph deploy --node http://localhost:8020/ --ipfs http://localhost:5001 $SUBGRAPH_NAME
        ;;
    
    "base-sepolia"|"base")
        echo "☁️  Deploying to The Graph Studio..."
        
        # Check if we have authentication
        if [ -z "$GRAPH_AUTH_TOKEN" ] && [ ! -f ~/.graph/auth ]; then
            echo "❌ No Graph auth token found!"
            echo "Please authenticate with The Graph Studio:"
            echo "  graph auth --studio <YOUR_DEPLOY_KEY>"
            exit 1
        fi
        
        # Deploy to The Graph Studio
        if [ -n "$GRAPH_AUTH_TOKEN" ]; then
            echo "Using GRAPH_AUTH_TOKEN environment variable"
            graph deploy --studio $SUBGRAPH_NAME --access-token $GRAPH_AUTH_TOKEN
        else
            echo "Using stored authentication"
            graph deploy --studio $SUBGRAPH_NAME
        fi
        ;;
    
    *)
        echo "❌ Unknown network: $NETWORK"
        echo "Available networks: local, base-sepolia, base"
        exit 1
        ;;
esac

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Subgraph deployed successfully!"
    echo ""
    case $NETWORK in
        "local")
            echo "📊 GraphQL Playground: http://localhost:8000/subgraphs/name/$SUBGRAPH_NAME"
            echo "🔍 GraphiQL: http://localhost:8000/subgraphs/name/$SUBGRAPH_NAME/graphql"
            ;;
        "base-sepolia"|"base")
            echo "📊 The Graph Studio: https://thegraph.com/studio/subgraph/$SUBGRAPH_NAME"
            echo "🔍 Query URL will be available after syncing completes"
            ;;
    esac
    echo ""
    echo "🎯 Example queries:"
    echo "  - Total protocol stats: { protocol { totalGamesPlayed totalAmountWagered } }"
    echo "  - Bot performance: { bots { name totalWinnings netPnL winRate } }"
    echo "  - Recent games: { gameSeries(first: 10, orderBy: startTime, orderDirection: desc) { id phase totalBets } }"
    echo "  - Vault TVL: { vaults { name totalAssets totalShares sharePrice } }"
else
    echo "❌ Deployment failed!"
    exit 1
fi