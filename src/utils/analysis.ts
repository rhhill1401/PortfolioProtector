// Shared analysis utilities (pure helpers)

export const rangeDaysMap: Record<string, number> = {
  '5-min': 1,
  '15-min': 3,
  '30-min': 5,
  '1-hour': 10,
  '4-hour': 30,
  Daily: 180,
  Weekly: 365 * 2,
};

export const inferTimeframe = (fileName: string): string => {
  const n = fileName.toLowerCase();
  if (n.includes('4h') || n.includes('4-h') || n.includes('4hr') || n.includes('4 hour')) return '4-hour';
  if (n.includes('1h') || n.includes('1-h') || n.includes('1hr') || n.includes('1 hour')) return '1-hour';
  if (n.includes('30m') || n.includes('30min') || n.includes('30 min')) return '30-min';
  if (n.includes('15m') || n.includes('15min') || n.includes('15 min')) return '15-min';
  if (n.includes('5m') || n.includes('5min') || n.includes('5 min')) return '5-min';
  if (n.includes('weekly') || n.includes('1w') || n.includes('week')) return 'Weekly';
  if (n.includes('daily') || n.includes('1d') || n.includes('day')) return 'Daily';
  return '4-hour';
};

export interface KeyLevel {
  price: number;
  type: 'Support' | 'Resistance';
  strength?: string;
}

export interface ChartMetric {
  timeframe: string;
  keyLevels: KeyLevel[];
  trend: string;
  rsi: string;
  macd: string;
}

export function createPriceContext(eodData: any, chartMetrics: ChartMetric[]) {
  const detectedTimeframe = chartMetrics?.[0]?.timeframe || '4-hour';
  const rangeDays = rangeDaysMap[detectedTimeframe] || 180;

  if (!eodData) {
    return {
      current: null,
      open: null,
      high: null,
      low: null,
      close: null,
      volume: null,
      date: null,
      timeframe: detectedTimeframe,
      rangeDays,
    };
  }

  return {
    current: eodData.close ?? null,
    open: eodData.open ?? null,
    high: eodData.high ?? null,
    low: eodData.low ?? null,
    close: eodData.close ?? null,
    volume: eodData.volume ?? null,
    date: eodData.date ?? null,
    timeframe: detectedTimeframe,
    rangeDays,
  };
}

export const convertFileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed to convert file to base64'));
    };
    reader.onerror = (error) => reject(error as any);
  });

