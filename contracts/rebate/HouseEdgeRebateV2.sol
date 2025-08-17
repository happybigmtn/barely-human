// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title HouseEdgeRebateV2
 * @notice Refined rebate system with net settlement and virtual debt tracking
 * @dev Weekly net position calculation with 1-week expiration for unclaimed rebates
 */
contract HouseEdgeRebateV2 is AccessControl, ReentrancyGuard {
    using Math for uint256;

    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    
    struct WeeklySettlement {
        uint256 totalCollected;      // BOT collected from players
        uint256 totalIssued;         // BOT issued to players  
        int256 netPosition;          // Positive = collected, Negative = issued
        uint256 totalVolume;         // Total betting volume
        uint256 rebatePerVolume;     // Rebate per unit volume (if positive net)
        uint256 startTimestamp;
        uint256 endTimestamp;
        bool finalized;
        uint256 totalClaimed;        // Amount claimed by players
        uint256 expirationTimestamp; // When unclaimed rebates expire
    }
    
    struct PlayerWeeklyData {
        uint256 volume;              // Player's betting volume for the week
        uint256 claimableAmount;     // Calculated rebate amount
        bool claimed;                // Whether player claimed this week
        uint256 expiredUnclaimed;    // Amount that expired unclaimed
    }
    
    struct PlayerStats {
        uint256 totalVolume;
        uint256 totalClaimed;
        uint256 totalExpired;
        uint256 lastClaimWeek;
    }
    
    IERC20 public immutable botToken;
    
    uint256 public currentWeek;
    uint256 public constant WEEK_DURATION = 7 days;
    uint256 public constant CLAIM_EXPIRATION = 7 days; // 1 week to claim
    uint256 public deploymentTimestamp;
    
    // Virtual debt tracking
    int256 public virtualDebt;        // Cumulative debt that must be paid off
    uint256 public totalDebtPaidOff;  // Total debt that has been paid off
    
    // Settlement tracking
    mapping(uint256 => WeeklySettlement) public weeklySettlements;
    mapping(address => mapping(uint256 => PlayerWeeklyData)) public playerWeeklyData;
    mapping(address => PlayerStats) public playerStats;
    
    // House position tracking
    uint256 public totalHouseCollected;
    uint256 public totalHouseIssued;
    uint256 public totalRebatesDistributed;
    uint256 public totalExpiredRebates;
    
    // Events
    event TokensCollected(uint256 week, uint256 amount, address from);
    event TokensIssued(uint256 week, uint256 amount, address to);
    event VolumeRecorded(address indexed player, uint256 week, uint256 volume);
    event WeeklySettlementFinalized(uint256 week, int256 netPosition, uint256 totalVolume);
    event RebateClaimed(address indexed player, uint256 week, uint256 amount);
    event RebateExpired(uint256 week, address indexed player, uint256 amount);
    event VirtualDebtUpdated(int256 newDebt, uint256 week);
    event DebtPaidOff(uint256 amount, uint256 week);
    
    // Errors
    error InvalidWeek();
    error WeekNotEnded();
    error WeekNotFinalized();
    error AlreadyFinalized();
    error AlreadyClaimed();
    error NothingToClaim();
    error RebateHasExpired();
    error DebtNotPaidOff();
    error InsufficientTreasuryBalance();
    
    constructor(address _botToken) {
        require(_botToken != address(0), "Invalid token");
        botToken = IERC20(_botToken);
        deploymentTimestamp = block.timestamp;
        currentWeek = 0;
        virtualDebt = 0;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TREASURY_ROLE, msg.sender);
        
        // Initialize first week
        weeklySettlements[0] = WeeklySettlement({
            totalCollected: 0,
            totalIssued: 0,
            netPosition: 0,
            totalVolume: 0,
            rebatePerVolume: 0,
            startTimestamp: block.timestamp,
            endTimestamp: block.timestamp + WEEK_DURATION,
            finalized: false,
            totalClaimed: 0,
            expirationTimestamp: 0
        });
    }
    
    /**
     * @notice Records BOT tokens collected from a player (house wins)
     * @param player Address of the player
     * @param amount Amount of BOT collected
     * @param volume Betting volume associated
     */
    function recordCollection(
        address player,
        uint256 amount,
        uint256 volume
    ) external onlyRole(GAME_ROLE) {
        uint256 week = getCurrentWeek();
        
        weeklySettlements[week].totalCollected += amount;
        weeklySettlements[week].totalVolume += volume;
        playerWeeklyData[player][week].volume += volume;
        playerStats[player].totalVolume += volume;
        
        totalHouseCollected += amount;
        
        emit TokensCollected(week, amount, player);
        emit VolumeRecorded(player, week, volume);
    }
    
    /**
     * @notice Records BOT tokens issued to a player (house loses)
     * @param player Address of the player
     * @param amount Amount of BOT issued
     * @param volume Betting volume associated
     */
    function recordIssuance(
        address player,
        uint256 amount,
        uint256 volume
    ) external onlyRole(GAME_ROLE) {
        uint256 week = getCurrentWeek();
        
        weeklySettlements[week].totalIssued += amount;
        weeklySettlements[week].totalVolume += volume;
        playerWeeklyData[player][week].volume += volume;
        playerStats[player].totalVolume += volume;
        
        totalHouseIssued += amount;
        
        emit TokensIssued(week, amount, player);
        emit VolumeRecorded(player, week, volume);
    }
    
    /**
     * @notice Finalizes weekly settlement and calculates net position
     * @param week Week number to finalize
     */
    function finalizeWeeklySettlement(uint256 week) external onlyRole(TREASURY_ROLE) {
        if (week >= currentWeek) revert InvalidWeek();
        if (weeklySettlements[week].finalized) revert AlreadyFinalized();
        if (block.timestamp < weeklySettlements[week].endTimestamp) revert WeekNotEnded();
        
        WeeklySettlement storage settlement = weeklySettlements[week];
        
        // Calculate net position
        int256 netPosition = int256(settlement.totalCollected) - int256(settlement.totalIssued);
        settlement.netPosition = netPosition;
        
        // Update virtual debt
        if (netPosition < 0) {
            // House issued more than collected - add to debt
            virtualDebt += (-netPosition);
            emit VirtualDebtUpdated(virtualDebt, week);
        } else if (netPosition > 0 && virtualDebt > 0) {
            // House collected more - pay off debt first
            uint256 surplus = uint256(netPosition);
            
            if (surplus >= uint256(virtualDebt)) {
                // Debt fully paid off with surplus remaining
                uint256 debtPaid = uint256(virtualDebt);
                surplus -= debtPaid;
                totalDebtPaidOff += debtPaid;
                virtualDebt = 0;
                
                emit DebtPaidOff(debtPaid, week);
                
                // Distribute remaining surplus as rebates
                if (surplus > 0 && settlement.totalVolume > 0) {
                    settlement.rebatePerVolume = (surplus * 1e18) / settlement.totalVolume;
                }
            } else {
                // Partial debt payment
                virtualDebt -= int256(surplus);
                totalDebtPaidOff += surplus;
                emit DebtPaidOff(surplus, week);
                // No rebates this week as all surplus went to debt
            }
        } else if (netPosition > 0 && virtualDebt == 0) {
            // No debt, distribute all as rebates
            if (settlement.totalVolume > 0) {
                settlement.rebatePerVolume = (uint256(netPosition) * 1e18) / settlement.totalVolume;
            }
        }
        
        settlement.finalized = true;
        settlement.expirationTimestamp = block.timestamp + CLAIM_EXPIRATION;
        
        emit WeeklySettlementFinalized(week, netPosition, settlement.totalVolume);
    }
    
    /**
     * @notice Claims rebate for a specific week
     * @param week Week number to claim
     */
    function claimRebate(uint256 week) external nonReentrant {
        if (!weeklySettlements[week].finalized) revert WeekNotFinalized();
        if (block.timestamp > weeklySettlements[week].expirationTimestamp) revert RebateHasExpired();
        
        PlayerWeeklyData storage playerData = playerWeeklyData[msg.sender][week];
        if (playerData.claimed) revert AlreadyClaimed();
        
        uint256 claimable = calculateRebateForWeek(msg.sender, week);
        if (claimable == 0) revert NothingToClaim();
        
        playerData.claimed = true;
        playerData.claimableAmount = claimable;
        playerStats[msg.sender].totalClaimed += claimable;
        playerStats[msg.sender].lastClaimWeek = week;
        
        weeklySettlements[week].totalClaimed += claimable;
        totalRebatesDistributed += claimable;
        
        require(botToken.transfer(msg.sender, claimable), "Transfer failed");
        
        emit RebateClaimed(msg.sender, week, claimable);
    }
    
    /**
     * @notice Claims all available rebates for a player
     */
    function claimAllRebates() external nonReentrant {
        uint256 totalClaimable = 0;
        uint256 currentWeekNum = getCurrentWeek();
        
        for (uint256 week = 0; week < currentWeekNum; week++) {
            if (!weeklySettlements[week].finalized) continue;
            if (block.timestamp > weeklySettlements[week].expirationTimestamp) continue;
            if (playerWeeklyData[msg.sender][week].claimed) continue;
            
            uint256 weeklyAmount = calculateRebateForWeek(msg.sender, week);
            if (weeklyAmount > 0) {
                playerWeeklyData[msg.sender][week].claimed = true;
                playerWeeklyData[msg.sender][week].claimableAmount = weeklyAmount;
                weeklySettlements[week].totalClaimed += weeklyAmount;
                
                totalClaimable += weeklyAmount;
                emit RebateClaimed(msg.sender, week, weeklyAmount);
            }
        }
        
        if (totalClaimable == 0) revert NothingToClaim();
        
        playerStats[msg.sender].totalClaimed += totalClaimable;
        playerStats[msg.sender].lastClaimWeek = currentWeekNum - 1;
        totalRebatesDistributed += totalClaimable;
        
        require(botToken.transfer(msg.sender, totalClaimable), "Transfer failed");
    }
    
    /**
     * @notice Processes expired rebates for a week
     * @param week Week to process expirations
     */
    function processExpiredRebates(uint256 week) external onlyRole(TREASURY_ROLE) {
        WeeklySettlement storage settlement = weeklySettlements[week];
        
        require(settlement.finalized, "Week not finalized");
        require(block.timestamp > settlement.expirationTimestamp, "Not expired yet");
        
        // Calculate total unclaimed that expires
        uint256 totalDistributable = (settlement.rebatePerVolume > 0 && settlement.totalVolume > 0) 
            ? (settlement.rebatePerVolume * settlement.totalVolume) / 1e18 
            : 0;
            
        uint256 expired = totalDistributable > settlement.totalClaimed 
            ? totalDistributable - settlement.totalClaimed 
            : 0;
        
        if (expired > 0) {
            totalExpiredRebates += expired;
            // Expired rebates are retained by treasury (already in contract)
        }
    }
    
    /**
     * @notice Calculates rebate amount for a player for a specific week
     */
    function calculateRebateForWeek(address player, uint256 week) public view returns (uint256) {
        WeeklySettlement memory settlement = weeklySettlements[week];
        PlayerWeeklyData memory playerData = playerWeeklyData[player][week];
        
        if (!settlement.finalized || playerData.volume == 0 || settlement.rebatePerVolume == 0) {
            return 0;
        }
        
        return (playerData.volume * settlement.rebatePerVolume) / 1e18;
    }
    
    /**
     * @notice Gets all claimable rebates for a player
     */
    function getClaimableRebates(address player) external view returns (
        uint256 totalClaimable,
        uint256[] memory claimableWeeks,
        uint256[] memory amounts
    ) {
        uint256 currentWeekNum = getCurrentWeek();
        uint256 count = 0;
        
        // Count claimable weeks
        for (uint256 week = 0; week < currentWeekNum; week++) {
            if (isWeekClaimable(player, week)) {
                count++;
            }
        }
        
        claimableWeeks = new uint256[](count);
        amounts = new uint256[](count);
        uint256 index = 0;
        
        for (uint256 week = 0; week < currentWeekNum; week++) {
            if (isWeekClaimable(player, week)) {
                uint256 amount = calculateRebateForWeek(player, week);
                claimableWeeks[index] = week;
                amounts[index] = amount;
                totalClaimable += amount;
                index++;
            }
        }
    }
    
    /**
     * @notice Checks if a week is claimable for a player
     */
    function isWeekClaimable(address player, uint256 week) public view returns (bool) {
        WeeklySettlement memory settlement = weeklySettlements[week];
        PlayerWeeklyData memory playerData = playerWeeklyData[player][week];
        
        return settlement.finalized &&
               !playerData.claimed &&
               block.timestamp <= settlement.expirationTimestamp &&
               calculateRebateForWeek(player, week) > 0;
    }
    
    /**
     * @notice Gets the current week number
     */
    function getCurrentWeek() public view returns (uint256) {
        return (block.timestamp - deploymentTimestamp) / WEEK_DURATION;
    }
    
    /**
     * @notice Advances to next week
     */
    function advanceWeek() external onlyRole(TREASURY_ROLE) {
        uint256 nextWeek = currentWeek + 1;
        
        weeklySettlements[nextWeek] = WeeklySettlement({
            totalCollected: 0,
            totalIssued: 0,
            netPosition: 0,
            totalVolume: 0,
            rebatePerVolume: 0,
            startTimestamp: block.timestamp,
            endTimestamp: block.timestamp + WEEK_DURATION,
            finalized: false,
            totalClaimed: 0,
            expirationTimestamp: 0
        });
        
        currentWeek = nextWeek;
    }
    
    /**
     * @notice Gets weekly settlement details
     */
    function getWeeklySettlement(uint256 week) external view returns (
        uint256 collected,
        uint256 issued,
        int256 netPosition,
        uint256 volume,
        uint256 rebatePerVolume,
        bool finalized,
        uint256 expiresIn
    ) {
        WeeklySettlement memory settlement = weeklySettlements[week];
        
        uint256 expiry = 0;
        if (settlement.finalized && block.timestamp < settlement.expirationTimestamp) {
            expiry = settlement.expirationTimestamp - block.timestamp;
        }
        
        return (
            settlement.totalCollected,
            settlement.totalIssued,
            settlement.netPosition,
            settlement.totalVolume,
            settlement.rebatePerVolume,
            settlement.finalized,
            expiry
        );
    }
    
    /**
     * @notice Gets house statistics
     */
    function getHouseStats() external view returns (
        uint256 collected,
        uint256 issued,
        int256 netPosition,
        int256 debt,
        uint256 debtPaid,
        uint256 rebatesDistributed,
        uint256 expired
    ) {
        return (
            totalHouseCollected,
            totalHouseIssued,
            int256(totalHouseCollected) - int256(totalHouseIssued),
            virtualDebt,
            totalDebtPaidOff,
            totalRebatesDistributed,
            totalExpiredRebates
        );
    }
    
    /**
     * @notice Emergency token recovery
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20(token).transfer(msg.sender, amount);
    }
}