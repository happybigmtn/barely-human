#!/bin/bash

# Verify all Barely Human contracts on Base Sepolia

echo "🔍 Starting contract verification on Base Sepolia..."
echo ""

# Core Infrastructure
echo "📦 Verifying Core Infrastructure..."
npx hardhat verify --network baseSepolia 0xedbce0a53a24f9e5f4684937ed3ee64e936cd048 || echo "BOT Token verification failed"
npx hardhat verify --network baseSepolia 0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a \
  "0xedbce0a53a24f9e5f4684937ed3ee64e936cd048" \
  "0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB" \
  "0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB" || echo "Treasury verification failed"
npx hardhat verify --network baseSepolia 0xc1ce44d9dc06d15ed1e1bd9d528aa3a7c8a51dc2 \
  "0xedbce0a53a24f9e5f4684937ed3ee64e936cd048" \
  "0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a" \
  "0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB" || echo "StakingPool verification failed"

# Game Contracts
echo ""
echo "🎲 Verifying Game Contracts..."
npx hardhat verify --network baseSepolia 0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a \
  "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634" \
  "1" \
  "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c" || echo "CrapsGame verification failed"
npx hardhat verify --network baseSepolia 0x7283196cb2aa54ebca3ec2198eb5a86215e627cb || echo "CrapsBets verification failed"
npx hardhat verify --network baseSepolia 0xe156b261025e74a19b298c9d94260c744ae85d7f || echo "CrapsSettlementSimple verification failed"

# Bot System
echo ""
echo "🤖 Verifying Bot System..."
npx hardhat verify --network baseSepolia 0xb7470bd86d639d294cfc83b5b2ebf5cf5ea89486 \
  "0xf8fd06a8835c514c88280a34d387afa2e5fa2806" \
  "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634" \
  "1" \
  "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c" || echo "BotManager verification failed"
npx hardhat verify --network baseSepolia 0xf8fd06a8835c514c88280a34d387afa2e5fa2806 \
  "0xedbce0a53a24f9e5f4684937ed3ee64e936cd048" \
  "0xb46d347e7c99ade1eaa5d001a73b33ce7ab2588a" || echo "VaultFactoryMinimal verification failed"
npx hardhat verify --network baseSepolia 0x8f6282ad809e81ababc0c65458105394419ba92e \
  "0xedbce0a53a24f9e5f4684937ed3ee64e936cd048" \
  "0xf8fd06a8835c514c88280a34d387afa2e5fa2806" || echo "BotBettingEscrow verification failed"

# NFT System
echo ""
echo "🎨 Verifying NFT System..."
npx hardhat verify --network baseSepolia 0x72aeecc947dd61493e0af9d92cb008abc2a3c253 \
  "0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634" \
  "1" \
  "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c" \
  "0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a" || echo "GachaMintPass verification failed"
npx hardhat verify --network baseSepolia 0xcce654fd2f14fbbc3030096c7d25ebaad7b09506 \
  "Barely Human Art" \
  "BHA" || echo "BarelyHumanArt verification failed"
npx hardhat verify --network baseSepolia 0xbaa68b16f5d39e2f0f82d58ca7ed84a637c2da1c \
  "0x72aeecc947dd61493e0af9d92cb008abc2a3c253" \
  "0xcce654fd2f14fbbc3030096c7d25ebaad7b09506" || echo "ArtRedemptionService verification failed"

# Bot Vaults
echo ""
echo "🏦 Verifying Bot Vaults..."
VAULTS=(
  "0xbbb3749e98f69aab8479e36a8c9bb20e57eca5a7"
  "0xd5e6deb92ce3c92094d71f882aa4b4413c84d963"
  "0x630b32e728213642696aca275adf99785f828f8f"
  "0x5afc95bbffd63d3f710f65942c1e19dd1e02e96d"
  "0xbe3640bc365bbbd494bd845cf7971763555224ef"
  "0x08a2e185da382f8a8c81101ecdb9389767a93e32"
  "0xff915c886e0395c3b17f60c961ffbe9fb2939524"
  "0x857e21b68440dbcd6eee5ef606ce3c10f9590f33"
  "0xfcc050bb159bfc49cefa59efddaa02fd7709df8f"
  "0xd168d2d603b946d86be55e1b949c08b3e9ee6fbf"
)

NAMES=("Alice" "Bob" "Charlie" "Diana" "Eddie" "Fiona" "Greg" "Helen" "Ivan" "Julia")

for i in "${!VAULTS[@]}"; do
  echo "Verifying ${NAMES[$i]} vault..."
  npx hardhat verify --network baseSepolia ${VAULTS[$i]} \
    "0xedbce0a53a24f9e5f4684937ed3ee64e936cd048" \
    "$i" \
    "${NAMES[$i]}" \
    "0xb7470bd86d639d294cfc83b5b2ebf5cf5ea89486" || echo "${NAMES[$i]} vault verification failed"
done

echo ""
echo "✅ Verification process complete!"
echo "Check BaseScan for verification status: https://sepolia.basescan.org"