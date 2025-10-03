import {Button} from '@/components/ui/button';
import {Loader2} from 'lucide-react';
import {Tabs, TabsList, TabsTrigger, TabsContent} from '@/components/ui/tabs';
import UploadStatusTracker from '@/components/UploadStatusTracker';
import UploadTab from '@/components/UploadTab';
import type {AnalysisReadiness, UploadState} from '@/types/analysis';
import type {PortfolioParseResult} from '@/types/portfolio';
import type {MarketstackEodData} from '@/types/marketstack';

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

export function AnalysisPanel({
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
