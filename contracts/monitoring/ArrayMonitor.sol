// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ArrayMonitor
 * @notice Monitors and limits array growth to prevent unbounded expansion
 * @dev Integrates with CircuitBreaker for automatic protection
 */
contract ArrayMonitor is Ownable {
    // Array tracking
    struct ArrayMetrics {
        uint256 currentSize;
        uint256 maxSize;
        uint256 warningThreshold; // Percentage (e.g., 80 = 80%)
        uint256 growthRate;       // Items added per hour
        uint256 lastUpdate;
        bool isMonitored;
    }
    
    // Storage limits
    uint256 public constant ABSOLUTE_MAX_SIZE = 10000;
    uint256 public constant DEFAULT_WARNING_THRESHOLD = 80;
    uint256 public constant CRITICAL_GROWTH_RATE = 100; // per hour
    
    // Monitoring state
    mapping(string => ArrayMetrics) public arrayMetrics;
    mapping(address => mapping(string => uint256)) public contractArraySizes;
    
    // Alert levels
    enum AlertLevel {
        NORMAL,
        WARNING,
        CRITICAL,
        MAXIMUM
    }
    
    // Circuit breaker integration
    address public circuitBreaker;
    
    // Events
    event ArrayRegistered(string indexed arrayId, uint256 maxSize);
    event ArraySizeUpdated(string indexed arrayId, uint256 oldSize, uint256 newSize);
    event WarningThresholdReached(string indexed arrayId, uint256 size, uint256 threshold);
    event CriticalThresholdReached(string indexed arrayId, uint256 size);
    event GrowthRateExceeded(string indexed arrayId, uint256 rate);
    event ArrayPruned(string indexed arrayId, uint256 itemsRemoved);
    
    // Errors
    error ArraySizeLimitExceeded(string arrayId, uint256 size, uint256 maxSize);
    error GrowthRateTooHigh(string arrayId, uint256 rate);
    error ArrayNotRegistered(string arrayId);
    error InvalidConfiguration();
    
    constructor(address _circuitBreaker) Ownable(msg.sender) {
        circuitBreaker = _circuitBreaker;
    }
    
    /**
     * @notice Register an array for monitoring
     */
    function registerArray(
        string calldata arrayId,
        uint256 maxSize,
        uint256 warningThreshold
    ) external onlyOwner {
        require(maxSize > 0 && maxSize <= ABSOLUTE_MAX_SIZE, "Invalid max size");
        require(warningThreshold > 0 && warningThreshold <= 100, "Invalid threshold");
        
        arrayMetrics[arrayId] = ArrayMetrics({
            currentSize: 0,
            maxSize: maxSize,
            warningThreshold: warningThreshold,
            growthRate: 0,
            lastUpdate: block.timestamp,
            isMonitored: true
        });
        
        emit ArrayRegistered(arrayId, maxSize);
    }
    
    /**
     * @notice Check if array operation should be allowed
     */
    modifier checkArrayGrowth(string memory arrayId, uint256 itemsToAdd) {
        _validateArrayGrowth(arrayId, itemsToAdd);
        _;
        _updateArrayMetrics(arrayId, itemsToAdd);
    }
    
    /**
     * @notice Validate array growth before operation
     */
    function _validateArrayGrowth(string memory arrayId, uint256 itemsToAdd) private view {
        ArrayMetrics memory metrics = arrayMetrics[arrayId];
        
        if (!metrics.isMonitored) {
            revert ArrayNotRegistered(arrayId);
        }
        
        uint256 newSize = metrics.currentSize + itemsToAdd;
        
        // Check absolute limit
        if (newSize > metrics.maxSize) {
            revert ArraySizeLimitExceeded(arrayId, newSize, metrics.maxSize);
        }
        
        // Check growth rate
        uint256 timeElapsed = block.timestamp - metrics.lastUpdate;
        if (timeElapsed > 0) {
            uint256 hourlyRate = (itemsToAdd * 3600) / timeElapsed;
            if (hourlyRate > CRITICAL_GROWTH_RATE) {
                revert GrowthRateTooHigh(arrayId, hourlyRate);
            }
        }
    }
    
    /**
     * @notice Update array metrics after operation
     */
    function _updateArrayMetrics(string memory arrayId, uint256 itemsAdded) private {
        ArrayMetrics storage metrics = arrayMetrics[arrayId];
        
        uint256 oldSize = metrics.currentSize;
        metrics.currentSize += itemsAdded;
        
        // Update growth rate
        uint256 timeElapsed = block.timestamp - metrics.lastUpdate;
        if (timeElapsed > 0) {
            metrics.growthRate = (itemsAdded * 3600) / timeElapsed;
        }
        metrics.lastUpdate = block.timestamp;
        
        emit ArraySizeUpdated(arrayId, oldSize, metrics.currentSize);
        
        // Check thresholds and emit warnings
        _checkThresholds(arrayId, metrics);
    }
    
    /**
     * @notice Check thresholds and trigger alerts
     */
    function _checkThresholds(string memory arrayId, ArrayMetrics memory metrics) private {
        uint256 percentUsed = (metrics.currentSize * 100) / metrics.maxSize;
        
        if (percentUsed >= 95) {
            emit CriticalThresholdReached(arrayId, metrics.currentSize);
            _triggerCircuitBreaker(arrayId, AlertLevel.CRITICAL);
        } else if (percentUsed >= metrics.warningThreshold) {
            emit WarningThresholdReached(
                arrayId, 
                metrics.currentSize, 
                metrics.warningThreshold
            );
        }
        
        if (metrics.growthRate > CRITICAL_GROWTH_RATE) {
            emit GrowthRateExceeded(arrayId, metrics.growthRate);
            _triggerCircuitBreaker(arrayId, AlertLevel.WARNING);
        }
    }
    
    /**
     * @notice Trigger circuit breaker if configured
     */
    function _triggerCircuitBreaker(string memory arrayId, AlertLevel level) private {
        if (circuitBreaker != address(0)) {
            // Call circuit breaker to restrict operations
            (bool success,) = circuitBreaker.call(
                abi.encodeWithSignature(
                    "checkThreshold(string,uint256)",
                    arrayId,
                    uint256(level)
                )
            );
            // Continue even if circuit breaker call fails
            if (!success) {
                // Log but don't revert
            }
        }
    }
    
    /**
     * @notice Update array size (for external tracking)
     */
    function updateArraySize(
        string calldata arrayId,
        uint256 newSize
    ) external {
        ArrayMetrics storage metrics = arrayMetrics[arrayId];
        require(metrics.isMonitored, "Array not registered");
        
        uint256 oldSize = metrics.currentSize;
        
        if (newSize > metrics.maxSize) {
            revert ArraySizeLimitExceeded(arrayId, newSize, metrics.maxSize);
        }
        
        metrics.currentSize = newSize;
        metrics.lastUpdate = block.timestamp;
        
        emit ArraySizeUpdated(arrayId, oldSize, newSize);
        _checkThresholds(arrayId, metrics);
    }
    
    /**
     * @notice Get alert level for an array
     */
    function getAlertLevel(string calldata arrayId) external view returns (AlertLevel) {
        ArrayMetrics memory metrics = arrayMetrics[arrayId];
        
        if (!metrics.isMonitored) return AlertLevel.NORMAL;
        
        uint256 percentUsed = (metrics.currentSize * 100) / metrics.maxSize;
        
        if (percentUsed >= 100) return AlertLevel.MAXIMUM;
        if (percentUsed >= 95) return AlertLevel.CRITICAL;
        if (percentUsed >= metrics.warningThreshold) return AlertLevel.WARNING;
        
        return AlertLevel.NORMAL;
    }
    
    /**
     * @notice Get monitoring status for multiple arrays
     */
    function getMonitoringStatus(string[] calldata arrayIds) 
        external 
        view 
        returns (
            uint256[] memory sizes,
            uint256[] memory maxSizes,
            AlertLevel[] memory levels
        ) 
    {
        uint256 length = arrayIds.length;
        sizes = new uint256[](length);
        maxSizes = new uint256[](length);
        levels = new AlertLevel[](length);
        
        for (uint256 i = 0; i < length; i++) {
            ArrayMetrics memory metrics = arrayMetrics[arrayIds[i]];
            sizes[i] = metrics.currentSize;
            maxSizes[i] = metrics.maxSize;
            
            uint256 percentUsed = metrics.maxSize > 0 
                ? (metrics.currentSize * 100) / metrics.maxSize 
                : 0;
                
            if (percentUsed >= 100) levels[i] = AlertLevel.MAXIMUM;
            else if (percentUsed >= 95) levels[i] = AlertLevel.CRITICAL;
            else if (percentUsed >= metrics.warningThreshold) levels[i] = AlertLevel.WARNING;
            else levels[i] = AlertLevel.NORMAL;
        }
    }
    
    /**
     * @notice Prune array (remove old items)
     */
    function pruneArray(
        string calldata arrayId,
        uint256 itemsToRemove
    ) external onlyOwner {
        ArrayMetrics storage metrics = arrayMetrics[arrayId];
        require(metrics.isMonitored, "Array not registered");
        
        if (itemsToRemove > metrics.currentSize) {
            itemsToRemove = metrics.currentSize;
        }
        
        metrics.currentSize -= itemsToRemove;
        metrics.lastUpdate = block.timestamp;
        
        emit ArrayPruned(arrayId, itemsToRemove);
    }
    
    /**
     * @notice Update configuration
     */
    function updateArrayConfig(
        string calldata arrayId,
        uint256 maxSize,
        uint256 warningThreshold
    ) external onlyOwner {
        ArrayMetrics storage metrics = arrayMetrics[arrayId];
        require(metrics.isMonitored, "Array not registered");
        require(maxSize <= ABSOLUTE_MAX_SIZE, "Exceeds absolute max");
        require(warningThreshold <= 100, "Invalid threshold");
        
        metrics.maxSize = maxSize;
        metrics.warningThreshold = warningThreshold;
    }
    
    /**
     * @notice Emergency reset for an array
     */
    function emergencyReset(string calldata arrayId) external onlyOwner {
        ArrayMetrics storage metrics = arrayMetrics[arrayId];
        metrics.currentSize = 0;
        metrics.growthRate = 0;
        metrics.lastUpdate = block.timestamp;
        
        emit ArraySizeUpdated(arrayId, metrics.currentSize, 0);
    }
}