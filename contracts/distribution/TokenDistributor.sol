// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TokenDistributor
 * @notice Manages token distribution for airdrops, leaderboard rewards, and vesting
 * @dev Handles the 10% testnet rewards and coordinates with other distribution mechanisms
 */
contract TokenDistributor is AccessControl, ReentrancyGuard {
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    struct LeaderboardEntry {
        address participant;
        uint256 score;
        uint256 reward;
        bool claimed;
    }
    
    struct VestingSchedule {
        uint256 totalAmount;
        uint256 startTime;
        uint256 duration;
        uint256 claimedAmount;
        bool revoked;
    }
    
    IERC20 public immutable botToken;
    
    // Leaderboard competition
    mapping(uint256 => LeaderboardEntry[]) public competitionLeaderboards;
    mapping(uint256 => mapping(address => uint256)) public participantScores;
    mapping(uint256 => bool) public competitionFinalized;
    mapping(address => uint256) public totalRewardsClaimed;
    
    uint256 public currentCompetitionId;
    uint256 public totalAirdropAllocated;
    uint256 public totalAirdropDistributed;
    
    // Vesting for team/advisors
    mapping(address => VestingSchedule) public vestingSchedules;
    
    // Constants
    uint256 public constant AIRDROP_ALLOCATION = 100_000_000 * 10**18; // 10% of total supply
    uint256 public constant MAX_LEADERBOARD_SIZE = 1000;
    
    event CompetitionStarted(uint256 indexed competitionId);
    event CompetitionFinalized(uint256 indexed competitionId, uint256 totalRewards);
    event ScoreUpdated(uint256 indexed competitionId, address indexed participant, uint256 newScore);
    event RewardClaimed(address indexed participant, uint256 amount, uint256 competitionId);
    event VestingScheduleCreated(address indexed beneficiary, uint256 amount, uint256 duration);
    event VestingClaimed(address indexed beneficiary, uint256 amount);
    event VestingRevoked(address indexed beneficiary, uint256 amountRevoked);
    
    error CompetitionNotFinalized();
    error AlreadyClaimed();
    error NoRewardAvailable();
    error InvalidScore();
    error CompetitionAlreadyFinalized();
    error ExceedsAllocation();
    error VestingNotStarted();
    error NoVestingSchedule();
    
    constructor(address _botToken) {
        require(_botToken != address(0), "Invalid token");
        botToken = IERC20(_botToken);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(DISTRIBUTOR_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }
    
    /**
     * @notice Starts a new leaderboard competition
     */
    function startCompetition() external onlyRole(DISTRIBUTOR_ROLE) {
        currentCompetitionId++;
        emit CompetitionStarted(currentCompetitionId);
    }
    
    /**
     * @notice Updates a participant's score in the current competition
     * @param participant Address of the participant
     * @param score New score value
     */
    function updateScore(address participant, uint256 score) external onlyRole(OPERATOR_ROLE) {
        if (score == 0) revert InvalidScore();
        if (competitionFinalized[currentCompetitionId]) revert CompetitionAlreadyFinalized();
        
        participantScores[currentCompetitionId][participant] = score;
        emit ScoreUpdated(currentCompetitionId, participant, score);
    }
    
    /**
     * @notice Batch update scores for multiple participants
     * @param participants Array of participant addresses
     * @param scores Array of corresponding scores
     */
    function batchUpdateScores(
        address[] calldata participants,
        uint256[] calldata scores
    ) external onlyRole(OPERATOR_ROLE) {
        require(participants.length == scores.length, "Length mismatch");
        require(participants.length <= 100, "Batch too large");
        
        for (uint256 i = 0; i < participants.length; i++) {
            if (scores[i] > 0 && !competitionFinalized[currentCompetitionId]) {
                participantScores[currentCompetitionId][participants[i]] = scores[i];
                emit ScoreUpdated(currentCompetitionId, participants[i], scores[i]);
            }
        }
    }
    
    /**
     * @notice Finalizes competition and calculates rewards
     * @param topParticipants Ordered array of top participants
     * @param rewards Array of reward amounts
     */
    function finalizeCompetition(
        address[] calldata topParticipants,
        uint256[] calldata rewards
    ) external onlyRole(DISTRIBUTOR_ROLE) {
        require(topParticipants.length == rewards.length, "Length mismatch");
        require(topParticipants.length <= MAX_LEADERBOARD_SIZE, "Too many participants");
        
        if (competitionFinalized[currentCompetitionId]) revert CompetitionAlreadyFinalized();
        
        uint256 totalRewards = 0;
        for (uint256 i = 0; i < rewards.length; i++) {
            totalRewards += rewards[i];
        }
        
        if (totalAirdropAllocated + totalRewards > AIRDROP_ALLOCATION) {
            revert ExceedsAllocation();
        }
        
        // Store leaderboard
        for (uint256 i = 0; i < topParticipants.length; i++) {
            competitionLeaderboards[currentCompetitionId].push(LeaderboardEntry({
                participant: topParticipants[i],
                score: participantScores[currentCompetitionId][topParticipants[i]],
                reward: rewards[i],
                claimed: false
            }));
        }
        
        totalAirdropAllocated += totalRewards;
        competitionFinalized[currentCompetitionId] = true;
        
        emit CompetitionFinalized(currentCompetitionId, totalRewards);
    }
    
    /**
     * @notice Claims rewards from a finalized competition
     * @param competitionId ID of the competition
     */
    function claimReward(uint256 competitionId) external nonReentrant {
        if (!competitionFinalized[competitionId]) revert CompetitionNotFinalized();
        
        LeaderboardEntry[] storage leaderboard = competitionLeaderboards[competitionId];
        
        for (uint256 i = 0; i < leaderboard.length; i++) {
            if (leaderboard[i].participant == msg.sender) {
                if (leaderboard[i].claimed) revert AlreadyClaimed();
                
                uint256 reward = leaderboard[i].reward;
                if (reward == 0) revert NoRewardAvailable();
                
                leaderboard[i].claimed = true;
                totalAirdropDistributed += reward;
                totalRewardsClaimed[msg.sender] += reward;
                
                require(botToken.transfer(msg.sender, reward), "Transfer failed");
                
                emit RewardClaimed(msg.sender, reward, competitionId);
                return;
            }
        }
        
        revert NoRewardAvailable();
    }
    
    /**
     * @notice Creates a vesting schedule for a beneficiary
     * @param beneficiary Address to receive vested tokens
     * @param amount Total amount to vest
     * @param duration Vesting duration in seconds
     */
    function createVestingSchedule(
        address beneficiary,
        uint256 amount,
        uint256 duration
    ) external onlyRole(DISTRIBUTOR_ROLE) {
        require(beneficiary != address(0), "Invalid beneficiary");
        require(amount > 0, "Invalid amount");
        require(duration > 0, "Invalid duration");
        require(vestingSchedules[beneficiary].totalAmount == 0, "Schedule exists");
        
        vestingSchedules[beneficiary] = VestingSchedule({
            totalAmount: amount,
            startTime: block.timestamp,
            duration: duration,
            claimedAmount: 0,
            revoked: false
        });
        
        emit VestingScheduleCreated(beneficiary, amount, duration);
    }
    
    /**
     * @notice Claims vested tokens
     */
    function claimVested() external nonReentrant {
        VestingSchedule storage schedule = vestingSchedules[msg.sender];
        
        if (schedule.totalAmount == 0) revert NoVestingSchedule();
        if (schedule.revoked) revert NoVestingSchedule();
        if (block.timestamp < schedule.startTime) revert VestingNotStarted();
        
        uint256 vestedAmount = calculateVestedAmount(msg.sender);
        uint256 claimable = vestedAmount - schedule.claimedAmount;
        
        if (claimable == 0) revert NoRewardAvailable();
        
        schedule.claimedAmount += claimable;
        
        require(botToken.transfer(msg.sender, claimable), "Transfer failed");
        
        emit VestingClaimed(msg.sender, claimable);
    }
    
    /**
     * @notice Calculates vested amount for a beneficiary
     * @param beneficiary Address to check
     * @return amount Vested amount available
     */
    function calculateVestedAmount(address beneficiary) public view returns (uint256) {
        VestingSchedule memory schedule = vestingSchedules[beneficiary];
        
        if (schedule.totalAmount == 0 || schedule.revoked) {
            return 0;
        }
        
        if (block.timestamp < schedule.startTime) {
            return 0;
        }
        
        uint256 timeElapsed = block.timestamp - schedule.startTime;
        
        if (timeElapsed >= schedule.duration) {
            return schedule.totalAmount;
        }
        
        return (schedule.totalAmount * timeElapsed) / schedule.duration;
    }
    
    /**
     * @notice Revokes a vesting schedule
     * @param beneficiary Address whose vesting to revoke
     */
    function revokeVesting(address beneficiary) external onlyRole(DEFAULT_ADMIN_ROLE) {
        VestingSchedule storage schedule = vestingSchedules[beneficiary];
        
        require(schedule.totalAmount > 0, "No schedule");
        require(!schedule.revoked, "Already revoked");
        
        uint256 vestedAmount = calculateVestedAmount(beneficiary);
        uint256 unvested = schedule.totalAmount - vestedAmount;
        
        schedule.revoked = true;
        
        if (unvested > 0) {
            // Return unvested tokens to admin
            require(botToken.transfer(msg.sender, unvested), "Transfer failed");
        }
        
        emit VestingRevoked(beneficiary, unvested);
    }
    
    /**
     * @notice Gets leaderboard for a competition
     * @param competitionId ID of the competition
     * @return entries Array of leaderboard entries
     */
    function getLeaderboard(uint256 competitionId) 
        external 
        view 
        returns (LeaderboardEntry[] memory) 
    {
        return competitionLeaderboards[competitionId];
    }
    
    /**
     * @notice Gets distribution statistics
     */
    function getDistributionStats() external view returns (
        uint256 allocated,
        uint256 distributed,
        uint256 remaining,
        uint256 competitions
    ) {
        return (
            totalAirdropAllocated,
            totalAirdropDistributed,
            AIRDROP_ALLOCATION - totalAirdropAllocated,
            currentCompetitionId
        );
    }
    
    /**
     * @notice Emergency token recovery
     */
    function emergencyRecover(address token, uint256 amount) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        IERC20(token).transfer(msg.sender, amount);
    }
}