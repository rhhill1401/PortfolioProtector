// Define the structure for the Global Quote object
export interface GlobalQuote {
	'01. symbol': string;
	'02. open': string;
	'03. high': string;
	'04. low': string;
	'05. price': string;
	'06. volume': string;
	'07. latest trading day': string;
	'08. previous close': string;
	'09. change': string;
	'10. change percent': string;
}

// Define the structure for the overall API response containing the quote
export interface GlobalQuoteResponse {
	'Global Quote': GlobalQuote;
	// Include other potential top-level keys if needed, like 'Note'
	Note?: string;
	'Error Message'?: string;
}
