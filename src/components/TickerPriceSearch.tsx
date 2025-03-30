import {useState, useEffect} from 'react';
// Removed Alpha Vantage types, will define Marketstack types inline for now
// import {GlobalQuote, GlobalQuoteResponse} from '../types/alpha-vantage';

// --- Define Props ---
interface TickerPriceSearchProps {
	tickerSymbol: string; // The symbol passed down from App
	onTickerChange: (newTicker: string) => void; // Function to call when input changes
}
// --- ---

// Define simple inline type for Marketstack EOD data
interface MarketstackEodData {
	symbol: string;
	open: number | null;
	high: number | null;
	low: number | null;
	close: number | null;
	volume: number | null;
	date: string; // Date string e.g., "2023-10-27T00:00:00+0000"
	// Add other fields if needed (e.g., exchange)
}

// Define simple inline type for Marketstack API response
interface MarketstackApiResponse {
	data: MarketstackEodData[];
	error?: {code: string; message: string};
	// Include pagination if handling multiple results
}

// --- Update component signature to accept props ---
export function TickerPriceSearch({
	tickerSymbol,
	onTickerChange,
}: TickerPriceSearchProps) {
	// Update state to hold Marketstack data structure
	const [eodData, setEodData] = useState<MarketstackEodData | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Read the Marketstack API key
	const apiKey = import.meta.env.VITE_MARKETSTACK_API_KEY;

	// --- Fetch quote when the tickerSymbol prop changes (debounced) ---
	useEffect(() => {
		console.log(
			'[TickerPriceSearch] useEffect triggered with tickerSymbol:',
			tickerSymbol
		); // Log prop change
		// Debounce mechanism: Wait 500ms after user stops typing before fetching
		const debounceTimer = setTimeout(() => {
			if (tickerSymbol.trim()) {
				const symbolToFetch = tickerSymbol.trim().toUpperCase();
				console.log(
					'[TickerPriceSearch] Debounce triggered, calling fetchQuote for:',
					symbolToFetch
				); // Log before fetch call
				fetchQuote(symbolToFetch);
			} else {
				console.log(
					'[TickerPriceSearch] Ticker symbol empty, clearing quote.'
				); // Log clearing
				setEodData(null);
				setError(null);
			}
		}, 500); // Adjust debounce time as needed (e.g., 500ms)

		// Cleanup function to clear timeout if component unmounts or ticker changes again quickly
		return () => {
			console.log('[TickerPriceSearch] Clearing debounce timer.'); // Log timer clear
			clearTimeout(debounceTimer);
		};
	}, [tickerSymbol]); // Re-run effect when tickerSymbol prop changes
	// --- ---

	// Encapsulate fetch logic into its own function
	const fetchQuote = async (symbol: string) => {
		console.log(
			`[TickerPriceSearch] fetchQuote function started for: ${symbol}`
		); // Log function start
		if (!apiKey) {
			console.error('[TickerPriceSearch] API key is missing!');
			setError('Marketstack API key is missing. Check .env.local');
			return;
		}

		setIsLoading(true);
		setError(null);
		setEodData(null); // Reset data before fetch

		// Construct Marketstack API URL (using /eod/latest endpoint)
		const url = `http://api.marketstack.com/v1/eod/latest?access_key=${apiKey}&symbols=${symbol}`;
		// Note: Free plan might be HTTP only. Use HTTPS if your plan supports it.
		// const url = `https://api.marketstack.com/v1/eod/latest?access_key=${apiKey}&symbols=${symbol}`;
		console.log(
			`[TickerPriceSearch] Fetching quote from Marketstack URL: ${url}`
		);

		try {
			const response = await fetch(url);
			console.log(
				'[TickerPriceSearch] API Raw Response Status:',
				response.status
			);
			if (!response.ok)
				throw new Error(
					`API request failed with status ${response.status}`
				);

			const data: MarketstackApiResponse = await response.json();
			console.log('[TickerPriceSearch] Parsed API Response Data:', data);

			// Handle Marketstack specific errors
			if (data.error) {
				throw new Error(
					`Marketstack API Error: ${data.error.message} (Code: ${data.error.code})`
				);
			}

			// Check if data array exists and has at least one entry
			if (!data.data || data.data.length === 0) {
				throw new Error(
					`No data found for symbol: ${symbol} from Marketstack`
				);
			}

			// Get the latest (usually only) entry from the data array
			const latestData = data.data[0];
			console.log(
				'[TickerPriceSearch] Setting EOD data state with:',
				latestData
			);
			setEodData(latestData);
			setError(null);
		} catch (err) {
			console.error('[TickerPriceSearch] Fetch error caught:', err); // Log caught error
			if (err instanceof Error) setError(err.message);
			else
				setError('An unknown error occurred while fetching the quote.');
			setEodData(null); // Clear quote on error
		} finally {
			console.log(
				'[TickerPriceSearch] Fetch sequence finished, setting isLoading to false.'
			);
			setIsLoading(false);
		}
	};

	// Helper function to format numbers and handle potential NaN
	const formatNumber = (
		value: string | number | undefined | null
	): string => {
		if (value === undefined || value === null) return 'N/A';
		const num = Number(value);
		return isNaN(num) ? 'N/A' : num.toFixed(2);
	};

	const formatDate = (dateString: string | undefined | null): string => {
		if (!dateString) return 'N/A';
		try {
			return new Date(dateString).toLocaleDateString();
		} catch {
			return 'Invalid Date';
		}
	};

	return (
		<div className='h-full w-full'>
			<div className='rounded-lg overflow-hidden shadow-md bg-[#9089FC] border border-[#7c77d1] h-full flex flex-col'>
				{/* Search Header */}
				<div className='bg-[#7c77d1] px-4 py-4 border-b border-[#6c68b8]'>
					<h2 className='text-lg font-semibold mb-2 text-white'>
						Stock Lookup
					</h2>
					<div className='relative'>
						<input
							type='text'
							value={tickerSymbol}
							onChange={(e) =>
								onTickerChange(e.target.value.toUpperCase())
							}
							placeholder='Enter ticker symbol (e.g., AAPL)'
							className='w-full pl-10 pr-4 py-2 rounded-md bg-white border border-[#6c68b8] text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
						/>
						<div className='absolute left-3 top-2.5 text-gray-500'>
							<svg
								xmlns='http://www.w3.org/2000/svg'
								className='h-5 w-5'
								viewBox='0 0 20 20'
								fill='currentColor'>
								<path
									fillRule='evenodd'
									d='M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z'
									clipRule='evenodd'
								/>
							</svg>
						</div>
					</div>
					{!apiKey && (
						<p className='text-yellow-100 text-xs mt-2 font-medium'>
							⚠️ API Key missing. Please configure .env.local
						</p>
					)}
				</div>

				{/* Quote Card */}
				<div className='p-0 text-white flex-grow'>
					{isLoading && (
						<div className='flex items-center justify-center p-8 h-64'>
							<div className='animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-white'></div>
						</div>
					)}

					{error && (
						<div className='p-6 text-center'>
							<div className='inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4'>
								<svg
									xmlns='http://www.w3.org/2000/svg'
									className='h-6 w-6 text-red-600'
									fill='none'
									viewBox='0 0 24 24'
									stroke='currentColor'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
									/>
								</svg>
							</div>
							<p className='text-white font-medium'>{error}</p>
							<p className='text-white/80 text-sm mt-2'>
								Please try again with a different symbol
							</p>
						</div>
					)}

					{!isLoading && !error && eodData && (
						<div>
							{/* Quote Header */}
							<div className='bg-[#8079e3] p-4 border-b border-[#6c68b8]'>
								<div className='flex justify-between items-center'>
									<h2 className='text-2xl font-bold'>
										{eodData.symbol}
									</h2>
									<div className='flex flex-col items-end'>
										<div className='text-2xl font-bold'>
											${formatNumber(eodData.close)}
										</div>
									</div>
								</div>
							</div>

							{/* Quote Details */}
							<div className='p-4'>
								<div className='grid grid-cols-2 gap-3'>
									<div className='bg-[#8079e3] p-3 rounded-md'>
										<div className='text-white/70 text-xs'>
											Open
										</div>
										<div className='font-medium'>
											${formatNumber(eodData.open)}
										</div>
									</div>
									<div className='bg-[#8079e3] p-3 rounded-md'>
										<div className='text-white/70 text-xs'>
											Day High
										</div>
										<div className='font-medium'>
											${formatNumber(eodData.high)}
										</div>
									</div>
									<div className='bg-[#8079e3] p-3 rounded-md'>
										<div className='text-white/70 text-xs'>
											Day Low
										</div>
										<div className='font-medium'>
											${formatNumber(eodData.low)}
										</div>
									</div>
									<div className='bg-[#8079e3] p-3 rounded-md col-span-2'>
										<div className='text-white/70 text-xs'>
											Volume
										</div>
										<div className='font-medium'>
											{eodData.volume
												? Number(
														eodData.volume
												  ).toLocaleString()
												: 'N/A'}
										</div>
									</div>
								</div>

								<div className='mt-4 text-right text-xs text-white/70'>
									Last updated: {formatDate(eodData.date)}
								</div>
							</div>
						</div>
					)}

					{!isLoading && !error && !eodData && (
						<div className='flex flex-col items-center justify-center p-8 flex-grow text-center'>
							<svg
								xmlns='http://www.w3.org/2000/svg'
								className='h-12 w-12 text-white/70 mb-4'
								fill='none'
								viewBox='0 0 24 24'
								stroke='currentColor'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={1.5}
									d='M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z'
								/>
							</svg>
							<h3 className='text-lg font-medium text-white'>
								No Stock Data
							</h3>
							<p className='text-white/80 mt-1'>
								Enter a ticker symbol to view market data
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
