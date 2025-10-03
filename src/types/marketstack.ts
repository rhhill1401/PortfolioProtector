export interface MarketstackEodData {
	symbol: string;
	open: number | null;
	high: number | null;
	low: number | null;
	close: number | null;
	volume: number | null;
	date: string;
}

export interface MarketstackApiResponse {
	data: MarketstackEodData[];
	error?: {code: string; message: string};
}
