// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface ICrapsGame {
    function placeBet(
        address player,
        uint8 betType,
        uint256 amount,
        uint8[] calldata betNumbers
    ) external returns (uint256 betId);
    
    function settleBet(uint256 betId) external returns (uint256 payout);
}

interface ITreasury {
    function receivePerformanceFees(uint256 amount) external;
}

/**
 * @title USDCBotVault
 * @notice ERC4626 vault for USDC deposits, enabling stablecoin betting in the casino
 * @dev Qualifies for Circle prize by integrating USDC as primary stablecoin
 */
contract USDCBotVault is ERC4626, AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Constants
    uint256 public constant PERFORMANCE_FEE = 200; // 2% performance fee
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MIN_BET = 1e6; // 1 USDC (6 decimals)
    uint256 public constant MAX_BET = 10000e6; // 10,000 USDC
    
    // Circle USDC addresses by chain
    address public constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address public constant USDC_ARBITRUM_SEPOLIA = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;
    
    // Roles
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    
    // State
    IERC20 public immutable USDC;
    ICrapsGame public crapsGame;
    ITreasury public treasury;
    uint8 public botId;
    string public botName;
    
    // Tracking
    uint256 public totalBetsPlaced;
    uint256 public totalBetsWon;
    uint256 public totalBetsLost;
    uint256 public totalWinnings;
    uint256 public totalLosses;
    uint256 public totalPerformanceFees;
    
    // Active bets
    mapping(uint256 => Bet) public activeBets;
    mapping(address => uint256[]) public userBets;
    
    struct Bet {
        address player;
        uint256 amount;
        uint8 betType;
        uint256 timestamp;
        bool settled;
        uint256 payout;
    }
    
    // Events
    event BetPlaced(
        uint256 indexed betId,
        address indexed player,
        uint256 amount,
        uint8 betType
    );
    
    event BetSettled(
        uint256 indexed betId,
        address indexed player,
        uint256 payout,
        bool won
    );
    
    event PerformanceFeeTaken(uint256 amount);
    event GameContractUpdated(address indexed newGame);
    event TreasuryUpdated(address indexed newTreasury);
    
    // Errors
    error InvalidAmount();
    error InvalidBetType();
    error BetNotFound();
    error AlreadySettled();
    error InvalidGame();
    error InvalidTreasury();
    
    constructor(
        address _usdc,
        address _crapsGame,
        address _treasury,
        uint8 _botId,
        string memory _botName
    ) ERC4626(IERC20(_usdc)) ERC20(
        string(abi.encodePacked("USDC ", _botName, " Vault")),
        string(abi.encodePacked("vUSDC-", _botName))
    ) {
        require(_usdc != address(0), "Invalid USDC");
        require(_crapsGame != address(0), "Invalid game");
        require(_treasury != address(0), "Invalid treasury");
        
        USDC = IERC20(_usdc);
        crapsGame = ICrapsGame(_crapsGame);
        treasury = ITreasury(_treasury);
        botId = _botId;
        botName = _botName;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GAME_ROLE, _crapsGame);
        _grantRole(MANAGER_ROLE, msg.sender);
    }
    
    /**
     * @notice Deposit USDC and receive vault shares
     * @param assets Amount of USDC to deposit
     * @param receiver Address to receive shares
     */
    function deposit(uint256 assets, address receiver) 
        public 
        virtual 
        override 
        nonReentrant 
        whenNotPaused 
        returns (uint256) 
    {
        require(assets >= MIN_BET, "Below minimum");
        return super.deposit(assets, receiver);
    }
    
    /**
     * @notice Withdraw USDC by burning vault shares
     * @param assets Amount of USDC to withdraw
     * @param receiver Address to receive USDC
     * @param owner Address that owns the shares
     */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public virtual override nonReentrant whenNotPaused returns (uint256) {
        return super.withdraw(assets, receiver, owner);
    }
    
    /**
     * @notice Place a bet using vault funds
     * @param amount USDC amount to bet
     * @param betType Type of craps bet
     * @param betNumbers Optional numbers for specific bets
     */
    function placeBet(
        uint256 amount,
        uint8 betType,
        uint8[] calldata betNumbers
    ) external onlyRole(GAME_ROLE) nonReentrant returns (uint256 betId) {
        if (amount < MIN_BET || amount > MAX_BET) revert InvalidAmount();
        if (betType > 63) revert InvalidBetType(); // 64 bet types
        
        // Ensure vault has sufficient USDC
        uint256 vaultBalance = USDC.balanceOf(address(this));
        require(vaultBalance >= amount, "Insufficient vault balance");
        
        // Approve game contract to spend USDC
        USDC.forceApprove(address(crapsGame), amount);
        
        // Place bet through game contract
        betId = crapsGame.placeBet(address(this), betType, amount, betNumbers);
        
        // Track bet
        activeBets[betId] = Bet({
            player: msg.sender,
            amount: amount,
            betType: betType,
            timestamp: block.timestamp,
            settled: false,
            payout: 0
        });
        
        userBets[msg.sender].push(betId);
        totalBetsPlaced++;
        
        emit BetPlaced(betId, msg.sender, amount, betType);
    }
    
    /**
     * @notice Settle a bet and distribute winnings
     * @param betId ID of the bet to settle
     */
    function settleBet(uint256 betId) 
        external 
        onlyRole(GAME_ROLE) 
        nonReentrant 
        returns (uint256 payout) 
    {
        Bet storage bet = activeBets[betId];
        if (bet.amount == 0) revert BetNotFound();
        if (bet.settled) revert AlreadySettled();
        
        // Settle through game contract
        payout = crapsGame.settleBet(betId);
        
        bet.settled = true;
        bet.payout = payout;
        
        if (payout > bet.amount) {
            // Won - take performance fee on profit
            uint256 profit = payout - bet.amount;
            uint256 performanceFee = (profit * PERFORMANCE_FEE) / BASIS_POINTS;
            
            // Send fee to treasury
            if (performanceFee > 0) {
                USDC.safeTransfer(address(treasury), performanceFee);
                treasury.receivePerformanceFees(performanceFee);
                totalPerformanceFees += performanceFee;
                emit PerformanceFeeTaken(performanceFee);
            }
            
            totalBetsWon++;
            totalWinnings += profit;
        } else {
            totalBetsLost++;
            totalLosses += bet.amount - payout;
        }
        
        emit BetSettled(betId, bet.player, payout, payout > bet.amount);
    }
    
    /**
     * @notice Get bot statistics
     */
    function getBotStats() external view returns (
        uint256 betsPlaced,
        uint256 betsWon,
        uint256 betsLost,
        uint256 netProfit,
        uint256 vaultBalance,
        uint256 totalShares
    ) {
        return (
            totalBetsPlaced,
            totalBetsWon,
            totalBetsLost,
            totalWinnings > totalLosses ? totalWinnings - totalLosses : 0,
            USDC.balanceOf(address(this)),
            totalSupply()
        );
    }
    
    /**
     * @notice Calculate current share price including pending bets
     */
    function sharePrice() external view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 1e6; // 1 USDC per share initially
        
        uint256 totalAssets = USDC.balanceOf(address(this));
        return (totalAssets * 1e6) / supply;
    }
    
    // Admin functions
    
    function setGame(address newGame) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newGame == address(0)) revert InvalidGame();
        crapsGame = ICrapsGame(newGame);
        _grantRole(GAME_ROLE, newGame);
        emit GameContractUpdated(newGame);
    }
    
    function setTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newTreasury == address(0)) revert InvalidTreasury();
        treasury = ITreasury(newTreasury);
        emit TreasuryUpdated(newTreasury);
    }
    
    function pause() external onlyRole(MANAGER_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(MANAGER_ROLE) {
        _unpause();
    }
    
    /**
     * @notice Emergency function to recover stuck tokens
     * @dev Cannot withdraw USDC that belongs to depositors
     */
    function emergencyWithdraw(address token, uint256 amount) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(token != address(USDC) || amount <= USDC.balanceOf(address(this)) - totalAssets(), 
                "Cannot withdraw depositor funds");
        IERC20(token).safeTransfer(msg.sender, amount);
    }
}