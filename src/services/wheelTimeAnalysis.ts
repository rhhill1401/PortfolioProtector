/**
 * Time-based analysis for wheel strategy positions
 */

export interface TimeGroupedPosition {
  timeframe: '30-days' | '90-days' | 'long-term';
  label: string;
  expiryDate: string;
  positions: any[]; // Will use the actual position type from analysis
  totalPremiumCollected: number;
  totalSharesAtRisk: number;
  totalCostToClose: number;
  netPL: number;
  avgAssignmentProb: number;
}

export function groupPositionsByTimeframe(
  positions: any[],
  wheelQuotes: any[]
): TimeGroupedPosition[] {
  const today = new Date();
  const groups: TimeGroupedPosition[] = [];
  
  // Helper to calculate days to expiry
  const getDaysToExpiry = (expiryStr: string): number => {
    const expiryDate = new Date(expiryStr);
    return Math.max(0, Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  };
  
  // Group positions
  const thirtyDayPositions = positions.filter(p => {
    const days = getDaysToExpiry(p.expiry);
    return days > 0 && days <= 30;
  });
  
  const ninetyDayPositions = positions.filter(p => {
    const days = getDaysToExpiry(p.expiry);
    return days > 30 && days <= 90;
  });
  
  const longTermPositions = positions.filter(p => {
    const days = getDaysToExpiry(p.expiry);
    return days > 90;
  });
  
  // Helper to calculate metrics for a group
  const calculateGroupMetrics = (groupPositions: any[], label: string, timeframe: TimeGroupedPosition['timeframe']) => {
    if (groupPositions.length === 0) return null;
    
    let totalPremiumCollected = 0;
    let totalSharesAtRisk = 0;
    let totalCostToClose = 0;
    let totalDelta = 0;
    let deltaCount = 0;
    
    // Get the latest expiry date in this group
    let latestExpiry = groupPositions[0].expiry;
    
    groupPositions.forEach(pos => {
      // Premium collected - check both field names (backend uses 'premium', frontend expects 'premiumCollected')
      const premium = pos.premiumCollected || pos.premium || 0;
      const isPerShare = premium < 50;
      const premiumTotal = isPerShare ? premium * 100 * Math.abs(pos.contracts || 0) : premium;
      totalPremiumCollected += premiumTotal;
      
      // Shares at risk (contracts * 100)
      totalSharesAtRisk += Math.abs(pos.contracts || 0) * 100;
      
      // Find matching quote for cost to close
      const quote = wheelQuotes.find(q => 
        q.symbol === pos.symbol && 
        q.strike === pos.strike && 
        q.expiry === pos.expiry
      );
      
      if (quote?.success && quote.quote) {
        const costPerContract = (quote.quote.bid + quote.quote.ask) / 2 || quote.quote.last || 0;
        totalCostToClose += costPerContract * 100 * Math.abs(pos.contracts || 0);
      } else {
        // Fallback to current value if no quote
        // currentValue is already the total value for all contracts, so just use it directly
        totalCostToClose += Math.abs(pos.currentValue || 0);
      }
      
      // Track delta for assignment probability
      if (pos.delta !== null && pos.delta !== undefined) {
        totalDelta += Math.abs(pos.delta);
        deltaCount++;
      }
      
      // Update latest expiry
      if (new Date(pos.expiry) > new Date(latestExpiry)) {
        latestExpiry = pos.expiry;
      }
    });
    
    const netPL = totalPremiumCollected - totalCostToClose;
    const avgAssignmentProb = deltaCount > 0 ? (totalDelta / deltaCount) : 0;
    
    return {
      timeframe,
      label,
      expiryDate: latestExpiry,
      positions: groupPositions,
      totalPremiumCollected,
      totalSharesAtRisk,
      totalCostToClose,
      netPL,
      avgAssignmentProb
    };
  };
  
  // Build groups
  const thirtyDayGroup = calculateGroupMetrics(thirtyDayPositions, 'Next 30 Days', '30-days');
  const ninetyDayGroup = calculateGroupMetrics(ninetyDayPositions, 'Next 31-90 Days', '90-days');
  const longTermGroup = calculateGroupMetrics(longTermPositions, 'Long Term (90+ Days)', 'long-term');
  
  // Add non-empty groups
  if (thirtyDayGroup) groups.push(thirtyDayGroup);
  if (ninetyDayGroup) groups.push(ninetyDayGroup);
  if (longTermGroup) groups.push(longTermGroup);
  
  return groups;
}

export function formatExpiryLabel(expiryDate: string): string {
  const date = new Date(expiryDate);
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month} ${day}, ${year}`;
}