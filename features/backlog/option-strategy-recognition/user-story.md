# User Story: Intelligent Option Strategy Recognition

## Story
As an options trader using the Wheel Strategy and other multi-leg strategies,
I want the system to correctly identify and categorize my option positions (spreads, covered calls, naked options),
So that I receive accurate premium calculations, risk assessments, and P&L reporting for each strategy type.

## Acceptance Criteria
- [ ] Given I have a bull put spread (short $30 put + long $33 put), when I view analysis, then it shows "Bull Put Spread" NOT "Covered Call"
- [ ] Given I have a covered call (short call + 100 shares per contract), when I view analysis, then it correctly shows "Covered Call"
- [ ] Given I have a cash-secured put (short put + cash to cover), when I view analysis, then it shows "Cash-Secured Put"
- [ ] Given I have a bear call spread (short call + long call at higher strike), when I view analysis, then it shows "Bear Call Spread"
- [ ] Given I have naked options (no coverage), when I view analysis, then it shows "Naked Call" or "Naked Put" with appropriate warnings
- [ ] Must correctly calculate max profit/loss for spread strategies
- [ ] Must show defined risk (e.g., $300 max loss) for spreads, NOT "high risk"
- [ ] Must calculate net premium correctly (premium received - premium paid for spreads)
- [ ] Should recognize multi-leg strategies with same expiration dates
- [ ] Should handle partial fills and odd lots correctly
- [ ] Performance: Strategy detection must complete in < 100ms

## Priority
**High** - Currently causing incorrect risk assessments and P&L calculations

## Estimated Effort
Medium (3-5 days)

## Dependencies
- Existing portfolio-vision edge function (extracts positions)
- Existing integrated-analysis-v2 edge function (performs analysis)
- Greeks data from Polygon.io API
- Position data structure with contracts, strikes, expiries

## User Impact
- Affects ALL users with option positions (100% of active users)
- Critical for accurate financial reporting
- Directly impacts trading decisions
- Current workaround: Manual calculation outside the app

## Notes
### Current Behavior (Bug)
- System labels ALL option positions as "Covered Call"
- Bull put spread showing as two separate "Covered Calls" with wrong premium
- Risk assessment shows "HIGH RISK" for defined-risk spreads
- Premium calculations are incorrect for multi-leg strategies

### Expected Behavior
- Each strategy type properly identified
- Correct max profit/loss calculations
- Accurate risk assessments
- Net premium calculations for spreads

### Test Cases to Validate
1. **Bull Put Spread**: ETHA $30/$33 puts should show max profit $303, max loss $297
2. **Covered Call**: ETHA shares + short $36 call should show premium collected correctly
3. **Iron Condor**: 4-leg position should be recognized as single strategy
4. **Mixed Portfolio**: Multiple strategies on same ticker handled independently

## Success Metrics
- Strategy recognition accuracy: > 95%
- Zero "Covered Call" labels for non-covered-call strategies
- Risk calculations match broker statements within $1
- User complaints about incorrect strategy labels: 0
- Premium calculations match actual collected premiums

## Mockups/Wireframes
Current (Incorrect):
```
Type          Symbol    Qty    Strike    Premium    Status
Covered Call  ETHA      5      $30       $503       Short-dated  ❌
Covered Call  ETHA      -5     $33       $1,047     Short-dated  ❌
```

Expected (Correct):
```
Type              Symbol    Qty    Strike    Premium    Status
Bull Put Spread   ETHA      5      $30/$33   -$544      Short-dated ✓
  Short Put       ETHA      5      $30       $503       (part of spread)
  Long Put        ETHA      -5     $33       -$1,047    (part of spread)
```

## Questions/Concerns
- How to handle partially closed spreads?
- Should we support exotic strategies (butterflies, condors)?
- How to display assignment risk for spreads vs single legs?
- Integration with existing wheel strategy calculations
- Edge case: What if user has both spreads AND covered calls on same ticker?