/**
 * Centralized State Management for CLI Operations
 * Handles persistent state, user preferences, and session data
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class StateManager {
  constructor() {
    this.stateDir = path.join(__dirname, '../../../.cli-state');
    this.sessionFile = path.join(this.stateDir, 'session.json');
    this.preferencesFile = path.join(this.stateDir, 'preferences.json');
    this.historyFile = path.join(this.stateDir, 'command-history.json');
    
    // In-memory state
    this.currentSession = null;
    this.preferences = null;
    this.commandHistory = [];
    this.transactionHistory = [];
    this.gasUsageHistory = [];
    
    this.ensureStateDirectory();
    this.loadState();
  }

  /**
   * Ensure state directory exists
   */
  ensureStateDirectory() {
    if (!fs.existsSync(this.stateDir)) {
      fs.mkdirSync(this.stateDir, { recursive: true });
    }
  }

  /**
   * Load persistent state from disk
   */
  loadState() {
    try {
      // Load session data
      if (fs.existsSync(this.sessionFile)) {
        this.currentSession = JSON.parse(fs.readFileSync(this.sessionFile, 'utf8'));
      } else {
        this.currentSession = this.createNewSession();
      }

      // Load preferences
      if (fs.existsSync(this.preferencesFile)) {
        this.preferences = JSON.parse(fs.readFileSync(this.preferencesFile, 'utf8'));
      } else {
        this.preferences = this.getDefaultPreferences();
      }

      // Load command history
      if (fs.existsSync(this.historyFile)) {
        const history = JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
        this.commandHistory = history.commands || [];
        this.transactionHistory = history.transactions || [];
        this.gasUsageHistory = history.gasUsage || [];
      }
    } catch (error) {
      console.warn('Failed to load state:', error.message);
      this.resetState();
    }
  }

  /**
   * Save state to disk
   */
  saveState() {
    try {
      // Save session
      fs.writeFileSync(this.sessionFile, JSON.stringify(this.currentSession, null, 2));
      
      // Save preferences
      fs.writeFileSync(this.preferencesFile, JSON.stringify(this.preferences, null, 2));
      
      // Save history (keep last 1000 entries)
      const historyData = {
        commands: this.commandHistory.slice(-1000),
        transactions: this.transactionHistory.slice(-1000),
        gasUsage: this.gasUsageHistory.slice(-1000),
        lastUpdated: new Date().toISOString()
      };
      fs.writeFileSync(this.historyFile, JSON.stringify(historyData, null, 2));
    } catch (error) {
      console.warn('Failed to save state:', error.message);
    }
  }

  /**
   * Create new session
   */
  createNewSession() {
    return {
      id: Date.now().toString(),
      startTime: new Date().toISOString(),
      network: 'local',
      contractAddresses: {},
      testResults: [],
      gasUsage: [],
      lastActivity: new Date().toISOString()
    };
  }

  /**
   * Get default preferences
   */
  getDefaultPreferences() {
    return {
      defaultNetwork: 'local',
      gasReporting: true,
      verboseOutput: true,
      autoSave: true,
      theme: 'dark',
      maxHistoryEntries: 1000,
      cacheEnabled: true,
      defaultBetAmount: '10',
      defaultVaultAmount: '100'
    };
  }

  /**
   * Reset all state to defaults
   */
  resetState() {
    this.currentSession = this.createNewSession();
    this.preferences = this.getDefaultPreferences();
    this.commandHistory = [];
    this.transactionHistory = [];
    this.gasUsageHistory = [];
    this.saveState();
  }

  /**
   * Update session data
   */
  updateSession(updates) {
    this.currentSession = {
      ...this.currentSession,
      ...updates,
      lastActivity: new Date().toISOString()
    };
    
    if (this.preferences.autoSave) {
      this.saveState();
    }
  }

  /**
   * Update preferences
   */
  updatePreferences(updates) {
    this.preferences = {
      ...this.preferences,
      ...updates
    };
    this.saveState();
  }

  /**
   * Add command to history
   */
  addCommand(command, args, result, duration) {
    const entry = {
      timestamp: new Date().toISOString(),
      command,
      args,
      result: result ? 'success' : 'failed',
      duration,
      network: this.currentSession.network
    };
    
    this.commandHistory.push(entry);
    
    if (this.preferences.autoSave) {
      this.saveState();
    }
  }

  /**
   * Add transaction to history
   */
  addTransaction(txData) {
    const entry = {
      timestamp: new Date().toISOString(),
      ...txData,
      network: this.currentSession.network
    };
    
    this.transactionHistory.push(entry);
    
    if (this.preferences.autoSave) {
      this.saveState();
    }
  }

  /**
   * Add gas usage data
   */
  addGasUsage(gasData) {
    const entry = {
      timestamp: new Date().toISOString(),
      ...gasData,
      network: this.currentSession.network
    };
    
    this.gasUsageHistory.push(entry);
    this.currentSession.gasUsage.push(entry);
    
    if (this.preferences.autoSave) {
      this.saveState();
    }
  }

  /**
   * Get session statistics
   */
  getSessionStats() {
    const session = this.currentSession;
    const now = new Date();
    const startTime = new Date(session.startTime);
    const duration = now - startTime;
    
    return {
      sessionId: session.id,
      duration: Math.round(duration / 1000), // seconds
      network: session.network,
      totalCommands: this.commandHistory.filter(cmd => 
        new Date(cmd.timestamp) >= startTime
      ).length,
      totalTransactions: this.transactionHistory.filter(tx => 
        new Date(tx.timestamp) >= startTime
      ).length,
      totalGasUsed: this.gasUsageHistory
        .filter(gas => new Date(gas.timestamp) >= startTime)
        .reduce((total, gas) => total + parseInt(gas.gasUsed || 0), 0),
      successfulTests: session.testResults.filter(test => test.status === 'PASS').length,
      failedTests: session.testResults.filter(test => test.status === 'FAIL').length
    };
  }

  /**
   * Get command history with filters
   */
  getCommandHistory(filters = {}) {
    let history = [...this.commandHistory];
    
    if (filters.command) {
      history = history.filter(cmd => cmd.command === filters.command);
    }
    
    if (filters.network) {
      history = history.filter(cmd => cmd.network === filters.network);
    }
    
    if (filters.since) {
      const since = new Date(filters.since);
      history = history.filter(cmd => new Date(cmd.timestamp) >= since);
    }
    
    if (filters.limit) {
      history = history.slice(-filters.limit);
    }
    
    return history;
  }

  /**
   * Get gas usage analytics
   */
  getGasAnalytics(timeframe = '24h') {
    const now = new Date();
    let since;
    
    switch (timeframe) {
      case '1h':
        since = new Date(now - 60 * 60 * 1000);
        break;
      case '24h':
        since = new Date(now - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        since = new Date(now - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        since = new Date(0);
    }
    
    const relevantGas = this.gasUsageHistory.filter(gas => 
      new Date(gas.timestamp) >= since
    );
    
    if (relevantGas.length === 0) {
      return { totalGas: 0, avgGas: 0, transactions: 0, totalCost: 0 };
    }
    
    const totalGas = relevantGas.reduce((sum, gas) => sum + parseInt(gas.gasUsed || 0), 0);
    const totalCost = relevantGas.reduce((sum, gas) => sum + parseFloat(gas.gasCost || 0), 0);
    
    return {
      totalGas,
      avgGas: Math.round(totalGas / relevantGas.length),
      transactions: relevantGas.length,
      totalCost: totalCost.toFixed(6),
      timeframe
    };
  }

  /**
   * Export session data
   */
  exportSessionData() {
    return {
      session: this.currentSession,
      preferences: this.preferences,
      stats: this.getSessionStats(),
      gasAnalytics: this.getGasAnalytics(),
      recentCommands: this.getCommandHistory({ limit: 50 }),
      exportTimestamp: new Date().toISOString()
    };
  }

  /**
   * Cleanup old history entries
   */
  cleanupHistory() {
    const maxEntries = this.preferences.maxHistoryEntries;
    
    if (this.commandHistory.length > maxEntries) {
      this.commandHistory = this.commandHistory.slice(-maxEntries);
    }
    
    if (this.transactionHistory.length > maxEntries) {
      this.transactionHistory = this.transactionHistory.slice(-maxEntries);
    }
    
    if (this.gasUsageHistory.length > maxEntries) {
      this.gasUsageHistory = this.gasUsageHistory.slice(-maxEntries);
    }
    
    this.saveState();
  }
}

export default StateManager;