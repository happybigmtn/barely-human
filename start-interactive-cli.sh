#!/bin/bash

# Startup script for Barely Human Interactive Casino CLI
# This script provides options for running the casino in different modes

echo "🎰 Barely Human Casino - Interactive CLI Launcher"
echo "================================================"
echo ""
echo "Select which version to run:"
echo "1) Fixed Interactive CLI (Fully working with Demo/Blockchain modes)"
echo "2) Simple Interactive CLI (Basic demo without blockchain)"
echo "3) Original Interactive CLI (May have import issues)"
echo "4) Exit"
echo ""
read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo ""
        echo "Starting Fixed Interactive CLI..."
        echo "This version includes:"
        echo "✅ Demo mode (no blockchain needed)"
        echo "✅ Blockchain mode (optional)"
        echo "✅ AI bot chat"
        echo "✅ Betting on bots"
        echo "✅ Live game watching"
        echo ""
        node frontend/cli/interactive-casino-fixed.js
        ;;
    2)
        echo ""
        echo "Starting Simple Interactive CLI..."
        echo "This is a basic demo version with simulated features."
        echo ""
        node frontend/cli/interactive-casino-simple.js
        ;;
    3)
        echo ""
        echo "Starting Original Interactive CLI..."
        echo "⚠️  Warning: This may have import issues."
        echo ""
        node frontend/cli/interactive-casino-cli.js
        ;;
    4)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo "Invalid choice. Please run the script again."
        exit 1
        ;;
esac