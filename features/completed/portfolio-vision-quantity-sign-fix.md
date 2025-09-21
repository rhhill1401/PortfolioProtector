# Portfolio Vision Quantity Sign Enforcement

## Summary
- Replaced heuristic sign inference with a deterministic rule based solely on the Quantity column text extracted from brokerage screenshots.
- Required the OpenAI prompt to emit the raw `quantityText` and optional `positionText` for every option leg.
- Added a robust parser that removes suffix markers (e.g., `M`), normalises Unicode minus signs, handles parentheses, and derives the signed contract count.
- Introduced a follow-up vision pass that re-reads the Quantity column whenever the primary response lacks usable text, then overrides the model’s guess.
- Logged sign corrections and direction confidence for observability.

## Implementation Highlights
- **Prompt update:** instructs the model to capture `quantityText`, treat minus signs/parentheses as SOLD, and avoid guessing; sample JSON shows these fields.
- **Post-processing:** `parseContractsFromQuantityText` enforces the sign, stores `signSource` + `directionConfidence`, and records metrics (`ℹ️ [PORTFOLIO VISION] Quantity sign enforcement ...`).
- **Secondary pass:** when the first pass cannot produce `quantityText`, a targeted follow-up call captures the raw cell text before finalising `contracts`.
- **Unit coverage:** new tests in `tests/unit/portfolio-vision-utils.test.ts` cover cases like `5 M`, `-5 M`, `(5)`, Unicode minus, spaced negatives, etc.
- **Deployment:** redeployed `portfolio-vision`; verified the ETHA screenshot now returns the 30 PUT as `contracts: 5`, `position: "LONG"`, `quantityText: "5 M"`.

## Verification
- `npm run lint` (with existing repo warnings elsewhere).
- `npx vitest run tests/unit/portfolio-vision-utils.test.ts`.
- Live function call with the ETHA screenshot; JSON saved at `tests/outputs/portfolio-vision-etha-latest.json` shows the corrected contracts/sign source.

## Caveat / Next Step
If the quantity cell remains unreadable after both passes, the code can still fall back to the model’s `positionText` hint. In those rare cases, consider setting `contracts = null` so the UI displays “unknown” instead of guessing.

## Example After Fix
- Quantity cell "(5)" ⇒ parser returns `contracts: -5`, `signSource: 'quantityText'` → SOLD PUT.
- Quantity cell "5 M" ⇒ parser returns `contracts: 5`, `signSource: 'quantityText'` → BOUGHT PUT.
- Quantity cell unreadable, row says "Long" ⇒ follow-up tries again. If still unreadable, recommended enhancement is to leave `contracts = null` to avoid mislabelling.
