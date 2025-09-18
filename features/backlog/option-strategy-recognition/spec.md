# Technical Specification: Intelligent Option Strategy Recognition

## User Story Reference
Link to user story: ./user-story.md

## Executive Summary
Implement intelligent detection of option strategies to replace the current hardcoded "Covered Call" labeling. The system will analyze position combinations to identify spreads, covered positions, and naked options, providing accurate risk assessments and P&L calculations for each strategy type.

## Architecture Overview

### System Components Affected
- [x] Frontend (React)
- [x] Backend (Supabase Edge Functions)
- [ ] Database
- [x] External APIs (indirect via Greeks)
- [ ] Infrastructure

### High-Level Design
```
Portfolio Vision → Extract Positions → Strategy Detector → Risk Calculator → Display
       ↓                    ↓                ↓                  ↓            ↓
  [Get positions]    [Group by ticker]  [Identify type]  [Calculate P&L]  [Show UI]
```

## Detailed Design

### Frontend Changes

#### New Components
```typescript
// src/components/StrategyBadge.tsx
interface StrategyBadgeProps {
  strategy: StrategyType;
  riskLevel: 'defined' | 'undefined' | 'covered';
  maxLoss?: number;
  maxProfit?: number;
}

export function StrategyBadge({ strategy, riskLevel, maxLoss, maxProfit }: StrategyBadgeProps) {
  // Visual indicator for strategy type with risk coloring
}
```

#### Modified Components
- `StockAnalysis.tsx`: Replace "Covered Call" hardcoded text with dynamic strategy type
- `PerformanceTab`: Show strategy-specific metrics (max profit/loss for spreads)
- `PositionSnapshot`: Group related legs of spreads together

#### State Management
- Add `strategyType` field to position objects
- Add `relatedPositions` array for multi-leg strategies
- Cache strategy detection results

### Backend Changes

#### New Edge Functions
```typescript
// supabase/functions/integrated-analysis-v2/strategyDetector.ts
export interface OptionLeg {
  symbol: string;
  strike: number;
  expiry: string;
  optionType: 'CALL' | 'PUT';
  contracts: number; // negative = short, positive = long
  premium: number;
}

export interface DetectedStrategy {
  type: StrategyType;
  legs: OptionLeg[];
  maxProfit: number;
  maxLoss: number;
  breakeven: number[];
  currentPL: number;
  riskProfile: 'defined' | 'undefined' | 'covered';
  collateral: number;
}

export enum StrategyType {
  COVERED_CALL = 'Covered Call',
  CASH_SECURED_PUT = 'Cash-Secured Put',
  BULL_PUT_SPREAD = 'Bull Put Spread',
  BEAR_CALL_SPREAD = 'Bear Call Spread',
  BULL_CALL_SPREAD = 'Bull Call Spread',
  BEAR_PUT_SPREAD = 'Bear Put Spread',
  IRON_CONDOR = 'Iron Condor',
  IRON_BUTTERFLY = 'Iron Butterfly',
  STRADDLE = 'Straddle',
  STRANGLE = 'Strangle',
  NAKED_CALL = 'Naked Call',
  NAKED_PUT = 'Naked Put',
  LONG_CALL = 'Long Call',
  LONG_PUT = 'Long Put',
  UNKNOWN = 'Unknown Strategy'
}

export function detectStrategy(
  positions: OptionLeg[],
  shareCount: number,
  cashBalance: number,
  currentPrice: number
): DetectedStrategy {
  // Implementation details below
}
```

#### Modified Edge Functions
- `integrated-analysis-v2/index.ts`:
  - Import strategy detector
  - Replace line 702 hardcoded type with: `"type": "${detectStrategy(position).type}"`
  - Add strategy-specific risk calculations
  - Include max profit/loss in response

- `portfolio-vision/index.ts`:
  - Enhance prompt to group related options
  - Extract whether positions are opening or closing trades

#### API Contracts

##### Modified Response Structure
```json
{
  "recommendations": {
    "positionSnapshot": [
      {
        "type": "Bull Put Spread",  // Dynamic, not hardcoded
        "strategy": {
          "type": "BULL_PUT_SPREAD",
          "legs": [
            {"strike": 30, "contracts": 5, "type": "PUT", "position": "SHORT"},
            {"strike": 33, "contracts": -5, "type": "PUT", "position": "LONG"}
          ],
          "maxProfit": 303,
          "maxLoss": 297,
          "breakeven": [30.303],
          "riskProfile": "defined",
          "netPremium": -544,
          "assignmentRisk": 0.15
        },
        "ticker": "ETHA",
        "quantity": 5,
        "strike": "30/33",  // Show as spread
        "expiry": "2025-10-17",
        "premiumCollected": -544,  // Net premium for spreads
        "currentValue": -650,
        "wheelProfit": 106,
        "daysToExpiry": 30,
        "moneyness": "OTM 10.0%",
        "comment": "Defined risk spread"
      }
    ]
  }
}
```

### Data Models

#### TypeScript Interfaces
```typescript
// src/types/strategies.ts
export interface OptionStrategy {
  type: StrategyType;
  legs: OptionLeg[];
  metrics: StrategyMetrics;
  risk: RiskProfile;
}

export interface StrategyMetrics {
  maxProfit: number;
  maxLoss: number;
  breakeven: number[];
  probability: {
    profit: number;
    maxProfit: number;
    maxLoss: number;
  };
  expectedValue: number;
  currentPL: number;
  netPremium: number;
}

export interface RiskProfile {
  type: 'defined' | 'undefined' | 'covered';
  collateralRequired: number;
  assignmentRisk: number;
  marginRequirement: number;
}

export interface OptionLeg {
  symbol: string;
  strike: number;
  expiry: string;
  optionType: 'CALL' | 'PUT';
  position: 'LONG' | 'SHORT';
  contracts: number;
  premium: number;
  currentValue: number;
  greeks?: OptionGreeks;
}
```

## Implementation Plan

### Phase 1: Foundation (Day 1)
1. [x] Create user story and specification
2. [ ] Create `strategyDetector.ts` with basic strategy detection
3. [ ] Add TypeScript interfaces in `src/types/strategies.ts`
4. [ ] Write unit tests for strategy detection logic

### Phase 2: Core Logic (Day 2)
1. [ ] Implement spread detection algorithms
2. [ ] Implement covered position detection
3. [ ] Implement risk calculations per strategy
4. [ ] Add max profit/loss calculations

### Phase 3: Integration (Day 3)
1. [ ] Integrate detector into integrated-analysis-v2
2. [ ] Update portfolio-vision prompts
3. [ ] Test with real portfolio data
4. [ ] Handle edge cases

### Phase 4: Frontend (Day 4)
1. [ ] Update StockAnalysis component
2. [ ] Create StrategyBadge component
3. [ ] Group spread legs in UI
4. [ ] Add strategy-specific displays

### Phase 5: Testing & Polish (Day 5)
1. [ ] End-to-end testing with various strategies
2. [ ] Performance optimization
3. [ ] Documentation update
4. [ ] Deploy to production

## Testing Strategy

### Unit Tests
```typescript
// tests/strategyDetector.test.ts
describe('Strategy Detection', () => {
  it('should identify bull put spread', () => {
    const positions = [
      { strike: 30, contracts: 5, optionType: 'PUT' },
      { strike: 33, contracts: -5, optionType: 'PUT' }
    ];
    expect(detectStrategy(positions)).toEqual({
      type: 'BULL_PUT_SPREAD',
      maxProfit: 303,
      maxLoss: 297
    });
  });

  it('should identify covered call', () => {
    const positions = [
      { strike: 36, contracts: -1, optionType: 'CALL' }
    ];
    const shares = 100;
    expect(detectStrategy(positions, shares)).toEqual({
      type: 'COVERED_CALL'
    });
  });
});
```

### Integration Tests
- Test with actual portfolio screenshots
- Verify Greeks integration
- Test multi-ticker portfolios
- Validate against broker statements

### Performance Tests
- Strategy detection < 100ms for 20 positions
- No blocking UI during calculation
- Efficient caching of results

## Performance Considerations

### Frontend
- Memoize strategy calculations
- Lazy load strategy details
- Cache detection results in localStorage

### Backend
- Pre-sort positions for O(n log n) detection
- Use early returns for simple strategies
- Batch process multi-leg strategies

## Security Considerations

### Input Validation
```typescript
// Validate position data
if (!isValidOptionPosition(position)) {
  console.warn('Invalid position data:', position);
  return { type: 'UNKNOWN' };
}
```

### Data Protection
- No PII in strategy detection
- Sanitize user inputs
- Log anonymized data only

## Rollout Strategy

### Feature Flags
```typescript
const FEATURES = {
  SMART_STRATEGY_DETECTION: process.env.ENABLE_STRATEGY_DETECTION === 'true'
};

if (FEATURES.SMART_STRATEGY_DETECTION) {
  return detectStrategy(positions);
} else {
  return { type: 'Covered Call' }; // Legacy behavior
}
```

### Deployment Steps
1. Deploy backend with feature flag OFF
2. Test with select users
3. Monitor error rates
4. Gradual rollout to 100%
5. Remove feature flag after stable

### Rollback Plan
1. Toggle feature flag OFF
2. Clear detection cache
3. Revert to previous version if critical

## Monitoring & Analytics

### Metrics to Track
- Strategy detection accuracy
- Detection time (p50, p95, p99)
- Most common strategies
- Error rates by strategy type

### Logging
```typescript
console.log('[STRATEGY_DETECTOR]', {
  action: 'detection_complete',
  strategy: detectedStrategy.type,
  legCount: positions.length,
  timeMs: Date.now() - startTime
});
```

### Alerts
- Detection failure rate > 5%
- Response time > 500ms
- Unknown strategy rate > 10%

## Dependencies

### External Libraries
None required - pure TypeScript implementation

### APIs
- Polygon.io (indirect - for Greeks used in calculations)

### Internal Dependencies
- Existing option position interfaces
- Greeks data structure
- Portfolio data format

## Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Incorrect strategy detection | High | Medium | Extensive testing, gradual rollout |
| Performance degradation | Medium | Low | Caching, optimization |
| Complex portfolios timeout | Low | Low | Limit positions analyzed |
| Edge cases not handled | Medium | Medium | Comprehensive test suite |

## Documentation Updates

- [ ] Update ARCHITECTURE.md with strategy detection flow
- [ ] Add strategy types to API documentation
- [ ] Create troubleshooting guide for common issues
- [ ] Update user documentation with strategy explanations

## Open Questions

1. Should we support calendar spreads (different expiries)?
2. How to handle partially closed multi-leg strategies?
3. Should we detect and warn about undefined risk positions?
4. How to display complex strategies (4+ legs)?
5. Integration with existing wheel strategy tracker?

## References

- [Options Strategies Guide](https://www.optionseducation.org/strategies)
- [CBOE Strategy Definitions](https://www.cboe.com/strategies)
- [TastyTrade Strategy Mechanics](https://www.tastytrade.com/concepts-strategies)
- Current bug reports in `/docs/bugs-and-fixes/`

## Approval

- [ ] Product Owner - Strategy types meet user needs
- [ ] Technical Lead - Architecture approach sound
- [ ] UX/UI Designer - Display approach clear
- [ ] QA Lead - Test coverage adequate