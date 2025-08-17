// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./GachaMintPass.sol";
import "./BarelyHumanArt.sol";

/**
 * @title ArtRedemptionService
 * @notice Service contract for redeeming mint passes into generative art NFTs
 * @dev Integrates mint pass validation with off-chain art generation
 */
contract ArtRedemptionService is AccessControl, ReentrancyGuard, Pausable {
    
    // Roles
    bytes32 public constant GENERATOR_ROLE = keccak256("GENERATOR_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    // Contract References
    GachaMintPass public immutable mintPassContract;
    BarelyHumanArt public immutable artContract;
    
    // Generation Queue
    struct RedemptionRequest {
        uint256 mintPassId;
        address requester;
        uint256 requestedAt;
        bool fulfilled;
        uint256 artTokenId; // Set when fulfilled
    }
    
    mapping(uint256 => RedemptionRequest) public redemptionRequests; // requestId => Request
    mapping(uint256 => uint256) public mintPassToRequest; // mintPassId => requestId
    uint256 public nextRequestId = 1;
    
    // Generation Status
    enum GenerationStatus { Pending, Processing, Completed, Failed }
    mapping(uint256 => GenerationStatus) public requestStatus;
    
    // Queue Management
    uint256[] public pendingRequests;
    mapping(uint256 => uint256) public requestQueueIndex; // requestId => index in queue
    
    // Configuration
    uint256 public maxQueueSize = 100;
    uint256 public processingTimeLimit = 1 hours;
    
    // Events
    event RedemptionRequested(
        uint256 indexed requestId,
        uint256 indexed mintPassId, 
        address indexed requester
    );
    event RedemptionProcessing(uint256 indexed requestId);
    event RedemptionCompleted(
        uint256 indexed requestId,
        uint256 indexed mintPassId,
        uint256 indexed artTokenId
    );
    event RedemptionFailed(uint256 indexed requestId, string reason);
    event QueueCleared();
    
    // Errors
    error NotOwnerOfMintPass();
    error MintPassAlreadyRedeemed();
    error QueueFull();
    error RequestNotFound();
    error RequestAlreadyFulfilled();
    error GenerationFailed();
    error RequestExpired();
    error InvalidMintPass();
    error UnauthorizedGenerator();
    
    constructor(
        address _mintPassContract,
        address _artContract
    ) {
        mintPassContract = GachaMintPass(_mintPassContract);
        artContract = BarelyHumanArt(_artContract);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GENERATOR_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }
    
    /**
     * @notice Request redemption of a mint pass
     * @param mintPassId The mint pass token ID to redeem
     * @return requestId The redemption request ID
     */
    function requestRedemption(uint256 mintPassId) 
        external 
        nonReentrant 
        whenNotPaused 
        returns (uint256 requestId) 
    {
        // Verify ownership
        if (mintPassContract.ownerOf(mintPassId) != msg.sender) {
            revert NotOwnerOfMintPass();
        }
        
        // Verify not already redeemed
        GachaMintPass.MintPass memory mintPass = mintPassContract.getMintPassDetails(mintPassId);
        if (mintPass.redeemed) {
            revert MintPassAlreadyRedeemed();
        }
        
        // Check if already in queue
        if (mintPassToRequest[mintPassId] != 0) {
            return mintPassToRequest[mintPassId]; // Return existing request
        }
        
        // Check queue capacity
        if (pendingRequests.length >= maxQueueSize) {
            revert QueueFull();
        }
        
        requestId = nextRequestId++;
        
        // Create redemption request
        redemptionRequests[requestId] = RedemptionRequest({
            mintPassId: mintPassId,
            requester: msg.sender,
            requestedAt: block.timestamp,
            fulfilled: false,
            artTokenId: 0
        });
        
        mintPassToRequest[mintPassId] = requestId;
        requestStatus[requestId] = GenerationStatus.Pending;
        
        // Add to queue
        requestQueueIndex[requestId] = pendingRequests.length;
        pendingRequests.push(requestId);
        
        emit RedemptionRequested(requestId, mintPassId, msg.sender);
        
        return requestId;
    }
    
    /**
     * @notice Mark a request as being processed (generator role)
     * @param requestId The request to mark as processing
     */
    function markProcessing(uint256 requestId) external onlyRole(GENERATOR_ROLE) {
        if (redemptionRequests[requestId].requester == address(0)) {
            revert RequestNotFound();
        }
        if (redemptionRequests[requestId].fulfilled) {
            revert RequestAlreadyFulfilled();
        }
        
        requestStatus[requestId] = GenerationStatus.Processing;
        emit RedemptionProcessing(requestId);
    }
    
    /**
     * @notice Complete a redemption by minting the art NFT
     * @param requestId The redemption request ID
     * @param svgData The generated SVG artwork data
     * @param traits Array of artwork traits
     */
    function fulfillRedemption(
        uint256 requestId,
        string memory svgData,
        string[] memory traits
    ) external onlyRole(GENERATOR_ROLE) nonReentrant {
        RedemptionRequest storage request = redemptionRequests[requestId];
        
        if (request.requester == address(0)) {
            revert RequestNotFound();
        }
        if (request.fulfilled) {
            revert RequestAlreadyFulfilled();
        }
        
        // Check if request has expired
        if (block.timestamp > request.requestedAt + processingTimeLimit) {
            revert RequestExpired();
        }
        
        // Get mint pass details
        GachaMintPass.MintPass memory mintPass = mintPassContract.getMintPassDetails(request.mintPassId);
        
        // Mark mint pass as redeemed in the mint pass contract
        // Note: This should be done by the mint pass contract itself
        // For now, we trust that the generator role will handle this correctly
        
        // Mint the art NFT
        uint256 artTokenId = artContract.mintArtwork(
            request.requester,
            request.mintPassId,
            mintPass.seriesId,
            mintPass.vrfSeed,
            mintPass.rarity,
            mintPass.botId,
            svgData,
            traits
        );
        
        // Update request
        request.fulfilled = true;
        request.artTokenId = artTokenId;
        requestStatus[requestId] = GenerationStatus.Completed;
        
        // Remove from pending queue
        _removeFromQueue(requestId);
        
        emit RedemptionCompleted(requestId, request.mintPassId, artTokenId);
    }
    
    /**
     * @notice Mark a redemption as failed
     * @param requestId The redemption request ID
     * @param reason The failure reason
     */
    function markFailed(uint256 requestId, string memory reason) 
        external 
        onlyRole(GENERATOR_ROLE) 
    {
        RedemptionRequest storage request = redemptionRequests[requestId];
        
        if (request.requester == address(0)) {
            revert RequestNotFound();
        }
        if (request.fulfilled) {
            revert RequestAlreadyFulfilled();
        }
        
        requestStatus[requestId] = GenerationStatus.Failed;
        
        // Remove from pending queue
        _removeFromQueue(requestId);
        
        emit RedemptionFailed(requestId, reason);
    }
    
    /**
     * @notice Get the next pending request for processing
     * @return requestId The next request ID to process (0 if queue empty)
     */
    function getNextPendingRequest() external view returns (uint256 requestId) {
        if (pendingRequests.length == 0) {
            return 0;
        }
        return pendingRequests[0];
    }
    
    /**
     * @notice Get all pending requests
     * @return Array of pending request IDs
     */
    function getPendingRequests() external view returns (uint256[] memory) {
        return pendingRequests;
    }
    
    /**
     * @notice Get queue position for a request
     * @param requestId The request ID
     * @return position Queue position (0-based, 0 = next)
     */
    function getQueuePosition(uint256 requestId) external view returns (uint256 position) {
        if (requestStatus[requestId] != GenerationStatus.Pending) {
            return type(uint256).max; // Not in queue
        }
        return requestQueueIndex[requestId];
    }
    
    /**
     * @notice Remove a request from the pending queue
     */
    function _removeFromQueue(uint256 requestId) private {
        uint256 index = requestQueueIndex[requestId];
        uint256 lastIndex = pendingRequests.length - 1;
        
        if (index != lastIndex) {
            // Move last element to the position of the removed element
            uint256 lastRequestId = pendingRequests[lastIndex];
            pendingRequests[index] = lastRequestId;
            requestQueueIndex[lastRequestId] = index;
        }
        
        pendingRequests.pop();
        delete requestQueueIndex[requestId];
    }
    
    /**
     * @notice Clean up expired requests (operator function)
     */
    function cleanupExpiredRequests() external onlyRole(OPERATOR_ROLE) {
        uint256 currentTime = block.timestamp;
        uint256 i = 0;
        
        while (i < pendingRequests.length) {
            uint256 requestId = pendingRequests[i];
            RedemptionRequest storage request = redemptionRequests[requestId];
            
            if (currentTime > request.requestedAt + processingTimeLimit) {
                // Mark as failed and remove from queue
                requestStatus[requestId] = GenerationStatus.Failed;
                emit RedemptionFailed(requestId, "Request expired");
                
                _removeFromQueue(requestId);
                // Don't increment i since we removed an element
            } else {
                i++;
            }
        }
    }
    
    /**
     * @notice Emergency queue clear (admin only)
     */
    function clearQueue() external onlyRole(DEFAULT_ADMIN_ROLE) {
        delete pendingRequests;
        emit QueueCleared();
    }
    
    // Admin Functions
    
    function setMaxQueueSize(uint256 newSize) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxQueueSize = newSize;
    }
    
    function setProcessingTimeLimit(uint256 newLimit) external onlyRole(DEFAULT_ADMIN_ROLE) {
        processingTimeLimit = newLimit;
    }
    
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    // View Functions
    
    function getRedemptionDetails(uint256 requestId) 
        external 
        view 
        returns (RedemptionRequest memory request, GenerationStatus status) 
    {
        return (redemptionRequests[requestId], requestStatus[requestId]);
    }
    
    function getQueueLength() external view returns (uint256) {
        return pendingRequests.length;
    }
    
    function isQueueFull() external view returns (bool) {
        return pendingRequests.length >= maxQueueSize;
    }
}