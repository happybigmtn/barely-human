#!/bin/bash

# Verify contracts on Blockscout (works without API key)
echo "🔍 Verifying contracts on Base Sepolia Blockscout..."
echo ""

# BOT Token
echo "📦 Verifying BOT Token..."
npx hardhat verify --network baseSepolia 0xedbce0a53a24f9e5f4684937ed3ee64e936cd048 \
  "0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a" \
  "0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB" \
  "0xc1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc2" \
  "0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB" \
  "0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB" --force 2>&1 | grep -A5 "Blockscout" || echo "Failed"

# CrapsGame
echo ""
echo "🎲 Verifying CrapsGame..."
npx hardhat verify --network baseSepolia 0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a \
  "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634" \
  "1" \
  "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c" --force 2>&1 | grep -A5 "Blockscout" || echo "Failed"

# CrapsBets
echo ""
echo "🎲 Verifying CrapsBets..."
npx hardhat verify --network baseSepolia 0x7283196cb2aa54ebca3ec2198eb5a86215e627cb --force 2>&1 | grep -A5 "Blockscout" || echo "Failed"

# CrapsSettlementSimple
echo ""
echo "💰 Verifying CrapsSettlementSimple..."
npx hardhat verify --network baseSepolia 0xe156b261025e74a19b298c9d94260c744ae85d7f --force 2>&1 | grep -A5 "Blockscout" || echo "Failed"

# BotManager
echo ""
echo "🤖 Verifying BotManager..."
npx hardhat verify --network baseSepolia 0xb7470bd86d639d294cfc83b5b2ebf5cf5ea89486 \
  "0xf8fd06a8835c514c88280a34d387afa2e5fa2806" \
  "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634" \
  "1" \
  "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c" --force 2>&1 | grep -A5 "Blockscout" || echo "Failed"

echo ""
echo "✅ Verification attempt complete!"
echo "Check status at: https://base-sepolia.blockscout.com/"