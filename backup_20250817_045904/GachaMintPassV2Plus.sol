// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

/**
 * @title GachaMintPassV2Plus  
 * @notice NFT mint passes awarded through weighted raffle system
 * @dev Uses Chainlink VRF 2.5 for provably fair raffle selection
 */
contract GachaMintPassV2Plus is 
    ERC721, 
    VRFConsumerBaseV2Plus, 
    AccessControl, 
    ReentrancyGuard, 
    Pausable 
{
    
    // Roles
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    
    // Chainlink VRF 2.5 configuration
    uint256 private immutable subscriptionId;
    bytes32 private immutable keyHash;
    uint32 private constant CALLBACK_GAS_LIMIT = 200000;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1; // Single random word for raffle
    bool private constant NATIVE_PAYMENT = false; // Pay with LINK tokens
    
    // Raffle structures
    struct RaffleEntry {
        address participant;
        uint256 weight;      // Based on betting activity
        uint256 seriesId;    // Game series they participated in
        uint256 timestamp;   // When they entered
    }
    
    struct RaffleRound {
        uint256 id;
        uint256 startTime;
        uint256 endTime;
        uint256 totalWeight;
        address[] participants;
        mapping(address => uint256) participantWeights;
        bool isComplete;
        address winner;
        uint256 winningNumber;
        uint256 vrfRequestId;
    }
    
    // State variables
    mapping(uint256 => RaffleRound) public raffles;
    mapping(uint256 => uint256) public requestIdToRaffleId;
    mapping(uint256 => bool) public tokenExists;
    
    uint256 public currentRaffleId;
    uint256 public totalMintPasses;
    uint256 public maxPassesPerRaffle = 3;
    string public baseTokenURI;
    
    // Events
    event RaffleStarted(uint256 indexed raffleId, uint256 startTime);
    event RaffleEntryAdded(uint256 indexed raffleId, address indexed participant, uint256 weight);
    event RaffleCompleted(uint256 indexed raffleId, address indexed winner, uint256 winningNumber);
    event MintPassAwarded(uint256 indexed tokenId, address indexed winner, uint256 raffleId);
    event VRFRequested(uint256 indexed raffleId, uint256 requestId);
    
    /**
     * @dev Constructor initializes VRF 2.5 and NFT collection
     * @param _vrfCoordinator Chainlink VRF 2.5 coordinator address
     * @param _subscriptionId VRF subscription ID (uint256 in v2.5)  
     * @param _keyHash Gas lane key hash for VRF requests
     * @param _baseTokenURI Base URI for token metadata
     */
    constructor(
        address _vrfCoordinator,
        uint256 _subscriptionId,
        bytes32 _keyHash,
        string memory _baseTokenURI
    ) 
        ERC721("Barely Human Gacha Mint Pass", "BHGMP")
        VRFConsumerBaseV2Plus(_vrfCoordinator) 
    {
        require(_vrfCoordinator != address(0), "Invalid VRF coordinator");
        require(_subscriptionId != 0, "Invalid subscription ID");
        require(_keyHash != bytes32(0), "Invalid key hash");
        
        subscriptionId = _subscriptionId;
        keyHash = _keyHash;
        baseTokenURI = _baseTokenURI;
        
        // Setup roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }
    
    /**
     * @notice Start a new raffle round
     * @dev Only callable by operators
     * @return raffleId The new raffle ID
     */
    function startRaffle() external onlyRole(OPERATOR_ROLE) whenNotPaused returns (uint256 raffleId) {
        // Complete previous raffle if pending
        if (currentRaffleId > 0 && !raffles[currentRaffleId].isComplete) {
            require(block.timestamp >= raffles[currentRaffleId].endTime, "Previous raffle still active");
        }
        
        raffleId = ++currentRaffleId;
        
        RaffleRound storage raffle = raffles[raffleId];
        raffle.id = raffleId;
        raffle.startTime = block.timestamp;
        raffle.endTime = block.timestamp + 1 hours; // 1 hour raffle duration
        raffle.totalWeight = 0;
        raffle.isComplete = false;
        
        emit RaffleStarted(raffleId, block.timestamp);
        return raffleId;
    }
    
    /**
     * @notice Add participant to current raffle with weighted entry
     * @dev Called by game contracts when players participate
     * @param participant Address of the participant
     * @param weight Weight based on betting activity (higher = better odds)
     * @param seriesId Game series ID for tracking
     */
    function addRaffleEntry(
        address participant,
        uint256 weight,
        uint256 seriesId
    ) external onlyRole(GAME_ROLE) whenNotPaused {
        require(currentRaffleId > 0, "No active raffle");
        require(participant != address(0), "Invalid participant");
        require(weight > 0, "Weight must be positive");
        
        RaffleRound storage raffle = raffles[currentRaffleId];
        require(!raffle.isComplete, "Raffle already complete");
        require(block.timestamp < raffle.endTime, "Raffle ended");
        
        // Add or update participant weight
        if (raffle.participantWeights[participant] == 0) {
            raffle.participants.push(participant);
        }
        
        raffle.participantWeights[participant] += weight;
        raffle.totalWeight += weight;
        
        emit RaffleEntryAdded(currentRaffleId, participant, weight);
    }
    
    /**
     * @notice Complete the current raffle and select winner via VRF
     * @dev Requests randomness from Chainlink VRF 2.5
     * @return requestId VRF request ID
     */
    function completeRaffle() external onlyRole(OPERATOR_ROLE) whenNotPaused returns (uint256 requestId) {
        require(currentRaffleId > 0, "No raffle to complete");
        
        RaffleRound storage raffle = raffles[currentRaffleId];
        require(!raffle.isComplete, "Raffle already complete");
        require(block.timestamp >= raffle.endTime, "Raffle still active");
        require(raffle.participants.length > 0, "No participants");
        
        // Request randomness for winner selection
        requestId = s_vrfCoordinator.requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: keyHash,
                subId: subscriptionId,
                requestConfirmations: REQUEST_CONFIRMATIONS,
                callbackGasLimit: CALLBACK_GAS_LIMIT,
                numWords: NUM_WORDS,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: NATIVE_PAYMENT})
                )
            })
        );
        
        // Track request
        requestIdToRaffleId[requestId] = currentRaffleId;
        raffle.vrfRequestId = requestId;
        
        emit VRFRequested(currentRaffleId, requestId);
        return requestId;
    }
    
    /**
     * @notice VRF 2.5 callback function for raffle completion
     * @dev Called by VRF coordinator with randomness for winner selection
     * @param requestId The VRF request ID
     * @param randomWords Array of random numbers (calldata in v2.5)
     */
    function fulfillRandomWords(
        uint256 requestId,
        uint256[] calldata randomWords
    ) internal override {
        uint256 raffleId = requestIdToRaffleId[requestId];
        require(raffleId > 0, "Invalid raffle ID");
        require(randomWords.length >= 1, "Insufficient random words");
        
        RaffleRound storage raffle = raffles[raffleId];
        require(!raffle.isComplete, "Raffle already complete");
        require(raffle.totalWeight > 0, "No valid entries");
        
        // Select winner using weighted random selection
        uint256 winningNumber = randomWords[0] % raffle.totalWeight;
        address winner = _selectWinner(raffleId, winningNumber);
        
        // Complete raffle
        raffle.isComplete = true;
        raffle.winner = winner;
        raffle.winningNumber = winningNumber;
        
        // Mint NFT pass to winner
        _mintPassToWinner(winner, raffleId);
        
        emit RaffleCompleted(raffleId, winner, winningNumber);
    }
    
    /**
     * @dev Internal function to select winner based on weighted randomness
     */
    function _selectWinner(uint256 raffleId, uint256 winningNumber) internal view returns (address) {
        RaffleRound storage raffle = raffles[raffleId];
        uint256 currentWeight = 0;
        
        for (uint256 i = 0; i < raffle.participants.length; i++) {
            address participant = raffle.participants[i];
            uint256 participantWeight = raffle.participantWeights[participant];
            currentWeight += participantWeight;
            
            if (winningNumber < currentWeight) {
                return participant;
            }
        }
        
        // Fallback to last participant (should never reach here)
        return raffle.participants[raffle.participants.length - 1];
    }
    
    /**
     * @dev Internal function to mint NFT pass to raffle winner
     */
    function _mintPassToWinner(address winner, uint256 raffleId) internal {
        uint256 tokenId = totalMintPasses + 1;
        totalMintPasses++;
        
        _safeMint(winner, tokenId);
        tokenExists[tokenId] = true;
        
        emit MintPassAwarded(tokenId, winner, raffleId);
    }
    
    // View functions
    function getCurrentRaffle() external view returns (uint256) {
        return currentRaffleId;
    }
    
    function getRaffleInfo(uint256 raffleId) external view returns (
        uint256 id,
        uint256 startTime,
        uint256 endTime,
        uint256 totalWeight,
        uint256 participantCount,
        bool isComplete,
        address winner
    ) {
        RaffleRound storage raffle = raffles[raffleId];
        return (
            raffle.id,
            raffle.startTime,
            raffle.endTime,
            raffle.totalWeight,
            raffle.participants.length,
            raffle.isComplete,
            raffle.winner
        );
    }
    
    function getParticipantWeight(uint256 raffleId, address participant) external view returns (uint256) {
        return raffles[raffleId].participantWeights[participant];
    }
    
    function getRaffleParticipants(uint256 raffleId) external view returns (address[] memory) {
        return raffles[raffleId].participants;
    }
    
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(tokenExists[tokenId], "Token does not exist");
        return string(abi.encodePacked(baseTokenURI, _toString(tokenId)));
    }
    
    function totalSupply() external view returns (uint256) {
        return totalMintPasses;
    }
    
    // Admin functions
    function setBaseTokenURI(string memory newBaseURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        baseTokenURI = newBaseURI;
    }
    
    function setMaxPassesPerRaffle(uint256 newMax) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxPassesPerRaffle = newMax;
    }
    
    function grantGameRole(address gameContract) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(GAME_ROLE, gameContract);
    }
    
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    // Utility function
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
    
    // Required override for AccessControl
    function supportsInterface(bytes4 interfaceId) 
        public 
        view 
        virtual 
        override(ERC721, AccessControl) 
        returns (bool) 
    {
        return super.supportsInterface(interfaceId);
    }
}