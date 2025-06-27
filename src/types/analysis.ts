 
// Status of each upload type
export type UploadStatus = 'empty' | 'uploading' | 'processing' | 'ready' | 'error';

// Individual file tracking
export interface UploadedFile {
  file: File;
  uploadedAt: Date;
  status: UploadStatus;
  error?: string;
}

// Portfolio position from uploaded files
export interface PortfolioPosition {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  percentOfPortfolio: number;
  unrealizedPL: number;
  type: 'stock' | 'option' | 'etf';
}

// Chart analysis result
export interface ChartAnalysis {
  filename: string;
  timeframe: string;
  patterns: string[];
  supportLevels: number[];
  resistanceLevels: number[];
  confidence: number;
}

// Research document insights
export interface ResearchInsight {
  filename: string;
  content: string;
  sentiment: 'bullish' | 'neutral' | 'bearish';
  keyPoints: string[];
  relevanceScore: number;
}

// Complete upload state for all file types
export interface UploadState {
  portfolio: {
    files: UploadedFile[];
    status: UploadStatus;
    data: PortfolioPosition[];
    error?: string;
  };
  charts: {
    files: UploadedFile[];
    status: UploadStatus;
    data: ChartAnalysis[];
    error?: string;
  };
  research: {
    files: UploadedFile[];
    status: UploadStatus;
    data: ResearchInsight[];
    error?: string;
  };
}

// Analysis readiness state
export interface AnalysisReadiness {
  tickerValid: boolean;
  portfolioReady: boolean;
  chartsReady: boolean;
  researchReady: boolean;
  allRequirementsMet: boolean;
}

// Complete context for AI analysis
export interface AnalysisContext {
  ticker: string;
  tickerData: {
    price: number;
    change: number;
    changePercent: string;
    volume: number;
  };
  portfolio: PortfolioPosition[];
  charts: ChartAnalysis[];
  research: ResearchInsight[];
  uploadStatus: UploadState;
  readiness: AnalysisReadiness;
}

export type UploadCategory = 'ticker' | 'portfolio' | 'charts' | 'research';

/** A fresh UploadState where nothing has been provided yet */
export const initialUploadState: UploadState = {
  portfolio: { files: [], status: 'empty', data: [] },
  charts:    { files: [], status: 'empty', data: [] },
  research:  { files: [], status: 'empty', data: [] },
};

/** A fresh readiness object where no requirement is met */
export const initialReadiness: AnalysisReadiness = {
  tickerValid:       false,
  portfolioReady:    false,
  chartsReady:       false,
  researchReady:     false,
  allRequirementsMet:false,
};