// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@chainlink/contracts/src/v0.8/vrf/interfaces/VRFCoordinatorV2Interface.sol";

/**
 * @title MockVRFCoordinator
 * @notice Mock VRF Coordinator for testing
 */
contract MockVRFCoordinator is VRFCoordinatorV2Interface {
    uint256 private nextRequestId = 1;
    mapping(uint256 => address) private requestIdToConsumer;
    
    function getRequestConfig()
        external
        pure
        override
        returns (
            uint16,
            uint32,
            bytes32[] memory
        )
    {
        bytes32[] memory keyHashes = new bytes32[](1);
        keyHashes[0] = bytes32(0);
        return (3, 200000, keyHashes);
    }
    
    function requestRandomWords(
        bytes32,
        uint64,
        uint16,
        uint32,
        uint32 numWords
    ) external override returns (uint256 requestId) {
        requestId = nextRequestId++;
        requestIdToConsumer[requestId] = msg.sender;
        
        // For testing, immediately fulfill with pseudo-random values
        uint256[] memory randomWords = new uint256[](numWords);
        for (uint32 i = 0; i < numWords; i++) {
            randomWords[i] = uint256(keccak256(abi.encode(block.timestamp, requestId, i)));
        }
        
        // In a real mock, you might want to call fulfillRandomWords asynchronously
        // For simplicity, we'll just return the request ID
        return requestId;
    }
    
    function createSubscription() external pure override returns (uint64) {
        return 1;
    }
    
    function getSubscription(uint64)
        external
        pure
        override
        returns (
            uint96 balance,
            uint64 reqCount,
            address owner,
            address[] memory consumers
        )
    {
        address[] memory empty = new address[](0);
        return (1000000, 0, address(0), empty);
    }
    
    function requestSubscriptionOwnerTransfer(uint64, address) external pure override {
        // Mock implementation
    }
    
    function acceptSubscriptionOwnerTransfer(uint64) external pure override {
        // Mock implementation
    }
    
    function addConsumer(uint64, address) external pure override {
        // Mock implementation
    }
    
    function removeConsumer(uint64, address) external pure override {
        // Mock implementation
    }
    
    function cancelSubscription(uint64, address) external pure override {
        // Mock implementation
    }
    
    function pendingRequestExists(uint64) external pure override returns (bool) {
        return false;
    }
}