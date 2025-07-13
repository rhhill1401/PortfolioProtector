# Integrated Analysis Response Structure

## Overview
This document shows the exact data structure returned by the integrated-analysis edge function when portfolio positions, charts, and price data are uploaded.

## Complete Response Structure

```json
{
  "success": true,
  "analysis": {
    "wheelStrategy": {
      "shareCount": 1400,
      "currentPhase": "COVERED_CALL",
      "currentPositions": [
        {
          "strike": 61,
          "expiry": "Jul-18-2025",
          "type": "CALL",
          "contracts": -1,
          "premium": 228.32,
          "currentValue": 635,
          "profitLoss": -406.68,
          "analysis": "Losing position with a high assignment risk as the current price is above the strike. Consider rolling to a higher strike.",
          "nextAction": "Roll to a higher strike to capture more premium and reduce assignment risk."
        }
        // ... more positions
      ]
    },
    "summary": {
      "currentPrice": 67.21,
      "wheelPhase": "COVERED_CALL",
      "overallAssessment": "The current option positions are losing due to the stock price being above the strike prices, increasing assignment risk."
    },
    "recommendation": [
      {"name": "Sell Calls", "value": 7},
      {"name": "Wait", "value": 2},
      {"name": "Close Position", "value": 1}
    ],
    "technicalFactors": [
      {
        "factor": "Strike Selection",
        "value": "USE ONLY PROVIDED PRICES",
        "interpretation": "The current price is above all strike prices, indicating a need to reassess strike selection.",
        "impact": "High risk of assignment; consider rolling to higher strikes.",
        "score": 5
      }
    ],
    "entryPoints": [
      {
        "zone": "Covered Call Strike",
        "price": "70",
        "timing": "45 days to expiration",
        "rationale": "Select a strike above current price to reduce assignment risk and capture premium."
      }
    ],
    "exitPoints": [
      {
        "target": "50% Profit Target",
        "gain": "50% of max profit",
        "timeframe": "20-25 days"
      }
    ],
    "actionPlan": [
      "Roll current positions to higher strikes using available prices to capture more premium and reduce assignment risk."
    ],
    "optionsStrategy": "Consider rolling covered calls to higher strikes (e.g., 68 or 70) to align with bullish technical indicators and reduce assignment risk."
  }
}
```

## Key Fields for Performance Tab

The Performance Analysis tab uses the following data:

### From `wheelStrategy`:
- `shareCount`: Number of shares owned (1400)
- `currentPhase`: Either "COVERED_CALL" or "CASH_SECURED_PUT"
- `currentPositions`: Array of option positions with:
  - `strike`: Strike price
  - `expiry`: Expiration date
  - `type`: "CALL" or "PUT"
  - `contracts`: Number of contracts (negative = sold)
  - `premium`: Premium collected
  - `currentValue`: Current option value
  - `profitLoss`: P&L on the position
  - `analysis`: AI analysis of the position
  - `nextAction`: Recommended action

### From `summary`:
- `currentPrice`: Current stock price
- `wheelPhase`: Same as currentPhase
- `overallAssessment`: Summary of position status

### From `recommendation`:
- Array of action recommendations with name/value pairs

## Data Flow

1. **Frontend sends** to integrated-analysis:
   - ticker: "IBIT"
   - portfolio: Complete portfolio data from portfolio-vision
   - chartMetrics: Technical analysis from charts
   - priceContext: Current price data

2. **Integrated-analysis returns**:
   - Complete analysis object as shown above

3. **StockAnalysis component**:
   - Receives data via `analysis-ready` event
   - Normalizes data (handles both wheelAnalysis and wheelStrategy)
   - Sets state with `setAnalysisData(normalizedData)`

4. **Performance Tab**:
   - Accesses data via `analysisData.wheelStrategy`
   - Renders positions, metrics, and recommendations

## Notes

- The AI correctly identifies all uploaded positions
- Contract counts preserve negative values for sold positions
- The response includes specific analysis for each position
- All monetary values are in dollars
- Dates are in readable format (e.g., "Jul-18-2025")