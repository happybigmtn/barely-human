// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "./ICrapsGame.sol";
import "./CrapsBets.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CrapsBatchOperations
 * @notice Batch operations for gas-efficient multi-bet placement
 * @dev Reduces transaction overhead for multiple operations
 */
contract CrapsBatchOperations is ReentrancyGuard {
    ICrapsGame public immutable crapsGame;
    CrapsBets public immutable crapsBets;
    
    struct BatchBet {
        uint8 betType;
        uint256 amount;
        uint8 specificValue; // For specific bets like hardways
    }
    
    struct BatchResult {
        bool success;
        uint256 betId;
        string reason;
    }
    
    event BatchBetsPlaced(address indexed player, uint256 betsPlaced, uint256 totalAmount);
    event BatchSettled(uint256 gamesSettled, uint256 totalPayout);
    
    constructor(address _crapsGame, address _crapsBets) {
        crapsGame = ICrapsGame(_crapsGame);
        crapsBets = CrapsBets(_crapsBets);
    }
    
    /**
     * @notice Place multiple bets in a single transaction
     * @dev Saves ~21k gas per additional bet vs individual transactions
     */
    function placeBetsBatch(
        BatchBet[] calldata bets
    ) external nonReentrant returns (BatchResult[] memory results) {
        require(bets.length > 0 && bets.length <= 20, "Invalid batch size");
        
        results = new BatchResult[](bets.length);
        uint256 totalAmount;
        uint256 successCount;
        
        for (uint256 i = 0; i < bets.length; i++) {
            try crapsBets.placeBet(
                msg.sender,
                bets[i].betType,
                bets[i].amount,
                bets[i].specificValue
            ) returns (uint256 betId) {
                results[i] = BatchResult({
                    success: true,
                    betId: betId,
                    reason: ""
                });
                totalAmount += bets[i].amount;
                successCount++;
            } catch Error(string memory reason) {
                results[i] = BatchResult({
                    success: false,
                    betId: 0,
                    reason: reason
                });
            } catch {
                results[i] = BatchResult({
                    success: false,
                    betId: 0,
                    reason: "Unknown error"
                });
            }
        }
        
        if (successCount > 0) {
            emit BatchBetsPlaced(msg.sender, successCount, totalAmount);
        }
    }
    
    /**
     * @notice Settle multiple games in batch
     * @dev For operators to settle multiple completed games efficiently
     */
    function settleBatch(
        uint256[] calldata gameIds
    ) external nonReentrant returns (uint256 totalPayout) {
        require(gameIds.length > 0 && gameIds.length <= 10, "Invalid batch size");
        
        uint256 settledCount;
        
        for (uint256 i = 0; i < gameIds.length; i++) {
            try crapsBets.settleBets(gameIds[i]) returns (uint256 payout) {
                totalPayout += payout;
                settledCount++;
            } catch {
                // Skip failed settlements, continue with others
                continue;
            }
        }
        
        if (settledCount > 0) {
            emit BatchSettled(settledCount, totalPayout);
        }
    }
    
    /**
     * @notice Check multiple bet statuses in one call
     * @dev Read-only batch operation for UI updates
     */
    function getBetStatusBatch(
        uint256[] calldata betIds
    ) external view returns (
        bool[] memory active,
        bool[] memory won,
        uint256[] memory payouts
    ) {
        uint256 length = betIds.length;
        active = new bool[](length);
        won = new bool[](length);
        payouts = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            (active[i], won[i], payouts[i]) = crapsBets.getBetStatus(betIds[i]);
        }
    }
    
    /**
     * @notice Claim multiple winnings at once
     * @dev Batch claim for all winning bets
     */
    function claimWinningsBatch(
        uint256[] calldata betIds
    ) external nonReentrant returns (uint256 totalClaimed) {
        require(betIds.length > 0 && betIds.length <= 50, "Invalid batch size");
        
        for (uint256 i = 0; i < betIds.length; i++) {
            try crapsBets.claimWinnings(betIds[i]) returns (uint256 amount) {
                totalClaimed += amount;
            } catch {
                // Skip non-winning or already claimed bets
                continue;
            }
        }
        
        require(totalClaimed > 0, "No winnings to claim");
    }
}