# Plan: Modular Integrated Analysis & Option Strategy Detection

## Context & Pain Points
- `supabase/functions/integrated-analysis-v2/index.ts` has grown into a monolith that orchestrates *everything* (portfolio parsing, Greeks, market context, OpenAI prompt building, post-processing).
- Each request bundles portfolio CSV/image output, chart vision summaries, research metadata, market context, Greeks and wheel metrics into a single OpenAI `responses` call. For realistic portfolios (6+ option legs, research docs, chart results) the prompt regularly blows past the Supabase 60 s ceiling → Supabase terminates the function (`EarlyDrop`) → frontend raises `TypeError: Failed to fetch`.
- Deterministic calculations (strategy grouping, net premium, max profit/loss, defined-risk checks) are re-computed inside the edge function and then re-described by the LLM. This wastes tokens, complicates debugging, and blocks us from iterating on option-strategy recognition.

## Goals
1. **Stabilize the analysis flow** so heavy payloads do not crash. The edge function must return within 60 s even under load, with graceful fallbacks if OpenAI stalls.
2. **Modularize and slim the edge code** so deterministic calculations live in dedicated helpers (or client-side), keeping the entrypoint focused on orchestration.
3. **Unlock strategy-detection enhancements** by moving the leg-combination logic into a reusable module that can run synchronously (and be reused client-side).
4. **Maintain existing outputs** (no regression in JSON contracts consumed by the UI) while progressively migrating logic.

## Iterative Delivery Plan

### Phase 0 – Instrumentation & Baseline (same-day)
- [ ] Add detailed logging checkpoints around the OpenAI call (start, end, duration). Include payload size metrics (count of legs, chars) to correlate with latency.
- [ ] Introduce a defensive timeout wrapper (`Promise.race`) with a 50 s ceiling *but* make it return a structured object (`{ success: false, error: "AI_TIMEOUT", partialAnalysis: … }`). This prevents Supabase from killing the request while still surfacing deterministic results.
- [ ] Add a unit-style harness (local `deno` test) that calls the new helper with mocked payloads to confirm the timeout behaves as expected.

### Phase 1 – Extract Deterministic Strategy Logic (iter-1)
- [ ] Create `supabase/functions/integrated-analysis-v2/strategies.ts` encapsulating:
  - Option leg normalization (quantity sign, strike, expiry standardization).
  - Strategy recognition primitives (covered call, cash-secured put, vertical spreads, iron condor scaffold).
  - Calculations for net premium, max profit/loss, defined vs undefined risk.
- [ ] Port existing “wheel” calculations from `integrated-analysis-v2/index.ts` into this module without behavioural changes (add snapshot tests to verify identical outputs for current sample payloads).
- [ ] Export a pure function (no network calls) returning a `StrategyDetectionResult` structure that the frontend can consume directly.
- [ ] Update the edge function to call the module *before* the OpenAI step and include the structured result in the response payload.
- [ ] Add unit tests using fixed option legs (bull put spread, covered call, naked put) under `supabase/functions/integrated-analysis-v2/__tests__/strategies.test.ts` (Deno test runner).

### Phase 2 – Client-Side Consumption (iter-2)
- [ ] Extend `src/types/strategies.ts` (new file) mirroring the `StrategyDetectionResult` contract.
- [ ] Update `TickerPriceSearch` and `StockAnalysis` to prefer the deterministic strategy data when rendering tables/cards. The LLM summary becomes optional embellishment.
- [ ] Ensure `useWheelQuotes` and related hooks operate on the precomputed strategies (removing the need to infer “Covered Call” labels client-side).
- [ ] Add regression tests (Jest/Vitest) for the React components to confirm the new structure renders correctly for spreads and mixed portfolios.

### Phase 3 – Prompt Slimming & Optional AI Step (iter-3)
- [ ] Rebuild the OpenAI prompt builder to *reference* the deterministic results instead of recomputing them. Only include high-level information (portfolio summary, notable alerts) rather than raw positions.
- [ ] Make the AI step optional: if the timeout fires, return the deterministic response and a warning. If it succeeds, merge the AI narrative under a separate `analysis.aiSummary` key.
- [ ] Document the final JSON structure in `docs/INTEGRATED_ANALYSIS_RESPONSE_STRUCTURE.md` and update existing consumers.

## Testing Strategy
- **Unit tests (Deno)** for the new strategy module covering:
  - Covered call detection (shares + short call).
  - Cash-secured put (short put + cash/ no opposing long).
  - Vertical spread (bull/bear) recognition including partial fills (mismatched contracts).
  - Max profit/loss calculations with edge cases (zero premium, odd lots).
- **Frontend snapshot tests** verifying `StockAnalysis` renders the correct strategy labels and risk summaries.
- **Manual regression** with:
  - Lightweight payload (1–2 legs) – expect full AI output < 10 s.
  - Heavy payload (6+ legs + research) – ensure deterministic data returns instantly; AI summary either succeeds or reports timeout without crashing.
  - ETHA & IBIT portfolios to confirm legacy behaviour.

## Rollout & Monitoring
- Deploy first to preview (or run via `supabase functions serve`) using the Deno inspector to watch timings.
- After Phase 3 deploy, monitor Supabase logs for `duration` and ensure no `EarlyDrop` events occur for typical payloads.
- Keep the timeout guard even after prompt slimming as a safety net, but it should rarely trigger once deterministic calculations are removed from the LLM step.

## Risks & Mitigations
- **Regression in JSON contract** → Mitigate with snapshot tests and by retaining legacy keys (populate both old and new fields until the UI switches).
- **Strategy detection edge cases** (e.g., overlapping spreads) → Log detection decisions and expose unknown strategies in a safe fallback state.
- **Client-side calculation drift** → Keep shared utility (`strategies.ts`) in a common package imported by both client and server (or generate the module and bundle with Vite).

## Next Steps
1. Implement Phase 0 instrumentation + timeout guard.
2. Execute Phase 1 extraction and validate with unit tests.
3. Move on to Phase 2 & 3 iteratively, ensuring each stage leaves the system in a stable, deployable state.

