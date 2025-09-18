# PortfolioProtector

Real-time market analysis platform with AI-powered investment insights and options trading strategies (Wheel Strategy focus). Combines portfolio analysis, technical chart vision, and research processing through GPT-5 reasoning models.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your API keys to .env.local

# Start development server
npm run dev         # Opens on http://localhost:5173
```

## 📊 Core Features

- **Real-Time Market Data**: Stock quotes via Marketstack API with VIX volatility tracking
- **Portfolio Analysis**: Upload CSV files or screenshots for position tracking
- **Chart Vision**: AI-powered technical analysis of up to 3 chart images using GPT-4 Vision
- **Options Greeks**: Real-time calculations via Polygon.io (Delta, Theta, Gamma, IV)
- **Wheel Strategy Optimization**: Automated analysis for covered calls and cash-secured puts
- **AI Investment Analysis**: GPT-5 powered recommendations with entry/exit strategies

## 🏗️ Architecture

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 19 + TypeScript | UI Framework |
| **Build** | Vite | Fast bundling & HMR |
| **Styling** | TailwindCSS | Utility-first CSS |
| **Charts** | Recharts | Data visualization |
| **Backend** | Supabase Edge Functions | Serverless endpoints |
| **AI Models** | OpenAI GPT-5, GPT-4 Vision | Analysis & reasoning |
| **Market Data** | Marketstack, Polygon.io | Quotes & options data |

### System Flow

```
User Input → Frontend Processing → Edge Functions → AI Analysis → Results Display
    ↓              ↓                     ↓                ↓              ↓
  Ticker      File Upload         API Gateway      GPT-5/4V        Tabbed UI
  Search      & Parsing          & Validation     Processing      Analysis
```

## 🛠️ Development

### Essential Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Production build
npm run lint             # Run ESLint
npm run preview          # Preview production build

# Supabase Deployment (use npm scripts!)
npm run deploy:ia        # Deploy integrated-analysis
npm run deploy:ia-v2     # Deploy integrated-analysis-v2
npm run deploy:chart     # Deploy chart-vision
npm run deploy:portfolio # Deploy portfolio-vision
npm run deploy:options   # Deploy option functions
npm run deploy:all       # Deploy everything

# Testing
npm run test:functions   # Verify edge functions
```

### Environment Variables

Create `.env.local` with:

```bash
VITE_MARKETSTACK_API_KEY=your_key
VITE_SUPABASE_URL=https://twnldqhqbybnmqbsgvpq.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_SUPABASE_FN_URL=your_functions_url
```

Supabase Dashboard secrets:
- `OPENAI_API_KEY`
- `POLYGON_API_KEY`

## 📁 Project Structure

```
PortfolioProtector/
├── src/
│   ├── components/       # React components
│   │   ├── ui/          # Reusable UI (shadcn/ui)
│   │   └── *.tsx        # Feature components
│   ├── services/        # API & business logic
│   ├── hooks/           # Custom React hooks
│   ├── types/           # TypeScript definitions
│   └── utils/           # Helper functions
├── supabase/
│   └── functions/       # Edge functions (Deno)
│       ├── integrated-analysis-v2/  # Main AI orchestrator
│       ├── chart-vision/            # Chart image analysis
│       ├── portfolio-vision/        # Portfolio processing
│       └── option-*/                # Options data endpoints
├── docs/
│   ├── bugs-and-fixes/  # Known issues & solutions
│   └── *.md             # Architecture & guidelines
└── features/            # Feature specs & user stories
```

## 🔑 Key Components

### Frontend Components

- **TickerPriceSearch**: Stock lookup with real-time quotes and file uploads
- **StockAnalysis**: Tabbed interface for AI analysis results
- **UploadStatusTracker**: Visual progress for file upload states
- **MarketContext**: Real-time VIX, ETF flows, NAV premium tracking

### Edge Functions

- **integrated-analysis-v2**: Orchestrates all AI analysis with GPT-5
- **chart-vision**: Processes technical charts with GPT-4 Vision
- **portfolio-vision**: Extracts positions from screenshots/CSVs
- **option-quote**: Fetches single option contract data
- **market-context**: Aggregates market indicators

## 🐛 Known Issues & Solutions

### Greeks Display as N/A
- **Cause**: Key format mismatch or incomplete API response
- **Fix**: Normalize keys to uppercase, validate before caching

### Date Format Issues
- **Cause**: Multiple date formats from different sources
- **Fix**: Centralized ISO normalization (YYYY-MM-DD)

### CORS with Polygon API
- **Cause**: Direct browser calls blocked
- **Fix**: All calls proxied through Supabase Edge Functions

### Supabase Deploy Hangs on macOS
- **Cause**: Docker bundling issues
- **Fix**: Always use `--use-api` flag (handled by npm scripts)

## 🚦 Development Standards

### Core Philosophy: "Upgrade, Don't Replace"
- Search for existing implementations before creating new code
- Extend existing patterns rather than introducing new ones
- Keep solutions simple (KISS principle)

### TypeScript Requirements
- **No `any` types** - use proper interfaces
- **Strict mode** enabled
- **Type guards** for runtime safety

### Code Organization
- **Single Responsibility** - one component, one job
- **DRY Principle** - extract common logic
- **Error Boundaries** - graceful failure handling
- **Modular Components** - small, focused, reusable

## 📊 Data Flow

### User Journey
1. Enter ticker → Marketstack API → Display quote
2. Upload files → Parse/validate → Store in state
3. Click "Get AI Analysis" → Fetch Greeks → Call integrated-analysis-v2
4. Process response → Display in tabs

### Critical Transformations
- **Dates**: Always ISO format (YYYY-MM-DD)
- **Greeks Keys**: Uppercase normalization
- **Premium Calc**: `premium × 100 × |contracts|`
- **Position Sign**: Negative = SHORT, Positive = LONG

## 🔒 Security

- API keys in environment variables only
- Input validation at all boundaries
- XSS prevention via React escaping
- Rate limiting on API calls

## 📈 Performance Optimizations

- **Debouncing**: 500ms for ticker search
- **Caching**: 1-hour Greeks, 30-sec quotes
- **Batch Processing**: Charts analyzed 3 at a time
- **Memoization**: For expensive calculations
- **Code Splitting**: Lazy loading for large components

## 🧪 Testing Principles

- Use real data for integration tests
- Test complete user journeys
- Cover edge cases and error scenarios
- Console logging only in development

## 📚 Documentation

- **ARCHITECTURE.md**: Technical deep dive
- **CLAUDE.md**: AI assistant instructions
- **docs/**: Implementation details & bug fixes
- **agent.md files**: Directory-specific AI guidance

## 🎯 Current Focus Areas

✅ Completed:
- Options Greeks integration
- Wheel Strategy analysis
- Real-time market context
- ETF flow tracking
- Premium calculations

🔄 In Progress:
- Performance optimizations
- Mobile responsive design
- Advanced caching strategies

## 💡 Tips

1. **Always use npm**, never yarn
2. **Test with real data**, not mocks
3. **Check Supabase auth** before deploying (`supabase login`)
4. **Use npm scripts** for deployments (includes correct flags)
5. **Filter positions by ticker** before Greeks fetch
6. **Validate data before caching**

## 🤝 Contributing

1. Follow "Upgrade, Don't Replace" philosophy
2. Check CODE_REVIEW_STANDARDS.md before submitting
3. Test with real market data
4. Update documentation for new features
5. Use existing patterns and components

## 📞 Support

- Check `/docs/bugs-and-fixes/` for known issues
- Review agent.md files for AI assistance
- Consult ARCHITECTURE.md for technical details

---

**Package Manager**: npm (DO NOT use yarn)
**Node Version**: 18+ recommended
**Last Updated**: January 2025