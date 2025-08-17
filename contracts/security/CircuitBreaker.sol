// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title CircuitBreaker
 * @notice Emergency stop mechanism with granular control and rate limiting
 * @dev Prevents cascading failures and enables rapid incident response
 */
contract CircuitBreaker is AccessControl, Pausable {
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    // Circuit breaker states
    enum CircuitState {
        NORMAL,      // All operations allowed
        RESTRICTED,  // Limited operations only
        PAUSED,      // No operations except emergency
        EMERGENCY    // Emergency withdrawals only
    }
    
    // Rate limiting
    struct RateLimit {
        uint256 limit;        // Maximum operations per window
        uint256 window;       // Time window in seconds
        uint256 operations;   // Operations in current window
        uint256 windowStart;  // Start of current window
    }
    
    // Threshold monitoring
    struct Threshold {
        uint256 maxValue;     // Maximum allowed value
        uint256 violations;   // Number of violations
        uint256 cooldown;     // Cooldown period after violation
        uint256 lastViolation; // Timestamp of last violation
    }
    
    // State variables
    CircuitState public circuitState;
    mapping(bytes4 => bool) public functionPaused;
    mapping(bytes4 => RateLimit) public rateLimits;
    mapping(string => Threshold) public thresholds;
    
    // Monitoring
    uint256 public totalIncidents;
    uint256 public lastIncidentTime;
    mapping(address => uint256) public operatorActions;
    
    // Events
    event CircuitStateChanged(CircuitState oldState, CircuitState newState, string reason);
    event FunctionPaused(bytes4 indexed selector, bool paused);
    event RateLimitExceeded(bytes4 indexed selector, address indexed caller);
    event ThresholdViolation(string indexed metric, uint256 value, uint256 maxValue);
    event EmergencyActionTaken(address indexed guardian, string action);
    
    // Errors
    error CircuitBreakerTripped();
    error RateLimitExceeded();
    error ThresholdExceeded();
    error NotInEmergency();
    error CooldownActive();
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GUARDIAN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        
        circuitState = CircuitState.NORMAL;
        _initializeDefaults();
    }
    
    /**
     * @notice Initialize default rate limits and thresholds
     */
    function _initializeDefaults() private {
        // Default rate limits for critical functions
        rateLimits[bytes4(keccak256("withdraw(uint256)"))] = RateLimit({
            limit: 10,
            window: 3600, // 1 hour
            operations: 0,
            windowStart: block.timestamp
        });
        
        rateLimits[bytes4(keccak256("placeBet(address,uint8,uint256,uint8)"))] = RateLimit({
            limit: 100,
            window: 60, // 1 minute
            operations: 0,
            windowStart: block.timestamp
        });
        
        // Default thresholds
        thresholds["gasPrice"] = Threshold({
            maxValue: 500 gwei,
            violations: 0,
            cooldown: 300, // 5 minutes
            lastViolation: 0
        });
        
        thresholds["arraySize"] = Threshold({
            maxValue: 1000,
            violations: 0,
            cooldown: 600, // 10 minutes
            lastViolation: 0
        });
    }
    
    /**
     * @notice Check if function should be allowed to proceed
     */
    modifier circuitBreakerProtected() {
        _checkCircuitBreaker(msg.sig);
        _;
    }
    
    /**
     * @notice Internal circuit breaker check
     */
    function _checkCircuitBreaker(bytes4 selector) private {
        // Check global pause
        if (paused()) revert CircuitBreakerTripped();
        
        // Check circuit state
        if (circuitState == CircuitState.EMERGENCY) {
            // Only allow emergency functions
            if (selector != bytes4(keccak256("emergencyWithdraw()"))) {
                revert CircuitBreakerTripped();
            }
        } else if (circuitState == CircuitState.PAUSED) {
            revert CircuitBreakerTripped();
        } else if (circuitState == CircuitState.RESTRICTED) {
            // Check if this function is restricted
            if (functionPaused[selector]) {
                revert CircuitBreakerTripped();
            }
        }
        
        // Check rate limits
        _checkRateLimit(selector);
    }
    
    /**
     * @notice Check and update rate limits
     */
    function _checkRateLimit(bytes4 selector) private {
        RateLimit storage limit = rateLimits[selector];
        
        // Skip if no rate limit set
        if (limit.limit == 0) return;
        
        // Check if window has expired
        if (block.timestamp >= limit.windowStart + limit.window) {
            // Reset window
            limit.windowStart = block.timestamp;
            limit.operations = 1;
        } else {
            // Increment operations in current window
            limit.operations++;
            
            // Check if limit exceeded
            if (limit.operations > limit.limit) {
                emit RateLimitExceeded(selector, msg.sender);
                revert RateLimitExceeded();
            }
        }
    }
    
    /**
     * @notice Check threshold and trip breaker if exceeded
     */
    function checkThreshold(string calldata metric, uint256 value) external {
        Threshold storage threshold = thresholds[metric];
        
        // Skip if no threshold set
        if (threshold.maxValue == 0) return;
        
        // Check if in cooldown
        if (block.timestamp < threshold.lastViolation + threshold.cooldown) {
            revert CooldownActive();
        }
        
        // Check if threshold exceeded
        if (value > threshold.maxValue) {
            threshold.violations++;
            threshold.lastViolation = block.timestamp;
            
            emit ThresholdViolation(metric, value, threshold.maxValue);
            
            // Auto-trip if too many violations
            if (threshold.violations >= 3) {
                _tripCircuitBreaker("Multiple threshold violations");
            }
        }
    }
    
    /**
     * @notice Trip the circuit breaker
     */
    function _tripCircuitBreaker(string memory reason) private {
        CircuitState oldState = circuitState;
        circuitState = CircuitState.RESTRICTED;
        
        totalIncidents++;
        lastIncidentTime = block.timestamp;
        
        emit CircuitStateChanged(oldState, circuitState, reason);
    }
    
    /**
     * @notice Emergency pause - immediate stop
     */
    function emergencyPause(string calldata reason) external onlyRole(GUARDIAN_ROLE) {
        _pause();
        CircuitState oldState = circuitState;
        circuitState = CircuitState.EMERGENCY;
        
        totalIncidents++;
        lastIncidentTime = block.timestamp;
        
        emit CircuitStateChanged(oldState, circuitState, reason);
        emit EmergencyActionTaken(msg.sender, "emergencyPause");
    }
    
    /**
     * @notice Resume normal operations
     */
    function resume() external onlyRole(GUARDIAN_ROLE) {
        _unpause();
        CircuitState oldState = circuitState;
        circuitState = CircuitState.NORMAL;
        
        // Reset violations
        thresholds["gasPrice"].violations = 0;
        thresholds["arraySize"].violations = 0;
        
        emit CircuitStateChanged(oldState, circuitState, "Manual resume");
        emit EmergencyActionTaken(msg.sender, "resume");
    }
    
    /**
     * @notice Pause specific function
     */
    function pauseFunction(bytes4 selector, bool pause) external onlyRole(OPERATOR_ROLE) {
        functionPaused[selector] = pause;
        operatorActions[msg.sender]++;
        emit FunctionPaused(selector, pause);
    }
    
    /**
     * @notice Update rate limit for function
     */
    function updateRateLimit(
        bytes4 selector,
        uint256 limit,
        uint256 window
    ) external onlyRole(OPERATOR_ROLE) {
        rateLimits[selector] = RateLimit({
            limit: limit,
            window: window,
            operations: 0,
            windowStart: block.timestamp
        });
        operatorActions[msg.sender]++;
    }
    
    /**
     * @notice Update threshold for metric
     */
    function updateThreshold(
        string calldata metric,
        uint256 maxValue,
        uint256 cooldown
    ) external onlyRole(OPERATOR_ROLE) {
        thresholds[metric].maxValue = maxValue;
        thresholds[metric].cooldown = cooldown;
        operatorActions[msg.sender]++;
    }
    
    /**
     * @notice Get circuit breaker status
     */
    function getStatus() external view returns (
        CircuitState state,
        bool isPaused,
        uint256 incidents,
        uint256 lastIncident
    ) {
        return (
            circuitState,
            paused(),
            totalIncidents,
            lastIncidentTime
        );
    }
    
    /**
     * @notice Check if operation is allowed
     */
    function canProceed(bytes4 selector) external view returns (bool) {
        if (paused()) return false;
        if (circuitState == CircuitState.EMERGENCY) return false;
        if (circuitState == CircuitState.PAUSED) return false;
        if (functionPaused[selector]) return false;
        
        // Check rate limit
        RateLimit memory limit = rateLimits[selector];
        if (limit.limit > 0) {
            if (block.timestamp < limit.windowStart + limit.window) {
                if (limit.operations >= limit.limit) return false;
            }
        }
        
        return true;
    }
}