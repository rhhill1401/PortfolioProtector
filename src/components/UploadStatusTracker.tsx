// src/components/UploadStatusTracker.tsx
import {Check, X, AlertCircle, Loader2} from 'lucide-react';
import {AnalysisReadiness, UploadState} from '@/types/analysis';

interface UploadStatusTrackerProps {
	readiness: AnalysisReadiness;
	uploadState: UploadState;
}

// Helper to get status icon based on readiness
function StatusIcon({
	isReady,
	isLoading,
}: {
	isReady: boolean;
	isLoading?: boolean;
}) {
	if (isLoading) {
		return <Loader2 className='h-4 w-4 animate-spin text-blue-400' />;
	}
	if (isReady) {
		return <Check className='h-4 w-4 text-green-400' />;
	}
	return <X className='h-4 w-4 text-gray-400' />;
}

// Individual requirement row
function RequirementRow({
	label,
	isReady,
	detail,
	isLoading = false,
}: {
	label: string;
	isReady: boolean;
	detail?: string;
	isLoading?: boolean;
}) {
	return (
		<div
			className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
				isReady ? 'bg-green-900/20' : 'bg-gray-800/20'
			}`}>
			<div className='flex items-center gap-2'>
				<StatusIcon isReady={isReady} isLoading={isLoading} />
				<span
					className={`text-sm font-medium ${
						isReady ? 'text-white' : 'text-gray-400'
					}`}>
					{label}
				</span>
			</div>
			{detail && <span className='text-xs text-gray-500'>{detail}</span>}
		</div>
	);
}

export default function UploadStatusTracker({
	readiness,
	uploadState,
}: UploadStatusTrackerProps) {
	// Calculate completion percentage
	const requirements = [
		readiness.tickerValid,
		readiness.portfolioReady,
		readiness.chartsReady,
		readiness.researchReady,
	];
	const completedCount = requirements.filter(Boolean).length;
	const completionPercentage = (completedCount / requirements.length) * 100;

	return (
		<div className='bg-[#6c68b8] rounded-lg p-4 space-y-3'>
			{/* Header with progress */}
			<div className='flex items-center justify-between mb-2'>
				<h3 className='text-white font-semibold text-sm'>
					Analysis Requirements
				</h3>
				<span className='text-xs text-white/70'>
					{completedCount} of {requirements.length} complete
				</span>
			</div>

			{/* Progress bar */}
			<div className='w-full bg-gray-700 rounded-full h-2 overflow-hidden'>
				<div
					className='bg-gradient-to-r from-green-500 to-green-400 h-full transition-all duration-300 ease-out'
					style={{width: `${completionPercentage}%`}}
				/>
			</div>

			{/* Requirements checklist */}
			<div className='space-y-1'>
				<RequirementRow
					label='Ticker Symbol'
					isReady={readiness.tickerValid}
					detail={
						readiness.tickerValid
							? 'Price data loaded'
							: 'Enter a valid ticker'
					}
				/>

				<RequirementRow
					label='Portfolio Positions'
					isReady={readiness.portfolioReady}
					detail={
						uploadState.portfolio.files.length > 0
							? `${uploadState.portfolio.files.length} file(s)`
							: 'Upload portfolio screenshot or CSV'
					}
				/>

				<RequirementRow
					label='Technical Charts'
					isReady={readiness.chartsReady}
					detail={
						uploadState.charts.files.length > 0
							? `${uploadState.charts.files.length} chart(s)`
							: 'Upload chart images'
					}
				/>

				<RequirementRow
					label='Research Documents'
					isReady={readiness.researchReady}
					detail={
						uploadState.research.files.length > 0
							? `${uploadState.research.files.length} document(s)`
							: 'Upload research PDFs or docs'
					}
				/>
			</div>

			{/* Status message */}
			<div
				className={`text-xs text-center p-2 rounded ${
					readiness.allRequirementsMet
						? 'bg-green-900/30 text-green-300'
						: 'bg-yellow-900/30 text-yellow-300'
				}`}>
				{readiness.allRequirementsMet ? (
					<div className='flex items-center justify-center gap-2'>
						<Check className='h-3 w-3' />
						<span>Ready for AI analysis!</span>
					</div>
				) : (
					<div className='flex items-center justify-center gap-2'>
						<AlertCircle className='h-3 w-3' />
						<span>
							Complete all requirements to enable analysis
						</span>
					</div>
				)}
			</div>
		</div>
	);
}
