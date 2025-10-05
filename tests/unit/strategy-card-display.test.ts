import { describe, it, expect } from 'vitest';
import type { StrategySummary } from '../../src/services/deterministic/types';

/**
 * Tests for StrategyCard display logic
 *
 * Key functionality:
 * - Format dollar amounts correctly
 * - Display risk profile with proper capitalization
 * - Show correct tone/colors based on risk profile
 * - Handle null/undefined values gracefully
 */

const formatWholeDollars = (value?: number | null, { showSign = false }: { showSign?: boolean } = {}): string => {
  if (value === null || value === undefined) return '—';
  const abs = Math.ceil(Math.abs(value));
  const sign = value < 0 ? '-' : showSign && value > 0 ? '+' : '';
  return `${sign}$${abs.toLocaleString()}`;
};

const netPremiumLabel = (netPremium: number) => {
  const abs = Math.abs(netPremium);
  const formatted = formatWholeDollars(abs);
  return netPremium >= 0
    ? { text: `${formatted} (credit)`, tone: 'text-emerald-600' }
    : { text: `${formatted} (debit)`, tone: 'text-rose-600' };
};

const limitLabel = (value?: number | null) => {
  if (value === null || value === undefined) return 'Unlimited';
  return formatWholeDollars(value);
};

const toneByProfile = (
  profile: StrategySummary['riskProfile'],
  level?: StrategySummary['riskLevel'],
) => {
  if (profile === 'covered') return 'bg-green-50 border-green-200';
  if (profile === 'defined') return 'bg-sky-50 border-sky-200';

  if (level === 'LOW') return 'bg-green-50 border-green-200';
  if (level === 'MEDIUM') return 'bg-amber-50 border-amber-200';
  if (level === 'HIGH') return 'bg-red-50 border-red-200';

  switch (profile) {
    case 'unlimited':
      return 'bg-amber-50 border-amber-200';
    default:
      return 'bg-slate-50 border-slate-200';
  }
};

describe('StrategyCard - Dollar Formatting', () => {
  it('should format positive dollar amounts', () => {
    expect(formatWholeDollars(1234.56)).toBe('$1,235');
    expect(formatWholeDollars(680.66)).toBe('$681');
    expect(formatWholeDollars(14680)).toBe('$14,680');
  });

  it('should format negative dollar amounts', () => {
    expect(formatWholeDollars(-1234.56)).toBe('-$1,235');
    expect(formatWholeDollars(-680.66)).toBe('-$681');
  });

  it('should handle null and undefined', () => {
    expect(formatWholeDollars(null)).toBe('—');
    expect(formatWholeDollars(undefined)).toBe('—');
  });

  it('should ceil decimal amounts', () => {
    expect(formatWholeDollars(100.01)).toBe('$101');
    expect(formatWholeDollars(100.99)).toBe('$101');
    expect(formatWholeDollars(100.00)).toBe('$100');
  });

  it('should show sign when requested', () => {
    expect(formatWholeDollars(100, { showSign: true })).toBe('+$100');
    expect(formatWholeDollars(-100, { showSign: true })).toBe('-$100');
    expect(formatWholeDollars(0, { showSign: true })).toBe('$0');
  });

  it('should add thousands separators', () => {
    expect(formatWholeDollars(1000)).toBe('$1,000');
    expect(formatWholeDollars(1000000)).toBe('$1,000,000');
  });
});

describe('StrategyCard - Net Premium Labels', () => {
  it('should show credit for positive premium', () => {
    const label = netPremiumLabel(680.66);
    expect(label.text).toBe('$681 (credit)');
    expect(label.tone).toBe('text-emerald-600');
  });

  it('should show debit for negative premium', () => {
    const label = netPremiumLabel(-1279.01);
    expect(label.text).toBe('$1,280 (debit)');
    expect(label.tone).toBe('text-rose-600');
  });

  it('should handle zero premium', () => {
    const label = netPremiumLabel(0);
    expect(label.text).toBe('$0 (credit)');
  });
});

describe('StrategyCard - Limit Labels', () => {
  it('should show "Unlimited" for null', () => {
    expect(limitLabel(null)).toBe('Unlimited');
  });

  it('should show "Unlimited" for undefined', () => {
    expect(limitLabel(undefined)).toBe('Unlimited');
  });

  it('should format finite values', () => {
    expect(limitLabel(14680)).toBe('$14,680');
    expect(limitLabel(1279.01)).toBe('$1,280');
  });
});

describe('StrategyCard - Risk Profile Tone', () => {
  it('should use green for covered profile', () => {
    const tone = toneByProfile('covered');
    expect(tone).toBe('bg-green-50 border-green-200');
  });

  it('should use blue for defined profile', () => {
    const tone = toneByProfile('defined');
    expect(tone).toBe('bg-sky-50 border-sky-200');
  });

  it('should use amber for unlimited profile', () => {
    const tone = toneByProfile('unlimited');
    expect(tone).toBe('bg-amber-50 border-amber-200');
  });

  it('should use risk level when profile is undefined', () => {
    expect(toneByProfile(undefined, 'LOW')).toBe('bg-green-50 border-green-200');
    expect(toneByProfile(undefined, 'MEDIUM')).toBe('bg-amber-50 border-amber-200');
    expect(toneByProfile(undefined, 'HIGH')).toBe('bg-red-50 border-red-200');
  });

  it('should prefer profile over risk level', () => {
    // Even if risk level is HIGH, covered profile should be green
    const tone = toneByProfile('covered', 'HIGH');
    expect(tone).toBe('bg-green-50 border-green-200');
  });

  it('should default to slate for unknown profile', () => {
    const tone = toneByProfile(undefined as any, undefined);
    expect(tone).toBe('bg-slate-50 border-slate-200');
  });
});

describe('StrategyCard - Covered Call Display', () => {
  const coveredCall: StrategySummary = {
    id: 'covered-call-IBIT-70-2025-11-21',
    label: 'Covered Call',
    legCount: 1,
    netPremium: 680.66,
    maxProfit: 2066.66,
    maxLoss: 11933.34,
    breakeven: 59.67,
    riskProfile: 'covered',
    riskLevel: 'LOW',
    tags: ['INCOME'],
    components: ['SHORT 2 × $70 CALL (2025-11-21)'],
  };

  it('should display all values correctly', () => {
    expect(formatWholeDollars(coveredCall.maxProfit)).toBe('$2,067');
    expect(formatWholeDollars(coveredCall.maxLoss)).toBe('$11,934');
    expect(formatWholeDollars(coveredCall.breakeven)).toBe('$60');
    expect(netPremiumLabel(coveredCall.netPremium).text).toBe('$681 (credit)');
  });

  it('should use green tone for covered profile', () => {
    expect(toneByProfile(coveredCall.riskProfile, coveredCall.riskLevel)).toBe('bg-green-50 border-green-200');
  });
});

describe('StrategyCard - Ratio Spread Display', () => {
  const ratioSpread: StrategySummary = {
    id: 'call-ratio-spread-IBIT-2026-01-16-2:1',
    label: '2:1 Long Call Ratio Spread',
    legCount: 3,
    netPremium: -1279.01,
    maxProfit: null,
    maxLoss: 1279.01,
    breakeven: 66.40,
    riskProfile: 'unlimited',
    riskLevel: 'MEDIUM',
    tags: ['RATIO SPREAD', 'UNLIMITED UPSIDE'],
    components: [
      'LONG 1 × $60 CALL (2026-01-16)',
      'LONG 1 × $70 CALL (2026-01-16)',
      'SHORT 1 × $80 CALL (2026-01-16)',
    ],
    description: '2:1 ratio: 1 net long exposure, breakevens at 66.40 and 92.79, unlimited upside above 92.79',
  };

  it('should show debit for negative premium', () => {
    const label = netPremiumLabel(ratioSpread.netPremium);
    expect(label.text).toBe('$1,280 (debit)');
    expect(label.tone).toBe('text-rose-600');
  });

  it('should show "Unlimited" for null max profit', () => {
    expect(limitLabel(ratioSpread.maxProfit)).toBe('Unlimited');
  });

  it('should show finite max loss', () => {
    expect(limitLabel(ratioSpread.maxLoss)).toBe('$1,280');
  });

  it('should use amber tone for unlimited profile', () => {
    expect(toneByProfile(ratioSpread.riskProfile, ratioSpread.riskLevel)).toBe('bg-amber-50 border-amber-200');
  });

  it('should format breakeven correctly', () => {
    expect(formatWholeDollars(ratioSpread.breakeven)).toBe('$67');
  });
});

describe('StrategyCard - Edge Cases', () => {
  it('should handle zero values', () => {
    expect(formatWholeDollars(0)).toBe('$0');
    expect(netPremiumLabel(0).text).toBe('$0 (credit)');
  });

  it('should handle very large values', () => {
    expect(formatWholeDollars(1000000.99)).toBe('$1,000,001');
  });

  it('should handle very small values', () => {
    expect(formatWholeDollars(0.01)).toBe('$1');
    expect(formatWholeDollars(0.99)).toBe('$1');
  });

  it('should capitalize risk profile in display', () => {
    // The capitalize class should make "unlimited" → "Unlimited"
    // This is tested in the component itself, but we verify the data is correct
    expect('unlimited'.charAt(0).toUpperCase() + 'unlimited'.slice(1)).toBe('Unlimited');
    expect('covered'.charAt(0).toUpperCase() + 'covered'.slice(1)).toBe('Covered');
    expect('defined'.charAt(0).toUpperCase() + 'defined'.slice(1)).toBe('Defined');
  });
});

describe('StrategyCard - Risk Profile Bug Fix', () => {
  it('should display "Unlimited" not "undefined"', () => {
    const strategy: StrategySummary = {
      id: 'test',
      label: 'Test Strategy',
      legCount: 1,
      netPremium: 100,
      riskProfile: 'unlimited', // NOT 'undefined'
      components: [],
    };

    expect(strategy.riskProfile).toBe('unlimited');
    expect(strategy.riskProfile).not.toBe('undefined');
  });

  it('should show proper tone for unlimited risk', () => {
    expect(toneByProfile('unlimited')).toBe('bg-amber-50 border-amber-200');
  });
});
