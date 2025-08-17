// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

/**
 * @title MockVRFCoordinatorV2Plus
 * @notice Mock VRF Coordinator V2+ for testing VRF 2.5 integration
 * @dev Simulates the VRF 2.5 coordinator for testing purposes
 */
contract MockVRFCoordinatorV2Plus {
    using VRFV2PlusClient for VRFV2PlusClient.RandomWordsRequest;
    
    uint256 private nextRequestId = 1;
    mapping(uint256 => address) private requestIdToConsumer;
    mapping(uint256 => VRFV2PlusClient.RandomWordsRequest) private requests;
    mapping(uint256 => bool) private subscriptionExists;
    mapping(uint256 => mapping(address => bool)) private subscriptionConsumers;
    
    // Events
    event RandomWordsRequested(
        bytes32 indexed keyHash,
        uint256 requestId,
        uint256 indexed subId,
        uint16 minimumRequestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords,
        bytes extraArgs,
        address indexed sender
    );
    
    event RandomWordsFulfilled(
        uint256 indexed requestId,
        address indexed consumer,
        uint256[] randomWords
    );
    
    event SubscriptionCreated(uint256 indexed subId, address owner);
    event ConsumerAdded(uint256 indexed subId, address consumer);
    
    // Constructor
    constructor() {
        // Create default subscription for testing
        subscriptionExists[1] = true;
    }
    
    /**
     * @notice Request random words (VRF 2.5 interface)
     * @param req The RandomWordsRequest struct containing request parameters
     * @return requestId The ID of the VRF request
     */
    function requestRandomWords(
        VRFV2PlusClient.RandomWordsRequest calldata req
    ) external returns (uint256 requestId) {
        require(subscriptionExists[req.subId], "Subscription does not exist");
        require(subscriptionConsumers[req.subId][msg.sender], "Consumer not authorized");
        
        requestId = nextRequestId++;
        requestIdToConsumer[requestId] = msg.sender;
        requests[requestId] = req;
        
        emit RandomWordsRequested(
            req.keyHash,
            requestId,
            req.subId,
            req.requestConfirmations,
            req.callbackGasLimit,
            req.numWords,
            req.extraArgs,
            msg.sender
        );
        
        return requestId;
    }
    
    /**
     * @notice Manually fulfill a VRF request for testing
     * @param requestId The request ID to fulfill
     * @param randomWords Array of random numbers to return
     */
    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external {
        address consumer = requestIdToConsumer[requestId];
        require(consumer != address(0), "Request not found");
        require(randomWords.length == requests[requestId].numWords, "Wrong number of random words");
        
        // Call the consumer's rawFulfillRandomWords function (VRF 2.5 pattern)
        (bool success, ) = consumer.call(
            abi.encodeWithSignature(
                "rawFulfillRandomWords(uint256,uint256[])",
                requestId,
                randomWords
            )
        );
        require(success, "Failed to fulfill random words");
        
        emit RandomWordsFulfilled(requestId, consumer, randomWords);
        
        // Clean up
        delete requestIdToConsumer[requestId];
        delete requests[requestId];
    }
    
    /**
     * @notice Auto-fulfill a request with pseudo-random values
     * @param requestId The request ID to auto-fulfill
     */
    function autoFulfillRequest(uint256 requestId) external {
        address consumer = requestIdToConsumer[requestId];
        require(consumer != address(0), "Request not found");
        
        VRFV2PlusClient.RandomWordsRequest memory req = requests[requestId];
        uint256[] memory randomWords = new uint256[](req.numWords);
        
        // Generate pseudo-random values based on block data
        for (uint32 i = 0; i < req.numWords; i++) {
            randomWords[i] = uint256(
                keccak256(abi.encode(block.timestamp, block.difficulty, requestId, i, msg.sender))
            );
        }
        
        this.fulfillRandomWords(requestId, randomWords);
    }
    
    /**
     * @notice Create a new subscription
     * @return subId The subscription ID
     */
    function createSubscription() external returns (uint256 subId) {
        subId = nextRequestId++; // Reuse the counter for simplicity
        subscriptionExists[subId] = true;
        
        emit SubscriptionCreated(subId, msg.sender);
        return subId;
    }
    
    /**
     * @notice Add a consumer to a subscription
     * @param subId The subscription ID
     * @param consumer The consumer address to add
     */
    function addConsumer(uint256 subId, address consumer) external {
        require(subscriptionExists[subId], "Subscription does not exist");
        subscriptionConsumers[subId][consumer] = true;
        
        emit ConsumerAdded(subId, consumer);
    }
    
    /**
     * @notice Check if a consumer is authorized for a subscription
     * @param subId The subscription ID
     * @param consumer The consumer address
     * @return authorized True if consumer is authorized
     */
    function consumerIsAdded(uint256 subId, address consumer) external view returns (bool) {
        return subscriptionConsumers[subId][consumer];
    }
    
    /**
     * @notice Get subscription details
     * @param subId The subscription ID
     * @return balance The LINK balance (mocked)
     * @return nativeBalance The native token balance (mocked)
     * @return reqCount The number of requests made
     * @return owner The subscription owner
     * @return consumers Array of consumer addresses
     */
    function getSubscription(uint256 subId)
        external
        view
        returns (
            uint96 balance,
            uint96 nativeBalance,
            uint64 reqCount,
            address owner,
            address[] memory consumers
        )
    {
        require(subscriptionExists[subId], "Subscription does not exist");
        
        // Return mocked values
        balance = 1000 ether; // 1000 LINK
        nativeBalance = 10 ether; // 10 ETH  
        reqCount = 0;
        owner = address(this);
        consumers = new address[](0); // Empty for simplicity
    }
    
    /**
     * @notice Generate dice roll values for testing
     * @param requestId The request ID
     * @param seed Custom seed for deterministic testing
     */
    function fulfillDiceRoll(uint256 requestId, uint256 seed) external {
        // Generate two dice values (1-6) 
        uint256 die1 = (uint256(keccak256(abi.encode(seed, "die1"))) % 6) + 1;
        uint256 die2 = (uint256(keccak256(abi.encode(seed, "die2"))) % 6) + 1;
        
        uint256[] memory randomWords = new uint256[](2);
        randomWords[0] = die1 - 1; // Convert to 0-5 range that contract expects
        randomWords[1] = die2 - 1;
        
        this.fulfillRandomWords(requestId, randomWords);
    }
    
    /**
     * @notice Generate specific dice values for testing scenarios
     * @param requestId The request ID
     * @param die1Value First die value (1-6)
     * @param die2Value Second die value (1-6)
     */
    function fulfillSpecificDice(uint256 requestId, uint8 die1Value, uint8 die2Value) external {
        require(die1Value >= 1 && die1Value <= 6, "Invalid die1 value");
        require(die2Value >= 1 && die2Value <= 6, "Invalid die2 value");
        
        uint256[] memory randomWords = new uint256[](2);
        randomWords[0] = die1Value - 1; // Convert to 0-5 range that contract expects
        randomWords[1] = die2Value - 1;
        
        this.fulfillRandomWords(requestId, randomWords);
    }
    
    /**
     * @notice Get pending request details for debugging
     * @param requestId The request ID
     * @return consumer The consumer address
     * @return numWords Number of words requested
     */
    function getRequestDetails(uint256 requestId) 
        external 
        view 
        returns (address consumer, uint32 numWords) 
    {
        return (requestIdToConsumer[requestId], requests[requestId].numWords);
    }
}