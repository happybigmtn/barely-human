// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BOTToken
 * @notice The governance and fee-sharing token for Barely Human platform
 * @dev Standard ERC20 with role-based access control and fixed supply
 * 
 * Key Features:
 * - Fixed supply of 1 billion tokens minted at deployment
 * - No transfer fees (fees handled via Uniswap V4 hooks)
 * - Role-based permissions for Treasury and Staking contracts
 * - Pausable for emergency situations
 */
contract BOTToken is ERC20, AccessControl, Pausable {
    // Role definitions
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    bytes32 public constant STAKING_ROLE = keccak256("STAKING_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    // Constants
    uint256 public constant INITIAL_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens
    uint256 public constant MAX_SUPPLY = INITIAL_SUPPLY; // Fixed supply, no inflation
    
    // Token allocation percentages (out of 100)
    uint256 public constant TREASURY_ALLOCATION = 20; // 20% to treasury
    uint256 public constant LIQUIDITY_ALLOCATION = 30; // 30% for liquidity
    uint256 public constant STAKING_REWARDS_ALLOCATION = 25; // 25% for staking rewards
    uint256 public constant TEAM_ALLOCATION = 15; // 15% for team
    uint256 public constant COMMUNITY_ALLOCATION = 10; // 10% for community/airdrops
    
    // Events
    event TokensAllocated(address indexed recipient, uint256 amount, string allocation);
    event RoleGrantedWithPurpose(bytes32 indexed role, address indexed account, string purpose);
    
    /**
     * @notice Constructor initializes the token with fixed supply and initial allocations
     * @param _treasury Address to receive treasury allocation
     * @param _liquidity Address to receive liquidity allocation
     * @param _stakingRewards Address to receive staking rewards allocation
     * @param _team Address to receive team allocation
     * @param _community Address to receive community allocation
     */
    constructor(
        address _treasury,
        address _liquidity,
        address _stakingRewards,
        address _team,
        address _community
    ) ERC20("Barely Human", "BOT") {
        require(_treasury != address(0), "Invalid treasury address");
        require(_liquidity != address(0), "Invalid liquidity address");
        require(_stakingRewards != address(0), "Invalid staking rewards address");
        require(_team != address(0), "Invalid team address");
        require(_community != address(0), "Invalid community address");
        
        // Setup roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        
        // Grant Treasury role
        _grantRole(TREASURY_ROLE, _treasury);
        emit RoleGrantedWithPurpose(TREASURY_ROLE, _treasury, "Treasury operations");
        
        // Grant Staking role
        _grantRole(STAKING_ROLE, _stakingRewards);
        emit RoleGrantedWithPurpose(STAKING_ROLE, _stakingRewards, "Staking reward distribution");
        
        // Mint initial allocations
        uint256 treasuryAmount = (INITIAL_SUPPLY * TREASURY_ALLOCATION) / 100;
        uint256 liquidityAmount = (INITIAL_SUPPLY * LIQUIDITY_ALLOCATION) / 100;
        uint256 stakingAmount = (INITIAL_SUPPLY * STAKING_REWARDS_ALLOCATION) / 100;
        uint256 teamAmount = (INITIAL_SUPPLY * TEAM_ALLOCATION) / 100;
        uint256 communityAmount = (INITIAL_SUPPLY * COMMUNITY_ALLOCATION) / 100;
        
        _mint(_treasury, treasuryAmount);
        emit TokensAllocated(_treasury, treasuryAmount, "Treasury");
        
        _mint(_liquidity, liquidityAmount);
        emit TokensAllocated(_liquidity, liquidityAmount, "Liquidity");
        
        _mint(_stakingRewards, stakingAmount);
        emit TokensAllocated(_stakingRewards, stakingAmount, "Staking Rewards");
        
        _mint(_team, teamAmount);
        emit TokensAllocated(_team, teamAmount, "Team");
        
        _mint(_community, communityAmount);
        emit TokensAllocated(_community, communityAmount, "Community");
        
        // Verify total supply matches expected
        assert(totalSupply() == INITIAL_SUPPLY);
    }
    
    /**
     * @notice Pause token transfers (emergency use only)
     * @dev Only accounts with PAUSER_ROLE can pause
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause token transfers
     * @dev Only accounts with PAUSER_ROLE can unpause
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Check if an address has Treasury role
     * @param account Address to check
     * @return bool True if account has Treasury role
     */
    function isTreasury(address account) external view returns (bool) {
        return hasRole(TREASURY_ROLE, account);
    }
    
    /**
     * @notice Check if an address has Staking role
     * @param account Address to check
     * @return bool True if account has Staking role
     */
    function isStaking(address account) external view returns (bool) {
        return hasRole(STAKING_ROLE, account);
    }
    
    /**
     * @notice Override update to respect pause state
     * @param from Sender address
     * @param to Recipient address
     * @param value Amount to transfer
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal virtual override whenNotPaused {
        super._update(from, to, value);
    }
    
    /**
     * @notice Returns token decimals (18)
     * @return uint8 Number of decimals
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
    
    /**
     * @notice Burn tokens from caller's balance
     * @param amount Amount of tokens to burn
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
    
    /**
     * @notice Burn tokens from another account (requires allowance)
     * @param account Account to burn from
     * @param amount Amount of tokens to burn
     */
    function burnFrom(address account, uint256 amount) external {
        uint256 currentAllowance = allowance(account, msg.sender);
        require(currentAllowance >= amount, "ERC20: burn amount exceeds allowance");
        
        unchecked {
            _approve(account, msg.sender, currentAllowance - amount);
        }
        _burn(account, amount);
    }
}