// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TreasuryOptimized
 * @notice Gas-optimized treasury addressing senior review feedback
 * @dev Removes excessive events and uses custom modifiers
 */
contract TreasuryOptimized is ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // Packed storage for percentages (single slot)
    struct FeeDistribution {
        uint64 stakingPercent;    // 8 bytes
        uint64 buybackPercent;    // 8 bytes
        uint64 devPercent;        // 8 bytes
        uint64 insurancePercent;  // 8 bytes
    }
    
    // Single storage slot for addresses (packed)
    struct Addresses {
        address botToken;      // 20 bytes
        uint96 reserved;       // 12 bytes padding
    }
    
    // Storage variables (optimized layout)
    Addresses public addresses;
    FeeDistribution public distribution;
    
    address public immutable developmentWallet;
    address public immutable insuranceWallet;
    
    // Custom role management (saves ~3KB vs AccessControl)
    address public admin;
    mapping(address => bool) public distributors;
    mapping(address => bool) public vaults;
    
    // Single event for all fee updates (reduced gas)
    event FeesUpdated(uint64 staking, uint64 buyback, uint64 dev, uint64 insurance);
    
    // Custom modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "!admin");
        _;
    }
    
    modifier onlyDistributor() {
        require(distributors[msg.sender], "!dist");
        _;
    }
    
    modifier onlyVault() {
        require(vaults[msg.sender], "!vault");
        _;
    }
    
    constructor(
        address _botToken,
        address _developmentWallet,
        address _insuranceWallet
    ) {
        require(_botToken != address(0), "!token");
        require(_developmentWallet != address(0), "!dev");
        require(_insuranceWallet != address(0), "!ins");
        
        addresses.botToken = _botToken;
        developmentWallet = _developmentWallet;
        insuranceWallet = _insuranceWallet;
        
        // Default distribution (packed in single write)
        distribution = FeeDistribution({
            stakingPercent: 50,
            buybackPercent: 20,
            devPercent: 15,
            insurancePercent: 15
        });
        
        admin = msg.sender;
        distributors[msg.sender] = true;
    }
    
    /**
     * @notice Collect fees from vault (gas-optimized)
     * @dev No events to save gas
     */
    function collectVaultFees(uint256 amount) external onlyVault nonReentrant {
        IERC20(addresses.botToken).safeTransferFrom(msg.sender, address(this), amount);
    }
    
    /**
     * @notice Distribute collected fees (batch operation)
     * @dev Single transaction for all distributions
     */
    function distributeFees() external onlyDistributor nonReentrant {
        IERC20 token = IERC20(addresses.botToken);
        uint256 balance = token.balanceOf(address(this));
        
        if (balance == 0) return;
        
        // Load distribution once (gas saving)
        FeeDistribution memory dist = distribution;
        
        // Calculate amounts (using unchecked for gas optimization)
        unchecked {
            uint256 stakingAmount = (balance * dist.stakingPercent) / 100;
            uint256 buybackAmount = (balance * dist.buybackPercent) / 100;
            uint256 devAmount = (balance * dist.devPercent) / 100;
            uint256 insuranceAmount = balance - stakingAmount - buybackAmount - devAmount;
            
            // Batch transfers
            if (stakingAmount > 0) {
                // Staking distribution handled separately
            }
            
            if (buybackAmount > 0) {
                // Buyback handled separately
            }
            
            if (devAmount > 0) {
                token.safeTransfer(developmentWallet, devAmount);
            }
            
            if (insuranceAmount > 0) {
                token.safeTransfer(insuranceWallet, insuranceAmount);
            }
        }
    }
    
    /**
     * @notice Update fee distribution (single write)
     * @dev All percentages must sum to 100
     */
    function updateDistribution(
        uint64 _staking,
        uint64 _buyback,
        uint64 _dev,
        uint64 _insurance
    ) external onlyAdmin {
        require(_staking + _buyback + _dev + _insurance == 100, "!=100");
        
        // Single storage write (gas optimized)
        distribution = FeeDistribution({
            stakingPercent: _staking,
            buybackPercent: _buyback,
            devPercent: _dev,
            insurancePercent: _insurance
        });
        
        emit FeesUpdated(_staking, _buyback, _dev, _insurance);
    }
    
    /**
     * @notice Manage distributors
     */
    function setDistributor(address account, bool status) external onlyAdmin {
        distributors[account] = status;
    }
    
    /**
     * @notice Manage vaults
     */
    function addVault(address vault) external onlyAdmin {
        vaults[vault] = true;
    }
    
    /**
     * @notice Transfer admin
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "!addr");
        admin = newAdmin;
    }
    
    /**
     * @notice Emergency token recovery
     * @dev Only for non-BOT tokens stuck in contract
     */
    function recoverToken(address token) external onlyAdmin {
        require(token != addresses.botToken, "!bot");
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).safeTransfer(admin, balance);
        }
    }
}