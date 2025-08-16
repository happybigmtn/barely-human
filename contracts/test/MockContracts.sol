// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "../game/ICrapsGame.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title TestVRFCoordinator
 * @notice Test Chainlink VRF Coordinator for testing
 */
contract TestVRFCoordinator {
    uint256 private nextRequestId = 1;
    mapping(uint256 => address) public requestIdToConsumer;
    
    function requestRandomWords(
        bytes32,
        uint64,
        uint16,
        uint32,
        uint32
    ) external returns (uint256 requestId) {
        requestId = nextRequestId++;
        requestIdToConsumer[requestId] = msg.sender;
        return requestId;
    }
    
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external {
        address consumer = requestIdToConsumer[requestId];
        (bool success,) = consumer.call(
            abi.encodeWithSignature("rawFulfillRandomWords(uint256,uint256[])", requestId, randomWords)
        );
        require(success, "Fulfillment failed");
    }
}

/**
 * @title MockCrapsVault
 * @notice Mock vault for testing settlement
 */
contract MockCrapsVault is ICrapsVault {
    IERC20 public asset;
    mapping(address => uint256) public balances;
    address[] public activeBotVaults;
    
    constructor(address _asset) {
        asset = IERC20(_asset);
        
        // Initialize with 10 bot vault addresses
        for (uint i = 0; i < 10; i++) {
            activeBotVaults.push(address(uint160(0x1000000000000000000000000000000000000001) + uint160(i)));
        }
    }
    
    function processBet(address player, uint256 amount) external override returns (bool) {
        // Mock implementation
        balances[player] -= amount;
        return true;
    }
    
    function processPayout(address player, uint256 amount) external override returns (bool) {
        // Mock implementation
        balances[player] += amount;
        return true;
    }
    
    function getPlayerBalance(address player) external view override returns (uint256) {
        return balances[player];
    }
    
    function getTotalLiquidity() external view override returns (uint256) {
        return asset.balanceOf(address(this));
    }
    
    function getActiveBotVaults() external view override returns (address[] memory) {
        return activeBotVaults;
    }
}

/**
 * @title MockCrapsBets
 * @notice Mock bets contract for testing
 */
contract MockCrapsBets is ICrapsBets {
    mapping(address => mapping(uint8 => Bet)) public bets;
    mapping(address => PlayerBets) public playerBets;
    
    function placeBet(uint8 betType, uint256 amount) external override {
        bets[msg.sender][betType] = Bet({
            amount: amount,
            betType: betType,
            point: 0,
            timestamp: block.timestamp,
            isActive: true
        });
        
        playerBets[msg.sender].totalAtRisk += amount;
        playerBets[msg.sender].activeBetCount++;
        playerBets[msg.sender].activeBetsBitmap |= uint64(1 << betType);
    }
    
    function placeOddsBet(uint8 baseBetType, uint256 oddsAmount) external override {
        // Mock implementation
        bets[msg.sender][baseBetType + 29].amount = oddsAmount; // Odds bets start at 29
    }
    
    function removeBet(uint8 betType) external override {
        Bet memory bet = bets[msg.sender][betType];
        if (bet.isActive) {
            playerBets[msg.sender].totalAtRisk -= bet.amount;
            playerBets[msg.sender].activeBetCount--;
            playerBets[msg.sender].activeBetsBitmap &= ~uint64(1 << betType);
            delete bets[msg.sender][betType];
        }
    }
    
    function clearBet(address player, uint8 betType) external override {
        Bet memory bet = bets[player][betType];
        if (bet.isActive) {
            playerBets[player].totalAtRisk -= bet.amount;
            playerBets[player].activeBetCount--;
            playerBets[player].activeBetsBitmap &= ~uint64(1 << betType);
            delete bets[player][betType];
        }
    }
    
    function getPlayerBets(address player) external view override returns (PlayerBets memory) {
        return playerBets[player];
    }
    
    function getBet(address player, uint8 betType) external view override returns (Bet memory) {
        return bets[player][betType];
    }
    
    function hasActiveBet(address player, uint8 betType) external view override returns (bool) {
        return bets[player][betType].isActive;
    }
    
    function getTotalAtRisk(address player) external view override returns (uint256) {
        return playerBets[player].totalAtRisk;
    }
}