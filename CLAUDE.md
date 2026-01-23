# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Environments

This project is developed across two machines with different capabilities:

### MacBook Pro (Primary/Personal)
- **Specs**: 2020 Intel i5, Quad-core, 8GB RAM, macOS 15.7.3
- **Path**: `~/Dev/Workspaces/Dec-2025/4castr`
- **Dotfiles**: Centralized at `~/Dev/Essentials/Configs/dotfigs/` (symlinked to home directory)
- **Considerations**:
  - Limited RAM (8GB) - avoid running too many concurrent processes
  - Keep browser tabs minimal during development
  - Use `npm run dev` (Turbopack is optimized for memory)
  - Avoid running heavy data scripts while dev server is running
  - Close Supabase Studio and other Electron apps when memory is tight

### iMac (School Library)
- **Specs**: 2020 Intel i5, 6-cores, 32GB RAM, macOS 13.6.8
- **Hostname**: ETLC-LIB-11
- **User**: s01222466
- **Path**: `/Users/s01222466/Dev/Workspaces/Dec-2025/4castr`
- **Considerations**:
  - More memory available - can run multiple services simultaneously
  - Better for heavy data operations (`npm run data:load`, `npm run precompute`)
  - Suitable for running full test suites and builds
  - Can handle browser DevTools + multiple tabs without issue

### Git Workflow for Multi-Device Development

**Philosophy**: Treat git commit/push like Cmd+S (save) - commit frequently to enable seamless machine switching.

#### Quick Save Workflow (Use This Frequently)

**Option 1: Manual Quick Save**
```bash
# One-liner to save your work
git add . && git commit -m "WIP: [brief description]" && git push
```

**Option 2: Automated Quick Save (Recommended)**
```bash
# Create a git alias for quick saves
git config --global alias.save '!git add -A && git commit -m "WIP: Auto-save $(date +%Y-%m-%d\ %H:%M:%S)" && git push'

# Then use it like Cmd+S:
git save
```

**Option 3: Even Shorter Alias**
```bash
# Create a super short alias
git config --global alias.s '!git add -A && git commit -m "WIP: $(date +%Y-%m-%d\ %H:%M:%S)" && git push'

# Now just type:
git s
```

#### Commit Message Conventions

For frequent saves, use these prefixes:
- `WIP: [description]` - Work in progress (incomplete feature)
- `Save: [description]` - Quick save checkpoint
- `Fix: [description]` - Bug fix (even if incomplete)
- `Add: [description]` - Adding new code
- `Update: [description]` - Modifying existing code
- `Refactor: [description]` - Code cleanup/restructuring

When a feature is complete, use a proper commit message without "WIP".

#### Starting Work on Another Device

```bash
# 1. Navigate to project directory
cd ~/Dev/Workspaces/Dec-2025/4castr  # (adjust path for iMac if different)

# 2. Pull latest changes (handles any conflicts)
git pull origin main

# 3. If there are merge conflicts (rare, but possible):
#    - Open conflicted files, resolve <<<<< ===== >>>>> markers
#    - Then: git add . && git commit -m "Merge: Resolved conflicts" && git push

# 4. Check if dependencies changed
npm install

# 5. Start development
npm run dev
```

#### Handling Conflicts (Rare with Frequent Commits)

Since you're the only developer and committing frequently, conflicts are unlikely. But if they occur:
```bash
# Git will show conflict markers in files like:
<<<<<<< HEAD
your code on this machine
=======
your code from other machine
>>>>>>> branch

# Keep the version you want, delete the markers, then:
git add .
git commit -m "Merge: Resolved conflicts from device switch"
git push
```

#### Shell Alias (Optional - Even Faster)

Add to your `~/.zshrc` or `~/.bashrc`:
```bash
# Super quick git save
alias gs='git add -A && git commit -m "WIP: $(date +%Y-%m-%d\ %H:%M:%S)" && git push'

# Then just type:
gs
```

After adding, reload your shell: `source ~/.zshrc`

### Daily Workflow Pattern

**On MacBook Pro:**
```bash
# Start your day
cd ~/Dev/Workspaces/Dec-2025/4castr
git pull  # Get latest from iMac session
npm run dev

# Work for a bit... make changes...
git s  # (or git save) - Save checkpoint

# Continue working...
git s  # Save again (as often as you like!)

# Heading to library?
git s  # Final save before leaving
```

**On iMac:**
```bash
# Arrive at library (ETLC-LIB-11)
cd /Users/s01222466/Dev/Workspaces/Dec-2025/4castr
git pull  # Get latest from MacBook
npm run dev

# Work on heavier tasks...
npm run data:load  # (iMac has more RAM)
git s  # Save progress

# Done for the day
git s  # Final save
```

**Back on MacBook Pro:**
```bash
git pull  # Get all the work from iMac
npm run dev  # Continue where you left off
```

### Environment Syncing Best Practices

**DO sync via git:**
- All source code files (`src/`, `scripts/`, etc.)
- Configuration files (`next.config.ts`, `tsconfig.json`, etc.)
- Package dependencies (`package.json`, `package-lock.json`)
- Documentation updates (README.md, CLAUDE.md)

**DO NOT sync via git (use .gitignore):**
- `.env.local` (contains secrets - manually copy to new machine once)
- `node_modules/` (always run `npm install` on each machine)
- `.next/` (build artifacts - regenerated per machine)
- Personal IDE settings (`.vscode/`, `.idea/`)

**Path Configuration:**
- Use relative paths in code (e.g., `./csv-pull/data/`)
- Avoid absolute paths like `/Users/jamalcarr/...` in committed code
- Verify working directory before running scripts: `pwd`

### Memory-Aware Development Tips

**On MacBook Pro (8GB RAM):**
- Run ONLY dev server: `npm run dev`
- If memory is tight, restart dev server periodically
- Use `npm run data:check` (lightweight) instead of `npm run data:load` (heavy)
- Defer heavy operations like `precompute` to the iMac

**On iMac (32GB RAM):**
- Can run dev server + data scripts concurrently
- Ideal for: `npm run data:load`, `npm run precompute`, `npm run ai:analyze`
- Good for full builds: `npm run build`
- Can run Supabase local instance if needed

## Project Overview

**4Castr** is a financial market analysis platform that combines technical analysis with astronomical/astrological event correlations. It provides confluence-based scoring for multi-asset classes (equities, crypto, forex, commodities, macro indicators, and stress indicators) using a unique blend of Gann octaves, Fibonacci levels, and planetary alignments.

**Tech Stack**: Next.js 16 (App Router), React 19, TypeScript, Supabase (PostgreSQL), Tailwind CSS, Shadcn UI, Recharts

**Infrastructure**: Deployed on Vercel with GitHub Actions cron jobs for automated data updates

## Project Status

- ✅ **Deployed and functional** - Live on Vercel
- 🔄 **Currently refactoring** - Improving code quality to senior-level standards
- 📋 **Next phase** - Adding advanced features and optimizations

### Current Priorities

1. **Consolidate duplicate Supabase client patterns** - Already using dual client pattern (anon/admin), ensure consistency
2. **Add caching layer** - Implement caching for frequently accessed data
3. **Standardize error handling** - Consistent error patterns across API routes
4. **Optimize component re-renders** - Performance improvements in dashboard components
5. **Improve TypeScript types** - Stronger type safety throughout codebase

## Development Commands

```bash
# Development
npm run dev              # Start dev server with Turbopack (localhost:3000)
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint

# Data Management
npm run data             # Interactive data management CLI
npm run data:load        # Load all CSV data into Supabase
npm run data:prices      # Update current prices from API providers
npm run data:featured    # Populate featured tickers table with ratings
npm run data:check       # Check data freshness and coverage
npm run data:ingress     # Monitor data ingestion pipeline

# Scheduled Tasks (Vercel Cron)
npm run cron:prices      # Update prices (scheduled job)
npm run cron:featured    # Refresh featured tickers (scheduled job)

# AI Analysis
npm run ai:analyze       # Run AI code analysis
npm run ai:review        # Run AI code review

# Astronomical Precomputation
npm run precompute       # Precompute astro events (Dec 2004 - Present)
```

## Architecture Overview

### Core Application Flow

```
External APIs/CSVs → dataProviders.js → Supabase PostgreSQL → API Routes → Dashboard UI
```

### Key Directories & Critical Files

- **`src/app/(dashboard)/`** - 9 main dashboard sections (1watchlist → 9pricing)
  - Each numbered directory represents a primary app feature
  - `data/` exports central data models (5 asset categories + astro events)
  - `components/` - Dashboard-specific UI components
- **`src/app/api/`** - API routes (needs consolidation - see Current Priorities)
- **`src/lib/supabase.js`** - Database client factory (dual pattern: anon/admin)
- **`src/lib/services/confluenceEngine.ts`** - Core scoring/analysis engine (25KB) ⚠️ Production critical
- **`src/lib/indicators/keyLevels.ts`** - Technical analysis calculations (61KB) ⚠️ Production critical
- **`src/lib/dataProviders.js`** - Multi-source data adapters with fallback chain (40KB)
- **`src/lib/csvAdapter.js`** - CSV processing utilities
- **`src/components/trend-path.tsx`** - Main chart visualization component (Recharts)
- **`src/components/dashboard/`** - Dashboard UI components (needs optimization review)
- **`scripts/data-manager.ts`** - Unified CLI for data operations (42KB)
- **`csv-pull/market-data/data/`** - CSV fallback data sources

### Data Flow Patterns

**Inbound**: APIs → dataProviders (with fallback) → Supabase → API endpoints
**Outbound**: Dashboard → API routes → confluenceEngine → Supabase → JSON response → Charts/Tables

### Supabase Architecture

**Dual Client Pattern**:
- `getSupabase()` - Lazy-initialized anon client (public operations)
- `getSupabaseAdmin()` - Service role client (admin operations, scripts)
- Located in: `src/lib/supabase.js`

**Key Tables**:
- `financial_data` - OHLCV data with category/symbol columns
- `astro_aspects` - Planetary aspects (conjunction, sextile, square, trine, opposition)
- `astro_events` - Ingresses, retrogrades, lunar phases
- `featured_tickers` - Pre-computed ratings for dashboard optimization

### External API Providers

**Rate-Limited Chain** (dataProviders.js handles fallback):
1. Polygon.io - 5 calls/min (equities, stress indicators)
2. CoinGecko - 10 calls/min (crypto)
3. CoinMarketCap - 30 calls/min (crypto)
4. AlphaVantage (equity, forex, commodity)
5. TwelveData (multi-asset)
6. FMP (equities)
7. FRED (macro economic)
8. ExchangeRate API (forex)
9. CSV fallbacks (last resort)

API keys stored in `.env.local` (see `.env` template).

## Core Concepts

### Confluence Scoring System

The heart of the application. Calculates how many independent technical indicators align at a price level:

**Components**:
- **Gann Octaves**: 1/8 divisions of swing ranges (e.g., 1/8, 2/8...7/8)
- **Fibonacci Levels**: Standard retracements (38.2%, 50%, 61.8%, etc.)
- **Support/Resistance**: Pivot-based calculations
- **Session Levels**: Previous/current day OHLC

**Scoring Formula**:
```
confluence_score = nearby_levels_count × 15 (capped at 100)
total_score = technical(70%) + fundamental(30%)
technical = confluence(30%) + proximity(25%) + momentum(20%) + trend(15%) + volatility(10%)
fundamental = seasonal(60%) + volume(40%)
```

**Output**:
- Rating: A+ to F
- Confidence: very_high to very_low
- Recommendation: strong_buy to strong_sell
- Projection: reach_date, earliest/latest dates, probability

### Astronomical Integration

Tracks 7 celestial bodies (Sun, Moon, Mercury-Saturn) for market correlation analysis:
- **Ingresses**: Zodiac sign transitions
- **Aspects**: Angular relationships between planets (0°, 60°, 90°, 120°, 180°)
- **Lunar Phases**: New/Full/Quarter moons
- **Retrogrades**: Apparent backward motion periods

Precomputed from Dec 21, 2004 → Present via `astronomy-engine` npm package.

**Seasonal Score**: Base 50, boosted for "favorable" ingress periods, contributes to fundamental score.

### Batch Optimization Pattern

**Problem**: Fetching price history for 100+ tickers = 100+ API calls
**Solution**: `confluenceEngine.fetchBulkPriceHistory()` - Single Supabase query returns all symbols in a category

Used by `/api/chart-data` and `/api/ticker-ratings` for performance.

## Coding Standards & Preferences

### Code Style
- **Always use TypeScript** for new code (prefer `.ts`/`.tsx` over `.js`/`.jsx`)
- **Follow Next.js App Router conventions** - Use Server Components by default, Client Components only when needed
- **Prefer functional components with hooks** - No class components
- **Use Tailwind for all styling** - Avoid custom CSS files unless absolutely necessary
- **Add error handling to all API routes** - Use try/catch with appropriate error responses
- **Include loading states for async operations** - Show feedback to users during data fetches

### Component Patterns
- Server Components for data fetching
- Client Components (`'use client'`) only for interactivity, hooks, or browser APIs
- Use `loading.tsx` and `error.tsx` for route-level states
- Prefer composition over prop drilling (use Context for shared state)

### API Route Standards
- Return JSON with consistent error structure
- Include appropriate HTTP status codes
- Log errors for debugging
- Handle rate limiting for external APIs
- Use `getSupabaseAdmin()` for database operations in API routes

### Performance Considerations
- Minimize client-side JavaScript bundles
- Use React.memo() for expensive components
- Implement pagination for large datasets
- Leverage Supabase RLS (Row Level Security) for data filtering

## Important Conventions

### DO NOT CHANGE - Production Critical
⚠️ **These elements are in production and should NOT be modified without explicit approval:**

1. **Database schema** - Supabase tables, columns, relationships are live
2. **Existing cron job logic** - GitHub Actions workflows and scheduled tasks
3. **Core calculation algorithms** - Confluence scoring, Gann/Fibonacci calculations (unless explicitly optimizing with approval)
4. **API route contracts** - Existing endpoint parameters and response formats (clients may depend on them)

If changes are needed to these areas, discuss the approach first before implementing.

### System Directories - ALWAYS ALLOWED
**IMPORTANT**: The following directories contain system configuration and are always safe to access:
- `~/Dev/Essentials/` and all its contents
- `~/Dev/Essentials/Configs/dotfigs/` - Centralized dotfiles (`.gitconfig`, `.zshrc`, etc.)

These contain global configurations that may need to be referenced or updated during development.

### Archived Files - DO NOT USE
**CRITICAL**: Any files or directories with `_unused` or `saved-unused` in their name are archived and must be completely ignored. These are not part of the active codebase.

- Never import from these directories
- Never reference code within them
- Never suggest moving code from them into active files
- Do not include them in searches or analysis
- They exist only for historical reference

Examples: `_unused/`, `saved-unused/`, `component_unused.tsx`, etc.

### Path Aliases
- `@/` → `./src/`
- Example: `import { getSupabase } from '@/lib/supabase'`

### File Naming
- Components: PascalCase (e.g., `AppSidebar.tsx`)
- Utilities/Libs: camelCase (e.g., `dataProviders.js`)
- Hooks: kebab-case with `use-` prefix (e.g., `use-theme.ts`)

### API Route Patterns
All routes in `src/app/api/`:
- Return JSON with error handling
- Use `getSupabaseAdmin()` for database operations
- Include rate limiting comments for external APIs
- Handle CORS for ingress endpoints

### Data Freshness Strategy
1. **Primary**: Supabase `financial_data` table (updated via cron)
2. **Fallback 1**: Real-time API call via dataProviders
3. **Fallback 2**: CSV files in `csv-pull/`
4. **Verification**: `npm run data:check` validates coverage

### Context Usage
- **ThemeContext**: Dark/light/system mode (persisted via `next-themes`)
- **SidebarContext**: Sidebar variant/collapsible/side configuration
- Both provided in root layout (`src/app/layout.tsx`)

## Testing & Development

### Running a Single Feature
Navigate to dashboard sections via `localhost:3000/dashboard/[section]`:
- `/1watchlist` - Featured tickers overview
- `/2charts` - Multi-asset trend visualization
- `/3calendar` - Astronomical events calendar
- `/4alerts` - Price alerts
- `/5news` - Market news feed

### Testing API Endpoints
```bash
# Test ticker ratings
curl "http://localhost:3000/api/ticker-ratings?symbols=AAPL,GOOGL&mode=batch"

# Test chart data
curl "http://localhost:3000/api/chart-data?category=equity&days=30"

# Test cron refresh (force recalculation)
curl "http://localhost:3000/api/cron-refresh-ratings"
```

### Database Testing
```bash
# Check if data is loaded
npm run data:check

# Reload fresh data from CSVs
npm run data:load

# Update current prices
npm run data:prices

# Repopulate featured tickers with new scores
npm run data:featured
```

## Common Development Tasks

### Adding a New Asset Category
1. Update `src/app/(dashboard)/data/` with new category export
2. Add provider mapping in `dataProviders.js` (symbol format, API endpoint)
3. Add CSV fallback in `csv-pull/market-data/data/[category]/`
4. Update `scripts/data-manager.ts` to include new category in bulk operations
5. Add Supabase row-level security if needed

### Adding a New Technical Indicator
1. Implement calculation in `src/lib/indicators/keyLevels.ts`
2. Integrate into `confluenceEngine.calculateTickerRating()`
3. Update scoring weights if needed
4. Test with `npm run data:featured` to regenerate ratings

### Modifying the Scoring Formula
1. Edit `src/lib/services/confluenceEngine.ts`
2. Update weight constants (currently 70% technical, 30% fundamental)
3. Clear cached ratings: `npm run cron:refresh-ratings`
4. Verify with `/api/ticker-ratings?symbols=TEST&mode=batch`

### Adding New API Providers
1. Add credentials to `.env.local`
2. Implement fetch function in `dataProviders.js`
3. Add to fallback chain with rate limit documentation
4. Update `scripts/data-manager.ts` to use new provider

## Configuration Files

- **`.env.local`** - API keys, Supabase credentials (not in git)
- **`.env`** - Template with key names (committed)
- **`next.config.ts`** - Turbopack, image optimization, webpack exclusions
- **`tsconfig.json`** - Path aliases, strict mode, ES2017 target
- **`components.json`** - Shadcn UI configuration (aliases, RSC settings)

## Architecture Audit Guidelines

When performing architecture reviews or refactoring analysis, focus on:

### API Routes Audit
- Check for duplicate patterns across `/src/app/api/*` routes
- Identify opportunities for shared middleware or utilities
- Verify consistent error handling and response formats
- Look for opportunities to consolidate similar endpoints

### Supabase Client Usage
- Ensure correct usage of `getSupabase()` (anon) vs `getSupabaseAdmin()` (admin)
- Check for singleton pattern compliance (lazy initialization)
- Identify any direct Supabase instantiations that should use the factory
- Verify Row Level Security policies are leveraged

### Component Performance
- Identify unnecessary re-renders (use React DevTools Profiler approach)
- Check for missing `React.memo()` on expensive components
- Look for prop drilling that should use Context
- Verify proper use of `useCallback` and `useMemo`

### Error Handling
- Ensure all API routes have try/catch blocks
- Check for consistent error response structure
- Verify client-side error boundaries exist
- Look for unhandled promise rejections

### TypeScript Quality
- Identify `any` types that should be specific
- Check for missing type definitions on functions
- Verify proper use of generics
- Look for implicit types that should be explicit

## Troubleshooting

### Build Errors
- Verify `.env.local` exists with all required keys
- Check that `_unused/` folders are excluded in `next.config.ts`
- Run `npm install` to ensure dependencies are current

### Missing Price Data
1. Run `npm run data:check` to identify gaps
2. If APIs are down, verify CSV fallbacks exist
3. Force refresh: `npm run data:prices`
4. Check rate limits in dataProviders.js comments

### Supabase Connection Issues
- Verify `NEXT_PUBLIC_SUPABASE_URL` and keys in `.env.local`
- Check if using correct client (anon vs admin)
- Ensure Row Level Security policies allow operation

### Slow Dashboard Performance
- Featured tickers may need refresh: `npm run data:featured`
- Check if bulk optimization is used (not per-ticker API calls)
- Verify `fetchBulkPriceHistory()` is called for multi-symbol queries
