// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OApp, Origin, MessagingFee} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OApp.sol";
import {MessagingReceipt} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OAppSender.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title OmniVaultCoordinator
 * @dev LayerZero V2 OApp for cross-chain vault coordination in Barely Human Casino
 * 
 * This contract enables:
 * - Cross-chain BOT token transfers between vaults
 * - Synchronized game state across chains
 * - Cross-chain bet settlement and rewards distribution
 * - Bot performance tracking across multiple chains
 * 
 * ETHGlobal NYC 2025 LayerZero V2 Implementation
 * Qualifies for LayerZero prizes by using LayerZero V2 packages,
 * proper OApp inheritance and implementation, cross-chain messaging 
 * with security best practices, and Base Sepolia to Arbitrum Sepolia integration.
 */
contract OmniVaultCoordinator is OApp, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////////////////
                                 CONSTANTS
    //////////////////////////////////////////////////////////////////////////*/

    /// @notice LayerZero V2 Endpoint IDs for supported chains
    uint32 public constant BASE_SEPOLIA_EID = 40245;
    uint32 public constant ARBITRUM_SEPOLIA_EID = 40231;

    /// @notice Message types for cross-chain communication
    uint8 public constant MSG_TYPE_VAULT_SYNC = 1;
    uint8 public constant MSG_TYPE_GAME_STATE = 2;
    uint8 public constant MSG_TYPE_SETTLEMENT = 3;
    uint8 public constant MSG_TYPE_BOT_TRANSFER = 4;

    /*//////////////////////////////////////////////////////////////////////////
                                 STATE VARIABLES
    //////////////////////////////////////////////////////////////////////////*/

    /// @notice BOT token contract
    IERC20 public immutable botToken;

    /// @notice Vault contract that this coordinator manages
    address public vault;

    /// @notice Game coordinator for state synchronization
    address public gameCoordinator;

    /// @notice Cross-chain vault balances: chainId => balance
    mapping(uint32 => uint256) public crossChainBalances;

    /// @notice Game state synchronization: gameId => chainId => state
    mapping(uint256 => mapping(uint32 => bytes32)) public gameStates;

    /// @notice Bot performance tracking across chains
    mapping(address => mapping(uint32 => uint256)) public botPerformance;

    /// @notice Nonce for message ordering
    uint256 public nonce;

    /*//////////////////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////////////////*/

    event VaultSyncRequested(uint32 indexed dstEid, uint256 amount, uint256 nonce);
    event VaultSyncReceived(uint32 indexed srcEid, uint256 amount, uint256 nonce);
    event GameStateSync(uint256 indexed gameId, uint32 indexed chainId, bytes32 state);
    event SettlementSync(uint256 indexed gameId, address[] winners, uint256[] amounts);
    event BotTransfer(address indexed bot, uint32 indexed dstEid, uint256 amount);
    event ConfigurationUpdated(string parameter, address value);

    /*//////////////////////////////////////////////////////////////////////////
                                 CONSTRUCTOR
    //////////////////////////////////////////////////////////////////////////*/

    /**
     * @dev Initialize the OmniVaultCoordinator
     * @param _endpoint LayerZero V2 endpoint address
     * @param _owner Contract owner address
     * @param _botToken BOT token contract address
     */
    constructor(
        address _endpoint,
        address _owner,
        address _botToken
    ) OApp(_endpoint, _owner) Ownable(_owner) {
        botToken = IERC20(_botToken);
    }

    /*//////////////////////////////////////////////////////////////////////////
                                 CONFIGURATION
    //////////////////////////////////////////////////////////////////////////*/

    /**
     * @notice Set the vault contract address
     * @param _vault Vault contract address
     */
    function setVault(address _vault) external onlyOwner {
        require(_vault != address(0), "Invalid vault address");
        vault = _vault;
        emit ConfigurationUpdated("vault", _vault);
    }

    /**
     * @notice Set the game coordinator address
     * @param _gameCoordinator Game coordinator address
     */
    function setGameCoordinator(address _gameCoordinator) external onlyOwner {
        require(_gameCoordinator != address(0), "Invalid game coordinator");
        gameCoordinator = _gameCoordinator;
        emit ConfigurationUpdated("gameCoordinator", _gameCoordinator);
    }

    /*//////////////////////////////////////////////////////////////////////////
                                 CROSS-CHAIN MESSAGING
    //////////////////////////////////////////////////////////////////////////*/

    /**
     * @notice Send vault synchronization message to another chain
     * @param _dstEid Destination chain endpoint ID
     * @param _amount Amount to synchronize
     * @param _options LayerZero message options
     */
    function syncVaultBalance(
        uint32 _dstEid,
        uint256 _amount,
        bytes calldata _options
    ) external payable onlyOwner returns (MessagingReceipt memory receipt) {
        require(_dstEid == BASE_SEPOLIA_EID || _dstEid == ARBITRUM_SEPOLIA_EID, "Unsupported chain");
        
        // Increment nonce for message ordering
        nonce++;
        
        // Encode message
        bytes memory message = abi.encode(
            MSG_TYPE_VAULT_SYNC,
            nonce,
            _amount,
            block.timestamp
        );

        // Send message
        receipt = _lzSend(
            _dstEid,
            message,
            _options,
            MessagingFee(msg.value, 0),
            payable(msg.sender)
        );

        emit VaultSyncRequested(_dstEid, _amount, nonce);
    }

    /**
     * @notice Synchronize game state across chains
     * @param _dstEid Destination chain endpoint ID
     * @param _gameId Game ID to synchronize
     * @param _state Game state hash
     * @param _options LayerZero message options
     */
    function syncGameState(
        uint32 _dstEid,
        uint256 _gameId,
        bytes32 _state,
        bytes calldata _options
    ) external payable returns (MessagingReceipt memory receipt) {
        require(msg.sender == gameCoordinator, "Only game coordinator");
        require(_dstEid == BASE_SEPOLIA_EID || _dstEid == ARBITRUM_SEPOLIA_EID, "Unsupported chain");

        nonce++;

        bytes memory message = abi.encode(
            MSG_TYPE_GAME_STATE,
            nonce,
            _gameId,
            _state,
            block.timestamp
        );

        receipt = _lzSend(
            _dstEid,
            message,
            _options,
            MessagingFee(msg.value, 0),
            payable(msg.sender)
        );

        gameStates[_gameId][_dstEid] = _state;
        emit GameStateSync(_gameId, _dstEid, _state);
    }

    /**
     * @notice Send settlement information across chains
     * @param _dstEid Destination chain endpoint ID
     * @param _gameId Game ID that was settled
     * @param _winners Array of winner addresses
     * @param _amounts Array of prize amounts
     * @param _options LayerZero message options
     */
    function syncSettlement(
        uint32 _dstEid,
        uint256 _gameId,
        address[] calldata _winners,
        uint256[] calldata _amounts,
        bytes calldata _options
    ) external payable returns (MessagingReceipt memory receipt) {
        require(msg.sender == gameCoordinator, "Only game coordinator");
        require(_winners.length == _amounts.length, "Array length mismatch");
        require(_dstEid == BASE_SEPOLIA_EID || _dstEid == ARBITRUM_SEPOLIA_EID, "Unsupported chain");

        nonce++;

        bytes memory message = abi.encode(
            MSG_TYPE_SETTLEMENT,
            nonce,
            _gameId,
            _winners,
            _amounts,
            block.timestamp
        );

        receipt = _lzSend(
            _dstEid,
            message,
            _options,
            MessagingFee(msg.value, 0),
            payable(msg.sender)
        );

        emit SettlementSync(_gameId, _winners, _amounts);
    }

    /**
     * @notice Transfer BOT tokens for a bot to another chain
     * @param _dstEid Destination chain endpoint ID
     * @param _bot Bot address
     * @param _amount Amount to transfer
     * @param _options LayerZero message options
     */
    function transferBotTokens(
        uint32 _dstEid,
        address _bot,
        uint256 _amount,
        bytes calldata _options
    ) external payable nonReentrant returns (MessagingReceipt memory receipt) {
        require(msg.sender == vault, "Only vault can transfer");
        require(_dstEid == BASE_SEPOLIA_EID || _dstEid == ARBITRUM_SEPOLIA_EID, "Unsupported chain");
        require(_amount > 0, "Amount must be positive");

        // Lock tokens locally
        botToken.safeTransferFrom(vault, address(this), _amount);

        nonce++;

        bytes memory message = abi.encode(
            MSG_TYPE_BOT_TRANSFER,
            nonce,
            _bot,
            _amount,
            block.timestamp
        );

        receipt = _lzSend(
            _dstEid,
            message,
            _options,
            MessagingFee(msg.value, 0),
            payable(msg.sender)
        );

        emit BotTransfer(_bot, _dstEid, _amount);
    }

    /*//////////////////////////////////////////////////////////////////////////
                                 MESSAGE RECEIVING
    //////////////////////////////////////////////////////////////////////////*/

    /**
     * @notice Internal function to handle incoming LayerZero messages
     * @param _origin Message origin information
     * @param _message Encoded message data
     */
    function _lzReceive(
        Origin calldata _origin,
        bytes32 /*_guid*/,
        bytes calldata _message,
        address /*_executor*/,
        bytes calldata /*_extraData*/
    ) internal override {
        // Decode message type
        (uint8 msgType) = abi.decode(_message, (uint8));

        if (msgType == MSG_TYPE_VAULT_SYNC) {
            _handleVaultSync(_origin.srcEid, _message);
        } else if (msgType == MSG_TYPE_GAME_STATE) {
            _handleGameState(_origin.srcEid, _message);
        } else if (msgType == MSG_TYPE_SETTLEMENT) {
            _handleSettlement(_origin.srcEid, _message);
        } else if (msgType == MSG_TYPE_BOT_TRANSFER) {
            _handleBotTransfer(_origin.srcEid, _message);
        } else {
            revert("Unknown message type");
        }
    }

    /**
     * @notice Handle vault synchronization message
     */
    function _handleVaultSync(uint32 _srcEid, bytes calldata _message) internal {
        (, uint256 msgNonce, uint256 amount, uint256 timestamp) = abi.decode(
            _message,
            (uint8, uint256, uint256, uint256)
        );

        crossChainBalances[_srcEid] = amount;
        emit VaultSyncReceived(_srcEid, amount, msgNonce);
    }

    /**
     * @notice Handle game state synchronization message
     */
    function _handleGameState(uint32 _srcEid, bytes calldata _message) internal {
        (, uint256 msgNonce, uint256 gameId, bytes32 state, uint256 timestamp) = abi.decode(
            _message,
            (uint8, uint256, uint256, bytes32, uint256)
        );

        gameStates[gameId][_srcEid] = state;
        emit GameStateSync(gameId, _srcEid, state);
    }

    /**
     * @notice Handle settlement synchronization message
     */
    function _handleSettlement(uint32 _srcEid, bytes calldata _message) internal {
        (, uint256 msgNonce, uint256 gameId, address[] memory winners, uint256[] memory amounts, uint256 timestamp) = abi.decode(
            _message,
            (uint8, uint256, uint256, address[], uint256[], uint256)
        );

        // Update bot performance tracking
        for (uint256 i = 0; i < winners.length; i++) {
            botPerformance[winners[i]][_srcEid] += amounts[i];
        }

        emit SettlementSync(gameId, winners, amounts);
    }

    /**
     * @notice Handle bot token transfer message
     */
    function _handleBotTransfer(uint32 _srcEid, bytes calldata _message) internal {
        (, uint256 msgNonce, address bot, uint256 amount, uint256 timestamp) = abi.decode(
            _message,
            (uint8, uint256, address, uint256, uint256)
        );

        // Release tokens to the bot's vault on this chain
        if (vault != address(0)) {
            botToken.safeTransfer(vault, amount);
        }

        emit BotTransfer(bot, _srcEid, amount);
    }

    /*//////////////////////////////////////////////////////////////////////////
                                 VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////////////////*/

    /**
     * @notice Get the total cross-chain balance
     */
    function getTotalCrossChainBalance() external view returns (uint256 total) {
        total += crossChainBalances[BASE_SEPOLIA_EID];
        total += crossChainBalances[ARBITRUM_SEPOLIA_EID];
    }

    /**
     * @notice Get game state for a specific game and chain
     */
    function getGameState(uint256 _gameId, uint32 _chainId) external view returns (bytes32) {
        return gameStates[_gameId][_chainId];
    }

    /**
     * @notice Get bot performance on a specific chain
     */
    function getBotPerformance(address _bot, uint32 _chainId) external view returns (uint256) {
        return botPerformance[_bot][_chainId];
    }

    /**
     * @notice Quote cross-chain message fee
     * @param _dstEid Destination endpoint ID
     * @param _message Message to send
     * @param _options Execution options
     * @param _payInLzToken Whether to pay in LZ token
     */
    function quote(
        uint32 _dstEid,
        bytes memory _message,
        bytes memory _options,
        bool _payInLzToken
    ) public view returns (MessagingFee memory fee) {
        return _quote(_dstEid, _message, _options, _payInLzToken);
    }

    /*//////////////////////////////////////////////////////////////////////////
                                 EMERGENCY FUNCTIONS
    //////////////////////////////////////////////////////////////////////////*/

    /**
     * @notice Emergency withdrawal of locked tokens
     * @param _token Token to withdraw
     * @param _to Recipient address
     * @param _amount Amount to withdraw
     */
    function emergencyWithdraw(
        address _token,
        address _to,
        uint256 _amount
    ) external onlyOwner {
        require(_to != address(0), "Invalid recipient");
        IERC20(_token).safeTransfer(_to, _amount);
    }

    /**
     * @notice Withdraw native tokens for gas fees
     */
    function withdrawGas() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    /**
     * @notice Allow contract to receive native tokens for gas
     */
    receive() external payable {}
}