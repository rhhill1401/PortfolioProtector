// In TickerPriceSearch.tsx (updated with state management)
import {useState, useEffect} from 'react';
import {Button} from '@/components/ui/button';
import {Loader2, Plus, X} from 'lucide-react';
import {Tabs, TabsList, TabsTrigger, TabsContent} from '@/components/ui/tabs';
import UploadStatusTracker from '@/components/UploadStatusTracker';
import {PortfolioCSVParser} from '@/utils/portfolioParser';
import {PortfolioParseResult} from '@/types/portfolio';

import {
	UploadState,
	AnalysisReadiness,
	UploadedFile,
	initialUploadState,
	initialReadiness,
	UploadCategory,
} from '@/types/analysis';
import { greeksFetcher, type OptionPosition } from '@/services/greeksFetcher';
import type { OptionQuote } from '@/services/optionLookup';

/* ---------- types ---------- */

// ---------- days of history typically visible for each timeframe ----------
const rangeDaysMap: Record<string, number> = {
	'5-min': 1,
	'15-min': 3,
	'30-min': 5,
	'1-hour': 10,
	'4-hour': 30,
	Daily: 180,
	Weekly: 365 * 2,
};
interface TickerPriceSearchProps {
	tickerSymbol: string;
	onTickerChange: (v: string) => void;
}

interface UploadTabProps {
	id: string;
	accept: string;
	multiple: boolean;
	onFiles: (files: FileList) => void;
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

// Timeframe inference (module scope so helpers can use it)
const inferTimeframe = (fileName: string): string => {
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

// Helper functions for Supabase calls - DRY principle
function getSupaEnv() {
	const fnUrl = import.meta.env.VITE_SUPABASE_FN_URL;
	const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
	if (!fnUrl || !anonKey) throw new Error('Supabase Function URL or Anon Key is not configured. Check .env.local.');
	return { fnUrl, anonKey };
}

async function callFn(name: string, payload: unknown) {
	const { fnUrl, anonKey } = getSupaEnv();
	return fetch(`${fnUrl}/${name}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			apikey: anonKey,
			Authorization: `Bearer ${anonKey}`,
		},
		body: JSON.stringify(payload),
	});
}

async function callFnJson<T = any>(name: string, payload: unknown): Promise<{ ok: boolean; status: number; data?: T; text?: string; }> {
	const res = await callFn(name, payload);
	const ct = res.headers.get('content-type') || '';
	if (ct.includes('application/json')) {
		const data = await res.json();
		return { ok: res.ok, status: res.status, data };
	}
	const text = await res.text();
	return { ok: res.ok, status: res.status, text };
}


// Log portfolio validation
function logPortfolioValidation(analysisPayload: any, tickerSymbol: string) {
	if (analysisPayload.portfolio && analysisPayload.portfolio.positions) {
		console.log('💼 [PORTFOLIO POSITIONS DETECTED]', {
			positionCount: analysisPayload.portfolio.positions.length,
			positions: analysisPayload.portfolio.positions,
			totalValue: analysisPayload.portfolio.totalValue
		});

		const expectedPhase = analysisPayload.portfolio.positions.some((p: any) => p.symbol === tickerSymbol)
			? 'COVERED_CALL'
			: 'CASH_SECURED_PUT';
		
		console.log('🔍 [VALIDATION] Expected wheel phase:', expectedPhase);
	} else {
		console.log('❌ [NO PORTFOLIO DATA] Portfolio is missing or empty');
	}
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
function createPriceContext(eodData: any, chartMetrics: ChartMetric[]) {
	const detectedTimeframe = chartMetrics[0]?.timeframe || '4-hour';
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
			rangeDays
		};
	}

	return {
		current: eodData.close || null,
		open: eodData.open || null,
		high: eodData.high || null,
		low: eodData.low || null,
		close: eodData.close || null,
		volume: eodData.volume || null,
		date: eodData.date || null,
		timeframe: detectedTimeframe,
		rangeDays
	};
}

// Prepare portfolio data for analysis
function preparePortfolioData(parsedPortfolio: PortfolioParseResult | null, uploadFiles: UploadedFile[]) {
	if (parsedPortfolio) {
		return {
			positions: parsedPortfolio.positions,
			totalValue: parsedPortfolio.totalValue,
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

interface KeyLevel {
	price: number;
	type: 'Support' | 'Resistance';
	strength: string;
}
interface ChartMetric {
	timeframe: string; // Added
	keyLevels: KeyLevel[];
	trend: string;
	rsi: string;
	macd: string;
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

// Re‑usable drag‑and‑drop upload wrapper
function UploadTab({id, accept, multiple, onFiles}: UploadTabProps) {
	/* local preview list */
	const [previews, setPreviews] = useState<{url: string; file: File}[]>([]);
	const [isDragging, setIsDragging] = useState(false);

	/* when the component unmounts, revoke blobs */
	useEffect(
		() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)),
		[previews]
	);

	const addFiles = (files: FileList) => {
		if (!files.length) return;
		/* show preview immediately */
		const next = Array.from(files).map((file) => ({
			file,
			url: file.type.startsWith('image/')
				? URL.createObjectURL(file)
				: '', // empty url for non-images
		}));
		setPreviews((prev) => [...prev, ...next]);
		onFiles(files); // delegate to parent upload logic
	};

	/* —— handlers —— */
	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
		addFiles(e.dataTransfer.files);
	};

	const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files) {
			addFiles(e.target.files);
			e.target.value = ''; // reset so same file can be chosen again
		}
	};

	const remove = (url: string) =>
		setPreviews((prev) => prev.filter((p) => p.url !== url));

	/* —— UI —— */
	return (
		<div
			onDragOver={(e) => {
				e.preventDefault();
				setIsDragging(true);
			}}
			onDragLeave={(e) => {
				e.preventDefault();
				setIsDragging(false);
			}}
			onDrop={handleDrop}
			className={`relative rounded-lg min-h-[250px] bg-[#766DFB] border-2 border-dashed transition-all
		  ${isDragging ? 'border-white/80 bg-white/10' : 'border-white/30'}`}>
			{/* hidden file input */}
			<input
				id={id}
				type='file'
				accept={accept}
				multiple={multiple}
				className='hidden'
				onChange={handleInput}
			/>

			{/* empty-state cover */}
			{previews.length === 0 && (
				<label
					htmlFor={id}
					className='absolute inset-0 flex flex-col items-center justify-center text-white cursor-pointer'>
					<div className='bg-white/20 rounded-full p-4 mb-4'>
						<Plus className='h-8 w-8' />
					</div>
					<span className='text-lg font-semibold'>Upload File</span>
					<span className='text-sm text-white/70 mt-2'>
						Drag &amp; drop or click
					</span>
				</label>
			)}

			{/* thumbnails grid */}
			{previews.length > 0 && (
				<div className='p-4 grid grid-cols-3 gap-2'>
					{previews.map(({url, file}) => (
						<div
							key={url || file.name}
							className='relative aspect-square rounded overflow-hidden bg-white/20'>
							{/* image or generic icon */}
							{url ? (
								<img
									src={url}
									alt={file.name}
									className='object-cover w-full h-full'
								/>
							) : (
								<div className='flex items-center justify-center w-full h-full text-xs p-2 text-white/80'>
									{file.name
										.split('.')
										.pop()
										?.toUpperCase() || 'FILE'}
								</div>
							)}

							{/* close button */}
							<button
								onClick={() => remove(url)}
								className='absolute -top-2 -right-2 bg-black/70 rounded-full p-1 hover:bg-red-600 transition-colors'
								aria-label='Remove'>
								<X className='h-3 w-3 text-white' />
							</button>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

type AnalysisPanelProps = {
	eodData: MarketstackEodData;
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
}: AnalysisPanelProps) {
	return (
		<div>
			<div className='bg-[#8079e3] p-4 border-b border-[#6c68b8] flex justify-between'>
				<h2 className='text-2xl font-bold'>{eodData.symbol}</h2>
				<span className='text-2xl font-bold'>${nf(eodData.close)}</span>
			</div>

			<div className='p-4'>
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

					<Tabs defaultValue='portfolio' className='w-full'>
						<TabsList className='grid w-full grid-cols-3 bg-[#766DFB] rounded-2xl p-1'>
							<TabsTrigger value='portfolio' className='data-[state=active]:bg-[#050136] data-[state=active]:text-white data-[state=active]:font-semibold text-white rounded-xl py-2'>
								Portfolio {uploadState.portfolio.files.length > 0 && `(${uploadState.portfolio.files.length})`}
							</TabsTrigger>
							<TabsTrigger value='charts' className='data-[state=active]:bg-[#050136] data-[state=active]:text-white data-[state=active]:font-semibold text-white rounded-xl py-2'>
								Charts {uploadState.charts.files.length > 0 && `(${uploadState.charts.files.length})`}
							</TabsTrigger>
							<TabsTrigger value='research' className='data-[state=active]:bg-[#050136] data-[state=active]:text-white data-[state=active]:font-semibold text-white rounded-xl py-2'>
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

					<span className='text-xs text-white/70'>Last updated: {df(eodData.date)}</span>
				</div>
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

	// Check if all requirements are met
	const checkReadiness = () => {
		const tickerValid = !!eodData && !!eodData.symbol;
		const portfolioReady = uploadState.portfolio.status === 'ready';
		const chartsReady = uploadState.charts.status === 'ready';
		const researchReady = uploadState.research.status === 'ready';

		const allRequirementsMet =
			tickerValid && portfolioReady && chartsReady && researchReady;

		setReadiness({
			tickerValid,
			portfolioReady,
			chartsReady,
			researchReady,
			allRequirementsMet,
		});
	};

	// Update readiness whenever upload state or ticker changes
	useEffect(() => {
		checkReadiness();
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

    const analyzePortfolioImage = async (imageFile: File): Promise<PortfolioParseResult | null> => {
        try {
            const base64 = await convertFileToBase64(imageFile);
            const visionResponse = await callFn('portfolio-vision', {
                image: base64,
                ticker: eodData?.symbol || 'UNKNOWN',
            });
            const visionData = await visionResponse.json();
            if (!visionData?.success || !visionData?.portfolio?.portfolioDetected) return null;

            const stockPositions = (visionData.portfolio.positions || []).map((pos: any) => ({
                symbol: pos.symbol,
                quantity: pos.quantity,
                purchasePrice: pos.purchasePrice,
                currentPrice: pos.currentPrice,
                marketValue: pos.marketValue,
                percentOfPortfolio: (pos.marketValue / visionData.portfolio.totalValue) * 100,
            }));
            const result: PortfolioParseResult = {
                success: true,
                positions: stockPositions,
                totalValue: visionData.portfolio.totalValue,
                errors: [],
                warnings:
                    visionData.portfolio.extractionConfidence === 'low'
                        ? ['Low confidence in data extraction - please verify positions']
                        : [],
                metadata: {
                    source: 'image_analysis',
                    brokerageType: visionData.portfolio.brokerageType,
                    extractionConfidence: visionData.portfolio.extractionConfidence,
                    fileName: imageFile.name,
                    optionPositions: visionData.portfolio.metadata?.optionPositions || [],
                },
            };
            return result;
        } catch {
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
        } finally {
            setIsFetchingGreeks(false);
        }
    };

    const buildAnalysisPayload = (
        eod: MarketstackEodData | null,
        parsed: PortfolioParseResult | null,
        chartResults: ChartAnalysisResult[],
        _uploadState: UploadState,
        greeksMap: Map<string, OptionQuote>,
    ) => {
        const { chartData, failedCharts, chartMetrics } = processChartAnalysisResults(chartResults);
        const priceContext = createPriceContext(eod, chartMetrics);
        const portfolioData = preparePortfolioData(parsed, _uploadState.portfolio.files);
        return {
            ticker: eod?.symbol,
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
        };
    };

    const submitAnalysis = async (payload: any) => {
        const useLegacy = new URLSearchParams(window.location.search).has('useLegacy');
        const endpoint = useLegacy ? 'integrated-analysis' : 'integrated-analysis-v2';
        const out = await callFnJson(endpoint, payload);
        if (!out.ok || !out.data) {
            throw new Error(out.text || (out.data as any)?.error || `HTTP ${out.status}`);
        }
        const j: any = out.data;
        if (j.success) {
            window.dispatchEvent(new CustomEvent('analysis-ready', { detail: j.analysis }));
        } else {
            throw new Error(j.error || 'Integrated analysis error');
        }
    };
	// Modified handleAIAnalysis - now checks readiness
    const handleAIAnalysis = async () => {
        if (!readiness.allRequirementsMet) {
            alert('All requirements must be met before running analysis.');
            return;
        }

        window.dispatchEvent(new Event('analysis-start'));
        try {
            const analysisPayload = buildAnalysisPayload(
                eodData,
                parsedPortfolio,
                chartAnalysisResults,
                uploadState,
                optionGreeks,
            );
            logPortfolioValidation(analysisPayload, eodData?.symbol || '');
            await submitAnalysis(analysisPayload);
        } catch (err) {
            console.error(err);
            alert('Analysis call failed');
        } finally {
            window.dispatchEvent(new Event('analysis-done'));
        }
    };

	// Enhanced upload handlers - handle both CSV and image files
    const handlePortfolioUpload = async (files: FileList) => {
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

            // Final summary
            if (portfolioResult) {
                console.log('🎉 [PORTFOLIO UPLOAD] Final portfolio data:', {
                    totalPositions: portfolioResult.positions.length,
                    totalValue: portfolioResult.totalValue,
                    source: portfolioResult.metadata?.source || 'csv'
                });
                
                // Fetch Greeks for all option positions
                if (portfolioResult?.metadata?.optionPositions && portfolioResult.metadata.optionPositions.length > 0) {
                    console.log('📊 [GREEKS] Starting to fetch Greeks for option positions...');
                    await fetchAndSetGreeks(portfolioResult.metadata.optionPositions as OptionPosition[]);
                }
            } else {
                console.log('❌ [PORTFOLIO UPLOAD] No portfolio data extracted from any files');
            }

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

	const convertFileToBase64 = (file: File): Promise<string> => {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.readAsDataURL(file);
			reader.onload = () => {
				if (typeof reader.result === 'string') {
					resolve(reader.result);
				} else {
					reject(new Error('Failed to convert file to base64'));
				}
			};
			reader.onerror = (error) => reject(error);
		});
	};

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

	const analyzeChartImage = async (
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
	};
	// Helper to mark charts as ready after analysis
	const markChartsReady = (results?: ChartAnalysisResult[]) => {
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
	};

	const processChartAnalysis = async () => {
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
	};

	const [chartAnalysisResults, setChartAnalysisResults] = useState<
		ChartAnalysisResult[]
	>([]);

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
	}, [chartAnalysisResults, processedChartData]);

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
	}, [processedChartData]);

	// Existing quote fetch logic
	useEffect(() => {
		const t = setTimeout(() => {
			const sym = tickerSymbol.trim().toUpperCase();
			if (sym) {
				fetchQuote(sym);
			} else {
				setEodData(null);
				setError(null);
			}
		}, 500);
		return () => clearTimeout(t);
	}, [tickerSymbol]);

	async function fetchQuote(symbol: string) {
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
	}

	const nf = (v: number | null) => (v == null ? 'N/A' : v.toFixed(2));
	const df = (d?: string | null) =>
		d ? new Date(d).toLocaleDateString() : 'N/A';

	return (
		<div className='h-full w-full'>
			<div className='rounded-lg overflow-hidden shadow-md bg-[#9089FC] border border-[#7c77d1] h-full flex flex-col'>
				<div className='bg-[#7c77d1] px-4 py-4 border-b border-[#6c68b8]'>
					<h2 className='text-lg font-semibold mb-2 text-white'>Stock Lookup</h2>
					<input
						value={tickerSymbol}
						onChange={(e) => onTickerChange(e.target.value.toUpperCase())}
						placeholder='Enter ticker (e.g., NVDA)'
						className='w-full px-3 py-2 rounded bg-white text-gray-800'
					/>
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
					) : eodData ? (
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
						/>
					) : (
						<div className='flex items-center justify-center h-64'>
							<p>Enter a ticker to view data.</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
