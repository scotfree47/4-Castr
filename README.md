# Astrological Trading Dashboard

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)

![Dashboard Preview](public/dashboard-dark.png)

A professional financial market analysis platform combining W.D. Gann's astrological methodologies with modern technical indicators. Built for traders who understand planetary cycles, seasonal anchors, and Fibonacci confluence as edge factors in equity, crypto, forex, and commodity markets.

Built on [ShadCN Dashboard Template](https://github.com/silicondeck/shadcn-dashboard-landing-template) - Modern, responsive UI powered by shadcn/ui and Tailwind CSS.

---

## 🌟 Live Features

Experience real-time market intelligence:

- **📊 Multi-Asset Dashboard** - Track equities, crypto, forex, commodities with unified analytics
- **🌙 Gann Cycle Analysis** - Planetary aspects, lunar phases, seasonal anchors aligned to price action
- **📈 Technical Confluence** - Fibonacci retracements, confidence scoring, post-reversal detection
- **🎨 Glassmorphism UI** - Professional interface with dark/light modes and customizable themes

---

## ✨ What's Included

🎯 **Complete Trading Intelligence:**

- **Multi-Asset Coverage** - 100+ symbols across equities, crypto, forex, commodities, and macro indicators
- **Gann Methodology** - 18-year lunar cycles, planetary ingresses, retrogrades, aspects (conjunctions, squares, oppositions)
- **Technical Analysis** - Fibonacci levels, confidence scoring, convergence detection
- **Automated Data Pipeline** - CSV batch processing, scheduled price updates, featured ticker rotation

⚡ **Production-Ready Stack:**

- **Next.js 16** - App Router with TypeScript, optimized for Vercel deployment
- **shadcn/ui v3** - Modern component library with Radix UI primitives
- **Tailwind CSS v4** - Utility-first styling with glassmorphism design system
- **Supabase Ready** - Database schema prepared for user authentication and portfolio tracking

🎨 **Advanced UI/UX:**

- **Live Theme Customization** - Real-time color and layout switching
- **Responsive Design** - Mobile-first with optimized touch interactions
- **Dark/Light Modes** - Seamless theme transitions with glassmorphism effects
- **Professional Charts** - Recharts integration with custom Gann cycle overlays

---

## 🚀 Key Features

### 📊 **Market Analysis**

- **Featured Tickers** - Top-rated symbols by confidence score across all asset classes
- **Post-Reversal Detection** - Identify symbols showing bullish/bearish trend changes
- **Convergence Forecasting** - Multi-factor alignment of Gann dates + Fibonacci levels
- **Trading Windows** - Optimal entry/exit timing based on planetary cycle confluence

### 🌙 **Gann Methodology**

- **Seasonal Anchors** - Solstices, equinoxes as primary cycle markers
- **Planetary Aspects** - Geocentric angular relationships (0°, 90°, 120°, 180°)
- **Lunar Analysis** - 18.6-year Saros cycle, monthly phases, void-of-course periods
- **Ingress Events** - Planet-to-zodiac sign transitions with market correlation
- **Fibonacci Integration** - Retracement levels calculated from anchor dates

### ⚡ **Data Infrastructure**

- **Multi-Source Aggregation** - Yahoo Finance, Polygon, CoinGecko, Alpha Vantage, FRED
- **Automated Pipeline** - Scheduled updates via cron jobs or Vercel Cron
- **CSV Processing** - Batch historical data with astronomy-engine calculations
- **Confidence Scoring** - Python-based multi-factor weighting system
- **API Routes** - REST endpoints for chart data, ratings, featured symbols

---

## 🏗️ Project Structure

```text
📁 astrological-trading-dashboard/
├── 📁 src/
│   ├── 📁 app/
│   │   ├── 📁 (dashboard)/         # Main dashboard pages
│   │   ├── 📁 landing/             # Marketing landing page
│   │   ├── 📁 (auth)/              # Authentication (sign-in, sign-up, recovery)
│   │   └── 📁 api/                 # API routes
│   │       ├── 📄 chart-data/      # OHLC + technical indicators
│   │       ├── 📄 ticker-ratings/  # Confidence scores with Gann alignment
│   │       ├── 📄 featured-tickers/ # Top-rated symbols by category
│   │       ├── 📄 post-reversal-tickers/ # Trend reversal detection
│   │       └── 📄 astro/           # Astronomical event data
│   ├── 📁 components/
│   │   ├── 📁 ui/                  # shadcn/ui components
│   │   ├── 📁 layouts/             # Layout wrappers
│   │   └── 📁 theme-customizer/    # Live theme editor
│   ├── 📁 lib/
│   │   ├── 📁 indicators/          # Technical analysis utilities
│   │   ├── 📁 services/            # Data fetching services
│   │   └── 📁 ai/                  # AI analysis (future)
│   ├── 📁 contexts/                # React contexts (theme, sidebar)
│   └── 📁 types/                   # TypeScript definitions
│
├── 📁 csv-pull/market-data/        # Data pipeline
│   ├── 📁 data/
│   │   ├── 📁 astro/               # Lunar phases, aspects, ingresses, retrogrades
│   │   ├── 📁 scores/              # Confidence scores, featured symbols
│   │   ├── 📁 fibonacci/           # Retracement levels
│   │   └── 📁 [asset-classes]/     # Price data (equities, crypto, forex, commodities)
│   ├── 📁 src/
│   │   ├── 📁 fetchers/            # API integrations (Polygon, CoinGecko, FMP, etc.)
│   │   ├── 📁 gann/                # Gann cycle calculations
│   │   ├── 📁 config/              # Symbols, dates, API sources
│   │   ├── 📄 fetch_astro_data.py  # Astronomy-engine wrapper
│   │   └── 📄 calculate_confidence_scores.py # Multi-factor scoring
│   └── 📄 package.json             # Pipeline dependencies
│
├── 📁 scripts/                     # Data management scripts
│   ├── 📄 data-manager.ts          # CLI for data operations
│   └── 📄 precompute-astro.cjs     # Pre-compute astronomical events
│
├── 📁 session-notes/               # Development session logs (gitignored)
└── 📄 package.json                 # Main project dependencies
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+
- **Python** 3.8+ (for astronomical calculations)
- **pnpm** (recommended) or npm

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd astrological-trading-dashboard
pnpm install
```

### 2. Configure Environment

Create `.env.local`:

```bash
# Required for price data
YAHOO_FINANCE_API_KEY=your_key_here
POLYGON_API_KEY=your_key_here
ALPHA_VANTAGE_API_KEY=your_key_here

# Optional: Supabase (for user auth)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Initialize Data

```bash
# Install Python dependencies for astronomy calculations
cd csv-pull/market-data
pip install -r requirements.txt --break-system-packages
cd ../..

# Initialize market universe and load historical data
pnpm run data:init        # Set up initial symbol universe
pnpm run data:load        # Load all CSV data
pnpm run data:featured    # Populate featured tickers
```

### 4. Start Development

```bash
pnpm dev
```

**Access at:** `http://localhost:3000`

- **Dashboard:** `/dashboard` - Main trading interface
- **Landing:** `/landing` - Marketing page
- **Featured Tickers:** Navigate categories (equities, crypto, forex, commodities)
- **Theme Customizer:** Toggle glassmorphism effects and color schemes

---

## 📊 Data Management

### Daily Operations

```bash
pnpm run data:prices      # Update latest price data for all symbols
pnpm run data:check       # Check data freshness across asset classes
pnpm run data:featured    # Refresh featured ticker rankings
```

### Maintenance & Backfill

```bash
pnpm run data:backfill -- --days=365  # Backfill historical prices
pnpm run data:ingress     # Check upcoming planetary ingresses
```

### Automated Updates (Cron)

```bash
pnpm run cron:prices      # Scheduled price updates (daily)
pnpm run cron:featured    # Scheduled featured refresh (weekly)
```

**For Vercel Deployment:** Configure `vercel.json` with cron schedules or use external cron service.

---

## 🎨 Customization

### Theme Customization

- **Live Editor:** Click theme icon in dashboard header
- **Presets:** 10+ color schemes with glassmorphism variants
- **Layout Options:** Sidebar collapsible, floating, or fixed
- **Mode:** Dark, light, or system preference

### Gann Configuration

Edit `csv-pull/market-data/src/config/gannDates.js`:

```javascript
export const SEASONAL_ANCHORS = {
  winterSolstice: '12-21',
  vernalEquinox: '03-20',
  summerSolstice: '06-21',
  autumnalEquinox: '09-22'
};

export const PLANETARY_ASPECTS = [0, 60, 90, 120, 180]; // Degrees
```

### Symbol Universe

Edit `csv-pull/market-data/src/config/symbols.js` to add/remove tracked assets.

---

## 🛠️ Technology Stack

### Frontend

- **Next.js 16** - React framework with App Router
- **TypeScript 5** - Type-safe development
- **Tailwind CSS 4** - Utility-first styling
- **shadcn/ui v3** - Component library
- **Radix UI** - Accessible primitives
- **Recharts** - Data visualization
- **Framer Motion** - Animations

### Data & Analysis

- **astronomy-engine** - Planetary position calculations
- **technicalindicators** - RSI, MACD, Bollinger Bands
- **yahoo-finance2** - Price data fetching
- **papaparse** - CSV processing
- **danfojs-node** - DataFrame operations
- **csv-writer** - Data export

### Backend & Infrastructure

- **Supabase** - Database (optional, schema ready)
- **Vercel** - Deployment platform
- **Python 3.8+** - Astronomical calculations
- **Node.js 18+** - Runtime environment

---

## 📈 W.D. Gann Methodology

This platform implements Gann's principles for market timing:

### Core Concepts

1. **Time = Price** - Market movements correlate to planetary cycles
2. **Seasonal Anchors** - Solstices/equinoxes as major turning points
3. **Angular Relationships** - 0°, 90°, 120°, 180° planetary aspects
4. **Fibonacci Confluence** - Price retracements from cycle dates
5. **Lunar Dominance** - 18.6-year Saros cycle influences

### Implementation

- **Aspect Calculation:** Geocentric positions via astronomy-engine
- **Scoring System:** Multi-factor weighting (proximity to anchor, aspect strength, Fibonacci touch)
- **Confidence Levels:** 0-100 scale combining time cycles + price levels
- **Trading Windows:** Optimal entry zones when 3+ factors converge

### Historical Performance

Gann's methods require:
- Long observation periods (18+ month cycles)
- Confluence confirmation (never single-factor)
- Risk management (stop losses independent of astrology)

**Disclaimer:** Astrological analysis is supplementary to fundamental/technical research. Past performance ≠ future results.

---

## 🎯 Use Cases

### **For Traders**

- Identify high-probability reversal zones
- Time entries/exits using planetary cycles
- Screen multi-asset universe for confluence setups
- Track featured symbols with strongest Gann alignment

### **For Researchers**

- Backtest Gann methodologies on historical data
- Analyze correlation between planetary aspects and market moves
- Export CSV data for custom analysis in Python/R
- Compare traditional technicals vs. astrological signals

### **For Developers**

- Learn Next.js 16 App Router architecture
- Study shadcn/ui component patterns
- Implement glassmorphism design systems
- Build data pipelines with TypeScript + Python

---

## 🤝 Contributing

Contributions welcome! Here's how:

### Ways to Contribute

- 🐛 **Bug Reports** - Found an issue? Open an issue
- 💡 **Feature Requests** - Suggest new Gann indicators or data sources
- 🔧 **Pull Requests** - Fix bugs or add features
- 📖 **Documentation** - Improve setup guides or methodology explanations
- ⭐ **Star the Repo** - Show support for the project

### Getting Started

1. Fork the repository
2. Create feature branch: `git checkout -b feature/gann-enhancement`
3. Make changes and test thoroughly
4. Commit: `git commit -m "Add [feature description]"`
5. Push: `git push origin feature/gann-enhancement`
6. Open Pull Request with detailed description

### Code Standards

- Use **TypeScript** for all new code
- Follow **ESLint** and **Prettier** configs
- Add **JSDoc comments** for complex Gann calculations
- Write **unit tests** for scoring algorithms (future)
- Update **session-notes/** with implementation details

---

## 📄 License

MIT License - see [LICENSE.md](License.md) for details.

**You are free to:**

- ✅ Use commercially for trading strategies
- ✅ Modify Gann calculations and scoring
- ✅ Deploy to your own infrastructure
- ✅ Sell services/products built on this platform

**Attribution to original ShadCN template appreciated but not required.**

---

## 🙏 Credits & Acknowledgments

### Core Technologies

- **[shadcn/ui](https://ui.shadcn.com)** - Component foundation
- **[ShadCN Dashboard Template](https://github.com/silicondeck/shadcn-dashboard-landing-template)** - Base template
- **[astronomy-engine](https://github.com/cosinekitty/astronomy)** - Planetary calculations
- **[Tailwind CSS](https://tailwindcss.com)** - Styling framework
- **[Radix UI](https://www.radix-ui.com)** - Accessible primitives
- **[Recharts](https://recharts.org)** - Charting library

### Data Sources

- **Yahoo Finance** - Primary price data
- **Polygon.io** - Real-time market data
- **CoinGecko** - Cryptocurrency prices
- **Alpha Vantage** - Technical indicators
- **FRED** - Macro economic data

### Methodology

- **William Delbert Gann** - Astrological market timing pioneer
- **Fibonacci** - Mathematical ratios in nature and markets
- **Bradley Cowan** - Modern Gann research

---

## 📞 Support

### Get Help

- 📖 **Documentation** - This README and session-notes/
- 🐛 **Issues** - Report bugs via GitHub Issues
- 💬 **Discussions** - Ask questions in GitHub Discussions

### Resources

- 📚 **Gann Study** - [Sacred Science Institute](https://sacredscience.com)
- 🎓 **Astronomy Basics** - [astronomy-engine docs](https://github.com/cosinekitty/astronomy)
- 🎨 **shadcn/ui** - [Official documentation](https://ui.shadcn.com)
- ⚡ **Next.js 16** - [App Router guide](https://nextjs.org/docs)

---

<div align="center">

**⭐ Star this repo if you find Gann analysis valuable!**

[![Built with ShadCN](https://img.shields.io/badge/Built%20with-ShadCN-blue?style=for-the-badge)](https://ui.shadcn.com)
[![Gann Methodology](https://img.shields.io/badge/Methodology-W.D.%20Gann-purple?style=for-the-badge)](https://en.wikipedia.org/wiki/William_Delbert_Gann)

_Professional trading dashboard combining astrological cycles with modern technical analysis._

**Disclaimer:** This platform is for educational and research purposes. Astrological market analysis does not guarantee trading profits. Always conduct independent research and use proper risk management.

</div>
