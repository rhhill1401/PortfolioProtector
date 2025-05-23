import {useState, useEffect} from 'react';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
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
	score: number; // Assuming score is part of it, adjust if not
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

// Define a comprehensive interface for the expected API response
interface StockAnalysisData {
	summary: AnalysisSummary;
	technicalFactors: TechnicalFactor[];
	entryPoints: EntryStrategyPoint[];
	exitPoints: ExitStrategyPoint[];
	keyLevels: KeyLevel[];
	fundamentals: FundamentalMetric[];
	vixImpact: VixImpact[];
	recommendation: RecommendationDataPoint[];
	// Add any other fields the actual API might return
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

export function StockAnalysis({tickerSymbol}: StockAnalysisProps) {
	const [analysisData, setAnalysisData] = useState<StockAnalysisData | null>(
		null
	);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Temporary: Use mock data as fallback
	const displayData = analysisData || {
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
						{displayData?.summary?.currentPrice?.toFixed(2) ||
							'N/A'}{' '}
						(
						{displayData?.summary?.priceChange &&
						displayData.summary.priceChange > 0
							? '+'
							: ''}
						{displayData?.summary?.priceChange?.toFixed(2) || 'N/A'}{' '}
						/{displayData?.summary?.priceChangePercent || 'N/A'}) |
						VIX: {displayData?.summary?.vix || 'N/A'} | Overall
						Assessment:{' '}
						<span className='font-bold text-gray-800'>
							{displayData?.summary?.overallAssessment ||
								'Loading...'}
						</span>
					</CardDescription>
				</CardHeader>
				<CardContent className='flex-grow p-4 overflow-y-auto'>
					{/* Summary Boxes */}
					<div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
						<div className='bg-green-100 p-3 rounded-lg border border-green-200'>
							<h3 className='font-bold text-sm text-green-800'>
								{displayData?.summary?.technicalStance ||
									'Loading Technical...'}
							</h3>
							<p className='text-xs text-green-700'>
								{displayData?.summary?.technicalDetail ||
									'Analyzing technical indicators...'}
							</p>
						</div>
						<div className='bg-blue-100 p-3 rounded-lg border border-blue-200'>
							<h3 className='font-bold text-sm text-blue-800'>
								{displayData?.summary?.fundamentalAssessment ||
									'Loading Fundamentals...'}
							</h3>
							<p className='text-xs text-blue-700'>
								{displayData?.summary?.fundamentalDetail ||
									'Analyzing fundamental data...'}
							</p>
						</div>
						<div className='bg-yellow-100 p-3 rounded-lg border border-yellow-200'>
							<h3 className='font-bold text-sm text-yellow-800'>
								{displayData?.summary?.marketContext ||
									'Loading Market Context...'}
							</h3>
							<p className='text-xs text-yellow-700'>
								{displayData?.summary?.marketContextDetail ||
									'Analyzing market conditions...'}
							</p>
						</div>
					</div>

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
								</CardHeader>
								<CardContent>
									{/* Placeholder for Pie Chart and Thesis */}
									<p>
										Recommendation details and chart go
										here...
									</p>
									{/* Example Pie Chart Integration */}
									<div className='h-64 w-full'>
										<ResponsiveContainer
											width='100%'
											height='100%'>
											<PieChart>
												<Pie
													data={
														displayData.recommendation
													}
													cx='50%'
													cy='50%'
													labelLine={false}
													outerRadius={80}
													fill='#8884d8'
													dataKey='value'
													label={({name, percent}) =>
														`${name}: ${(
															percent * 100
														).toFixed(0)}%`
													}>
													{(
														displayData?.recommendation ||
														[]
													).map((_, index) => (
														<Cell
															key={`cell-${index}`}
															fill={
																COLORS[
																	index %
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
									<p>
										Investment Thesis:{' '}
										{displayData?.summary?.investmentThesis?.join(
											', '
										) || 'Loading...'}
									</p>
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
									{/* Placeholder: Use displayData.technicalFactors here */}
									<p>Technical factors table goes here...</p>
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
									{/* Placeholder: Use displayData.fundamentals here */}
									<p>
										Fundamental metrics table goes here...
									</p>
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
								<CardContent>
									{/* Placeholder: Use displayData.entryPoints and displayData.exitPoints here */}
									<p>Entry/Exit strategy tables go here...</p>
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
