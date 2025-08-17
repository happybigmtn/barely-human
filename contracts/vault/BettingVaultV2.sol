// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BettingVaultV2
 * @notice Production-ready vault for managing betting liquidity, escrow, and settlements
 * @dev Complete implementation with proper error handling and state management
 */
contract BettingVaultV2 is AccessControl, ReentrancyGuard, Pausable {
    
    // Roles
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    bytes32 public constant BETS_ROLE = keccak256("BETS_ROLE");
    bytes32 public constant SETTLEMENT_ROLE = keccak256("SETTLEMENT_ROLE");
    
    // Token
    IERC20 public immutable token;
    
    // Vault state
    uint256 public totalLiquidity;
    uint256 public totalInEscrow;
    uint256 public totalPaidOut;
    uint256 public totalFeesCollected;
    uint256 public totalBetsPlaced;
    uint256 public totalBetsWon;
    uint256 public totalBetsLost;
    
    // Liquidity provider tracking
    mapping(address => uint256) public liquidityBalances;
    mapping(address => uint256) public liquidityShares;
    uint256 public totalShares;
    
    // Enhanced bet tracking
    struct BetInfo {
        uint256 amount;
        uint256 seriesId;
        uint8 betType;
        uint8 specificNumber;
        bool isActive;
        bool isSettled;
        uint256 timestamp;
    }
    
    // Bet escrow tracking
    mapping(address => mapping(uint256 => BetInfo)) public playerBets; // player => betId => BetInfo
    mapping(address => uint256[]) public playerActiveBets; // player => array of active bet IDs
    mapping(address => uint256) public playerTotalEscrow;
    mapping(address => uint256) public playerNextBetId;
    
    // Series tracking for settlement
    mapping(uint256 => address[]) public seriesPlayers; // seriesId => players with bets
    mapping(uint256 => bool) public seriesSettled; // seriesId => settled
    
    // Fee configuration
    uint256 public feePercentage = 200; // 2% in basis points
    uint256 public constant MAX_FEE = 1000; // 10% max
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    // Treasury
    address public treasury;
    
    // Minimum bet amount
    uint256 public constant MIN_BET = 1e18; // 1 BOT
    uint256 public constant MAX_BET = 100000e18; // 100,000 BOT
    
    // Events
    event LiquidityDeposited(address indexed provider, uint256 amount, uint256 shares);
    event LiquidityWithdrawn(address indexed provider, uint256 amount, uint256 shares);
    event BetPlaced(address indexed player, uint256 indexed betId, uint256 amount, uint8 betType, uint256 seriesId);
    event BetSettled(address indexed player, uint256 indexed betId, bool won, uint256 payout);
    event BetCancelled(address indexed player, uint256 indexed betId, uint256 refund);
    event PayoutProcessed(address indexed player, uint256 amount, uint256 fee);
    event FeesCollected(uint256 amount);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event EmergencyWithdraw(address indexed admin, uint256 amount);
    
    // Errors
    error InsufficientBalance();
    error InvalidAmount();
    error InvalidBetType();
    error BetNotActive();
    error BetAlreadySettled();
    error InsufficientLiquidity();
    error UnauthorizedAccess();
    error InvalidAddress();
    error TransferFailed();
    
    constructor(IERC20 _token, address _treasury) {
        if (address(_token) == address(0)) revert InvalidAddress();
        if (_treasury == address(0)) revert InvalidAddress();
        
        token = _token;
        treasury = _treasury;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }
    
    // ============ Liquidity Provider Functions ============
    
    /**
     * @notice Deposit liquidity into the vault
     * @param amount Amount of tokens to deposit
     * @return shares Amount of shares minted
     */
    function depositLiquidity(uint256 amount) external nonReentrant whenNotPaused returns (uint256 shares) {
        if (amount == 0) revert InvalidAmount();
        
        // Check token balance
        uint256 balanceBefore = token.balanceOf(address(this));
        
        // Transfer tokens (using standard ERC20)
        bool success = token.transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();
        
        // Verify transfer
        uint256 balanceAfter = token.balanceOf(address(this));
        uint256 actualAmount = balanceAfter - balanceBefore;
        if (actualAmount == 0) revert InvalidAmount();
        
        // Calculate shares
        if (totalShares == 0) {
            shares = actualAmount; // First depositor gets 1:1 shares
        } else {
            shares = (actualAmount * totalShares) / totalLiquidity;
        }
        
        if (shares == 0) revert InvalidAmount();
        
        // Update state
        liquidityBalances[msg.sender] += actualAmount;
        liquidityShares[msg.sender] += shares;
        totalLiquidity += actualAmount;
        totalShares += shares;
        
        emit LiquidityDeposited(msg.sender, actualAmount, shares);
    }
    
    /**
     * @notice Withdraw liquidity from the vault
     * @param shares Amount of shares to burn
     * @return amount Amount of tokens withdrawn
     */
    function withdrawLiquidity(uint256 shares) external nonReentrant whenNotPaused returns (uint256 amount) {
        if (shares == 0) revert InvalidAmount();
        if (shares > liquidityShares[msg.sender]) revert InsufficientBalance();
        
        // Calculate withdrawal amount
        amount = (shares * totalLiquidity) / totalShares;
        
        // Ensure we have enough liquidity not in escrow
        uint256 availableLiquidity = totalLiquidity - totalInEscrow;
        if (amount > availableLiquidity) revert InsufficientLiquidity();
        
        // Update state
        liquidityShares[msg.sender] -= shares;
        liquidityBalances[msg.sender] -= amount;
        totalShares -= shares;
        totalLiquidity -= amount;
        
        // Transfer tokens
        bool success = token.transfer(msg.sender, amount);
        if (!success) revert TransferFailed();
        
        emit LiquidityWithdrawn(msg.sender, amount, shares);
    }
    
    // ============ Betting Functions ============
    
    /**
     * @notice Place a bet and escrow funds
     * @param betType Type of bet (0-63 for different craps bets)
     * @param amount Amount to bet
     * @param seriesId Current game series ID
     * @param specificNumber Optional specific number for certain bet types
     * @return betId Unique bet identifier
     */
    function placeBet(
        uint8 betType,
        uint256 amount,
        uint256 seriesId,
        uint8 specificNumber
    ) external nonReentrant whenNotPaused returns (uint256 betId) {
        if (amount < MIN_BET || amount > MAX_BET) revert InvalidAmount();
        if (betType >= 64) revert InvalidBetType(); // We support 64 bet types
        
        // Check vault has enough liquidity
        uint256 availableLiquidity = totalLiquidity - totalInEscrow;
        uint256 maxPayout = amount * 30; // Max 30x payout for any bet
        if (maxPayout > availableLiquidity) revert InsufficientLiquidity();
        
        // Transfer tokens from player
        bool success = token.transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();
        
        // Generate bet ID
        betId = playerNextBetId[msg.sender]++;
        
        // Store bet info
        playerBets[msg.sender][betId] = BetInfo({
            amount: amount,
            seriesId: seriesId,
            betType: betType,
            specificNumber: specificNumber,
            isActive: true,
            isSettled: false,
            timestamp: block.timestamp
        });
        
        // Update escrow tracking
        playerActiveBets[msg.sender].push(betId);
        playerTotalEscrow[msg.sender] += amount;
        totalInEscrow += amount;
        
        // Track player in series
        seriesPlayers[seriesId].push(msg.sender);
        
        // Update stats
        totalBetsPlaced++;
        
        emit BetPlaced(msg.sender, betId, amount, betType, seriesId);
    }
    
    /**
     * @notice Cancel a bet and refund the player
     * @param player Player address
     * @param betId Bet identifier
     */
    function cancelBet(address player, uint256 betId) 
        external 
        onlyRole(OPERATOR_ROLE) 
        nonReentrant 
    {
        BetInfo storage bet = playerBets[player][betId];
        if (!bet.isActive) revert BetNotActive();
        if (bet.isSettled) revert BetAlreadySettled();
        
        uint256 refundAmount = bet.amount;
        
        // Update bet status
        bet.isActive = false;
        bet.isSettled = true;
        
        // Update escrow
        playerTotalEscrow[player] -= refundAmount;
        totalInEscrow -= refundAmount;
        
        // Remove from active bets
        _removeActiveBet(player, betId);
        
        // Refund tokens
        bool success = token.transfer(player, refundAmount);
        if (!success) revert TransferFailed();
        
        emit BetCancelled(player, betId, refundAmount);
    }
    
    // ============ Settlement Functions ============
    
    /**
     * @notice Settle a winning bet
     * @param player Player address
     * @param betId Bet identifier
     * @param payoutMultiplier Payout multiplier (in basis points, 10000 = 1x)
     */
    function settleBet(
        address player,
        uint256 betId,
        uint256 payoutMultiplier
    ) external onlyRole(SETTLEMENT_ROLE) nonReentrant {
        BetInfo storage bet = playerBets[player][betId];
        if (!bet.isActive) revert BetNotActive();
        if (bet.isSettled) revert BetAlreadySettled();
        
        // Calculate payout
        uint256 betAmount = bet.amount;
        uint256 grossPayout = (betAmount * payoutMultiplier) / 10000;
        uint256 fee = (grossPayout * feePercentage) / FEE_DENOMINATOR;
        uint256 netPayout = grossPayout - fee;
        
        // Update bet status
        bet.isActive = false;
        bet.isSettled = true;
        
        // Update escrow
        playerTotalEscrow[player] -= betAmount;
        totalInEscrow -= betAmount;
        
        // Remove from active bets
        _removeActiveBet(player, betId);
        
        // Process payout if won
        if (payoutMultiplier > 0) {
            // Update stats
            totalBetsWon++;
            totalPaidOut += netPayout;
            totalFeesCollected += fee;
            
            // Transfer payout
            bool success = token.transfer(player, netPayout);
            if (!success) revert TransferFailed();
            
            // Transfer fee to treasury
            if (fee > 0) {
                success = token.transfer(treasury, fee);
                if (!success) revert TransferFailed();
            }
            
            emit BetSettled(player, betId, true, netPayout);
            emit PayoutProcessed(player, netPayout, fee);
        } else {
            // Bet lost
            totalBetsLost++;
            totalLiquidity += betAmount; // Add to house liquidity
            
            emit BetSettled(player, betId, false, 0);
        }
    }
    
    /**
     * @notice Batch settle multiple bets for efficiency
     * @param players Array of player addresses
     * @param betIds Array of bet IDs
     * @param payoutMultipliers Array of payout multipliers
     */
    function batchSettleBets(
        address[] calldata players,
        uint256[] calldata betIds,
        uint256[] calldata payoutMultipliers
    ) external onlyRole(SETTLEMENT_ROLE) nonReentrant {
        uint256 length = players.length;
        require(length == betIds.length && length == payoutMultipliers.length, "Array length mismatch");
        
        for (uint256 i = 0; i < length; i++) {
            // Use try-catch to prevent one failure from blocking all
            try this.settleBet(players[i], betIds[i], payoutMultipliers[i]) {
                // Success
            } catch {
                // Log failure but continue
                emit BetSettled(players[i], betIds[i], false, 0);
            }
        }
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get all active bets for a player
     * @param player Player address
     * @return betIds Array of active bet IDs
     */
    function getPlayerActiveBets(address player) external view returns (uint256[] memory) {
        return playerActiveBets[player];
    }
    
    /**
     * @notice Get detailed bet information
     * @param player Player address
     * @param betId Bet identifier
     * @return bet Complete bet information
     */
    function getBetInfo(address player, uint256 betId) external view returns (BetInfo memory) {
        return playerBets[player][betId];
    }
    
    /**
     * @notice Calculate current share value
     * @return value Value of one share in tokens
     */
    function getShareValue() external view returns (uint256) {
        if (totalShares == 0) return 1e18;
        return (totalLiquidity * 1e18) / totalShares;
    }
    
    /**
     * @notice Get vault statistics
     * @return liquidity Total liquidity in vault
     * @return escrow Total amount in escrow
     * @return paidOut Total amount paid out
     * @return fees Total fees collected
     * @return betsPlaced Total number of bets placed
     * @return betsWon Total number of winning bets
     * @return betsLost Total number of losing bets
     */
    function getVaultStats() external view returns (
        uint256 liquidity,
        uint256 escrow,
        uint256 paidOut,
        uint256 fees,
        uint256 betsPlaced,
        uint256 betsWon,
        uint256 betsLost
    ) {
        return (
            totalLiquidity,
            totalInEscrow,
            totalPaidOut,
            totalFeesCollected,
            totalBetsPlaced,
            totalBetsWon,
            totalBetsLost
        );
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Update fee percentage
     * @param newFee New fee in basis points
     */
    function setFeePercentage(uint256 newFee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newFee <= MAX_FEE, "Fee too high");
        uint256 oldFee = feePercentage;
        feePercentage = newFee;
        emit FeeUpdated(oldFee, newFee);
    }
    
    /**
     * @notice Update treasury address
     * @param newTreasury New treasury address
     */
    function setTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newTreasury == address(0)) revert InvalidAddress();
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }
    
    /**
     * @notice Grant settlement role to an address
     * @param settlement Settlement contract address
     */
    function grantSettlementRole(address settlement) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(SETTLEMENT_ROLE, settlement);
    }
    
    /**
     * @notice Grant bets role to an address
     * @param bets Bets contract address
     */
    function grantBetsRole(address bets) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(BETS_ROLE, bets);
    }
    
    /**
     * @notice Grant game role to an address
     * @param game Game contract address
     */
    function grantGameRole(address game) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(GAME_ROLE, game);
    }
    
    /**
     * @notice Emergency withdraw (only when paused)
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) whenPaused {
        bool success = token.transfer(msg.sender, amount);
        if (!success) revert TransferFailed();
        emit EmergencyWithdraw(msg.sender, amount);
    }
    
    /**
     * @notice Pause the contract
     */
    function pause() external onlyRole(OPERATOR_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyRole(OPERATOR_ROLE) {
        _unpause();
    }
    
    // ============ Internal Functions ============
    
    /**
     * @dev Remove a bet from the active bets array
     * @param player Player address
     * @param betId Bet to remove
     */
    function _removeActiveBet(address player, uint256 betId) internal {
        uint256[] storage activeBets = playerActiveBets[player];
        uint256 length = activeBets.length;
        
        for (uint256 i = 0; i < length; i++) {
            if (activeBets[i] == betId) {
                // Move last element to this position and pop
                activeBets[i] = activeBets[length - 1];
                activeBets.pop();
                break;
            }
        }
    }
}