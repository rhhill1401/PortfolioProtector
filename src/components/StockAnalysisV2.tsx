import {useState, useEffect, useRef, useMemo, useCallback} from 'react';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import {Progress} from '@/components/ui/progress';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import axios from 'axios';
import { useOptionChain } from '@/hooks/useOptionChain';
import { useWheelQuotes } from '@/hooks/useWheelQuotes';
import { useMarketContext } from '@/hooks/useMarketContext';
import { useEtfFlows } from '@/hooks/useEtfFlows';
import {
	compounding,
	estimateAssignmentProb
} from '@/services/wheelMath';
import { calculateAggregateMetrics } from '@/services/optionLookup';
import { groupPositionsByTimeframe, formatExpiryLabel } from '@/services/wheelTimeAnalysis';
import type { DeterministicResult } from '@/services/deterministic/types';
import { buildGreeksKey, type OptionGreeks } from '@/services/greeks/fetcher';

// Import our new modular card components
import {
  OptionPositionCard,
  PositionStatusCard,
  IVEnvironmentCard,
  AssignmentRiskCard,
  StrategyCard,
} from '@/components/cards';

interface StockAnalysisProps {
	tickerSymbol: string;
}

interface TechnicalFactor {
	factor: string;
	value: string;
	interpretation: string;
	impact: string;
	score: number;
}

interface EntryStrategyPoint {
	zone: string;
	price: string;
	timing: string;
	rationale: string;
	probability: string;
}

interface ExitStrategyPoint {
	target: string;
	price: string;
	gain: string;
	timeframe: string;
	probability: string;
}

interface KeyLevel {
    price: number;
    type: 'Support' | 'Resistance' | 'Current';
    significance: string;
    description: string;
    strength?: string; // from chart-vision
}

interface FundamentalMetric {
	metric: string;
	value: string;
	assessment: string;
	comparison: string;
}

interface VixImpact {
	scenario: string;
	effect: string;
	impact: string;
	action: string;
}

interface MarketSentiment {
	etfFlows?: {
		netFlows: string;
		trend: string;
		impact: string;
		recommendation: string;
		source?: {
			url: string;
			asOf: string;
		};
	};
	navAnalysis?: {
		premium: string;
		discount: string;
		interpretation: string;
		tradingOpportunity: string;
		source?: {
			url: string;
			asOf: string;
		};
	};
	volatilityMetrics?: {
		currentIV: string;
		ivRank: string;
		callPutSkew: string;
		premiumEnvironment: string;
		wheelStrategy: string;
	};
	optionsFlow?: {
		largeOrders: string;
		openInterest: string;
		putCallRatio: string;
		sentiment: string;
	};
	upcomingCatalysts?: Array<{
		event: string;
		date: string;
		impact: string;
		preparation: string;
		source?: {
			url: string;
			asOf: string;
		};
	}> | string;
	overallSentiment?: {
		summary: string;
		confidence: string;
		recommendation: string;
	};
}

interface PriceInfo {
	price: number | null;
	change: number | null;
	percent: string | null;
}

interface RecommendationDataPoint {
	name: 'Buy' | 'Hold' | 'Sell';
	value: number;
}

interface AnalysisSummary {
	currentPrice: number;
	priceChange: number;
	priceChangePercent: string;
	vix: number;
	overallAssessment: string;
	technicalStance: string;
	technicalDetail: string;
	fundamentalAssessment: string;
	fundamentalDetail: string;
	marketContext: string;
	marketContextDetail: string;
	investmentThesis: string[];
	bullCase: string[];
	bearCase: string[];
	positionManagement: string[];
	entryTriggers: string[];
}

interface TechnicalSnapshot {
	trend: string;
	rsi: string;
	macd: string;
	movingAverages: string;
}

interface AnalysisDetail {
	technicalSignals?: string;
	portfolioAlignment?: string;
	researchConsensus?: string;
}

interface WheelPosition {
    // Core
    symbol?: string;
    strike: number;
    expiry: string;
    type: 'CALL' | 'PUT';
    optionType?: 'CALL' | 'PUT';
    contracts: number;
    status: string;
    position: 'SHORT' | 'LONG';
    // Premiums/values
    premium?: number;
    premiumCollected?: number;
    currentValue?: number;
    cycleReturn?: string | number;
    // Wheel P&L / MTM
    wheelPnl?: number;
    wheelNet?: number;
    markPnl?: number;
    optionMTM?: number;
    // Greeks
    delta?: number | null;
    gamma?: number | null;
    theta?: number | null;
    iv?: number | null;
    // Timing
    daysToExpiry: number;
    term: 'LONG_DATED' | 'SHORT_DATED';
    // Guidance
    assignmentProb: string;
    nextAction: string;
}

interface WheelStrategy {
	shareCount: number; // Real share count from portfolio
	currentPhase: 'CASH_SECURED_PUT' | 'COVERED_CALL';
	currentPositions: WheelPosition[];
	wheelPerformance?: Array<{
		position: string;
		target: number;
		actual: number;
		excess: number;
		status: string;
	}>;
}

interface StockAnalysisData {
    summary: AnalysisSummary;
	opportunity?: string; // NEW – from integrated‑analysis
	risk?: string; // already present but optional
	detail?: AnalysisDetail; // NEW – nested detail object
	technical: TechnicalSnapshot;
	optionsStrategy: string;
	marketContext: string;
	actionPlan: string[];
	technicalFactors: TechnicalFactor[];
	entryPoints: EntryStrategyPoint[];
	exitPoints: ExitStrategyPoint[];
	keyLevels: KeyLevel[];
	fundamentals: FundamentalMetric[];
	vixImpact: VixImpact[];
    recommendation: RecommendationDataPoint[];
    confidence?: number;
    additionalDataNeeded?: string;
    wheelStrategy?: WheelStrategy; // NEW - wheel strategy data
    wheelDeterministic?: DeterministicResult;
    vix?: number; // VIX value for volatility display
	marketSentiment?: MarketSentiment; // NEW - comprehensive market analysis
	// Optional nested recommendations object produced by integrated-analysis
        recommendations?: {
            positionSnapshot?: Array<{
                type: string;
                ticker?: string;
                quantity?: number;
                strike?: number;
                expiry?: string;
                basis?: number;
                pl?: number;
                premiumCollected?: number;
                currentValue?: number;
                wheelProfit?: number;
                daysToExpiry?: number;
                moneyness?: string;
                comment?: string;
            }>;
        rollAnalysis?: Array<{
            position: string;
            currentDelta: number | string | null;
            moneyness: number | string;
            ruleA: { triggered: boolean; threshold: number; current: number; detail: string };
            ruleB: { triggered: boolean; threshold: number; current: number | string; detail: string };
            action: string;
            conditionalTrigger: string;
            recommendation: string;
        }>;
        cashManagement?: {
            currentCash: number;
            minimumRequired: number;
            availableForTrades: number;
            bufferRemaining?: number;
            maxPutStrike?: number;
            recommendation: string;
        };
        actionPlan?: {
            beforeOpen?: string[];
            duringHours?: string[];
            endOfDay?: string[];
        };
        plainEnglishSummary?: {
            currentSituation: string;
            immediateActions?: string[];
            monitoringPoints?: string[];
            nextReview?: string;
        };
    };
    optionGreeks?: Record<string, OptionGreeks>;
    // Optional chart metrics injected from frontend
    chartMetrics?: Array<{
        timeframe?: string;
        keyLevels?: KeyLevel[];
        trend?: string;
        rsi?: string;
        macd?: string;
    }>;
}



const toPieArray = (rec: unknown): RecommendationDataPoint[] => {
	if (Array.isArray(rec)) return rec;
	if (typeof rec === 'string') {
		const upper = rec.toUpperCase();
		return [
			{name: 'Buy', value: upper === 'BUY' ? 100 : 0},
			{name: 'Hold', value: upper === 'HOLD' ? 100 : 0},
			{name: 'Sell', value: upper === 'SELL' ? 100 : 0},
		];
	}
	return [];
};


export function StockAnalysis({tickerSymbol}: StockAnalysisProps) {
	const [analysisData, setAnalysisData] = useState<StockAnalysisData | null>(
		null
	);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [priceInfo, setPriceInfo] = useState<PriceInfo>({
		price: null,
		change: null,
		percent: null,
	});
	const [vix, setVix] = useState<number | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    // View toggle: false = show current option positions, true = show detected strategies
    const [showStrategies, setShowStrategies] = useState(false);
    const [optionGreeksMap, setOptionGreeksMap] = useState<Map<string, OptionGreeks>>(new Map());
	const [progress, setProgress] = useState(0);
	const progressTimer = useRef<NodeJS.Timeout | null>(null);

    const mergeOptionGreeks = useCallback((incoming: Record<string, OptionGreeks> | undefined) => {
        if (!incoming) return;
        const entries = Object.entries(incoming);
        if (entries.length === 0) return;
        setOptionGreeksMap((prev) => {
            const merged = new Map(prev);
            entries.forEach(([key, value]) => {
                if (value) merged.set(key, value);
            });
            return merged;
        });
    }, []);

    const enrichPosition = useCallback((position: any) => {
        const symbol = String(position.symbol || tickerSymbol || '').toUpperCase();
        const strike = Number(position.strike);
        const expiry = String(position.expiry || '');
        const optionType = String(position.type || position.optionType || 'CALL').toUpperCase();
        const key = buildGreeksKey({ symbol, strike, expiry, optionType });
        const greeks = optionGreeksMap.get(key);
        if (!greeks) return position;

        const delta = greeks.delta ?? position.delta ?? null;
        const gamma = greeks.gamma ?? position.gamma ?? null;
        const theta = greeks.theta ?? position.theta ?? null;
        const vega = greeks.vega ?? position.vega ?? null;
        const iv = greeks.iv ?? position.iv ?? null;
        const daysToExpiry = greeks.dte ?? position.daysToExpiry;

        let risk = position.risk;
        if (typeof delta === 'number' && !Number.isNaN(delta)) {
            const absDelta = Math.abs(delta);
            if (absDelta >= 0.75) risk = 'HIGH';
            else if (absDelta >= 0.35) risk = 'MEDIUM';
            else risk = 'LOW';
        }

        const assignmentProb =
            typeof delta === 'number' && !Number.isNaN(delta)
                ? `${(Math.abs(delta) * 100).toFixed(1)}%`
                : position.assignmentProb;

        return {
            ...position,
            delta,
            gamma,
            theta,
            vega,
            iv,
            daysToExpiry,
            risk,
            assignmentProb,
        };
    }, [optionGreeksMap, tickerSymbol]);

    const normalizeOptionPosition = useCallback((position: any) => {
        const optionType = ((position.optionType || position.type || 'CALL').toString().toUpperCase() === 'CALL'
            ? 'CALL'
            : 'PUT') as 'CALL' | 'PUT';
        const base = {
            ...position,
            type: optionType,
            optionType,
        };
        return enrichPosition(base);
    }, [enrichPosition]);

	
	const { data: optionChainData } = useOptionChain(tickerSymbol);
	
	// Fetch market context data independently
	// Skip Market Context for BOTH mode (comma-separated tickers)
	const mcTicker = !tickerSymbol || tickerSymbol.includes(',') || tickerSymbol === 'BOTH' 
		? null 
		: tickerSymbol;
	const { marketData: marketContextData, loading: marketContextLoading } = useMarketContext(mcTicker as string);
	
	// Fetch ETF flows separately for supported tickers
	const { data: etfFlowsData, loading: etfFlowsLoading } = useEtfFlows(
		(tickerSymbol === 'IBIT' || tickerSymbol === 'ETHA') ? tickerSymbol : null
	);
	
	// Fetch real-time quotes for wheel positions
	// Convert date format from 'Jul-18-2025' to '2025-07-18' for API compatibility
	const wheelPositions = useMemo(() => {
		if (!analysisData?.wheelStrategy?.currentPositions) return [];
		
        return analysisData.wheelStrategy.currentPositions.map(pos => {
			const currentPrice = analysisData?.summary?.currentPrice || priceInfo.price || 0;
			const optionKind = String(pos.optionType || pos.type || 'CALL').toUpperCase() === 'CALL' ? 'CALL' : 'PUT';
			const clampStrike = (strike: number): number => {
				const basePrice = Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : 1;
				const normalizedStrike = Number(strike);
				if (!Number.isFinite(normalizedStrike) || normalizedStrike <= 0) {
					return Number((basePrice * (optionKind === 'CALL' ? 1.05 : 0.95)).toFixed(2));
				}
				const ratio = normalizedStrike / basePrice;
				if (!Number.isFinite(ratio) || ratio < 0.1 || ratio > 10) {
					return Number((basePrice * (optionKind === 'CALL' ? 1.05 : 0.95)).toFixed(2));
				}
				return Number(normalizedStrike.toFixed(2));
			};
			const defaultExpiry = optionChainData?.chain?.expiry || (() => {
				const d = new Date();
				d.setDate(d.getDate() + 45);
				return d.toISOString().slice(0, 10);
			})();

			/**
			 * Convert option expiry strings to Polygon's required YYYY-MM-DD format.
			 *
			 * Handles two cases:
			 *   1. Already-formatted dates like "2025-07-18"  → returned unchanged.
			 *   2. AI-style dates like "Jul-18-2025"          → mapped to "2025-07-18".
			 *      (Any other pattern falls back to the original string and a console
			 *       warning, so nothing crashes.)
			 */
			const parseExpiry = (dateStr: string): string => {
				// Handle undefined or null
				if (!dateStr) {
					console.warn('⚠️ parseExpiry: received undefined/null date');
					return '';
				}
				// Case 1 ─ already correct
				if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

				// Case 2 ─ "Jul-18-2025" (MMM-DD-YYYY)
				const monthMap: Record<string, string> = {
					Jan: '01', Feb: '02', Mar: '03', Apr: '04',
					May: '05', Jun: '06', Jul: '07', Aug: '08',
					Sep: '09', Oct: '10', Nov: '11', Dec: '12',
				};

				const match = dateStr.match(/^([A-Za-z]{3})-(\d{1,2})-(\d{4})$/);
				if (match) {
					const [, monStr, day, year] = match;
					// Normalize to capitalize first letter for lookup
					const monthKey = monStr.charAt(0).toUpperCase() + monStr.slice(1).toLowerCase();
					const month = monthMap[monthKey];
					if (month) return `${year}-${month}-${day.padStart(2, '0')}`;
				}

				console.warn('⚠️  parseExpiry: unrecognised format →', dateStr);
				return dateStr;
			};
			
			const resolvedExpiry = (() => {
				const parsed = parseExpiry(pos.expiry);
				return parsed || defaultExpiry;
			})();

			// Map position ensuring we keep all fields including premium data
            const mappedPosition = {
                symbol: (pos.symbol ?? tickerSymbol).toString().toUpperCase(),
                strike: clampStrike(Number(pos.strike)),
                expiry: resolvedExpiry,
                type: optionKind as 'CALL' | 'PUT',
                contracts: pos.contracts,
                // Include both possible premium field names
                premium: pos.premium,
                premiumCollected: pos.premiumCollected
            };
			
			console.log('[WHEEL POSITIONS] Mapped position:', mappedPosition);
			return mappedPosition;
		});
	}, [
		analysisData?.wheelStrategy?.currentPositions,
		analysisData?.summary?.currentPrice,
		priceInfo.price,
		optionChainData?.chain?.expiry,
	]);
	
	console.log('🔄 [WHEEL POSITIONS] Formatted for API:', wheelPositions);
	const { quotes: wheelQuotes } = useWheelQuotes(wheelPositions);

	// Calculate assignment probability from first position's delta (Greeks)
	const assignmentProbability = useMemo(() => {
		if (!wheelQuotes || wheelQuotes.length === 0) return null;

		// Get first successful quote with delta
		const firstQuote = wheelQuotes.find(q => q.success && q.quote?.delta !== null);
		if (!firstQuote || !firstQuote.quote) return null;

		// Assignment probability ≈ |delta| * 100 for short options
		// For calls: high delta (close to 1.0) = high assignment risk
		const delta = firstQuote.quote.delta;
		if (delta === null) return null;

		const probability = Math.abs(delta) * 100;
		console.log('📊 [ASSIGNMENT RISK] Calculated from delta:', { delta, probability });
		return Math.round(probability);
	}, [wheelQuotes]);

	const displayData = analysisData
		? {
				...analysisData,
				technicalFactors: analysisData.technicalFactors ?? [],
				entryPoints: analysisData.entryPoints ?? [],
				exitPoints: analysisData.exitPoints ?? [],
				keyLevels: analysisData.keyLevels ?? [],
				fundamentals: analysisData.fundamentals ?? [],
				vixImpact: analysisData.vixImpact ?? [],
				marketSentiment: analysisData.marketSentiment ?? {},
				recommendation: toPieArray(analysisData.recommendation),
		  }
		: null;

	const fetchAnalysis = async (symbol: string) => {
		if (!symbol) return;

		setIsLoading(true);
		setError(null);

		try {
			const response = await axios.get(`/api/analysis/${symbol}`);
			setAnalysisData(response.data);
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: 'Failed to fetch analysis data'
			);
			setAnalysisData(null);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		fetchAnalysis(tickerSymbol);
	}, [tickerSymbol]);

	useEffect(() => {
    const handler = (e: CustomEvent<StockAnalysisData & { wheelAnalysis?: WheelStrategy }>) => {
			console.log('🔍 [AI RESPONSE DEBUG] Raw AI Response Received:', {
				timestamp: new Date().toISOString(),
				fullResponse: e.detail,
				responseType: typeof e.detail,
				responseKeys: e.detail ? Object.keys(e.detail) : 'null/undefined'
			});
			
			// Deep log the structure
			if (e.detail && typeof e.detail === 'object') {
				console.log('📊 [AI RESPONSE STRUCTURE]', {
					hasRecommendation: !!e.detail.recommendation,
					hasTechnicalFactors: !!e.detail.technicalFactors,
					hasEntryPoints: !!e.detail.entryPoints,
					hasExitPoints: !!e.detail.exitPoints,
					hasActionPlan: !!e.detail.actionPlan,
					hasOptionsStrategy: !!e.detail.optionsStrategy,
					hasWheelAnalysis: !!e.detail.wheelAnalysis,
                // hasDashboardMetrics: !!(e.detail as any).dashboardMetrics,
					allKeys: Object.keys(e.detail)
				});
				
        // Log specific sections that might be wheel-related
        if (e.detail.optionsStrategy) {
            console.log('⚙️ [OPTIONS STRATEGY]', e.detail.optionsStrategy);
        }
        if (e.detail.recommendation) {
            console.log('💡 [RECOMMENDATION]', e.detail.recommendation);
        }
        if (e.detail.actionPlan) {
            console.log('📋 [ACTION PLAN]', e.detail.actionPlan);
        }
        if (e.detail.technicalFactors) {
            console.log('📈 [TECHNICAL FACTORS]', e.detail.technicalFactors);
        }
        }
			
			// 🎯 CRITICAL: Log the wheel strategy data when it arrives
			// Note: The data comes as 'wheelAnalysis' from the edge function
        const wheelData = (e.detail as any).wheelAnalysis || e.detail.wheelStrategy;
			console.log('🚀🚀🚀 [WHEEL STRATEGY DATA RECEIVED]', {
				timestamp: new Date().toISOString(),
				hasWheelStrategy: !!wheelData,
				wheelPhase: wheelData?.currentPhase,
				positions: wheelData?.currentPositions,
				fullWheelData: wheelData
			});

			// 🔍 VERIFY: Does AI see your actual portfolio positions?
        if (wheelData?.currentPositions && wheelData.currentPositions.length > 0) {
            console.log('✅ [AI SEES YOUR POSITIONS]', {
                positionCount: wheelData.currentPositions.length,
                firstPosition: wheelData.currentPositions[0],
                allStrikes: wheelData.currentPositions.map((p: any) => p.strike),
                allReturns: wheelData.currentPositions.map((p: any) => p.cycleReturn),
                wheelPhase: wheelData.currentPhase
            });
        } else {
            console.log('❌ [AI DEFAULTING TO GENERIC] No specific positions found in AI response:', {
                wheelAnalysis: e.detail.wheelAnalysis,
					wheelStrategy: e.detail.wheelStrategy
				});
			}
			
			// Normalize the data structure - handle both wheelAnalysis and wheelStrategy
	        const normalizedData = {
	            ...(e.detail as any),
	            wheelDeterministic: (e.detail as any).wheelDeterministic,
	            wheelStrategy: (e.detail as any).wheelAnalysis || e.detail.wheelStrategy
	        } as StockAnalysisData;
	        mergeOptionGreeks((e.detail as any).optionGreeks as Record<string, OptionGreeks> | undefined);
			
			// Add error handling before setting state
			try {
				console.log('📊 [STOCK ANALYSIS] About to set analysis data:', normalizedData);
				setAnalysisData(normalizedData); // fills tabs
				console.log('✅ [STOCK ANALYSIS] Analysis data set successfully');
        } catch (error) {
            console.error('❌ [STOCK ANALYSIS] Error setting analysis data:', error);
            if (error instanceof Error) {
                console.error('Error stack:', error.stack);
            }
            console.error('Normalized data that caused error:', normalizedData);
        }
		};
		window.addEventListener('analysis-ready', handler as EventListener);
		return () =>
			window.removeEventListener(
				'analysis-ready',
				handler as EventListener
			);
	}, []);

    useEffect(() => {
        const greeksHandler = (event: Event) => {
            const custom = event as CustomEvent<{ greeks?: Record<string, OptionGreeks> }>;
            mergeOptionGreeks(custom.detail?.greeks);
        };
        window.addEventListener('analysis:greeks-ready', greeksHandler);
        return () => window.removeEventListener('analysis:greeks-ready', greeksHandler);
    }, [mergeOptionGreeks]);

	useEffect(() => {
		const start = () => {
			setIsAnalyzing(true);
			setProgress(15); // initial jump so bar is visible
            setOptionGreeksMap(new Map());
			if (progressTimer.current) clearInterval(progressTimer.current);
			// increment toward 90 while analyzing
			progressTimer.current = setInterval(() => {
				setProgress((p) => (p < 90 ? p + 5 : p));
			}, 450);
		};

		const done = () => {
			if (progressTimer.current) {
				clearInterval(progressTimer.current);
				progressTimer.current = null;
			}
			setProgress(100);
			// brief pause so user sees full bar, then hide
			setTimeout(() => {
				setIsAnalyzing(false);
				setProgress(0);
			}, 500);
		};

		window.addEventListener('analysis-start', start);
		window.addEventListener('analysis-done', done);
		return () => {
			window.removeEventListener('analysis-start', start);
			window.removeEventListener('analysis-done', done);
			if (progressTimer.current) clearInterval(progressTimer.current);
		};
	}, []);
	useEffect(() => {
		const priceHandler = (e: CustomEvent<PriceInfo>) => {
			setPriceInfo(e.detail);
		};
		window.addEventListener('price-update', priceHandler as EventListener);
		return () =>
			window.removeEventListener(
				'price-update',
				priceHandler as EventListener
			);
	}, []);
	// Fetch latest VIX once on mount (try Yahoo JSON first, fallback to Stooq CSV)
	useEffect(() => {
		const yahooUrl =
			'https://api.allorigins.win/raw?url=' +
			encodeURIComponent(
				'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=5d'
			);

		fetch(yahooUrl)
			.then((r) => r.json())
			.then((json) => {
				const closes =
					json.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
				const last = Array.isArray(closes)
					? closes.reverse().find((v) => v != null)
					: null;
				if (typeof last === 'number') {
					console.log('📊 [VIX] Fetched from Yahoo Finance:', last);
					setVix(last);
				} else {
					throw new Error('Yahoo close not found');
				}
			})
			.catch(() => {
				// Fallback to Stooq CSV
				const stooqUrl =
					'https://api.allorigins.win/raw?url=' +
					encodeURIComponent('https://stooq.com/q/l/?s=%5Evix&i=d');
				fetch(stooqUrl)
					.then((r) => r.text())
					.then((csv) => {
						const parts = csv.trim().split(',');
						const close = parseFloat(parts[5]);
						if (!isNaN(close)) {
							console.log('📊 [VIX] Fetched from Stooq (fallback):', close);
							setVix(close);
						} else {
							console.warn('📊 [VIX] Fallback parse failed', csv);
							setVix(null);
						}
					})
					.catch((err) => {
						console.error('VIX fetch failed:', err);
						setVix(null);
					});
			});
	}, []);
	return (
		<div className='h-full w-full'>
			{isLoading && (
				<div className='flex items-center justify-center h-full'>
					<p>Loading analysis...</p>
				</div>
			)}
			{error && (
				<div className='flex items-center justify-center h-full'>
					<p className='text-red-500'>{error}</p>
				</div>
			)}
			{!isLoading && !error && !displayData && (
				<div className='flex items-center justify-center h-full'>
					<p className='text-gray-500'>No analysis data available</p>
				</div>
			)}
			{!isLoading && !error && displayData && (
			<Card className='w-full h-full flex flex-col overflow-hidden !pt-0'>
				<CardHeader className='bg-gray-100 border-b flex flex-col justify-center pt-6'>
					<CardTitle className='text-xl'>
						{tickerSymbol || 'N/A'} Strategic Investment Analysis
					</CardTitle>
					<CardDescription className='text-gray-600'>
						Current Price: $
						{priceInfo.price !== null
							? priceInfo.price.toFixed(2)
							: displayData?.summary?.currentPrice?.toFixed(2) ||
							  'N/A'}{' '}
						(
						{priceInfo.change !== null && priceInfo.change > 0
							? '+'
							: ''}
						{priceInfo.change !== null
							? priceInfo.change.toFixed(2)
							: displayData?.summary?.priceChange?.toFixed(2) ||
							  'N/A'}{' '}
						/
						{priceInfo.percent !== null
							? priceInfo.percent
							: displayData?.summary?.priceChangePercent || 'N/A'}
						) | VIX:{' '}
						{vix !== null
							? vix.toFixed(2)
							: displayData?.summary?.vix || 'N/A'}{' '}
						| Overall Assessment:{' '}
						<span className='font-bold text-gray-800'>
							{displayData?.summary?.overallAssessment ||
								'Loading...'}
						</span>
					</CardDescription>
				</CardHeader>
				<CardContent className='flex-grow p-4 overflow-y-auto'>
					{/* Status Cards Row - Moved above tabs */}
					{analysisData?.wheelStrategy && (
						<div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
							{/* Use modular cards instead of inline JSX */}
							<PositionStatusCard
								shareCount={analysisData.wheelStrategy?.shareCount || 0}
								positions={analysisData.wheelStrategy?.currentPositions || []}
							/>

							<IVEnvironmentCard
								vix={vix}
							/>

							<AssignmentRiskCard
								assignmentProb={assignmentProbability}
							/>
						</div>
					)}

					{/* Inline loader using shadcn style */}
					{/* Determinate Progress bar while AI builds */}
					{isAnalyzing && (
						<div className='mb-4'>
							{/* determinate blue bar */}
							<Progress
								value={progress}
								className='w-full h-2 [&>div]:bg-blue-500'
							/>
						</div>
					)}
					{/* Tabs */}
					<Tabs defaultValue='performance' className='w-full'>
						{/* Styling to match the light gray image reference */}
						<TabsList className='grid w-full grid-cols-5 mb-4 bg-gray-100 rounded-lg p-1'>
							{/* Styling for triggers */}
							<TabsTrigger
								value='performance'
								className='data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 text-gray-500 rounded-md py-1.5 text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none'>
								Performance Analysis
							</TabsTrigger>
							<TabsTrigger
								value='wheel-execution'
								className='data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 text-gray-500 rounded-md py-1.5 text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none'>
								Wheel Execution
							</TabsTrigger>
							<TabsTrigger
								value='recommendations'
								className='data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 text-gray-500 rounded-md py-1.5 text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none'>
								Recommendations
							</TabsTrigger>
							<TabsTrigger
								value='continuation-plan'
								className='data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 text-gray-500 rounded-md py-1.5 text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none'>
								Continuation Plan
							</TabsTrigger>
							<TabsTrigger
								value='market-context'
								className='data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 text-gray-500 rounded-md py-1.5 text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none'>
								Market Context
							</TabsTrigger>
						</TabsList>

						{/* Performance Analysis Tab Content - Testing Hook */}
						<TabsContent
							value='performance'
							className='space-y-4'>
                        {/* Debug logging removed from JSX to satisfy ReactNode typing */}
							
                        {analysisData?.wheelStrategy ? (
                            <>

                                <Card className="w-full">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between gap-4">
                                            <CardTitle className="text-lg">
                                                {showStrategies ? 'Detected Strategies' : 'Current Option Positions'}
                                            </CardTitle>
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm text-gray-600">
                                                    {showStrategies ? 'Current Option Positions' : 'Detected Strategies'}
                                                </span>
                                                <Switch
                                                    checked={showStrategies}
                                                    onCheckedChange={(v) => setShowStrategies(v)}
                                                    size="sm"
                                                    aria-label="Toggle between current positions and detected strategies"
                                                />
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        {!showStrategies ? (
											(() => {
												const positions = analysisData?.wheelStrategy?.currentPositions || [];
												const currentPrice = analysisData?.summary?.currentPrice || priceInfo.price || 0;
                                        const normalized = positions.map(normalizeOptionPosition);
												const soldCalls = normalized.filter(p => (p.contracts || 0) < 0 && p.type === 'CALL');
												const boughtCalls = normalized.filter(p => (p.contracts || 0) > 0 && p.type === 'CALL');
												const soldPuts = normalized.filter(p => (p.contracts || 0) < 0 && p.type === 'PUT');
												const boughtPuts = normalized.filter(p => (p.contracts || 0) > 0 && p.type === 'PUT');
												const renderGroup = (title: string, list: typeof normalized) => list.length > 0 ? (
													<div className="mb-6">
														<div className="font-semibold text-sm mb-2">{title}</div>
														{list.map((p, idx) => (
															<OptionPositionCard
																key={`${p.symbol}-${p.type}-${p.strike}-${p.expiry}-${idx}`}
																position={p}
																currentPrice={currentPrice}
															/>
														))}
													</div>
												) : null;
												return (
													<div>
														{renderGroup('SOLD CALLS', soldCalls)}
														{renderGroup('BOUGHT CALLS', boughtCalls)}
														{renderGroup('SOLD PUTS', soldPuts)}
														{renderGroup('BOUGHT PUTS', boughtPuts)}
														{normalized.length === 0 && <div className="text-gray-500 text-sm">No active option positions</div>}
													</div>
												);
                                        })()
                                        ) : (
                                            <div className="space-y-4">
                                                {analysisData?.wheelDeterministic?.strategies && analysisData.wheelDeterministic.strategies.length > 0 ? (
                                                    analysisData.wheelDeterministic.strategies.map((strategy) => (
                                                        <StrategyCard key={strategy.id} strategy={strategy} />
                                                    ))
                                                ) : (
                                                    <div className="text-gray-500 text-sm">No strategies detected</div>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
								</>
							) : (
								<div className="text-center py-8">
									<p className="text-gray-500">Wheel strategy analysis will appear here once analysis completes.</p>
								</div>
							)}
						</TabsContent>

						{/* Wheel Execution Tab Content */}
						<TabsContent value='wheel-execution' className='space-y-4'>
							{analysisData?.wheelStrategy ? (
								<>
									{/* Position Action Guide Card */}
									<Card>
										<CardHeader>
											<CardTitle>Position Action Guide</CardTitle>
											<CardDescription>
												Plain English instructions for managing your positions
											</CardDescription>
										</CardHeader>
										<CardContent>
											<div className="space-y-4">
												{(() => {
													const rawPositions = analysisData.wheelStrategy?.currentPositions || [];
													const positions = rawPositions.map(normalizeOptionPosition);
													const currentPrice = displayData?.summary?.currentPrice || priceInfo.price || 0;
													
													// Generate plain English guidance for each position
													const generatePositionGuidance = (position: any) => {
														const daysToExpiry = position.daysToExpiry || 0;
														const delta = position.delta || 0;
														const isCall = position.type === 'CALL';
														const moneyness = ((currentPrice - position.strike) / position.strike) * 100;
														
														// Build guidance based on position characteristics
														let action = '';
														let watching = '';
														let trigger = '';
														
														if (daysToExpiry <= 5) {
															// Expiring soon
															if (isCall && moneyness > 0) {
																action = `Do nothing. Let it be called away on ${position.expiry} at $${position.strike}`;
																watching = `Stock will be sold at $${position.strike} if price stays above strike`;
															} else if (isCall && moneyness < 0) {
																action = `Let it expire worthless on ${position.expiry}. Keep your shares and the premium`;
																watching = `Option will expire worthless if ${tickerSymbol} stays below $${position.strike}`;
															} else if (!isCall && moneyness < 0) {
																action = `Do nothing. You'll be assigned shares at $${position.strike}`;
																watching = `You'll buy shares at $${position.strike} if price stays below strike`;
															} else {
																action = `Let it expire worthless. Keep the premium`;
																watching = `Option will expire worthless if ${tickerSymbol} stays above $${position.strike}`;
															}
														} else if (Math.abs(delta) > 0.90) {
															// Deep in the money - high assignment risk
															if (isCall) {
																action = `Consider rolling if you want to keep shares. Otherwise, prepare for assignment`;
																trigger = `Roll ONE at a time when ${tickerSymbol} drops below $${(position.strike * 0.98).toFixed(2)}`;
																watching = `Very likely to be assigned. Delta: ${(Math.abs(delta) * 100).toFixed(0)}%`;
															} else {
																action = `High chance of assignment. Prepare cash or consider rolling`;
																trigger = `Roll if ${tickerSymbol} rises above $${(position.strike * 1.02).toFixed(2)}`;
																watching = `Very likely to be assigned. Delta: ${(Math.abs(delta) * 100).toFixed(0)}%`;
															}
														} else if (Math.abs(delta) > 0.70) {
															// Moderate to high assignment risk
															action = `Hold for now. Monitor daily`;
															trigger = `Consider action if ${tickerSymbol} ${isCall ? 'rises above' : 'falls below'} $${(position.strike * (isCall ? 1.05 : 0.95)).toFixed(2)}`;
															watching = `Assignment probability: ${(Math.abs(delta) * 100).toFixed(0)}%`;
														} else if (Math.abs(delta) > 0.30) {
															// Moderate risk
															action = `Hold and collect theta decay`;
															watching = `Earning $${Math.abs(position.theta || 0).toFixed(2)}/day from time decay`;
															trigger = `Watch if ${tickerSymbol} moves ${isCall ? 'above' : 'below'} $${(position.strike * (isCall ? 0.98 : 1.02)).toFixed(2)}`;
														} else {
															// Low risk
															action = `Hold to expiration. Very safe`;
															watching = `Low assignment risk (${(Math.abs(delta) * 100).toFixed(0)}%). Earning $${Math.abs(position.theta || 0).toFixed(2)}/day`;
														}
														
														return {
															position,
															action,
															watching,
															trigger,
															moneyness,
															riskLevel: Math.abs(delta) > 0.70 ? 'high' : Math.abs(delta) > 0.30 ? 'medium' : 'low'
														};
													};
													
													const guidanceItems = positions.map(generatePositionGuidance);
													
													// Check if user has cash for selling puts
													const hasShares = analysisData.wheelStrategy?.shareCount > 0;
													const availableShares = analysisData.wheelStrategy?.shareCount || 0;
													const coveredShares = positions
														.filter((p: any) => p.type === 'CALL')
														.reduce((sum: number, p: any) => sum + Math.abs(p.contracts || 0) * 100, 0);
													const uncoveredShares = Math.max(0, availableShares - coveredShares);
													
													return (
														<>
															{guidanceItems.length > 0 ? (
																<>
																	{/* Active Position Guidance */}
																	{guidanceItems.map((item, idx) => (
																		<div key={idx} className="border rounded-lg p-4 bg-gray-50">
																			<div className="flex justify-between items-start mb-2">
																				<div className="font-semibold text-sm">
																					${item.position.strike} {item.position.type} - {item.position.expiry}
																				</div>
																				<span className={`text-xs px-2 py-1 rounded ${
																					item.riskLevel === 'high' ? 'bg-red-100 text-red-700' :
																					item.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-700' :
																					'bg-green-100 text-green-700'
																				}`}>
																					{item.riskLevel.toUpperCase()} RISK
																				</span>
																			</div>
																			
																			<div className="space-y-2 text-sm">
																				<div className="flex items-start">
																					<span className="font-medium text-gray-700 mr-2">Action:</span>
																					<span className="text-gray-900">{item.action}</span>
																				</div>
																				
																				<div className="flex items-start">
																					<span className="font-medium text-gray-700 mr-2">Watching:</span>
																					<span className="text-gray-600">{item.watching}</span>
																				</div>
																				
																				{item.trigger && (
																					<div className="flex items-start">
																						<span className="font-medium text-gray-700 mr-2">Trigger:</span>
																						<span className="text-blue-600">{item.trigger}</span>
																					</div>
																				)}
																			</div>
																		</div>
																	))}
																	
																	{/* Cash/Share Position Guidance */}
																	<div className="border-t pt-4 mt-4">
																		<h4 className="font-semibold text-sm mb-2">New Position Guidance</h4>
																		{uncoveredShares >= 100 ? (
																			<div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
																				<div className="font-medium text-blue-900 mb-1">
																					You have {uncoveredShares} uncovered shares
																				</div>
																				<div className="text-blue-700">
																					Consider selling {Math.floor(uncoveredShares / 100)} covered calls at strikes above ${(currentPrice * 1.02).toFixed(2)} for additional income
																				</div>
																			</div>
																		) : !hasShares ? (
																			<div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
																				<div className="font-medium text-green-900 mb-1">
																					Cash position available
																				</div>
																				<div className="text-green-700">
																					Consider selling cash-secured puts at strikes below ${(currentPrice * 0.95).toFixed(2)} to acquire shares with premium income
																				</div>
																			</div>
																		) : (
																			<div className="text-gray-500 text-sm">
																				All shares are covered with calls. Wait for positions to expire or get assigned.
																			</div>
																		)}
																	</div>
																</>
															) : (
																<div className="text-center text-gray-500 py-4">
																	No active option positions to manage
																</div>
															)}
														</>
													);
												})()}
											</div>
										</CardContent>
									</Card>

									{/* Wheel Strategy Metrics Card - Time-Based View */}
									<Card className="w-full mt-4">
										<CardHeader className="pb-3">
											<CardTitle className="text-lg">Wheel Strategy Metrics</CardTitle>
											<CardDescription>Time-based performance breakdown</CardDescription>
										</CardHeader>
										<CardContent>
											<div className="space-y-4">
												{(() => {
													// Get positions and quotes
                                            const positions = analysisData.wheelStrategy?.currentPositions || [];
                                            const enrichedPositions = positions.map(normalizeOptionPosition);
                                            console.log('[WHEEL METRICS UI] Positions from analysis:', positions);
                                            console.log('[WHEEL METRICS UI] Wheel quotes:', wheelQuotes);

                                            const timeGroups = groupPositionsByTimeframe(enrichedPositions, wheelQuotes);
													
													// Calculate overall metrics
													const goodQuotes = wheelQuotes.filter(q => q.success && q.quote);
                                const overallMetrics = goodQuotes.length > 0 
                                    ? calculateAggregateMetrics(
                                        positions.map(p => ({
                                            symbol: p.symbol || tickerSymbol,
                                            strike: p.strike,
                                            expiry: p.expiry,
                                            type: (p.optionType || p.type || 'CALL') as 'CALL' | 'PUT',
                                            contracts: p.contracts,
                                            premium: p.premium ?? p.premiumCollected
                                        })),
                                        wheelQuotes
                                      )
                                    : null;
													
													const totalPremiumCollected = overallMetrics?.totalPremiumCollected || 0;
													const totalCostToClose = overallMetrics?.totalCostToClose || 0;
													const netPositionValue = totalPremiumCollected - totalCostToClose;
													
													return (
														<>
															{/* Overall Summary Section */}
															<div className="pb-4 border-b">
																<div className="flex justify-between items-baseline mb-2">
																	<span className="text-sm text-gray-600">Total Premium Collected</span>
																	<span className="text-lg font-bold">
																		${Math.round(totalPremiumCollected).toLocaleString()}
																	</span>
																</div>
																<div className="flex justify-between items-baseline mb-2">
																	<span className="text-sm text-gray-600">Net Position Value</span>
																	<span className={`text-lg font-bold ${netPositionValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
																		{netPositionValue >= 0 ? '+' : ''}${Math.round(Math.abs(netPositionValue)).toLocaleString()}
																	</span>
																</div>
																<div className="flex justify-between items-baseline">
																	<span className="text-sm text-gray-600">Cost to Close All</span>
																	<span className="text-lg font-bold">
																		${Math.round(totalCostToClose).toLocaleString()}
																	</span>
																</div>
															</div>
															
															{/* Time-Based Breakdown */}
															{timeGroups.length > 0 ? (
																timeGroups.map((group, idx) => (
																	<div key={idx} className="pt-3 border-t">
																		<div className="mb-2">
																			<span className="text-sm font-semibold">📅 {group.label}</span>
																			<span className="text-xs text-gray-500 ml-2">
																				({formatExpiryLabel(group.expiryDate)})
																			</span>
																		</div>
																		
																		<div className="grid grid-cols-2 gap-2 text-sm">
																			<div>
																				<span className="text-gray-600">Premium Collected: </span>
																				<span className="font-semibold">
																					${Math.round(group.totalPremiumCollected).toLocaleString()}
																				</span>
																			</div>
																			<div>
																				<span className="text-gray-600">Shares at Risk: </span>
																				<span className="font-semibold">
																					{group.totalSharesAtRisk.toLocaleString()}
																				</span>
																			</div>
																		</div>
																		
																		<div className="grid grid-cols-2 gap-2 text-sm mt-1">
																			<div>
																				<span className="text-gray-600">Cost to Close: </span>
																				<span className="font-semibold">
																					${Math.round(group.totalCostToClose).toLocaleString()}
																				</span>
																			</div>
																			<div>
																				<span className="text-gray-600">Net P&L: </span>
																				<span className={`font-semibold ${group.netPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
																					{group.netPL >= 0 ? '+' : ''}${Math.round(Math.abs(group.netPL)).toLocaleString()}
																				</span>
																			</div>
																		</div>
																		
																		<div className="text-sm mt-1">
																			<span className="text-gray-600">Assignment Prob: </span>
																			<span className={`font-semibold ${
																				group.avgAssignmentProb > 0.7 ? 'text-red-600' :
																				group.avgAssignmentProb > 0.3 ? 'text-yellow-600' :
																				'text-green-600'
																			}`}>
																				{(group.avgAssignmentProb * 100).toFixed(1)}%
																			</span>
																			<span className="text-xs text-gray-500 ml-2">
																				({group.positions.map(p => `$${p.strike}`).join(', ')})
																			</span>
																		</div>
																	</div>
																))
															) : (
																<div className="text-center text-gray-500 py-4">
																	No active option positions
																</div>
															)}
														</>
													);
												})()}
											</div>
										</CardContent>
									</Card>

									{/* Next Cycle Opportunity Card */}
									{optionChainData?.success && optionChainData.chain && (
										<Card className="w-full mt-4">
											<CardHeader className="pb-3">
												<CardTitle className="text-lg">Next Wheel Opportunity (Target: 30-45% Annual)</CardTitle>
												<CardDescription>Searching for high-yield covered call positions</CardDescription>
											</CardHeader>
											<CardContent>
												<div className="space-y-3">
													{(() => {
														// Calculate these values inside the card where they're used
														const currentPrice = displayData?.summary?.currentPrice || priceInfo.price || 0;
														
														// Calculate potential return for next cycle (from option chain)
														// For wheel opportunity, always calculate based on 100 shares per contract
														const nextCycleReturn = optionChainData?.success && optionChainData.chain
															? (optionChainData.chain.mid / optionChainData.chain.strike) * (365 / optionChainData.chain.dte) * 100
															: null;
														
														// Calculate assignment probability for next cycle
														const nextCycleAssignmentProb = currentPrice && optionChainData?.chain
															? estimateAssignmentProb(
																currentPrice,
																optionChainData.chain.strike,
																optionChainData.chain.dte
															)
															: null;
														
														return (<>
													<div className="flex justify-between items-baseline">
														<span className="text-sm text-gray-600">Contract</span>
														<span className="font-mono text-sm">
															{tickerSymbol} ${optionChainData.chain.strike} CALL {optionChainData.chain.expiry}
														</span>
													</div>
													<div className="flex justify-between items-baseline">
														<span className="text-sm text-gray-600">Days to Expiry</span>
														<span className="font-bold">{optionChainData.chain.dte} days</span>
													</div>
													<div className="flex justify-between items-baseline">
														<span className="text-sm text-gray-600">Delta</span>
														<span className="font-bold">{(optionChainData.chain.delta * 100).toFixed(1)}%</span>
													</div>
													<div className="flex justify-between items-baseline">
														<span className="text-sm text-gray-600">Premium per Contract</span>
														<span className="font-bold">${(optionChainData.chain.mid * 100).toFixed(2)}</span>
													</div>
													<div className="flex justify-between items-baseline border-t pt-2">
														<span className="text-sm font-medium text-gray-700">Annualized Return</span>
														<span className={`text-lg font-bold ${
															nextCycleReturn && nextCycleReturn >= 30 && nextCycleReturn <= 45 
																? 'text-green-600' 
																: nextCycleReturn && nextCycleReturn > 45 
																	? 'text-yellow-600' 
																	: 'text-orange-600'
														}`}>
															{nextCycleReturn ? (
																<>
																	{nextCycleReturn.toFixed(1)}%
																	{nextCycleReturn >= 30 && nextCycleReturn <= 45 && ' ✓'}
																	{nextCycleReturn < 30 && ' (Below target)'}
																</>
															) : 'N/A'}
														</span>
													</div>
													<div className="flex justify-between items-baseline">
														<span className="text-sm font-medium text-gray-700">12-Month Compounded</span>
														<span className="text-lg font-bold text-green-600">
															{nextCycleReturn ? `${compounding(nextCycleReturn).toFixed(1)}%` : 'N/A'}
														</span>
													</div>
													<div className="flex justify-between items-baseline">
														<span className="text-sm text-gray-600">Assignment Probability</span>
														<span className="font-medium">
															{nextCycleAssignmentProb ? `${(nextCycleAssignmentProb * 100).toFixed(0)}%` : 'N/A'}
														</span>
													</div>
														</>);
													})()}
												</div>
											</CardContent>
										</Card>
									)}
								</>
							) : (
								<div className="text-center py-8">
									<p className="text-gray-500">Wheel execution analysis will appear here once analysis completes.</p>
								</div>
							)}
						</TabsContent>

						{/* Recommendations Tab Content */}
						<TabsContent value='recommendations' className='space-y-4'>
							{analysisData?.recommendations ? (
								<>
									{/* Position Snapshot */}
									<Card>
										<CardHeader>
											<CardTitle>Position Snapshot</CardTitle>
											<CardDescription>
												Current holdings and performance
											</CardDescription>
										</CardHeader>
										<CardContent>
											{(() => {
												const cashPosition = analysisData.recommendations.positionSnapshot?.find(p => p.type === 'Cash');
												const otherPositions = analysisData.recommendations.positionSnapshot?.filter(p => p.type !== 'Cash') || [];
												
												return (
													<>
														{/* Cash Balance Display */}
														{cashPosition && (
															<div className="mb-4 p-3 bg-gray-50 rounded-lg">
																<div className="flex justify-between items-center">
																	<div>
																		<span className="text-sm font-medium text-gray-700">Cash Balance</span>
																		{cashPosition.comment && (
																			<span className="ml-2 text-xs text-gray-500">({cashPosition.comment})</span>
																		)}
																	</div>
																	<span className="text-lg font-semibold">
																		${Math.round(cashPosition.currentValue || 0).toLocaleString()}
																	</span>
																</div>
															</div>
														)}
														
														{/* Positions Table */}
														<div className="overflow-x-auto">
															<table className="w-full text-sm">
																<thead>
																	<tr className="border-b">
																		<th className="text-left py-2">Type</th>
																		<th className="text-left py-2">Symbol</th>
																		<th className="text-right py-2">Qty</th>
																		<th className="text-right py-2">Strike/Basis</th>
																		<th className="text-right py-2">Premium</th>
																		<th className="text-right py-2">Profit</th>
																		<th className="text-left py-2">Status</th>
																	</tr>
																</thead>
																<tbody>
																	{otherPositions.map((position, idx) => (
																		<tr key={idx} className="border-b">
																			<td className="py-2">{position.type}</td>
																			<td className="py-2">{position.ticker || '—'}</td>
																			<td className="text-right py-2">{position.quantity}</td>
																			<td className="text-right py-2">${Math.round((position.strike ?? position.basis ?? 0)).toLocaleString()}</td>
																			<td className="text-right py-2">
																				{position.type === 'Covered Call' && position.premiumCollected !== undefined ? 
																					`$${Math.round(position.premiumCollected).toLocaleString()}` : 
																					`$${Math.round((position.currentValue ?? 0)).toLocaleString()}`
																				}
																			</td>
																			<td className={`text-right py-2 font-medium ${
																				position.type === 'Covered Call' ? 'text-green-600' : 
																				(position.pl ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
																			}`}>
																				{position.type === 'Covered Call' && position.wheelProfit !== undefined ? 
																					`$${Math.round(position.wheelProfit).toLocaleString()}` :
																					position.pl !== undefined ? `$${Math.round(position.pl).toLocaleString()}` : '—'
																				}
																			</td>
																			<td className="py-2 text-xs text-gray-600 pl-4">{position.comment}</td>
																		</tr>
																	))}
																</tbody>
															</table>
														</div>
													</>
												);
											})()}
										</CardContent>
									</Card>

									{/* Roll Analysis */}
									<Card>
										<CardHeader>
											<CardTitle>Roll Analysis</CardTitle>
											<CardDescription>
												Position-by-position roll recommendations
											</CardDescription>
										</CardHeader>
										<CardContent className="space-y-4">
											{analysisData.recommendations.rollAnalysis?.map((roll, idx) => {
												// Normalize roll data to prevent crashes from missing ruleA/ruleB
												const safeRuleA = roll?.ruleA ?? { triggered: false, threshold: null, current: null, detail: 'Not available' };
												const safeRuleB = roll?.ruleB ?? { triggered: false, threshold: null, current: null, detail: 'Not available' };
												
												return (
													<div key={idx} className="border rounded-lg p-4 bg-gray-50">
														<div className="flex justify-between items-start mb-2">
															<h4 className="font-semibold">{roll.position}</h4>
															<span className={`px-2 py-1 rounded text-xs font-medium ${
																roll.action === 'ROLL' ? 'bg-yellow-100 text-yellow-800' :
																roll.action === 'HOLD' ? 'bg-green-100 text-green-800' :
																'bg-gray-100 text-gray-800'
															}`}>
																{roll.action}
															</span>
														</div>
														
														<div className="grid grid-cols-2 gap-4 text-sm">
															<div>
																<p className="text-gray-600">Rule A (Price ≥ Strike × 1.08)</p>
																<p className={`font-medium ${safeRuleA.triggered ? 'text-red-600' : 'text-green-600'}`}>
																	{safeRuleA.triggered ? '🔴 TRIGGERED' : '🟢 Not triggered'}
																</p>
																<p className="text-xs text-gray-500">{safeRuleA.detail || 'Not available'}</p>
															</div>
															<div>
																<p className="text-gray-600">Rule B (Delta ≥ 0.80)</p>
																<p className={`font-medium ${safeRuleB.triggered ? 'text-red-600' : 'text-green-600'}`}>
																	{safeRuleB.triggered ? '🔴 TRIGGERED' : '🟢 Not triggered'}
																</p>
																<p className="text-xs text-gray-500">{safeRuleB.detail || 'Not available'}</p>
															</div>
														</div>
													
													{roll.conditionalTrigger && (
														<div className="mt-3 p-2 bg-yellow-50 rounded">
															<p className="text-sm font-medium">📌 {roll.conditionalTrigger}</p>
														</div>
													)}
													
													{roll.recommendation && (
														<p className="mt-2 text-sm text-gray-700">{roll.recommendation}</p>
													)}
												</div>
											);
											})}
										</CardContent>
									</Card>

									{/* Cash Management */}
									<Card>
										<CardHeader>
											<CardTitle>Cash Management</CardTitle>
											<CardDescription>
												Cash buffer and trading capacity
											</CardDescription>
										</CardHeader>
										<CardContent>
											{analysisData.recommendations.cashManagement && (
												<div className="space-y-3">
													<div className="flex justify-between items-center pb-3 border-b">
														<span className="text-gray-600">Current Cash</span>
														<span className="font-semibold">${Math.round(analysisData.recommendations.cashManagement.currentCash).toLocaleString()}</span>
													</div>
													<div className="flex justify-between items-center pb-3 border-b">
														<span className="text-gray-600">Minimum Required</span>
														<span className="font-semibold">${Math.round(analysisData.recommendations.cashManagement.minimumRequired).toLocaleString()}</span>
													</div>
													<div className="flex justify-between items-center pb-3 border-b">
														<span className="text-gray-600">Available for Trades</span>
														<span className={`font-semibold ${
															analysisData.recommendations.cashManagement.currentCash >= 6000 
																? 'text-green-600' 
																: 'text-red-600'
														}`}>
															${Math.round(analysisData.recommendations.cashManagement.currentCash).toLocaleString()}
														</span>
													</div>
													{analysisData.recommendations.cashManagement.bufferRemaining !== undefined && (
														<div className="flex justify-between items-center pb-3 border-b">
															<span className="text-gray-600">Above Buffer</span>
															<span className="font-semibold">
																${Math.round(analysisData.recommendations.cashManagement.bufferRemaining).toLocaleString()}
															</span>
														</div>
													)}
													<div className="mt-4 p-3 bg-blue-50 rounded">
														<p className="text-sm">{analysisData.recommendations.cashManagement.recommendation}</p>
													</div>
												</div>
											)}
										</CardContent>
									</Card>

									{/* Action Plan */}
									<Card>
										<CardHeader>
											<CardTitle>Action Plan</CardTitle>
											<CardDescription>
												What to do and when
											</CardDescription>
										</CardHeader>
										<CardContent>
											{analysisData.recommendations.actionPlan && (
												<div className="space-y-4">
													<div>
														<h4 className="font-medium text-gray-700 mb-2">Before Open</h4>
														<ul className="space-y-1">
															{analysisData.recommendations.actionPlan.beforeOpen?.map((action, idx) => (
																<li key={idx} className="text-sm text-gray-600 flex items-start">
																	<span className="mr-2">•</span>
																	<span>{action}</span>
																</li>
															))}
														</ul>
													</div>
													
													<div>
														<h4 className="font-medium text-gray-700 mb-2">During Hours</h4>
														<ul className="space-y-1">
															{analysisData.recommendations.actionPlan.duringHours?.map((action, idx) => (
																<li key={idx} className="text-sm text-gray-600 flex items-start">
																	<span className="mr-2">•</span>
																	<span>{action}</span>
																</li>
															))}
														</ul>
													</div>
													
													<div>
														<h4 className="font-medium text-gray-700 mb-2">End of Day</h4>
														<ul className="space-y-1">
															{analysisData.recommendations.actionPlan.endOfDay?.map((action, idx) => (
																<li key={idx} className="text-sm text-gray-600 flex items-start">
																	<span className="mr-2">•</span>
																	<span>{action}</span>
																</li>
															))}
														</ul>
													</div>
												</div>
											)}
										</CardContent>
									</Card>

									{/* Plain English Summary */}
									<Card>
										<CardHeader>
											<CardTitle>Summary</CardTitle>
											<CardDescription>
												Plain English overview
											</CardDescription>
										</CardHeader>
										<CardContent>
											{analysisData.recommendations.plainEnglishSummary && (
												<div className="space-y-4">
													<div>
														<p className="text-sm font-medium text-gray-700">Current Situation</p>
														<p className="text-sm text-gray-600 mt-1">
															{analysisData.recommendations.plainEnglishSummary.currentSituation}
														</p>
													</div>
													
													<div>
														<p className="text-sm font-medium text-gray-700">Immediate Actions</p>
														<ul className="mt-1 space-y-1">
															{analysisData.recommendations.plainEnglishSummary.immediateActions?.map((action, idx) => (
																<li key={idx} className="text-sm text-gray-600 flex items-start">
																	<span className="mr-2">•</span>
																	<span>{action}</span>
																</li>
															))}
														</ul>
													</div>
													
													<div>
														<p className="text-sm font-medium text-gray-700">What to Watch</p>
														<ul className="mt-1 space-y-1">
															{analysisData.recommendations.plainEnglishSummary.monitoringPoints?.map((point, idx) => (
																<li key={idx} className="text-sm text-gray-600 flex items-start">
																	<span className="mr-2">•</span>
																	<span>{point}</span>
																</li>
															))}
														</ul>
													</div>
													
													<div className="pt-3 border-t">
														<p className="text-sm text-gray-600">
															<span className="font-medium">Next Review:</span> {analysisData.recommendations.plainEnglishSummary.nextReview}
														</p>
													</div>
												</div>
											)}
										</CardContent>
									</Card>
								</>
							) : (
								<Card>
									<CardContent className="py-8">
										<p className="text-center text-gray-500">
											Recommendations will appear here once analysis completes.
										</p>
									</CardContent>
								</Card>
							)}
						</TabsContent>

						{/* Continuation Plan Tab Content */}
						<TabsContent value='continuation-plan' className='space-y-4'>
							<Card>
								<CardHeader>
									<CardTitle>Continuation Strategy</CardTitle>
									<CardDescription>
										Next steps and position management recommendations
									</CardDescription>
								</CardHeader>
								<CardContent>
									<p className="text-gray-500">Continuation plan will appear here once analysis completes.</p>
								</CardContent>
							</Card>
						</TabsContent>

						{/* Market Context Tab Content */}
						<TabsContent value='market-context' className='space-y-4'>
							{/* Show message for BOTH mode */}
							{tickerSymbol?.includes(',') && (
								<Card>
									<CardContent className="py-8 text-center">
										<p className="text-gray-500">Market Context is not available for combined analysis.</p>
										<p className="text-sm text-gray-400 mt-2">Please select IBIT or ETHA individually for market context.</p>
									</CardContent>
								</Card>
							)}
							
							{/* Loading state */}
							{!tickerSymbol?.includes(',') && marketContextLoading && (
								<Card>
									<CardContent className="py-8 text-center">
										<p className="text-gray-500">Loading market context...</p>
									</CardContent>
								</Card>
							)}
							
							{/* Market data loaded */}
							{!tickerSymbol?.includes(',') && !marketContextLoading && marketContextData && (
								<>
							{/* Overall Market Sentiment */}
							{marketContextData?.overallSentiment && (
								<Card>
									<CardHeader>
										<CardTitle>Market Sentiment Overview</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="space-y-2">
											<p className="text-sm">{marketContextData.overallSentiment.summary}</p>
											<div className="flex justify-between items-center mt-2">
												<span className="text-xs text-gray-500">Confidence: {marketContextData.overallSentiment.confidence}</span>
												<span className="text-sm font-medium text-blue-600">{marketContextData.overallSentiment.recommendation}</span>
											</div>
										</div>
									</CardContent>
								</Card>
							)}

							{/* ETF Flows (for crypto assets) */}
							{(tickerSymbol === 'IBIT' || tickerSymbol === 'ETHA') && (
								<Card>
									<CardHeader>
										<CardTitle>ETF Flow Analysis</CardTitle>
										<CardDescription>Net inflows/outflows and impact on spot price</CardDescription>
									</CardHeader>
									<CardContent>
										{etfFlowsLoading ? (
											<div className="text-sm text-gray-500">Loading flow data...</div>
										) : (
											<div className="grid grid-cols-2 gap-4">
												<div>
													<p className="text-xs text-gray-500">Net Flows</p>
													<p className="font-medium">{etfFlowsData?.netFlows || marketContextData?.etfFlows?.netFlows || 'Live data not available'}</p>
												</div>
												<div>
													<p className="text-xs text-gray-500">Trend</p>
													<p className="font-medium">{etfFlowsData?.trend || marketContextData?.etfFlows?.trend || 'Live data not available'}</p>
												</div>
												<div className="col-span-2">
													<p className="text-xs text-gray-500">Impact</p>
													<p className="text-sm">{etfFlowsData?.impact || marketContextData?.etfFlows?.impact || 'Live data not available'}</p>
												</div>
												<div className="col-span-2">
													<p className="text-xs text-gray-500">Recommendation</p>
													<p className="text-sm font-medium text-blue-600">{etfFlowsData?.recommendation || marketContextData?.etfFlows?.recommendation || 'Hold or size conservatively until clear flow trends emerge'}</p>
												</div>
												{/* Always show Source and As Of */}
												{(etfFlowsData?.source || marketContextData?.etfFlows?.source) && (
													<div className="col-span-2 mt-2 pt-2 border-t">
														<p className="text-xs text-gray-400">
															As of {etfFlowsData?.source?.asOf || marketContextData?.etfFlows?.source?.asOf} • 
															<a href={etfFlowsData?.source?.url || marketContextData?.etfFlows?.source?.url} 
															   target="_blank" 
															   rel="noopener noreferrer"
															   className="text-blue-500 hover:underline">
																Source
															</a>
														</p>
													</div>
												)}
											</div>
										)}
									</CardContent>
								</Card>
							)}

							{/* NAV Analysis (for ETFs) */}
							{marketContextData?.navAnalysis && (tickerSymbol === 'IBIT' || tickerSymbol === 'ETH' || tickerSymbol === 'ETHA') && (
								<Card>
									<CardHeader>
										<CardTitle>NAV Premium/Discount</CardTitle>
										<CardDescription>Trading relative to net asset value</CardDescription>
									</CardHeader>
									<CardContent>
										<div className="space-y-4">
											{/* Single Signed NAV Metric */}
											<div className="flex items-center justify-between">
												<div>
													<p className="text-xs text-gray-500 mb-1">Current Status</p>
													{(() => {
														const premium = marketContextData.navAnalysis.premium;
														const discount = marketContextData.navAnalysis.discount;

														if (!premium && !discount) {
															return <p className="text-lg font-medium text-gray-500">Live data not available</p>;
														}

														// Parse the percentage value
														const value = premium || discount;
														const numValue = parseFloat(value?.replace('%', '') || '0');
														const isDiscount = !!discount;

														// Determine color based on value
														const colorClass = Math.abs(numValue) < 0.1 ? 'text-gray-600' :
																		   isDiscount ? 'text-green-600' : 'text-amber-600';

														// Determine icon
														const icon = Math.abs(numValue) < 0.1 ? '→' :
																	isDiscount ? '↓' : '↑';

														return (
															<div className="flex items-center gap-2">
																<span className={`text-2xl font-bold ${colorClass}`}>
																	{isDiscount ? '-' : '+'}{value}
																</span>
																<span className={`text-2xl ${colorClass}`}>{icon}</span>
															</div>
														);
													})()}
												</div>
											</div>

											<div>
												<p className="text-xs text-gray-500">Interpretation</p>
												<p className="text-sm">{marketContextData.navAnalysis.interpretation || 'Live data not available'}</p>
											</div>

											<div>
												<p className="text-xs text-gray-500">Trading Opportunity</p>
												<p className="text-sm font-medium text-blue-600">{marketContextData.navAnalysis.tradingOpportunity || 'Live data not available'}</p>
											</div>

											{marketContextData.navAnalysis.source?.url && (
												<div className="mt-2 pt-2 border-t">
													<p className="text-xs text-gray-400">
														As of {marketContextData.navAnalysis.source.asOf} •
														<a href={marketContextData.navAnalysis.source.url}
														   target="_blank"
														   rel="noopener noreferrer"
														   className="text-blue-500 hover:underline">
															Source
														</a>
													</p>
												</div>
											)}
										</div>
									</CardContent>
								</Card>
							)}

							{/* Volatility Metrics */}
							{marketContextData?.volatilityMetrics && (
								<Card>
									<CardHeader>
										<CardTitle>Volatility Analysis</CardTitle>
										<CardDescription>Implied volatility and premium environment</CardDescription>
									</CardHeader>
									<CardContent>
										<div className="grid grid-cols-2 gap-4">
											<div>
												<p className="text-xs text-gray-500">Current IV</p>
												<p className="font-medium">{marketContextData.volatilityMetrics.currentIV}</p>
											</div>
											<div>
												<p className="text-xs text-gray-500">IV Rank</p>
												<p className="font-medium">{marketContextData.volatilityMetrics.ivRank}</p>
											</div>
											<div>
												<p className="text-xs text-gray-500">Call/Put Skew</p>
												<p className="font-medium">{marketContextData.volatilityMetrics.callPutSkew}</p>
											</div>
											<div>
												<p className="text-xs text-gray-500">Premium Environment</p>
												<p className="font-medium">{marketContextData.volatilityMetrics.premiumEnvironment}</p>
											</div>
											<div className="col-span-2">
												<p className="text-xs text-gray-500">Wheel Strategy Impact</p>
												<p className="text-sm font-medium text-blue-600">{marketContextData.volatilityMetrics.wheelStrategy}</p>
											</div>
										</div>
									</CardContent>
								</Card>
							)}

							{/* Options Flow */}
							{marketContextData?.optionsFlow && (
								<Card>
									<CardHeader>
										<CardTitle>Options Flow & Positioning</CardTitle>
										<CardDescription>Large trader activity and sentiment</CardDescription>
									</CardHeader>
									<CardContent>
										<div className="grid grid-cols-2 gap-4">
											<div>
												<p className="text-xs text-gray-500">Large Orders</p>
												<p className="text-sm">{marketContextData.optionsFlow.largeOrders}</p>
											</div>
											<div>
												<p className="text-xs text-gray-500">Put/Call Ratio</p>
												<p className="text-sm">{marketContextData.optionsFlow.putCallRatio}</p>
											</div>
											<div className="col-span-2">
												<p className="text-xs text-gray-500">Open Interest</p>
												<p className="text-sm">{marketContextData.optionsFlow.openInterest}</p>
											</div>
											<div className="col-span-2">
												<p className="text-xs text-gray-500">Market Sentiment</p>
												<p className="text-sm font-medium text-blue-600">{marketContextData.optionsFlow.sentiment}</p>
											</div>
										</div>
									</CardContent>
								</Card>
							)}

							{/* Upcoming Catalysts */}
							{marketContextData?.upcomingCatalysts && (
								<Card>
									<CardHeader>
										<CardTitle>Upcoming Catalysts</CardTitle>
										<CardDescription>Events that may impact volatility and premiums</CardDescription>
									</CardHeader>
									<CardContent>
										{typeof marketContextData.upcomingCatalysts === 'string' ? (
											<p className="text-sm text-gray-600">
												{marketContextData.upcomingCatalysts}
											</p>
										) : (
											<div className="space-y-3">
												{marketContextData.upcomingCatalysts.map((catalyst, idx) => (
													<div key={idx} className="border-l-2 border-blue-500 pl-3">
														<div className="flex justify-between items-start">
															<div>
																<p className="font-medium text-sm">{catalyst.event}</p>
																<p className="text-xs text-gray-500">Date: {catalyst.date}</p>
																<p className="text-xs text-gray-500">Impact: {catalyst.impact}</p>
															</div>
														</div>
														<p className="text-sm mt-1">{catalyst.preparation}</p>
														{catalyst.source?.url && (
															<p className="text-xs text-gray-400 mt-1">
																Source: <a href={catalyst.source.url} 
																	target="_blank" 
																	rel="noopener noreferrer"
																	className="text-blue-500 hover:underline">
																	{catalyst.source.url.replace(/^https?:\/\//, '').split('/')[0]}
																</a>
															</p>
														)}
													</div>
												))}
											</div>
										)}
									</CardContent>
								</Card>
							)}

							{/* Legacy Technical Indicators (keep for compatibility) */}
							{displayData.technicalFactors.length > 0 && (
								<Card>
									<CardHeader>
										<CardTitle>Technical Indicators</CardTitle>
									</CardHeader>
									<CardContent>
										<table className='w-full text-sm'>
											<thead>
												<tr className='border-b'>
													<th className='text-left py-2'>Indicator</th>
													<th className='text-left py-2'>Value</th>
													<th className='text-left py-2'>Interpretation</th>
													<th className='text-left py-2'>Impact</th>
												</tr>
											</thead>
											<tbody>
												{displayData.technicalFactors.map((tf, idx) => (
													<tr key={idx} className='border-b last:border-0'>
														<td className='py-2'>{tf.factor}</td>
														<td>{tf.value}</td>
														<td>{tf.interpretation}</td>
														<td>{tf.impact}</td>
													</tr>
												))}
											</tbody>
										</table>
									</CardContent>
								</Card>
							)}
								</>
							)}
						</TabsContent>

						{/* Strategy Tab Content */}
						<TabsContent value='strategy' className='space-y-4'>
							<Card>
								<CardHeader>
									<CardTitle>
										Strategic Entry & Exit Framework
									</CardTitle>
								</CardHeader>
								<CardContent className='space-y-6'>
									{/* Entry Points */}
									<div>
										<h4 className='font-semibold mb-2'>
											Entry Zones
										</h4>
										<table className='w-full text-sm'>
											<thead>
												<tr className='border-b'>
													<th className='text-left py-2'>
														Zone
													</th>
													<th className='text-left py-2'>
														Price
													</th>
													<th className='text-left py-2'>
														Timing
													</th>
													<th className='text-left py-2'>
														Rationale
													</th>
													<th className='text-left py-2'>
														Prob.
													</th>
												</tr>
											</thead>
											<tbody>
												{displayData.entryPoints
													.length === 0 ? (
													<tr>
														<td
															colSpan={5}
															className='py-2 text-center text-gray-400 italic'>
															No entry zones
															returned by AI
														</td>
													</tr>
												) : (
													displayData.entryPoints.map(
														(ep, idx) => (
															<tr
																key={idx}
																className='border-b last:border-0'>
																<td className='py-2'>
																	{ep.zone}
																</td>
																<td>
																	{ep.price}
																</td>
																<td>
																	{ep.timing}
																</td>
																<td>
																	{
																		ep.rationale
																	}
																</td>
																<td>
																	{
																		ep.probability
																	}
																</td>
															</tr>
														)
													)
												)}
											</tbody>
										</table>
									</div>

									{/* Exit Points */}
									<div>
										<h4 className='font-semibold mb-2'>
											Exit Targets
										</h4>
										<table className='w-full text-sm'>
											<thead>
												<tr className='border-b'>
													<th className='text-left py-2'>
														Target
													</th>
													<th className='text-left py-2'>
														Price
													</th>
													<th className='text-left py-2'>
														Gain
													</th>
													<th className='text-left py-2'>
														Timeframe
													</th>
													<th className='text-left py-2'>
														Prob.
													</th>
												</tr>
											</thead>
											<tbody>
												{displayData.exitPoints
													.length === 0 ? (
													<tr>
														<td
															colSpan={5}
															className='py-2 text-center text-gray-400 italic'>
															No exit targets
															returned by AI
														</td>
													</tr>
												) : (
													displayData.exitPoints.map(
														(xp, idx) => (
															<tr
																key={idx}
																className='border-b last:border-0'>
																<td className='py-2'>
																	{xp.target}
																</td>
																<td>
																	{xp.price}
																</td>
																<td>
																	{xp.gain}
																</td>
																<td>
																	{
																		xp.timeframe
																	}
																</td>
																<td>
																	{
																		xp.probability
																	}
																</td>
															</tr>
														)
													)
												)}
											</tbody>
										</table>
									</div>
								</CardContent>
							</Card>
							{/* Add Position Management Card (using displayData.summary.positionManagement) here later */}
						</TabsContent>
					</Tabs>
				</CardContent>
				{/* Optional CardFooter if needed */}
				{/* <CardFooter>Footer content</CardFooter> */}
			</Card>
			)}
		</div>
	);
}
