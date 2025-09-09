// Portfolio position structure
export interface PortfolioPosition {
    symbol: string;
    quantity: number;
    purchasePrice?: number;
    currentValue?: number;
    percentOfPortfolio?: number;
    purchaseDate?: string;
    account?: string;
  }
  
  // CSV parsing result
  export interface PortfolioParseResult {
    success: boolean;
    positions: PortfolioPosition[];
    totalValue?: number;
    errors: string[];
    warnings: string[];
    metadata?: {
      source?: string;
      brokerageType?: string;
      extractionConfidence?: string;
      fileName?: string;
      optionPositions?: any[];
      [key: string]: any;
    };
  }
  
  // Common CSV column mappings
  export const COLUMN_MAPPINGS = {
    symbol: ['symbol', 'ticker', 'stock', 'equity', 'security'],
    quantity: ['quantity', 'shares', 'units', 'position', 'qty'],
    purchasePrice: ['purchase price', 'cost basis', 'avg cost', 'price', 'cost'],
    currentValue: ['market value', 'current value', 'value', 'total value'],
    purchaseDate: ['purchase date', 'date acquired', 'buy date', 'date'],
    account: ['account', 'portfolio', 'account name', 'account type']
  };