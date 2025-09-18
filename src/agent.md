# Frontend Development Agent Guide

This guide helps AI agents work effectively with the React + TypeScript frontend in PortfolioProtector.

## Code Review Standards

### Core Philosophy: "Upgrade, Don't Replace"
Before writing ANY new code:
- [ ] Search for existing implementations
- [ ] Check reusable patterns in neighboring files
- [ ] Review existing utilities and components
- [ ] Extend existing code instead of creating new

### TypeScript Requirements
```typescript
// ❌ NEVER use any
const data: any = fetchData();

// ✅ ALWAYS use proper types
interface MarketData {
  price: number;
  change: number;
  percentChange: number;
}
const data: MarketData = fetchData();
```

### Modularity Principles
- **Single Responsibility**: One component = one job
- **DRY**: Extract common logic to hooks/utils
- **KISS**: Simple solutions first
- **Small Components**: Break large components into smaller pieces

## Component Architecture

### File Organization
```
src/
├── components/
│   ├── ui/              # Reusable shadcn/ui components
│   └── *.tsx            # Feature components
├── services/            # API calls & business logic
├── hooks/               # Custom React hooks
├── types/               # TypeScript definitions
├── utils/               # Helper functions
└── assets/             # Static files
```

### Component Patterns

#### Container/Presenter Pattern
```typescript
// Container - handles logic
function StockAnalysisContainer() {
  const [data, setData] = useState();
  const [loading, setLoading] = useState(false);

  // Logic here

  return <StockAnalysisView data={data} loading={loading} />;
}

// Presenter - handles display
function StockAnalysisView({ data, loading }: Props) {
  if (loading) return <Spinner />;
  return <div>{/* Pure UI */}</div>;
}
```

#### Custom Hooks for Reusable Logic
```typescript
// hooks/useMarketData.ts
export function useMarketData(ticker: string) {
  const [data, setData] = useState<MarketData>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch logic
  }, [ticker]);

  return { data, loading };
}
```

## Event System

### Cross-Component Communication
```typescript
// Dispatching events
window.dispatchEvent(new CustomEvent('price-update', {
  detail: { price, change, percentChange }
}));

// Listening to events
useEffect(() => {
  const handler = (e: CustomEvent) => {
    setData(e.detail);
  };

  window.addEventListener('analysis-ready', handler);
  return () => window.removeEventListener('analysis-ready', handler);
}, []);
```

### Event Types
- `price-update`: Stock price changes
- `analysis-start`: Analysis begins
- `analysis-done`: Analysis completes
- `analysis-ready`: Results available

## State Management

### Local State First
- Use component state for local data
- Lift state up when needed by multiple components
- No Redux/Zustand unless absolutely necessary

### State Patterns
```typescript
// Good - Clear state updates
setLoading(true);
try {
  const result = await fetchData();
  setData(result);
} catch (error) {
  setError(error.message);
} finally {
  setLoading(false);
}
```

## API Integration

### Service Layer Pattern
```typescript
// services/marketData.ts
export class MarketDataService {
  private static API_KEY = import.meta.env.VITE_MARKETSTACK_API_KEY;

  static async fetchQuote(ticker: string) {
    if (!this.API_KEY) {
      throw new Error('API key not configured');
    }

    const response = await axios.get('/api/quote', {
      params: { ticker },
      headers: { 'X-API-Key': this.API_KEY }
    });

    return this.normalizeData(response.data);
  }
}
```

### Error Handling
```typescript
// Always handle errors gracefully
try {
  const data = await MarketDataService.fetchQuote(ticker);
  setQuote(data);
} catch (error) {
  console.error('Failed to fetch quote:', error);
  setError('Unable to fetch market data. Please try again.');
  // Optionally show fallback UI
}
```

## Performance Optimization

### Debouncing User Input
```typescript
// utils/debounce.ts
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// Usage
const debouncedTicker = useDebounce(ticker, 500);
```

### Memoization
```typescript
// Expensive calculations
const expensiveResult = useMemo(() => {
  return calculateComplexValue(data);
}, [data]);

// Component memoization
const MemoizedComponent = React.memo(ExpensiveComponent);
```

### Code Splitting
```typescript
// Lazy loading
const StockAnalysis = lazy(() => import('./StockAnalysis'));

// Usage with Suspense
<Suspense fallback={<Loading />}>
  <StockAnalysis />
</Suspense>
```

## Testing Principles

### Use Real Data
```typescript
// ❌ BAD - Mock data
const mockData = { price: 100, change: 5 };

// ✅ GOOD - Real API call
const response = await fetch('/api/real-endpoint');
const data = await response.json();
```

### Test User Workflows
1. Enter ticker → See quote
2. Upload files → See progress
3. Click analyze → See results
4. Handle errors gracefully

## Common Patterns

### Loading States
```typescript
if (loading) {
  return (
    <div className="flex items-center justify-center p-8">
      <Spinner />
    </div>
  );
}
```

### Empty States
```typescript
if (!data || data.length === 0) {
  return (
    <div className="text-center text-gray-500 py-8">
      No data available
    </div>
  );
}
```

### Error Boundaries
```typescript
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    console.error('Error caught:', error, errorInfo);
    // Log to error reporting service
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

## Styling Guidelines

### TailwindCSS Usage
```tsx
// Use consistent color scheme
<div className="bg-purple-600 text-white">
  {/* Purple: #9089FC, #766DFB */}
  {/* Blue: #0066FF */}
</div>

// Responsive design
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  {/* Mobile-first approach */}
</div>
```

### Component Styling Pattern
```tsx
// Use cn() for conditional classes
import { cn } from '@/lib/utils';

<button className={cn(
  "px-4 py-2 rounded-lg",
  "bg-purple-600 hover:bg-purple-700",
  disabled && "opacity-50 cursor-not-allowed"
)}>
```

## File Upload System

### Upload States
```typescript
type UploadState = 'empty' | 'uploading' | 'processing' | 'ready';

interface UploadStatus {
  state: UploadState;
  fileName?: string;
  error?: string;
}
```

### File Processing
```typescript
const processFile = async (file: File) => {
  setStatus({ state: 'uploading' });

  try {
    const reader = new FileReader();
    reader.onload = (e) => {
      setStatus({ state: 'processing' });
      // Process file content
      const content = e.target?.result;
      // Parse CSV, process image, etc.
      setStatus({ state: 'ready', fileName: file.name });
    };
    reader.readAsText(file);
  } catch (error) {
    setStatus({ state: 'empty', error: error.message });
  }
};
```

## Environment Variables

### Required Variables
```bash
VITE_MARKETSTACK_API_KEY=xxx
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
VITE_SUPABASE_FN_URL=xxx
```

### Accessing in Code
```typescript
const API_KEY = import.meta.env.VITE_MARKETSTACK_API_KEY;

// Always validate
if (!API_KEY) {
  console.error('API key not configured');
  return;
}
```

## Import Order Convention

```typescript
// 1. React/core libraries
import { useState, useEffect } from 'react';

// 2. Third-party libraries
import axios from 'axios';
import { parse } from 'papaparse';

// 3. Local components
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// 4. Types
import type { OptionPosition, MarketData } from '@/types';

// 5. Utils/services
import { calculateGreeks } from '@/utils/options';
import { MarketDataService } from '@/services/marketData';
```

## Debugging Tips

### Console Logging
```typescript
const DEBUG = import.meta.env.DEV;

if (DEBUG) {
  console.log('🎯 [Component] Data:', data);
}
```

### React DevTools
- Use React DevTools to inspect component state
- Check Profiler for performance issues
- Monitor re-renders

### Network Tab
- Verify API calls
- Check response formats
- Monitor timing

## Common Issues & Solutions

### Issue: Component Re-renders Too Often
**Solution**: Use React.memo, useMemo, useCallback

### Issue: API Calls Fail
**Solution**: Check env variables, add error handling

### Issue: State Updates Don't Reflect
**Solution**: Ensure immutable updates, check dependencies

### Issue: Types Don't Match
**Solution**: Define proper interfaces, use type guards

## Checklist for New Features

- [ ] Search for existing similar components
- [ ] Define TypeScript interfaces
- [ ] Create reusable components
- [ ] Handle loading/error/empty states
- [ ] Add proper error boundaries
- [ ] Use existing utilities
- [ ] Follow naming conventions
- [ ] Test with real data
- [ ] Verify responsive design
- [ ] Check accessibility

## Key Commands

```bash
# Development
npm run dev           # Start dev server

# Type checking
npm run build        # Will fail on type errors

# Linting
npm run lint         # Check code quality

# Testing locally
npm run preview      # Test production build
```

## Remember

1. **Extend, don't replace** existing code
2. **TypeScript strict mode** - no any types
3. **Small, focused components**
4. **Handle all states** (loading, error, empty)
5. **Real data for testing**
6. **Consistent patterns** across codebase
7. **Performance matters** - optimize wisely
8. **User experience first**