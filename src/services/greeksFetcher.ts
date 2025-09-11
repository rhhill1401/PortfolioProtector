/**
 * Service for fetching option Greeks from Polygon with rate limiting and caching
 * Supports batch processing for multiple positions after portfolio upload
 */

import { fetchSingleQuote, type OptionQuote } from './optionLookup';

export interface OptionPosition {
  symbol: string;
  strike: number;
  expiry: string; // YYYY-MM-DD format
  optionType: 'CALL' | 'PUT';
  contracts: number;
  position: 'LONG' | 'SHORT';
  premiumCollected?: number;
  currentValue?: number;
  daysToExpiry?: number;
}

interface GreeksCache {
  [key: string]: {
    greeks: OptionQuote;
    timestamp: number;
  };
}

interface QueuedRequest {
  position: OptionPosition;
  resolve: (value: OptionQuote | null) => void;
  reject: (error: Error) => void;
}

export class GreeksFetcher {
  private cache: GreeksCache = {};
  private queue: QueuedRequest[] = [];
  private isProcessing = false;
  private lastRequestTime = 0;
  private windowStart = 0;
  private requestCount = 0;
  
  // Rate limits
  private readonly RATE_LIMIT = 5; // 5 requests per minute
  private readonly RATE_WINDOW = 60000; // 1 minute in ms
  private readonly REQUEST_DELAY = 12000; // 12 seconds between requests (5 per minute)
  
  // Cache settings
  private readonly CACHE_TTL = 3600000; // 1 hour in ms
  private readonly STALE_THRESHOLD = 1800000; // 30 minutes in ms
  
  constructor() {
    // Load cache from localStorage if available
    this.loadCacheFromStorage();
  }
  
  /**
   * Get cache key for a position
   */
  private getCacheKey(position: OptionPosition): string {
    return `${position.symbol}-${position.strike}-${position.expiry}-${position.optionType}`;
  }
  
  /**
   * Load cache from localStorage
   */
  private loadCacheFromStorage(): void {
    try {
      const stored = localStorage.getItem('greeks-cache');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Only load entries that aren't expired
        const now = Date.now();
        Object.entries(parsed).forEach(([key, value]: [string, any]) => {
          if (now - value.timestamp < this.CACHE_TTL) {
            this.cache[key] = value;
          }
        });
      }
    } catch (error) {
      console.warn('Failed to load Greeks cache from storage:', error);
    }
  }
  
  /**
   * Save cache to localStorage
   */
  private saveCacheToStorage(): void {
    try {
      localStorage.setItem('greeks-cache', JSON.stringify(this.cache));
    } catch (error) {
      console.warn('Failed to save Greeks cache to storage:', error);
    }
  }
  
  /**
   * Check if we can make a request based on rate limits
   */
  private canMakeRequest(): boolean {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    // Reset counter if window has passed since first request in window
    if (now - this.windowStart >= this.RATE_WINDOW) {
      this.windowStart = now;
      this.requestCount = 0;
    }
    
    // Initialize window start if this is the first request
    if (this.requestCount === 0) {
      this.windowStart = now;
    }
    
    // Check if we're under the rate limit AND enough time has passed since last request
    return this.requestCount < this.RATE_LIMIT && timeSinceLastRequest >= this.REQUEST_DELAY;
  }
  
  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    while (this.queue.length > 0) {
      if (!this.canMakeRequest()) {
        // Wait before next request
        const waitTime = this.REQUEST_DELAY - (Date.now() - this.lastRequestTime);
        await new Promise(resolve => setTimeout(resolve, Math.max(0, waitTime)));
        continue;
      }
      
      const request = this.queue.shift();
      if (!request) continue;
      
      try {
        // Make the API request
        const result = await fetchSingleQuote(
          request.position.symbol,
          request.position.strike,
          request.position.expiry,
          request.position.optionType.toLowerCase() as 'call' | 'put'
        );
        
        this.lastRequestTime = Date.now();
        this.requestCount++;
        
        if (result.success && result.quote) {
          // Cache the result
          const cacheKey = this.getCacheKey(request.position);
          console.log('BEFORE_CACHE:', result.quote);
          console.log('CACHE_KEY:', cacheKey);
          this.cache[cacheKey] = {
            greeks: result.quote,
            timestamp: Date.now()
          };
          console.log('AFTER_CACHE:', this.cache[cacheKey]);
          this.saveCacheToStorage();
          
          request.resolve(result.quote);
        } else {
          request.resolve(null);
        }
      } catch (error) {
        console.error(`Failed to fetch Greeks for ${request.position.symbol}:`, error);
        request.reject(error as Error);
      }
    }
    
    this.isProcessing = false;
  }
  
  /**
   * Fetch Greeks for a single position
   */
  private async fetchSinglePosition(position: OptionPosition): Promise<OptionQuote | null> {
    const cacheKey = this.getCacheKey(position);
    const cached = this.cache[cacheKey];
    
    // Check cache first
    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < this.CACHE_TTL) {
        console.log(`🎯 [GREEKS] Cache hit for ${cacheKey}, age: ${Math.round(age / 1000)}s`);
        return {
          ...cached.greeks,
          isStale: age > this.STALE_THRESHOLD
        } as OptionQuote & { isStale?: boolean };
      }
    }
    
    // Queue the request
    return new Promise((resolve, reject) => {
      console.log(`📊 [GREEKS] Queueing request for ${cacheKey}`);
      this.queue.push({ position, resolve, reject });
      this.processQueue();
    });
  }
  
  /**
   * Fetch Greeks for multiple positions
   * Returns a Map keyed by position identifier
   */
  async fetchGreeksForPositions(positions: OptionPosition[]): Promise<Map<string, OptionQuote>> {
    console.log(`🎯 [GREEKS] Fetching Greeks for ${positions.length} positions`);
    
    const results = new Map<string, OptionQuote>();
    const promises: Promise<void>[] = [];
    
    for (const position of positions) {
      const promise = this.fetchSinglePosition(position).then(quote => {
        if (quote) {
          const key = this.getCacheKey(position);
          results.set(key, quote);
        }
      }).catch(error => {
        console.error(`Failed to fetch Greeks for position:`, position, error);
      });
      
      promises.push(promise);
    }
    
    // Wait for all requests to complete
    await Promise.all(promises);
    
    console.log(`✅ [GREEKS] Fetched ${results.size}/${positions.length} Greeks successfully`);
    return results;
  }
  
  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache = {};
    localStorage.removeItem('greeks-cache');
    console.log('🧹 [GREEKS] Cache cleared');
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hits: number; stale: number } {
    const now = Date.now();
    let stale = 0;
    
    Object.values(this.cache).forEach(entry => {
      if (now - entry.timestamp > this.STALE_THRESHOLD) {
        stale++;
      }
    });
    
    return {
      size: Object.keys(this.cache).length,
      hits: 0, // Would need to track this
      stale
    };
  }
}

// Export singleton instance
export const greeksFetcher = new GreeksFetcher();
