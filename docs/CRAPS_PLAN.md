# Full On-Chain Craps Game Rules and Implementation Guide

## Table of Contents
1. [Game Flow and Phases](#game-flow-and-phases)
2. [Core Line Bets](#core-line-bets)
3. [Odds Bets](#odds-bets)
4. [Place & Lay Bets](#place--lay-bets)
5. [Field Bet](#field-bet)
6. [Hardway Bets](#hardway-bets)
7. [Single-Roll Proposition Bets](#single-roll-proposition-bets)
8. [Bonus and Exotic Side Bets](#bonus-and-exotic-side-bets)
9. [Implementation Details](#implementation-details)
10. [Data Structures and Efficiency](#data-structures-and-efficiency)

## Game Flow and Phases

Craps is played in rounds consisting of two phases: the **Come-Out phase** and the **Point phase**. At the start of a round (come-out), two six-sided dice are rolled.

### Come-Out Roll
- **Natural (7 or 11)**: Pass Line bets win immediately (even money), Don't Pass bets lose
- **Craps (2, 3, or 12)**: Pass Line bets lose, Don't Pass bets win on 2 or 3 (12 is a push/tie on Don't Pass)
- In any of these cases, the round ends instantly with no point established – a new come-out roll begins with the same shooter

### Establishing the Point
- If the come-out roll is **4, 5, 6, 8, 9, or 10**, that number becomes the **Point**
- The dealer (or contract) marks this as the point
- The game enters the Point phase, where the shooter keeps rolling until either:
  - They roll the Point again (win)
  - They roll a 7 (seven-out, lose)
- All Pass/Don't Pass and related bets remain active during the point phase
- Players may place additional bets (Come, Don't Come, etc.) once a point is established

### Point Phase Resolution
- **Point is made**: Pass Line wins (Don't Pass loses), round ends with a win, same shooter continues with new come-out
- **Seven-out**: Don't Pass wins (Pass Line loses), shooter's turn ends, all bets tied to this shooter's round are resolved

### Betting Phases
- **Pass/Don't Pass**: Made before the come-out
- **Come/Don't Come**: Only made after a point is established (act like a new mini come-out for that player's bet)
- **Side bets**: Some must be placed at start of shooter's turn, others can be placed anytime

The contract should track the current phase (e.g., `enum Phase { COME_OUT, POINT }`) and only accept or resolve bets appropriate to that phase.

## Core Line Bets

### Pass Line Bet
- **When to place**: Before come-out roll
- **Wins**: 
  - Come-out 7 or 11 (even money 1:1)
  - Point is made before 7
- **Loses**: 
  - Come-out 2, 3, or 12
  - Seven-out before point
- **House edge**: ~1.41%

### Don't Pass Bet
- **When to place**: Before come-out roll
- **Wins**: 
  - Come-out 2 or 3 (even money 1:1)
  - Seven-out before point
- **Loses**: 
  - Come-out 7 or 11
  - Point is made
- **Push**: Come-out 12 (bar 12 - bet neither wins nor loses)
- **House edge**: ~1.36%

### Come Bet
- **When to place**: Only after point is established
- **Mechanics**: Next roll acts as mini come-out
  - 7 or 11: Wins immediately (1:1)
  - 2, 3, or 12: Loses immediately
  - 4, 5, 6, 8, 9, 10: Becomes the Come bet's "come-point"
- **Resolution**: Come bet wins if come-point is rolled before 7
- **Multiple bets**: Can have multiple Come bets on different numbers simultaneously

### Don't Come Bet
- **When to place**: Only after point is established
- **Mechanics**: Next roll acts as personal come-out
  - 2 or 3: Wins immediately (1:1)
  - 7 or 11: Loses immediately
  - 12: Push (bar 12)
  - 4, 5, 6, 8, 9, 10: Becomes the Don't Come point
- **Resolution**: Don't Come wins if 7 comes before the point
- **House edge**: ~1.36%

### Implementation Structure
```solidity
struct Bet {
    uint256 amount;
    uint8 point;
    bool isActive;
}
mapping(address => Bet) public comeBet;
mapping(address => Bet) public dontComeBet;
```

## Odds Bets

Odds bets are additional wagers on existing Pass/Come or Don't Pass/Don't Come bets after a point is established. They pay at **true odds with 0% house edge**.

### Pass Line/Come Odds ("Taking Odds")
**Payouts based on point**:
- Point 4 or 10: Pays 2:1
- Point 5 or 9: Pays 3:2
- Point 6 or 8: Pays 6:5

### Don't Pass/Don't Come Odds ("Laying Odds")
**Payouts (inverse of taking odds)**:
- Against 4 or 10: Pays 1:2 (risk 2 to win 1)
- Against 5 or 9: Pays 2:3
- Against 6 or 8: Pays 5:6

**Important Notes**:
- Can only place if you have corresponding base bet active
- Casinos typically limit odds multiples (3-4-5x), but on-chain can be flexible
- In live craps, odds bets are "off" on come-out unless specified
- 0% house edge makes these the best bets in craps

## Place & Lay Bets

These bets wager on specific numbers rolling (or not) before a 7.

### "Yes" Bets (Place Bets)
Bet that a specific number will roll before 7.

**Payouts (~2% house edge)**:
- Yes on 4: Pays ~1.96:1 (true odds 2:1)
- Yes on 5: Pays ~1.47:1 (true odds 1.5:1)
- Yes on 6 or 8: Pays ~1.18:1 (true odds 1.2:1)
- Yes on 9: Pays ~1.47:1
- Yes on 10: Pays ~1.96:1
- Yes on 2 or 12: Pays ~5.88:1 (true odds 6:1)
- Yes on 3 or 11: Pays ~2.94:1 (true odds 3:1)

### "No" Bets (Lay Bets)
Bet that 7 will roll before the specified number.

**Payouts (~2% house edge)**:
- No 4 or 10: Pays ~0.49:1 (true odds 0.5:1)
- No 5 or 9: Pays ~0.65:1 (true odds 0.67:1)
- No 6 or 8: Pays ~0.82:1 (true odds 0.83:1)
- No 2 or 12: Pays ~0.16:1 (true odds 0.167:1)
- No 3 or 11: Pays ~0.32:1 (true odds 0.33:1)

**Resolution**:
- Resolve immediately when either the number or 7 is rolled
- All other rolls: bet remains active

## Field Bet

Simple one-roll bet on specific totals.

**Wins if next roll is**: 2, 3, 4, 9, 10, 11, or 12
**Loses if next roll is**: 5, 6, 7, or 8

**Payouts**:
- Most winning numbers: 1:1
- Roll of 2: 2:1
- Roll of 12: 3:1
- **House edge**: ~2.78%

## Hardway Bets

Bets on rolling specific even numbers as doubles before a 7 or "easy way".

### Types and Payouts
- **Hard 4 (2-2)**: Pays 7:1
- **Hard 6 (3-3)**: Pays 9:1
- **Hard 8 (4-4)**: Pays 9:1
- **Hard 10 (5-5)**: Pays 7:1

**Wins**: When the hardway is rolled (e.g., 4-4 for Hard 8)
**Loses**: When 7 rolls OR the number rolls easy (e.g., 5+3 for 8)
**Stays active**: On all other rolls

## Single-Roll Proposition Bets

Bets on the exact total of the next roll only.

### "Next Roll Will Be X" Payouts
Based on ~2% house edge from true odds:

- **Next 2 (Snake Eyes)**: Pays ~34.3:1 (1 way, true odds 35:1)
- **Next 3 (Ace Deuce)**: Pays ~16.67:1 (2 ways, true odds 17:1)
- **Next 4**: Pays ~10.78:1 (3 ways, true odds 11:1)
- **Next 5**: Pays ~7.84:1 (4 ways, true odds 8:1)
- **Next 6**: Pays ~6.08:1 (5 ways, true odds 6.2:1)
- **Next 7 (Any Seven)**: Pays ~4.90:1 (6 ways, true odds 5:1)
- **Next 8**: Pays ~6.08:1 (5 ways)
- **Next 9**: Pays ~7.84:1 (4 ways)
- **Next 10**: Pays ~10.78:1 (3 ways)
- **Next 11 (Yo)**: Pays ~16.67:1 (2 ways)
- **Next 12 (Boxcars)**: Pays ~34.3:1 (1 way)

All proposition bets resolve immediately after the next roll.

## Bonus and Exotic Side Bets

### Fire Bet
Tracks unique points made by shooter before seven-out.

**Payouts**:
- 4 unique points: 24:1
- 5 unique points: 249:1
- 6 unique points: 999:1
- 0-3 points: Lose

**House edge**: ~20-25%

### Small/Tall/All Bets
Must roll specific numbers before any 7.

- **Small**: Roll all of 2, 3, 4, 5, 6 before 7 (Pays 30:1)
- **Tall**: Roll all of 8, 9, 10, 11, 12 before 7 (Pays 30:1)
- **All**: Roll all numbers 2-6 AND 8-12 before 7 (Pays 150:1)

### Hot Roller
Based on consecutive points made.

**Simplified Payouts**:
- 2 points: 5:1
- 3 points: 10:1
- 4 points: 20:1
- 5 points: 50:1
- 6+ points: 100:1

### Ride the Line
Progressive Pass Line win streak.

**Payouts (Pay Table 6)**:
- 1 win: 1:1
- 2 wins: 2:1
- 3 wins: 3:1
- 4 wins: 5:1
- 5 wins: 8:1
- 6 wins: 12:1
- 7 wins: 20:1
- 8 wins: 35:1
- 9 wins: 60:1
- 10 wins: 100:1
- 11+ wins: 150:1

### Muggsy's Corner
Wins if:
1. Come-out roll is 7 (Pays 2:1)
2. Point established then immediate 7 (Pays 3:1)

### Replay Bet
Shooter hits same point 3+ times before seven-out.

**Payouts**:
- Point 4 or 10: 3 times = 120:1, 4+ times = 1000:1
- Point 5 or 9: 3 times = 95:1, 4+ times = 500:1
- Point 6 or 8: 3 times = 70:1, 4+ times = 100:1

### Different Doubles
Count distinct doubles rolled before seven-out.

**Payouts**:
- 3 different doubles: 4:1
- 4 different doubles: 8:1
- 5 different doubles: 15:1
- 6 different doubles: 100:1
- 0-2 doubles: Lose

### Repeater Bets
Specific number must be rolled X times before 7.

**Required repetitions and payouts**:
- Repeater 2: 2 times, pays 40:1
- Repeater 3: 3 times, pays 50:1
- Repeater 4: 4 times, pays 65:1
- Repeater 5: 5 times, pays 80:1
- Repeater 6: 6 times, pays 90:1
- Repeater 7: Not applicable
- Repeater 8: 6 times, pays 90:1
- Repeater 9: 5 times, pays 80:1
- Repeater 10: 4 times, pays 65:1
- Repeater 11: 3 times, pays 50:1
- Repeater 12: 2 times, pays 40:1

**House edge**: ~20%

## Implementation Details

### Payout Calculation in Solidity

Use integer math with basis points (100 = 1:1):

```solidity
uint256 multiplier = payoutMultiplier[betType]; // e.g., 588 for 5.88:1
uint256 win = bet.amount * multiplier / 100;
uint256 payout = bet.amount + win;
balances[player] += payout;
```

### Dice Roll Resolution Flow

```solidity
if (phase == Phase.COME_OUT) {
    if (total == 7 || total == 11) {
        // Pass wins, Don't Pass loses
        payoutAll(PASS_LINE, 100);
        loseAll(DONT_PASS);
        nextPhase = Phase.COME_OUT;
    } else if (total == 2 || total == 3) {
        loseAll(PASS_LINE);
        payoutAll(DONT_PASS, 100);
        nextPhase = Phase.COME_OUT;
    } else if (total == 12) {
        loseAll(PASS_LINE);
        pushAll(DONT_PASS);
        nextPhase = Phase.COME_OUT;
    } else {
        // 4,5,6,8,9,10 -> establish point
        shooter.point = total;
        nextPhase = Phase.POINT;
    }
    // Handle one-roll bets
    resolveField(total);
    resolveNextBets(total);
}

if (phase == Phase.POINT) {
    if (total == shooter.point) {
        // Point made - Pass wins
        payoutAll(PASS_LINE, 100);
        loseAll(DONT_PASS);
        // Increment counters for bonus bets
        pointsMadeCount++;
        // Reset for new come-out
        shooter.point = 0;
        nextPhase = Phase.COME_OUT;
    } else if (total == 7) {
        // Seven-out - Don't Pass wins
        payoutAll(DONT_PASS, 100);
        loseAll(PASS_LINE);
        // Resolve all active bets
        resolveAllActiveBets();
        // Reset shooter
        resetShooter();
    } else {
        // Continue point phase
        resolvePlaceBets(total);
        resolveComeBets(total);
        resolveField(total);
        updateBonusTrackers(total);
    }
}
```

## Data Structures and Efficiency

### Shooter State Management

```solidity
struct ShooterState {
    uint8 point;
    bool isComeOut;
    uint8 pointsMadeCount;
    uint8 fireMask;          // Bit mask for unique points (4-10)
    uint8 doublesMask;        // Bit mask for doubles seen
    uint16 smallTallMask;    // Bit mask for Small/Tall/All
    uint8[13] rollCount;     // Repeater counts per total
}
```

### Bet Storage Optimization

```solidity
// Use mappings for O(1) lookup
mapping(address => mapping(uint8 => Bet)) activeBets;

// Use bit masks for active bet types per player
mapping(address => uint64) activeBetsBitmap;

// Batch processing limits
uint256 constant MAX_BETS_PER_TX = 100;
```

### Gas Optimization Strategies

1. **Storage Packing**: Pack booleans and small integers into single storage slots
2. **Batch Processing**: Limit bets processed per transaction to avoid gas limits
3. **Event Logging**: Use events for outcome logging instead of storage
4. **Bit Operations**: Use bit masks for multiple boolean flags
5. **Efficient Lookups**: Pre-compute payout tables and store as constants

### Security Considerations

- **Randomness**: Use Chainlink VRF for provably fair dice rolls
- **Reentrancy**: Apply checks-effects-interactions pattern
- **Access Control**: Restrict dice rolling to authorized VRF callback
- **Validation**: Ensure dice values are 1-6, validate all bet amounts
- **Withdrawal Pattern**: Credit winnings, allow separate withdrawal

### Bot Player Implementation

```solidity
// Designated bot addresses
address[10] public botPlayers;

// Automatic bet placement for bots
function placeBotBets() internal {
    for (uint i = 0; i < botPlayers.length; i++) {
        // Place predetermined bets for each bot
        placeBet(botPlayers[i], BetType.PASS_LINE, botBetAmount);
    }
}
```

### LP Management

- Maintain total pool balance separate from individual LP tracking
- Update LP shares only on deposit/withdrawal, not per bet
- Calculate performance fees on net profits only
- Use ERC4626 vault standard for LP share management