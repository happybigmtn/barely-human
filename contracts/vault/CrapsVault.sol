// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title CrapsVault
 * @notice ERC4626-compliant vault for bot bankrolls in the Craps game
 * @dev Manages LP deposits, bet locking, and performance fee extraction
 */
contract CrapsVault is ERC4626, AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Roles
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    bytes32 public constant BOT_ROLE = keccak256("BOT_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant FEE_COLLECTOR_ROLE = keccak256("FEE_COLLECTOR_ROLE");

    // Bot information
    uint256 public immutable botId;
    string public botName;
    address public botManager;

    // Vault state
    uint256 public totalLockedAmount;
    uint256 public lastProfitSnapshot;
    uint256 public totalProfit;
    uint256 public totalFees;
    
    // Performance fee configuration (basis points, 200 = 2%)
    uint256 public constant PERFORMANCE_FEE_BPS = 200;
    uint256 public constant BPS_DIVISOR = 10000;
    
    // Bet tracking
    struct ActiveBet {
        uint256 amount;
        uint256 timestamp;
        uint256 seriesId;
        bool isSettled;
    }
    
    mapping(uint256 => ActiveBet) public activeBets;
    uint256 public currentBetId;
    uint256 public totalActiveBets;
    
    // LP tracking for raffle
    address[] public lpHolders;
    mapping(address => bool) public isLpHolder;
    mapping(address => uint256) public lpHolderIndex;
    
    // Events
    event BetPlaced(uint256 indexed betId, uint256 amount, uint256 seriesId);
    event BetSettled(uint256 indexed betId, uint256 payout, bool won);
    event PerformanceFeeExtracted(uint256 feeAmount, uint256 profit);
    event BotManagerUpdated(address indexed newManager);
    event LPAdded(address indexed lp, uint256 shares);
    event LPRemoved(address indexed lp);
    
    /**
     * @notice Constructor
     * @param _asset The underlying asset (USDC or WETH)
     * @param _botId The unique identifier for this bot
     * @param _botName The name of the bot
     * @param _botManager The address managing this bot
     */
    constructor(
        IERC20 _asset,
        uint256 _botId,
        string memory _botName,
        address _botManager
    ) ERC4626(_asset) ERC20(
        string(abi.encodePacked("Barely Human ", _botName, " Vault")),
        string(abi.encodePacked("bhVAULT-", _botName))
    ) {
        require(_botManager != address(0), "Invalid bot manager");
        
        botId = _botId;
        botName = _botName;
        botManager = _botManager;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
        _grantRole(BOT_ROLE, _botManager);
        
        lastProfitSnapshot = totalAssets();
    }
    
    /**
     * @notice Override deposit to track LPs for raffle
     */
    function deposit(uint256 assets, address receiver) 
        public 
        virtual 
        override 
        whenNotPaused 
        nonReentrant 
        returns (uint256 shares) 
    {
        shares = super.deposit(assets, receiver);
        _trackLpHolder(receiver);
        emit LPAdded(receiver, shares);
        return shares;
    }
    
    /**
     * @notice Override mint to track LPs for raffle
     */
    function mint(uint256 shares, address receiver) 
        public 
        virtual 
        override 
        whenNotPaused 
        nonReentrant 
        returns (uint256 assets) 
    {
        assets = super.mint(shares, receiver);
        _trackLpHolder(receiver);
        emit LPAdded(receiver, shares);
        return assets;
    }
    
    /**
     * @notice Override withdraw to update LP tracking
     */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public virtual override nonReentrant returns (uint256 shares) {
        // Check if withdrawing would leave funds locked in active bets
        require(
            totalAssets() - totalLockedAmount >= assets,
            "Insufficient unlocked funds"
        );
        
        shares = super.withdraw(assets, receiver, owner);
        
        // Remove from LP tracking if balance is zero
        if (balanceOf(owner) == 0) {
            _removeLpHolder(owner);
        }
        
        return shares;
    }
    
    /**
     * @notice Override redeem to update LP tracking
     */
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public virtual override nonReentrant returns (uint256 assets) {
        assets = previewRedeem(shares);
        
        // Check if redeeming would leave funds locked in active bets
        require(
            totalAssets() - totalLockedAmount >= assets,
            "Insufficient unlocked funds"
        );
        
        assets = super.redeem(shares, receiver, owner);
        
        // Remove from LP tracking if balance is zero
        if (balanceOf(owner) == 0) {
            _removeLpHolder(owner);
        }
        
        return assets;
    }
    
    /**
     * @notice Place a bet and lock funds
     * @param amount The bet amount
     * @param seriesId The game series ID
     * @return betId The unique bet identifier
     */
    function placeBet(uint256 amount, uint256 seriesId) 
        external 
        onlyRole(GAME_ROLE) 
        whenNotPaused 
        returns (uint256 betId) 
    {
        require(amount > 0, "Invalid bet amount");
        require(
            totalAssets() - totalLockedAmount >= amount,
            "Insufficient unlocked funds"
        );
        
        betId = ++currentBetId;
        
        activeBets[betId] = ActiveBet({
            amount: amount,
            timestamp: block.timestamp,
            seriesId: seriesId,
            isSettled: false
        });
        
        totalLockedAmount += amount;
        totalActiveBets++;
        
        emit BetPlaced(betId, amount, seriesId);
        return betId;
    }
    
    /**
     * @notice Settle a bet and update vault balance
     * @param betId The bet ID to settle
     * @param payout The payout amount (0 if lost)
     */
    function settleBet(uint256 betId, uint256 payout) 
        external 
        onlyRole(GAME_ROLE) 
        nonReentrant 
    {
        ActiveBet storage bet = activeBets[betId];
        require(!bet.isSettled, "Bet already settled");
        require(bet.amount > 0, "Invalid bet");
        
        bet.isSettled = true;
        totalLockedAmount -= bet.amount;
        totalActiveBets--;
        
        bool won = payout > bet.amount;
        
        if (won) {
            // Add winnings to vault
            uint256 profit = payout - bet.amount;
            // In a real implementation, the game contract would transfer the winnings
            // For now, we assume the funds are already in the vault
            totalProfit += profit;
        }
        
        emit BetSettled(betId, payout, won);
        
        // Extract performance fee if profitable
        _extractPerformanceFee();
    }
    
    /**
     * @notice Extract performance fee on profits
     */
    function _extractPerformanceFee() internal {
        uint256 currentTotal = totalAssets();
        
        if (currentTotal > lastProfitSnapshot) {
            uint256 profit = currentTotal - lastProfitSnapshot;
            uint256 feeAmount = (profit * PERFORMANCE_FEE_BPS) / BPS_DIVISOR;
            
            if (feeAmount > 0 && hasRole(FEE_COLLECTOR_ROLE, msg.sender)) {
                // Transfer fee to treasury
                IERC20(asset()).safeTransfer(msg.sender, feeAmount);
                totalFees += feeAmount;
                
                emit PerformanceFeeExtracted(feeAmount, profit);
            }
            
            lastProfitSnapshot = currentTotal - feeAmount;
        }
    }
    
    /**
     * @notice Track LP holder for raffle participation
     */
    function _trackLpHolder(address holder) internal {
        if (!isLpHolder[holder] && balanceOf(holder) > 0) {
            lpHolders.push(holder);
            lpHolderIndex[holder] = lpHolders.length - 1;
            isLpHolder[holder] = true;
        }
    }
    
    /**
     * @notice Remove LP holder from tracking
     */
    function _removeLpHolder(address holder) internal {
        if (isLpHolder[holder]) {
            uint256 index = lpHolderIndex[holder];
            uint256 lastIndex = lpHolders.length - 1;
            
            if (index != lastIndex) {
                address lastHolder = lpHolders[lastIndex];
                lpHolders[index] = lastHolder;
                lpHolderIndex[lastHolder] = index;
            }
            
            lpHolders.pop();
            delete lpHolderIndex[holder];
            isLpHolder[holder] = false;
            
            emit LPRemoved(holder);
        }
    }
    
    /**
     * @notice Get all LP holders for raffle
     * @return Array of LP holder addresses
     */
    function getLpHolders() external view returns (address[] memory) {
        return lpHolders;
    }
    
    /**
     * @notice Get LP holder by cumulative weight for raffle selection
     * @param targetWeight The target weight for selection
     * @return The selected LP holder address
     */
    function findShareHolderByWeight(uint256 targetWeight) 
        external 
        view 
        returns (address) 
    {
        uint256 cumulativeWeight = 0;
        uint256 totalShares = totalSupply();
        
        require(totalShares > 0, "No shares exist");
        require(targetWeight < totalShares, "Target weight exceeds total");
        
        for (uint256 i = 0; i < lpHolders.length; i++) {
            address holder = lpHolders[i];
            uint256 holderShares = balanceOf(holder);
            cumulativeWeight += holderShares;
            
            if (cumulativeWeight > targetWeight) {
                return holder;
            }
        }
        
        // Fallback to last holder (should not reach here)
        return lpHolders[lpHolders.length - 1];
    }
    
    /**
     * @notice Get vault statistics
     */
    function getVaultStats() external view returns (
        uint256 totalDeposited,
        uint256 availableLiquidity,
        uint256 lockedInBets,
        uint256 lifetimeProfit,
        uint256 lifetimeFees,
        uint256 lpCount
    ) {
        totalDeposited = totalAssets();
        availableLiquidity = totalDeposited - totalLockedAmount;
        lockedInBets = totalLockedAmount;
        lifetimeProfit = totalProfit;
        lifetimeFees = totalFees;
        lpCount = lpHolders.length;
    }
    
    /**
     * @notice Update bot manager
     */
    function updateBotManager(address newManager) 
        external 
        onlyRole(MANAGER_ROLE) 
    {
        require(newManager != address(0), "Invalid manager");
        
        revokeRole(BOT_ROLE, botManager);
        botManager = newManager;
        grantRole(BOT_ROLE, newManager);
        
        emit BotManagerUpdated(newManager);
    }
    
    /**
     * @notice Emergency pause
     */
    function pause() external onlyRole(MANAGER_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause
     */
    function unpause() external onlyRole(MANAGER_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Override totalAssets to account for locked funds properly
     */
    function totalAssets() public view virtual override returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }
    
    /**
     * @notice Check if vault can support a bet amount
     */
    function canPlaceBet(uint256 amount) external view returns (bool) {
        return totalAssets() - totalLockedAmount >= amount;
    }
}