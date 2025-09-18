# Implementation Plan: Option Strategy Recognition

## Feature Overview
Fix the critical bug where all option positions are labeled as "Covered Call" regardless of actual strategy type. Implement intelligent detection for spreads, covered positions, and naked options.

## Related Documents
- [User Story](./user-story-option-strategy-recognition.md)
- [Technical Specification](./spec-option-strategy-recognition.md)

## Current Status: 🔴 BACKLOG
*Last Updated: January 2025*

## Implementation Checklist

### ✅ Phase 1: Documentation & Planning (COMPLETED)
- [x] Created user story with acceptance criteria
- [x] Created detailed technical specification
- [x] Added README.md to features directory
- [x] Created this implementation plan

### ⏳ Phase 2: Backend Core Logic (NOT STARTED)
**Estimated: 1-2 days**

#### Strategy Detection Module
- [ ] Create `/supabase/functions/integrated-analysis-v2/strategyDetector.ts`
  - [ ] Define StrategyType enum
  - [ ] Define DetectedStrategy interface
  - [ ] Implement `detectStrategy()` main function
  - [ ] Add helper functions for each strategy type

#### Strategy Detection Algorithms
- [ ] Implement single-leg detection
  - [ ] Covered Call detection (short call + shares)
  - [ ] Cash-Secured Put detection (short put + cash)
  - [ ] Naked Call/Put detection (no coverage)
  - [ ] Long Call/Put detection

- [ ] Implement spread detection
  - [ ] Bull Put Spread (short put + long put lower)
  - [ ] Bear Call Spread (short call + long call higher)
  - [ ] Bull Call Spread (long call + short call higher)
  - [ ] Bear Put Spread (long put + short put lower)

- [ ] Implement complex strategy detection
  - [ ] Iron Condor (bull put spread + bear call spread)
  - [ ] Iron Butterfly (ATM straddle + OTM strangle)
  - [ ] Straddle (same strike call + put)
  - [ ] Strangle (different strike call + put)

#### Risk Calculations
- [ ] Implement max profit calculation per strategy
- [ ] Implement max loss calculation per strategy
- [ ] Implement breakeven calculation per strategy
- [ ] Add probability calculations using Greeks

### ⏳ Phase 3: Backend Integration (NOT STARTED)
**Estimated: 1 day**

#### Update integrated-analysis-v2
- [ ] Import strategyDetector module
- [ ] Replace hardcoded "Covered Call" on line 702
- [ ] Add strategy detection call for each position
- [ ] Group multi-leg strategies
- [ ] Update response structure with strategy details
- [ ] Add strategy-specific risk metrics
- [ ] Test with sample data

#### Update portfolio-vision
- [ ] Enhance GPT prompt to identify spreads
- [ ] Add instructions to group related legs
- [ ] Improve option position extraction
- [ ] Test with various portfolio screenshots

### ⏳ Phase 4: Frontend Updates (NOT STARTED)
**Estimated: 1-2 days**

#### Type Definitions
- [ ] Create `/src/types/strategies.ts`
  - [ ] Define StrategyType enum (matching backend)
  - [ ] Define OptionStrategy interface
  - [ ] Define StrategyMetrics interface
  - [ ] Define RiskProfile interface

#### Component Updates
- [ ] Update `StockAnalysis.tsx`
  - [ ] Replace hardcoded "Covered Call" display
  - [ ] Add dynamic strategy type from backend
  - [ ] Show strategy-specific metrics
  - [ ] Group spread legs together

- [ ] Create `StrategyBadge.tsx` component
  - [ ] Visual indicator for strategy type
  - [ ] Risk level coloring (defined/undefined/covered)
  - [ ] Max profit/loss display
  - [ ] Hover tooltip with details

#### Display Enhancements
- [ ] Update Performance Tab
  - [ ] Show correct strategy names
  - [ ] Display max profit/loss for spreads
  - [ ] Show net premium for multi-leg
  - [ ] Correct risk assessments

- [ ] Update Recommendations Tab
  - [ ] Group spread legs visually
  - [ ] Show combined P&L for strategies
  - [ ] Display strategy-specific advice

### ⏳ Phase 5: Testing & Validation (NOT STARTED)
**Estimated: 1 day**

#### Unit Tests
- [ ] Create test file for strategyDetector
- [ ] Test each strategy type detection
- [ ] Test edge cases (partial fills, odd lots)
- [ ] Test performance with large portfolios

#### Integration Tests
- [ ] Test with bull put spread example (ETHA $30/$33)
- [ ] Test with covered calls
- [ ] Test with mixed strategies
- [ ] Test with iron condors
- [ ] Verify Greeks integration works

#### End-to-End Tests
- [ ] Upload portfolio with spreads
- [ ] Verify correct strategy labels
- [ ] Check premium calculations
- [ ] Validate risk assessments
- [ ] Compare with broker statements

### ⏳ Phase 6: Deployment (NOT STARTED)
**Estimated: 0.5 day**

#### Pre-deployment
- [ ] Code review completed
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Performance benchmarks met

#### Deployment Steps
- [ ] Deploy backend with feature flag OFF
- [ ] Test in production with flag OFF
- [ ] Enable for test users (10%)
- [ ] Monitor error rates
- [ ] Gradual rollout to 50%
- [ ] Full rollout to 100%
- [ ] Remove feature flag

#### Post-deployment
- [ ] Monitor detection accuracy
- [ ] Track error rates
- [ ] Gather user feedback
- [ ] Create hotfix plan if needed

## Risk Mitigation

### Known Risks
1. **Complex portfolios with 20+ positions**
   - Mitigation: Implement position limit, optimize algorithms

2. **Exotic strategies not recognized**
   - Mitigation: Default to "Unknown Strategy" safely

3. **Incorrect max loss calculations**
   - Mitigation: Extensive testing, conservative estimates

4. **Performance degradation**
   - Mitigation: Caching, memoization, early returns

## Success Criteria
- [ ] Zero "Covered Call" labels for non-covered-call strategies
- [ ] Bull put spread shows max loss of $297, not "HIGH RISK"
- [ ] Premiums calculated correctly for all strategies
- [ ] Strategy detection completes in < 100ms
- [ ] 95%+ accuracy on strategy identification

## Dependencies
- Greeks data from Polygon.io
- Portfolio position data structure
- Existing integrated-analysis-v2 function
- Existing portfolio-vision function

## Resources Needed
- Developer time: 5-6 days
- Access to test portfolios with various strategies
- Polygon.io API for Greeks testing
- User feedback for validation

## Next Steps
1. **Immediate**: Review and approve this plan
2. **Day 1**: Start Phase 2 - Create strategyDetector.ts
3. **Day 2-3**: Complete detection algorithms
4. **Day 4**: Integration and frontend
5. **Day 5**: Testing and deployment

## Notes
- This fixes a critical bug affecting ALL users with options
- High priority due to incorrect financial calculations
- Should be moved to `in-progress/` when development starts
- Consider creating feature flag for safe rollout

---

**Status Legend:**
- ✅ Completed
- ⏳ Not Started
- 🔄 In Progress
- ❌ Blocked

**To move this to in-progress:**
1. Get approval from technical lead
2. Assign developer resource
3. Move all files to `features/in-progress/`
4. Create feature branch from main
5. Begin Phase 2 implementation