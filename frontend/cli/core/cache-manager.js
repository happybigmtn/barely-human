/**
 * Performance Caching Layer for Contract Calls
 * Reduces redundant blockchain calls and improves CLI responsiveness
 */

export class CacheManager {
  constructor(options = {}) {
    this.cache = new Map();
    this.ttl = options.ttl || 300000; // 5 minutes default
    this.enabled = options.enabled !== false;
    this.maxSize = options.maxSize || 1000;
    this.hitCount = 0;
    this.missCount = 0;
    
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Every minute
  }

  /**
   * Generate cache key from contract call parameters
   */
  generateKey(contractName, methodName, params = [], blockNumber = 'latest') {
    const paramString = JSON.stringify(params);
    return `${contractName}.${methodName}(${paramString})@${blockNumber}`;
  }

  /**
   * Get cached result if available and not expired
   */
  get(contractName, methodName, params = [], blockNumber = 'latest') {
    if (!this.enabled) return null;

    const key = this.generateKey(contractName, methodName, params, blockNumber);
    const entry = this.cache.get(key);

    if (!entry) {
      this.missCount++;
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      this.missCount++;
      return null;
    }

    this.hitCount++;
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    return entry.data;
  }

  /**
   * Store result in cache
   */
  set(contractName, methodName, params = [], result = null, blockNumber = 'latest') {
    if (!this.enabled) return;

    const key = this.generateKey(contractName, methodName, params, blockNumber);
    
    // Check size limit
    if (this.cache.size >= this.maxSize) {
      this.evictLeastUsed();
    }

    this.cache.set(key, {
      data: result,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 1,
      contractName,
      methodName
    });
  }

  /**
   * Evict least recently used entries
   */
  evictLeastUsed() {
    let oldestEntry = null;
    let oldestKey = null;

    for (const [key, entry] of this.cache.entries()) {
      if (!oldestEntry || entry.lastAccessed < oldestEntry.lastAccessed) {
        oldestEntry = entry;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Invalidate cache for specific contract or method
   */
  invalidate(contractName, methodName = null) {
    const keysToDelete = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.contractName === contractName) {
        if (!methodName || entry.methodName === methodName) {
          keysToDelete.push(key);
        }
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    const now = Date.now();
    const keysToDelete = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? (this.hitCount / totalRequests * 100).toFixed(2) : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: `${hitRate}%`,
      enabled: this.enabled,
      ttl: this.ttl
    };
  }

  /**
   * Smart caching for different call types
   */
  shouldCache(contractName, methodName) {
    // Always cache view/pure functions
    const viewMethods = [
      'balanceOf', 'totalSupply', 'name', 'symbol', 'decimals',
      'getBalance', 'getTreasuryStats', 'getStakedBalance',
      'getRewardBalance', 'totalStaked', 'totalAssets',
      'currentSeriesId', 'gamePhase', 'currentPoint',
      'getBotInfo', 'getBotPerformance', 'activeBots'
    ];

    // Never cache state-changing functions
    const stateMethods = [
      'transfer', 'approve', 'stake', 'withdraw', 'claimRewards',
      'placeBet', 'rollDice', 'deposit', 'distributeFees'
    ];

    if (stateMethods.includes(methodName)) {
      return false;
    }

    if (viewMethods.includes(methodName)) {
      return true;
    }

    // Default to caching read-only methods
    return !methodName.includes('set') && 
           !methodName.includes('update') && 
           !methodName.includes('execute');
  }

  /**
   * Wrap contract method with caching
   */
  wrapContractMethod(contract, contractName, methodName) {
    const originalMethod = contract[methodName];
    
    if (!originalMethod) {
      return originalMethod;
    }

    return async (...args) => {
      // Don't cache if method shouldn't be cached
      if (!this.shouldCache(contractName, methodName)) {
        const result = await originalMethod.call(contract, ...args);
        // Invalidate related cache entries after state changes
        this.invalidate(contractName);
        return result;
      }

      // Try to get from cache first
      const cached = this.get(contractName, methodName, args);
      if (cached !== null) {
        return cached;
      }

      // Execute method and cache result
      try {
        const result = await originalMethod.call(contract, ...args);
        this.set(contractName, methodName, args, result);
        return result;
      } catch (error) {
        // Don't cache errors
        throw error;
      }
    };
  }

  /**
   * Wrap all methods of a contract with caching
   */
  wrapContract(contract, contractName) {
    // For ethers v6 contracts, we need to create a proxy that intercepts method calls
    // since the contract methods are not enumerable properties
    return new Proxy(contract, {
      get: (target, prop, receiver) => {
        const originalValue = Reflect.get(target, prop, receiver);
        
        // If it's a function and looks like a contract method, wrap it
        if (typeof originalValue === 'function' && typeof prop === 'string') {
          // Check if it's a contract interface method by looking at the contract's interface
          if (target.interface && target.interface.hasFunction && target.interface.hasFunction(prop)) {
            return this.wrapContractMethod(target, contractName, prop);
          }
        }
        
        return originalValue;
      }
    });
  }

  /**
   * Enable or disable caching
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }

  /**
   * Update TTL for future cache entries
   */
  setTTL(ttl) {
    this.ttl = ttl;
  }

  /**
   * Destroy cache manager
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

export default CacheManager;