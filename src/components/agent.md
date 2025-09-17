# Component Development Agent Guide

This guide helps AI agents create and maintain React components following PortfolioProtector's standards.

## Component Creation Checklist

Before creating ANY new component:
1. **Search existing components** for similar functionality
2. **Check ui/ folder** for reusable base components
3. **Review neighboring components** for patterns
4. **Extend existing components** when possible
5. **Only create new if absolutely necessary**

## Component Standards

### File Structure
```typescript
// ComponentName.tsx
import React from 'react';
import { cn } from '@/lib/utils';
import type { ComponentProps } from '@/types';

interface ComponentNameProps {
  // Props with explicit types
  data: MarketData;
  onUpdate?: (value: number) => void;
  className?: string;
}

export function ComponentName({
  data,
  onUpdate,
  className
}: ComponentNameProps) {
  // Component logic

  return (
    <div className={cn("base-classes", className)}>
      {/* Component JSX */}
    </div>
  );
}
```

### Naming Conventions
- **Components**: PascalCase (`StockAnalysis.tsx`)
- **Props Interfaces**: ComponentNameProps
- **Event Handlers**: handle* or on* (`handleClick`, `onChange`)
- **State Variables**: Descriptive names (`isLoading`, `hasError`)

## Key Components Reference

### TickerPriceSearch
**Purpose**: Main input component for stock ticker search
**Key Features**:
- Real-time price fetching with 500ms debounce
- File upload tabs (Portfolio, Charts, Research)
- Analysis trigger button
- Price display with change indicators

**Common Modifications**:
- Adding new upload categories
- Customizing analysis button behavior
- Extending price display information

### StockAnalysis
**Purpose**: Displays AI analysis results in tabbed interface
**Tabs**:
1. Performance - Position status, Greeks, IV
2. Wheel Execution - Strategy metrics
3. Recommendations - AI-generated advice
4. Technical Analysis - Chart patterns

**Extension Points**:
- Adding new analysis tabs
- Customizing tab content
- Enhancing data visualization

### MarketContext
**Purpose**: Real-time market indicators
**Data Points**:
- VIX volatility index
- ETF flows (ETHA, IBIT)
- NAV premium/discount
- Volume indicators

**Update Patterns**:
```typescript
// Adding new indicator
const [newIndicator, setNewIndicator] = useState<number>();

useEffect(() => {
  fetchNewIndicator().then(setNewIndicator);
}, [ticker]);
```

### UploadStatusTracker
**Purpose**: Visual progress for file uploads
**States**: empty → uploading → processing → ready
**Categories**: Portfolio, Charts, Research

## UI Component Library (shadcn/ui)

### Available Base Components
```
components/ui/
├── button.tsx        # Buttons with variants
├── card.tsx          # Card containers
├── dialog.tsx        # Modal dialogs
├── input.tsx         # Form inputs
├── select.tsx        # Dropdowns
├── tabs.tsx          # Tab interfaces
├── tooltip.tsx       # Hover tooltips
└── badge.tsx         # Status badges
```

### Using UI Components
```tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Button variants
<Button variant="default">Default</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>

// Card structure
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

## State Management Patterns

### Component State
```typescript
// Simple state
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string>();

// Complex state object
const [formData, setFormData] = useState<FormData>({
  ticker: '',
  quantity: 0,
  expiry: null
});

// State updates
setFormData(prev => ({
  ...prev,
  ticker: newValue
}));
```

### Effect Hooks
```typescript
// API calls
useEffect(() => {
  let cancelled = false;

  async function fetchData() {
    try {
      const result = await api.getData();
      if (!cancelled) {
        setData(result);
      }
    } catch (err) {
      if (!cancelled) {
        setError(err.message);
      }
    }
  }

  fetchData();

  return () => {
    cancelled = true;
  };
}, [dependency]);

// Event listeners
useEffect(() => {
  const handler = (e: CustomEvent) => {
    setData(e.detail);
  };

  window.addEventListener('custom-event', handler);
  return () => window.removeEventListener('custom-event', handler);
}, []);
```

## Styling Guidelines

### TailwindCSS Classes
```tsx
// Consistent spacing
<div className="p-4 md:p-6 lg:p-8">

// Color scheme
<div className="bg-purple-600 text-white">  // Primary
<div className="bg-blue-600 text-white">    // Secondary
<div className="bg-gray-100 text-gray-900"> // Neutral

// Responsive design
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">

// Hover states
<button className="hover:bg-purple-700 transition-colors">

// Conditional styling
<div className={cn(
  "base-classes",
  isActive && "active-classes",
  hasError && "error-classes"
)}>
```

### Component-Specific Styles
```tsx
// Market indicators
<div className={cn(
  "text-2xl font-bold",
  change >= 0 ? "text-green-600" : "text-red-600"
)}>

// Status badges
<Badge variant={position.isShort ? "destructive" : "default"}>

// Loading states
<div className="animate-pulse bg-gray-200 rounded h-4 w-24">
```

## Error Handling

### Component Error Boundaries
```typescript
// ErrorBoundary wrapper
export function ComponentWithBoundary() {
  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <ActualComponent />
    </ErrorBoundary>
  );
}
```

### Inline Error Handling
```tsx
{error && (
  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
    {error}
  </div>
)}
```

## Performance Optimization

### Memoization
```typescript
// Memo for expensive components
const MemoizedChart = React.memo(ChartComponent, (prev, next) => {
  return prev.data === next.data;
});

// useMemo for calculations
const calculatedValue = useMemo(() => {
  return expensiveCalculation(data);
}, [data]);

// useCallback for functions
const handleClick = useCallback(() => {
  doSomething(value);
}, [value]);
```

### Lazy Loading
```typescript
const HeavyComponent = lazy(() => import('./HeavyComponent'));

// In render
<Suspense fallback={<Loading />}>
  <HeavyComponent />
</Suspense>
```

## Common Patterns

### Loading States
```tsx
if (loading) {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
    </div>
  );
}
```

### Empty States
```tsx
if (!data || data.length === 0) {
  return (
    <Card className="text-center p-8">
      <p className="text-gray-500">No data available</p>
      <Button className="mt-4" onClick={onRefresh}>
        Refresh
      </Button>
    </Card>
  );
}
```

### Data Tables
```tsx
<div className="overflow-x-auto">
  <table className="min-w-full divide-y divide-gray-200">
    <thead className="bg-gray-50">
      <tr>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Column
        </th>
      </tr>
    </thead>
    <tbody className="bg-white divide-y divide-gray-200">
      {data.map((item) => (
        <tr key={item.id}>
          <td className="px-6 py-4 whitespace-nowrap">
            {item.value}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

## Testing Components

### Manual Testing Checklist
- [ ] Component renders without errors
- [ ] Props are properly typed
- [ ] Loading states work
- [ ] Error states display correctly
- [ ] Empty states are handled
- [ ] Responsive design works
- [ ] Keyboard navigation works
- [ ] Screen reader friendly

### Common Test Scenarios
1. Initial render with no data
2. Loading state display
3. Data fetch and display
4. Error handling
5. User interactions
6. State updates
7. Event emissions

## Component Documentation

### JSDoc for Complex Components
```typescript
/**
 * Displays real-time market analysis with AI insights
 * @param {StockAnalysisProps} props - Component properties
 * @returns {JSX.Element} Rendered analysis component
 */
export function StockAnalysis({ data, onUpdate }: StockAnalysisProps) {
  // Component implementation
}
```

### Inline Comments
```typescript
// Only add comments for complex logic
const normalizedDate = useMemo(() => {
  // Normalize various date formats to ISO
  // Handles: "Jul-18-2025", "2025-07-18", "07/18/2025"
  return normalizeDate(rawDate);
}, [rawDate]);
```

## Accessibility

### ARIA Labels
```tsx
<button
  aria-label="Refresh market data"
  onClick={onRefresh}
>
  <RefreshIcon />
</button>
```

### Keyboard Navigation
```tsx
<input
  type="text"
  onKeyDown={(e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  }}
/>
```

### Focus Management
```tsx
const inputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  inputRef.current?.focus();
}, []);
```

## Quick Reference

### Creating New Component
1. Check if similar exists
2. Use TypeScript interface
3. Follow naming convention
4. Handle all states
5. Add error boundary
6. Test with real data

### Modifying Existing Component
1. Understand current behavior
2. Check for dependencies
3. Maintain backward compatibility
4. Update TypeScript types
5. Test all use cases

### Common Imports
```typescript
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { MarketData, OptionPosition } from '@/types';
```

## Remember

1. **Search before creating** - Reuse existing components
2. **Type everything** - No any types
3. **Handle all states** - Loading, error, empty
4. **Keep it simple** - Don't over-engineer
5. **Follow patterns** - Consistency is key
6. **Test with real data** - No mocks
7. **Think accessibility** - Keyboard & screen readers
8. **Optimize wisely** - Profile before optimizing