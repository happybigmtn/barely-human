// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title HouseEdgeRebate
 * @notice Distributes accumulated house edge to LPs based on their betting volume
 * @dev Weekly rebate cycles with proportional distribution
 */
contract HouseEdgeRebate is AccessControl, ReentrancyGuard {
    using Math for uint256;

    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    
    struct LPVolumeData {
        uint256 totalVolume;
        uint256 lastClaimedWeek;
        uint256 pendingRebate;
    }
    
    struct WeeklyRebate {
        uint256 totalHouseEdge;
        uint256 totalVolume;
        uint256 rebatePerVolume; // scaled by 1e18
        uint256 startTimestamp;
        uint256 endTimestamp;
        bool distributed;
    }
    
    IERC20 public immutable botToken;
    uint256 public currentWeek;
    uint256 public constant WEEK_DURATION = 7 days;
    uint256 public constant REBATE_PRECISION = 1e18;
    uint256 public deploymentTimestamp;
    
    mapping(uint256 => WeeklyRebate) public weeklyRebates;
    mapping(address => mapping(uint256 => uint256)) public lpWeeklyVolume;
    mapping(address => LPVolumeData) public lpData;
    mapping(uint256 => uint256) public botHouseEdgeAccumulated;
    
    uint256 public totalHouseEdgeAccumulated;
    uint256 public totalRebatesDistributed;
    
    event VolumeRecorded(address indexed lp, uint256 botId, uint256 amount, uint256 week);
    event HouseEdgeAccumulated(uint256 botId, uint256 amount, uint256 week);
    event WeeklyRebateCalculated(uint256 week, uint256 totalHouseEdge, uint256 totalVolume);
    event RebateClaimed(address indexed lp, uint256 amount, uint256 week);
    event WeekFinalized(uint256 week, uint256 rebatePerVolume);
    
    error InvalidWeek();
    error WeekNotFinalized();
    error AlreadyDistributed();
    error NothingToClaim();
    error WeekNotEnded();
    
    constructor(address _botToken) {
        require(_botToken != address(0), "Invalid token");
        botToken = IERC20(_botToken);
        deploymentTimestamp = block.timestamp;
        currentWeek = 0;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TREASURY_ROLE, msg.sender);
        
        // Initialize first week
        weeklyRebates[0] = WeeklyRebate({
            totalHouseEdge: 0,
            totalVolume: 0,
            rebatePerVolume: 0,
            startTimestamp: block.timestamp,
            endTimestamp: block.timestamp + WEEK_DURATION,
            distributed: false
        });
    }
    
    /**
     * @notice Records betting volume for an LP
     * @param lp Address of the liquidity provider
     * @param botId ID of the bot being bet on
     * @param amount Volume of the bet
     */
    function recordVolume(address lp, uint256 botId, uint256 amount) external onlyRole(GAME_ROLE) {
        uint256 week = getCurrentWeek();
        
        lpWeeklyVolume[lp][week] += amount;
        lpData[lp].totalVolume += amount;
        weeklyRebates[week].totalVolume += amount;
        
        emit VolumeRecorded(lp, botId, amount, week);
    }
    
    /**
     * @notice Accumulates house edge from a bot's losses
     * @param botId ID of the bot
     * @param amount House edge amount
     */
    function accumulateHouseEdge(uint256 botId, uint256 amount) external onlyRole(GAME_ROLE) {
        uint256 week = getCurrentWeek();
        
        botHouseEdgeAccumulated[botId] += amount;
        weeklyRebates[week].totalHouseEdge += amount;
        totalHouseEdgeAccumulated += amount;
        
        emit HouseEdgeAccumulated(botId, amount, week);
    }
    
    /**
     * @notice Finalizes a week and calculates rebate per volume
     * @param week Week number to finalize
     */
    function finalizeWeek(uint256 week) external onlyRole(TREASURY_ROLE) {
        if (week >= currentWeek) revert InvalidWeek();
        if (weeklyRebates[week].distributed) revert AlreadyDistributed();
        if (block.timestamp < weeklyRebates[week].endTimestamp) revert WeekNotEnded();
        
        WeeklyRebate storage rebate = weeklyRebates[week];
        
        if (rebate.totalVolume > 0 && rebate.totalHouseEdge > 0) {
            // Calculate rebate per unit volume (scaled by 1e18)
            rebate.rebatePerVolume = (rebate.totalHouseEdge * REBATE_PRECISION) / rebate.totalVolume;
        }
        
        rebate.distributed = true;
        
        emit WeekFinalized(week, rebate.rebatePerVolume);
        emit WeeklyRebateCalculated(week, rebate.totalHouseEdge, rebate.totalVolume);
    }
    
    /**
     * @notice Claims accumulated rebates for an LP
     * @param lp Address of the LP claiming rebates
     */
    function claimRebate(address lp) external nonReentrant {
        uint256 totalRebate = calculatePendingRebate(lp);
        
        if (totalRebate == 0) revert NothingToClaim();
        
        LPVolumeData storage data = lpData[lp];
        data.lastClaimedWeek = getCurrentWeek();
        data.pendingRebate = 0;
        
        totalRebatesDistributed += totalRebate;
        
        // Transfer rebate tokens to LP
        require(botToken.transfer(lp, totalRebate), "Transfer failed");
        
        emit RebateClaimed(lp, totalRebate, getCurrentWeek());
    }
    
    /**
     * @notice Calculates pending rebate for an LP
     * @param lp Address of the LP
     * @return totalRebate Total rebate amount pending
     */
    function calculatePendingRebate(address lp) public view returns (uint256 totalRebate) {
        LPVolumeData memory data = lpData[lp];
        uint256 lastClaimed = data.lastClaimedWeek;
        uint256 currentWeekNum = getCurrentWeek();
        
        for (uint256 week = lastClaimed; week < currentWeekNum; week++) {
            WeeklyRebate memory rebate = weeklyRebates[week];
            
            if (rebate.distributed && lpWeeklyVolume[lp][week] > 0) {
                uint256 weekRebate = (lpWeeklyVolume[lp][week] * rebate.rebatePerVolume) / REBATE_PRECISION;
                totalRebate += weekRebate;
            }
        }
        
        totalRebate += data.pendingRebate;
    }
    
    /**
     * @notice Advances to the next week
     */
    function advanceWeek() external onlyRole(TREASURY_ROLE) {
        uint256 nextWeek = currentWeek + 1;
        
        weeklyRebates[nextWeek] = WeeklyRebate({
            totalHouseEdge: 0,
            totalVolume: 0,
            rebatePerVolume: 0,
            startTimestamp: block.timestamp,
            endTimestamp: block.timestamp + WEEK_DURATION,
            distributed: false
        });
        
        currentWeek = nextWeek;
    }
    
    /**
     * @notice Gets the current week number
     */
    function getCurrentWeek() public view returns (uint256) {
        return (block.timestamp - deploymentTimestamp) / WEEK_DURATION;
    }
    
    /**
     * @notice Emergency withdrawal of tokens
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20(token).transfer(msg.sender, amount);
    }
    
    /**
     * @notice Gets detailed LP statistics
     */
    function getLPStats(address lp) external view returns (
        uint256 totalVolume,
        uint256 pendingRebate,
        uint256 lastClaimedWeek,
        uint256 currentWeekVolume
    ) {
        LPVolumeData memory data = lpData[lp];
        return (
            data.totalVolume,
            calculatePendingRebate(lp),
            data.lastClaimedWeek,
            lpWeeklyVolume[lp][getCurrentWeek()]
        );
    }
    
    /**
     * @notice Gets weekly rebate information
     */
    function getWeeklyRebateInfo(uint256 week) external view returns (
        uint256 totalHouseEdge,
        uint256 totalVolume,
        uint256 rebatePerVolume,
        bool distributed,
        uint256 timeRemaining
    ) {
        WeeklyRebate memory rebate = weeklyRebates[week];
        uint256 remaining = 0;
        
        if (block.timestamp < rebate.endTimestamp) {
            remaining = rebate.endTimestamp - block.timestamp;
        }
        
        return (
            rebate.totalHouseEdge,
            rebate.totalVolume,
            rebate.rebatePerVolume,
            rebate.distributed,
            remaining
        );
    }
}