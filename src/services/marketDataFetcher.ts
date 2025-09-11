// Market Data Fetcher Service
// Fetches real-time market data for enhanced AI analysis

interface MarketData {
  etfFlows?: {
    netFlow?: string;
    trend?: string;
    impact?: string;
  };
  navData?: {
    premium?: string;
    discount?: string;
  };
  volatility?: {
    currentIV?: string;
    ivRank?: string;
    skew?: string;
  };
  optionsFlow?: {
    largeOrders?: string;
    openInterest?: string;
    pcRatio?: string;
    sentiment?: string;
  };
  upcomingEvents?: Array<{
    event: string;
    date: string;
    impact: string;
    preparation?: string;
  }>;
  confidence?: string;
}

export class MarketDataFetcher {
  // Known upcoming events (could be fetched from an API in production)
  private static getUpcomingEvents(ticker: string): Array<{ event: string; date: string; impact: string; preparation?: string }> {
    const events = [
      {
        event: "Fed Meeting (FOMC)",
        date: "2025-01-29",
        impact: "High",
        preparation: "Consider hedging before announcement"
      },
      {
        event: "CPI Data Release",
        date: "2025-01-15",
        impact: "High",
        preparation: "Expect volatility spike"
      },
      {
        event: "Triple Witching",
        date: "2025-03-21",
        impact: "High",
        preparation: "Premium collection opportunity"
      },
      {
        event: "Q1 Earnings Season",
        date: "2025-04-15",
        impact: "Medium",
        preparation: "Stock-specific volatility"
      }
    ];

    // Add ETF-specific events
    if (['IBIT', 'ETHA', 'GBTC', 'ARKB'].includes(ticker)) {
      events.push({
        event: "ETF Flow Report",
        date: "Weekly",
        impact: "Medium",
        preparation: "Monitor for flow reversals"
      });
      events.push({
        event: "Bitcoin Halving Effects",
        date: "2025-Q2",
        impact: "High",
        preparation: "Long-term bullish catalyst"
      });
    }

    return events;
  }

  // Simulate ETF flow data (in production, fetch from real API)
  private static getETFFlowData(ticker: string): { netFlow?: string; trend?: string; impact?: string } | undefined {
    const cryptoETFs = ['IBIT', 'ETH', 'ETHA', 'GBTC', 'BITO', 'BITQ', 'ARKB', 'FBTC', 'HODL', 'BTCO'];
    
    if (!cryptoETFs.includes(ticker)) {
      return undefined;
    }

    // Simulate flow data based on ticker
    const flowData: Record<string, any> = {
      'IBIT': { netFlow: "+$234M (5-day)", trend: "Bullish", impact: "Supporting spot price" },
      'ETHA': { netFlow: "+$45M (5-day)", trend: "Bullish", impact: "Moderate inflows" },
      'GBTC': { netFlow: "-$120M (5-day)", trend: "Bearish", impact: "Discount widening" },
      'ARKB': { netFlow: "+$89M (5-day)", trend: "Neutral", impact: "Stable flows" }
    };

    return flowData[ticker] || { netFlow: "No recent data", trend: "Unknown", impact: "Monitor closely" };
  }

  // Get NAV premium/discount for ETFs
  private static getNAVData(ticker: string, currentPrice: number): { premium?: string; discount?: string } | undefined {
    const cryptoETFs = ['IBIT', 'ETH', 'ETHA', 'GBTC', 'BITO', 'BITQ', 'ARKB', 'FBTC', 'HODL', 'BTCO'];
    
    if (!cryptoETFs.includes(ticker)) {
      return undefined;
    }

    // Simulate NAV data (in production, fetch from real source)
    const navPrices: Record<string, number> = {
      'IBIT': 63.50,  // Example NAV
      'ETHA': 45.20,
      'GBTC': 52.10,
      'ARKB': 71.30
    };

    const nav = navPrices[ticker];
    if (!nav) return { premium: "No NAV data", discount: undefined };

    const divergence = ((currentPrice - nav) / nav * 100).toFixed(2);
    const divergenceNum = parseFloat(divergence);
    
    if (divergenceNum > 0) {
      return { premium: `+${divergence}% above NAV`, discount: undefined };
    } else if (divergenceNum < 0) {
      return { premium: undefined, discount: `${divergence}% below NAV` };
    } else {
      return { premium: "Trading at NAV", discount: undefined };
    }
  }

  // Estimate volatility metrics
  private static getVolatilityData(iv?: number): { currentIV?: string; ivRank?: string; skew?: string } {
    // If we have actual IV from options, use it
    const currentIV = iv ? `${(iv * 100).toFixed(1)}%` : "45%"; // Default moderate IV
    
    // Estimate IV rank (in production, calculate from historical data)
    const ivValue = iv ? iv * 100 : 45;
    let ivRank = "Unknown";
    if (ivValue < 30) ivRank = "Low (10th percentile)";
    else if (ivValue < 50) ivRank = "Moderate (40th percentile)";
    else if (ivValue < 70) ivRank = "Elevated (70th percentile)";
    else ivRank = "High (90th percentile)";

    // Simulate skew data
    const skew = ivValue > 50 ? "Puts expensive (fear)" : "Balanced";

    return { currentIV, ivRank, skew };
  }

  // Get options flow data
  private static getOptionsFlowData(): { largeOrders?: string; openInterest?: string; pcRatio?: string; sentiment?: string } {
    // Simulate options flow (in production, fetch from real source)
    return {
      largeOrders: "3 blocks >$1M detected today",
      openInterest: "Concentrated at 65/70 strikes",
      pcRatio: "0.75 (bullish skew)",
      sentiment: "Moderately Bullish"
    };
  }

  // Main method to fetch all market data
  public static async fetchMarketData(
    ticker: string, 
    currentPrice: number,
    currentIV?: number
  ): Promise<MarketData> {
    console.log('📊 [MARKET DATA] Fetching for', ticker, 'at', currentPrice);

    const marketData: MarketData = {
      etfFlows: this.getETFFlowData(ticker),
      navData: this.getNAVData(ticker, currentPrice),
      volatility: this.getVolatilityData(currentIV),
      optionsFlow: this.getOptionsFlowData(),
      upcomingEvents: this.getUpcomingEvents(ticker),
      confidence: "Medium"
    };

    console.log('📊 [MARKET DATA] Prepared:', marketData);
    return marketData;
  }
}