import clsx from 'clsx';
import type { StrategySummary } from '@/services/deterministic/types';

const formatWholeDollars = (value?: number | null, { showSign = false }: { showSign?: boolean } = {}): string => {
  if (value === null || value === undefined) return '—';
  const abs = Math.ceil(Math.abs(value));
  const sign = value < 0 ? '-' : showSign && value > 0 ? '+' : '';
  return `${sign}$${abs.toLocaleString()}`;
};

// Tone mapping:
// - Covered: green (income overlay on shares)
// - Defined risk (spreads, CSP): blue to match reference design
// - Otherwise fall back to risk level colors (LOW green / MEDIUM amber / HIGH red)
const toneByProfile = (
  profile: StrategySummary['riskProfile'],
  level?: StrategySummary['riskLevel'],
) => {
  // Prefer explicit profile styling to match reference cards
  if (profile === 'covered') return 'bg-green-50 border-green-200';
  if (profile === 'defined') return 'bg-sky-50 border-sky-200';

  // Otherwise use risk levels for undefined profile
  if (level === 'LOW') return 'bg-green-50 border-green-200';
  if (level === 'MEDIUM') return 'bg-amber-50 border-amber-200';
  if (level === 'HIGH') return 'bg-red-50 border-red-200';

  switch (profile) {
    case 'undefined':
      return 'bg-amber-50 border-amber-200';
    default:
      return 'bg-slate-50 border-slate-200';
  }
};

const tagClassNames = (tag: string) =>
  clsx(
    'px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide',
    tag.includes('DEFINED')
      ? 'bg-emerald-100 text-emerald-700'
      : tag.includes('SPREAD')
      ? 'bg-sky-100 text-sky-700'
      : tag.includes('INCOME')
      ? 'bg-amber-100 text-amber-700'
      : 'bg-slate-100 text-slate-600',
  );

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

export interface StrategyCardProps {
  strategy: StrategySummary;
  className?: string;
}

export const StrategyCard = ({ strategy, className }: StrategyCardProps) => {
  const tone = toneByProfile(strategy.riskProfile, strategy.riskLevel);
  const premium = netPremiumLabel(strategy.netPremium);
  const tags = strategy.tags ?? [];

  return (
    <div className={clsx('border rounded-xl p-4 shadow-sm transition-colors', tone, className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900">{strategy.label}</h3>
            {tags.map((tag) => (
              <span key={tag} className={tagClassNames(tag)}>
                {tag}
              </span>
            ))}
            {strategy.riskProfile === 'defined' && !tags.some((tag) => tag.includes('DEFINED')) && (
              <span className={tagClassNames('DEFINED RISK')}>DEFINED RISK</span>
            )}
          </div>
          {strategy.description && (
            <p className="mt-1 text-sm text-slate-600">{strategy.description}</p>
          )}
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-slate-500">Net Premium</div>
          <div className={clsx('text-base font-semibold', premium.tone)}>{premium.text}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-slate-700 sm:grid-cols-4">
        <div>
          <span className="text-slate-500">Max Profit</span>
          <div className="font-semibold text-emerald-600">{limitLabel(strategy.maxProfit)}</div>
        </div>
        <div>
          <span className="text-slate-500">Max Loss</span>
          <div className="font-semibold text-rose-600">{limitLabel(strategy.maxLoss)}</div>
        </div>
        <div>
          <span className="text-slate-500">Breakeven</span>
          <div className="font-semibold text-slate-800" title="Breakeven = basis − credit per share">
            {formatWholeDollars(strategy.breakeven)}
          </div>
        </div>
        <div>
          <span className="text-slate-500">Risk Profile</span>
          <div className="font-semibold text-slate-800">{strategy.riskProfile ? strategy.riskProfile.replace('_', ' ') : '—'}</div>
        </div>
      </div>

      {strategy.components.length > 0 && (
        <div className="mt-4 border-t border-slate-200 pt-3 text-sm text-slate-700">
          <div className="text-slate-500 mb-1">Components:</div>
          <ul className="space-y-1">
            {strategy.components.map((line, idx) => (
              <li key={`${strategy.id}-component-${idx}`}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default StrategyCard;
