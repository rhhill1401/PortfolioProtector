# StockAnalysis V2 Refactor Implementation Plan

## Audit Summary

### Current State Problems

1. **Dead Code with `false &&` Guard**
   - Location: `src/components/StockAnalysis.tsx:987`
   - Issue: Legacy `false && ...` guard wraps an entire deterministic strategy card
   - Impact: JSX (including a second `DetectedStrategiesCard` call) never renders but continues to live in the tree

2. **Duplicate Implementation in Portfolio v2 Tab**
   - Location: `src/components/StockAnalysis.tsx:1322`
   - Issue: `TabsContent value='portfoliov2'` rebuilds the same deterministic UI from scratch instead of relying on `DetectedStrategiesCard`
   - Impact: Duplicating summary widgets, leg renderers, and risk badges

3. **Monolithic Tab Architecture**
   - Location: `src/components/StockAnalysis.tsx:1185` (performance tab example)
   - Issue: Each tab is a monolith mixing risk math, markup, and greeks formatting inline
   - Impact: Pattern repeats through line 2653, creating unmaintainable code

4. **Component Owns Every Concern**
   - Locations: Multiple useEffect blocks at lines 462, 466, 559, 591, 603, 649
   - Issue: StockAnalysis owns data fetching, event wiring, formatting helpers, and UI definitions
   - Impact: Half a dozen useEffect blocks listening for:
     - `analysis-ready`
     - `analysis-start`
     - `analysis-done`
     - `price-update`
     - VIX fetches
     - Deterministic events (`DETERMINISTIC_READY`, `GREEKS_READY`)

5. **Inline Type and Helper Declarations**
   - Issue: Domain types and helper functions declared inline (e.g., `TechnicalFactor`, `MarketSentiment`, `fmtNoLeadZero`)
   - Impact: Component inflated to 2,600+ lines, making reuse elsewhere difficult

## Data & Dependency Map

### Current State Management
- **State Variables**: `analysisData`, `isLoading`, `error`, `priceInfo`, `vix`, `isAnalyzing`, `progress`, `deterministicData`
- **External Hooks**: `useOptionChain`, `useWheelQuotes`, `useMarketContext`, `useEtfFlows` feed various tabs
- **Events**: Global listeners for:
  - AI responses (`analysis-ready`)
  - Progress bar (`analysis-start`/`analysis-done`)
  - Live prices (`price-update`)
  - Deterministic payloads (`AnalysisEvents.DETERMINISTIC_READY`/`GREEKS_READY`)
- **Services**: Option math helpers, aggregation utilities, and expiry formatters appear inside tab render functions rather than in dedicated modules

## Migration Path to StockAnalysisV2

### Step 1: Extract Shared Types and Helpers
- **Action**: Extract shared types/helpers from `StockAnalysis.tsx` into a stock-analysis module
- **Location**: Create `/services/stock-analysis/` directory
- **Contents to Extract**:
  - `TechnicalFactor` type
  - `MarketSentiment` type
  - Formatter functions (`fmtNoLeadZero`, etc.)
  - Option math helpers
  - Aggregation utilities
- **Benefit**: V2 can import them without re-declaring

### Step 2: Create Composable Hooks
- **Action**: Wrap the existing event/data plumbing in composable hooks
- **New Hooks**:
  - `useStockAnalysisData` - Manages analysis data state
  - `useDeterministicStream` - Handles deterministic event stream
  - `useAnalysisProgress` - Tracks analysis progress
  - `usePriceUpdates` - Manages real-time price updates
- **Benefit**: Orchestration logic becomes re-usable and testable outside the UI shell

### Step 3: Build Dedicated Tab Components
- **Action**: Create dedicated tab components that accept plain props
- **Components to Create**:
  - `PerformanceTab.tsx`
  - `DeterministicTab.tsx`
  - `WheelExecutionTab.tsx`
  - `RecommendationsTab.tsx`
  - `ContinuationPlanTab.tsx`
  - `MarketContextTab.tsx`
  - `StrategyBuildersTab.tsx`
- **Requirements**:
  - Accept plain props instead of touching global state
  - Consume our modular option cards (`DetectedStrategiesCard`, `StrategyCard`, `StrategyLegDetail`)
  - No inline business logic

### Step 4: Implement StockAnalysisV2
- **Action**: Create `StockAnalysisV2.tsx` as a thin orchestrator
- **Target**: <200 lines
- **Responsibilities**:
  - Call the composable hooks
  - Pass props into tab components
  - Render shared header/progress UI
- **Structure**:
  ```
  StockAnalysisV2.tsx
  ├── Hook calls for data
  ├── Tab state management
  └── Clean JSX with imported components
  ```

### Step 5: Feature Flag Implementation
- **Action**: Introduce new environment flag
- **Flag Name**: `VITE_USE_STOCK_ANALYSIS_V2`
- **Implementation**: Toggle between legacy `StockAnalysis` and new `V2` without regressing production
- **Location**: Add to `.env.local` and check in parent component

### Step 6: Clean Up Dead Code
- **Action**: During migration, ensure the deterministic stream feeds only the modular card
- **Tasks**:
  - Remove the `false &&` duplication
  - Delete redundant JSX once V2 is live
  - Remove duplicate card implementations
  - Clean up unused event listeners

## Success Criteria

1. **File Size**: `StockAnalysisV2.tsx` under 200 lines
2. **Complexity**: Function complexity under 30 (current is 178!)
3. **Reusability**: All cards use modular components
4. **Testability**: Business logic separated into hooks/services
5. **Maintainability**: Each tab in its own file
6. **Performance**: Reduced re-renders through proper component separation

## Timeline Estimate

- **Phase 1** (Extract & Hooks): 2-3 hours
  - Extract types/helpers
  - Create composable hooks

- **Phase 2** (Tab Components): 3-4 hours
  - Build dedicated tab components
  - Integrate modular cards

- **Phase 3** (V2 Implementation): 2 hours
  - Create StockAnalysisV2
  - Wire up feature flag

- **Phase 4** (Testing & Cleanup): 2 hours
  - Test both versions side-by-side
  - Remove dead code
  - Documentation

**Total Estimate**: 9-11 hours

## Risk Mitigation

- **Feature Flag**: Allows instant rollback if issues arise
- **Parallel Running**: Both versions can coexist during migration
- **Incremental Migration**: Can migrate one tab at a time if needed
- **Type Safety**: All extracted types maintain TypeScript coverage

## Next Concrete Steps

1. Create `/services/stock-analysis/` directory
2. Extract `TechnicalFactor`, `MarketSentiment`, and helper functions
3. Create `useStockAnalysisData` hook
4. Build `PerformanceTab.tsx` as proof of concept
5. Wire up feature flag in environment

This migration plan ensures no regression of current behavior while delivering a maintainable, testable, and performant architecture.