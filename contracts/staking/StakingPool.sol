// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title StakingPool
 * @notice Single-token staking pool for BOT tokens with accumulative reward model
 * @dev Rewards come from treasury (swap fees + performance fees)
 */
contract StakingPool is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using Math for uint256;

    // Roles
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    bytes32 public constant REWARDS_MANAGER = keccak256("REWARDS_MANAGER");

    // State variables
    IERC20 public immutable stakingToken;
    IERC20 public immutable rewardToken;
    
    uint256 public totalStaked;
    uint256 public rewardPerTokenStored;
    uint256 public lastUpdateTime;
    uint256 public rewardRate;
    uint256 public rewardsDuration = 7 days;
    uint256 public periodFinish;
    
    // Minimum stake amount (1 BOT)
    uint256 public constant MIN_STAKE = 1e18;
    
    // Staking info per user
    struct StakeInfo {
        uint256 amount;
        uint256 rewardPerTokenPaid;
        uint256 rewards;
        uint256 lastStakeTime;
    }
    
    mapping(address => StakeInfo) public stakes;
    
    // Events
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardsAdded(uint256 reward);
    event RewardsDurationUpdated(uint256 newDuration);
    event Recovered(address token, uint256 amount);
    
    // Errors
    error InsufficientStake();
    error NoStakedBalance();
    error ZeroAmount();
    error RewardTooHigh();
    error NotEnoughRewards();
    error InvalidDuration();
    error StakingTokenRecovery();
    error TooEarlyToUnstake();
    
    constructor(
        address _stakingToken,
        address _rewardToken,
        address _treasury
    ) {
        require(_stakingToken != address(0), "Invalid staking token");
        require(_rewardToken != address(0), "Invalid reward token");
        require(_treasury != address(0), "Invalid treasury");
        
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TREASURY_ROLE, _treasury);
        _grantRole(REWARDS_MANAGER, msg.sender);
    }
    
    // View functions
    
    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) {
            return rewardPerTokenStored;
        }
        return rewardPerTokenStored + (
            (lastTimeRewardApplicable() - lastUpdateTime) * rewardRate * 1e18 / totalStaked
        );
    }
    
    function lastTimeRewardApplicable() public view returns (uint256) {
        return Math.min(block.timestamp, periodFinish);
    }
    
    function earned(address account) public view returns (uint256) {
        StakeInfo memory stakeInfo = stakes[account];
        return stakeInfo.amount * (rewardPerToken() - stakeInfo.rewardPerTokenPaid) / 1e18 + stakeInfo.rewards;
    }
    
    function getRewardForDuration() external view returns (uint256) {
        return rewardRate * rewardsDuration;
    }
    
    function balanceOf(address account) external view returns (uint256) {
        return stakes[account].amount;
    }
    
    // Mutative functions
    
    function stake(uint256 amount) external nonReentrant whenNotPaused updateReward(msg.sender) {
        if (amount == 0) revert ZeroAmount();
        if (amount < MIN_STAKE) revert InsufficientStake();
        
        totalStaked += amount;
        stakes[msg.sender].amount += amount;
        stakes[msg.sender].lastStakeTime = block.timestamp;
        
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        
        emit Staked(msg.sender, amount);
    }
    
    function withdraw(uint256 amount) public nonReentrant updateReward(msg.sender) {
        if (amount == 0) revert ZeroAmount();
        
        StakeInfo storage stakeInfo = stakes[msg.sender];
        if (stakeInfo.amount < amount) revert NoStakedBalance();
        
        // Optional: Add lock period
        // if (block.timestamp < stakeInfo.lastStakeTime + 1 days) revert TooEarlyToUnstake();
        
        totalStaked -= amount;
        stakeInfo.amount -= amount;
        
        stakingToken.safeTransfer(msg.sender, amount);
        
        emit Withdrawn(msg.sender, amount);
    }
    
    function getReward() public nonReentrant updateReward(msg.sender) {
        uint256 reward = stakes[msg.sender].rewards;
        if (reward > 0) {
            stakes[msg.sender].rewards = 0;
            rewardToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }
    
    function exit() external {
        withdraw(stakes[msg.sender].amount);
        getReward();
    }
    
    // Admin functions
    
    function notifyRewardAmount(uint256 reward) 
        external 
        onlyRole(TREASURY_ROLE) 
        updateReward(address(0)) 
    {
        if (block.timestamp >= periodFinish) {
            rewardRate = reward / rewardsDuration;
        } else {
            uint256 remaining = periodFinish - block.timestamp;
            uint256 leftover = remaining * rewardRate;
            rewardRate = (reward + leftover) / rewardsDuration;
        }
        
        // Ensure the provided reward amount is not more than the balance in the contract
        uint256 balance = rewardToken.balanceOf(address(this));
        if (rewardRate > balance / rewardsDuration) revert RewardTooHigh();
        
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + rewardsDuration;
        
        emit RewardsAdded(reward);
    }
    
    function setRewardsDuration(uint256 _rewardsDuration) 
        external 
        onlyRole(REWARDS_MANAGER) 
    {
        if (block.timestamp <= periodFinish) revert InvalidDuration();
        if (_rewardsDuration == 0) revert InvalidDuration();
        
        rewardsDuration = _rewardsDuration;
        emit RewardsDurationUpdated(rewardsDuration);
    }
    
    function recoverERC20(address tokenAddress, uint256 tokenAmount) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        if (tokenAddress == address(stakingToken)) revert StakingTokenRecovery();
        IERC20(tokenAddress).safeTransfer(msg.sender, tokenAmount);
        emit Recovered(tokenAddress, tokenAmount);
    }
    
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    // Modifiers
    
    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        
        if (account != address(0)) {
            stakes[account].rewards = earned(account);
            stakes[account].rewardPerTokenPaid = rewardPerTokenStored;
        }
        _;
    }
}