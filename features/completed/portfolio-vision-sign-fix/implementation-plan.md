# Portfolio Vision Quantity Sign Enforcement

## Problem
- Brokerage screenshots display option quantities like `5 M` (BOUGHT) and `-5 M` (SOLD).
- The current `portfolio-vision` edge function sometimes infers sign from colours/P&L and returns the wrong sign (e.g., ETHA 30P reported as `-5 SHORT`).
- StockAnalysisV2 renders groups strictly by `contracts` sign, so a wrong sign causes BOUGHT positions to appear under SOLD.

## Goal
Guarantee correct BOUGHT vs SOLD detection by deriving the sign only from the raw quantity text captured from the screenshot. ETHA 30P must return `contracts: 5`, `position: "LONG"` without breaking previously correct legs.

## Not In Scope
- Changing the client grouping logic.
- Using colour/P&L data to infer direction.

## Approach
1. **Prompt Revision**
   - Require the model to return `quantityText` (verbatim Quantity column text) and optional `positionText`.
   - Explicitly instruct the model that the sign *must* be derived from `quantityText` only and that letters like `M` are decoration.
   - Reject responses missing `quantityText` entries.

2. **Post-Processing Override**
   - Add a helper `parseQuantityText` that:
     - Normalises unicode minus and parentheses.
     - Extracts the first signed number token.
     - Sets sign: parentheses or leading minus ⇒ negative; otherwise positive.
   - Override the model’s numeric `contracts` with the parsed result.
   - Derive `position` from the final sign and attach `directionConfidence` plus telemetry of corrections.

3. **Logging & Telemetry**
   - Log when a sign is corrected or when `quantityText` is missing.
   - Keep optional `quantityText`/`positionText` in the returned object for observability.

## Acceptance Criteria
- `npm run lint` passes.
- Unit tests cover `parseQuantityText` edge cases: `5 M`, `-5 M`, `–5`, `(5)`, `+5`, `5`, `5.0`, `- 3`, `-3×`.
- Re-run portfolio-vision with the ETHA screenshot; `ETHA 30 Put` returns `contracts: 5`, `position: "LONG"`; all other legs retain their correct signs.
- Log output indicates corrections where applicable.
- UI groups ETHA 30P under BOUGHT PUTS after the edge function fix.
