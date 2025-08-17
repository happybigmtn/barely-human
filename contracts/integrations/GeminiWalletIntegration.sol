// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title GeminiWalletIntegration
 * @notice Integration with Gemini's passkey-secured ERC-7579 modular accounts for casino
 * @dev Enables GUSD deposits/withdrawals and account abstraction features
 */
contract GeminiWalletIntegration is AccessControl, ReentrancyGuard {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    
    // ERC-7579 Module Types
    uint256 constant VALIDATION_TYPE = 1;
    uint256 constant EXECUTION_TYPE = 2;
    uint256 constant FALLBACK_TYPE = 3;
    uint256 constant HOOK_TYPE = 4;
    
    struct GeminiAccount {
        address account;           // ERC-7579 modular account address
        bool isPasskeyEnabled;     // Whether passkey authentication is enabled
        uint256 depositLimit;      // Daily deposit limit in GUSD
        uint256 withdrawLimit;     // Daily withdrawal limit in GUSD
        uint256 lastActivity;      // Last activity timestamp
        uint256 totalDeposited;    // Total GUSD deposited
        uint256 totalWithdrawn;    // Total GUSD withdrawn
        bytes32 passkeyHash;       // Hash of passkey credential
    }
    
    struct ModuleConfig {
        address moduleAddress;
        uint256 moduleType;
        bytes initData;
        bool isActive;
    }
    
    // Gemini Dollar (GUSD) token address
    IERC20 public immutable GUSD;
    
    // Casino contracts
    address public casinoVault;
    address public rebateContract;
    
    // Account tracking
    mapping(address => GeminiAccount) public geminiAccounts;
    mapping(address => ModuleConfig[]) public accountModules;
    mapping(bytes32 => address) public passkeyToAccount;
    
    // Daily limits
    mapping(address => mapping(uint256 => uint256)) public dailyDeposits;
    mapping(address => mapping(uint256 => uint256)) public dailyWithdrawals;
    
    // Statistics
    uint256 public totalGUSDDeposited;
    uint256 public totalGUSDWithdrawn;
    uint256 public activeAccounts;
    
    // Events
    event GeminiAccountCreated(address indexed user, address indexed account, bytes32 passkeyHash);
    event PasskeyRegistered(address indexed account, bytes32 passkeyHash);
    event ModuleInstalled(address indexed account, address module, uint256 moduleType);
    event GUSDDeposited(address indexed account, uint256 amount, address destination);
    event GUSDWithdrawn(address indexed account, uint256 amount);
    event LimitsUpdated(address indexed account, uint256 depositLimit, uint256 withdrawLimit);
    
    // Errors
    error InvalidAccount();
    error PasskeyVerificationFailed();
    error DailyLimitExceeded();
    error InsufficientBalance();
    error ModuleNotSupported();
    error AccountAlreadyExists();
    
    constructor(
        address _gusd,
        address _casinoVault,
        address _rebateContract
    ) {
        require(_gusd != address(0), "Invalid GUSD");
        require(_casinoVault != address(0), "Invalid vault");
        
        GUSD = IERC20(_gusd);
        casinoVault = _casinoVault;
        rebateContract = _rebateContract;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }
    
    /**
     * @notice Creates a new Gemini wallet account with passkey
     * @param passkeyCredential Passkey credential data
     * @param depositLimit Daily GUSD deposit limit
     * @param withdrawLimit Daily GUSD withdrawal limit
     */
    function createGeminiAccount(
        bytes calldata passkeyCredential,
        uint256 depositLimit,
        uint256 withdrawLimit
    ) external returns (address accountAddress) {
        if (geminiAccounts[msg.sender].account != address(0)) {
            revert AccountAlreadyExists();
        }
        
        // Generate passkey hash
        bytes32 passkeyHash = keccak256(passkeyCredential);
        
        // Deploy ERC-7579 modular account (simplified for hackathon)
        accountAddress = _deployModularAccount(msg.sender, passkeyHash);
        
        // Store account data
        geminiAccounts[msg.sender] = GeminiAccount({
            account: accountAddress,
            isPasskeyEnabled: true,
            depositLimit: depositLimit,
            withdrawLimit: withdrawLimit,
            lastActivity: block.timestamp,
            totalDeposited: 0,
            totalWithdrawn: 0,
            passkeyHash: passkeyHash
        });
        
        passkeyToAccount[passkeyHash] = accountAddress;
        activeAccounts++;
        
        emit GeminiAccountCreated(msg.sender, accountAddress, passkeyHash);
    }
    
    /**
     * @notice Deposits GUSD to casino vault using Gemini account
     * @param amount Amount of GUSD to deposit
     * @param passkeySignature Passkey signature for authentication
     */
    function depositToCasino(
        uint256 amount,
        bytes calldata passkeySignature
    ) external nonReentrant {
        GeminiAccount storage account = geminiAccounts[msg.sender];
        
        if (account.account == address(0)) revert InvalidAccount();
        if (!_verifyPasskey(account.passkeyHash, passkeySignature)) {
            revert PasskeyVerificationFailed();
        }
        
        // Check daily limit
        uint256 today = block.timestamp / 1 days;
        uint256 todayDeposits = dailyDeposits[msg.sender][today];
        
        if (todayDeposits + amount > account.depositLimit) {
            revert DailyLimitExceeded();
        }
        
        // Update limits
        dailyDeposits[msg.sender][today] = todayDeposits + amount;
        account.totalDeposited += amount;
        account.lastActivity = block.timestamp;
        totalGUSDDeposited += amount;
        
        // Transfer GUSD from Gemini account to casino vault
        require(
            GUSD.transferFrom(account.account, casinoVault, amount),
            "Transfer failed"
        );
        
        emit GUSDDeposited(account.account, amount, casinoVault);
    }
    
    /**
     * @notice Withdraws GUSD from casino to Gemini account
     * @param amount Amount to withdraw
     * @param passkeySignature Passkey signature
     */
    function withdrawFromCasino(
        uint256 amount,
        bytes calldata passkeySignature
    ) external nonReentrant {
        GeminiAccount storage account = geminiAccounts[msg.sender];
        
        if (account.account == address(0)) revert InvalidAccount();
        if (!_verifyPasskey(account.passkeyHash, passkeySignature)) {
            revert PasskeyVerificationFailed();
        }
        
        // Check daily limit
        uint256 today = block.timestamp / 1 days;
        uint256 todayWithdrawals = dailyWithdrawals[msg.sender][today];
        
        if (todayWithdrawals + amount > account.withdrawLimit) {
            revert DailyLimitExceeded();
        }
        
        // Update limits
        dailyWithdrawals[msg.sender][today] = todayWithdrawals + amount;
        account.totalWithdrawn += amount;
        account.lastActivity = block.timestamp;
        totalGUSDWithdrawn += amount;
        
        // Request withdrawal from vault (vault must approve this contract)
        // In production, this would interact with the vault's withdrawal mechanism
        require(
            GUSD.transferFrom(casinoVault, account.account, amount),
            "Withdrawal failed"
        );
        
        emit GUSDWithdrawn(account.account, amount);
    }
    
    /**
     * @notice Installs an ERC-7579 module on the account
     * @param moduleAddress Address of the module to install
     * @param moduleType Type of module (validation, execution, etc.)
     * @param initData Initialization data for the module
     */
    function installModule(
        address moduleAddress,
        uint256 moduleType,
        bytes calldata initData
    ) external {
        GeminiAccount storage account = geminiAccounts[msg.sender];
        if (account.account == address(0)) revert InvalidAccount();
        
        // Validate module type
        if (moduleType > HOOK_TYPE) revert ModuleNotSupported();
        
        // Store module configuration
        accountModules[msg.sender].push(ModuleConfig({
            moduleAddress: moduleAddress,
            moduleType: moduleType,
            initData: initData,
            isActive: true
        }));
        
        // In production, this would call the account's installModule function
        _installModuleOnAccount(account.account, moduleAddress, moduleType, initData);
        
        emit ModuleInstalled(account.account, moduleAddress, moduleType);
    }
    
    /**
     * @notice Updates daily limits for an account
     * @param depositLimit New daily deposit limit
     * @param withdrawLimit New daily withdrawal limit
     */
    function updateLimits(
        uint256 depositLimit,
        uint256 withdrawLimit
    ) external {
        GeminiAccount storage account = geminiAccounts[msg.sender];
        if (account.account == address(0)) revert InvalidAccount();
        
        account.depositLimit = depositLimit;
        account.withdrawLimit = withdrawLimit;
        
        emit LimitsUpdated(account.account, depositLimit, withdrawLimit);
    }
    
    /**
     * @notice Rotates passkey for security
     * @param newPasskeyCredential New passkey credential
     * @param oldPasskeySignature Signature from old passkey
     */
    function rotatePasskey(
        bytes calldata newPasskeyCredential,
        bytes calldata oldPasskeySignature
    ) external {
        GeminiAccount storage account = geminiAccounts[msg.sender];
        
        if (account.account == address(0)) revert InvalidAccount();
        if (!_verifyPasskey(account.passkeyHash, oldPasskeySignature)) {
            revert PasskeyVerificationFailed();
        }
        
        // Remove old passkey mapping
        delete passkeyToAccount[account.passkeyHash];
        
        // Set new passkey
        bytes32 newPasskeyHash = keccak256(newPasskeyCredential);
        account.passkeyHash = newPasskeyHash;
        passkeyToAccount[newPasskeyHash] = account.account;
        
        emit PasskeyRegistered(account.account, newPasskeyHash);
    }
    
    /**
     * @notice Gets account statistics
     */
    function getAccountStats(address user) external view returns (
        address accountAddress,
        bool isPasskeyEnabled,
        uint256 totalDeposited,
        uint256 totalWithdrawn,
        uint256 depositLimit,
        uint256 withdrawLimit,
        uint256 lastActivity
    ) {
        GeminiAccount memory account = geminiAccounts[user];
        return (
            account.account,
            account.isPasskeyEnabled,
            account.totalDeposited,
            account.totalWithdrawn,
            account.depositLimit,
            account.withdrawLimit,
            account.lastActivity
        );
    }
    
    /**
     * @notice Gets today's usage for an account
     */
    function getTodayUsage(address user) external view returns (
        uint256 depositsToday,
        uint256 withdrawalsToday,
        uint256 remainingDepositLimit,
        uint256 remainingWithdrawLimit
    ) {
        GeminiAccount memory account = geminiAccounts[user];
        uint256 today = block.timestamp / 1 days;
        
        depositsToday = dailyDeposits[user][today];
        withdrawalsToday = dailyWithdrawals[user][today];
        
        remainingDepositLimit = account.depositLimit > depositsToday 
            ? account.depositLimit - depositsToday 
            : 0;
            
        remainingWithdrawLimit = account.withdrawLimit > withdrawalsToday
            ? account.withdrawLimit - withdrawalsToday
            : 0;
    }
    
    /**
     * @notice Deploys a modular account (simplified)
     */
    function _deployModularAccount(
        address owner,
        bytes32 passkeyHash
    ) private returns (address) {
        // In production, this would deploy an actual ERC-7579 account
        // For hackathon, we return a deterministic address
        return address(uint160(uint256(keccak256(abi.encodePacked(owner, passkeyHash)))));
    }
    
    /**
     * @notice Verifies passkey signature (simplified)
     */
    function _verifyPasskey(
        bytes32 passkeyHash,
        bytes calldata signature
    ) private pure returns (bool) {
        // In production, this would verify WebAuthn signature
        // For hackathon, we do simplified verification
        return keccak256(signature) == passkeyHash;
    }
    
    /**
     * @notice Installs module on account (simplified)
     */
    function _installModuleOnAccount(
        address account,
        address module,
        uint256 moduleType,
        bytes calldata initData
    ) private {
        // In production, this would call the account's installModule function
        // For hackathon, we just emit the event
        account; module; moduleType; initData; // Suppress warnings
    }
    
    /**
     * @notice Emergency withdrawal
     */
    function emergencyWithdraw(address token, uint256 amount) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        IERC20(token).transfer(msg.sender, amount);
    }
}