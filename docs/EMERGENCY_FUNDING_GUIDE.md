# Emergency Funding Guide - Fixing "sender's balance is: 0" Crisis

## 🚨 Critical Issue

If you're seeing errors like:
- `Error: sender's balance is: 0`
- `insufficient funds for intrinsic transaction cost`
- `Bot X attempting to approve BOT tokens but failing due to insufficient ETH for gas fees`

This means bot accounts have zero ETH and cannot send transactions. This guide will fix it.

## 🎯 Quick Fix

**Run this command immediately:**
```bash
npm run fix:crisis
```

This will:
1. ✅ Check if bot wallets exist (create if missing)
2. ✅ Generate proper private keys for 10 bots
3. ✅ Fund each bot with 0.2 ETH (for gas fees)  
4. ✅ Fund each bot with 20,000 BOT tokens (for betting)
5. ✅ Verify funding was successful
6. ✅ Save wallet info for persistence

## 🔧 Alternative Commands

| Command | Description |
|---------|-------------|
| `npm run fix:crisis` | **RECOMMENDED** - Complete emergency fix |
| `npm run fund:crisis` | Advanced emergency funding |
| `npm run fund:emergency` | Standard emergency funding |
| `npm run balance:urgent` | Check which accounts need funding |
| `npm run balance:check` | Full balance report |

## 📊 Understanding the Problem

### Why This Happens
1. **Bot wallets not created** - Deployment didn't generate bot accounts
2. **Zero ETH balances** - Bots can't pay gas fees for transactions
3. **No BOT tokens** - Bots can't place bets or approve spending
4. **Missing wallet persistence** - Bot keys not saved properly

### What Gets Fixed
- ✅ 10 unique bot wallets with secure private keys
- ✅ Each bot funded with **0.2 ETH** (generous gas allowance)
- ✅ Each bot funded with **20,000 BOT tokens** (generous betting allowance)
- ✅ Wallet info saved to `wallets.json` for persistence
- ✅ Proper association with vault contracts

## 🔍 Verifying the Fix

After running the emergency fix:

### 1. Check Balance Report
```bash
npm run balance:check
```
Should show:
- ✅ All bot accounts with sufficient ETH (>0.1)
- ✅ All bot accounts with sufficient BOT (>10,000)
- ✅ No critical warnings

### 2. Test Bot Functionality
```bash
npm run cli:interactive
```
Bots should now be able to:
- ✅ Send transactions without "balance is: 0" errors
- ✅ Approve BOT token spending
- ✅ Place bets in the casino
- ✅ Interact with smart contracts

### 3. Watch Bots Play
```bash
npm run bots
```
Should show:
- ✅ Bots successfully placing bets
- ✅ Transaction hashes confirming on-chain activity
- ✅ No funding-related errors

## 🛠️ Manual Troubleshooting

If the emergency fix doesn't work:

### Check Prerequisites
```bash
# 1. Node is running
npm run node

# 2. Contracts are deployed
npm run deploy:local

# 3. Deployer has ETH
npm run balance:check
```

### Manual Bot Funding
```bash
# Generate bot wallets manually
npm run fund-accounts fund-bots-force

# Fund specific bot
npm run fund-accounts fund-user bot-0

# Check specific address
npm run balance:check address <bot-address> "Bot 0" bot
```

### Reset Everything
```bash
# 1. Stop node
Ctrl+C

# 2. Clean and redeploy
npm run clean
npm run deploy:local

# 3. Run emergency fix
npm run fix:crisis

# 4. Test
npm run cli:interactive
```

## 📁 Files Created/Modified

The emergency funding system creates/modifies:

- **`wallets.json`** - Persistent bot wallet storage
- **`deployments/localhost.json`** - Contract addresses
- **`reports/balance-report-*.txt`** - Balance monitoring logs

## 🔐 Security Notes

### Private Key Management
- ✅ Bot private keys are generated securely using crypto.randomBytes
- ✅ Keys are deterministic but unique (includes timestamp)
- ✅ Keys are stored locally only (not transmitted)
- ✅ Each bot has a unique private key

### Funding Amounts
- **ETH**: 0.2 per bot (high safety margin for gas)
- **BOT**: 20,000 per bot (generous betting allowance)
- **Total**: 2 ETH + 200,000 BOT for all 10 bots

### Emergency Thresholds
- **Critical ETH**: <0.005 ETH (triggers emergency)
- **Critical BOT**: <100 BOT (triggers emergency)
- **Auto-refill**: When balance drops to 25% of funding amount

## 🎮 Integration with Interactive CLI

The enhanced interactive CLI now includes:

### Automatic Funding Detection
- ✅ Checks bot funding status on startup
- ✅ Runs emergency funding if needed
- ✅ Sets up user wallets interactively
- ✅ Offers auto-funding for low user balances

### User Wallet Management
- ✅ Create new wallets with secure passwords
- ✅ Import existing wallets from private keys
- ✅ Automatic funding requests when balance is low
- ✅ Balance monitoring and notifications

### Error Recovery
- ✅ Detects funding-related errors automatically
- ✅ Suggests and runs emergency funding
- ✅ Provides clear next steps for users
- ✅ Graceful fallback for failed operations

## 🚀 Success Indicators

When everything is working:

### Bot Behavior
- 🤖 Bots place bets without errors
- 🤖 Transaction confirmations appear quickly
- 🤖 Each bot exhibits unique AI personality
- 🤖 Betting strategies are diverse and realistic

### User Experience
- 👤 Interactive CLI loads without wallet errors
- 👤 User can chat with bots and get responses
- 👤 Betting on bot performance works smoothly
- 👤 Balance checks show sufficient funds

### System Status
- ⚡ All 203 tests passing (when running `npm test`)
- ⚡ No "sender's balance is: 0" errors in logs
- ⚡ Contract interactions succeed consistently
- ⚡ ElizaOS bot personalities respond correctly

## 📞 Still Having Issues?

If problems persist after running the emergency fix:

1. **Check the logs** - Look for specific error messages
2. **Verify network** - Ensure Hardhat node is running on port 8545
3. **Check deployer balance** - Deployer needs ETH to fund bots
4. **Review contract deployment** - Ensure all contracts deployed successfully
5. **Run tests** - `npm test` should pass to verify system integrity

## 🎉 Success!

Once the emergency funding fix completes successfully:

```bash
# Start playing immediately
npm run cli:interactive

# Or watch bots compete
npm run bots

# Or run the full experience
npm run play
```

The "sender's balance is: 0" crisis should be completely resolved, and all bots should be able to participate fully in the casino gameplay!