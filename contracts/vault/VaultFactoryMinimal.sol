// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title VaultFactoryMinimal
 * @notice Minimal vault factory for craps game betting
 * @dev Simple implementation for creating and managing vaults
 */
contract VaultFactoryMinimal is AccessControl, ReentrancyGuard {
    // Roles
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    // State
    IERC20 public immutable token;
    address public treasuryAddress;
    
    // Vault storage
    address[] public vaults;
    mapping(address => bool) public isVault;
    
    // Events
    event VaultCreated(address indexed vault, string name, string symbol);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    
    constructor(IERC20 _token, address _treasury) {
        require(address(_token) != address(0), "Invalid token");
        require(_treasury != address(0), "Invalid treasury");
        
        token = _token;
        treasuryAddress = _treasury;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }
    
    /**
     * @notice Create a new simple vault
     * @param _token Token address for the vault
     * @param _name Vault name
     * @param _symbol Vault symbol
     * @return vault Address of the created vault
     */
    function createVault(
        address _token,
        string memory _name,
        string memory _symbol
    ) external onlyRole(OPERATOR_ROLE) returns (address vault) {
        require(_token != address(0), "Invalid token address");
        require(bytes(_name).length > 0, "Invalid name");
        require(bytes(_symbol).length > 0, "Invalid symbol");
        
        // Deploy new SimpleVault
        vault = address(new SimpleVault(_token, _name, _symbol, treasuryAddress));
        
        // Register vault
        vaults.push(vault);
        isVault[vault] = true;
        
        emit VaultCreated(vault, _name, _symbol);
        
        return vault;
    }
    
    /**
     * @notice Get vault by index
     * @param index Vault index
     * @return vault address
     */
    function getVault(uint256 index) external view returns (address) {
        require(index < vaults.length, "Vault index out of bounds");
        return vaults[index];
    }
    
    /**
     * @notice Get total number of vaults
     * @return count Number of vaults
     */
    function getVaultCount() external view returns (uint256) {
        return vaults.length;
    }
    
    /**
     * @notice Get all vault addresses
     * @return Array of vault addresses
     */
    function getAllVaults() external view returns (address[] memory) {
        return vaults;
    }
    
    /**
     * @notice Update treasury address
     * @param _newTreasury New treasury address
     */
    function updateTreasury(address _newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newTreasury != address(0), "Invalid treasury");
        address oldTreasury = treasuryAddress;
        treasuryAddress = _newTreasury;
        emit TreasuryUpdated(oldTreasury, _newTreasury);
    }
}

/**
 * @title SimpleVault
 * @notice Simple vault implementation for holding and managing tokens
 */
contract SimpleVault is ReentrancyGuard, AccessControl {
    // Roles
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    // Token and metadata
    IERC20 public immutable token;
    string public name;
    string public symbol;
    address public treasury;
    
    // Vault state
    uint256 public totalDeposits;
    mapping(address => uint256) public balances;
    
    // Events
    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);
    event BetProcessed(address indexed player, uint256 amount);
    event PayoutProcessed(address indexed player, uint256 amount);
    
    constructor(
        address _token,
        string memory _name,
        string memory _symbol,
        address _treasury
    ) {
        require(_token != address(0), "Invalid token");
        require(_treasury != address(0), "Invalid treasury");
        
        token = IERC20(_token);
        name = _name;
        symbol = _symbol;
        treasury = _treasury;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }
    
    /**
     * @notice Initialize vault (compatibility function)
     * @param _token Token address (should match constructor)
     */
    function initialize(address _token) external view {
        require(_token == address(token), "Token mismatch");
        // Already initialized in constructor
    }
    
    /**
     * @notice Deposit tokens into vault
     * @param amount Amount to deposit
     */
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        
        // Transfer tokens from sender
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        // Update balances
        balances[msg.sender] += amount;
        totalDeposits += amount;
        
        emit Deposit(msg.sender, amount);
    }
    
    /**
     * @notice Withdraw tokens from vault
     * @param amount Amount to withdraw
     */
    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        // Update balances
        balances[msg.sender] -= amount;
        totalDeposits -= amount;
        
        // Transfer tokens to sender
        require(token.transfer(msg.sender, amount), "Transfer failed");
        
        emit Withdrawal(msg.sender, amount);
    }
    
    /**
     * @notice Process bet (deduct tokens for betting)
     * @param player Player address
     * @param amount Bet amount
     * @return success Whether the bet was processed
     */
    function processBet(address player, uint256 amount) external onlyRole(OPERATOR_ROLE) returns (bool) {
        require(amount > 0, "Amount must be greater than 0");
        require(token.balanceOf(address(this)) >= amount, "Insufficient vault balance");
        
        // For now, just emit event - in production this would manage escrow
        emit BetProcessed(player, amount);
        return true;
    }
    
    /**
     * @notice Process payout (credit tokens for winning)
     * @param player Player address
     * @param amount Payout amount
     * @return success Whether the payout was processed
     */
    function processPayout(address player, uint256 amount) external onlyRole(OPERATOR_ROLE) returns (bool) {
        require(amount > 0, "Amount must be greater than 0");
        require(token.balanceOf(address(this)) >= amount, "Insufficient vault balance");
        
        // For now, just emit event - in production this would handle payouts
        emit PayoutProcessed(player, amount);
        return true;
    }
    
    /**
     * @notice Get user balance
     * @param user User address
     * @return User's balance in vault
     */
    function balanceOf(address user) external view returns (uint256) {
        return balances[user];
    }
    
    /**
     * @notice Get total supply (total deposits)
     * @return Total deposits in vault
     */
    function totalSupply() external view returns (uint256) {
        return totalDeposits;
    }
    
    /**
     * @notice Get vault token balance
     * @return Total tokens held by vault
     */
    function getVaultBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
}