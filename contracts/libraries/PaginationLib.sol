// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title PaginationLib
 * @notice Library for handling paginated operations to avoid gas limit issues
 * @dev Prevents unbounded loops that could exceed block gas limit
 */
library PaginationLib {
    uint256 constant MAX_BATCH_SIZE = 100;
    
    struct PaginationState {
        uint256 currentIndex;
        uint256 totalProcessed;
        bool isComplete;
    }
    
    /**
     * @notice Process array in batches to avoid gas limits
     * @param totalLength Total length of array to process
     * @param batchSize Maximum items to process per transaction
     * @param startIndex Where to start processing
     * @return endIndex Where processing stopped
     * @return isComplete Whether all items were processed
     */
    function paginate(
        uint256 totalLength,
        uint256 batchSize,
        uint256 startIndex
    ) internal pure returns (uint256 endIndex, bool isComplete) {
        if (batchSize > MAX_BATCH_SIZE) {
            batchSize = MAX_BATCH_SIZE;
        }
        
        endIndex = startIndex + batchSize;
        if (endIndex >= totalLength) {
            endIndex = totalLength;
            isComplete = true;
        }
    }
    
    /**
     * @notice Calculate optimal batch size based on gas remaining
     * @dev Dynamically adjusts batch size to use available gas efficiently
     */
    function calculateOptimalBatchSize(
        uint256 gasPerItem,
        uint256 baseGas
    ) internal view returns (uint256) {
        uint256 gasRemaining = gasleft();
        if (gasRemaining <= baseGas) return 1;
        
        uint256 availableGas = gasRemaining - baseGas;
        uint256 batchSize = availableGas / gasPerItem;
        
        if (batchSize > MAX_BATCH_SIZE) {
            return MAX_BATCH_SIZE;
        }
        return batchSize == 0 ? 1 : batchSize;
    }
}

/**
 * @title MerkleDistributor
 * @notice Alternative to loops: Use merkle trees for large distributions
 * @dev Allows claiming individually without iterating all participants
 */
contract MerkleDistributor {
    bytes32 public merkleRoot;
    mapping(address => bool) public claimed;
    
    event Claimed(address indexed account, uint256 amount);
    
    constructor(bytes32 _merkleRoot) {
        merkleRoot = _merkleRoot;
    }
    
    /**
     * @notice Claim tokens using merkle proof
     * @dev O(log n) verification instead of O(n) iteration
     */
    function claim(
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external {
        require(!claimed[account], "Already claimed");
        
        // Verify merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(account, amount));
        require(verifyProof(merkleProof, merkleRoot, leaf), "Invalid proof");
        
        claimed[account] = true;
        
        // Transfer tokens (implement based on token type)
        emit Claimed(account, amount);
    }
    
    function verifyProof(
        bytes32[] memory proof,
        bytes32 root,
        bytes32 leaf
    ) internal pure returns (bool) {
        bytes32 computedHash = leaf;
        
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            
            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }
        
        return computedHash == root;
    }
}