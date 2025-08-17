# 🔒 SECURITY REMINDER - Private Keys & Bot Wallets

## ⚠️ CRITICAL: NEVER COMMIT THESE FILES

### 🔐 **Protected File Patterns (Already in .gitignore):**

```bash
# Private Keys (Any Format)
*.private.json
*private-key*
*privatekey*
*private_key*
*.key
*.pem
*.keystore

# Wallet Files
*wallet*.json
*mnemonic*
*seed*.json
accounts.json

# Bot Wallets (ESPECIALLY IMPORTANT)
*bot*wallet*.json
*botWallet*.json
bot-accounts.json
bot-keys*.json
bot-wallets*.json
*bot*private*key*
bot-credentials.json
*bot*seed*.json

# Deployer & Admin Keys
*deployer*.json
vrf-subscription-*.json
```

## 🚨 **Bot Wallet Security**

Bot wallets are **ESPECIALLY CRITICAL** because:
- ✅ They control real funds on Base Sepolia
- ✅ They have staking pool access 
- ✅ They can place bets and withdraw winnings
- ✅ Compromise = immediate financial loss

### **Current Bot Wallet Generation:**
```javascript
// In scripts - these generate deterministic addresses:
const botWallet = viem.privateKeyToAccount(`0x${(i + 100).toString(16).padStart(64, '0')}`);
```

**⚠️ WARNING**: These are test patterns, but still should never be committed if saved to files.

## ✅ **Safe Practices:**

### **1. Environment Variables (Recommended):**
```bash
# .env (already in .gitignore)
BOT_PRIVATE_KEY_0=0x...
BOT_PRIVATE_KEY_1=0x...
DEPLOYER_PRIVATE_KEY=0x...
VRF_SUBSCRIPTION_ID=...
```

### **2. Runtime Generation:**
```javascript
// Generate wallets in memory only
const botWallets = [];
for (let i = 0; i < 10; i++) {
    botWallets.push(ethers.Wallet.createRandom());
}
// Never write to files!
```

### **3. External Key Management:**
- Use hardware wallets for mainnet
- Use encrypted key stores
- Use environment-specific configs

## 🔍 **Before Every Commit:**

```bash
# Check what you're committing
git status
git diff --cached

# Look for suspicious patterns
git diff --cached | grep -i "private\|key\|wallet\|mnemonic"

# If you see any keys or sensitive data - STOP!
git reset HEAD <file>  # Remove from staging
```

## 🛠️ **If Keys Were Accidentally Committed:**

### **IMMEDIATE ACTION REQUIRED:**

1. **Rotate all affected keys immediately**
2. **Remove from git history:**
   ```bash
   git filter-repo --strip-blobs-bigger-than 1M
   # Or use BFG Repo Cleaner for specific files
   ```
3. **Force push with new history**
4. **Update all deployments with new keys**

### **Check Git History:**
```bash
# Look for any historical key commits
git log --all --grep="key\|wallet\|private" --oneline
git log --all --follow -- "*key*" "*wallet*" "*private*"
```

## 📋 **Security Checklist:**

- [ ] ✅ .gitignore includes all private key patterns
- [ ] ✅ No wallet files in git history
- [ ] ✅ Bot wallets use environment variables
- [ ] ✅ Deployer keys are in .env only
- [ ] ✅ VRF subscription managed externally
- [ ] ✅ Team trained on key security
- [ ] ✅ Regular security audits of repo

## 🎯 **Current Status:**

- ✅ **Enhanced .gitignore** with comprehensive patterns
- ✅ **No private keys found** in current repository
- ✅ **Bot wallet patterns** added to exclusions
- ✅ **Backup directories** excluded from tracking

---

## 🆘 **Emergency Contacts:**

If you suspect a key compromise:
1. **Immediately** rotate all affected keys
2. **Check** on-chain activity for unauthorized transactions
3. **Update** all team members
4. **Review** access logs and deployment history

**Remember: Prevention is easier than recovery!** 🔐

---

**🎰 Barely Human Casino - Security First, Always** 🛡️