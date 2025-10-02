// In TickerPriceSearch.tsx (updated with state management)
import {useState, useEffect, useCallback} from 'react';
import {Button} from '@/components/ui/button';
import {Loader2} from 'lucide-react';
import {Tabs, TabsList, TabsTrigger, TabsContent} from '@/components/ui/tabs';
import {Skeleton} from '@/components/ui/skeleton';
import UploadStatusTracker from '@/components/UploadStatusTracker';
import UploadTab from '@/components/UploadTab';
import {PortfolioCSVParser} from '@/utils/portfolioParser';
import type { PortfolioParseResult } from '@/types/portfolio';

import type { UploadState, AnalysisReadiness, UploadedFile, UploadCategory } from '@/types/analysis';
import { initialUploadState, initialReadiness } from '@/types/analysis';
import { greeksFetcher, type OptionPosition } from '@/services/greeks/fetcher';
import type { OptionQuote } from '@/services/optionLookup';
import { callFn, callFnJson } from '@/services/supabaseFns';
import { MarketDataFetcher } from '@/services/marketDataFetcher';
import { detectStrategies } from '@/services/deterministic/calculator';
import { rangeDaysMap, inferTimeframe, createPriceContext, convertFileToBase64, type ChartMetric, type KeyLevel } from '@/utils/analysis';

/* ---------- types ---------- */

interface TickerPriceSearchProps {
	tickerSymbol: string;
	onTickerChange: (v: string) => void;
}

// ===== Phase-1: client-only "Eyes" path (no edge) =====
const USE_LOCAL_EYES = true; // flip ON for Phase-1

// Type for raw option position from portfolio
interface RawOptionPosition {
  symbol?: string;
  optionType?: string;
  type?: string;
  strike?: number | string;
  expiry?: string;
  contracts?: number | string;
  premium?: number | string;
  premiumCollected?: number | string;
  currentValue?: number | string | null;
  profitLoss?: number | string | null;
}

const toYYYYMMDD = (s?: string): string => {
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^([A-Za-z]{3})-(\d{1,2})-(\d{4})$/);
  const mm: Record<string,string> = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
  return m ? `${m[3]}-${mm[m[1]]}-${m[2].padStart(2,'0')}` : s;
};

const normPos = (opt: RawOptionPosition, currentPrice: number, ticker: string) => {
  const type = String(opt.optionType || opt.type || 'CALL').toUpperCase();
  const contracts = Number(opt.contracts) || 0;
  const strike = Number(opt.strike) || 0;
  const expiry = toYYYYMMDD(String(opt.expiry || ''));
  const days = Math.max(0, Math.ceil((new Date(expiry).getTime() - Date.now())/86400000));
  let premium = Number(opt.premium ?? opt.premiumCollected ?? 0);
  if (premium > 0 && premium < 100) premium = premium * 100 * Math.abs(contracts);
  const moneyness = type === 'CALL' ? (currentPrice - strike)/strike : (strike - currentPrice)/strike;
  const risk = moneyness >= 0 ? 'HIGH' : moneyness >= -0.03 ? 'MEDIUM' : 'LOW';
  const currentValue = Number(opt.currentValue ?? 0);
  let profitLoss = opt.profitLoss !== undefined && opt.profitLoss !== null ? Number(opt.profitLoss) : null;
  if (profitLoss === null && !Number.isNaN(currentValue)) {
    profitLoss = (contracts < 0 ? premium - currentValue : currentValue - premium) || 0;
  }
  return {
    symbol: String(opt.symbol || ticker).toUpperCase(),
    type,
    optionType: type as 'CALL' | 'PUT',
    strike,
    expiry,
    contracts,
    premium, premiumCollected: premium, currentValue,
    profitLoss,
    delta: null, gamma: null, theta: null, vega: null, iv: null,
    daysToExpiry: days, term: days > 365 ? 'LONG_DATED' : 'SHORT_DATED',
    assignmentProb: null, risk, wheelPnl: premium, markPnl: profitLoss,
  };
};

// Type for portfolio data structure
interface PortfolioData {
  positions?: Array<{ symbol?: string; quantity?: number; shares?: number }>;
  metadata?: {
    optionPositions?: RawOptionPosition[];
  };
  optionPositions?: RawOptionPosition[];
  cashBalance?: number | string;
}

// Call this immediately after your portfolio image parse succeeds:
function dispatchLocalEyes({ ticker, currentPrice, portfolio }: {
  ticker: string; currentPrice: number; portfolio: PortfolioData;
}) {
  const t = ticker.toUpperCase();
  const rawOptions = portfolio?.metadata?.optionPositions ?? portfolio?.optionPositions ?? [];
  console.log('[LOCAL EYES DEBUG] Raw options from portfolio:', rawOptions);

  const opts = rawOptions
    .filter((o: RawOptionPosition) => {
      const s = String(o?.symbol||'').toUpperCase();
      const matches = !s || s === t || s.startsWith(`${t} `) || s.startsWith(`O:${t}`);
      if (matches) {
        console.log(`[LOCAL EYES DEBUG] Processing option:`, {
          symbol: o.symbol,
          type: o.type || o.optionType,
          strike: o.strike,
          contracts: o.contracts,
          expiry: o.expiry,
          premium: o.premium || o.premiumCollected
        });
      }
      return matches;
    })
    .map((o: RawOptionPosition) => {
      const normalized = normPos(o, currentPrice, t);

      console.log(`[LOCAL EYES DEBUG] Normalized to:`, {
        type: normalized.type,
        strike: normalized.strike,
        contracts: normalized.contracts,
        risk: normalized.risk,
        direction: normalized.contracts < 0 ? 'SOLD' : 'BOUGHT'
      });
      return normalized;
    });

  const dispatchGreeksReady = async () => {
    try {
      const greeksMap = await greeksFetcher.fetchGreeksForPositions(
        opts.map((p) => ({
          symbol: p.symbol,
          strike: p.strike,
          expiry: p.expiry,
          optionType: p.type as 'CALL' | 'PUT',
          contracts: p.contracts,
        }))
      );

      window.dispatchEvent(
        new CustomEvent('analysis:greeks-ready', {
          detail: {
            ticker: t,
            greeks: Object.fromEntries(greeksMap),
          },
        })
      );
    } catch (error) {
      console.error('[LOCAL EYES] Failed to fetch greeks', error);
      window.dispatchEvent(
        new CustomEvent('analysis:greeks-ready', {
          detail: { ticker: t, greeks: {} },
        })
      );
    }
  };

  const symbolPositions = (portfolio?.positions ?? [])
    .filter((p) => String(p?.symbol||'').toUpperCase() === t);

  const shareCount = symbolPositions
    .reduce((sum: number, p) => sum + (Number((p as any).quantity || (p as any).shares)||0), 0);

  // Weighted average cost basis when multiple lots exist
  const totalCost = symbolPositions
    .reduce((sum: number, p) => {
      const qty = Number((p as any).quantity || (p as any).shares) || 0;
      const basis = Number((p as any).purchasePrice) || 0;
      return sum + qty * basis;
    }, 0);
  const shareBasis = shareCount > 0 ? totalCost / shareCount : null;

  const cashBalance = Number(portfolio?.cashBalance || 0) || 0;

  const { strategies, wheelPhase } = detectStrategies({
    positions: opts,
    shareCount,
    cashBalance,
    currentPrice,
    shareBasis,
  });

  const wheelStrategy = {
    shareCount,
    currentPhase: wheelPhase,
    currentPositions: opts,
    strategyCount: strategies.length,
  };

  const wheelDeterministic = {
    ticker: t,
    currentPrice,
    shareCount,
    totalPremiumCollected: opts.reduce((s: number, p) => s + (p.premium||0), 0),
    strategies,
    positions: opts,
    countsByLabel: opts.reduce((acc: Record<string, number>, p) => {
      const key = `${p.contracts<0?'SOLD':'BOUGHT'} ${p.type}`;
      acc[key] = (acc[key]||0)+1;
      return acc;
    }, {}),
    wheelPhase,
    cashBalance,
    shareBasis,
  };

  const summary = { ticker: t, currentPrice, recommendation: 'Analysis complete' };

  console.log('[Phase-1 LOCAL EYES] Dispatching analysis with', opts.length, 'positions');
  window.dispatchEvent(new CustomEvent('analysis-ready', {
    detail: { wheelStrategy, wheelDeterministic, summary, optionGreeks: {} }
  }));
  dispatchGreeksReady();
  window.dispatchEvent(new Event('analysis-done'));
}


interface MarketstackEodData {
	symbol: string;
	open: number | null;
	high: number | null;
	low: number | null;
	close: number | null;
	volume: number | null;
	date: string;
}
interface MarketstackApiResponse {
	data: MarketstackEodData[];
	error?: {code: string; message: string};
}

interface PriceInfo {
	price: number | null;
	change: number | null;
	percent: string | null;
}




// Process chart analysis results
function processChartAnalysisResults(chartAnalysisResults: ChartAnalysisResult[]) {
	const chartData = chartAnalysisResults.map((r) => ({
		fileName: r.fileName,
		analyzed: r.status === 'completed',
		technicalAnalysis: r.analysis
			? {
					marketContext: r.analysis!.marketContext,
					trend: r.analysis!.technical.trend,
					rsi: r.analysis!.technical.rsi,
					macd: r.analysis!.technical.macd,
					movingAverages: r.analysis!.technical.movingAverages,
					recommendation: r.analysis!.recommendation,
					risk: r.analysis!.risk,
			  }
			: null,
		error: r.error,
	}));

	const failedCharts = chartAnalysisResults
		.filter((r) => r.status === 'error')
		.map((r) => ({
			fileName: r.fileName,
			error: r.error ?? 'Analysis failed',
		}));

	const chartMetrics: ChartMetric[] = chartAnalysisResults
		.filter((r) => r.status === 'completed' && r.analysis)
		.map((r) => ({
			timeframe: inferTimeframe(r.fileName),
			keyLevels: r.analysis!.keyLevels ?? [],
			trend: r.analysis!.technical.trend,
			rsi: r.analysis!.technical.rsi,
			macd: r.analysis!.technical.macd,
		}));

	return { chartData, failedCharts, chartMetrics };
}

// Create price context from EOD data

// Prepare portfolio data for analysis
function preparePortfolioData(parsedPortfolio: PortfolioParseResult | null, uploadFiles: UploadedFile[]) {
	if (parsedPortfolio) {
		return {
			positions: parsedPortfolio.positions,
			totalValue: parsedPortfolio.totalValue,
			cashBalance: parsedPortfolio.cashBalance || 0,
			parseErrors: parsedPortfolio.errors,
			metadata: parsedPortfolio.metadata,
			rawFiles: uploadFiles.map((f) => f.file.name),
		};
	}
	return {
		positions: [],
		rawFiles: uploadFiles.map((f) => f.file.name),
	};
}


interface ChartAnalysisResult {
	fileName: string;
	analysis: {
		marketContext: string;
		keyLevels?: KeyLevel[]; // Added to match chart-vision response
		technical: {
			trend: string;
			rsi: string;
			macd: string;
			movingAverages: string;
		};
		recommendation: Array<{
			name: 'Buy' | 'Hold' | 'Sell';
			value: number;
		}>;
		risk: string;
	} | null;
	status: 'completed' | 'error';
	error?: string;
	analyzedAt: Date;
}

interface ProcessedChartData {
	fileName: string;
	fileType: string;
	base64Data: string;
	uploadedAt: Date;
	processingStatus: 'pending' | 'processing' | 'completed' | 'error';
}


type AnalysisPanelProps = {
	eodData: MarketstackEodData | null;
	readiness: AnalysisReadiness;
	isAnalyzing: boolean;
	handleAIAnalysis: () => void | Promise<void>;
	uploadState: UploadState;
	handlePortfolioUpload: (files: FileList) => Promise<void>;
	isParsingPortfolio: boolean;
	parsedPortfolio: PortfolioParseResult | null;
	handleChartsUpload: (files: FileList) => Promise<void>;
	handleResearchUpload: (files: FileList) => void;
	df: (d?: string | null) => string;
	nf: (v: number | null) => string;
	chartsEnabled: boolean;
	researchEnabled: boolean;
};

function AnalysisPanel({
	eodData,
	readiness,
	isAnalyzing,
	handleAIAnalysis,
	uploadState,
	handlePortfolioUpload,
	isParsingPortfolio,
	parsedPortfolio,
	handleChartsUpload,
	handleResearchUpload,
	df,
	nf,
	chartsEnabled,
	researchEnabled,
}: AnalysisPanelProps) {
	return (
		<div>
			{eodData && (
				<>
					<div className='bg-[#8079e3] p-4 border-b border-[#6c68b8] flex justify-between'>
						<h2 className='text-2xl font-bold'>
							{eodData.symbol === 'IBIT,ETHA' ? 'IBIT & ETHA' : eodData.symbol}
						</h2>
						<span className='text-2xl font-bold'>
							{eodData.symbol === 'IBIT,ETHA' ? 'Combined Analysis' : `$${nf(eodData.close)}`}
						</span>
					</div>

					<div className='p-4'>
						{eodData.symbol !== 'IBIT,ETHA' && (
							<div className='grid grid-cols-2 gap-3'>
								{[
									['Open', eodData.open],
									['High', eodData.high],
									['Low', eodData.low],
								].map(([lbl, val]) => (
									<div key={lbl} className='bg-[#8079e3] p-3 rounded flex flex-col'>
										<span className='text-xs text-white/70'>{lbl}</span>
										<span className='font-medium'>${nf(val as number | null)}</span>
									</div>
								))}
								<div className='bg-[#8079e3] p-3 rounded col-span-2'>
									<span className='text-xs text-white/70'>Volume</span>
									<span className='font-medium'>
										{eodData.volume?.toLocaleString() ?? 'N/A'}
									</span>
								</div>
							</div>
						)}

						<div className='mt-4 space-y-4'>
							<UploadStatusTracker readiness={readiness} uploadState={uploadState} />

							<Button
								disabled={!readiness.allRequirementsMet || isAnalyzing}
								onClick={handleAIAnalysis}
								className={`w-full font-semibold py-3 px-4 rounded-lg shadow-md inline-flex items-center gap-2 transition-all ${
									readiness.allRequirementsMet
										? 'bg-[#88FC8F] hover:bg-[#7AE881] text-gray-800'
										: 'bg-gray-500 text-gray-300 cursor-not-allowed'
								}`}
							>
								{isAnalyzing ? (
									<>
										<Loader2 className='h-4 w-4 animate-spin' />
										Building…
									</>
								) : (
									<>
										🤖 Generate AI Analysis
										{!readiness.allRequirementsMet && (
											<span className='text-xs ml-2'>
												(
												{
													Object.entries(readiness).filter(
														([k, v]) => k !== 'allRequirementsMet' && !v
													).length
												}{' '}
												requirements missing)
											</span>
										)}
									</>
								)}
							</Button>
							<span className='text-xs text-white/70'>Last updated: {df(eodData.date)}</span>
						</div>
					</div>
				</>
			)}

			<div className='p-4'>
				<Tabs defaultValue='portfolio' className='w-full'>
					<TabsList className='grid w-full grid-cols-3 bg-[#766DFB] rounded-2xl p-1'>
						<TabsTrigger value='portfolio' className='data-[state=active]:bg-[#050136] data-[state=active]:text-white data-[state=active]:font-semibold text-white rounded-xl py-2'>
							Portfolio {uploadState.portfolio.files.length > 0 && `(${uploadState.portfolio.files.length})`}
						</TabsTrigger>
						<TabsTrigger
							value='charts'
							disabled={!chartsEnabled}
							className='data-[state=active]:bg-[#050136] data-[state=active]:text-white data-[state=active]:font-semibold text-white rounded-xl py-2 disabled:opacity-50 disabled:cursor-not-allowed'
						>
							Charts {uploadState.charts.files.length > 0 && `(${uploadState.charts.files.length})`}
						</TabsTrigger>
						<TabsTrigger
							value='research'
							disabled={!researchEnabled}
							className='data-[state=active]:bg-[#050136] data-[state=active]:text-white data-[state=active]:font-semibold text-white rounded-xl py-2 disabled:opacity-50 disabled:cursor-not-allowed'
						>
							Deep research {uploadState.research.files.length > 0 && `(${uploadState.research.files.length})`}
						</TabsTrigger>
					</TabsList>

					<TabsContent value='portfolio' className='mt-4'>
						<UploadTab id='portfolio-files' accept='image/*,.csv,.xlsx' multiple onFiles={handlePortfolioUpload} />
						{isParsingPortfolio && (
							<div className='mt-2 text-sm text-white/70 flex items-center gap-2'>
								<Loader2 className='h-3 w-3 animate-spin' />
								Parsing CSV files…
							</div>
						)}
						{parsedPortfolio && (
							<div className='mt-2 text-sm text-white/90'>
								✓ Parsed {parsedPortfolio.positions.length} positions
							</div>
						)}
					</TabsContent>

					<TabsContent value='charts' className='mt-4'>
						<UploadTab id='chart-images' accept='image/*' multiple onFiles={handleChartsUpload} />
					</TabsContent>

					<TabsContent value='research' className='mt-4'>
						<UploadTab
							id='research-files'
							accept='.pdf,.doc,.docx,.txt,.rtf,.md,.csv,.xlsx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword'
							multiple
							onFiles={handleResearchUpload}
						/>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}

export function TickerPriceSearch({
	tickerSymbol,
	onTickerChange,
}: TickerPriceSearchProps) {
	const [eodData, setEodData] = useState<MarketstackEodData | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isAnalyzing, setIsAnalyzing] = useState(false);

	// NEW: Upload state management
	const [uploadState, setUploadState] =
		useState<UploadState>(initialUploadState);
	const [readiness, setReadiness] =
		useState<AnalysisReadiness>(initialReadiness);

    // Update readiness whenever upload state or ticker changes
    // Charts and research are now OPTIONAL - only portfolio + ticker required
    useEffect(() => {
        const tickerValid = !!eodData && !!eodData.symbol;
        const portfolioReady = uploadState.portfolio.status === 'ready';
        const chartsReady = uploadState.charts.status === 'ready';
        const researchReady = uploadState.research.status === 'ready';
        // Only require portfolio + ticker (charts/research optional)
        const allRequirementsMet = tickerValid && portfolioReady;
        setReadiness({ tickerValid, portfolioReady, chartsReady, researchReady, allRequirementsMet });
    }, [uploadState, eodData]);

	// Update upload state for a specific category
	const updateUploadState = (category: UploadCategory, files: FileList) => {
		const uploadedFiles: UploadedFile[] = Array.from(files).map((file) => ({
			file,
			uploadedAt: new Date(),
			status: 'ready' as const, // For now, mark as ready immediately
		}));
		const newStatus =
			category === 'portfolio'
				? ('processing' as const)      // keep portfolio tab locked
				: category === 'charts'
					? ('processing' as const)    // charts already handled
					: ('ready' as const);        // research files
		setUploadState((prev) => ({
			...prev,
			[category]: {
				...prev[category],
				files: [...prev[category].files, ...uploadedFiles],
				status: newStatus,
			},
		}));
	};

	const [parsedPortfolio, setParsedPortfolio] =
		useState<PortfolioParseResult | null>(null);
	const [isParsingPortfolio, setIsParsingPortfolio] = useState(false);
	// NEW: Available tickers extracted from portfolio
	const [availableTickers, setAvailableTickers] = useState<string[]>([]);
	// NEW: Tab enablement state (charts/research disabled until ticker selected)
	const [chartsEnabled, setChartsEnabled] = useState(false);
	const [researchEnabled, setResearchEnabled] = useState(false);

	// Load cached portfolio data from sessionStorage on mount
	useEffect(() => {
		const cached = sessionStorage.getItem('portfolioData');
		if (cached) {
			try {
				const data: PortfolioParseResult = JSON.parse(cached);
				setParsedPortfolio(data);
				console.log('📦 [CACHE] Loaded portfolio from sessionStorage:', {
					positions: data.positions.length,
					totalValue: data.totalValue
				});

				// Extract tickers from cached data
				const tickers = new Set<string>();
				data.positions.forEach(pos => {
					if (pos.symbol) tickers.add(pos.symbol.toUpperCase());
				});
				if (data?.metadata?.optionPositions) {
					const optionPositions = data.metadata.optionPositions as OptionPosition[];
					optionPositions.forEach(pos => {
						if (pos.symbol) {
							const normalized = pos.symbol.toUpperCase().replace(/^O:/, '');
							tickers.add(normalized);
						}
					});
				}
				const extractedTickers = Array.from(tickers).sort();
				setAvailableTickers(extractedTickers);

				// Mark portfolio as ready
				setUploadState(prev => ({
					...prev,
					portfolio: { ...prev.portfolio, status: 'ready' }
				}));
			} catch (err) {
				console.error('❌ [CACHE] Failed to load cached portfolio:', err);
				sessionStorage.removeItem('portfolioData');
			}
		}
	}, []);
    // Option Greeks state
    const [optionGreeks, setOptionGreeks] = useState<Map<string, OptionQuote>>(new Map());
    const [, setIsFetchingGreeks] = useState(false);
	// Existing API key
	const apiKey = import.meta.env.VITE_MARKETSTACK_API_KEY;
    const [processedChartData, setProcessedChartData] = useState<
        ProcessedChartData[]
    >([]);

    /* ---------------- Small internal helpers (no behavior change) ---------------- */
    const categorizeFiles = (files: FileList) => {
        const all = Array.from(files);
        const csvFiles = all.filter(
            (f) => f.name.toLowerCase().endsWith('.csv') || f.type === 'text/csv'
        );
        const imageFiles = all.filter((f) => f.type.startsWith('image/'));
        return { csvFiles, imageFiles };
    };

    const parseCsvFiles = async (csvFiles: File[]): Promise<PortfolioParseResult | null> => {
        if (csvFiles.length === 0) return null;
        const parser = new PortfolioCSVParser();
        const result = await parser.parseMultipleCSVs(csvFiles);
        setParsedPortfolio(result);
        return result;
    };

    interface VisionPosition {
        symbol: string;
        quantity: number;
        purchasePrice: number;
        currentPrice: number;
        marketValue: number;
    }

    interface VisionPortfolioMetadata {
        optionPositions?: OptionPosition[];
    }

    interface VisionPortfolio {
        positions?: VisionPosition[];
        totalValue: number;
        portfolioDetected: boolean;
        brokerageType?: string;
        extractionConfidence?: string;
        metadata?: VisionPortfolioMetadata;
        cashBalance?: number;
    }

    interface VisionResponse {
        success: boolean;
        portfolio?: VisionPortfolio;
    }

    const buildParseResultFromVision = (
        vision: VisionResponse,
        fileName: string,
    ): PortfolioParseResult | null => {
        if (!vision?.success || !vision.portfolio?.portfolioDetected) return null;
        const p = vision.portfolio;
        const stockPositions = (p.positions ?? []).map((pos) => ({
            symbol: pos.symbol,
            quantity: pos.quantity,
            purchasePrice: pos.purchasePrice,
            currentPrice: pos.currentPrice,
            marketValue: pos.marketValue,
            percentOfPortfolio: (pos.marketValue / p.totalValue) * 100,
        }));
        return {
            success: true,
            positions: stockPositions,
            totalValue: p.totalValue,
            cashBalance: p.cashBalance || 0,
            errors: [],
            warnings:
                p.extractionConfidence === 'low'
                    ? ['Low confidence in data extraction - please verify positions']
                    : [],
            metadata: {
                source: 'image_analysis',
                brokerageType: p.brokerageType,
                extractionConfidence: p.extractionConfidence,
                fileName,
                optionPositions: p.metadata?.optionPositions || [],
            },
        };
    };

    const analyzePortfolioImage = async (imageFile: File): Promise<PortfolioParseResult | null> => {
        try {
            const base64 = await convertFileToBase64(imageFile);
            const res = await callFn('portfolio-vision', {
                image: base64,
                ticker: eodData?.symbol || 'UNKNOWN',
            });

            const text = await res.text();

            if (!res.ok) {
                console.error('❌ [PORTFOLIO VISION] HTTP error', {
                    status: res.status,
                    bodyPreview: text.slice(0, 400),
                });
                return null;
            }

            let visionData: VisionResponse | null = null;
            try {
                visionData = JSON.parse(text);
            } catch {
                console.error('❌ [PORTFOLIO VISION] Non-JSON response', {
                    preview: text.slice(0, 400),
                });
                return null;
            }

            if (!visionData?.success) {
                console.warn('⚠️ [PORTFOLIO VISION] success=false or missing payload', visionData);
                return null;
            }

            const parsed = buildParseResultFromVision(visionData, imageFile.name);
            if (!parsed) console.warn('⚠️ [PORTFOLIO VISION] portfolioDetected=false for', imageFile.name);
            return parsed;
        } catch (err) {
            console.error('💥 [PORTFOLIO VISION] analyzePortfolioImage failed', err);
            return null;
        }
    };

    const analyzePortfolioImages = async (imageFiles: File[], existing: PortfolioParseResult | null): Promise<PortfolioParseResult | null> => {
        if (imageFiles.length === 0) return existing;
        let merged = existing;
        for (const imageFile of imageFiles) {
            const visionResult = await analyzePortfolioImage(imageFile);
            if (!merged && visionResult) {
                merged = visionResult;
                setParsedPortfolio(merged);
            }
        }
        return merged;
    };

    const normalizeExpiry = (dateStr: string): string => {
        const months: Record<string, string> = {
            Jan: '01', Feb: '02', Mar: '03', Apr: '04',
            May: '05', Jun: '06', Jul: '07', Aug: '08',
            Sep: '09', Oct: '10', Nov: '11', Dec: '12',
        };
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
        const m = dateStr.match(/^([A-Za-z]{3})-(\d{1,2})-(\d{4})$/);
        if (m) {
            const [, mon, day, year] = m;
            const month = months[mon as keyof typeof months];
            if (month) return `${year}-${month}-${day.padStart(2, '0')}`;
        }
        return dateStr;
    };

    const normalizeOptionPositionsExpiry = (positions: OptionPosition[]): OptionPosition[] =>
        positions.map((p) => ({ ...p, expiry: normalizeExpiry(p.expiry) }));

    const fetchAndSetGreeks = async (positions: OptionPosition[]) => {
        if (!positions?.length) return;
        setIsFetchingGreeks(true);
        try {
            const normalized = normalizeOptionPositionsExpiry(positions);
    const greeksData = await greeksFetcher.fetchGreeksForPositions(normalized);
    setOptionGreeks(greeksData);
        window.dispatchEvent(new CustomEvent('analysis:greeks-ready', {
            detail: {
                ticker: tickerSymbol.toUpperCase(),
                greeks: Object.fromEntries(greeksData),
            },
        }));
        } finally {
            setIsFetchingGreeks(false);
        }
    };

    // Extracted to reduce complexity in handlePortfolioUpload (no behavior change)
    const summarizePortfolioResult = async (
        portfolioResult: PortfolioParseResult | null
    ): Promise<void> => {
        if (portfolioResult) {
            console.log('🎉 [PORTFOLIO UPLOAD] Final portfolio data:', {
                totalPositions: portfolioResult.positions.length,
                totalValue: portfolioResult.totalValue,
                source: portfolioResult.metadata?.source || 'csv'
            });

            // Extract unique tickers from positions and option positions
            const tickers = new Set<string>();

            // From regular positions
            portfolioResult.positions.forEach(pos => {
                if (pos.symbol) {
                    tickers.add(pos.symbol.toUpperCase());
                }
            });

            // From option positions
            if (portfolioResult?.metadata?.optionPositions) {
                const optionPositions = portfolioResult.metadata.optionPositions as OptionPosition[];
                optionPositions.forEach(pos => {
                    if (pos.symbol) {
                        // Normalize option symbols (remove O: prefix if present)
                        const normalized = pos.symbol.toUpperCase().replace(/^O:/, '');
                        tickers.add(normalized);
                    }
                });
            }

            const extractedTickers = Array.from(tickers).sort();
            setAvailableTickers(extractedTickers);
            console.log('🎯 [TICKER EXTRACTION] Available tickers:', extractedTickers);

            // Cache portfolio data in sessionStorage
            try {
                sessionStorage.setItem('portfolioData', JSON.stringify(portfolioResult));
                console.log('💾 [CACHE] Saved portfolio to sessionStorage');
            } catch (err) {
                console.error('❌ [CACHE] Failed to save portfolio to sessionStorage:', err);
            }

            if (
                portfolioResult?.metadata?.optionPositions &&
                portfolioResult.metadata.optionPositions.length > 0
            ) {
                const currentSymbol = eodData?.symbol?.toUpperCase();
                const allPositions = portfolioResult.metadata
                    .optionPositions as OptionPosition[];
                const relevantPositions = currentSymbol
                    ? allPositions.filter(
                          (p) => p.symbol?.toUpperCase() === currentSymbol
                      )
                    : allPositions;

                console.log('📊 [GREEKS] Fetching Greeks for option positions...', {
                    totalPositions: allPositions.length,
                    filteredForSymbol: currentSymbol,
                    positionsToFetch: relevantPositions.length,
                });

                await fetchAndSetGreeks(relevantPositions);
            }
        } else {
            console.log('❌ [PORTFOLIO UPLOAD] No portfolio data extracted from any files');
            setAvailableTickers([]);
        }
    };

    /* eslint-disable-next-line max-params */
    const buildAnalysisPayload = async (
        eod: MarketstackEodData | null,
        parsed: PortfolioParseResult | null,
        chartResults: ChartAnalysisResult[],
        _uploadState: UploadState,
        greeksMap: Map<string, OptionQuote>,
        tickerSym: string,
    ) => {
        const { chartData, failedCharts, chartMetrics } = processChartAnalysisResults(chartResults);
        const priceContext = createPriceContext(eod, chartMetrics);
        let portfolioData = preparePortfolioData(parsed, _uploadState.portfolio.files);
        
        // Fetch real market data
        const currentPrice = eod?.close || 0;
        const ticker = eod?.symbol || '';
        
        const marketData = await MarketDataFetcher.fetchMarketData(ticker, currentPrice);
        console.log('📊 [MARKET DATA] Fetched for analysis:', marketData);

        // Ensure option positions in payload use same key format as greeksMap
        if (portfolioData?.metadata && Array.isArray((portfolioData.metadata as any).optionPositions)) {
            const normalized = normalizeOptionPositionsExpiry(
                (portfolioData.metadata as any).optionPositions as OptionPosition[]
            ).map((p) => ({
                ...p,
                symbol: (p.symbol || '').toUpperCase(),
                optionType: (String(p.optionType || 'CALL').toUpperCase() as 'CALL' | 'PUT'),
                expiry: normalizeExpiry(p.expiry),
            }));
            portfolioData = {
                ...portfolioData,
                metadata: {
                    ...(portfolioData.metadata as Record<string, unknown>),
                    optionPositions: normalized,
                },
            } as typeof portfolioData;
        }
        return {
            ticker: tickerSym === 'IBIT,ETHA' ? 'IBIT,ETHA' : eod?.symbol,
            portfolio: portfolioData,
            charts:
                chartData.length > 0
                    ? chartData
                    : _uploadState.charts.files.map((f) => ({ name: f.file.name, analyzed: false })),
            chartsAnalyzed: chartData.length,
            chartsFailed: failedCharts,
            chartMetrics,
            research: _uploadState.research.files.map((f) => ({ name: f.file.name })),
            priceContext,
            optionGreeks: Object.fromEntries(greeksMap),
            marketData, // Add real market data to payload
        };
    };

    type IAResponse = { success: boolean; analysis?: unknown; error?: string };
    const submitAnalysis = async (payload: unknown) => {
        const useLegacy = new URLSearchParams(window.location.search).has('useLegacy');
        // Check for v3 feature flag
        const useV3 = import.meta.env.VITE_USE_INTEGRATED_ANALYSIS_V3 === 'true';
        const endpoint = useV3 ? 'integrated-analysis-v3' :
                        useLegacy ? 'integrated-analysis' : 'integrated-analysis-v2';
        console.log(`[Analysis] Using endpoint: ${endpoint} (v3=${useV3})`);
        const out = await callFnJson<IAResponse>(endpoint, payload);
        if (!out.ok || !out.data) {
            throw new Error(out.text || (out.data as IAResponse)?.error || `HTTP ${out.status}`);
        }
        const j: IAResponse = out.data as IAResponse;
        if (j.success) {
            console.log('[V3 Debug] Full response:', j);
            console.log('[V3 Debug] Analysis object:', j.analysis);
            console.log('[V3 Debug] WheelStrategy:', j.analysis?.wheelStrategy);
            console.log('[V3 Debug] Positions:', j.analysis?.wheelStrategy?.currentPositions);
            return j.analysis; // Return analysis instead of dispatching event
        } else {
            throw new Error(j.error || 'Integrated analysis error');
        }
    };
    
    // Helper to run analysis for a single ticker
    const runSingleAnalysis = async (singleTicker: string) => {
        // Build payload for single ticker
        const singleEod = tickerSymbol === 'IBIT,ETHA' 
            ? { ...eodData, symbol: singleTicker } 
            : eodData;
            
        const analysisPayload = await buildAnalysisPayload(
            singleEod,
            parsedPortfolio,
            chartAnalysisResults,
            uploadState,
            optionGreeks,
            singleTicker,
        );
        
        console.log(`📊 Running analysis for ${singleTicker}`, analysisPayload);
        return await submitAnalysis(analysisPayload);
    };
    
    // Merge function for BOTH mode - combines IBIT and ETHA analyses
    const mergeAnalysesForWheel = (analyses: any[]) => {
        const safe = (x: any) => (x ?? {});
        
        // Combine positions from both tickers
        const posLists = analyses.flatMap(a => safe(a.wheelStrategy)?.currentPositions ?? []);
        const currentPositions = posLists.map((p: any) => ({
            ...p,
            symbol: (p.symbol ?? '').toString().toUpperCase()
        }));
        
        // Sum share counts
        const shareCount = analyses.reduce(
            (sum, a) => sum + (safe(a.wheelStrategy).shareCount ?? 0),
            0
        );
        
        // Combine recommendations with normalization for roll analysis
        const rollAnalysis = analyses.flatMap(a => safe(a.recommendations)?.rollAnalysis ?? [])
            .map(roll => ({
                ...roll,
                // Ensure ruleA and ruleB always exist to prevent UI crashes
                ruleA: roll?.ruleA ?? { triggered: false, threshold: null, current: null, detail: 'Not available' },
                ruleB: roll?.ruleB ?? { triggered: false, threshold: null, current: null, detail: 'Not available' }
            }));
        const snapshot = analyses.flatMap(a => safe(a.recommendations)?.positionSnapshot ?? []);
        
        // Use first analysis as base and merge wheel/performance data
        const base = analyses[0] ?? {};
        return {
            ...base,
            wheelStrategy: {
                shareCount,
                currentPhase: shareCount > 0 ? 'COVERED_CALL' : 'CASH_SECURED_PUT',
                currentPositions
            },
            recommendations: {
                ...(base.recommendations ?? {}),
                rollAnalysis,
                positionSnapshot: snapshot
            }
        };
    };
	// Modified handleAIAnalysis - handles BOTH mode with parallel analyses
    const handleAIAnalysis = async () => {
        if (!readiness.allRequirementsMet) {
            alert('All requirements must be met before running analysis.');
            return;
        }

        window.dispatchEvent(new Event('analysis-start'));

        // Phase-1: Use local Eyes processing (no edge function)
        if (USE_LOCAL_EYES && parsedPortfolio && eodData?.close != null) {
            console.log('[Phase-1] Using LOCAL EYES - no edge function call');

            if (tickerSymbol === 'IBIT,ETHA') {
                // Handle BOTH mode locally
                console.log('🚀 Running BOTH mode locally');

                // Process IBIT
                dispatchLocalEyes({
                    ticker: 'IBIT',
                    currentPrice: Number(eodData.close) || 0,
                    portfolio: parsedPortfolio
                });

                // Process ETHA (you might want to handle this differently)
                setTimeout(() => {
                    dispatchLocalEyes({
                        ticker: 'ETHA',
                        currentPrice: Number(eodData.close) || 0,
                        portfolio: parsedPortfolio
                    });
                }, 100);
            } else {
                // Single ticker mode
                dispatchLocalEyes({
                    ticker: tickerSymbol,
                    currentPrice: Number(eodData.close) || 0,
                    portfolio: parsedPortfolio
                });
            }

            // No need to wait or call edge functions in Phase-1
            return;
        }

        // Original edge function flow (for when USE_LOCAL_EYES is false)
        try {
            let finalAnalysis;

            if (tickerSymbol === 'IBIT,ETHA') {
                // BOTH mode: run parallel analyses and merge
                console.log('🚀 Running BOTH mode - parallel analyses for IBIT and ETHA');
                const [ibitAnalysis, ethaAnalysis] = await Promise.all([
                    runSingleAnalysis('IBIT'),
                    runSingleAnalysis('ETHA')
                ]);

                // Merge the analyses for Performance/Wheel display
                finalAnalysis = mergeAnalysesForWheel([ibitAnalysis, ethaAnalysis]);
                console.log('✅ Merged analysis for BOTH mode:', finalAnalysis);
            } else {
                // Single ticker mode: run normal analysis
                console.log(`🎯 Running single analysis for ${tickerSymbol}`);
                finalAnalysis = await runSingleAnalysis(tickerSymbol);
            }

            console.log('[V3 Debug] Final analysis before dispatch:', finalAnalysis);
            console.log('[V3 Debug] WheelStrategy in final:', finalAnalysis?.wheelStrategy);

            try {
                if (finalAnalysis && typeof finalAnalysis === 'object') {
                    (finalAnalysis as any).optionGreeks = Object.fromEntries(optionGreeks);
                }
            } catch (error) {
                console.warn('Failed to attach optionGreeks to final analysis', error);
            }

            // Dispatch the final analysis (single or merged)
            window.dispatchEvent(new CustomEvent('analysis-ready', { detail: finalAnalysis }));
        } catch (err) {
            console.error('Analysis failed:', err);
            alert('Analysis call failed');
        } finally {
            window.dispatchEvent(new Event('analysis-done'));
        }
    };

	// Enhanced upload handlers - handle both CSV and image files
    const handlePortfolioUpload = async (files: FileList) => {
        // Clear cached portfolio data when user explicitly uploads new files
        sessionStorage.removeItem('portfolioData');
        console.log('🗑️ [CACHE] Cleared cached portfolio - processing new upload');

        updateUploadState('portfolio', files);

        setIsParsingPortfolio(true);
        console.log('📁 [PORTFOLIO UPLOAD] Starting portfolio file processing...', {
            fileCount: files.length,
            fileTypes: Array.from(files).map(f => f.type),
            fileNames: Array.from(files).map(f => f.name)
        });

        try {
            const { csvFiles, imageFiles } = categorizeFiles(files);

            console.log('📊 [PORTFOLIO UPLOAD] File categorization:', {
                csvCount: csvFiles.length,
                imageCount: imageFiles.length
            });

            // Parse CSVs first (source of truth)
            let portfolioResult: PortfolioParseResult | null = await parseCsvFiles(csvFiles);
            // Analyze images and merge (CSV takes precedence)
            portfolioResult = await analyzePortfolioImages(imageFiles, portfolioResult);

            // Final summary (extracted helper)
            await summarizePortfolioResult(portfolioResult);

		} catch (error) {
			console.error('💥 [PORTFOLIO UPLOAD] Failed to process portfolio files:', error);
		} finally {
			setIsParsingPortfolio(false);
			// 🎯 CRITICAL: Unlock portfolio tab after all processing is complete
			setUploadState(prev => ({
				...prev,
				portfolio: { ...prev.portfolio, status: 'ready' as const } // unlock when done
			}));
		}
	};

	// Added: infer timeframe from file‑name keywords

    // convertFileToBase64 imported from utils/analysis

	const handleChartsUpload = async (files: FileList) => {
		updateUploadState('charts', files);

		// Process each image file to extract base64 data
		const processedCharts: ProcessedChartData[] = [];

		for (const file of Array.from(files)) {
			if (file.type.startsWith('image/')) {
				try {
					const base64 = await convertFileToBase64(file);

					processedCharts.push({
						fileName: file.name,
						fileType: file.type,
						base64Data: base64,
						uploadedAt: new Date(),
						processingStatus: 'pending',
					});
				} catch (error) {
					console.error(
						`Failed to process chart ${file.name}:`,
						error
					);
				}
			}
		}

	setProcessedChartData((prev) => [...prev, ...processedCharts]);
	};

	const analyzeChartImage = useCallback(async (
		chartData: ProcessedChartData
	): Promise<ChartAnalysisResult> => {
		try {
			// keep request minimal; payload preview logging removed to reduce noise
			
			const response = await callFn('chart-vision', {
				image: chartData.base64Data,
				ticker: eodData?.symbol || 'UNKNOWN',
				context: 'chart',
				priceContext: {
					currentPrice: eodData?.close ?? null,
					timeframe: inferTimeframe(chartData.fileName),
					rangeDays: rangeDaysMap[inferTimeframe(chartData.fileName)] || 180,
				},
			});

			const result = await response.json();
			console.log(
				'[chart‑vision] Response for',
				chartData.fileName,
				result
			);

			if (result.success && result.analysis) {
				return {
					fileName: chartData.fileName,
					analysis: result.analysis,
					status: 'completed' as const,
					analyzedAt: new Date(),
				};
			} else {
				throw new Error(result.error || 'Chart analysis failed');
			}
		} catch (error) {
			console.error(
				`Failed to analyze chart ${chartData.fileName}:`,
				error
			);
			// Changed: Make the returned error message more specific to guide debugging.
			const errorMessage =
				error instanceof Error ? error.message : 'Unknown error';
			return {
				fileName: chartData.fileName,
				analysis: null,
				status: 'error' as const,
				error: `Analysis failed: ${errorMessage}`,
				analyzedAt: new Date(),
			};
		}
	}, [eodData]);

	const [chartAnalysisResults, setChartAnalysisResults] = useState<
		ChartAnalysisResult[]
	>([]);

	// Helper to mark charts as ready after analysis
    const markChartsReady = useCallback((results?: ChartAnalysisResult[]) => {
		// Use passed results or fall back to state
		const resultsToCheck = results || chartAnalysisResults;

		// Check if we have ANY results at all
		if (resultsToCheck.length === 0) {
			console.log('[markChartsReady] No results to check yet');
			return;
		}

		const hasAnySuccess = resultsToCheck.some(
			(r) => r.status === 'completed'
		);
		const allProcessed = processedChartData.every(
			(chart) =>
				chart.processingStatus === 'completed' ||
				chart.processingStatus === 'error'
		);

		// reduced logging: only transition UI state without verbose console output

		if (allProcessed && hasAnySuccess) {
			setUploadState((prev) => ({
				...prev,
				charts: {...prev.charts, status: 'ready' as const},
			}));
		}
    }, [chartAnalysisResults, processedChartData, setUploadState]);

    const processChartAnalysis = useCallback(async () => {
		const pendingCharts = processedChartData.filter(
			(chart) => chart.processingStatus === 'pending'
		);

		if (pendingCharts.length === 0) return;

		console.log(`Starting analysis of ${pendingCharts.length} charts...`);

		// Update status to processing
		setProcessedChartData((prev) =>
			prev.map((chart) =>
				pendingCharts.find((p) => p.fileName === chart.fileName)
					? {...chart, processingStatus: 'processing' as const}
					: chart
			)
		);

		// Analyze charts in parallel (max 3 at a time to avoid rate limits)
		const batchSize = 3;
		const results: ChartAnalysisResult[] = [];

		for (let i = 0; i < pendingCharts.length; i += batchSize) {
			const batch = pendingCharts.slice(i, i + batchSize);
			const batchResults = await Promise.all(
				batch.map((chart) => analyzeChartImage(chart))
			);
			results.push(...batchResults);
		}

		// Store analysis results
		setChartAnalysisResults((prev) => [...prev, ...results]);

		// Update processing status
		setProcessedChartData((prev) =>
			prev.map((chart) => {
				const result = results.find(
					(r) => r.fileName === chart.fileName
				);
				if (result) {
					return {
						...chart,
                    processingStatus:
                        result.status === 'completed'
                            ? 'completed'
                            : 'error',
                };
				}
				return chart;
			})
		);

		/* ---- determine if all charts are now finished ---- */
		const allFinished = results.every(
			(r) => r.status === 'completed' || r.status === 'error'
		);
		if (allFinished) {
			markChartsReady(results);
		}

		console.log(
			`Chart analysis complete. Success: ${
				results.filter((r) => r.status === 'completed').length
			}/${results.length}`
		);
		// All charts now processed → mark category ready
		// markChartsReady();  // (removed: now handled above only if all finished)
    }, [processedChartData, analyzeChartImage, setProcessedChartData, setChartAnalysisResults, markChartsReady]);

	useEffect(() => {
		if (chartAnalysisResults.length > 0 && processedChartData.length > 0) {
			// Check if all charts are processed
			const allProcessed = processedChartData.every(
				(chart) =>
					chart.processingStatus === 'completed' ||
					chart.processingStatus === 'error'
			);

			if (allProcessed) {
				markChartsReady();
			}
		}
    }, [chartAnalysisResults, processedChartData, markChartsReady]);

	const handleResearchUpload = (files: FileList) => {
		updateUploadState('research', files);
		// TODO: In Phase 3, process research documents
		console.log('Research files stored:', files.length);
	};

	// Existing useEffect hooks
	useEffect(() => {
		const s = () => setIsAnalyzing(true);
		const d = () => setIsAnalyzing(false);
		window.addEventListener('analysis-start', s);
		window.addEventListener('analysis-done', d);
		return () => {
			window.removeEventListener('analysis-start', s);
			window.removeEventListener('analysis-done', d);
		};
	}, []);

	// Kick off chart analysis as soon as any new pending charts appear
    useEffect(() => {
        const hasPending = processedChartData.some(
            (c) => c.processingStatus === 'pending'
        );
        if (hasPending) {
            processChartAnalysis();
        }
    }, [processedChartData, processChartAnalysis]);

	const fetchQuote = useCallback(async (symbol: string) => {
		if (!apiKey) return setError('Marketstack key missing.');
		setIsLoading(true);
		setError(null);
		setEodData(null);

		try {
			const url = `https://api.marketstack.com/v1/eod/latest?access_key=${apiKey}&symbols=${symbol}`;
			const r = await fetch(url);
			if (!r.ok) throw new Error(`HTTP ${r.status}`);
			const j: MarketstackApiResponse = await r.json();
			if (j.error) throw new Error(j.error.message);
			if (!j.data?.length) throw new Error('No data');
			const latest = j.data[0];
			setEodData(latest);

			// Enable charts and research tabs after successful price data fetch
			setChartsEnabled(true);
			setResearchEnabled(true);

			/* broadcast to StockAnalysis */
			window.dispatchEvent(
				new CustomEvent<PriceInfo>('price-update', {
					detail: {
						price: latest.close,
						change:
							latest.open != null && latest.close != null
								? +(latest.close - latest.open).toFixed(2)
								: null,
						percent:
							latest.open != null
								? (
										((latest.close! - latest.open) /
											latest.open) *
										100
								  ).toFixed(2) + '%'
								: null,
					},
				})
			);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Fetch failed');
		} finally {
			setIsLoading(false);
		}
	}, [apiKey]);

	// Existing quote fetch logic
    useEffect(() => {
        const t = setTimeout(() => {
            const sym = tickerSymbol.trim().toUpperCase();
            if (sym === 'IBIT,ETHA') {
                // For BOTH mode, set dummy data to show the panel
                setEodData({
                    symbol: 'IBIT,ETHA',
                    open: null,
                    high: null,
                    low: null,
                    close: null,
                    volume: null,
                    date: new Date().toISOString()
                });
                setError(null);
            } else if (sym) {
                fetchQuote(sym);
            } else {
                setEodData(null);
                setError(null);
            }
        }, 500);
        return () => clearTimeout(t);
    }, [tickerSymbol, fetchQuote]);

    // Clear all cached analysis data when ticker changes
    useEffect(() => {
        // Clear all cached data to prevent stale data in subsequent analyses
        setProcessedChartData([]);
        setChartAnalysisResults([]);
        setParsedPortfolio(null);
        setOptionGreeks(new Map());
        setUploadState(initialUploadState);
        setReadiness(initialReadiness);
        setIsAnalyzing(false);

        console.log(`🧹 Cleared all cached analysis data for ticker change to: ${tickerSymbol}`);
    }, [tickerSymbol]);

	const nf = (v: number | null) => (v == null ? 'N/A' : v.toFixed(2));
	const df = (d?: string | null) =>
		d ? new Date(d).toLocaleDateString() : 'N/A';

	return (
		<div className='h-full w-full'>
			<div className='rounded-lg overflow-hidden shadow-md bg-[#9089FC] border border-[#7c77d1] h-full flex flex-col'>
				<div className='bg-[#7c77d1] px-4 py-4 border-b border-[#6c68b8]'>
					<h2 className='text-lg font-semibold mb-2 text-white'>
						{isParsingPortfolio ? 'Processing Portfolio...' : availableTickers.length > 0 ? 'Select Ticker' : 'Upload Portfolio'}
					</h2>
					{isParsingPortfolio && (
						<div className='flex flex-wrap gap-2'>
							<Skeleton className='h-10 w-20' />
							<Skeleton className='h-10 w-20' />
							<Skeleton className='h-10 w-20' />
						</div>
					)}
					{!isParsingPortfolio && availableTickers.length > 0 && (
						<div className='flex flex-wrap gap-2'>
							{availableTickers.map(ticker => (
								<button
									key={ticker}
									onClick={() => onTickerChange(ticker)}
									className={`py-2 px-4 rounded-md font-medium transition-all ${
										tickerSymbol === ticker
											? 'bg-[#766DFB] text-white'
											: 'bg-white/20 text-white/70 hover:bg-white/30'
									}`}
								>
									{ticker}
								</button>
							))}
							{availableTickers.length > 1 && (
								<button
									onClick={() => onTickerChange(availableTickers.join(','))}
									className={`py-2 px-4 rounded-md font-medium transition-all ${
										tickerSymbol === availableTickers.join(',')
											? 'bg-[#766DFB] text-white'
											: 'bg-white/20 text-white/70 hover:bg-white/30'
									}`}
								>
									ALL
								</button>
							)}
						</div>
					)}
					{!apiKey && <p className='text-xs text-yellow-200 mt-2'>⚠️ Configure VITE_MARKETSTACK_API_KEY</p>}
				</div>

				<div className='p-0 flex-grow text-white'>
					{isLoading ? (
						<div className='flex items-center justify-center h-64'>
							<div className='h-10 w-10 animate-spin border-t-2 border-b-2 border-white rounded-full' />
						</div>
					) : error ? (
						<div className='flex items-center justify-center h-64 text-center'>
							<p className='font-medium text-red-200'>{error}</p>
						</div>
					) : (
						<AnalysisPanel
							eodData={eodData}
							readiness={readiness}
							isAnalyzing={isAnalyzing}
							handleAIAnalysis={handleAIAnalysis}
							uploadState={uploadState}
							handlePortfolioUpload={handlePortfolioUpload}
							isParsingPortfolio={isParsingPortfolio}
							parsedPortfolio={parsedPortfolio}
							handleChartsUpload={handleChartsUpload}
							handleResearchUpload={handleResearchUpload}
							df={df}
							nf={nf}
							chartsEnabled={chartsEnabled}
							researchEnabled={researchEnabled}
						/>
					)}
				</div>
			</div>
		</div>
	);
}
