import { describe, it, expect } from 'vitest';
import { parseContractsFromQuantityText } from '../../supabase/functions/portfolio-vision/utils';

describe('parseContractsFromQuantityText', () => {
  const cases: Array<[string, number]> = [
    ['5 M', 5],
    ['5M', 5],
    ['+5', 5],
    ['  12  ', 12],
    ['-5 M', -5],
    ['-5M', -5],
    ['–5', -5], // en dash
    ['(5)', -5],
    ['( 10 M )', -10],
    ['- 3', -3],
    ['-3×', -3],
    ['5.0 M', 5],
    ['5,000', 5000],
  ];

  cases.forEach(([input, expected]) => {
    it(`parses "${input}" as ${expected}`, () => {
      const result = parseContractsFromQuantityText(input);
      expect(result.contracts).toBe(expected);
      expect(result.confidence).toBe('HIGH');
    });
  });

  it('returns null for missing string', () => {
    const result = parseContractsFromQuantityText(undefined);
    expect(result.contracts).toBeNull();
    expect(result.confidence).toBe('LOW');
  });

  it('returns null for empty string', () => {
    const result = parseContractsFromQuantityText('   ');
    expect(result.contracts).toBeNull();
    expect(result.confidence).toBe('LOW');
  });

  it('returns null for non-numeric content', () => {
    const result = parseContractsFromQuantityText('N/A');
    expect(result.contracts).toBeNull();
    expect(result.confidence).toBe('LOW');
  });
});
