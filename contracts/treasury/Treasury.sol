// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IStakingPool {
    function notifyRewardAmount(uint256 reward) external;
}

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
    
    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external view returns (uint256[] memory amounts);
}

/**
 * @title Treasury
 * @notice Manages protocol fees, distributions, and buybacks
 * @dev Collects fees from vaults and Uniswap hooks, distributes to stakers
 */
contract Treasury is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // Roles
    bytes32 public constant VAULT_ROLE = keccak256("VAULT_ROLE");
    bytes32 public constant HOOK_ROLE = keccak256("HOOK_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    
    // Core contracts
    IERC20 public immutable botToken;
    IStakingPool public stakingPool;
    IUniswapV2Router public router;
    
    // Fee distribution percentages (basis points, 10000 = 100%)
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public stakingRewardsPct = 5000;  // 50% to stakers
    uint256 public buybackPct = 2000;         // 20% for BOT buyback
    uint256 public developmentPct = 1500;     // 15% for development
    uint256 public insurancePct = 1500;       // 15% for insurance fund
    
    // Fee tracking
    mapping(address => uint256) public accumulatedFees;
    uint256 public totalFeesCollected;
    uint256 public totalFeesDistributed;
    
    // Buyback settings
    uint256 public minBuybackAmount = 100 * 1e18; // Min 100 USDC for buyback
    address public constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913; // Base USDC
    address public constant WETH = 0x4200000000000000000000000000000000000006; // Base WETH
    
    // Treasury wallets
    address public developmentWallet;
    address public insuranceWallet;
    
    // Events
    event FeesReceived(address indexed from, address indexed token, uint256 amount);
    event FeesDistributed(uint256 toStaking, uint256 toBuyback, uint256 toDev, uint256 toInsurance);
    event BuybackExecuted(uint256 amountIn, uint256 botReceived);
    event StakingPoolUpdated(address indexed newPool);
    event RouterUpdated(address indexed newRouter);
    event WalletsUpdated(address development, address insurance);
    event DistributionUpdated(uint256 staking, uint256 buyback, uint256 dev, uint256 insurance);
    
    // Errors
    error InvalidPercentages();
    error InsufficientBalance();
    error BuybackTooSmall();
    error ZeroAddress();
    error TransferFailed();
    
    constructor(
        address _botToken,
        address _developmentWallet,
        address _insuranceWallet
    ) {
        require(_botToken != address(0), "Invalid BOT token");
        require(_developmentWallet != address(0), "Invalid dev wallet");
        require(_insuranceWallet != address(0), "Invalid insurance wallet");
        
        botToken = IERC20(_botToken);
        developmentWallet = _developmentWallet;
        insuranceWallet = _insuranceWallet;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(DISTRIBUTOR_ROLE, msg.sender);
    }
    
    // Fee collection functions
    
    /**
     * @notice Receive fees from vaults (performance fees)
     * @param token The token being received
     * @param amount The amount of fees
     */
    function receiveFees(address token, uint256 amount) 
        external 
        onlyRole(VAULT_ROLE) 
        nonReentrant 
    {
        if (amount == 0) return;
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        accumulatedFees[token] += amount;
        totalFeesCollected += amount;
        
        emit FeesReceived(msg.sender, token, amount);
    }
    
    /**
     * @notice Receive fees from Uniswap V4 hooks (swap fees)
     * @param amount The amount of BOT tokens
     */
    function receiveSwapFees(uint256 amount) 
        external 
        onlyRole(HOOK_ROLE) 
        nonReentrant 
    {
        if (amount == 0) return;
        
        botToken.safeTransferFrom(msg.sender, address(this), amount);
        accumulatedFees[address(botToken)] += amount;
        totalFeesCollected += amount;
        
        emit FeesReceived(msg.sender, address(botToken), amount);
    }
    
    // Distribution functions
    
    /**
     * @notice Distribute accumulated BOT fees according to percentages
     */
    function distributeBotFees() 
        external 
        onlyRole(DISTRIBUTOR_ROLE) 
        nonReentrant 
    {
        uint256 botBalance = accumulatedFees[address(botToken)];
        if (botBalance == 0) revert InsufficientBalance();
        
        // Calculate distributions
        uint256 toStaking = botBalance * stakingRewardsPct / BASIS_POINTS;
        uint256 toBuyback = botBalance * buybackPct / BASIS_POINTS;
        uint256 toDev = botBalance * developmentPct / BASIS_POINTS;
        uint256 toInsurance = botBalance * insurancePct / BASIS_POINTS;
        
        // Reset accumulated fees
        accumulatedFees[address(botToken)] = 0;
        totalFeesDistributed += botBalance;
        
        // Transfer to staking pool and notify rewards
        if (toStaking > 0 && address(stakingPool) != address(0)) {
            botToken.safeTransfer(address(stakingPool), toStaking);
            stakingPool.notifyRewardAmount(toStaking);
        }
        
        // Keep buyback funds in treasury for manual execution
        // toBuyback stays in contract
        
        // Transfer to development
        if (toDev > 0) {
            botToken.safeTransfer(developmentWallet, toDev);
        }
        
        // Transfer to insurance
        if (toInsurance > 0) {
            botToken.safeTransfer(insuranceWallet, toInsurance);
        }
        
        emit FeesDistributed(toStaking, toBuyback, toDev, toInsurance);
    }
    
    /**
     * @notice Execute BOT buyback with accumulated USDC
     * @param amountIn Amount of USDC to swap
     * @param minAmountOut Minimum BOT tokens to receive
     */
    function executeBuyback(uint256 amountIn, uint256 minAmountOut) 
        external 
        onlyRole(OPERATOR_ROLE) 
        nonReentrant 
    {
        if (amountIn < minBuybackAmount) revert BuybackTooSmall();
        if (accumulatedFees[USDC] < amountIn) revert InsufficientBalance();
        
        accumulatedFees[USDC] -= amountIn;
        
        // Approve router
        IERC20(USDC).approve(address(router), amountIn);
        
        // Setup swap path: USDC -> WETH -> BOT
        address[] memory path = new address[](3);
        path[0] = USDC;
        path[1] = WETH;
        path[2] = address(botToken);
        
        // Execute swap
        uint256[] memory amounts = router.swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            address(this),
            block.timestamp + 300
        );
        
        uint256 botReceived = amounts[amounts.length - 1];
        
        // Add bought BOT to accumulated fees for distribution
        accumulatedFees[address(botToken)] += botReceived;
        
        emit BuybackExecuted(amountIn, botReceived);
    }
    
    // Admin functions
    
    function setStakingPool(address _stakingPool) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        if (_stakingPool == address(0)) revert ZeroAddress();
        stakingPool = IStakingPool(_stakingPool);
        emit StakingPoolUpdated(_stakingPool);
    }
    
    function setRouter(address _router) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        if (_router == address(0)) revert ZeroAddress();
        router = IUniswapV2Router(_router);
        emit RouterUpdated(_router);
    }
    
    function setWallets(address _development, address _insurance) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        if (_development == address(0) || _insurance == address(0)) revert ZeroAddress();
        developmentWallet = _development;
        insuranceWallet = _insurance;
        emit WalletsUpdated(_development, _insurance);
    }
    
    function setDistribution(
        uint256 _staking,
        uint256 _buyback,
        uint256 _dev,
        uint256 _insurance
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_staking + _buyback + _dev + _insurance != BASIS_POINTS) {
            revert InvalidPercentages();
        }
        
        stakingRewardsPct = _staking;
        buybackPct = _buyback;
        developmentPct = _dev;
        insurancePct = _insurance;
        
        emit DistributionUpdated(_staking, _buyback, _dev, _insurance);
    }
    
    /**
     * @notice Grant vault role to a new vault
     */
    function addVault(address vault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(VAULT_ROLE, vault);
    }
    
    /**
     * @notice Grant hook role to Uniswap V4 hook
     */
    function addHook(address hook) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(HOOK_ROLE, hook);
    }
    
    /**
     * @notice Emergency token recovery
     */
    function recoverToken(address token, uint256 amount) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        IERC20(token).safeTransfer(msg.sender, amount);
    }
    
    // View functions
    
    function getAccumulatedFees(address token) external view returns (uint256) {
        return accumulatedFees[token];
    }
    
    function getTotalStats() external view returns (
        uint256 collected,
        uint256 distributed,
        uint256 botFees,
        uint256 usdcFees
    ) {
        return (
            totalFeesCollected,
            totalFeesDistributed,
            accumulatedFees[address(botToken)],
            accumulatedFees[USDC]
        );
    }
}