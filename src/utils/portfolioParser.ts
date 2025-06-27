import Papa from 'papaparse';
import { PortfolioPosition, PortfolioParseResult, COLUMN_MAPPINGS } from '@/types/portfolio';


export class PortfolioCSVParser {
  // Normalize column names to handle variations
  private normalizeColumnName(name: string): string {
    return name.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  }

  // Find matching column for a field
  private findColumn(headers: string[], field: keyof typeof COLUMN_MAPPINGS): string | null {
    const normalizedHeaders = headers.map(h => this.normalizeColumnName(h));
    const possibleNames = COLUMN_MAPPINGS[field].map(n => this.normalizeColumnName(n));
    
    for (const possible of possibleNames) {
      const index = normalizedHeaders.findIndex(h => h.includes(possible));
      if (index !== -1) return headers[index];
    }
    return null;
  }

  // Parse numeric values safely
  private parseNumber(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    
    // Remove common formatting
    const cleaned = String(value)
      .replace(/[$,]/g, '')
      .replace(/[()]/g, '') // Remove parentheses (negative values)
      .trim();
    
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? undefined : parsed;
  }

  // Parse CSV content into positions
  async parseCSV(file: File): Promise<PortfolioParseResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const positions: PortfolioPosition[] = [];

    try {
      const text = await file.text();
      
      // Parse with PapaParse
      const parseResult = Papa.parse(text, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        delimitersToGuess: [',', '\t', '|', ';']
      });

      if (parseResult.errors.length > 0) {
        parseResult.errors.forEach(err => 
          errors.push(`Row ${err.row}: ${err.message}`)
        );
      }

      const headers = parseResult.meta.fields || [];
      
      // Map columns
      const symbolCol = this.findColumn(headers, 'symbol');
      const quantityCol = this.findColumn(headers, 'quantity');
      const purchasePriceCol = this.findColumn(headers, 'purchasePrice');
      const currentValueCol = this.findColumn(headers, 'currentValue');
      const purchaseDateCol = this.findColumn(headers, 'purchaseDate');
      const accountCol = this.findColumn(headers, 'account');

      // Validate required columns
      if (!symbolCol) {
        errors.push('Could not find symbol/ticker column');
        return { success: false, positions: [], errors, warnings };
      }
      if (!quantityCol && !currentValueCol) {
        errors.push('Could not find quantity or value column');
        return { success: false, positions: [], errors, warnings };
      }

      // Process each row
      parseResult.data.forEach((row, index: number) => {
        const r = row as Record<string, unknown>;
        try {
          const symbol = r[symbolCol!]?.toString().trim().toUpperCase();
          if (!symbol) {
            warnings.push(`Row ${index + 2}: Skipping - no symbol found`);
            return;
          }

          const position: PortfolioPosition = {
            symbol,
            quantity: this.parseNumber(r[quantityCol!]) || 0,
            purchasePrice: this.parseNumber(r[purchasePriceCol!]),
            currentValue: this.parseNumber(r[currentValueCol!]),
            purchaseDate: r[purchaseDateCol!] as string,
            account: r[accountCol!] as string
          };

          // Validate position
          if (position.quantity === 0 && !position.currentValue) {
            warnings.push(`Row ${index + 2}: ${symbol} has no quantity or value`);
            return;
          }

          positions.push(position);
        } catch (err) {
          errors.push(`Row ${index + 2}: ${err instanceof Error ? err.message : 'Parse error'}`);
        }
      });

      // Calculate total value
      const totalValue = positions.reduce((sum, pos) => 
        sum + (pos.currentValue || 0), 0
      );

      // Calculate percentages if we have total
      if (totalValue > 0) {
        positions.forEach(pos => {
          if (pos.currentValue) {
            pos.percentOfPortfolio = (pos.currentValue / totalValue) * 100;
          }
        });
      }

      return {
        success: positions.length > 0,
        positions,
        totalValue: totalValue || undefined,
        errors,
        warnings
      };

    } catch (err) {
      errors.push(`File read error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return { success: false, positions: [], errors, warnings };
    }
  }

  // Parse multiple CSV files and merge results
  async parseMultipleCSVs(files: File[]): Promise<PortfolioParseResult> {
    const allPositions: PortfolioPosition[] = [];
    const allErrors: string[] = [];
    const allWarnings: string[] = [];

    for (const file of files) {
      const result = await this.parseCSV(file);
      allPositions.push(...result.positions);
      allErrors.push(...result.errors.map(e => `${file.name}: ${e}`));
      allWarnings.push(...result.warnings.map(w => `${file.name}: ${w}`));
    }

    // Merge positions by symbol
    const mergedPositions = this.mergePositions(allPositions);

    // Recalculate total and percentages
    const totalValue = mergedPositions.reduce((sum, pos) => 
      sum + (pos.currentValue || 0), 0
    );

    if (totalValue > 0) {
      mergedPositions.forEach(pos => {
        if (pos.currentValue) {
          pos.percentOfPortfolio = (pos.currentValue / totalValue) * 100;
        }
      });
    }

    return {
      success: mergedPositions.length > 0,
      positions: mergedPositions,
      totalValue: totalValue || undefined,
      errors: allErrors,
      warnings: allWarnings
    };
  }

  // Merge duplicate positions
  private mergePositions(positions: PortfolioPosition[]): PortfolioPosition[] {
    const grouped = positions.reduce((acc, pos) => {
      const key = `${pos.symbol}-${pos.account || 'default'}`;
      if (!acc[key]) {
        acc[key] = { ...pos };
      } else {
        // Merge quantities and values
        acc[key].quantity += pos.quantity;
        if (pos.currentValue) {
          acc[key].currentValue = (acc[key].currentValue || 0) + pos.currentValue;
        }
        // Average purchase price if both exist
        if (acc[key].purchasePrice && pos.purchasePrice) {
          const totalCost = (acc[key].purchasePrice * acc[key].quantity) + 
                           (pos.purchasePrice * pos.quantity);
          acc[key].purchasePrice = totalCost / (acc[key].quantity + pos.quantity);
        }
      }
      return acc;
    }, {} as Record<string, PortfolioPosition>);

    return Object.values(grouped);
  }
}