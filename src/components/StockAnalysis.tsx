import {useState, useEffect, useRef, useMemo} from 'react';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import {Progress} from '@/components/ui/progress';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import axios from 'axios';
import { useOptionChain } from '@/hooks/useOptionChain';
import { useWheelQuotes } from '@/hooks/useWheelQuotes';
import { 
	cycleCredit, 
	grossYield,
	compounding,
	estimateAssignmentProb
} from '@/services/wheelMath';
import { calculateAggregateMetrics } from '@/services/optionLookup';

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
	strike: number;
	expiry: string;
	type: 'Call' | 'Put';
	contracts: number;
	premium: number;
	cycleReturn: string;
	status: string;
	assignmentProb: string;
	nextAction: string;
	daysToExpiry: number;
	term: 'LONG_DATED' | 'SHORT_DATED';
	position: 'SHORT' | 'LONG';
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
	vix?: number; // VIX value for volatility display
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
	const [progress, setProgress] = useState(0);
	const progressTimer = useRef<NodeJS.Timeout | null>(null);
	
	const { data: optionChainData } = useOptionChain(tickerSymbol);
	
	// Fetch real-time quotes for wheel positions
	// Convert date format from 'Jul-18-2025' to '2025-07-18' for API compatibility
	const wheelPositions = useMemo(() => {
		if (!analysisData?.wheelStrategy?.currentPositions) return [];
		
		return analysisData.wheelStrategy.currentPositions.map(pos => {
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
			
			return {
				...pos,
				expiry: parseExpiry(pos.expiry)
			};
		});
	}, [analysisData?.wheelStrategy?.currentPositions]);
	
	console.log('🔄 [WHEEL POSITIONS] Formatted for API:', wheelPositions);
	const { quotes: wheelQuotes } = useWheelQuotes(wheelPositions);

	const displayData = analysisData
		? {
				...analysisData,
				technicalFactors: analysisData.technicalFactors ?? [],
				entryPoints: analysisData.entryPoints ?? [],
				exitPoints: analysisData.exitPoints ?? [],
				keyLevels: analysisData.keyLevels ?? [],
				fundamentals: analysisData.fundamentals ?? [],
				vixImpact: analysisData.vixImpact ?? [],
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
		const handler = (e: CustomEvent<{[key: string]: unknown}>) => {
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
					hasDashboardMetrics: !!e.detail.dashboardMetrics,
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
			const wheelData = e.detail.wheelAnalysis || e.detail.wheelStrategy;
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
					allStrikes: wheelData.currentPositions.map(p => p.strike),
					allReturns: wheelData.currentPositions.map(p => p.cycleReturn),
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
				...e.detail,
				wheelStrategy: e.detail.wheelAnalysis || e.detail.wheelStrategy
			};
			
			// Add error handling before setting state
			try {
				console.log('📊 [STOCK ANALYSIS] About to set analysis data:', normalizedData);
				setAnalysisData(normalizedData); // fills tabs
				console.log('✅ [STOCK ANALYSIS] Analysis data set successfully');
			} catch (error) {
				console.error('❌ [STOCK ANALYSIS] Error setting analysis data:', error);
				console.error('Error stack:', error.stack);
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
		const start = () => {
			setIsAnalyzing(true);
			setProgress(15); // initial jump so bar is visible
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
							setVix(close);
						} else {
							console.warn('VIX fallback parse failed', csv);
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
							{/* Position Status Card - Updated design */}
							<div className='bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200'>
								<div className='flex items-start justify-between'>
									<div className='flex-1'>
										<div className='flex items-center gap-2 mb-2'>
											<svg className='w-5 h-5 text-blue-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
												<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} 
													d='M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' 
												/>
											</svg>
											<p className='text-sm font-medium text-gray-600'>Position Status</p>
										</div>
										<p className='text-lg font-bold text-gray-900'>
											{(analysisData.wheelStrategy?.shareCount || 0).toLocaleString()} shares
											{(() => {
												const positions = analysisData.wheelStrategy?.currentPositions || [];
												
												// Debug logging
												console.log('🔍 [POSITION STATUS DEBUG] Raw positions:', positions);
												
												// Add term field if missing (fallback for undeployed edge function)
												const positionsWithTerm = positions.map(pos => {
													// Calculate days to expiry if missing
													let daysToExpiry = pos.daysToExpiry;
													if (!daysToExpiry && pos.expiry) {
														const today = new Date();
														const expiryDate = new Date(pos.expiry);
														daysToExpiry = Math.max(0, Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
													}
													
													return {
														...pos,
														daysToExpiry,
														term: pos.term || (daysToExpiry > 365 ? 'LONG_DATED' : 'SHORT_DATED')
													};
												});
												
												// Categorize positions by direction (SHORT/LONG) and term
												const soldPositions = positionsWithTerm.filter(pos => pos.contracts < 0);
												const boughtPositions = positionsWithTerm.filter(pos => pos.contracts > 0);
												
												console.log('🔍 [POSITION STATUS DEBUG] Sold positions:', soldPositions.length, 'Bought positions:', boughtPositions.length);
												
												// Count sold positions by term
												const soldShortDated = soldPositions.filter(pos => pos.term === 'SHORT_DATED')
													.reduce((sum, pos) => sum + Math.abs(pos.contracts), 0);
												const soldLongDated = soldPositions.filter(pos => pos.term === 'LONG_DATED')
													.reduce((sum, pos) => sum + Math.abs(pos.contracts), 0);
												
												// Count bought positions by term (if any)
												const boughtShortDated = boughtPositions.filter(pos => pos.term === 'SHORT_DATED')
													.reduce((sum, pos) => sum + Math.abs(pos.contracts), 0);
												const boughtLongDated = boughtPositions.filter(pos => pos.term === 'LONG_DATED')
													.reduce((sum, pos) => sum + Math.abs(pos.contracts), 0);
												
												const totalSold = soldShortDated + soldLongDated;
												const totalBought = boughtShortDated + boughtLongDated;
												
												console.log('🔍 [POSITION STATUS DEBUG] Counts:', {
													soldShortDated, soldLongDated, boughtShortDated, boughtLongDated,
													totalSold, totalBought
												});
												
												// Debug: log each position's term
												console.log('🔍 [POSITION STATUS DEBUG] Position terms:', 
													positionsWithTerm.map(p => ({
														strike: p.strike,
														daysToExpiry: p.daysToExpiry,
														term: p.term,
														contracts: p.contracts
													}))
												);
												
												const parts = [];
												
												// Display sold calls with term breakdown
												if (totalSold > 0) {
													let soldText = ` + ${totalSold} sold call${totalSold > 1 ? 's' : ''}`;
													if (soldShortDated > 0 && soldLongDated > 0) {
														soldText += ` (${soldShortDated} short-dated, ${soldLongDated} long-dated)`;
													} else if (soldShortDated > 0) {
														soldText += ' (short-dated)';
													} else if (soldLongDated > 0) {
														soldText += ' (long-dated)';
													}
													parts.push(soldText);
												}
												
												// Display bought calls with term breakdown
												if (totalBought > 0) {
													let boughtText = ` + ${totalBought} bought call${totalBought > 1 ? 's' : ''}`;
													if (boughtShortDated > 0 && boughtLongDated > 0) {
														boughtText += ` (${boughtShortDated} short-dated, ${boughtLongDated} long-dated)`;
													} else if (boughtShortDated > 0) {
														boughtText += ' (short-dated)';
													} else if (boughtLongDated > 0) {
														boughtText += ' (long-dated)';
													}
													parts.push(boughtText);
												}
												
												return <>{parts.join('')}</>;
											})()}
										</p>
										<p className='text-sm text-blue-600 mt-1'>
											Net positive carry
										</p>
										<div className='mt-3 pt-3 border-t border-blue-200'>
											<p className='text-xs text-gray-600'>Total Premium Collected</p>
											<p className='text-xl font-bold text-gray-900'>
												${Math.round(analysisData.wheelStrategy.currentPositions?.reduce((total, pos) => {
													// Premium values are already total collected per position, not per share
													const premiumValue = pos.premium || pos.premiumCollected || 0;
													return total + premiumValue;
												}, 0)) || '0'}
											</p>
										</div>
									</div>
								</div>
							</div>

							{/* IV Environment Card */}
							<div className='bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200'>
								<div className='flex items-start justify-between'>
									<div>
										<p className='text-sm font-medium text-gray-600'>IV Environment</p>
										<p className='text-2xl font-bold text-green-700 mt-1'>
											{(analysisData.vix || 0) > 20 ? 'High Vol' : (analysisData.vix || 0) > 15 ? 'Moderate' : 'Low Vol'}
										</p>
										<p className='text-xs text-gray-500 mt-1'>VIX: {analysisData.vix?.toFixed(2)}</p>
									</div>
									<span className='inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-100 text-green-600'>
										<svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
											<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} 
												d='M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z' 
											/>
										</svg>
									</span>
								</div>
							</div>

							{/* Assignment Risk Card */}
							<div className='bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200'>
								<div className='flex items-start justify-between'>
									<div>
										<p className='text-sm font-medium text-gray-600'>Assignment Risk</p>
										<p className='text-2xl font-bold text-purple-700 mt-1'>
											{analysisData.wheelStrategy.currentPositions?.[0]?.assignmentProb || '0%'}
										</p>
										<p className='text-xs text-gray-500 mt-1'>
											{parseFloat(analysisData.wheelStrategy.currentPositions?.[0]?.assignmentProb || '0') > 50 
												? 'Monitor closely' 
												: 'Within normal range'}
										</p>
									</div>
									<span className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${
										parseFloat(analysisData.wheelStrategy.currentPositions?.[0]?.assignmentProb || '0') > 50
											? 'bg-yellow-100 text-yellow-600'
											: 'bg-purple-100 text-purple-600'
									}`}>
										<svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
											<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} 
												d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' 
											/>
										</svg>
									</span>
								</div>
							</div>
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
								value='assignment-success'
								className='data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 text-gray-500 rounded-md py-1.5 text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none'>
								Assignment Success
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
							{/* DEBUG: Log wheel strategy data */}
							{console.log('🎯 [PERFORMANCE TAB] Rendering with data:', {
								hasAnalysisData: !!analysisData,
								hasWheelStrategy: !!analysisData?.wheelStrategy,
								wheelStrategy: analysisData?.wheelStrategy,
								currentPhase: analysisData?.wheelStrategy?.currentPhase,
								positions: analysisData?.wheelStrategy?.currentPositions
							})}
							
							{analysisData?.wheelStrategy ? (
								<>

									{/* Current Positions - Single Column Layout */}
									<Card className="w-full">
										<CardHeader className="pb-3">
											<CardTitle className="text-lg">Current {analysisData.wheelStrategy?.currentPhase === 'CASH_SECURED_PUT' ? 'Put' : 'Call'} Positions</CardTitle>
										</CardHeader>
										<CardContent>
											{analysisData.wheelStrategy?.currentPositions?.map((position, idx) => {
												// Calculate days to expiry from the expiry date
												const today = new Date();
												const expiryDate = new Date(position.expiry);
												const daysToExpiry = Math.max(0, Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
												
												// Calculate term based on days to expiry
												const term = position.term || (daysToExpiry > 365 ? 'LONG_DATED' : 'SHORT_DATED');
												
												// Determine position direction from original contract value
												const positionDirection = position.contracts < 0 ? 'SHORT' : 'LONG';
												
												// Color based on assignment risk (current price vs strike)
												const currentPrice = analysisData.summary?.currentPrice || 0;
												const moneyness = ((currentPrice - position.strike) / position.strike) * 100;
												
												// For calls: ITM (in the money) = high risk, ATM (at the money) = medium risk, OTM (out of the money) = low risk
												const bgColor = moneyness >= 0 ? 'bg-red-50 border-red-200' :      // ITM - high assignment risk
												               moneyness >= -3 ? 'bg-yellow-50 border-yellow-200' : // Near the money - moderate risk
												               'bg-green-50 border-green-200';                      // OTM - low assignment risk
												
												return (
													<div key={idx} className={`p-4 rounded-lg border ${bgColor} mb-3`}>
														<div className="space-y-2">
															<div className="flex justify-between items-center mb-2">
																<span className="text-lg font-bold">
																	${position.strike} Call {position.expiry} ({Math.abs(position.contracts)} contract{Math.abs(position.contracts) > 1 ? 's' : ''})
																</span>
																<div className="flex items-center gap-2">
																	<span className={`text-xs px-2 py-1 rounded-full font-medium ${
																		moneyness >= 0 ? 'bg-red-100 text-red-700' :
																		moneyness >= -3 ? 'bg-yellow-100 text-yellow-700' :
																		'bg-green-100 text-green-700'
																	}`}>
																		{moneyness >= 0 ? 'HIGH RISK' :
																		 moneyness >= -3 ? 'MODERATE RISK' :
																		 'LOW RISK'}
																	</span>
																	<span className="text-xs text-gray-500">
																		{positionDirection === 'SHORT' ? 'SOLD' : 'BOUGHT'}
																	</span>
																</div>
															</div>
															<div className="text-sm text-gray-600 mb-2">
																{daysToExpiry} days to expiry • {term === 'LONG_DATED' ? 'Long-dated' : 'Short-dated'}
															</div>
															<div className="grid grid-cols-2 gap-4 text-sm">
																<div>
																	<span className="text-gray-600">Premium: </span>
																	<span className="font-semibold">${position.premium || position.premiumCollected}</span>
																</div>
																<div className="text-right">
																	<span className="text-gray-600">Current: </span>
																	<span className="font-semibold">${position.currentValue || 'N/A'}</span>
																</div>
																<div>
																	<span className="text-gray-600">Strategy P&L: </span>
																	<span className={`font-bold text-lg ${(position.wheelNet || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
																		${Math.round(position.wheelNet || 0)}
																	</span>
																	<br />
																	<span className="text-xs text-gray-400">MTM: ${Math.round(position.optionMTM || position.profitLoss || 0)}</span>
																</div>
															</div>
															
															{/* Greeks Display */}
															<div className="grid grid-cols-2 gap-4 text-sm mt-3 pt-3 border-t">
																<div>
																	<span className="text-gray-600">Delta: </span>
																	<span className="font-semibold">
																		{position.delta !== null && position.delta !== undefined ? position.delta.toFixed(3) : 'N/A'}
																	</span>
																</div>
																<div>
																	<span className="text-gray-600">Theta: </span>
																	<span className="font-semibold">
																		{position.theta !== null && position.theta !== undefined ? `$${position.theta.toFixed(2)}/day` : 'N/A'}
																	</span>
																</div>
																<div>
																	<span className="text-gray-600">Gamma: </span>
																	<span className="font-semibold">
																		{position.gamma !== null && position.gamma !== undefined ? position.gamma.toFixed(3) : 'N/A'}
																	</span>
																</div>
																<div>
																	<span className="text-gray-600">IV: </span>
																	<span className="font-semibold">
																		{position.iv !== null && position.iv !== undefined ? `${(position.iv * 100).toFixed(1)}%` : 'N/A'}
																	</span>
																</div>
															</div>
															
															{/* Assignment Probability based on Delta */}
															{position.delta !== null && position.delta !== undefined && (
																<div className="mt-3 pt-3 border-t">
																	<span className="text-gray-600">Assignment Probability: </span>
																	<span className={`font-bold ${
																		Math.abs(position.delta) > 0.7 ? 'text-red-600' :
																		Math.abs(position.delta) > 0.3 ? 'text-yellow-600' :
																		'text-green-600'
																	}`}>
																		{(Math.abs(position.delta) * 100).toFixed(1)}%
																	</span>
																	<span className="text-xs text-gray-500 ml-2">
																		(based on delta)
																	</span>
																</div>
															)}
														</div>
													</div>
												);
											})}
										</CardContent>
									</Card>

									{/* Wheel Strategy Metrics Card */}
									<Card className="w-full mt-4">
										<CardHeader className="pb-3">
											<CardTitle className="text-lg">Wheel Strategy Metrics</CardTitle>
											<CardDescription>Performance and risk metrics</CardDescription>
										</CardHeader>
										<CardContent>
											<div className="space-y-4">
												{(() => {
													// Use real-time quotes if available, otherwise show loading/placeholder
													const positions = analysisData.wheelStrategy?.currentPositions || [];
													
													// Calculate metrics using real quotes - filter for successful quotes only
													const goodQuotes = wheelQuotes.filter(q => q.success && q.quote);
													const metrics = goodQuotes.length > 0 
														? calculateAggregateMetrics(positions, wheelQuotes)
														: null;
													
													// Variables for next cycle calculations moved to where they're used
													
													// Use aggregate metrics if available
													const totalPremiumCollected = metrics?.totalPremiumCollected || 0;
													const costToClosePosition = metrics?.totalCostToClose || null;
													const unrealizedPL = metrics?.unrealizedPL || null;
													const maxProfitPotential = totalPremiumCollected;
													
													return (
														<>
															{/* Total Premium Collected */}
															<div className="flex justify-between items-baseline border-b pb-2">
																<span className="text-sm text-gray-600">Total Premium Collected</span>
																<div className="text-right">
																	<span className="text-lg font-bold">${Math.round(totalPremiumCollected)}</span>
																	<span className="text-xs text-green-600 ml-1">+8.02%</span>
																</div>
															</div>
															
															{/* Unrealized P&L */}
															<div className="flex justify-between items-baseline border-b pb-2">
																<span className="text-sm text-gray-600">Unrealized P&L</span>
																<div className="text-right">
																	{unrealizedPL !== null ? (
																		<>
																			<span className="text-lg font-bold">{unrealizedPL >= 0 ? '+' : ''}${Math.round(Math.abs(unrealizedPL))}</span>
																			{totalPremiumCollected > 0 && (
																				<span className={`text-xs ml-1 ${unrealizedPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
																					{unrealizedPL >= 0 ? '+' : ''}{((unrealizedPL / totalPremiumCollected) * 100).toFixed(1)}%
																				</span>
																			)}
																		</>
																	) : (
																		<span className="text-xs text-gray-400">Loading...</span>
																	)}
																</div>
															</div>
															
															{/* Cost to Close (was Net Premium Remaining) */}
															<div className="flex justify-between items-baseline border-b pb-2">
																<span className="text-sm text-gray-600">Cost to Close</span>
																<div className="text-right">
																	{costToClosePosition !== null ? (
																		<>
																			<span className="text-lg font-bold">${Math.round(costToClosePosition)}</span>
																			{totalPremiumCollected > 0 && (
																				<span className="text-xs text-gray-600 ml-1">
																					{((costToClosePosition / totalPremiumCollected) * 100).toFixed(0)}% of collected
																				</span>
																			)}
																		</>
																	) : (
																		<span className="text-xs text-gray-400">Loading...</span>
																	)}
																</div>
															</div>
															
															{/* Position-Weighted Average Return */}
															{positions.length > 0 && metrics && (
																<div className="flex justify-between items-baseline border-b pb-2">
																	<span className="text-sm text-gray-600">Average Position Delta</span>
																	<div className="text-right">
																		{metrics.averageDelta !== null ? (
																			<span className="text-lg font-bold">{(metrics.averageDelta * 100).toFixed(1)}%</span>
																		) : (
																			<span className="text-xs text-gray-400">No delta data</span>
																		)}
																	</div>
																</div>
															)}
															
															{/* Max Profit Potential */}
															<div className="flex justify-between items-baseline">
																<span className="text-sm text-gray-600">Max Profit Potential</span>
																<div className="text-right">
																	<span className="text-lg font-bold">${maxProfitPotential.toFixed(2)}</span>
																	<span className="text-xs text-gray-500 ml-1">Target</span>
																</div>
															</div>
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
												<CardTitle className="text-lg">Next 30-45% Wheel Opportunity</CardTitle>
												<CardDescription>Optimal position for next cycle based on current market</CardDescription>
											</CardHeader>
											<CardContent>
												<div className="space-y-3">
													{(() => {
														// Calculate these values inside the card where they're used
														const shareCount = analysisData.wheelStrategy?.shareCount || 100;
														const currentPrice = displayData?.summary?.currentPrice || priceInfo.price || 0;
														
														// Calculate potential return for next cycle (from option chain)
														const nextCycleReturn = optionChainData?.success && optionChainData.chain && currentPrice > 0
															? grossYield(
																	cycleCredit(optionChainData.chain.mid),
																	shareCount,
																	currentPrice,
																	optionChainData.chain.dte
																)
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
														<span className="text-lg font-bold text-green-600">
															{nextCycleReturn ? `${nextCycleReturn.toFixed(1)}%` : 'N/A'}
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
									<p className="text-gray-500">Wheel strategy analysis will appear here once analysis completes.</p>
								</div>
							)}
						</TabsContent>

						{/* Wheel Execution Tab Content */}
						<TabsContent value='wheel-execution' className='space-y-4'>
							<Card>
								<CardHeader>
									<CardTitle>Wheel Execution Strategy</CardTitle>
									<CardDescription>
										Detailed execution plan for wheel strategy positions
									</CardDescription>
								</CardHeader>
								<CardContent>
									<p className="text-gray-500">Wheel execution analysis will appear here once analysis completes.</p>
								</CardContent>
							</Card>
						</TabsContent>

						{/* Assignment Success Tab Content */}
						<TabsContent value='assignment-success' className='space-y-4'>
							<Card>
								<CardHeader>
									<CardTitle>Assignment Success Analysis</CardTitle>
									<CardDescription>
										Probability and timing of assignment outcomes
									</CardDescription>
								</CardHeader>
								<CardContent>
									<p className="text-gray-500">Assignment success metrics will appear here once analysis completes.</p>
								</CardContent>
							</Card>
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
							<Card>
								<CardHeader>
									<CardTitle>
										Key Technical Indicators
									</CardTitle>
								</CardHeader>
								<CardContent>
									<table className='w-full text-sm'>
										<thead>
											<tr className='border-b'>
												<th className='text-left py-2'>
													Indicator
												</th>
												<th className='text-left py-2'>
													Value
												</th>
												<th className='text-left py-2'>
													Interpretation
												</th>
												<th className='text-left py-2'>
													Impact
												</th>
											</tr>
										</thead>
										<tbody>
											{displayData.technicalFactors.map(
												(tf, idx) => (
													<tr
														key={idx}
														className='border-b last:border-0'>
														<td className='py-2'>
															{tf.factor}
														</td>
														<td>{tf.value}</td>
														<td>
															{tf.interpretation}
														</td>
														<td>{tf.impact}</td>
													</tr>
												)
											)}
											{/* ---------- Added: visual S/R levels ---------- */}
											{analysisData?.chartMetrics?.[0]
												?.keyLevels?.length ? (
												analysisData.chartMetrics[0].keyLevels.map(
													(lvl, idx) => (
														<tr key={idx}>
															{/* Added: label shows Support / Resistance */}
															<td className='py-1'>
																{lvl.type}
															</td>
															{/* Added: numeric price formatted to 2 decimals */}
															<td>
																{lvl.price.toFixed(
																	2
																)}
																{/* Optional: strength badge */}
																<span className='ml-2 text-xs opacity-70'>
																	{
																		lvl.strength
																	}
																</span>
															</td>
															{/* Keep empty cells to preserve table structure */}
															<td></td>
															<td></td>
														</tr>
													)
												)
											) : (
												<tr>
													<td className='py-1'>
														Key levels
													</td>
													<td>None</td>
													<td></td>
													<td></td>
												</tr>
											)}
										</tbody>
									</table>
								</CardContent>
							</Card>
							{/* Add S/R Levels Card (using displayData.keyLevels) and Candlestick Card here later */}
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

