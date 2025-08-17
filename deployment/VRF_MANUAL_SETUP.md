# 🔗 VRF Manual Setup Guide - IMMEDIATE ACTION REQUIRED

**Date**: August 17, 2025  
**Status**: AUTOMATED SETUP BLOCKED - MANUAL SETUP NEEDED  
**Priority**: HIGH (Required for game functionality)

---

## 🎯 Quick Manual Setup (5 Minutes)

### Step 1: Access Chainlink VRF Dashboard
1. **Go to**: https://vrf.chain.link/base-sepolia
2. **Connect Wallet**: Use deployer wallet `0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB`
3. **Find Your Subscription**: Look for subscription ID #1 or #2 (created recently)

### Step 2: Add These Consumers
Click "Add Consumer" and add these contract addresses:

#### Required Consumers:
1. **BotManager**: `0xb7470bd86d639d294cfc83b5b2ebf5cf5ea89486`
   - Purpose: AI bot decision randomness
   - Critical: YES (required for bot functionality)

2. **GachaMintPass**: `0x72aeecc947dd61493e0af9d92cb008abc2a3c253`
   - Purpose: NFT raffle system
   - Critical: MEDIUM (required for rewards)

3. **CrapsGame**: `0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a`
   - Purpose: Dice rolling randomness
   - Critical: YES (core game functionality)

### Step 3: Fund Subscription (If Needed)
- **Minimum Required**: 0.005 ETH
- **Recommended**: 0.01 ETH for testing
- **Click**: "Add Funds" and send ETH

---

## ✅ Verification Checklist

After adding consumers, verify:
- [ ] All 3 contracts appear in consumer list
- [ ] Subscription has >0.005 ETH balance
- [ ] No error messages on dashboard
- [ ] Deployer wallet is subscription owner

---

## 🚀 Alternative: Contract-Based Setup

If dashboard doesn't work, use this direct contract approach:

### VRF Coordinator Contract
- **Address**: `0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634`
- **Function**: `addConsumer(uint256 subId, address consumer)`

### Example Commands (using Cast)
```bash
# Add BotManager (replace SUBSCRIPTION_ID with your ID)
cast send 0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634 \
  "addConsumer(uint256,address)" \
  SUBSCRIPTION_ID \
  0xb7470bd86d639d294cfc83b5b2ebf5cf5ea89486 \
  --rpc-url https://base-sepolia.g.alchemy.com/v2/iDbJG_oX6QlK67ZmXFrmk \
  --private-key $DEPLOYER_PRIVATE_KEY

# Add GachaMintPass
cast send 0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634 \
  "addConsumer(uint256,address)" \
  SUBSCRIPTION_ID \
  0x72aeecc947dd61493e0af9d92cb008abc2a3c253 \
  --rpc-url https://base-sepolia.g.alchemy.com/v2/iDbJG_oX6QlK67ZmXFrmk \
  --private-key $DEPLOYER_PRIVATE_KEY

# Add CrapsGame
cast send 0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634 \
  "addConsumer(uint256,address)" \
  SUBSCRIPTION_ID \
  0x2b70c39fdcfa3a4a69ef10b9ae157020d451708a \
  --rpc-url https://base-sepolia.g.alchemy.com/v2/iDbJG_oX6QlK67ZmXFrmk \
  --private-key $DEPLOYER_PRIVATE_KEY
```

---

## 📊 Expected Result

After successful setup, your subscription should show:
- **Owner**: `0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB`
- **Balance**: >0.005 ETH
- **Consumers**: 3 contracts listed
- **Status**: Active and ready for requests

---

## 🧪 Test VRF Functionality

Once consumers are added, test with this command:
```bash
npx hardhat run scripts/test-vrf-integration.ts --network baseSepolia
```

Expected: Should show all consumers added and ready for randomness requests.

---

## ⚠️ Common Issues & Solutions

### Issue: "Consumer not found"
- **Solution**: Ensure contract addresses are exact (case-sensitive)
- **Check**: Copy-paste addresses from deployment logs

### Issue: "Insufficient balance"
- **Solution**: Add more ETH to subscription (minimum 0.005 ETH)

### Issue: "Not subscription owner"
- **Solution**: Ensure you're connected with deployer wallet
- **Check**: Wallet address matches `0x61286F80b60E4dBa60E923a975dEe8B84f92d6CB`

### Issue: "Transaction fails"
- **Solution**: Try web interface instead of command line
- **Alternative**: Use cast commands with direct contract calls

---

## 🎯 Success Criteria

VRF setup is complete when:
1. ✅ All 3 consumers show in dashboard
2. ✅ Subscription has adequate ETH balance
3. ✅ No error messages on VRF dashboard
4. ✅ Test script confirms VRF ready

---

**URGENT**: This step is required before any game testing can proceed.  
**Time Required**: 5-10 minutes via web interface  
**Next Step**: Contract verification after VRF setup complete