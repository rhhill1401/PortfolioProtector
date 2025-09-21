const unicodeMinusPattern = /[\u2010-\u2015\u2212]/g;

export const parseContractCount = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string') {
    let trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    // Parentheses often indicate a negative quantity
    let isParenNegative = false;
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      isParenNegative = true;
      trimmed = trimmed.slice(1, -1).trim();
    }

    const cleaned = trimmed.replace(/,/g, '');
    const match = cleaned.match(/[+-]?\d+(?:\.\d+)?/);
    if (!match) {
      return null;
    }

    const parsed = Number(match[0]);
    if (Number.isNaN(parsed)) {
      return null;
    }

    const withParen = isParenNegative && parsed > 0 && !match[0].startsWith('-')
      ? -parsed
      : parsed;

    return Math.trunc(withParen);
  }

  return null;
};

const quantityTokenRegex = /[+-]?\d+(?:[.,]\d+)?/;

export interface QuantityParseResult {
  contracts: number | null;
  normalizedText: string;
  confidence: 'HIGH' | 'LOW';
}

export const parseContractsFromQuantityText = (quantityText: unknown): QuantityParseResult => {
  if (typeof quantityText !== 'string') {
    return { contracts: null, normalizedText: '', confidence: 'LOW' };
  }

  let raw = quantityText.trim();
  if (!raw) {
    return { contracts: null, normalizedText: '', confidence: 'LOW' };
  }

  raw = raw.replace(unicodeMinusPattern, '-');

  let working = raw;
  let negativeViaParens = false;
  if (/^\(.*\)$/.test(working)) {
    negativeViaParens = true;
    working = working.slice(1, -1).trim();
  }

  working = working.replace(/,/g, '');
  working = working.replace(/([+-])\s+(?=\d)/, '$1');

  const match = working.match(quantityTokenRegex);
  if (!match) {
    return { contracts: null, normalizedText: raw, confidence: 'LOW' };
  }

  const token = match[0];
  const numeric = Number(token.replace(',', '.'));
  if (Number.isNaN(numeric)) {
    return { contracts: null, normalizedText: raw, confidence: 'LOW' };
  }

  const magnitude = Math.trunc(Math.abs(numeric));
  const hasExplicitMinus = token.trim().startsWith('-');
  const isNegative = negativeViaParens || hasExplicitMinus;
  const contracts = isNegative ? -magnitude : magnitude;

  return {
    contracts,
    normalizedText: raw,
    confidence: 'HIGH',
  };
};
