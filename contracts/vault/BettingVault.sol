// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BettingVault
 * @notice A fully functional vault for managing betting liquidity and payouts
 * @dev Handles bet escrow, payout processing, and liquidity provision
 */
contract BettingVault is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    
    // Roles
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    bytes32 public constant BETS_ROLE = keccak256("BETS_ROLE");
    
    // Token
    IERC20 public immutable token;
    
    // Vault state
    uint256 public totalLiquidity;
    uint256 public totalInEscrow;
    uint256 public totalPaidOut;
    uint256 public totalFeesCollected;
    
    // Liquidity provider tracking
    mapping(address => uint256) public liquidityBalances;
    mapping(address => uint256) public liquidityShares;
    uint256 public totalShares;
    
    // Bet escrow tracking
    mapping(address => mapping(uint256 => uint256)) public playerBetEscrow; // player => betId => amount
    mapping(address => uint256) public playerTotalEscrow;
    
    // Fee configuration
    uint256 public feePercentage = 200; // 2% in basis points
    uint256 public constant MAX_FEE = 1000; // 10% max
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    // Treasury
    address public treasury;
    
    // Events
    event LiquidityDeposited(address indexed provider, uint256 amount, uint256 shares);
    event LiquidityWithdrawn(address indexed provider, uint256 amount, uint256 shares);
    event BetEscrowed(address indexed player, uint256 indexed betId, uint256 amount);
    event BetReleased(address indexed player, uint256 indexed betId, uint256 amount);
    event PayoutProcessed(address indexed player, uint256 amount, uint256 fee);
    event FeesCollected(uint256 amount);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event FeeUpdated(uint256 oldFee, uint256 newFee);
    
    constructor(IERC20 _token, address _treasury) {
        require(address(_token) != address(0), "Invalid token");
        require(_treasury != address(0), "Invalid treasury");
        
        token = _token;
        treasury = _treasury;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }
    
    // ============ Liquidity Provider Functions ============
    
    /**
     * @notice Deposit liquidity into the vault
     * @param amount Amount of tokens to deposit
     */
    function depositLiquidity(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        
        // Calculate shares
        uint256 shares;
        if (totalShares == 0) {
            shares = amount; // First depositor gets 1:1 shares
        } else {
            shares = (amount * totalShares) / totalLiquidity;
        }
        
        require(shares > 0, "Shares must be greater than 0");
        
        // Transfer tokens
        token.safeTransferFrom(msg.sender, address(this), amount);
        
        // Update state
        liquidityBalances[msg.sender] += amount;
        liquidityShares[msg.sender] += shares;
        totalLiquidity += amount;
        totalShares += shares;
        
        emit LiquidityDeposited(msg.sender, amount, shares);
    }
    
    /**
     * @notice Withdraw liquidity from the vault
     * @param shares Number of shares to withdraw
     */
    function withdrawLiquidity(uint256 shares) external nonReentrant {
        require(shares > 0, "Shares must be greater than 0");
        require(liquidityShares[msg.sender] >= shares, "Insufficient shares");
        
        // Calculate token amount
        uint256 amount = (shares * totalLiquidity) / totalShares;
        require(amount > 0, "Amount must be greater than 0");
        
        // Check available liquidity (not in escrow)
        uint256 availableLiquidity = totalLiquidity - totalInEscrow;
        require(amount <= availableLiquidity, "Insufficient available liquidity");
        
        // Update state
        liquidityShares[msg.sender] -= shares;
        liquidityBalances[msg.sender] -= amount;
        totalShares -= shares;
        totalLiquidity -= amount;
        
        // Transfer tokens
        token.safeTransfer(msg.sender, amount);
        
        emit LiquidityWithdrawn(msg.sender, amount, shares);
    }
    
    // ============ Betting Functions ============
    
    /**
     * @notice Escrow tokens for a bet
     * @param player Player address
     * @param betId Unique bet identifier
     * @param amount Bet amount
     */
    function escrowBet(
        address player,
        uint256 betId,
        uint256 amount
    ) external onlyRole(BETS_ROLE) nonReentrant returns (bool) {
        require(player != address(0), "Invalid player");
        require(amount > 0, "Amount must be greater than 0");
        require(playerBetEscrow[player][betId] == 0, "Bet already escrowed");
        
        // Check vault has enough liquidity
        uint256 availableLiquidity = totalLiquidity - totalInEscrow;
        require(amount <= availableLiquidity, "Insufficient vault liquidity");
        
        // Update escrow tracking
        playerBetEscrow[player][betId] = amount;
        playerTotalEscrow[player] += amount;
        totalInEscrow += amount;
        
        emit BetEscrowed(player, betId, amount);
        return true;
    }
    
    /**
     * @notice Release escrowed bet (for losses)
     * @param player Player address
     * @param betId Bet identifier
     */
    function releaseBetEscrow(
        address player,
        uint256 betId
    ) external onlyRole(BETS_ROLE) nonReentrant returns (bool) {
        uint256 amount = playerBetEscrow[player][betId];
        require(amount > 0, "No escrow for this bet");
        
        // Update escrow tracking
        playerBetEscrow[player][betId] = 0;
        playerTotalEscrow[player] -= amount;
        totalInEscrow -= amount;
        
        // The tokens stay in the vault (house wins)
        
        emit BetReleased(player, betId, amount);
        return true;
    }
    
    /**
     * @notice Process payout for winning bet
     * @param player Player address
     * @param betId Bet identifier
     * @param payoutAmount Total payout amount (including original bet)
     */
    function processPayout(
        address player,
        uint256 betId,
        uint256 payoutAmount
    ) external onlyRole(BETS_ROLE) nonReentrant returns (bool) {
        require(player != address(0), "Invalid player");
        require(payoutAmount > 0, "Invalid payout amount");
        
        uint256 escrowAmount = playerBetEscrow[player][betId];
        require(escrowAmount > 0, "No escrow for this bet");
        
        // Calculate fee on winnings only
        uint256 winnings = payoutAmount > escrowAmount ? payoutAmount - escrowAmount : 0;
        uint256 fee = (winnings * feePercentage) / FEE_DENOMINATOR;
        uint256 netPayout = payoutAmount - fee;
        
        // Update escrow
        playerBetEscrow[player][betId] = 0;
        playerTotalEscrow[player] -= escrowAmount;
        totalInEscrow -= escrowAmount;
        
        // Check vault has enough for payout
        require(netPayout <= token.balanceOf(address(this)), "Insufficient vault balance");
        
        // Process fee
        if (fee > 0 && treasury != address(0)) {
            totalFeesCollected += fee;
            token.safeTransfer(treasury, fee);
            emit FeesCollected(fee);
        }
        
        // Process payout
        totalPaidOut += netPayout;
        token.safeTransfer(player, netPayout);
        
        emit PayoutProcessed(player, netPayout, fee);
        return true;
    }
    
    // ============ Simple Bet Processing (Direct) ============
    
    /**
     * @notice Process a bet directly (simplified interface)
     * @param player Player address
     * @param amount Bet amount
     */
    function processBet(address player, uint256 amount) 
        external 
        onlyRole(BETS_ROLE) 
        nonReentrant 
        returns (bool) 
    {
        require(player != address(0), "Invalid player");
        require(amount > 0, "Amount must be greater than 0");
        
        // Transfer tokens from player to vault
        token.safeTransferFrom(player, address(this), amount);
        
        // Track as liquidity (simplified)
        totalLiquidity += amount;
        
        return true;
    }
    
    /**
     * @notice Process a simple payout
     * @param player Player address
     * @param amount Payout amount
     */
    function processSimplePayout(address player, uint256 amount) 
        external 
        onlyRole(BETS_ROLE) 
        nonReentrant 
        returns (bool) 
    {
        require(player != address(0), "Invalid player");
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= token.balanceOf(address(this)), "Insufficient balance");
        
        // Transfer payout
        token.safeTransfer(player, amount);
        totalPaidOut += amount;
        
        return true;
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Update treasury address
     * @param _treasury New treasury address
     */
    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_treasury != address(0), "Invalid treasury");
        address oldTreasury = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(oldTreasury, _treasury);
    }
    
    /**
     * @notice Update fee percentage
     * @param _feePercentage New fee in basis points
     */
    function setFeePercentage(uint256 _feePercentage) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_feePercentage <= MAX_FEE, "Fee too high");
        uint256 oldFee = feePercentage;
        feePercentage = _feePercentage;
        emit FeeUpdated(oldFee, _feePercentage);
    }
    
    /**
     * @notice Grant betting role to contract
     * @param betsContract Address of bets contract
     */
    function grantBetsRole(address betsContract) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(BETS_ROLE, betsContract);
    }
    
    /**
     * @notice Grant game role to contract
     * @param gameContract Address of game contract
     */
    function grantGameRole(address gameContract) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(GAME_ROLE, gameContract);
    }
    
    /**
     * @notice Emergency pause
     */
    function pause() external onlyRole(OPERATOR_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause
     */
    function unpause() external onlyRole(OPERATOR_ROLE) {
        _unpause();
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get vault statistics
     */
    function getVaultStats() external view returns (
        uint256 liquidity,
        uint256 inEscrow,
        uint256 available,
        uint256 paidOut,
        uint256 fees
    ) {
        return (
            totalLiquidity,
            totalInEscrow,
            totalLiquidity - totalInEscrow,
            totalPaidOut,
            totalFeesCollected
        );
    }
    
    /**
     * @notice Get player statistics
     */
    function getPlayerStats(address player) external view returns (
        uint256 escrow,
        uint256 liquidityBalance,
        uint256 shares
    ) {
        return (
            playerTotalEscrow[player],
            liquidityBalances[player],
            liquidityShares[player]
        );
    }
    
    /**
     * @notice Calculate share value
     */
    function getShareValue() external view returns (uint256) {
        if (totalShares == 0) return 1e18;
        return (totalLiquidity * 1e18) / totalShares;
    }
    
    /**
     * @notice Get vault balance
     */
    function getVaultBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
}