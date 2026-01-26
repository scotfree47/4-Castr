// scripts/data-manager.ts
// COMPLETE CONSOLIDATED VERSION - All features unified
// Usage: npx tsx scripts/data-manager.ts [command] [options]

import { createClient } from "@supabase/supabase-js"
import axios from "axios"
import { parse } from "csv-parse/sync"
import dotenv from "dotenv"
import * as fs from "fs"
import Papa from "papaparse"
import path from "path"
import { fileURLToPath } from "url"

// ============================================================================
// ENVIRONMENT SETUP
// ============================================================================

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, "..")

dotenv.config({ path: path.join(projectRoot, ".env.scripts") })
dotenv.config({ path: path.join(projectRoot, ".env.local") })
dotenv.config({ path: path.join(projectRoot, ".env") })

const DATA_DIR = process.env.DATA_DIR || path.join(projectRoot, "csv-pull/market-data/data")

const requiredEnvVars = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`)
    console.error(`   Make sure it's set in .env.local or .env`)
    process.exit(1)
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface CSVMapping {
  csvPath: string
  tableName: string
  columnMapping: Record<string, string>
  transform?: (row: any) => any
}

interface APIProvider {
  name: string
  categories: string[]
  priority: number
  rateLimit: { calls: number; period: number }
  enabled: () => boolean
  fetch: (symbol: string, category: string) => Promise<number | null>
}

// ============================================================================
// CONFIGURATION
// ============================================================================

// ============================================================================
// COMPREHENSIVE TICKER LIST (1,029 symbols across 6 categories)
// ============================================================================

const CATEGORY_MAP = {
  // EQUITIES: 500 symbols (S&P 500 core holdings + high-volume stocks)
  equity: [
    // Market Indices & ETFs (3)
    "SPY",
    "QQQ",
    "DIA",
    // Mega Cap Tech (20)
    "AAPL",
    "MSFT",
    "GOOGL",
    "AMZN",
    "NVDA",
    "META",
    "TSLA",
    "AVGO",
    "ORCL",
    "CSCO",
    "ADBE",
    "CRM",
    "INTC",
    "AMD",
    "IBM",
    "QCOM",
    "TXN",
    "INTU",
    "NOW",
    "PANW",
    // Financials (40)
    "BRK.B",
    "JPM",
    "V",
    "MA",
    "BAC",
    "WFC",
    "GS",
    "MS",
    "C",
    "AXP",
    "BLK",
    "SCHW",
    "CB",
    "PGR",
    "MMC",
    "AON",
    "ICE",
    "CME",
    "SPGI",
    "MCO",
    "COF",
    "USB",
    "PNC",
    "TFC",
    "TRV",
    "ALL",
    "MET",
    "PRU",
    "AIG",
    "AFL",
    "HIG",
    "FITB",
    "KEY",
    "RF",
    "CFG",
    "MTB",
    "HBAN",
    "CMA",
    "ZION",
    "WBS",
    // Healthcare (50)
    "UNH",
    "JNJ",
    "LLY",
    "ABBV",
    "MRK",
    "TMO",
    "ABT",
    "DHR",
    "PFE",
    "BMY",
    "AMGN",
    "CVS",
    "MDT",
    "GILD",
    "CI",
    "ISRG",
    "REGN",
    "VRTX",
    "ZTS",
    "HUM",
    "BSX",
    "SYK",
    "ELV",
    "MCK",
    "COR",
    "IDXX",
    "HCA",
    "DXCM",
    "BDX",
    "EW",
    "RMD",
    "MTD",
    "IQV",
    "A",
    "ALGN",
    "HOLX",
    "PODD",
    "BAX",
    "WAT",
    "TECH",
    "DGX",
    "MOH",
    "TFX",
    "STE",
    "GEHC",
    "RVTY",
    "SOLV",
    "VTRS",
    "OGN",
    "ZBH",
    // Consumer Discretionary (50)
    "AMZN",
    "TSLA",
    "HD",
    "MCD",
    "NKE",
    "SBUX",
    "LOW",
    "TJX",
    "BKNG",
    "CMG",
    "ORLY",
    "MAR",
    "GM",
    "F",
    "HLT",
    "AZO",
    "YUM",
    "DHI",
    "ROST",
    "LEN",
    "APTV",
    "DG",
    "DLTR",
    "BBY",
    "ULTA",
    "GPC",
    "LVS",
    "WYNN",
    "MGM",
    "EXPE",
    "RL",
    "TPR",
    "NVR",
    "PHM",
    "LEN.B",
    "TOL",
    "KBH",
    "MTH",
    "BZH",
    "TMHC",
    "MHO",
    "LGIH",
    "DFH",
    "CCS",
    "GRBK",
    "HOV",
    "CVCO",
    "JOE",
    "RH",
    "POOL",
    // Consumer Staples (30)
    "WMT",
    "PG",
    "COST",
    "KO",
    "PEP",
    "PM",
    "MDLZ",
    "MO",
    "CL",
    "GIS",
    "KMB",
    "SYY",
    "MNST",
    "KHC",
    "K",
    "HSY",
    "CAG",
    "CPB",
    "HRL",
    "TSN",
    "KR",
    "SJM",
    "TAP",
    "STZ",
    "BF.B",
    "MKC",
    "LW",
    "POST",
    "SMPL",
    "CALM",
    // Energy (40)
    "XOM",
    "CVX",
    "COP",
    "SLB",
    "EOG",
    "MPC",
    "PSX",
    "VLO",
    "OXY",
    "PXD",
    "WMB",
    "KMI",
    "HAL",
    "HES",
    "DVN",
    "FANG",
    "BKR",
    "TRGP",
    "EQT",
    "LNG",
    "MRO",
    "APA",
    "CTRA",
    "OVV",
    "RIG",
    "NOV",
    "FTI",
    "CLB",
    "HP",
    "PTEN",
    "LBRT",
    "WHD",
    "WTTR",
    "VAL",
    "NBR",
    "TDW",
    "NINE",
    "PUMP",
    "ACDC",
    "HLX",
    // Industrials (60)
    "UNP",
    "CAT",
    "HON",
    "UPS",
    "RTX",
    "GE",
    "LMT",
    "BA",
    "MMM",
    "DE",
    "ADP",
    "WM",
    "GD",
    "ITW",
    "NOC",
    "ETN",
    "EMR",
    "FDX",
    "TT",
    "PH",
    "CSX",
    "NSC",
    "PCAR",
    "CMI",
    "JCI",
    "CARR",
    "OTIS",
    "PWR",
    "FAST",
    "PAYX",
    "AME",
    "ROK",
    "DOV",
    "XYL",
    "FTV",
    "IEX",
    "VRSK",
    "HUBB",
    "SWK",
    "GNRC",
    "J",
    "DAL",
    "UAL",
    "AAL",
    "LUV",
    "JBLU",
    "ALK",
    "HA",
    "SAVE",
    "MESA",
    "SKYW",
    "RYAAY",
    "LCC",
    "UAVS",
    "BLBD",
    "ALGT",
    "ATSG",
    "AAWW",
    "SNCY",
    "GNK",
    // Materials (30)
    "LIN",
    "APD",
    "SHW",
    "ECL",
    "NEM",
    "FCX",
    "DOW",
    "DD",
    "NUE",
    "VMC",
    "MLM",
    "PPG",
    "CTVA",
    "ALB",
    "IFF",
    "CE",
    "FMC",
    "EMN",
    "CF",
    "MOS",
    "LYB",
    "BALL",
    "AVY",
    "SEE",
    "PKG",
    "IP",
    "WRK",
    "SON",
    "GPK",
    "SLVM",
    // Real Estate (30)
    "PLD",
    "AMT",
    "EQIX",
    "PSA",
    "WELL",
    "SPG",
    "DLR",
    "O",
    "CBRE",
    "AVB",
    "EQR",
    "SBAC",
    "VTR",
    "ARE",
    "INVH",
    "ESS",
    "MAA",
    "UDR",
    "CPT",
    "EXR",
    "DOC",
    "HST",
    "REG",
    "FRT",
    "KIM",
    "BXP",
    "VNO",
    "SLG",
    "AIV",
    "OUT",
    // Utilities (30)
    "NEE",
    "DUK",
    "SO",
    "D",
    "AEP",
    "EXC",
    "SRE",
    "XEL",
    "WEC",
    "ED",
    "ES",
    "PEG",
    "FE",
    "EIX",
    "PPL",
    "AWK",
    "DTE",
    "ETR",
    "CMS",
    "AEE",
    "CNP",
    "NI",
    "LNT",
    "EVRG",
    "ATO",
    "NWE",
    "PNW",
    "OGE",
    "AVA",
    "POR",
    // Communication Services (20)
    "META",
    "GOOGL",
    "NFLX",
    "DIS",
    "CMCSA",
    "T",
    "VZ",
    "TMUS",
    "CHTR",
    "EA",
    "TTWO",
    "MTCH",
    "NWSA",
    "FOXA",
    "IPG",
    "OMC",
    "PARA",
    "WBD",
    "DISH",
    "SIRI",
    // Additional High Volume Stocks (87)
    "ABNB",
    "ADSK",
    "AMAT",
    "ASML",
    "BIIB",
    "BKNG",
    "CDNS",
    "CHTR",
    "CPRT",
    "CRWD",
    "DDOG",
    "DOCU",
    "DXCM",
    "ENPH",
    "ETSY",
    "FICO",
    "FTNT",
    "HUBS",
    "ILMN",
    "KLAC",
    "LRCX",
    "LULU",
    "MCHP",
    "MELI",
    "MRNA",
    "NXPI",
    "OKTA",
    "PAYC",
    "PLTR",
    "PYPL",
    "RBLX",
    "SHOP",
    "SNPS",
    "SPOT",
    "SQ",
    "TEAM",
    "TWLO",
    "U",
    "UBER",
    "WDAY",
    "ZM",
    "ZS",
    "APA",
    "BABA",
    "BILI",
    "BIDU",
    "BEKE",
    "BYD",
    "CPNG",
    "DIDI",
    "JD",
    "LI",
    "NIO",
    "PDD",
    "TAL",
    "TCOM",
    "TME",
    "VIPS",
    "WB",
    "XPEV",
    "YUMC",
    "ARKK",
    "ARKG",
    "ARKW",
    "ARKF",
    "ARKX",
    "IBIT",
    "GBTC",
    "ETHE",
    "IWM",
    "EEM",
    "EFA",
    "VEA",
    "VWO",
    "AGG",
    "LQD",
    "HYG",
    "EMB",
    "TLT",
    "IEF",
    "SHY",
    "GLD",
    "SLV",
    "USO",
    "UNG",
    "DBA",
    "XLF",
  ],

  // COMMODITIES: 200 symbols (Futures, Metals, Agriculture, Energy)
  commodity: [
    // Precious Metals (20)
    "GC=F",
    "SI=F",
    "PL=F",
    "PA=F",
    "GLD",
    "SLV",
    "PPLT",
    "PALL",
    "IAU",
    "SIVR",
    "GLTR",
    "SGOL",
    "AAAU",
    "BAR",
    "PHYS",
    "PSLV",
    "CEF",
    "GTU",
    "CDE",
    "HL",
    // Base Metals (20)
    "HG=F",
    "ALI=F",
    "SCHN",
    "RS",
    "CMC",
    "NUE",
    "STLD",
    "X",
    "CLF",
    "MT",
    "TX",
    "CSTM",
    "WOR",
    "ATI",
    "HAYN",
    "SXC",
    "ZEUS",
    "KALU",
    "CENX",
    "AA",
    // Energy (40)
    "CL=F",
    "NG=F",
    "RB=F",
    "HO=F",
    "BZ=F",
    "USO",
    "UNG",
    "USL",
    "BNO",
    "UGA",
    "UHN",
    "NRGU",
    "ERX",
    "ERY",
    "XLE",
    "XOP",
    "VDE",
    "IXC",
    "IEO",
    "IYE",
    "FENY",
    "XES",
    "AMLP",
    "MLPA",
    "AMJ",
    "ENFR",
    "PXE",
    "PXJ",
    "FCG",
    "ICLN",
    "TAN",
    "QCLN",
    "ACES",
    "SMOG",
    "GRID",
    "PBW",
    "FAN",
    "RAYS",
    "HDRO",
    "HJEN",
    // Agriculture (60)
    "ZC=F",
    "ZS=F",
    "ZW=F",
    "ZL=F",
    "ZM=F",
    "ZO=F",
    "ZR=F",
    "GF=F",
    "HE=F",
    "LE=F",
    "KC=F",
    "CT=F",
    "SB=F",
    "CC=F",
    "OJ=F",
    "CORN",
    "SOYB",
    "WEAT",
    "CANE",
    "SGG",
    "JO",
    "NIB",
    "BAL",
    "TAGS",
    "DBA",
    "RJA",
    "MOO",
    "VEGI",
    "FTGC",
    "FUD",
    "ADM",
    "BG",
    "TSN",
    "CAG",
    "GIS",
    "K",
    "MKC",
    "CPB",
    "SJM",
    "HRL",
    "INGR",
    "POST",
    "FLO",
    "CALM",
    "SAFM",
    "PPC",
    "LMNR",
    "VITL",
    "JJSF",
    "FARM",
    "ANDE",
    "LANC",
    "GO",
    "SEB",
    "CVGW",
    "JBSS",
    "MRIN",
    "VFF",
    "APPH",
    "BYND",
    // Livestock (10)
    "COW",
    "BEEF",
    "HOGS",
    "MILK",
    "EGG",
    "CHKN",
    "TURK",
    "FISH",
    "SMON",
    "TUNA",
    // Softs & Misc (50)
    "WOOD",
    "LBS",
    "CUT",
    "PCH",
    "WDFC",
    "BCC",
    "UFPI",
    "WY",
    "RYN",
    "PCH",
    "LPX",
    "POPE",
    "LL",
    "DOOR",
    "FBHS",
    "MHK",
    "BLD",
    "SSD",
    "FND",
    "BECN",
    "AZEK",
    "TREX",
    "WOLF",
    "BOOT",
    "TILE",
    "KALU",
    "CSWC",
    "AMSF",
    "NGHC",
    "ABM",
    "JELD",
    "APOG",
    "AAON",
    "ROCK",
    "WTS",
    "ALG",
    "ACA",
    "STRL",
    "WDFC",
    "PTVE",
    "CRVL",
    "HWKN",
    "AMWD",
    "PRIM",
    "HIFS",
    "MATW",
    "PKE",
    "GVA",
    "MLI",
    "KOP",
  ],

  // CRYPTO: 200 symbols (Major coins + DeFi + NFT + Meme)
  crypto: [
    // Top 50 by Market Cap
    "Bitcoin",
    "Ethereum",
    "BNB",
    "Solana",
    "XRP",
    "Cardano",
    "Avalanche",
    "Dogecoin",
    "Polkadot",
    "TRON",
    "Polygon",
    "Litecoin",
    "Shiba-Inu",
    "Chainlink",
    "Bitcoin-Cash",
    "Uniswap",
    "Stellar",
    "Cosmos",
    "Monero",
    "Ethereum-Classic",
    "Filecoin",
    "Aptos",
    "Hedera",
    "Cronos",
    "VeChain",
    "Algorand",
    "Near-Protocol",
    "Internet-Computer",
    "Quant",
    "Aave",
    "The-Graph",
    "Fantom",
    "EOS",
    "Theta",
    "Tezos",
    "Axie-Infinity",
    "Flow",
    "Elrond",
    "Klaytn",
    "Decentraland",
    "The-Sandbox",
    "Zcash",
    "BitTorrent",
    "Maker",
    "NEO",
    "Kava",
    "IOTA",
    "Dash",
    "Kusama",
    "Compound",
    // DeFi Tokens (50)
    "Uniswap",
    "Aave",
    "Maker",
    "Compound",
    "Curve",
    "SushiSwap",
    "PancakeSwap",
    "dYdX",
    "Balancer",
    "Yearn-Finance",
    "Synthetix",
    "1inch",
    "Bancor",
    "Loopring",
    "0x",
    "RenVM",
    "Kyber-Network",
    "bZx",
    "Ampleforth",
    "UMA",
    "BadgerDAO",
    "Harvest-Finance",
    "Cream-Finance",
    "Alpha-Finance",
    "Venus",
    "Reef",
    "TrueFi",
    "Rari-Capital",
    "Vesper",
    "Idle",
    "mStable",
    "dForce",
    "Barnbridge",
    "APWine",
    "Saffron-Finance",
    "88mph",
    "Element-Finance",
    "Pendle",
    "Alchemix",
    "Liquity",
    "Reflexer",
    "Fei-Protocol",
    "Float-Protocol",
    "Euler",
    "Notional",
    "Ribbon-Finance",
    "Dopex",
    "Jones-DAO",
    "Redacted",
    "Olympus",
    // Layer 2 & Scaling (30)
    "Polygon",
    "Optimism",
    "Arbitrum",
    "Loopring",
    "ImmutableX",
    "zkSync",
    "StarkNet",
    "Metis",
    "Boba-Network",
    "Aztec",
    "Hermez",
    "Fuel",
    "Celer",
    "Hop-Protocol",
    "Connext",
    "Across",
    "Synapse",
    "Multichain",
    "Stargate",
    "LayerZero",
    "Wormhole",
    "Axelar",
    "Cbridge",
    "Gravity-Bridge",
    "Rainbow-Bridge",
    "Portal",
    "Allbridge",
    "O3-Swap",
    "Router-Protocol",
    "Rubic",
    // NFT & Metaverse (30)
    "Decentraland",
    "The-Sandbox",
    "Axie-Infinity",
    "Enjin",
    "Flow",
    "ImmutableX",
    "Gala",
    "WAX",
    "Theta",
    "ECOMI",
    "Ultra",
    "MyNeighborAlice",
    "Star-Atlas",
    "Wilder-World",
    "Bloktopia",
    "Victoria-VR",
    "Somnium-Space",
    "CryptoVoxels",
    "Netvrk",
    "Voxies",
    "BigTime",
    "Illuvium",
    "Ember-Sword",
    "Guild-of-Guardians",
    "Aurory",
    "DeFi-Kingdoms",
    "Crabada",
    "Farmers-World",
    "Alien-Worlds",
    "Splinterlands",
    // Meme & Community (20)
    "Dogecoin",
    "Shiba-Inu",
    "Floki",
    "SafeMoon",
    "Dogelon-Mars",
    "Baby-Doge",
    "Akita-Inu",
    "Kishu-Inu",
    "Hoge",
    "Saitama",
    "Mononoke-Inu",
    "Catecoin",
    "Pitbull",
    "Shih-Tzu",
    "Corgi",
    "Husky",
    "Pomeranian",
    "Dachshund",
    "Chihuahua",
    "Pug",
    // Exchange Tokens (20)
    "BNB",
    "FTX-Token",
    "Crypto-com-Coin",
    "Huobi-Token",
    "OKB",
    "KuCoin",
    "Gate-Token",
    "Bitfinex-LEO",
    "Gemini-Dollar",
    "MEXC-Token",
  ],

  // FOREX: 50 pairs (Majors, Minors, Exotics)
  forex: [
    // Major Pairs (8)
    "EUR/USD",
    "USD/JPY",
    "GBP/USD",
    "USD/CHF",
    "USD/CAD",
    "AUD/USD",
    "NZD/USD",
    "EUR/GBP",
    // Cross Pairs (20)
    "EUR/JPY",
    "GBP/JPY",
    "CHF/JPY",
    "EUR/CHF",
    "GBP/CHF",
    "AUD/JPY",
    "NZD/JPY",
    "CAD/JPY",
    "EUR/CAD",
    "GBP/CAD",
    "EUR/AUD",
    "GBP/AUD",
    "EUR/NZD",
    "GBP/NZD",
    "AUD/CAD",
    "AUD/NZD",
    "AUD/CHF",
    "NZD/CAD",
    "NZD/CHF",
    "CAD/CHF",
    // Exotic Pairs (22)
    "USD/SGD",
    "USD/HKD",
    "USD/ZAR",
    "USD/THB",
    "USD/MXN",
    "USD/NOK",
    "USD/SEK",
    "USD/DKK",
    "USD/PLN",
    "USD/TRY",
    "USD/BRL",
    "USD/CNY",
    "USD/INR",
    "USD/KRW",
    "USD/RUB",
    "USD/IDR",
    "EUR/TRY",
    "EUR/NOK",
    "EUR/SEK",
    "EUR/PLN",
    "GBP/ZAR",
    "AUD/SGD",
  ],

  // RATES-MACRO: 50 symbols (Bonds, Rates, Economic Indicators)
  "rates-macro": [
    // Treasury Bonds (15)
    "TLT",
    "IEF",
    "SHY",
    "TIP",
    "GOVT",
    "VGIT",
    "VGLT",
    "SCHO",
    "SCHR",
    "SPTS",
    "SPTL",
    "EDV",
    "BLV",
    "BSV",
    "BIV",
    // Interest Rates (10)
    "FEDFUNDS",
    "TNX",
    "IRX",
    "FVX",
    "TYX",
    "DGS10",
    "DGS2",
    "DGS5",
    "DGS30",
    "LIBOR",
    // Economic Indicators (25)
    "CPI",
    "PPI",
    "PCE",
    "GDP",
    "UNRATE",
    "PAYEMS",
    "INDPRO",
    "HOUST",
    "PERMIT",
    "RRSFS",
    "M1",
    "M2",
    "DFII10",
    "T10YIE",
    "T5YIFR",
    "DCOILWTICO",
    "DEXUSEU",
    "DEXJPUS",
    "DEXUSAL",
    "WILL5000IND",
    "NASDAQCOM",
    "SP500",
    "DJIA",
    "MORTGAGE30US",
    "MORTGAGE15US",
  ],

  // STRESS: 29 symbols (Volatility, Credit, Sentiment)
  stress: [
    // Volatility Indices (10)
    "VIX",
    "VXN",
    "RVX",
    "VVIX",
    "SKEW",
    "MOVE",
    "TYVIX",
    "GVZ",
    "OVX",
    "EVZ",
    // Credit & Risk (10)
    "HYG",
    "LQD",
    "JNK",
    "EMB",
    "BKLN",
    "FALN",
    "SHYG",
    "USHY",
    "ANGL",
    "SJNK",
    // Market Internals (9)
    "TRIN",
    "TICK",
    "ADD",
    "VOLD",
    "VOLU",
    "ADVN",
    "DECN",
    "UNCH",
    "NH-NL",
  ],
}

const PRICE_CSVS = {
  equity: "./csv-pull/market-data/data/equities/equities_solstice_equinox.csv",
  commodity: "./csv-pull/market-data/data/commodities/commodities_solstice_equinox.csv",
  crypto: "./csv-pull/market-data/data/crypto/crypto_solstice_equinox.csv",
  forex: "./csv-pull/market-data/data/forex/forex_solstice_equinox.csv",
  "rates-macro": "./csv-pull/market-data/data/rates-macro/rates_macro_solstice_equinox.csv",
  stress: "./csv-pull/market-data/data/stress/stress_solstice_equinox.csv",
}

const CSV_MAPPINGS: CSVMapping[] = [
  {
    csvPath: "./csv-pull/market-data/data/astro/aspects.csv",
    tableName: "astro_aspects",
    columnMapping: {
      date: "date",
      body1: "body1",
      body2: "body2",
      aspect_type: "aspect_type",
      aspect_nature: "aspect_nature",
      orb: "orb",
      exact: "exact",
      body1_sign: "body1_sign",
      body2_sign: "body2_sign",
      primary_scoring: "primary_scoring",
      bonus_eligible: "bonus_eligible",
      influence_weight: "influence_weight",
    },
  },
  {
    csvPath: "./csv-pull/market-data/data/astro/ingresses.csv",
    tableName: "astro_events",
    columnMapping: {
      date: "date",
      body: "body",
      sign: "sign",
      from_sign: "from_sign",
      ruler: "ruler",
      element: "element",
    },
    transform: (row: any) => ({
      date: row.date,
      event_type: "ingress",
      body: row.body,
      sign: row.sign,
      event_data: {
        from_sign: row.from_sign,
        ruler: row.ruler,
        element: row.element,
      },
      primary_scoring: row.body === "Sun",
      bonus_eligible: false,
    }),
  },
  {
    csvPath: "./csv-pull/market-data/data/equities/equities_solstice_equinox.csv",
    tableName: "financial_data",
    columnMapping: {
      Symbol: "symbol",
      Date: "date",
      Open: "open",
      High: "high",
      Low: "low",
      Close: "close",
      Volume: "volume",
    },
    transform: (row: any) => ({
      ...row,
      volume: row.volume ? parseInt(parseFloat(row.volume).toString()) : null,
      category: "equity",
      asset_type: "equity",
    }),
  },
  {
    csvPath: "./csv-pull/market-data/data/commodities/commodities_solstice_equinox.csv",
    tableName: "financial_data",
    columnMapping: {
      Commodity: "symbol",
      Date: "date",
      Price: "close",
      Unit: "unit",
    },
    transform: (row: any) => ({
      symbol: row.symbol,
      date: row.date,
      close: row.close,
      category: "commodity",
      asset_type: "commodity",
      metadata: { unit: row.unit },
    }),
  },
  {
    csvPath:
      "./csv-pull/market-data/data/forex-node_fetched/forex_solstice_equinox_node-fetched.csv",
    tableName: "financial_data",
    columnMapping: {
      Pair: "symbol",
      Date: "date",
      Rate: "close",
    },
    transform: (row: any) => ({
      symbol: row.symbol,
      date: row.date,
      close: row.close,
      category: "forex",
      asset_type: "forex",
    }),
  },
]

// ============================================================================
// API PROVIDERS
// ============================================================================

function mapCryptoSymbol(symbol: string): string {
  const map: Record<string, string> = {
    // Top 50
    Bitcoin: "bitcoin",
    BTC: "bitcoin",
    Ethereum: "ethereum",
    ETH: "ethereum",
    BNB: "binancecoin",
    Solana: "solana",
    SOL: "solana",
    XRP: "ripple",
    Cardano: "cardano",
    ADA: "cardano",
    Avalanche: "avalanche-2",
    AVAX: "avalanche-2",
    Dogecoin: "dogecoin",
    DOGE: "dogecoin",
    Polkadot: "polkadot",
    DOT: "polkadot",
    TRON: "tron",
    TRX: "tron",
    Polygon: "matic-network",
    MATIC: "matic-network",
    Litecoin: "litecoin",
    LTC: "litecoin",
    "Shiba-Inu": "shiba-inu",
    SHIB: "shiba-inu",
    Chainlink: "chainlink",
    LINK: "chainlink",
    "Bitcoin-Cash": "bitcoin-cash",
    BCH: "bitcoin-cash",
    Uniswap: "uniswap",
    UNI: "uniswap",
    Stellar: "stellar",
    XLM: "stellar",
    Cosmos: "cosmos",
    ATOM: "cosmos",
    Monero: "monero",
    XMR: "monero",
    "Ethereum-Classic": "ethereum-classic",
    ETC: "ethereum-classic",
    Filecoin: "filecoin",
    FIL: "filecoin",
    Aptos: "aptos",
    APT: "aptos",
    Hedera: "hedera-hashgraph",
    HBAR: "hedera-hashgraph",
    Cronos: "crypto-com-chain",
    CRO: "crypto-com-chain",
    VeChain: "vechain",
    VET: "vechain",
    Algorand: "algorand",
    ALGO: "algorand",
    "Near-Protocol": "near",
    NEAR: "near",
    "Internet-Computer": "internet-computer",
    ICP: "internet-computer",
    Quant: "quant-network",
    QNT: "quant-network",
    Aave: "aave",
    AAVE: "aave",
    "The-Graph": "the-graph",
    GRT: "the-graph",
    Fantom: "fantom",
    FTM: "fantom",
    EOS: "eos",
    Theta: "theta-token",
    THETA: "theta-token",
    Tezos: "tezos",
    XTZ: "tezos",
    "Axie-Infinity": "axie-infinity",
    AXS: "axie-infinity",
    Flow: "flow",
    FLOW: "flow",
    Elrond: "elrond-erd-2",
    EGLD: "elrond-erd-2",
    Klaytn: "klay-token",
    KLAY: "klay-token",
    Decentraland: "decentraland",
    MANA: "decentraland",
    "The-Sandbox": "the-sandbox",
    SAND: "the-sandbox",
    Zcash: "zcash",
    ZEC: "zcash",
    BitTorrent: "bittorrent",
    BTT: "bittorrent",
    Maker: "maker",
    MKR: "maker",
    NEO: "neo",
    Kava: "kava",
    IOTA: "iota",
    MIOTA: "iota",
    Dash: "dash",
    Kusama: "kusama",
    KSM: "kusama",
    Compound: "compound-governance-token",
    COMP: "compound-governance-token",
    // DeFi Tokens
    Curve: "curve-dao-token",
    CRV: "curve-dao-token",
    SushiSwap: "sushi",
    SUSHI: "sushi",
    PancakeSwap: "pancakeswap-token",
    CAKE: "pancakeswap-token",
    dYdX: "dydx",
    DYDX: "dydx",
    Balancer: "balancer",
    BAL: "balancer",
    "Yearn-Finance": "yearn-finance",
    YFI: "yearn-finance",
    Synthetix: "havven",
    SNX: "havven",
    "1inch": "1inch",
    Bancor: "bancor",
    BNT: "bancor",
    Loopring: "loopring",
    LRC: "loopring",
    "0x": "0x",
    ZRX: "0x",
    // Layer 2
    Optimism: "optimism",
    OP: "optimism",
    Arbitrum: "arbitrum",
    ARB: "arbitrum",
    ImmutableX: "immutable-x",
    IMX: "immutable-x",
    zkSync: "zksync",
    StarkNet: "starknet",
    Metis: "metis-token",
    METIS: "metis-token",
    // NFT & Metaverse
    Enjin: "enjincoin",
    ENJ: "enjincoin",
    Gala: "gala",
    WAX: "wax",
    ECOMI: "ecomi",
    OMI: "ecomi",
    // Meme tokens
    Floki: "floki",
    SafeMoon: "safemoon",
    "Dogelon-Mars": "dogelon-mars",
    ELON: "dogelon-mars",
    // Exchange tokens
    "FTX-Token": "ftx-token",
    FTT: "ftx-token",
    "Crypto-com-Coin": "crypto-com-chain",
    "Huobi-Token": "huobi-token",
    HT: "huobi-token",
    OKB: "okb",
    KuCoin: "kucoin-shares",
    KCS: "kucoin-shares",
  }
  return map[symbol] || symbol.toLowerCase().replace(/-/g, "-")
}

const API_PROVIDERS: APIProvider[] = [
  {
    name: "polygon",
    categories: ["equity", "stress"],
    priority: 1,
    rateLimit: { calls: 5, period: 60000 },
    enabled: () => !!process.env.POLYGON_API_KEY,
    fetch: async (symbol: string) => {
      const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true&apiKey=${process.env.POLYGON_API_KEY}`
      const res = await axios.get(url, { timeout: 10000 })
      return res.data?.results?.[0]?.c || null
    },
  },
  {
    name: "alpha_vantage",
    categories: ["equity", "forex", "commodity"],
    priority: 2,
    rateLimit: { calls: 5, period: 60000 },
    enabled: () => !!process.env.ALPHA_VANTAGE_API_KEY,
    fetch: async (symbol: string, category: string) => {
      if (category === "forex" && symbol.includes("/")) {
        const [from, to] = symbol.split("/")
        const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${from}&to_currency=${to}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`
        const res = await axios.get(url, { timeout: 10000 })
        return (
          parseFloat(res.data?.["Realtime Currency Exchange Rate"]?.["5. Exchange Rate"]) || null
        )
      }
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`
      const res = await axios.get(url, { timeout: 10000 })
      return parseFloat(res.data?.["Global Quote"]?.["05. price"]) || null
    },
  },
  {
    name: "coingecko",
    categories: ["crypto"],
    priority: 1,
    rateLimit: { calls: 10, period: 60000 },
    enabled: () => !!process.env.COINGECKO_API_KEY,
    fetch: async (symbol: string) => {
      const coinId = mapCryptoSymbol(symbol)
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&x_cg_demo_api_key=${process.env.COINGECKO_API_KEY}`
      const res = await axios.get(url, { timeout: 10000 })
      return res.data?.[coinId]?.usd || null
    },
  },
  {
    name: "coinmarketcap",
    categories: ["crypto"],
    priority: 2,
    rateLimit: { calls: 30, period: 60000 },
    enabled: () => !!process.env.COINMARKETCAP_API_KEY,
    fetch: async (symbol: string) => {
      const coinSymbol = symbol === "Bitcoin" ? "BTC" : symbol === "Ethereum" ? "ETH" : symbol
      const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${coinSymbol}`
      const res = await axios.get(url, {
        timeout: 10000,
        headers: { "X-CMC_PRO_API_KEY": process.env.COINMARKETCAP_API_KEY },
      })
      return res.data?.data?.[coinSymbol]?.quote?.USD?.price || null
    },
  },
  {
    name: "twelve_data",
    categories: ["equity", "forex", "commodity"],
    priority: 3,
    rateLimit: { calls: 8, period: 60000 },
    enabled: () => !!process.env.TWELVE_DATA_API_KEY,
    fetch: async (symbol: string, category: string) => {
      const url = `https://api.twelvedata.com/price?symbol=${symbol}&apikey=${process.env.TWELVE_DATA_API_KEY}`
      const res = await axios.get(url, { timeout: 10000 })
      return parseFloat(res.data?.price) || null
    },
  },
  {
    name: "fmp",
    categories: ["equity"],
    priority: 4,
    rateLimit: { calls: 5, period: 60000 },
    enabled: () => !!process.env.FMP_API_KEY,
    fetch: async (symbol: string) => {
      const url = `https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${process.env.FMP_API_KEY}`
      const res = await axios.get(url, { timeout: 10000 })
      return res.data?.[0]?.price || null
    },
  },
  {
    name: "exchangerate",
    categories: ["forex"],
    priority: 3,
    rateLimit: { calls: 10, period: 60000 },
    enabled: () => !!process.env.EXCHANGERATE_API_KEY,
    fetch: async (symbol: string) => {
      if (!symbol.includes("/")) return null
      const [from, to] = symbol.split("/")
      const url = `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGERATE_API_KEY}/pair/${from}/${to}`
      const res = await axios.get(url, { timeout: 10000 })
      return res.data?.conversion_rate || null
    },
  },
  {
    name: "fred",
    categories: ["rates-macro"],
    priority: 1,
    rateLimit: { calls: 10, period: 60000 },
    enabled: () => !!process.env.FRED_API_KEY,
    fetch: async (symbol: string) => {
      const seriesMap: Record<string, string> = {
        FEDFUNDS: "DFF",
        CPI: "CPIAUCSL",
      }
      const seriesId = seriesMap[symbol]
      if (!seriesId) return null

      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${process.env.FRED_API_KEY}&file_type=json&sort_order=desc&limit=1`
      const res = await axios.get(url, { timeout: 10000 })
      return parseFloat(res.data?.observations?.[0]?.value) || null
    },
  },
]

// ============================================================================
// RATE LIMITER
// ============================================================================

class RateLimiter {
  private callHistory: Map<string, number[]> = new Map()

  async throttle(provider: APIProvider): Promise<void> {
    const now = Date.now()
    const history = this.callHistory.get(provider.name) || []
    const validCalls = history.filter((time) => now - time < provider.rateLimit.period)

    if (validCalls.length >= provider.rateLimit.calls) {
      const oldestCall = validCalls[0]
      const waitTime = provider.rateLimit.period - (now - oldestCall) + 100
      if (waitTime > 0) {
        console.log(`   ⏳ Rate limit: waiting ${Math.ceil(waitTime / 1000)}s for ${provider.name}`)
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      }
    }

    validCalls.push(Date.now())
    this.callHistory.set(provider.name, validCalls)
  }

  reset(): void {
    this.callHistory.clear()
  }
}

const rateLimiter = new RateLimiter()

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseCSV(filePath: string): any[] {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  CSV not found: ${filePath}`)
    return []
  }

  const content = fs.readFileSync(filePath, "utf-8")
  const cleanedContent = content
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n")

  const parsed = Papa.parse<any>(cleanedContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  })

  return (parsed.data as any[]).filter(
    (row: any) => row.symbol || row.Symbol || row.Commodity || row.Pair || row.Indicator
  )
}

function getLatestPrice(symbol: string, category: string): { price: number; date: string } | null {
  const categoryKey = category === "commodity" ? "commodity" : category
  const csvPath = PRICE_CSVS[categoryKey as keyof typeof PRICE_CSVS]

  if (!csvPath || !fs.existsSync(csvPath)) return null

  const data = parseCSV(csvPath)
  const symbolData = data.filter((row: any) => {
    const rowSymbol = row.Symbol || row.Commodity || row.Pair
    return rowSymbol === symbol
  })

  if (symbolData.length === 0) return null

  const sorted = symbolData.sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime())
  const latest = sorted[0]

  return {
    price: latest.Close || latest.Price || latest.Rate || 0,
    date: latest.Date,
  }
}

async function fetchPriceWithFallback(
  symbol: string,
  category: string
): Promise<{ price: number; provider: string } | null> {
  // Try API providers first
  const providers = API_PROVIDERS.filter(
    (p) => p.categories.includes(category) && p.enabled()
  ).sort((a, b) => a.priority - b.priority)

  for (const provider of providers) {
    try {
      await rateLimiter.throttle(provider)
      const price = await provider.fetch(symbol, category)
      if (price && price > 0) {
        return { price, provider: provider.name }
      }
    } catch (error: any) {
      continue
    }
  }

  // Fallback to CSV if all APIs failed
  console.log(`   ⚠️  All APIs failed for ${symbol}, trying CSV fallback...`)
  const csvPrice = getLatestPrice(symbol, category)
  if (csvPrice) {
    return { price: csvPrice.price, provider: "csv" }
  }

  return null
}

// ============================================================================
// TICKER UNIVERSE MANAGEMENT
// ============================================================================

async function loadTickerUniverseFromPolygon(limit: number = 1000): Promise<void> {
  console.log(`📊 Loading ticker universe from Polygon (limit: ${limit})...\n`)

  if (!process.env.POLYGON_API_KEY) {
    console.error("❌ POLYGON_API_KEY not found")
    return
  }

  try {
    const url = `https://api.polygon.io/v3/reference/tickers?market=stocks&active=true&limit=${limit}&apiKey=${process.env.POLYGON_API_KEY}`
    console.log(`🔗 Fetching from Polygon API...`)

    const response = await axios.get(url, { timeout: 30000 })
    console.log(`✅ API Response received`)

    if (!response.data?.results) {
      console.error("❌ No results from Polygon API")
      console.error("Response:", JSON.stringify(response.data).slice(0, 200))
      return
    }

    console.log(`📦 Processing ${response.data.results.length} tickers...`)

    const tickers = response.data.results.map((ticker: any) => ({
      symbol: ticker.ticker,
      name: ticker.name,
      exchange: ticker.primary_exchange,
      asset_type: "stock",
      category: "equity",
      market_cap: ticker.market_cap || null,
      active: ticker.active,
      data_source: "polygon",
      metadata: {
        locale: ticker.locale,
        currency: ticker.currency_name,
        type: ticker.type,
      },
    }))

    const batchSize = 500
    let inserted = 0

    console.log(`💾 Inserting ${tickers.length} tickers in batches of ${batchSize}...`)

    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize)
      const { error } = await supabase
        .from("ticker_universe")
        .upsert(batch, { onConflict: "symbol" })

      if (!error) {
        inserted += batch.length
        console.log(
          `   ✅ Inserted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} tickers`
        )
      } else {
        console.error(`   ❌ Error in batch ${Math.floor(i / batchSize) + 1}:`, error.message)
      }
    }

    console.log(`\n✅ Loaded ${inserted} tickers into universe\n`)
  } catch (error: any) {
    console.error("❌ Error loading ticker universe:", error.message)
    if (error.response) {
      console.error("API Response:", error.response.status, error.response.statusText)
    }
  }
}

async function addCryptoToUniverse(): Promise<void> {
  console.log("₿ Adding crypto tickers to universe...\n")

  const cryptoTickers = [
    { symbol: "Bitcoin", name: "Bitcoin", id: "bitcoin" },
    { symbol: "Ethereum", name: "Ethereum", id: "ethereum" },
    { symbol: "Solana", name: "Solana", id: "solana" },
    { symbol: "BNB", name: "BNB", id: "binancecoin" },
    { symbol: "XRP", name: "XRP", id: "ripple" },
    { symbol: "Cardano", name: "Cardano", id: "cardano" },
    { symbol: "Polkadot", name: "Polkadot", id: "polkadot" },
    { symbol: "Chainlink", name: "Chainlink", id: "chainlink" },
    { symbol: "Stellar", name: "Stellar", id: "stellar" },
  ]

  const records = cryptoTickers.map((crypto) => ({
    symbol: crypto.symbol,
    name: crypto.name,
    exchange: "CRYPTO",
    asset_type: "crypto",
    category: "crypto",
    active: true,
    data_source: "coingecko",
    metadata: { coingecko_id: crypto.id },
  }))

  const { error } = await supabase.from("ticker_universe").upsert(records, { onConflict: "symbol" })

  if (error) {
    console.error("❌ Error:", error.message)
  } else {
    console.log(`✅ Added ${records.length} crypto tickers\n`)
  }
}

async function addForexToUniverse(): Promise<void> {
  console.log("💱 Adding forex pairs to universe...\n")

  const forexPairs = [
    "EUR/USD",
    "USD/JPY",
    "GBP/USD",
    "GBP/JPY",
    "AUD/USD",
    "USD/CAD",
    "NZD/USD",
    "EUR/GBP",
    "EUR/JPY",
    "AUD/JPY",
  ]

  const records = forexPairs.map((pair) => ({
    symbol: pair,
    name: `${pair.split("/")[0]} to ${pair.split("/")[1]}`,
    exchange: "FOREX",
    asset_type: "forex",
    category: "forex",
    active: true,
    data_source: "exchangerate",
  }))

  const { error } = await supabase.from("ticker_universe").upsert(records, { onConflict: "symbol" })

  if (error) {
    console.error("❌ Error:", error.message)
  } else {
    console.log(`✅ Added ${records.length} forex pairs\n`)
  }
}

async function addCommoditiesToUniverse(): Promise<void> {
  console.log("🥇 Adding commodities to universe...\n")

  const commodities = [
    { symbol: "GLD", name: "Gold ETF" },
    { symbol: "USO", name: "Oil ETF" },
    { symbol: "GC1!", name: "Gold Futures" },
    { symbol: "CL1!", name: "Crude Oil Futures" },
    { symbol: "HG1!", name: "Copper Futures" },
    { symbol: "COTTON", name: "Cotton" },
    { symbol: "WHEAT", name: "Wheat" },
    { symbol: "CORN", name: "Corn" },
    { symbol: "SUGAR", name: "Sugar" },
    { symbol: "COFFEE", name: "Coffee" },
  ]

  const records = commodities.map((commodity) => ({
    symbol: commodity.symbol,
    name: commodity.name,
    exchange: "COMMODITY",
    asset_type: "commodity",
    category: "commodity",
    active: true,
    data_source: "polygon",
  }))

  const { error } = await supabase.from("ticker_universe").upsert(records, { onConflict: "symbol" })

  if (error) {
    console.error("❌ Error:", error.message)
  } else {
    console.log(`✅ Added ${records.length} commodities\n`)
  }
}

async function initializeTickerUniverse(): Promise<void> {
  console.log("🚀 Initializing complete ticker universe...\n")
  console.log("Step 1: Loading from Polygon...")

  await loadTickerUniverseFromPolygon(1000)
  console.log("Step 2: Polygon complete, adding crypto...")

  await addCryptoToUniverse()
  console.log("Step 3: Crypto complete, adding forex...")

  await addForexToUniverse()
  console.log("Step 4: Forex complete, adding commodities...")

  await addCommoditiesToUniverse()
  console.log("Step 5: All inserts complete, getting stats...")

  const { count: totalCount } = await supabase
    .from("ticker_universe")
    .select("*", { count: "exact", head: true })

  const { count: equityCount } = await supabase
    .from("ticker_universe")
    .select("*", { count: "exact", head: true })
    .eq("category", "equity")

  const { count: cryptoCount } = await supabase
    .from("ticker_universe")
    .select("*", { count: "exact", head: true })
    .eq("category", "crypto")

  console.log("\n📊 Universe Summary:")
  console.log(`   Total:  ${totalCount?.toLocaleString()}`)
  console.log(`   Equity: ${equityCount?.toLocaleString()}`)
  console.log(`   Crypto: ${cryptoCount?.toLocaleString()}`)
  console.log("\n✅ Ticker universe initialized!\n")
}

async function universeStats(): Promise<void> {
  const { count: total } = await supabase
    .from("ticker_universe")
    .select("*", { count: "exact", head: true })

  console.log(`\n📊 Ticker Universe: ${total?.toLocaleString()} tickers\n`)

  for (const category of ["equity", "crypto", "forex", "commodity", "rates-macro", "stress"]) {
    const { count } = await supabase
      .from("ticker_universe")
      .select("*", { count: "exact", head: true })
      .eq("category", category)

    console.log(`   ${category.padEnd(15)} ${(count || 0).toLocaleString()}`)
  }
  console.log()
}

// ============================================================================
// ENHANCED PRICE FETCHING WITH UNIVERSE AWARENESS
// ============================================================================

async function fetchPolygonHistorical(symbol: string, days: number): Promise<any[]> {
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  const to = new Date().toISOString().split("T")[0]

  const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${from}/${to}?adjusted=true&sort=asc&apiKey=${process.env.POLYGON_API_KEY}`
  const res = await axios.get(url, { timeout: 15000 })

  return (
    res.data.results?.map((bar: any) => ({
      symbol,
      date: new Date(bar.t).toISOString().split("T")[0],
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
      category: "equity",
      asset_type: "stock",
      data_source: "polygon",
    })) || []
  )
}

async function fetchTwelveDataHistorical(symbol: string, days: number): Promise<any[]> {
  const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=${days}&apikey=${process.env.TWELVE_DATA_API_KEY}`
  const res = await axios.get(url, { timeout: 15000 })

  return (
    res.data.values
      ?.map((bar: any) => ({
        symbol,
        date: bar.datetime.split(" ")[0],
        open: parseFloat(bar.open),
        high: parseFloat(bar.high),
        low: parseFloat(bar.low),
        close: parseFloat(bar.close),
        volume: parseFloat(bar.volume || 0),
        data_source: "twelvedata",
      }))
      .reverse() || []
  )
}

async function fetchCoinGeckoHistorical(symbol: string, days: number): Promise<any[]> {
  const coinId = mapCryptoSymbol(symbol)
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily&x_cg_demo_api_key=${process.env.COINGECKO_API_KEY}`
  const res = await axios.get(url, { timeout: 15000 })

  if (!res.data?.prices) return []

  return res.data.prices.map(([timestamp, price]: [number, number]) => {
    const date = new Date(timestamp).toISOString().split("T")[0]
    return {
      symbol,
      date,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: 0,
      category: "crypto",
      asset_type: "crypto",
      data_source: "coingecko",
    }
  })
}

async function fetchFREDHistorical(symbol: string, days: number): Promise<any[]> {
  // Map common macro symbols to FRED series IDs
  const seriesMap: Record<string, string> = {
    FEDFUNDS: "DFF",
    CPI: "CPIAUCSL",
    PPI: "PPIACO",
    PCE: "PCE",
    GDP: "GDP",
    UNRATE: "UNRATE",
    PAYEMS: "PAYEMS",
    INDPRO: "INDPRO",
    HOUST: "HOUST",
    PERMIT: "PERMIT",
    M1: "M1SL",
    M2: "M2SL",
    TNX: "DGS10",
    IRX: "DTB3",
    FVX: "DGS5",
    TYX: "DGS30",
    DGS10: "DGS10",
    DGS2: "DGS2",
    DGS5: "DGS5",
    DGS30: "DGS30",
  }

  const seriesId = seriesMap[symbol]
  if (!seriesId) return []

  const endDate = new Date()
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)
  const startStr = startDate.toISOString().split("T")[0]
  const endStr = endDate.toISOString().split("T")[0]

  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${process.env.FRED_API_KEY}&file_type=json&observation_start=${startStr}&observation_end=${endStr}&sort_order=asc`
  const res = await axios.get(url, { timeout: 15000 })

  if (!res.data?.observations) return []

  return res.data.observations
    .filter((obs: any) => obs.value !== ".")
    .map((obs: any) => ({
      symbol,
      date: obs.date,
      open: parseFloat(obs.value),
      high: parseFloat(obs.value),
      low: parseFloat(obs.value),
      close: parseFloat(obs.value),
      volume: 0,
      category: "rates-macro",
      asset_type: "macro",
      data_source: "fred",
    }))
}

async function fetchAlphaVantageHistorical(
  symbol: string,
  days: number,
  category: string
): Promise<any[]> {
  // Handle forex differently
  if (category === "forex" && symbol.includes("/")) {
    const [from, to] = symbol.split("/")
    const url = `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=${from}&to_symbol=${to}&outputsize=full&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`
    const res = await axios.get(url, { timeout: 15000 })

    const timeSeries = res.data["Time Series FX (Daily)"]
    if (!timeSeries) return []

    return Object.entries(timeSeries)
      .slice(0, days)
      .map(([date, values]: [string, any]) => ({
        symbol,
        date,
        open: parseFloat(values["1. open"]),
        high: parseFloat(values["2. high"]),
        low: parseFloat(values["3. low"]),
        close: parseFloat(values["4. close"]),
        volume: 0,
        category: "forex",
        asset_type: "forex",
        data_source: "alphavantage",
      }))
      .reverse()
  }

  // Standard equity/commodity endpoint
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=full&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`
  const res = await axios.get(url, { timeout: 15000 })

  const timeSeries = res.data["Time Series (Daily)"]
  if (!timeSeries) return []

  return Object.entries(timeSeries)
    .slice(0, days)
    .map(([date, values]: [string, any]) => ({
      symbol,
      date,
      open: parseFloat(values["1. open"]),
      high: parseFloat(values["2. high"]),
      low: parseFloat(values["3. low"]),
      close: parseFloat(values["4. close"]),
      volume: parseFloat(values["5. volume"]),
      category,
      asset_type: category,
      data_source: "alphavantage",
    }))
    .reverse()
}

async function fetchHistoricalData(
  symbol: string,
  category: string,
  days: number = 365
): Promise<any[]> {
  console.log(`📡 Fetching ${days}d history for ${symbol}...`)

  const { data: tickerInfo } = await supabase
    .from("ticker_universe")
    .select("data_source")
    .eq("symbol", symbol)
    .single()

  const preferredSource = tickerInfo?.data_source || "polygon"

  const providers = API_PROVIDERS.filter(
    (p) => p.categories.includes(category) && p.enabled()
  ).sort((a, b) => {
    if (a.name === preferredSource) return -1
    if (b.name === preferredSource) return 1
    return a.priority - b.priority
  })

  for (const provider of providers) {
    try {
      await rateLimiter.throttle(provider)

      let bars: any[] = []

      // Category-specific historical fetching
      if (category === "crypto" && provider.name === "coingecko") {
        bars = await fetchCoinGeckoHistorical(symbol, days)
      } else if (category === "rates-macro" && provider.name === "fred") {
        bars = await fetchFREDHistorical(symbol, days)
      } else if (provider.name === "polygon") {
        bars = await fetchPolygonHistorical(symbol, days)
      } else if (provider.name === "twelve_data") {
        bars = await fetchTwelveDataHistorical(symbol, days)
      } else if (provider.name === "alpha_vantage") {
        bars = await fetchAlphaVantageHistorical(symbol, days, category)
      }

      if (bars.length > 0) {
        console.log(`   ✅ Got ${bars.length} bars from ${provider.name}`)
        return bars
      }
    } catch (error: any) {
      console.log(`   ⚠️  ${provider.name} failed: ${error.message}`)
      continue
    }
  }

  // CSV fallback for historical data
  console.log(`   ⚠️  All APIs failed, trying CSV fallback...`)
  const csvPath = PRICE_CSVS[category as keyof typeof PRICE_CSVS]
  if (csvPath && fs.existsSync(csvPath)) {
    const csvData = parseCSV(csvPath)
    const symbolData = csvData.filter((row: any) => {
      const rowSymbol = row.Symbol || row.Commodity || row.Pair || row.Indicator
      return rowSymbol === symbol
    })
    if (symbolData.length > 0) {
      console.log(`   ✅ Got ${symbolData.length} bars from CSV`)
      return symbolData.map((row: any) => ({
        symbol,
        date: row.Date,
        open: row.Open || row.Price || row.Rate,
        high: row.High || row.Price || row.Rate,
        low: row.Low || row.Price || row.Rate,
        close: row.Close || row.Price || row.Rate,
        volume: row.Volume || 0,
        category,
        asset_type: category,
        data_source: "csv",
      }))
    }
  }

  console.log(`   ❌ No data available for ${symbol}`)
  return []
}

async function backfillHistoricalData(category?: string, days: number = 365): Promise<void> {
  console.log(`📊 Backfilling ${days} days of historical data...\n`)

  let query = supabase
    .from("ticker_universe")
    .select("symbol, category, data_source")
    .eq("active", true)

  if (category) {
    query = query.eq("category", category)
  }

  const { data: tickers } = await query.limit(50)

  if (!tickers || tickers.length === 0) {
    console.log("❌ No tickers found in universe\n")
    return
  }

  let processed = 0
  let inserted = 0

  for (const ticker of tickers) {
    const bars = await fetchHistoricalData(ticker.symbol, ticker.category, days)

    if (bars.length > 0) {
      for (let i = 0; i < bars.length; i += 500) {
        const batch = bars.slice(i, i + 500)
        const { error } = await supabase
          .from("financial_data")
          .upsert(batch, { onConflict: "symbol,date" })

        if (!error) {
          inserted += batch.length
        }
      }
      console.log(`   ✅ ${ticker.symbol}: ${bars.length} bars`)
    }

    processed++

    if (processed % 5 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }

  console.log(`\n✅ Backfilled ${inserted.toLocaleString()} data points for ${processed} tickers\n`)
}

async function backfillFromCategoryMap(category?: string, days: number = 365): Promise<void> {
  console.log(`📊 Backfilling from CATEGORY_MAP (${days} days)...\n`)

  const categories = category ? [category] : Object.keys(CATEGORY_MAP)

  let totalProcessed = 0
  let totalInserted = 0

  for (const cat of categories) {
    const symbols = CATEGORY_MAP[cat as keyof typeof CATEGORY_MAP]
    if (!symbols || symbols.length === 0) continue

    console.log(`\n📂 ${cat.toUpperCase()} (${symbols.length} symbols)`)

    let processed = 0
    let inserted = 0

    for (const symbol of symbols) {
      const bars = await fetchHistoricalData(symbol, cat, days)

      if (bars.length > 0) {
        for (let i = 0; i < bars.length; i += 500) {
          const batch = bars.slice(i, i + 500)
          const { error } = await supabase
            .from("financial_data")
            .upsert(batch, { onConflict: "symbol,date" })

          if (!error) {
            inserted += batch.length
          }
        }
        console.log(`   ✅ ${symbol.padEnd(15)} ${bars.length} bars`)
      } else {
        console.log(`   ⚠️  ${symbol.padEnd(15)} No data`)
      }

      processed++

      // Rate limiting: wait 2s every 5 symbols
      if (processed % 5 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }

      // Progress update every 25 symbols
      if (processed % 25 === 0) {
        console.log(
          `   📊 Progress: ${processed}/${symbols.length} (${inserted.toLocaleString()} records)`
        )
      }
    }

    console.log(`   ✅ ${cat}: ${processed} symbols, ${inserted.toLocaleString()} records`)
    totalProcessed += processed
    totalInserted += inserted

    // Wait 5s between categories
    if (categories.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }
  }

  console.log(
    `\n✅ COMPLETE: ${totalProcessed} symbols, ${totalInserted.toLocaleString()} records\n`
  )
}

// ============================================================================
// CORE COMMANDS
// ============================================================================

async function loadAllCSVs(): Promise<void> {
  console.log("🚀 Starting CSV data load...\n")
  for (const mapping of CSV_MAPPINGS) {
    try {
      await loadCSV(mapping)
    } catch (error: any) {
      console.error(`❌ Error loading ${mapping.csvPath}:`, error.message)
    }
  }
  console.log("✅ CSV data load complete!")
}

async function loadCSV(mapping: CSVMapping): Promise<void> {
  const { csvPath, tableName, columnMapping, transform } = mapping

  if (!fs.existsSync(csvPath)) {
    console.log(`   ⚠️  File not found, skipping: ${csvPath}`)
    return
  }

  const fileContent = fs.readFileSync(csvPath, "utf-8")
  const cleanedContent = fileContent
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n")

  const records = parse(cleanedContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })

  const transformedRecords = records
    .map((record: any) => {
      const mapped: any = {}
      for (const [csvCol, dbCol] of Object.entries(columnMapping)) {
        if (record[csvCol] !== undefined && record[csvCol] !== "") {
          mapped[dbCol] = record[csvCol]
        }
      }
      return transform ? transform(mapped) : mapped
    })
    .filter((r: any) => Object.keys(r).length > 0)

  if (transformedRecords.length === 0) return

  const batchSize = 500
  for (let i = 0; i < transformedRecords.length; i += batchSize) {
    const batch = transformedRecords.slice(i, i + batchSize)
    const conflictKey =
      tableName === "astro_aspects"
        ? "date,body1,body2,aspect_type"
        : tableName === "astro_events"
          ? "date,event_type,body"
          : "symbol,date"

    const { error } = await supabase.from(tableName).upsert(batch, { onConflict: conflictKey })
    if (error) {
      console.error(`   ❌ Error inserting batch:`, error.message)
    }
  }
}

async function updatePricesFromCSV(csvPath?: string): Promise<void> {
  console.log("📊 Updating prices from CSV...\n")

  const targetPath = csvPath || "./public/data/tickers/price_data_dec22_20260107.csv"
  if (!fs.existsSync(targetPath)) {
    console.error("❌ CSV file not found:", targetPath)
    return
  }

  const csvContent = fs.readFileSync(targetPath, "utf8")
  const parsed = Papa.parse<any>(csvContent, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  })

  const symbolData: Record<string, any[]> = {}
  ;(parsed.data as any[]).forEach((row: any) => {
    const symbol = row.symbol || row.Symbol
    if (!symbol) return

    if (!symbolData[symbol]) symbolData[symbol] = []
    symbolData[symbol].push({
      symbol,
      date: row.date || row.Date,
      open: parseFloat(row.open || row.Open) || null,
      high: parseFloat(row.high || row.High) || null,
      low: parseFloat(row.low || row.Low) || null,
      close: parseFloat(row.close || row.Close),
      volume: parseFloat(row.volume || row.Volume) || 0,
    })
  })

  let updated = 0
  for (const symbol of Object.keys(symbolData)) {
    const records = symbolData[symbol]
    for (let i = 0; i < records.length; i += 1000) {
      const batch = records.slice(i, i + 1000)
      const { error } = await supabase
        .from("financial_data")
        .upsert(batch, { onConflict: "symbol,date" })
      if (!error) updated++
    }
    console.log(`✅ Updated ${symbol}`)
  }
}

async function checkPriceFreshness(): Promise<void> {
  console.log("🔍 Checking price data freshness...\n")

  const symbols = ["SPY", "QQQ", "Bitcoin", "EUR/USD"]
  for (const symbol of symbols) {
    const { data } = await supabase
      .from("financial_data")
      .select("symbol, date, close")
      .eq("symbol", symbol)
      .order("date", { ascending: false })
      .limit(1)

    if (data && data.length > 0) {
      const latest = data[0]
      const daysOld = Math.floor(
        (Date.now() - new Date(latest.date).getTime()) / (1000 * 60 * 60 * 24)
      )
      console.log(
        `${symbol.padEnd(10)} | ${latest.close.toFixed(2).padStart(8)} | ${latest.date} (${daysOld}d old)`
      )
    } else {
      console.log(`${symbol.padEnd(10)} | NO DATA`)
    }
  }
}

async function populateFeaturedTickers(): Promise<void> {
  console.log("🌟 Populating featured tickers (FAST MODE)...\n")

  try {
    // Import confluenceEngine functions
    const { batchCalculateRatings, detectConvergenceForecastedSwings, storeFeaturedTickers } =
      await import("../src/lib/services/confluenceEngine.js")

    // Get current ingress to determine scope
    const today = new Date().toISOString().split("T")[0]
    const { data: currentIngress } = await supabase
      .from("astro_events")
      .select("*")
      .eq("event_type", "ingress")
      .eq("body", "Sun")
      .lte("date", today)
      .order("date", { ascending: false })
      .limit(1)
      .single()

    if (!currentIngress) {
      console.log("⚠️  No ingress data, skipping featured refresh\n")
      return
    }

    const daysSinceIngress = Math.floor(
      (Date.now() - new Date(currentIngress.date).getTime()) / (1000 * 60 * 60 * 24)
    )

    console.log(`🌞 Current ingress: ${currentIngress.sign} (Day ${daysSinceIngress})`)

    // SENTINEL SYMBOLS (excluded from featured)
    const SENTINELS = new Set([
      "SPY",
      "QQQ",
      "XLY", // Equity
      "GLD",
      "USO",
      "HG1!", // Commodity
      "EUR/USD",
      "USD/JPY",
      "GBP/USD", // Forex
      "Bitcoin",
      "Ethereum",
      "Solana", // Crypto
      "TLT",
      "FEDFUNDS",
      "CPI", // Rates-macro
      "VIX",
      "MOVE",
      "TRIN", // Stress
    ])

    const categories = ["equity", "commodity", "forex", "crypto", "rates-macro", "stress"]
    const allFeatured: any[] = []

    for (const category of categories) {
      console.log(`\n📂 ${category.toUpperCase()}`)

      // STEP 1: Get symbols from ticker universe (limit to active, non-sentinels)
      const { data: tickers } = await supabase
        .from("ticker_universe")
        .select("symbol")
        .eq("category", category)
        .eq("active", true)
        .limit(100) // CRITICAL: Limit to 100 per category (not 1000)

      if (!tickers || tickers.length === 0) {
        console.log(`   ⚠️  No tickers found in universe`)
        continue
      }

      const symbols = tickers
        .map((t) => t.symbol)
        .filter((s) => !SENTINELS.has(s))
        .slice(0, 50) // CRITICAL: Further limit to 50 for convergence detection

      console.log(`   🔍 Checking ${symbols.length} symbols for convergence...`)

      // STEP 2: Run convergence detection (this is the expensive operation)
      const convergenceResults = await detectConvergenceForecastedSwings(symbols, category)

      if (convergenceResults.length > 0) {
        console.log(`   ✅ Found ${convergenceResults.length} convergence forecasts`)

        // Map to featured ticker format
        const featured = convergenceResults.slice(0, 10).map((result, idx) => ({
          symbol: result.symbol,
          category,
          sector: determineSector(result.symbol, category),
          current_price: result.currentPrice,
          next_key_level_price: result.forecastedSwing.price,
          next_key_level_type: result.forecastedSwing.type === "high" ? "resistance" : "support",
          distance_percent:
            Math.abs((result.forecastedSwing.price - result.currentPrice) / result.currentPrice) *
            100,
          days_until: Math.floor(
            (new Date(result.forecastedSwing.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          ),
          confluence_score: Math.round(result.forecastedSwing.finalConfidence * 100),
          tradeability_score: Math.round(result.forecastedSwing.finalConfidence * 100),
          reason: result.forecastedSwing.convergingMethods.join(", "),
          rank: idx + 1,
          updated_at: new Date().toISOString(),
        }))

        allFeatured.push(...featured)
        console.log(`   💾 Added ${featured.length} to featured list`)
      } else {
        console.log(`   ℹ️  No convergence forecasts found, falling back to ratings...`)

        // FALLBACK: Use ticker ratings (faster than convergence)
        const ratings = await batchCalculateRatings({
          symbols: symbols.slice(0, 30), // Even more limited for fallback
          minScore: 70,
          maxResults: 10,
          lookbackDays: 365,
          includeProjections: false, // CRITICAL: Skip expensive projections
          includeSeasonalData: false, // CRITICAL: Skip expensive seasonal calcs
          parallelism: 3, // CRITICAL: Reduce parallelism to avoid rate limits
        })

        if (ratings.length > 0) {
          const featured = ratings.slice(0, 10).map((r, idx) => ({
            symbol: r.symbol,
            category: r.category,
            sector: r.sector,
            current_price: r.currentPrice,
            next_key_level_price: r.nextKeyLevel.price,
            next_key_level_type: r.nextKeyLevel.type,
            distance_percent: r.nextKeyLevel.distancePercent,
            days_until: r.nextKeyLevel.daysUntilEstimate,
            confluence_score: r.scores.confluence,
            tradeability_score: r.scores.total,
            reason: r.reasons.join("; "),
            rank: idx + 1,
            updated_at: new Date().toISOString(),
          }))

          allFeatured.push(...featured)
          console.log(`   💾 Added ${featured.length} from ratings`)
        }
      }

      // Rate limiting between categories
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }

    // STEP 3: Store results
    if (allFeatured.length > 0) {
      console.log(`\n💾 Storing ${allFeatured.length} featured tickers...`)

      // Clear old data
      for (const category of categories) {
        await supabase.from("featured_tickers").delete().eq("category", category)
      }

      // Insert new data in batches
      for (let i = 0; i < allFeatured.length; i += 50) {
        const batch = allFeatured.slice(i, i + 50)
        const { error } = await supabase.from("featured_tickers").insert(batch)

        if (error) {
          console.error(`   ❌ Error storing batch: ${error.message}`)
        }
      }

      console.log(`\n✅ Featured tickers refresh complete`)
      console.log(`   Total: ${allFeatured.length} tickers across ${categories.length} categories`)
    } else {
      console.log(`\n⚠️  No featured tickers found`)
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message)
    console.error(error.stack)
    throw error
  }
}

// ============================================================================
// INGRESS-AWARE CACHING SYSTEM (NEW - INSERT HERE)
// ============================================================================

async function getCurrentIngressPeriod(): Promise<{
  period: string
  sign: string
  startDate: string
  endDate: string
  daysInPeriod: number
}> {
  const today = new Date().toISOString().split("T")[0]

  const { data: currentIngress } = await supabase
    .from("astro_events")
    .select("*")
    .eq("event_type", "ingress")
    .eq("body", "Sun")
    .lte("date", today)
    .order("date", { ascending: false })
    .limit(1)
    .single()

  if (!currentIngress) {
    throw new Error("No ingress data found")
  }

  const { data: nextIngress } = await supabase
    .from("astro_events")
    .select("*")
    .eq("event_type", "ingress")
    .eq("body", "Sun")
    .gt("date", today)
    .order("date", { ascending: true })
    .limit(1)
    .single()

  const startDate = currentIngress.date
  const endDate =
    nextIngress?.date ||
    new Date(new Date(startDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  const daysInPeriod = Math.floor(
    (Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
  )

  return {
    period: `${new Date(startDate).getFullYear()}-${String(new Date(startDate).getMonth() + 1).padStart(2, "0")}-${currentIngress.sign.toLowerCase()}`,
    sign: currentIngress.sign,
    startDate,
    endDate,
    daysInPeriod,
  }
}

function determineSector(symbol: string, category: string): string {
  const SECTOR_MAP: Record<string, string> = {
    // Technology
    AAPL: "technology",
    MSFT: "technology",
    NVDA: "technology",
    GOOGL: "technology",
    META: "technology",
    TSLA: "technology",
    AMD: "technology",
    INTC: "technology",
    // Finance
    JPM: "finance",
    BAC: "finance",
    GS: "finance",
    MS: "finance",
    WFC: "finance",
    V: "finance",
    MA: "finance",
    AXP: "finance",
    // Healthcare
    JNJ: "healthcare",
    UNH: "healthcare",
    PFE: "healthcare",
    ABBV: "healthcare",
    LLY: "healthcare",
    MRK: "healthcare",
    // Energy
    XOM: "energy",
    CVX: "energy",
    COP: "energy",
    SLB: "energy",
    // Consumer
    AMZN: "consumer",
    WMT: "consumer",
    HD: "consumer",
    MCD: "consumer",
    NKE: "consumer",
    SBUX: "consumer",
  }

  if (SECTOR_MAP[symbol]) return SECTOR_MAP[symbol]
  if (category === "commodity") return "commodities"
  if (category === "crypto") return "cryptocurrency"
  if (category === "forex") return "currency"
  if (category === "rates-macro") return "macro"
  if (category === "stress") return "volatility"
  return "unknown"
}

async function runMonthlyIngressScan(): Promise<void> {
  console.log("🌙 MONTHLY INGRESS SCAN - Full Analysis\n")

  const ingress = await getCurrentIngressPeriod()
  console.log(`📅 Ingress Period: ${ingress.period}`)
  console.log(`🌟 Sign: ${ingress.sign}`)
  console.log(`📆 ${ingress.startDate} → ${ingress.endDate}`)
  console.log(`⏱️  Day ${ingress.daysInPeriod} of period\n`)

  // Check if we've already scanned this period
  const { count: existingCount } = await supabase
    .from("ticker_ratings_cache")
    .select("*", { count: "exact", head: true })
    .eq("ingress_period", ingress.period)

  if (existingCount && existingCount > 0) {
    console.log(`⚠️  Period ${ingress.period} already scanned (${existingCount} records)`)
    console.log("Run 'refresh-monthly-scan' to force rescan\n")
    return
  }

  // Import analysis functions
  const { batchCalculateRatings, detectConvergenceForecastedSwings } =
    await import("../src/lib/services/confluenceEngine.js")

  const SENTINELS = new Set([
    "SPY",
    "QQQ",
    "XLY",
    "GLD",
    "USO",
    "HG1!",
    "EUR/USD",
    "USD/JPY",
    "GBP/USD",
    "Bitcoin",
    "Ethereum",
    "Solana",
    "TLT",
    "FEDFUNDS",
    "CPI",
    "VIX",
    "MOVE",
    "TRIN",
  ])

  const categories = ["equity", "commodity", "forex", "crypto", "rates-macro", "stress"]
  let totalAnalyzed = 0

  for (const category of categories) {
    console.log(`\n📂 ${category.toUpperCase()}`)

    // Get all active tickers
    const { data: tickers } = await supabase
      .from("ticker_universe")
      .select("symbol")
      .eq("category", category)
      .eq("active", true)

    if (!tickers?.length) {
      console.log(`   ⚠️  No tickers found`)
      continue
    }

    const symbols = tickers.map((t) => t.symbol).filter((s) => !SENTINELS.has(s))

    console.log(`   🔍 Analyzing ${symbols.length} symbols...`)

    // PHASE 1: Get ratings for ALL symbols
    const ratings = await batchCalculateRatings({
      symbols,
      minScore: 50,
      maxResults: symbols.length,
      lookbackDays: 365,
      includeProjections: false,
      includeSeasonalData: false,
      parallelism: 5,
    })

    console.log(`   📊 Got ${ratings.length} ratings`)

    // PHASE 2: Run convergence detection on top 30%
    const topRatings = ratings
      .sort((a, b) => b.scores.total - a.scores.total)
      .slice(0, Math.ceil(ratings.length * 0.3))

    console.log(`   🎯 Running convergence on top ${topRatings.length} symbols...`)

    const convergenceResults = await detectConvergenceForecastedSwings(
      topRatings.map((r) => r.symbol),
      category
    )

    console.log(`   ✅ Found ${convergenceResults.length} convergence forecasts`)

    // PHASE 3: Store in cache
    const cacheRecords: any[] = []

    // Add convergence results
    for (const conv of convergenceResults) {
      const rating = ratings.find((r) => r.symbol === conv.symbol)

      cacheRecords.push({
        symbol: conv.symbol,
        category,
        ingress_period: ingress.period,
        calculated_at: new Date().toISOString(),
        rating_data: {
          current_price: conv.currentPrice,
          price_date: new Date().toISOString().split("T")[0],
          next_key_level: {
            price: conv.forecastedSwing.price,
            type: conv.forecastedSwing.type === "high" ? "resistance" : "support",
            distance_percent:
              Math.abs((conv.forecastedSwing.price - conv.currentPrice) / conv.currentPrice) * 100,
            distance_points: Math.abs(conv.forecastedSwing.price - conv.currentPrice),
          },
          scores: {
            confluence: rating?.scores.confluence || 0,
            proximity: rating?.scores.proximity || 0,
            momentum: rating?.scores.momentum || 0,
            seasonal: rating?.scores.seasonal || 0,
            aspect_alignment: rating?.scores.aspectAlignment || 0,
            volatility: rating?.scores.volatility || 0,
            trend: rating?.scores.trend || 0,
            volume: rating?.scores.volume || 0,
            technical: rating?.scores.technical || 0,
            fundamental: rating?.scores.fundamental || 0,
            total: rating?.scores.total || Math.round(conv.forecastedSwing.finalConfidence * 100),
          },
          rating: rating?.rating || null,
          confidence: rating?.confidence || null,
          recommendation: rating?.recommendation || null,
          convergence: {
            has_convergence: true,
            methods: conv.forecastedSwing.convergingMethods,
            confidence: conv.forecastedSwing.finalConfidence,
            forecasted_swing: {
              type: conv.forecastedSwing.type,
              price: conv.forecastedSwing.price,
              date: conv.forecastedSwing.date,
            },
          },
          validations: {
            fib: {
              quality: conv.forecastedSwing.fibOverlap?.quality || "none",
              ratio: conv.forecastedSwing.fibOverlap?.fibRatio || null,
              score: conv.forecastedSwing.fibOverlap?.score || 0,
            },
            gann: {
              quality: conv.forecastedSwing.gannValidation?.quality || "none",
              time_symmetry: conv.forecastedSwing.gannValidation?.timeSymmetry || false,
              price_square: conv.forecastedSwing.gannValidation?.priceSquare || false,
              angle_holding: conv.forecastedSwing.gannValidation?.angleHolding || false,
              score: conv.forecastedSwing.gannValidation?.score || 0,
            },
            lunar: {
              phase: conv.forecastedSwing.lunarTiming?.phase || null,
              recommendation: conv.forecastedSwing.lunarTiming?.recommendation || null,
              entry_favorability: conv.forecastedSwing.lunarTiming?.entryFavorability || null,
              exit_favorability: conv.forecastedSwing.lunarTiming?.exitFavorability || null,
              days_to_phase: conv.forecastedSwing.lunarTiming?.daysToPhase || null,
            },
            atr: {
              state: conv.forecastedSwing.atrAnalysis?.state || null,
              current: conv.atr14,
              current_percent: conv.forecastedSwing.atrAnalysis?.currentPercent || null,
              average_percent: conv.forecastedSwing.atrAnalysis?.average || null,
              multiple:
                conv.atr14 > 0
                  ? Math.abs(conv.forecastedSwing.price - conv.currentPrice) / conv.atr14
                  : 0,
              strength: conv.forecastedSwing.atrAnalysis?.strength || null,
            },
          },
          sector: determineSector(conv.symbol, category),
          reasons: rating?.reasons || [],
          warnings: rating?.warnings || [],
          projections: {
            days_until_target: Math.floor(
              (new Date(conv.forecastedSwing.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            ),
            reach_probability: conv.forecastedSwing.finalConfidence,
            earliest_date: null,
            most_likely_date: conv.forecastedSwing.date,
            latest_date: null,
          },
          ingress_alignment: {
            sign: ingress.sign,
            start_date: ingress.startDate,
            end_date: ingress.endDate,
            days_in_period: ingress.daysInPeriod,
            favorability: rating?.ingressAlignment?.favorability || null,
          },
          featured_rank: null,
          dynamic_score: null,
          last_rank_update: null,
        },
      })
    }

    // Add remaining ratings (without convergence)
    const nonConvergenceSymbols = new Set(convergenceResults.map((c) => c.symbol))
    for (const rating of ratings) {
      if (nonConvergenceSymbols.has(rating.symbol)) continue

      cacheRecords.push({
        symbol: rating.symbol,
        category,
        ingress_period: ingress.period,
        calculated_at: new Date().toISOString(),
        rating_data: {
          current_price: rating.currentPrice,
          price_date: rating.priceDate,
          next_key_level: {
            price: rating.nextKeyLevel.price,
            type: rating.nextKeyLevel.type,
            distance_percent: rating.nextKeyLevel.distancePercent,
            distance_points: rating.nextKeyLevel.distancePoints,
          },
          scores: {
            confluence: rating.scores.confluence,
            proximity: rating.scores.proximity,
            momentum: rating.scores.momentum,
            seasonal: rating.scores.seasonal,
            aspect_alignment: rating.scores.aspectAlignment,
            volatility: rating.scores.volatility,
            trend: rating.scores.trend,
            volume: rating.scores.volume,
            technical: rating.scores.technical,
            fundamental: rating.scores.fundamental,
            total: rating.scores.total,
          },
          rating: rating.rating,
          confidence: rating.confidence,
          recommendation: rating.recommendation,
          convergence: {
            has_convergence: false,
          },
          validations: {
            atr: {
              current: rating.atr14,
              multiple: rating.atrMultiple,
            },
          },
          sector: rating.sector,
          reasons: rating.reasons,
          warnings: rating.warnings,
          projections: {
            days_until_target: rating.nextKeyLevel.daysUntilEstimate,
            reach_probability: rating.projections?.probability || null,
            earliest_date: rating.projections?.confidenceInterval?.earliest || null,
            most_likely_date: rating.projections?.reachDate || null,
            latest_date: rating.projections?.confidenceInterval?.latest || null,
          },
          ingress_alignment: {
            sign: ingress.sign,
            start_date: ingress.startDate,
            end_date: ingress.endDate,
            days_in_period: ingress.daysInPeriod,
            favorability: rating.ingressAlignment?.favorability || null,
          },
          featured_rank: null,
          dynamic_score: null,
          last_rank_update: null,
        },
      })
    }

    // Batch insert
    if (cacheRecords.length > 0) {
      for (let i = 0; i < cacheRecords.length; i += 100) {
        const batch = cacheRecords.slice(i, i + 100)
        const { error } = await supabase.from("ticker_ratings_cache").upsert(batch, {
          onConflict: "symbol,category,ingress_period",
        })

        if (error) {
          console.error(`   ❌ Error inserting batch: ${error.message}`)
        }
      }

      totalAnalyzed += cacheRecords.length
      console.log(`   💾 Cached ${cacheRecords.length} analysis records`)
    }

    // Rate limiting between categories
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  console.log(`\n✅ COMPLETE: ${totalAnalyzed} symbols analyzed and cached\n`)
}

async function runDailyRankUpdate(): Promise<void> {
  console.log("📊 DAILY RANK UPDATE\n")

  const ingress = await getCurrentIngressPeriod()
  console.log(`📅 Period: ${ingress.period} (Day ${ingress.daysInPeriod})\n`)

  const categories = ["equity", "commodity", "forex", "crypto", "rates-macro", "stress"]
  let totalUpdated = 0

  for (const category of categories) {
    console.log(`📂 ${category.toUpperCase()}`)

    const { data: cached } = await supabase
      .from("ticker_ratings_cache")
      .select("*")
      .eq("ingress_period", ingress.period)
      .eq("category", category)

    if (!cached?.length) {
      console.log(`   ⚠️  No cache - run monthly scan first`)
      continue
    }

    console.log(`   📊 Found ${cached.length} cached analyses`)

    // Re-rank based on dynamic scoring
    const scored = cached.map((item) => {
      const data = item.rating_data
      let dynamicScore = data.scores?.total || 0

      // Convergence bonus (strong signal)
      if (data.convergence?.has_convergence) {
        dynamicScore += 15

        if (data.convergence.confidence && data.convergence.confidence > 0.85) {
          dynamicScore += 5
        }
      }

      // Framework validation bonuses
      if (data.validations?.fib?.quality === "excellent") dynamicScore += 8
      else if (data.validations?.fib?.quality === "good") dynamicScore += 4

      if (data.validations?.gann?.quality === "excellent") dynamicScore += 7
      else if (data.validations?.gann?.quality === "good") dynamicScore += 3

      // Lunar timing
      if (data.validations?.lunar?.recommendation === "favorable_entry") dynamicScore += 5
      else if (data.validations?.lunar?.recommendation === "caution") dynamicScore -= 3

      // ATR state (setup vs. already moving)
      if (data.validations?.atr?.state === "compression") dynamicScore += 6
      else if (data.validations?.atr?.state === "expansion") dynamicScore -= 4

      // ATR multiple quality
      if (data.validations?.atr?.multiple && data.validations.atr.multiple >= 3) dynamicScore += 4
      else if (data.validations?.atr?.multiple && data.validations.atr.multiple < 2)
        dynamicScore -= 2

      // Proximity bonus
      if (data.next_key_level?.distance_percent && data.next_key_level.distance_percent < 2) {
        dynamicScore += 3
      }

      // Ingress favorability
      if (data.ingress_alignment?.favorability === "very_favorable") dynamicScore += 4
      else if (data.ingress_alignment?.favorability === "unfavorable") dynamicScore -= 3

      return {
        symbol: item.symbol,
        category: item.category,
        ingress_period: item.ingress_period,
        data,
        dynamic_score: dynamicScore,
      }
    })

    scored.sort((a, b) => b.dynamic_score - a.dynamic_score)

    // Update ranks in JSONB
    for (let i = 0; i < scored.length; i++) {
      const updatedData = {
        ...scored[i].data,
        featured_rank: i < 10 ? i + 1 : null,
        dynamic_score: scored[i].dynamic_score,
        last_rank_update: new Date().toISOString(),
      }

      await supabase
        .from("ticker_ratings_cache")
        .update({
          rating_data: updatedData,
          calculated_at: new Date().toISOString(), // Update timestamp
        })
        .eq("symbol", scored[i].symbol)
        .eq("category", scored[i].category)
        .eq("ingress_period", scored[i].ingress_period)
    }

    totalUpdated += scored.length
    const topTen = scored.filter((_, idx) => idx < 10).map((s, idx) => `${s.symbol} (#${idx + 1})`)

    console.log(`   🏆 Top 10: ${topTen.join(", ")}`)
  }

  console.log(`\n✅ Ranks updated: ${totalUpdated} tickers\n`)

  // Sync to featured_tickers table
  await syncCacheToFeaturedTable(ingress.period)
}

async function syncCacheToFeaturedTable(ingressPeriod: string): Promise<void> {
  console.log("🔄 Syncing cache to featured_tickers...\n")

  // Query with JSONB field extraction
  const { data: topTickers } = await supabase
    .from("ticker_ratings_cache")
    .select("symbol, category, rating_data")
    .eq("ingress_period", ingressPeriod)
    // Filter where rating_data->>'featured_rank' is not null using raw query
    .not("rating_data->featured_rank", "is", null)
    .order("rating_data->dynamic_score", { ascending: false } as any)
    .limit(60) // Get top 60 (10 per category)

  if (!topTickers?.length) {
    console.log("⚠️  No featured tickers to sync")
    return
  }

  console.log(`   📦 Found ${topTickers.length} ranked tickers`)

  // Clear old featured table
  await supabase.from("featured_tickers").delete().neq("symbol", "")

  // Transform and insert
  const featured = topTickers
    .filter((t) => t.rating_data?.featured_rank) // Double-check
    .map((t) => {
      const data = t.rating_data
      return {
        symbol: t.symbol,
        category: t.category,
        sector: data.sector || determineSector(t.symbol, t.category),
        current_price: data.current_price,
        next_key_level_price: data.next_key_level?.price,
        next_key_level_type: data.next_key_level?.type,
        distance_percent: data.next_key_level?.distance_percent,
        days_until: data.projections?.days_until_target,
        confluence_score: data.scores?.confluence,
        tradeability_score: data.scores?.total,
        reason: data.convergence?.has_convergence
          ? data.convergence.methods?.join(", ")
          : data.reasons?.join("; ") || `Score: ${data.scores?.total}`,
        rank: data.featured_rank,
        updated_at: new Date().toISOString(),
      }
    })

  if (featured.length > 0) {
    const { error } = await supabase.from("featured_tickers").insert(featured)
    if (error) {
      console.error(`   ❌ Error syncing: ${error.message}`)
    } else {
      console.log(`   ✅ Synced ${featured.length} featured tickers\n`)
    }
  }
}

async function getFeaturedTickersFromCache(category?: string): Promise<any[]> {
  const ingress = await getCurrentIngressPeriod()

  let query = supabase
    .from("ticker_ratings_cache")
    .select("symbol, category, rating_data")
    .eq("ingress_period", ingress.period)

  if (category) {
    query = query.eq("category", category)
  }

  const { data } = await query

  if (!data?.length) return []

  return data
    .filter((t) => t.rating_data?.featured_rank)
    .sort((a, b) => (a.rating_data.featured_rank || 999) - (b.rating_data.featured_rank || 999))
    .map((t) => ({
      symbol: t.symbol,
      category: t.category,
      currentPrice: t.rating_data.current_price,
      lastSwing: {
        type: t.rating_data.next_key_level?.type === "resistance" ? "low" : "high",
        price: t.rating_data.current_price * 0.98,
        date: t.rating_data.price_date,
        barIndex: 0,
      },
      forecastedSwing: {
        type:
          t.rating_data.convergence?.forecasted_swing?.type ||
          (t.rating_data.next_key_level?.type === "resistance" ? "high" : "low"),
        price:
          t.rating_data.convergence?.forecasted_swing?.price || t.rating_data.next_key_level?.price,
        date:
          t.rating_data.convergence?.forecasted_swing?.date ||
          t.rating_data.projections?.most_likely_date,
        convergingMethods: t.rating_data.convergence?.methods || ["Technical Analysis"],
        baseConfidence: t.rating_data.convergence?.confidence || t.rating_data.scores?.total / 100,
        astroBoost: 0,
        finalConfidence: t.rating_data.convergence?.confidence || t.rating_data.scores?.total / 100,
        fibOverlap: t.rating_data.validations?.fib,
        gannValidation: t.rating_data.validations?.gann,
        lunarTiming: t.rating_data.validations?.lunar,
        atrAnalysis: t.rating_data.validations?.atr,
      },
      ingressValidity: true,
      rank: t.rating_data.featured_rank,
      atr14: t.rating_data.validations?.atr?.current,
    }))
}

// ============================================================================
// CRON COMMANDS
// ============================================================================

async function cronUpdatePricesDelayTolerant(): Promise<void> {
  console.log("🔄 Starting smart price update...\n")

  const args = process.argv.slice(3)
  const categoryArg = args.find((arg) => arg.startsWith("--categories="))
  const requestedCategories = categoryArg
    ? categoryArg.split("=")[1].split(",")
    : Object.keys(CATEGORY_MAP)

  for (const category of requestedCategories) {
    const symbols = CATEGORY_MAP[category as keyof typeof CATEGORY_MAP]
    if (!symbols) continue

    console.log(`\n📂 ${category.toUpperCase()} (${symbols.length} symbols)`)
    const records: any[] = []
    const today = new Date().toISOString().split("T")[0]

    for (const symbol of symbols) {
      const result = await fetchPriceWithFallback(symbol, category)
      if (result) {
        records.push({
          symbol,
          date: today,
          close: result.price,
          open: result.price,
          high: result.price,
          low: result.price,
          volume: 0,
        })
        console.log(
          `   ✅ ${symbol.padEnd(12)} ${result.price.toFixed(2).padStart(10)} (${result.provider})`
        )
      }
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    if (records.length > 0) {
      await supabase.from("financial_data").upsert(records, { onConflict: "symbol,date" })
      console.log(`   ✅ Database updated`)
    }
  }

  rateLimiter.reset()
  console.log("\n✅ Price update complete\n")
}

async function cronRefreshFeaturedDelayTolerant(): Promise<void> {
  console.log("🌞 Checking ingress status...\n")

  const today = new Date().toISOString().split("T")[0]
  const { data: currentIngress } = await supabase
    .from("astro_events")
    .select("*")
    .eq("event_type", "ingress")
    .eq("body", "Sun")
    .lte("date", today)
    .order("date", { ascending: false })
    .limit(1)
    .single()

  if (!currentIngress) {
    console.log("⚠️  No ingress data\n")
    return
  }

  const daysSinceIngress = Math.floor(
    (Date.now() - new Date(currentIngress.date).getTime()) / (1000 * 60 * 60 * 24)
  )

  if (daysSinceIngress <= 1 || (daysSinceIngress % 7 === 0 && daysSinceIngress <= 28)) {
    console.log(`✅ Refresh triggered (day ${daysSinceIngress})\n`)
    await populateFeaturedTickers()
  } else {
    console.log("⭐️  No refresh needed\n")
  }
}

// ============================================================================
// ENHANCEMENT COMMANDS
// ============================================================================

async function cleanOldPriceData(daysToKeep: number = 1095): Promise<void> {
  console.log(`🧹 Cleaning price data older than ${daysToKeep} days...\n`)

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
  const cutoffDateStr = cutoffDate.toISOString().split("T")[0]

  const { data, error } = await supabase
    .from("financial_data")
    .delete()
    .lt("date", cutoffDateStr)
    .select()

  if (error) {
    console.error("❌ Error:", error.message)
  } else {
    console.log(`✅ Deleted ${data?.length || 0} old records\n`)
  }
}

async function getDataQualityReport(): Promise<void> {
  console.log("📊 DATA QUALITY REPORT\n")

  for (const [category, symbols] of Object.entries(CATEGORY_MAP)) {
    const { count } = await supabase
      .from("financial_data")
      .select("*", { count: "exact", head: true })
      .in("symbol", symbols)

    console.log(
      `   ${category.padEnd(15)} | ${symbols.length} symbols | ${(count || 0).toLocaleString()} data points`
    )
  }
}

async function verifyDatabaseSchema(): Promise<void> {
  console.log("🔎 Verifying Database Schema...\n")

  const expectedTables = [
    "financial_data",
    "featured_tickers",
    "astro_events",
    "ticker_ratings_cache",
    "ticker_universe",
  ]

  for (const table of expectedTables) {
    const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true })

    if (error) {
      console.log(`   ❌ ${table.padEnd(25)} | Error: ${error.message}`)
    } else {
      console.log(`   ✅ ${table.padEnd(25)} | ${(count || 0).toLocaleString()} rows`)
    }
  }
}

async function exportToCSV(category?: string, outputDir: string = "./backups"): Promise<void> {
  console.log("💾 Exporting data to CSV...\n")

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const categories = category ? [category] : Object.keys(CATEGORY_MAP)

  for (const cat of categories) {
    const symbols = CATEGORY_MAP[cat as keyof typeof CATEGORY_MAP]
    if (!symbols) continue

    const { data, error } = await supabase
      .from("financial_data")
      .select("*")
      .in("symbol", symbols)
      .order("symbol")
      .order("date")

    if (error || !data || data.length === 0) continue

    const csv = Papa.unparse(data)
    const timestamp = new Date().toISOString().split("T")[0]
    const filename = `${outputDir}/${cat}_${timestamp}.csv`

    fs.writeFileSync(filename, csv)
    console.log(`   ✅ Exported ${data.length} records to ${filename}`)
  }
}

async function testAPIProviders(): Promise<void> {
  console.log("🧪 Testing API Providers...\n")

  const testSymbols = { equity: "SPY", crypto: "Bitcoin", forex: "EUR/USD" }

  for (const provider of API_PROVIDERS) {
    console.log(`📡 ${provider.name.toUpperCase()}`)
    console.log(`   Enabled: ${provider.enabled() ? "✅" : "❌"}`)

    if (!provider.enabled()) continue

    let testSymbol = ""
    let testCategory = ""

    for (const [cat, sym] of Object.entries(testSymbols)) {
      if (provider.categories.includes(cat)) {
        testSymbol = sym
        testCategory = cat
        break
      }
    }

    try {
      const price = await provider.fetch(testSymbol, testCategory)
      if (price) {
        console.log(`   ✅ ${testSymbol} = ${price.toFixed(2)}\n`)
      }
    } catch (error: any) {
      console.log(`   ❌ ${error.message}\n`)
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
}

// ============================================================================
// MAIN CLI
// ============================================================================

export { getCurrentIngressPeriod, getFeaturedTickersFromCache }

async function main() {
  const command = process.argv[2]

  process.stdout.write("")

  const commands: Record<string, () => Promise<void>> = {
    "load-all": loadAllCSVs,
    "update-prices": () => updatePricesFromCSV(process.argv[3]),
    "check-freshness": checkPriceFreshness,
    "populate-featured": populateFeaturedTickers,
    "monthly-scan": runMonthlyIngressScan,
    "daily-rank": runDailyRankUpdate,
    "refresh-monthly-scan": async () => {
      const ingress = await getCurrentIngressPeriod()
      await supabase.from("ticker_analysis_cache").delete().eq("ingress_period", ingress.period)
      await runMonthlyIngressScan()
    },
    "check-cache": async () => {
      const ingress = await getCurrentIngressPeriod()
      const { count } = await supabase
        .from("ticker_analysis_cache")
        .select("*", { count: "exact", head: true })
        .eq("ingress_period", ingress.period)

      console.log(`📦 Cache for ${ingress.period}: ${count || 0} records`)
    },
    "cron-update-prices": cronUpdatePricesDelayTolerant,
    "cron-refresh-featured": cronRefreshFeaturedDelayTolerant,
    "clean-old-data": () => cleanOldPriceData(1095),
    "quality-report": getDataQualityReport,
    "verify-schema": verifyDatabaseSchema,
    "export-csv": () => exportToCSV(process.argv[3]),
    "test-providers": testAPIProviders,
    "init-universe": initializeTickerUniverse,
    "load-polygon-tickers": () => loadTickerUniverseFromPolygon(1000),
    "add-crypto": addCryptoToUniverse,
    "add-forex": addForexToUniverse,
    "add-commodities": addCommoditiesToUniverse,
    backfill: () => backfillHistoricalData(process.argv[3], 365),
    "backfill-equity": () => backfillHistoricalData("equity", 365),
    "backfill-crypto": () => backfillHistoricalData("crypto", 90),
    "backfill-all": () => backfillFromCategoryMap(undefined, 365),
    "backfill-map": () => backfillFromCategoryMap(process.argv[3], 365),
    "universe-stats": universeStats,
    "check-ingress": checkCurrentIngress,

    // NEW: Diagnostic commands
    "debug-symbols": debugSymbolFormats,
    "fix-symbols": fixSymbolFormats,
    "verify-ingress": verifyIngressCalculation,
  }

  if (!command || !commands[command]) {
    console.log(`
📊 Data Manager - Unified data operations tool

Usage: npx tsx scripts/data-manager.ts [command] [options]

Core Commands:
  load-all                       Load all CSV files into database
  update-prices [path]           Update prices from CSV file
  check-freshness                Check price data staleness
  populate-featured              Populate featured tickers from scores
  check-ingress                  Check current astrological ingress status

Ingress-Aware Caching:
  monthly-scan                   Full analysis at start of ingress period
  daily-rank                     Re-rank cached tickers (fast, uses cache)
  refresh-monthly-scan           Force re-scan current ingress period
  check-cache                    View cache status for current period

Cron Commands:
  cron-update-prices [--categories=equity,crypto,forex]
                                 Smart price update with API fallbacks
  cron-refresh-featured          Ingress-aware featured ticker refresh

Ticker Universe:
  init-universe                  Initialize complete ticker universe
  load-polygon-tickers           Load equity tickers from Polygon
  add-crypto                     Add crypto tickers to universe
  add-forex                      Add forex pairs to universe
  add-commodities                Add commodities to universe
  universe-stats                 Show universe statistics

Historical Data Backfill:
  backfill [category]            Backfill 365d from ticker_universe table
  backfill-equity                Backfill equity from ticker_universe
  backfill-crypto                Backfill crypto from ticker_universe
  backfill-all                   Backfill ALL 1,029 symbols from CATEGORY_MAP (12 months)
  backfill-map [category]        Backfill specific category from CATEGORY_MAP

🛠️  Maintenance Commands:
  quality-report                 Get comprehensive data quality report
  verify-schema                  Verify database tables exist
  export-csv [category]          Export data to CSV backups
  clean-old-data                 Clean price data older than 3 years
  test-providers                 Test all API provider connections

Examples:
  npx tsx scripts/data-manager.ts init-universe
  npx tsx scripts/data-manager.ts backfill-all          # Fetch all 1,029 tickers
  npx tsx scripts/data-manager.ts backfill-map equity    # Just equity (500 symbols)
  npx tsx scripts/data-manager.ts quality-report
  npx tsx scripts/data-manager.ts universe-stats
    `)
    process.exit(1)
  }

  try {
    await commands[command]()
    console.log("\n✅ Operation complete")
    process.exit(0)
  } catch (error) {
    console.error("\n❌ Fatal error:", error)
    process.exit(1)
  }
}

process.on("beforeExit", () => {
  console.log("Process exiting...")
})

main().catch((error) => {
  console.error("Uncaught error:", error)
  process.exit(1)
})

async function debugSymbolFormats() {
  console.log("🔍 Symbol Format Diagnostic\n")

  const categories = ["equity", "crypto", "forex", "commodity", "rates-macro", "stress"]

  for (const category of categories) {
    console.log(`\n📂 ${category.toUpperCase()}`)

    // Get symbols from universe
    const { data: universeTickers } = await supabase
      .from("ticker_universe")
      .select("symbol")
      .eq("category", category)
      .eq("active", true)
      .limit(10)

    const universeSymbols = universeTickers?.map((t: any) => t.symbol) || []
    console.log(`   Universe (${universeSymbols.length}):`, universeSymbols.join(", "))

    // Get symbols from financial_data
    const { data: priceData } = await supabase
      .from("financial_data")
      .select("symbol")
      .eq("category", category)
      .limit(10000) // Get all to count distinct

    const uniquePriceSymbols = [...new Set(priceData?.map((p: any) => p.symbol) || [])]
    console.log(
      `   Price Data (${uniquePriceSymbols.length}):`,
      uniquePriceSymbols.slice(0, 10).join(", "),
      uniquePriceSymbols.length > 10 ? "..." : ""
    )

    // Find mismatches
    const mismatches = universeSymbols.filter((s: string) => !uniquePriceSymbols.includes(s))
    if (mismatches.length > 0) {
      console.log(`   ❌ No price data for:`, mismatches.join(", "))
    } else {
      console.log(`   ✅ All universe symbols have price data`)
    }

    // Check bar counts for sample symbols
    for (const symbol of universeSymbols.slice(0, 3)) {
      const { count } = await supabase
        .from("financial_data")
        .select("*", { count: "exact", head: true })
        .eq("symbol", symbol)
        .eq("category", category)

      console.log(`   📊 ${symbol}: ${count || 0} bars`)
    }
  }
}

async function fixSymbolFormats() {
  console.log("🔧 Normalizing symbol formats...\n")

  const fixes = [
    // Crypto
    { from: "BTC", to: "bitcoin", category: "crypto" },
    { from: "ETH", to: "ethereum", category: "crypto" },
    { from: "SOL", to: "solana", category: "crypto" },
    { from: "Bitcoin", to: "bitcoin", category: "crypto" },
    { from: "Ethereum", to: "ethereum", category: "crypto" },
    { from: "Solana", to: "solana", category: "crypto" },

    // Forex
    { from: "EURUSD", to: "EUR/USD", category: "forex" },
    { from: "USDJPY", to: "USD/JPY", category: "forex" },
    { from: "GBPUSD", to: "GBP/USD", category: "forex" },
    { from: "GBPJPY", to: "GBP/JPY", category: "forex" },
    { from: "AUDUSD", to: "AUD/USD", category: "forex" },

    // Commodities
    { from: "GC", to: "GC1!", category: "commodity" },
    { from: "CL", to: "CL1!", category: "commodity" },
    { from: "HG", to: "HG1!", category: "commodity" },
  ]

  for (const fix of fixes) {
    // Update ticker_universe
    const { error: universeError } = await supabase
      .from("ticker_universe")
      .update({ symbol: fix.to })
      .eq("symbol", fix.from)
      .eq("category", fix.category)

    if (!universeError) {
      console.log(`✅ ticker_universe: ${fix.from} → ${fix.to} (${fix.category})`)
    }

    // Update financial_data
    const { error: dataError } = await supabase
      .from("financial_data")
      .update({ symbol: fix.to })
      .eq("symbol", fix.from)
      .eq("category", fix.category)

    if (!dataError) {
      console.log(`✅ financial_data: ${fix.from} → ${fix.to} (${fix.category})`)
    }
  }

  console.log("\n✅ Symbol normalization complete")
}

async function verifyIngressCalculation() {
  console.log("🌞 Verifying ingress calculation\n")

  const today = new Date().toISOString().split("T")[0]

  // FIXED: Use correct event_type filter
  const { data: current } = await supabase
    .from("astro_events")
    .select("*")
    .eq("event_type", "solar_ingress") // Changed from "ingress"
    .eq("body", "Sun")
    .lte("date", today)
    .order("date", { ascending: false })
    .limit(1)

  if (!current || current.length === 0) {
    console.log("❌ No solar_ingress data found in astro_events")
    console.log("   Checking what event_types exist...")

    const { data: types } = await supabase.from("astro_events").select("event_type").limit(100)

    const uniqueTypes = [...new Set(types?.map((t: any) => t.event_type) || [])]
    console.log("   Available event_types:", uniqueTypes.join(", "))
    return
  }

  // Get next ingress
  const { data: next } = await supabase
    .from("astro_events")
    .select("*")
    .eq("event_type", "solar_ingress")
    .eq("body", "Sun")
    .gt("date", today)
    .order("date", { ascending: true })
    .limit(1)

  const currentIngress = current[0]
  const nextIngress = next && next.length > 0 ? next[0] : null

  console.log(`Current Ingress: ${currentIngress.sign || "Unknown"}`)
  console.log(`Start Date: ${currentIngress.date}`)
  console.log(
    `Next Ingress: ${nextIngress?.sign || "Unknown"} on ${nextIngress?.date || "Unknown"}`
  )

  // Calculate days CORRECTLY
  const start = new Date(currentIngress.date)
  const end = nextIngress
    ? new Date(nextIngress.date)
    : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000)
  const now = new Date()

  const daysInPeriod = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  const dayOfPeriod = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const daysRemaining = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  console.log(`\n📊 Period: ${daysInPeriod} days total`)
  console.log(`📍 Current: Day ${dayOfPeriod} of ${daysInPeriod}`)
  console.log(`⏳ Remaining: ${daysRemaining} days`)
  console.log(`📈 Progress: ${Math.round((dayOfPeriod / daysInPeriod) * 100)}%`)

  if (dayOfPeriod > daysInPeriod || dayOfPeriod < 1) {
    console.log(`\n❌ INVALID: dayOfPeriod should be 1-${daysInPeriod}`)
  } else {
    console.log(`\n✅ Ingress calculation is correct`)
  }
}

async function checkCurrentIngress() {
  const today = new Date().toISOString().split("T")[0]
  const { data } = await supabase
    .from("astro_events")
    .select("*")
    .eq("event_type", "solar_ingress") // FIXED
    .eq("body", "Sun")
    .lte("date", today)
    .order("date", { ascending: false })
    .limit(1)
    .single()

  if (data) {
    const days =
      Math.floor((Date.now() - new Date(data.date).getTime()) / (1000 * 60 * 60 * 24)) + 1
    console.log(`🌞 Current ingress: ${data.sign} (${data.date}, Day ${days})`)
  } else {
    console.log("❌ No solar ingress data found")
  }
}
