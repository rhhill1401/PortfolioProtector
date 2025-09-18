import { assertEquals } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import {
  analyzeWheelStrategy,
  type PortfolioData,
  type ChartMetric,
  type PriceContext,
  type OptionQuote,
} from "../strategies.ts";

const baseQuote = (overrides: Partial<OptionQuote>): OptionQuote => ({
  ticker: "ETHA",
  strike: 36,
  expiry: "2025-10-17",
  type: "CALL",
  dte: 30,
  mid: 0.5,
  bid: 0.45,
  ask: 0.55,
  delta: 0.42,
  gamma: 0.01,
  theta: -0.02,
  vega: 0.1,
  iv: 0.55,
  openInterest: 1000,
  dayVolume: 100,
  lastUpdated: Date.now(),
  ...overrides,
});

Deno.test("analyzeWheelStrategy detects covered call", () => {
  const portfolio: PortfolioData = {
    positions: [{ symbol: "ETHA", quantity: 100, purchasePrice: 30 }],
    cashBalance: 2000,
    metadata: {
      optionPositions: [
        {
          symbol: "ETHA",
          strike: 36,
          optionType: "CALL",
          contracts: -1,
          premiumCollected: 2.5,
          currentValue: 0.25,
          expiry: "2025-10-17",
          position: "SHORT",
        },
      ],
    },
  };

  const optionGreeks: Record<string, OptionQuote> = {
    "ETHA-36-2025-10-17-CALL": baseQuote({}),
  };

  const priceContext: PriceContext = { current: 34, high: 35, low: 30 };

  const result = analyzeWheelStrategy({
    ticker: "ETHA",
    portfolio,
    priceContext,
    optionGreeks,
  });

  assertEquals(result.wheelPhase, "COVERED_CALL");
  assertEquals(result.currentOptionPositions.length, 1);
  assertEquals(result.totalPremiumCollected, 250);
  assertEquals(result.totalContracts, 1);
});

Deno.test("analyzeWheelStrategy detects cash secured put", () => {
  const portfolio: PortfolioData = {
    positions: [],
    cashBalance: 10000,
    metadata: {
      optionPositions: [
        {
          symbol: "ETHA",
          strike: 30,
          optionType: "PUT",
          contracts: -1,
          premiumCollected: 1.8,
          currentValue: 0.5,
          expiry: "2025-10-17",
          position: "SHORT",
        },
      ],
    },
  };

  const optionGreeks: Record<string, OptionQuote> = {
    "ETHA-30-2025-10-17-PUT": baseQuote({
      strike: 30,
      type: "PUT",
      delta: -0.35,
    }),
  };

  const priceContext: PriceContext = { current: 29.5, high: 32, low: 28 };
  const chartMetrics: ChartMetric[] = [
    {
      timeframe: "Daily",
      rsi: "58",
      macd: "Bullish",
      trend: "Uptrend",
      keyLevels: [
        { price: 35, type: "Resistance", strength: "strong" },
        { price: 28, type: "Support", strength: "medium" },
      ],
    },
  ];

  const result = analyzeWheelStrategy({
    ticker: "ETHA",
    portfolio,
    priceContext,
    optionGreeks,
    chartMetrics,
  });

  assertEquals(result.wheelPhase, "CASH_SECURED_PUT");
  assertEquals(result.currentOptionPositions.length, 1);
  assertEquals(result.totalPremiumCollected, 180);
  assertEquals(result.callStrikeZone.length, 1); // resistance level above price
});
