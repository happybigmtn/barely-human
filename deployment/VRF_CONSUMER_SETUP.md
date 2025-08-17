# 🔗 VRF Consumer Setup Guide

**Date**: August 17, 2025  
**Network**: Base Sepolia (Chain ID: 84532)  
**Subscription ID**: 22376417694825733668962562671731634456669048679979758256841549539628619732572

---

## 🎯 Contracts That Need VRF Access

### 1. BotManager (HIGH PRIORITY)
- **Address**: `0xb7470bd86d639d294cfc83b5b2ebf5cf5ea89486`
- **Purpose**: AI bot decision making and personality randomization
- **VRF Usage**: Random seed for bot behavior variations

### 2. GachaMintPass (MEDIUM PRIORITY)
- **Address**: `0x72aeecc947dd61493e0af9d92cb008abc2a3c253`
- **Purpose**: NFT raffle system after game series
- **VRF Usage**: Random selection of raffle winners

### 3. CrapsGame (ALREADY ADDED ✅)
- **Address**: `0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a`
- **Purpose**: Core dice rolling functionality
- **Status**: Already added as VRF consumer

---

## 📋 Manual Setup Steps

### Step 1: Access Chainlink VRF Dashboard
1. Go to: https://vrf.chain.link/base-sepolia
2. Connect your wallet (Deployer: `0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB`)
3. Navigate to your subscription

### Step 2: Find Your Subscription
- **Subscription ID**: 22376417694825733668962562671731634456669048679979758256841549539628619732572
- **Alternative**: Look for subscription owned by `0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB`

### Step 3: Add Consumers
Click "Add Consumer" and add these addresses:

1. **BotManager**: `0xb7470bd86d639d294cfc83b5b2ebf5cf5ea89486`
2. **GachaMintPass**: `0x72aeecc947dd61493e0af9d92cb008abc2a3c253`

---

## 🔧 Alternative: Contract Call Method

If the dashboard doesn't work, you can add consumers directly via contract:

### VRF Coordinator Contract
- **Address**: `0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634`
- **Function**: `addConsumer(uint256 subId, address consumer)`

### Example Transaction (using Cast)
```bash
# Add BotManager
cast send 0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634 \
  "addConsumer(uint256,address)" \
  22376417694825733668962562671731634456669048679979758256841549539628619732572 \
  0xb7470bd86d639d294cfc83b5b2ebf5cf5ea89486 \
  --rpc-url https://sepolia.base.org \
  --private-key $DEPLOYER_PRIVATE_KEY

# Add GachaMintPass  
cast send 0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634 \
  "addConsumer(uint256,address)" \
  22376417694825733668962562671731634456669048679979758256841549739628619732572 \
  0x72aeecc947dd61493e0af9d92cb008abc2a3c253 \
  --rpc-url https://sepolia.base.org \
  --private-key $DEPLOYER_PRIVATE_KEY
```

---

## 🧪 Verification Steps

### Check if Consumer Added Successfully

1. **Via Dashboard**: Check consumer list in VRF dashboard
2. **Via Contract Call**: 
   ```bash
   cast call 0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634 \
     "getSubscription(uint256)" \
     22376417694825733668962562671731634456669048679979758256841549539628619732572 \
     --rpc-url https://sepolia.base.org
   ```

### Test VRF Request
Once consumers are added, test a VRF request:

```bash
# Test BotManager VRF request (if it has a test function)
cast send 0xb7470bd86d639d294cfc83b5b2ebf5cf5ea89486 \
  "requestRandomness()" \
  --rpc-url https://sepolia.base.org \
  --private-key $DEPLOYER_PRIVATE_KEY
```

---

## ⚠️ Troubleshooting

### Common Issues:

1. **Subscription Not Found**
   - Double-check subscription ID
   - Ensure you're connected with the right wallet
   - Verify network is Base Sepolia

2. **Access Denied**
   - Only subscription owner can add consumers
   - Check if deployer wallet owns the subscription

3. **Contract Not Found**
   - Verify contract addresses are correct
   - Ensure contracts are deployed to Base Sepolia

### Alternative Subscription IDs to Try:
If the main ID doesn't work, try these formats:
- Decimal: `22376417694825733668962562671731634456669048679979758256841549539628619732572`
- Hex: Convert to hex if needed
- Shortened: Check if there's a shorter numeric ID

---

## 📊 Current Status Check

Run this command to check current subscription status:
```bash
node scripts/check-vrf-setup.ts
```

Expected output should show:
- ✅ CrapsGame (already added)
- ❌ BotManager (needs to be added)
- ❌ GachaMintPass (needs to be added)

---

## 🎯 Success Criteria

VRF setup is complete when:
1. ✅ BotManager can request randomness
2. ✅ GachaMintPass can run raffles
3. ✅ CrapsGame continues to work
4. ✅ All consumers show in dashboard
5. ✅ Test VRF requests succeed

---

## 📞 Next Steps After VRF Setup

1. **Test Game Functionality**: Run a complete game series
2. **Verify Randomness**: Check VRF fulfillment works
3. **Fund Vaults**: Add BOT tokens for gameplay
4. **Integration Testing**: End-to-end system test

---

**Manual Action Required**: Use Chainlink VRF dashboard to add consumers  
**Priority**: HIGH - Required for bot functionality  
**Time Needed**: 5-10 minutes via web interface