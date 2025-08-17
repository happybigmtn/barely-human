// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./ICrapsGame.sol";

/**
 * @title CrapsSettlementSimple
 * @notice Simplified settlement for deployment - only core functionality
 * @dev Extremely minimal to fit under size limit
 */
contract CrapsSettlementSimple is AccessControl {
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");

    ICrapsGame public gameContract;
    uint8 public lastTotal;

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function setContracts(address _game) external onlyRole(DEFAULT_ADMIN_ROLE) {
        gameContract = ICrapsGame(_game);
        _grantRole(GAME_ROLE, _game);
    }

    function settleRoll(uint8 die1, uint8 die2) external onlyRole(GAME_ROLE) returns (uint256) {
        lastTotal = die1 + die2;
        // Minimal implementation - just return a value for now
        // Full logic would be implemented off-chain or in separate contracts
        return 0;
    }

    function settleSeries(uint256) external view onlyRole(GAME_ROLE) returns (uint256) {
        return 0;
    }

    function getPayoutMultiplier(uint8, uint8) external pure returns (uint256) {
        return 100; // 1:1 default
    }

    function isWinningBet(uint8 betType, uint8 rollTotal, uint8 point) external pure returns (bool) {
        // Simplified logic for Pass Line only
        if (betType == 0) { // Pass Line
            if (point == 0) { // Come out roll
                return rollTotal == 7 || rollTotal == 11;
            } else { // Point phase
                return rollTotal == point;
            }
        }
        return false;
    }

    function getSettlementDetails(
        uint8 betType,
        uint256 amount,
        uint8 rollTotal,
        uint8 point
    ) external pure returns (uint256 payout, bool won, bool pushed) {
        // Simplified for Pass Line
        if (betType == 0) {
            if (point == 0) {
                if (rollTotal == 7 || rollTotal == 11) {
                    return (amount * 2, true, false);
                }
                if (rollTotal == 2 || rollTotal == 3 || rollTotal == 12) {
                    return (0, false, false);
                }
            } else {
                if (rollTotal == point) {
                    return (amount * 2, true, false);
                }
                if (rollTotal == 7) {
                    return (0, false, false);
                }
            }
            return (amount, false, true); // Push
        }
        return (0, false, false);
    }
}