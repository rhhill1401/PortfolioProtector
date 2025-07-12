import './App.css';
import {TickerPriceSearch} from './components/TickerPriceSearch';
import {useState} from 'react';
// Import the new component placeholder (we'll create it next)
import {StockAnalysis} from './components/StockAnalysis';
import {PolygonTester} from './components/PolygonTester';

function App() {
	// The currently selected/entered ticker symbol
	const [activeTicker, setActiveTicker] = useState<string>('');
	
	// Check if we're in test mode via URL param
	const isTestMode = window.location.search.includes('test=polygon');

	return (
		<div className='flex flex-col min-h-screen w-screen bg-white text-gray-900 overflow-x-hidden'>
			<header className='w-full bg-[#0066FF] py-6 shadow-md'>
				<div className='container mx-auto px-4 flex items-center justify-center'>
					<img
						src='/portfolioLogo.png'
						alt='Portfolio Protector Logo'
						className='h-26 w-26 mr-4'
					/>
					<div>
						<h1 className='text-4xl font-bold text-center text-white'>
							Portfolio Protector
						</h1>
						<p className='text-center mt-1 text-white/80'>
							Real-time market data and AI-powered investment
							analysis
						</p>
					</div>
				</div>
			</header>

			<main className='flex-grow w-full py-8'>
				{isTestMode ? (
					<PolygonTester />
				) : (
					<div className='container mx-auto px-4 flex flex-col md:flex-row gap-6 h-full'>
						<div className='md:w-1/3 w-full'>
							<TickerPriceSearch
								tickerSymbol={activeTicker}
								onTickerChange={setActiveTicker}
							/>
						</div>
						<div className='md:w-2/3 w-full rounded-lg'>
							{activeTicker ? (
								<StockAnalysis tickerSymbol={activeTicker} />
							) : (
								<div className='p-6 bg-[#F3F4F6] rounded-lg shadow-md border border-gray-200 min-h-[28rem] md:min-h-full h-full flex items-center justify-center text-center text-gray-500'>
									<div>
										<h2 className='text-xl font-semibold mb-2'>
											Enter a ticker to analyze
										</h2>
										<p>
											Search for a stock symbol to view
										AI-powered analysis
									</p>
								</div>
							</div>
						)}
					</div>
				</div>
				)}
			</main>

			<footer className='w-full mt-auto bg-[#0066FF] py-4 border-t border-blue-600'>
				<div className='container mx-auto px-4 text-center text-white/70 text-sm'>
					<p>
						© 2025 Portfolio Protector. Data provided by Alpha
						Vantage.
					</p>
				</div>
			</footer>
		</div>
	);
}

export default App;
