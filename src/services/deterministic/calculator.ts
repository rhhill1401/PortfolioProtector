import type { PositionDet, StrategySummary } from './types';

type WheelPhase = 'COVERED_CALL' | 'CASH_SECURED_PUT';

type DetectArgs = {
  positions: PositionDet[];
  shareCount: number;
  cashBalance: number;
  currentPrice: number;
};

type DetectResult = {
  strategies: StrategySummary[];
  wheelPhase: WheelPhase;
};

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

const formatLeg = (dir: 'LONG' | 'SHORT', qty: number, pos: PositionDet): string => {
  const strike = currency.format(pos.strike).replace('$', '$');
  return `${dir} ${qty} × ${strike} ${pos.type} (${pos.expiry})`;
};

const perContractPremium = (pos: PositionDet): number => {
  const total = Math.abs(pos.premium ?? pos.premiumCollected ?? 0);
  const qty = Math.max(Math.abs(pos.contracts), 1);
  return total / qty;
};

const signAwarePremium = (pos: PositionDet, qty: number): number => {
  const totalPerContract = perContractPremium(pos);
  const base = totalPerContract * qty;
  return pos.contracts < 0 ? base : -base; // sold = credit, bought = debit
};

const determineWheelPhase = (
  shareCount: number,
  positions: PositionDet[],
  cashBalance: number,
): WheelPhase => {
  const hasShortCalls = positions.some((p) => p.type === 'CALL' && p.contracts < 0);
  const hasShortPuts = positions.some((p) => p.type === 'PUT' && p.contracts < 0);
  const largestPut = positions
    .filter((p) => p.type === 'PUT' && p.contracts < 0)
    .reduce((max, p) => Math.max(max, p.strike * 100 * Math.abs(p.contracts)), 0);

  if (shareCount >= 100 && hasShortCalls) return 'COVERED_CALL';
  if (hasShortPuts && cashBalance >= largestPut) return 'CASH_SECURED_PUT';
  return shareCount >= 100 ? 'COVERED_CALL' : 'CASH_SECURED_PUT';
};

const detectCoveredCalls = (
  positions: PositionDet[],
  shareCount: number,
  currentPrice: number,
): StrategySummary[] => {
  const soldCalls = positions
    .filter((p) => p.type === 'CALL' && p.contracts < 0)
    .sort((a, b) => (a.expiry === b.expiry ? a.strike - b.strike : a.expiry.localeCompare(b.expiry)));

  let remainingShares = shareCount;
  const strategies: StrategySummary[] = [];

  soldCalls.forEach((call, index) => {
    const availableContracts = Math.floor(remainingShares / 100);
    if (availableContracts <= 0) {
      return;
    }
    const callContracts = Math.abs(call.contracts);
    const coveredQty = Math.min(availableContracts, callContracts);
    if (coveredQty <= 0) {
      return;
    }

    remainingShares -= coveredQty * 100;

    const netPremium = signAwarePremium(call, coveredQty);
    const upside = Math.max(call.strike - currentPrice, 0) * 100 * coveredQty;
    const maxProfit = netPremium + upside;

    strategies.push({
      id: `covered-call-${call.symbol}-${call.strike}-${call.expiry}-${index}`,
      label: 'Covered Call',
      legCount: 1,
      netPremium,
      maxProfit,
      maxLoss: null,
      riskProfile: 'covered',
      riskLevel: 'LOW',
      tags: ['INCOME'],
      components: [formatLeg('SHORT', coveredQty, call)],
      description: `${coveredQty * 100} shares covered at $${call.strike.toFixed(2)}`,
    });
  });

  return strategies;
};

const detectBullCallSpreads = (positions: PositionDet[]): StrategySummary[] => {
  const strategies: StrategySummary[] = [];

  type RemainingLeg = PositionDet & { remaining: number };
  const groups = new Map<string, { longs: RemainingLeg[]; shorts: RemainingLeg[] }>();

  positions
    .filter((p) => p.type === 'CALL')
    .forEach((pos) => {
      const key = `${pos.symbol}|${pos.expiry}`;
      if (!groups.has(key)) {
        groups.set(key, { longs: [], shorts: [] });
      }
      const bucket = groups.get(key)!;
      if (pos.contracts > 0) {
        bucket.longs.push({ ...pos, remaining: pos.contracts });
      } else if (pos.contracts < 0) {
        bucket.shorts.push({ ...pos, remaining: Math.abs(pos.contracts) });
      }
    });

  groups.forEach(({ longs, shorts }) => {
    longs.sort((a, b) => a.strike - b.strike);
    shorts.sort((a, b) => a.strike - b.strike);

    longs.forEach((longLeg) => {
      shorts.forEach((shortLeg) => {
        if (longLeg.remaining <= 0 || shortLeg.remaining <= 0) return;
        if (longLeg.strike >= shortLeg.strike) return; // require lower strike long leg

        const quantity = Math.min(longLeg.remaining, shortLeg.remaining);
        if (quantity <= 0) return;

        longLeg.remaining -= quantity;
        shortLeg.remaining -= quantity;

        const netPremium = signAwarePremium(shortLeg, quantity) + signAwarePremium(longLeg, quantity);
        const spreadWidth = (shortLeg.strike - longLeg.strike) * 100 * quantity;
        const debit = netPremium < 0 ? Math.abs(netPremium) : 0;
        const credit = netPremium > 0 ? netPremium : 0;
        const maxProfit = credit > 0 ? spreadWidth - credit : spreadWidth - debit;
        const maxLoss = credit > 0 ? credit : debit;

        strategies.push({
          id: `bull-call-spread-${longLeg.symbol}-${longLeg.expiry}-${longLeg.strike}-${shortLeg.strike}`,
          label: 'Bull Call Spread',
          legCount: 2,
          netPremium,
          maxProfit,
          maxLoss,
          riskProfile: 'defined',
          riskLevel: 'LOW',
          tags: ['SPREAD', 'DEFINED RISK'],
          components: [
            formatLeg('LONG', quantity, longLeg),
            formatLeg('SHORT', quantity, shortLeg),
          ],
        });
      });
    });
  });

  return strategies;
};

const detectCashSecuredPuts = (
  positions: PositionDet[],
  cashBalance: number,
): StrategySummary[] => {
  const strategies: StrategySummary[] = [];

  positions
    .filter((p) => p.type === 'PUT' && p.contracts < 0)
    .forEach((put, index) => {
      const quantity = Math.abs(put.contracts);
      const requirement = put.strike * 100 * quantity;
      if (cashBalance < requirement) return;

      const netPremium = signAwarePremium(put, quantity);
      const maxProfit = netPremium;
      const maxLoss = requirement - netPremium;

      strategies.push({
        id: `cash-secured-put-${put.symbol}-${put.strike}-${put.expiry}-${index}`,
        label: 'Cash Secured Put',
        legCount: 1,
        netPremium,
        maxProfit,
        maxLoss,
        riskProfile: 'defined',
        riskLevel: 'LOW',
        tags: ['INCOME', 'DEFINED RISK'],
        components: [formatLeg('SHORT', quantity, put)],
        description: `Reserved $${(put.strike * 100).toFixed(2)} per contract`,
      });
    });

  return strategies;
};

const detectBullPutSpreads = (positions: PositionDet[]): StrategySummary[] => {
  const strategies: StrategySummary[] = [];

  type RemainingLeg = PositionDet & { remaining: number };
  const groups = new Map<string, { longs: RemainingLeg[]; shorts: RemainingLeg[] }>();

  positions
    .filter((p) => p.type === 'PUT')
    .forEach((pos) => {
      const key = `${pos.symbol}|${pos.expiry}`;
      if (!groups.has(key)) {
        groups.set(key, { longs: [], shorts: [] });
      }
      const bucket = groups.get(key)!;
      if (pos.contracts > 0) {
        bucket.longs.push({ ...pos, remaining: pos.contracts });
      } else if (pos.contracts < 0) {
        bucket.shorts.push({ ...pos, remaining: Math.abs(pos.contracts) });
      }
    });

  groups.forEach(({ longs, shorts }) => {
    // For bull put, long lower strike, short higher strike
    longs.sort((a, b) => a.strike - b.strike); // ascending
    shorts.sort((a, b) => b.strike - a.strike); // descending to match higher strikes first

    longs.forEach((longLeg) => {
      shorts.forEach((shortLeg) => {
        if (longLeg.remaining <= 0 || shortLeg.remaining <= 0) return;
        if (longLeg.strike >= shortLeg.strike) return; // require long lower strike

        const quantity = Math.min(longLeg.remaining, shortLeg.remaining);
        if (quantity <= 0) return;

        longLeg.remaining -= quantity;
        shortLeg.remaining -= quantity;

        const netPremium = signAwarePremium(shortLeg, quantity) + signAwarePremium(longLeg, quantity);
        const spreadWidth = (shortLeg.strike - longLeg.strike) * 100 * quantity;
        const credit = netPremium > 0 ? netPremium : 0;
        const debit = netPremium < 0 ? Math.abs(netPremium) : 0;

        const maxProfit = credit > 0 ? credit : spreadWidth - debit; // prefer credit structure
        const maxLoss = credit > 0 ? spreadWidth - credit : debit;

        strategies.push({
          id: `bull-put-spread-${longLeg.symbol}-${longLeg.expiry}-${longLeg.strike}-${shortLeg.strike}`,
          label: 'Bull Put Spread',
          legCount: 2,
          netPremium,
          maxProfit,
          maxLoss,
          riskProfile: 'defined',
          riskLevel: 'LOW',
          tags: ['SPREAD', 'DEFINED RISK', credit > 0 ? 'CREDIT' : 'DEBIT'],
          components: [
            formatLeg('LONG', quantity, longLeg),
            formatLeg('SHORT', quantity, shortLeg),
          ],
        });
      });
    });
  });

  return strategies;
};

export const detectStrategies = ({
  positions,
  shareCount,
  cashBalance,
  currentPrice,
}: DetectArgs): DetectResult => {
  const strategies: StrategySummary[] = [];

  strategies.push(
    ...detectCoveredCalls(positions, shareCount, currentPrice),
    ...detectBullCallSpreads(positions),
    ...detectBullPutSpreads(positions),
    ...detectCashSecuredPuts(positions, cashBalance),
  );

  // Collapse duplicate IDs by summing quantities/premiums if necessary
  const deduped = new Map<string, StrategySummary>();
  strategies.forEach((strategy) => {
    if (!deduped.has(strategy.id)) {
      deduped.set(strategy.id, strategy);
    } else {
      const existing = deduped.get(strategy.id)!;
      deduped.set(strategy.id, {
        ...existing,
        netPremium: existing.netPremium + strategy.netPremium,
        maxProfit:
          existing.maxProfit != null && strategy.maxProfit != null
            ? existing.maxProfit + strategy.maxProfit
            : existing.maxProfit ?? strategy.maxProfit,
        maxLoss:
          existing.maxLoss != null && strategy.maxLoss != null
            ? existing.maxLoss + strategy.maxLoss
            : existing.maxLoss ?? strategy.maxLoss,
        components: [...existing.components, ...strategy.components],
        tags: Array.from(new Set([...(existing.tags ?? []), ...(strategy.tags ?? [])])),
      });
    }
  });

  const wheelPhase = determineWheelPhase(shareCount, positions, cashBalance);

  return {
    strategies: Array.from(deduped.values()),
    wheelPhase,
  };
};

export const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '—';
  return currency.format(value);
};

export type { DetectArgs, DetectResult };
