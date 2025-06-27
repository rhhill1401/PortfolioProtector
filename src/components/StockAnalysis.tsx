import {useState, useEffect, useRef} from 'react';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import {Progress} from '@/components/ui/progress';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
// Import recharts components (make sure recharts is installed: yarn add recharts)
import {PieChart, Pie, Cell, Tooltip, ResponsiveContainer} from 'recharts';
import axios from 'axios'; // Make sure axios is installed

// Define the props the component will accept (at least the ticker symbol)
interface StockAnalysisProps {
	tickerSymbol: string;
}

// Define the structure for a technical factor (based on the example)
interface TechnicalFactor {
	factor: string;
	value: string;
	interpretation: string;
	impact: string;
	score: number;
}

// Define the structure for an entry strategy point
interface EntryStrategyPoint {
	zone: string;
	price: string;
	timing: string;
	rationale: string;
	probability: string;
}

// Define the structure for an exit strategy point
interface ExitStrategyPoint {
	target: string;
	price: string;
	gain: string;
	timeframe: string;
	probability: string;
}

// Define the structure for a key level
interface KeyLevel {
	price: number;
	type: 'Support' | 'Resistance' | 'Current';
	significance: string;
	description: string;
}

// Define the structure for a fundamental metric
interface FundamentalMetric {
	metric: string;
	value: string;
	assessment: string;
	comparison: string;
}

// Define the structure for VIX impact analysis
interface VixImpact {
	scenario: string;
	effect: string;
	nvdaImpact: string;
	action: string;
}

// --- Price info broadcast from TickerPriceSearch ---
interface PriceInfo {
	price: number | null;
	change: number | null;
	percent: string | null;
}

// Define the structure for recommendation data (used in Pie Chart)
interface RecommendationDataPoint {
	name: 'Buy' | 'Hold' | 'Sell';
	value: number;
}

// Define structure for overall summary data
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

// Technical snapshot returned by backend
interface TechnicalSnapshot {
	trend: string;
	rsi: string;
	macd: string;
	movingAverages: string;
}

// Define a comprehensive interface for the expected API response
interface AnalysisDetail {
	technicalSignals?: string;
	portfolioAlignment?: string;
	researchConsensus?: string;
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
}

// --- Remove or comment out Mock Data ---
// const mockTechnicalFactors: TechnicalFactor[] = [ ... ];
// const mockEntryStrategyPoints: EntryStrategyPoint[] = [ ... ];
// const mockExitStrategyPoints: ExitStrategyPoint[] = [ ... ];
// const mockKeyLevels: KeyLevel[] = [ ... ];
// const mockFundamentalMetrics: FundamentalMetric[] = [ ... ];
// const mockVixImpactData: VixImpact[] = [ ... ];
// const mockRecommendationData: RecommendationDataPoint[] = [ ... ];
// const mockAnalysisSummary: AnalysisSummary = { ... };
// --- ---

const COLORS = ['#00C49F', '#FFBB28', '#FF8042']; // Colors for Pie Chart

// Helper to classify RSI value
// const rsiLabel = (rsiStr: string) => {
// 	const r = parseFloat(rsiStr);
// 	if (isNaN(r)) return '';
// 	if (r >= 70) return 'Overbought';
// 	if (r <= 30) return 'Oversold';
// 	return 'Neutral';
// };

// Helper to map trend description to color classesx
const trendColor = (desc: string) => {
	if (/overbought/i.test(desc) || /neutral/i.test(desc))
		return 'bg-yellow-100 border-yellow-200 text-yellow-800';
	if (/oversold/i.test(desc) || /downward/i.test(desc))
		return 'bg-red-100 border-red-200 text-red-800';
	return 'bg-green-100 border-green-200 text-green-800';
};

// Helper to color‑code confidence (0–10)
const confidenceColor = (val: number | undefined) => {
	if (val === undefined) return 'bg-gray-100 text-gray-800';
	if (val < 6) return 'bg-red-100 text-red-800';
	if (val < 8) return 'bg-yellow-100 text-yellow-800';
	return 'bg-green-100 text-green-800';
};

// Helper to ensure we always have a 3‑slice array for the pie chart
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
	// fallback to mock if format unexpected
	return mockRecommendationData;
};

// Helper to build concise summary labels
const toSummary = (a: StockAnalysisData | null) => {
	if (!a) {
		return {
			techTitle: 'Technical Trend',
			techDesc: 'Loading…',
			fundTitle: 'Opportunity',
			fundDesc: 'Loading…',
			mktTitle: 'Risk',
			mktDesc: 'Loading…',
		};
	}

	// Pull short text from the new integrated fields
	const techDesc =
		a.detail?.technicalSignals ?? a.summary?.technicalStance ?? '—';
	const oppDesc = a.opportunity ?? a.detail?.portfolioAlignment ?? '—';
	const riskDesc = a.risk ?? a.detail?.researchConsensus ?? '—';

	return {
		techTitle: 'Technical Signals',
		techDesc,
		fundTitle: 'Opportunity',
		fundDesc: oppDesc,
		mktTitle: 'Risk',
		mktDesc: riskDesc,
	};
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
	// track AI‑analysis progress
	const [isAnalyzing, setIsAnalyzing] = useState(false);

	// progress 0‑100 for determinate bar
	const [progress, setProgress] = useState(0);
	const progressTimer = useRef<NodeJS.Timeout | null>(null);

	// Use mock data as fallback only for sections missing in analysisData,
	// but if AI provides recommendation, do not fallback to mockRecommendationData
	// Safer fallback: always provide arrays, never undefined
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
		: {
				summary: mockAnalysisSummary,
				technicalFactors: mockTechnicalFactors,
				entryPoints: mockEntryStrategyPoints,
				exitPoints: mockExitStrategyPoints,
				keyLevels: mockKeyLevels,
				fundamentals: mockFundamentalMetrics,
				vixImpact: mockVixImpact,
				recommendation: mockRecommendationData,
		  };

	// Add the fetch function
	const fetchAnalysis = async (symbol: string) => {
		if (!symbol) return;

		setIsLoading(true);
		setError(null);

		try {
			// Replace with your actual API endpoint
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

	// Add useEffect to trigger the fetch
	useEffect(() => {
		fetchAnalysis(tickerSymbol);
	}, [tickerSymbol]);

	useEffect(() => {
		const handler = (e: CustomEvent<{[key: string]: unknown}>) => {
			setAnalysisData(e.detail); // fills tabs
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
			<Card className='w-full h-full flex flex-col'>
				<CardHeader className='bg-gray-100 border-b flex flex-col justify-center'>
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
					{/* Summary Boxes */}
					<div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
						<div
							className={`p-3 rounded-lg border ${trendColor(
								toSummary(analysisData).techDesc
							)}`
								.replace(' text-', ' ')
								.replace('bg-', 'bg-')
								.replace(' border-', ' border-')}>
							<h3 className='font-bold text-sm'>
								{toSummary(analysisData).techTitle}
							</h3>
							<p className='text-xs'>
								{toSummary(analysisData).techDesc}
							</p>
						</div>
						<div className='bg-blue-100 p-3 rounded-lg border border-blue-200'>
							<h3 className='font-bold text-sm text-blue-800'>
								{toSummary(analysisData).fundTitle}
							</h3>
							<p className='text-xs text-blue-700'>
								{toSummary(analysisData).fundDesc}
							</p>
						</div>
						<div className='bg-yellow-100 p-3 rounded-lg border border-yellow-200'>
							<h3 className='font-bold text-sm text-yellow-800'>
								{toSummary(analysisData).mktTitle}
							</h3>
							<p className='text-xs text-yellow-700'>
								{toSummary(analysisData).mktDesc}
							</p>
						</div>
					</div>

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
					<Tabs defaultValue='recommendation' className='w-full'>
						{/* Styling to match the light gray image reference */}
						<TabsList className='grid w-full grid-cols-4 mb-4 bg-gray-100 rounded-lg p-1'>
							{/* Styling for triggers */}
							<TabsTrigger
								value='recommendation'
								className='data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 text-gray-500 rounded-md py-1.5 text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none'>
								Recommendation
							</TabsTrigger>
							<TabsTrigger
								value='technical'
								className='data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 text-gray-500 rounded-md py-1.5 text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none'>
								Technical Analysis
							</TabsTrigger>
							<TabsTrigger
								value='fundamental'
								className='data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 text-gray-500 rounded-md py-1.5 text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none'>
								Fundamentals
							</TabsTrigger>
							<TabsTrigger
								value='strategy'
								className='data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 text-gray-500 rounded-md py-1.5 text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none'>
								Entry/Exit Strategy
							</TabsTrigger>
						</TabsList>

						{/* Recommendation Tab Content */}
						<TabsContent
							value='recommendation'
							className='space-y-4'>
							<Card>
								<CardHeader>
									<CardTitle>
										Investment Recommendation
									</CardTitle>
									<CardDescription>
										Strategic buying opportunity with staged
										entry approach
									</CardDescription>
									{analysisData?.confidence !== undefined && (
										<span
											className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${confidenceColor(
												analysisData.confidence
											)}`}>
											Confidence:{' '}
											{analysisData.confidence}/10
										</span>
									)}
								</CardHeader>
								<CardContent className='py-6'>
									{analysisData?.confidence !== undefined &&
										analysisData.confidence < 9 &&
										analysisData.additionalDataNeeded && (
											<div className='mb-4 rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800'>
												<strong>
													More data requested:
												</strong>{' '}
												{
													analysisData.additionalDataNeeded
												}
											</div>
										)}
									{/* Chart + Narrative side‑by‑side on medium screens, stacked on mobile */}
									<div className='grid md:grid-cols-2 gap-6'>
										{/* Pie Chart */}
										<div className='w-full h-64 md:h-72'>
											<ResponsiveContainer
												width='100%'
												height='100%'>
												<PieChart>
													<Pie
														data={toPieArray(
															displayData.recommendation
														)} /* ensure array */
														dataKey='value'
														nameKey='name'
														outerRadius={90}
														label={({
															name,
															value,
														}) =>
															`${name}: ${value}%`
														}>
														{toPieArray(
															displayData.recommendation
														).map((_, i) => (
															<Cell
																key={`cell-${i}`}
																fill={
																	COLORS[
																		i %
																			COLORS.length
																	]
																}
															/>
														))}
													</Pie>
													<Tooltip />
												</PieChart>
											</ResponsiveContainer>
										</div>

										{/* Textual narrative */}
										<div className='space-y-6'>
											{analysisData ? (
												<>
													{/* Risk */}
													<div>
														<h4 className='font-semibold mb-1'>
															Risk Overview
														</h4>
														<p className='text-sm'>
															{analysisData.risk ||
																'Risk overview unavailable.'}
														</p>
													</div>

													{/* Options */}
													<div>
														<h4 className='font-semibold mb-1'>
															Primary Options
															Strategy
														</h4>
														<p className='text-sm'>
															{analysisData.optionsStrategy ||
																'Options strategy unavailable.'}
														</p>
													</div>

													{/* Action Plan (first three items) */}
													{analysisData.actionPlan
														?.length ? (
														<div>
															<h4 className='font-semibold mb-1'>
																Action Plan
															</h4>
															<ul className='list-disc pl-5 space-y-1 text-sm'>
																{analysisData.actionPlan
																	.slice(0, 3)
																	.map(
																		(
																			step,
																			idx
																		) => (
																			<li
																				key={
																					idx
																				}>
																				{
																					step
																				}
																			</li>
																		)
																	)}
															</ul>
														</div>
													) : null}
												</>
											) : (
												<p className='text-sm text-gray-500'>
													Recommendation details will
													appear here once analysis
													completes.
												</p>
											)}
										</div>
									</div>
								</CardContent>
							</Card>
							{/* Add Market Context Card here later */}
						</TabsContent>

						{/* Technical Tab Content */}
						<TabsContent value='technical' className='space-y-4'>
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

						{/* Fundamental Tab Content */}
						<TabsContent value='fundamental' className='space-y-4'>
							<Card>
								<CardHeader>
									<CardTitle>Fundamental Metrics</CardTitle>
								</CardHeader>
								<CardContent>
									<table className='w-full text-sm'>
										<thead>
											<tr className='border-b'>
												<th className='text-left py-2'>
													Metric
												</th>
												<th className='text-left py-2'>
													Value
												</th>
												<th className='text-left py-2'>
													Assessment
												</th>
												<th className='text-left py-2'>
													Comparison
												</th>
											</tr>
										</thead>
										<tbody>
											{displayData.fundamentals.map(
												(fm, idx) => (
													<tr
														key={idx}
														className='border-b last:border-0'>
														<td className='py-2'>
															{fm.metric}
														</td>
														<td>{fm.value}</td>
														<td>{fm.assessment}</td>
														<td>{fm.comparison}</td>
													</tr>
												)
											)}
										</tbody>
									</table>
								</CardContent>
							</Card>
							{/* Add Segment Perf & Analyst Cards here later */}
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
		</div>
	);
}

// --- Mock Data (Keep temporarily for fallbacks) ---
const mockTechnicalFactors: TechnicalFactor[] = [
	{
		factor: 'RSI (14)',
		value: '65.2',
		interpretation: 'Moderately Overbought',
		impact: 'Neutral',
		score: 6,
	},
];

const mockEntryStrategyPoints: EntryStrategyPoint[] = [
	{
		zone: 'Support Level',
		price: '$490.00',
		timing: 'On pullback',
		rationale: 'Strong historical support',
		probability: '70%',
	},
];

const mockExitStrategyPoints: ExitStrategyPoint[] = [
	{
		target: 'Resistance Level',
		price: '$520.00',
		gain: '4.0%',
		timeframe: '2-4 weeks',
		probability: '65%',
	},
];

const mockKeyLevels: KeyLevel[] = [
	{
		price: 500.25,
		type: 'Current',
		significance: 'Current Price',
		description: 'Last traded price',
	},
];

const mockFundamentalMetrics: FundamentalMetric[] = [
	{
		metric: 'P/E Ratio',
		value: '28.5',
		assessment: 'Fair Value',
		comparison: 'Below sector average',
	},
];

const mockVixImpact: VixImpact[] = [
	{
		scenario: 'VIX Below 20',
		effect: 'Low Volatility',
		nvdaImpact: 'Positive',
		action: 'Consider adding',
	},
];

const mockRecommendationData: RecommendationDataPoint[] = [
	{name: 'Buy', value: 60},
	{name: 'Hold', value: 30},
	{name: 'Sell', value: 10},
];

const mockAnalysisSummary: AnalysisSummary = {
	currentPrice: 500.25,
	priceChange: 12.34,
	priceChangePercent: '+2.52%',
	vix: 18.5,
	overallAssessment: 'Bullish',
	technicalStance: 'Strong Uptrend',
	technicalDetail: 'Price above 50/200 MA, RSI healthy.',
	fundamentalAssessment: 'Excellent Growth',
	fundamentalDetail: 'Revenue and EPS beating estimates.',
	marketContext: 'Favorable',
	marketContextDetail: 'Sector rotation into tech.',
	investmentThesis: [
		'AI leadership',
		'Strong earnings',
		'Market share gains',
	],
	bullCase: ['Continued AI demand', 'Margin expansion'],
	bearCase: ['Macro headwinds', 'Competition risk'],
	positionManagement: ['Use trailing stops', 'Scale in on dips'],
	entryTriggers: ['Breakout above $510', 'Pullback to $490 support'],
};
// --- ---
