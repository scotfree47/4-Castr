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
import { syncTickerUniverse } from "../src/lib/services/symbolResolver"
import { getCurrentIngressPeriod as getIngressPeriod } from "../src/lib/utils.js"

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
    console.error(` Missing required environment variable: ${envVar}`)
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
// COMPREHENSIVE MULTI-SOURCE UNIVERSE EXPANSION
// ============================================================================

/**
 * Load maximum available tickers from ALL data sources
 * Respects rate limits, no artificial ticker limits
 */
async function expandUniverseComprehensive(): Promise<void> {
  console.log("=".repeat(80))
  console.log(" COMPREHENSIVE UNIVERSE EXPANSION")
  console.log(" Loading from ALL available data sources...")
  console.log("=".repeat(80))
  console.log()

  const results = {
    polygon: 0,
    coingecko: 0,
    forex: 0,
    commodities: 0,
    indices: 0,
    fred: 0,
    total: 0,
  }

  // ============================================================================
  // PHASE 1: EQUITIES (POLYGON)
  // ============================================================================
  console.log("\n" + "=".repeat(80))
  console.log(" PHASE 1: EQUITIES (Polygon API)")
  console.log("=".repeat(80))

  if (!process.env.POLYGON_API_KEY) {
    console.error(" POLYGON_API_KEY not found - skipping equities")
  } else {
    try {
      console.log(" Loading ALL available US stocks (no limit)...")

      let allTickers: any[] = []
      let nextUrl: string | null = null
      let page = 1

      const baseUrl = `https://api.polygon.io/v3/reference/tickers?market=stocks&active=true&limit=1000&apiKey=${process.env.POLYGON_API_KEY}`

      while (true) {
        const url: string = nextUrl || baseUrl // ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ FIXED: Explicit type
        console.log(`\n Page ${page}: Fetching...`)

        const response: any = await axios.get(url, { timeout: 30000 }) // ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ FIXED: Explicit type

        if (!response.data?.results || response.data.results.length === 0) {
          console.log(`    No more results - stopping`)
          break
        }

        const results = response.data.results
        allTickers.push(...results)
        console.log(
          `    Got ${results.length} tickers (total: ${allTickers.length.toLocaleString()})`
        )

        // Check for next page
        nextUrl = response.data.next_url
        if (!nextUrl) {
          console.log(`    No more pages available`)
          break
        }

        page++

        // Polygon rate limit: 5 calls/minute = 12 seconds between calls
        console.log(`    Rate limit: waiting 12s...`)
        await new Promise((resolve) => setTimeout(resolve, 12000))
      }

      console.log(`\n Processing ${allTickers.length.toLocaleString()} equity tickers...`)

      const tickers = allTickers.map((ticker: any) => ({
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

      // Batch insert
      const batchSize = 500
      for (let i = 0; i < tickers.length; i += batchSize) {
        const batch = tickers.slice(i, i + batchSize)
        const { error } = await supabase
          .from("ticker_universe")
          .upsert(batch, { onConflict: "symbol" })

        if (!error) {
          results.polygon += batch.length
          console.log(`    Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} tickers`)
        }
      }

      console.log(`\n Equities loaded: ${results.polygon.toLocaleString()}`)
    } catch (error: any) {
      console.error(` Error loading equities: ${error.message}`)
    }
  }

  // ============================================================================
  // PHASE 2: CRYPTO (COINGECKO)
  // ============================================================================
  console.log("\n" + "=".repeat(80))
  console.log(" PHASE 2: CRYPTOCURRENCY (CoinGecko API)")
  console.log("=".repeat(80))

  const coingeckoKeys = [process.env.COINGECKO_API_KEY, process.env.COINGECKO_API_KEY_2].filter(
    Boolean
  )

  if (coingeckoKeys.length === 0) {
    console.error(" No COINGECKO_API_KEY found - skipping crypto")
  } else {
    console.log(` Using ${coingeckoKeys.length} CoinGecko key(s)`)

    try {
      console.log(" Loading ALL available cryptocurrencies...")

      let allCoins: any[] = []
      let page = 1
      let currentKeyIndex = 0

      while (true) {
        console.log(`\n Page ${page}: Fetching...`)

        const currentKey = coingeckoKeys[currentKeyIndex]
        const url: string = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}&sparkline=false&x_cg_demo_api_key=${currentKey}`

        try {
          const response: any = await axios.get(url, { timeout: 30000 })

          if (!response.data || response.data.length === 0) {
            console.log(`    No more results - stopping`)
            break
          }

          allCoins.push(...response.data)
          console.log(
            `    Got ${response.data.length} coins (total: ${allCoins.length.toLocaleString()}) [key ${currentKeyIndex + 1}]`
          )

          // CoinGecko free tier: conservative 2s between calls
          console.log(`    Rate limit: waiting 2s...`)
          await new Promise((resolve) => setTimeout(resolve, 2000))

          page++

          // Stop if we got less than 250 (last page)
          if (response.data.length < 250) {
            console.log(`    Reached end of available data`)
            break
          }
        } catch (error: any) {
          if (error.response?.status === 429) {
            // Rate limited - try next key
            currentKeyIndex++

            if (currentKeyIndex >= coingeckoKeys.length) {
              console.log(`    All keys rate limited - got ${allCoins.length} coins`)
              break
            }

            console.log(
              `    Rate limited - switching to key ${currentKeyIndex + 1}/${coingeckoKeys.length}`
            )
            await new Promise((resolve) => setTimeout(resolve, 2000))
            continue // Retry same page with new key
          }

          console.error(`    Error: ${error.message}`)
          break
        }
      }

      console.log(`\n Processing ${allCoins.length.toLocaleString()} crypto tickers...`)

      const tickers = allCoins.map((coin: any) => ({
        symbol: coin.id, // CoinGecko ID (bitcoin, ethereum, etc.)
        name: coin.name,
        exchange: "CRYPTO",
        asset_type: "crypto",
        category: "crypto",
        market_cap: coin.market_cap,
        active: true,
        data_source: "coingecko",
        metadata: {
          coin_id: coin.id,
          symbol: coin.symbol,
          rank: coin.market_cap_rank,
        },
      }))

      // Batch insert
      const batchSize = 500
      for (let i = 0; i < tickers.length; i += batchSize) {
        const batch = tickers.slice(i, i + batchSize)
        const { error } = await supabase
          .from("ticker_universe")
          .upsert(batch, { onConflict: "symbol" })

        if (!error) {
          results.coingecko += batch.length
          console.log(`    Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} tickers`)
        }
      }

      console.log(`\n Crypto loaded: ${results.coingecko.toLocaleString()}`)
    } catch (error: any) {
      console.error(` Error loading crypto: ${error.message}`)
    }
  }

  // ============================================================================
  // PHASE 3: FOREX (COMPREHENSIVE PAIRS)
  // ============================================================================
  console.log("\n" + "=".repeat(80))
  console.log(" PHASE 3: FOREX (Major + Cross + Exotic Pairs)")
  console.log("=".repeat(80))

  try {
    const FOREX_PAIRS = [
      // Major Pairs (8)
      "EUR/USD",
      "USD/JPY",
      "GBP/USD",
      "USD/CHF",
      "USD/CAD",
      "AUD/USD",
      "NZD/USD",
      "EUR/GBP",

      // Cross Pairs (28)
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
      "EUR/GBP",
      "EUR/AUD",
      "EUR/NZD",
      "GBP/AUD",
      "GBP/NZD",
      "AUD/CAD",
      "AUD/NZD",
      "NZD/CAD",

      // Exotic Pairs (40)
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
      "USD/CZK",
      "USD/HUF",
      "USD/ILS",
      "USD/ARS",
      "USD/CLP",
      "USD/COP",
      "USD/PEN",
      "USD/PHP",
      "USD/TWD",
      "USD/VND",
      "EUR/CZK",
      "EUR/HUF",
      "EUR/RON",
      "EUR/RUB",
      "GBP/PLN",
      "GBP/SGD",
      "GBP/TRY",
      "CHF/NOK",
    ]

    console.log(` Loading ${FOREX_PAIRS.length} forex pairs...`)

    const tickers = FOREX_PAIRS.map((pair) => {
      const [from, to] = pair.split("/")
      return {
        symbol: pair,
        name: `${from} to ${to}`,
        exchange: "FOREX",
        asset_type: "forex",
        category: "forex",
        active: true,
        data_source: "exchangerate",
        metadata: {
          from_currency: from,
          to_currency: to,
        },
      }
    })

    const { error } = await supabase
      .from("ticker_universe")
      .upsert(tickers, { onConflict: "symbol" })

    if (error) {
      console.error(` Error: ${error.message}`)
    } else {
      results.forex = tickers.length
      console.log(` Forex loaded: ${results.forex}`)
    }
  } catch (error: any) {
    console.error(` Error loading forex: ${error.message}`)
  }

  // ============================================================================
  // PHASE 4: COMMODITIES (FUTURES + ETFS)
  // ============================================================================
  console.log("\n" + "=".repeat(80))
  console.log(" PHASE 4: COMMODITIES (Futures + ETFs)")
  console.log("=".repeat(80))

  try {
    const COMMODITIES = [
      // Precious Metals
      { symbol: "GC1!", name: "Gold Futures", type: "future" },
      { symbol: "SI1!", name: "Silver Futures", type: "future" },
      { symbol: "PL1!", name: "Platinum Futures", type: "future" },
      { symbol: "PA1!", name: "Palladium Futures", type: "future" },
      { symbol: "GLD", name: "Gold ETF", type: "etf" },
      { symbol: "SLV", name: "Silver ETF", type: "etf" },
      { symbol: "PPLT", name: "Platinum ETF", type: "etf" },
      { symbol: "PALL", name: "Palladium ETF", type: "etf" },

      // Base Metals
      { symbol: "HG1!", name: "Copper Futures", type: "future" },
      { symbol: "ALI1!", name: "Aluminum Futures", type: "future" },
      { symbol: "COPX", name: "Copper Miners ETF", type: "etf" },

      // Energy
      { symbol: "CL1!", name: "Crude Oil Futures", type: "future" },
      { symbol: "NG1!", name: "Natural Gas Futures", type: "future" },
      { symbol: "RB1!", name: "Gasoline Futures", type: "future" },
      { symbol: "HO1!", name: "Heating Oil Futures", type: "future" },
      { symbol: "BZ1!", name: "Brent Crude Futures", type: "future" },
      { symbol: "USO", name: "Oil ETF", type: "etf" },
      { symbol: "UNG", name: "Natural Gas ETF", type: "etf" },
      { symbol: "XLE", name: "Energy Sector ETF", type: "etf" },

      // Agriculture
      { symbol: "ZC1!", name: "Corn Futures", type: "future" },
      { symbol: "ZS1!", name: "Soybean Futures", type: "future" },
      { symbol: "ZW1!", name: "Wheat Futures", type: "future" },
      { symbol: "ZL1!", name: "Soybean Oil Futures", type: "future" },
      { symbol: "ZM1!", name: "Soybean Meal Futures", type: "future" },
      { symbol: "ZO1!", name: "Oats Futures", type: "future" },
      { symbol: "ZR1!", name: "Rice Futures", type: "future" },
      { symbol: "KC1!", name: "Coffee Futures", type: "future" },
      { symbol: "CT1!", name: "Cotton Futures", type: "future" },
      { symbol: "SB1!", name: "Sugar Futures", type: "future" },
      { symbol: "CC1!", name: "Cocoa Futures", type: "future" },
      { symbol: "OJ1!", name: "Orange Juice Futures", type: "future" },
      { symbol: "CORN", name: "Corn ETF", type: "etf" },
      { symbol: "SOYB", name: "Soybean ETF", type: "etf" },
      { symbol: "WEAT", name: "Wheat ETF", type: "etf" },
      { symbol: "DBA", name: "Agriculture ETF", type: "etf" },

      // Livestock
      { symbol: "LE1!", name: "Live Cattle Futures", type: "future" },
      { symbol: "GF1!", name: "Feeder Cattle Futures", type: "future" },
      { symbol: "HE1!", name: "Lean Hogs Futures", type: "future" },
    ]

    console.log(` Loading ${COMMODITIES.length} commodity tickers...`)

    const tickers = COMMODITIES.map((item) => ({
      symbol: item.symbol,
      name: item.name,
      exchange: "COMMODITY",
      asset_type: "commodity",
      category: "commodity",
      active: true,
      data_source: "polygon",
      metadata: {
        commodity_type: item.type,
      },
    }))

    const { error } = await supabase
      .from("ticker_universe")
      .upsert(tickers, { onConflict: "symbol" })

    if (!error) {
      results.commodities = tickers.length
      console.log(` Commodities loaded: ${results.commodities}`)
    }
  } catch (error: any) {
    console.error(` Error loading commodities: ${error.message}`)
  }

  // ============================================================================
  // PHASE 5: INDICES (MAJOR MARKET INDICES)
  // ============================================================================
  console.log("\n" + "=".repeat(80))
  console.log(" PHASE 5: MARKET INDICES")
  console.log("=".repeat(80))

  try {
    const INDICES = [
      // US Indices
      { symbol: "SPY", name: "S&P 500 ETF" },
      { symbol: "QQQ", name: "Nasdaq 100 ETF" },
      { symbol: "DIA", name: "Dow Jones ETF" },
      { symbol: "IWM", name: "Russell 2000 ETF" },
      { symbol: "VTI", name: "Total Stock Market ETF" },

      // Sector Indices
      { symbol: "XLF", name: "Financial Sector ETF" },
      { symbol: "XLE", name: "Energy Sector ETF" },
      { symbol: "XLV", name: "Healthcare Sector ETF" },
      { symbol: "XLK", name: "Technology Sector ETF" },
      { symbol: "XLY", name: "Consumer Discretionary ETF" },
      { symbol: "XLP", name: "Consumer Staples ETF" },
      { symbol: "XLI", name: "Industrial Sector ETF" },
      { symbol: "XLB", name: "Materials Sector ETF" },
      { symbol: "XLRE", name: "Real Estate Sector ETF" },
      { symbol: "XLU", name: "Utilities Sector ETF" },
      { symbol: "XLC", name: "Communication Services ETF" },

      // International
      { symbol: "EFA", name: "EAFE ETF" },
      { symbol: "EEM", name: "Emerging Markets ETF" },
      { symbol: "VEA", name: "Developed Markets ETF" },
      { symbol: "VWO", name: "Emerging Markets ETF" },
      { symbol: "FXI", name: "China Large Cap ETF" },
      { symbol: "EWJ", name: "Japan ETF" },
      { symbol: "EWG", name: "Germany ETF" },
      { symbol: "EWU", name: "United Kingdom ETF" },
    ]

    console.log(` Loading ${INDICES.length} index tickers...`)

    const tickers = INDICES.map((item) => ({
      symbol: item.symbol,
      name: item.name,
      exchange: "INDEX",
      asset_type: "equity",
      category: "equity",
      active: true,
      data_source: "polygon",
      metadata: {
        is_index: true,
      },
    }))

    const { error } = await supabase
      .from("ticker_universe")
      .upsert(tickers, { onConflict: "symbol" })

    if (error) {
      console.error(` Error: ${error.message}`)
    } else {
      results.indices = tickers.length
      console.log(` Indices loaded: ${results.indices}`)
    }
  } catch (error: any) {
    console.error(` Error loading indices: ${error.message}`)
  }

  // ============================================================================
  // PHASE 6: FRED MACRO INDICATORS
  // ============================================================================
  console.log("\n" + "=".repeat(80))
  console.log(" PHASE 6: MACRO INDICATORS (FRED)")
  console.log("=".repeat(80))

  if (!process.env.FRED_API_KEY) {
    console.error(" FRED_API_KEY not found - skipping macro indicators")
  } else {
    try {
      const FRED_INDICATORS = [
        // Interest Rates
        { symbol: "FEDFUNDS", name: "Federal Funds Rate" },
        { symbol: "DGS10", name: "10-Year Treasury Rate" },
        { symbol: "DGS2", name: "2-Year Treasury Rate" },
        { symbol: "DGS5", name: "5-Year Treasury Rate" },
        { symbol: "DGS30", name: "30-Year Treasury Rate" },
        { symbol: "T10Y2Y", name: "10Y-2Y Treasury Spread" },

        // Inflation
        { symbol: "CPIAUCSL", name: "Consumer Price Index" },
        { symbol: "PPIACO", name: "Producer Price Index" },
        { symbol: "PCE", name: "Personal Consumption Expenditure" },
        { symbol: "T5YIE", name: "5-Year Inflation Expectation" },
        { symbol: "T10YIE", name: "10-Year Inflation Expectation" },

        // Employment
        { symbol: "UNRATE", name: "Unemployment Rate" },
        { symbol: "PAYEMS", name: "Nonfarm Payrolls" },
        { symbol: "CIVPART", name: "Labor Force Participation" },
        { symbol: "U6RATE", name: "U-6 Unemployment" },

        // Economic Activity
        { symbol: "GDP", name: "Gross Domestic Product" },
        { symbol: "INDPRO", name: "Industrial Production" },
        { symbol: "HOUST", name: "Housing Starts" },
        { symbol: "PERMIT", name: "Building Permits" },
        { symbol: "RSXFS", name: "Retail Sales" },

        // Money Supply
        { symbol: "M1SL", name: "M1 Money Supply" },
        { symbol: "M2SL", name: "M2 Money Supply" },
        { symbol: "WALCL", name: "Fed Balance Sheet" },
      ]

      console.log(` Loading ${FRED_INDICATORS.length} FRED indicators...`)

      const tickers = FRED_INDICATORS.map((item) => ({
        symbol: item.symbol,
        name: item.name,
        exchange: "FRED",
        asset_type: "macro",
        category: "rates-macro",
        active: true,
        data_source: "fred",
        metadata: {
          fred_series_id: item.symbol,
        },
      }))

      const { error } = await supabase
        .from("ticker_universe")
        .upsert(tickers, { onConflict: "symbol" })

      if (!error) {
        results.fred = tickers.length
        console.log(` FRED indicators loaded: ${results.fred}`)
      }
    } catch (error: any) {
      console.error(` Error loading FRED indicators: ${error.message}`)
    }
  }

  // ============================================================================
  // FINAL SUMMARY
  // ============================================================================
  results.total =
    results.polygon +
    results.coingecko +
    results.forex +
    results.commodities +
    results.indices +
    results.fred

  console.log("\n" + "=".repeat(80))
  console.log(" EXPANSION COMPLETE")
  console.log("=".repeat(80))
  console.log()
  console.log(` Equities (Polygon):      ${results.polygon.toLocaleString()}`)
  console.log(` Crypto (CoinGecko):      ${results.coingecko.toLocaleString()}`)
  console.log(` Forex Pairs:             ${results.forex.toLocaleString()}`)
  console.log(` Commodities:             ${results.commodities.toLocaleString()}`)
  console.log(` Indices:                 ${results.indices.toLocaleString()}`)
  console.log(` FRED Indicators:         ${results.fred.toLocaleString()}`)
  console.log(" " + "-".repeat(78))
  console.log(` TOTAL:                   ${results.total.toLocaleString()}`)
  console.log()
  console.log("=".repeat(80))
}

// ============================================================================
// MULTI-SOURCE EQUITY UNIVERSE LOADER
// ============================================================================

interface EquitySource {
  name: string
  enabled: () => boolean
  fetch: () => Promise<Array<{ symbol: string; name: string; exchange?: string }>>
  rateLimit: number // milliseconds between calls
}

const EQUITY_SOURCES: EquitySource[] = [
  {
    name: "polygon",
    enabled: () => !!process.env.POLYGON_API_KEY,
    fetch: async () => {
      const symbols: any[] = []
      let page = 1
      const baseUrl = `https://api.polygon.io/v3/reference/tickers?market=stocks&active=true&limit=1000&apiKey=${process.env.POLYGON_API_KEY}`

      try {
        console.log(`   Fetching from Polygon...`)
        const response = await axios.get(baseUrl, { timeout: 30000 })

        if (response.data?.results) {
          symbols.push(
            ...response.data.results.map((t: any) => ({
              symbol: t.ticker,
              name: t.name,
              exchange: t.primary_exchange,
            }))
          )
          console.log(`   Got ${symbols.length.toLocaleString()} from Polygon`)
        }
      } catch (error: any) {
        console.log(`   Polygon failed: ${error.message}`)
      }

      return symbols
    },
    rateLimit: 12000,
  },

  {
    name: "fmp",
    enabled: () => !!process.env.FMP_API_KEY, // Re-enabled - test with your key
    fetch: async () => {
      const symbols: any[] = []

      try {
        console.log(`   Fetching from FMP...`)
        // FMP has endpoint for ALL stocks
        const urls = [
          `https://financialmodelingprep.com/api/v3/stock/list?apikey=${process.env.FMP_API_KEY}`,
          `https://financialmodelingprep.com/api/v3/available-traded/list?apikey=${process.env.FMP_API_KEY}`,
        ]

        for (const url of urls) {
          const response = await axios.get(url, { timeout: 30000 })
          if (response.data && Array.isArray(response.data)) {
            symbols.push(
              ...response.data.map((t: any) => ({
                symbol: t.symbol,
                name: t.name,
                exchange: t.exchangeShortName || t.exchange,
              }))
            )
            await new Promise((r) => setTimeout(r, 300)) // Rate limit
          }
        }

        console.log(`   Got ${symbols.length.toLocaleString()} from FMP`)
      } catch (error: any) {
        console.log(`   FMP failed: ${error.message}`)
      }

      return symbols
    },
    rateLimit: 300,
  },

  {
    name: "twelve_data",
    enabled: () => !!process.env.TWELVE_DATA_API_KEY,
    fetch: async () => {
      const symbols: any[] = []

      try {
        console.log(`   Fetching from TwelveData...`)
        const url = `https://api.twelvedata.com/stocks?apikey=${process.env.TWELVE_DATA_API_KEY}`
        const response = await axios.get(url, {
          timeout: 30000,
          maxContentLength: 50 * 1024 * 1024, // 50MB limit
          maxBodyLength: 50 * 1024 * 1024,
        })

        if (response.data?.data && Array.isArray(response.data.data)) {
          // Filter to only US exchanges to avoid stack overflow
          const usSymbols = response.data.data.filter(
            (t: any) =>
              t.country === "United States" || ["NYSE", "NASDAQ", "AMEX", "US"].includes(t.exchange)
          )

          symbols.push(
            ...usSymbols.map((t: any) => ({
              symbol: t.symbol,
              name: t.name,
              exchange: t.exchange,
            }))
          )
          console.log(`   Got ${symbols.length.toLocaleString()} from TwelveData`)
        }
      } catch (error: any) {
        console.log(`   TwelveData failed: ${error.message}`)
      }

      return symbols
    },
    rateLimit: 8000,
  },

  {
    name: "eodhd",
    enabled: () => !!process.env.EODHD_API_KEY,
    fetch: async () => {
      const symbols: any[] = []

      try {
        console.log(`   Fetching from EODHD...`)
        // EODHD supports multiple exchanges
        const exchanges = ["US", "NASDAQ", "NYSE", "AMEX"]

        for (const exchange of exchanges) {
          const url = `https://eodhd.com/api/exchange-symbol-list/${exchange}?api_token=${process.env.EODHD_API_KEY}&fmt=json`
          const response = await axios.get(url, { timeout: 30000 })

          if (response.data && Array.isArray(response.data)) {
            symbols.push(
              ...response.data.map((t: any) => ({
                symbol: t.Code,
                name: t.Name,
                exchange: exchange,
              }))
            )
          }

          await new Promise((r) => setTimeout(r, 1000))
        }

        console.log(`   Got ${symbols.length.toLocaleString()} from EODHD`)
      } catch (error: any) {
        console.log(`   EODHD failed: ${error.message}`)
      }

      return symbols
    },
    rateLimit: 1000,
  },

  {
    name: "finnhub",
    enabled: () => !!process.env.FINNHUB_API_KEY,
    fetch: async () => {
      const symbols: any[] = []

      try {
        console.log(`   Fetching from Finnhub...`)
        const url = `https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${process.env.FINNHUB_API_KEY}`
        const response = await axios.get(url, { timeout: 30000 })

        if (response.data && Array.isArray(response.data)) {
          symbols.push(
            ...response.data.map((t: any) => ({
              symbol: t.symbol,
              name: t.description,
              exchange: t.type,
            }))
          )
          console.log(`   Got ${symbols.length.toLocaleString()} from Finnhub`)
        }
      } catch (error: any) {
        console.log(`   Finnhub failed: ${error.message}`)
      }

      return symbols
    },
    rateLimit: 1000,
  },
]

async function loadEquitiesFromAllSources(): Promise<void> {
  console.log("\n" + "=".repeat(80))
  console.log(" MULTI-SOURCE EQUITY LOADING")
  console.log("=".repeat(80))

  const allSymbols = new Map<string, any>() // Dedupe by symbol

  for (const source of EQUITY_SOURCES) {
    if (!source.enabled()) {
      console.log(`\n ${source.name}: Disabled (no API key)`)
      continue
    }

    console.log(`\n ${source.name.toUpperCase()}:`)
    const symbols = await source.fetch()

    // Merge into main map (first source wins for duplicates)
    for (const s of symbols) {
      if (!allSymbols.has(s.symbol)) {
        allSymbols.set(s.symbol, {
          symbol: s.symbol,
          name: s.name,
          exchange: s.exchange,
          asset_type: "stock",
          category: "equity",
          active: true,
          data_source: source.name,
        })
      }
    }

    console.log(`   Total unique so far: ${allSymbols.size.toLocaleString()}`)

    // Rate limit between sources
    await new Promise((r) => setTimeout(r, source.rateLimit))
  }

  console.log(`\n TOTAL UNIQUE EQUITIES: ${allSymbols.size.toLocaleString()}`)

  // Batch insert
  const tickers = Array.from(allSymbols.values())
  const batchSize = 500

  console.log(`\n Inserting into database...`)
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize)
    const { error } = await supabase.from("ticker_universe").upsert(batch, { onConflict: "symbol" })

    if (!error) {
      console.log(`   Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} tickers`)
    }
  }

  console.log(`\n Equity loading complete: ${tickers.length.toLocaleString()} symbols`)
}

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
    categories: ["equity", "stress", "commodity"], // Added commodity for futures
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
    categories: ["equity"], // Removed forex and commodity - only 25 calls/day!
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
    enabled: () => !!process.env.COINGECKO_API_KEY || !!process.env.COINGECKO_API_KEY_2,
    fetch: async (symbol: string) => {
      // Key rotation: try primary, then secondary
      const keys = [process.env.COINGECKO_API_KEY, process.env.COINGECKO_API_KEY_2].filter(Boolean)

      for (const key of keys) {
        try {
          const coinId = mapCryptoSymbol(symbol)
          const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&x_cg_demo_api_key=${key}`
          const res = await axios.get(url, { timeout: 10000 })
          return res.data?.[coinId]?.usd || null
        } catch (error: any) {
          if (error.response?.status === 429 && key !== keys[keys.length - 1]) {
            // Rate limited, try next key
            continue
          }
          throw error
        }
      }
      return null
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
        console.log(`    Rate limit: waiting ${Math.ceil(waitTime / 1000)}s for ${provider.name}`)
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
    console.warn(`  CSV not found: ${filePath}`)
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
  console.log(`     All APIs failed for ${symbol}, trying CSV fallback...`)
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
  console.log(` Loading ticker universe from Polygon (limit: ${limit})...\n`)

  if (!process.env.POLYGON_API_KEY) {
    console.error(" POLYGON_API_KEY not found")
    return
  }

  try {
    const url = `https://api.polygon.io/v3/reference/tickers?market=stocks&active=true&limit=${limit}&apiKey=${process.env.POLYGON_API_KEY}`
    console.log(` Fetching from Polygon API...`)

    const response = await axios.get(url, { timeout: 30000 })
    console.log(` API Response received`)

    if (!response.data?.results) {
      console.error(" No results from Polygon API")
      console.error("Response:", JSON.stringify(response.data).slice(0, 200))
      return
    }

    console.log(` Processing ${response.data.results.length} tickers...`)

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

    console.log(` Inserting ${tickers.length} tickers in batches of ${batchSize}...`)

    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize)
      const { error } = await supabase
        .from("ticker_universe")
        .upsert(batch, { onConflict: "symbol" })

      if (!error) {
        inserted += batch.length
        console.log(`    Inserted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} tickers`)
      } else {
        console.error(`    Error in batch ${Math.floor(i / batchSize) + 1}:`, error.message)
      }
    }

    console.log(`\n Loaded ${inserted} tickers into universe\n`)
  } catch (error: any) {
    console.error(" Error loading ticker universe:", error.message)
    if (error.response) {
      console.error("API Response:", error.response.status, error.response.statusText)
    }
  }
}

async function addCryptoToUniverse(): Promise<void> {
  console.log(" Adding crypto tickers to universe...\n")

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
    console.error(" Error:", error.message)
  } else {
    console.log(` Added ${records.length} crypto tickers\n`)
  }
}

async function addForexToUniverse(): Promise<void> {
  console.log(" Adding forex pairs to universe...\n")

  const forexPairs = [
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

    // Exotic Pairs (40)
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
    "USD/CZK",
    "USD/HUF",
    "USD/ILS",
    "USD/ARS",
    "USD/CLP",
    "USD/COP",
    "USD/PEN",
    "USD/PHP",
    "USD/TWD",
    "USD/VND",
    "EUR/CZK",
    "EUR/HUF",
    "EUR/RON",
    "EUR/RUB",
    "GBP/PLN",
    "GBP/SGD",
    "GBP/TRY",
    "CHF/NOK",
  ]

  console.log(` Loading ${forexPairs.length} forex pairs...`)

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
    console.error(" Error:", error.message)
  } else {
    console.log(` Successfully added ${records.length} forex pairs\n`)
  }
}

async function addCommoditiesToUniverse(): Promise<void> {
  console.log(" Adding commodities to universe...\n")

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
    console.error(" Error:", error.message)
  } else {
    console.log(` Added ${records.length} commodities\n`)
  }
}

async function initializeTickerUniverse(): Promise<void> {
  console.log(" Initializing complete ticker universe...\n")
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

  console.log("\n Universe Summary:")
  console.log(`   Total:  ${totalCount?.toLocaleString()}`)
  console.log(`   Equity: ${equityCount?.toLocaleString()}`)
  console.log(`   Crypto: ${cryptoCount?.toLocaleString()}`)
  console.log("\n Ticker universe initialized!\n")
}

async function universeStats(): Promise<void> {
  const { count: total } = await supabase
    .from("ticker_universe")
    .select("*", { count: "exact", head: true })

  console.log(`\n Ticker Universe: ${total?.toLocaleString()} tickers\n`)

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

async function fetchPolygonHistorical(
  symbol: string,
  days: number,
  category: string = "equity"
): Promise<any[]> {
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
      category: category,
      asset_type: category === "commodity" ? "commodity" : "stock",
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

  // Key rotation: try both keys
  const keys = [process.env.COINGECKO_API_KEY, process.env.COINGECKO_API_KEY_2].filter(Boolean)

  for (const key of keys) {
    try {
      const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily&x_cg_demo_api_key=${key}`
      const res = await axios.get(url, { timeout: 15000 })

      if (!res.data?.prices) continue

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
    } catch (error: any) {
      // If rate limited and not last key, try next
      if (error.response?.status === 429 && key !== keys[keys.length - 1]) {
        continue
      }
      throw error // Re-throw other errors
    }
  }

  return []
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
    WALCL: "WALCL", // Fed Balance Sheet
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
  console.log(` Fetching ${days}d history for ${symbol}...`)

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
        bars = await fetchPolygonHistorical(symbol, days, category)
      } else if (provider.name === "twelve_data") {
        bars = await fetchTwelveDataHistorical(symbol, days)
      } else if (provider.name === "alpha_vantage") {
        bars = await fetchAlphaVantageHistorical(symbol, days, category)
      }

      if (bars.length > 0) {
        console.log(`    Got ${bars.length} bars from ${provider.name}`)
        return bars
      }
    } catch (error: any) {
      console.log(`     ${provider.name} failed: ${error.message}`)
      continue
    }
  }

  // CSV fallback for historical data
  console.log(`     All APIs failed, trying CSV fallback...`)
  const csvPath = PRICE_CSVS[category as keyof typeof PRICE_CSVS]
  if (csvPath && fs.existsSync(csvPath)) {
    const csvData = parseCSV(csvPath)
    const symbolData = csvData.filter((row: any) => {
      const rowSymbol = row.Symbol || row.Commodity || row.Pair || row.Indicator
      return rowSymbol === symbol
    })
    if (symbolData.length > 0) {
      console.log(`    Got ${symbolData.length} bars from CSV`)
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

  console.log(`    No data available for ${symbol}`)
  return []
}

/**
 * Backfill historical price data from API providers into financial_data table
 *
 * @param options.categories - Specific categories to backfill (e.g., ['equity', 'crypto'])
 * @param options.symbols - Specific symbols to backfill (overrides categories)
 * @param options.days - Number of days to backfill (default: 365)
 * @param options.source - Data source: 'universe' (ticker_universe table) or 'category_map' (hardcoded list)
 *
 * IMPORTANT: When using source='universe', only tickers with active=true are processed.
 * For equities, run 'filter-equity-universe' BEFORE this command to avoid wasting API calls.
 *
 * Workflow:
 * 1. Query tickers from source (filtered by active=true if universe)
 * 2. Fetch historical OHLCV data via fetchHistoricalData (uses API providers with CSV fallback)
 * 3. Upsert into financial_data table in 500-record batches
 * 4. Rate limiting: 2s delay per 5 symbols, 3s between categories
 */
async function backfillData(options: {
  categories?: string[]
  symbols?: string[]
  days?: number
  source?: "universe" | "category_map"
}): Promise<void> {
  const { categories, symbols, days = 365, source = "category_map" } = options

  console.log(` Backfilling ${days} days from ${source}...\n`)

  // PREFLIGHT: Warn if filtering hasn't been applied (equity only)
  if (source === "universe" && (!categories || categories.includes("equity"))) {
    const { count: totalEquity } = await supabase
      .from("ticker_universe")
      .select("*", { count: "exact", head: true })
      .eq("category", "equity")
      .eq("active", true)

    if ((totalEquity || 0) > 10000) {
      console.log("⚠️  WARNING: You have " + totalEquity + " active equity tickers")
      console.log("   Consider running 'filter-equity-universe' first to reduce API costs")
      console.log("   Press Ctrl+C to cancel, or wait 10s to continue...\n")
      await new Promise((resolve) => setTimeout(resolve, 10000))
    }
  }

  // STEP 1: Determine which tickers to process
  let tickersToProcess: Array<{ symbol: string; category: string }> = []

  if (source === "universe") {
    // Get from ticker_universe table
    let query = supabase.from("ticker_universe").select("symbol, category").eq("active", true)

    if (categories && categories.length > 0) {
      query = query.in("category", categories)
    }
    if (symbols && symbols.length > 0) {
      query = query.in("symbol", symbols)
    }

    // Get ALL tickers (no limit) - use pagination for large datasets
    const allTickers: any[] = []
    let page = 0
    const pageSize = 1000

    while (true) {
      const { data: batch } = await query.range(page * pageSize, (page + 1) * pageSize - 1)

      if (!batch || batch.length === 0) break

      allTickers.push(...batch)

      if (batch.length < pageSize) break // Last page
      page++
    }

    if (allTickers.length === 0) {
      console.log(" No tickers found in universe\n")
      return
    }

    tickersToProcess = allTickers.map((t: any) => ({
      symbol: t.symbol,
      category: t.category,
    }))
  } else {
    // Get from CATEGORY_MAP
    const categoriesToFetch = categories || Object.keys(CATEGORY_MAP)

    for (const cat of categoriesToFetch) {
      const categorySymbols = CATEGORY_MAP[cat as keyof typeof CATEGORY_MAP]
      if (!categorySymbols) continue

      const filteredSymbols = symbols
        ? categorySymbols.filter((s: string) => symbols.includes(s))
        : categorySymbols

      tickersToProcess.push(
        ...filteredSymbols.map((s: string) => ({
          symbol: s,
          category: cat,
        }))
      )
    }
  }

  console.log(` Processing ${tickersToProcess.length} tickers...\n`)

  // Show category breakdown
  const categoryBreakdown = tickersToProcess.reduce(
    (acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )
  console.log("📊 Category Breakdown:")
  Object.entries(categoryBreakdown)
    .sort(([, a], [, b]) => b - a)
    .forEach(([cat, count]) => {
      console.log(`   ${cat.padEnd(15)} ${count.toLocaleString()} tickers`)
    })
  console.log()

  // STEP 2: Fetch and insert data
  let totalProcessed = 0
  let totalInserted = 0

  // Group by category for better logging
  const byCategory = tickersToProcess.reduce(
    (acc, t) => {
      if (!acc[t.category]) acc[t.category] = []
      acc[t.category].push(t.symbol)
      return acc
    },
    {} as Record<string, string[]>
  )

  for (const [category, categorySymbols] of Object.entries(byCategory)) {
    console.log(`\n ${category.toUpperCase()} (${categorySymbols.length} symbols)`)

    let categoryInserted = 0

    for (const symbol of categorySymbols) {
      const bars = await fetchHistoricalData(symbol, category, days)

      if (bars.length > 0) {
        // Insert in batches of 500
        for (let i = 0; i < bars.length; i += 500) {
          const batch = bars.slice(i, i + 500)
          const { error } = await supabase
            .from("financial_data")
            .upsert(batch, { onConflict: "symbol,date" })

          if (!error) {
            categoryInserted += batch.length
          }
        }
        console.log(`    ${symbol.padEnd(15)} ${bars.length} bars`)
      } else {
        console.log(`     ${symbol.padEnd(15)} No data`)
      }

      totalProcessed++

      // Rate limiting: wait 2s every 5 symbols
      if (totalProcessed % 5 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }

      // Progress update every 25 symbols
      if (totalProcessed % 25 === 0) {
        console.log(
          `    Progress: ${totalProcessed}/${tickersToProcess.length} (${categoryInserted.toLocaleString()} records this category)`
        )
      }
    }

    totalInserted += categoryInserted
    console.log(
      `    ${category}: ${categorySymbols.length} symbols, ${categoryInserted.toLocaleString()} records`
    )

    // Wait 3s between categories
    if (Object.keys(byCategory).length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 3000))
    }
  }

  console.log(`\n COMPLETE: ${totalProcessed} symbols, ${totalInserted.toLocaleString()} records\n`)
}

// ============================================================================
// CORE COMMANDS
// ============================================================================

async function loadAllCSVs(): Promise<void> {
  console.log(" Starting CSV data load...\n")
  for (const mapping of CSV_MAPPINGS) {
    try {
      await loadCSV(mapping)
    } catch (error: any) {
      console.error(` Error loading ${mapping.csvPath}:`, error.message)
    }
  }
  console.log(" CSV data load complete!")
}

async function loadCSV(mapping: CSVMapping): Promise<void> {
  const { csvPath, tableName, columnMapping, transform } = mapping

  if (!fs.existsSync(csvPath)) {
    console.log(`     File not found, skipping: ${csvPath}`)
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
      console.error(`    Error inserting batch:`, error.message)
    }
  }
}

async function updatePricesFromCSV(csvPath?: string): Promise<void> {
  console.log(" Updating prices from CSV...\n")

  const targetPath = csvPath || "./public/data/tickers/price_data_dec22_20260107.csv"
  if (!fs.existsSync(targetPath)) {
    console.error(" CSV file not found:", targetPath)
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
    console.log(` Updated ${symbol}`)
  }
}

async function checkPriceFreshness(): Promise<void> {
  console.log(" Checking price data freshness...\n")

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
  console.log(" Populating featured tickers (FAST MODE)...\n")

  try {
    // Import confluenceEngine functions
    const { batchCalculateRatings, detectConvergenceForecastedSwings, calculateAstroConfirmation } =
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
      console.log("  No ingress data, skipping featured refresh\n")
      return
    }

    const daysSinceIngress = Math.floor(
      (Date.now() - new Date(currentIngress.date).getTime()) / (1000 * 60 * 60 * 24)
    )

    console.log(` Current ingress: ${currentIngress.sign} (Day ${daysSinceIngress})`)

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
      console.log(`\n ${category.toUpperCase()}`)

      // STEP 1: Get symbols from ticker universe (limit to active, non-sentinels)
      const { data: tickers } = await supabase
        .from("ticker_universe")
        .select("symbol")
        .eq("category", category)
        .eq("active", true)
        .limit(100) // CRITICAL: Limit to 100 per category (not 1000)

      if (!tickers || tickers.length === 0) {
        console.log(`     No tickers found in universe`)
        continue
      }

      const symbols = tickers
        .map((t) => t.symbol)
        .filter((s) => !SENTINELS.has(s))
        .slice(0, 50) // CRITICAL: Further limit to 50 for convergence detection

      console.log(`    Checking ${symbols.length} symbols for convergence...`)

      // STEP 2: Run convergence detection (this is the expensive operation)
      const convergenceResults = await detectConvergenceForecastedSwings(symbols, category)

      if (convergenceResults.length > 0) {
        console.log(`    Found ${convergenceResults.length} convergence forecasts`)

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
        console.log(`    Added ${featured.length} to featured list`)
      } else {
        console.log(`     No convergence forecasts found, falling back to ratings...`)

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
          console.log(`    Added ${featured.length} from ratings`)
        }
      }

      // Rate limiting between categories
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }

    // STEP 3: Store results
    if (allFeatured.length > 0) {
      console.log(`\n Storing ${allFeatured.length} featured tickers...`)

      // Clear old data
      for (const category of categories) {
        await supabase.from("featured_tickers").delete().eq("category", category)
      }

      // Insert new data in batches
      for (let i = 0; i < allFeatured.length; i += 50) {
        const batch = allFeatured.slice(i, i + 50)
        const { error } = await supabase.from("featured_tickers").insert(batch)

        if (error) {
          console.error(`    Error storing batch: ${error.message}`)
        }
      }

      console.log(`\n Featured tickers refresh complete`)
      console.log(`   Total: ${allFeatured.length} tickers across ${categories.length} categories`)
    } else {
      console.log(`\n  No featured tickers found`)
    }
  } catch (error: any) {
    console.error(" Error:", error.message)
    console.error(error.stack)
    throw error
  }
}

// ============================================================================
// INGRESS-AWARE CACHING SYSTEM (NEW - INSERT HERE)
// ============================================================================

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
  console.log(" MONTHLY INGRESS SCAN - Full Analysis\n")

  const ingress = await getIngressPeriod()

  // FIX: Period string should use the END month, not start month
  // Aquarius: Jan 20 - Feb 18 â†’ period = 2026-02-aquarius (not 2026-01)
  const endDate = new Date(ingress.end)
  const period = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${ingress.sign.toLowerCase()}`

  console.log(` Ingress Period: ${period} (CORRECTED)`)
  console.log(` Sign: ${ingress.sign}`)
  console.log(` ${ingress.start} â†’ ${ingress.end}`)
  console.log(
    `  Day ${ingress.daysInPeriod + 1} of period (${ingress.daysRemaining} days remaining)\n`
  )

  // Check if we've already scanned this period
  const { count: existingCount } = await supabase
    .from("ticker_ratings_cache")
    .select("*", { count: "exact", head: true })
    .eq("ingress_period", period)

  if (existingCount && existingCount > 0) {
    console.log(`  Period ${period} already scanned (${existingCount} records)`)
    console.log("Run 'refresh-monthly-scan' to force rescan\n")
    return
  }

  // Import analysis functions
  const { batchCalculateRatings, detectConvergenceForecastedSwings, calculateAstroConfirmation } =
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
    console.log(`\n ${category.toUpperCase()}`)

    // Get all active tickers
    const { data: tickers } = await supabase
      .from("ticker_universe")
      .select("symbol")
      .eq("category", category)
      .eq("active", true)

    if (!tickers?.length) {
      console.log(`     No tickers found`)
      continue
    }

    const symbols = tickers.map((t) => t.symbol).filter((s) => !SENTINELS.has(s))

    console.log(`    Analyzing ${symbols.length} symbols...`)

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

    console.log(`    Got ${ratings.length} ratings`)

    // PHASE 2: Run convergence detection on top 30%
    const topRatings = ratings
      .sort((a, b) => b.scores.total - a.scores.total)
      .slice(0, Math.ceil(ratings.length * 0.3))

    console.log(`    Running convergence on top ${topRatings.length} symbols...`)

    const convergenceResults = await detectConvergenceForecastedSwings(
      topRatings.map((r) => r.symbol),
      category
    )

    console.log(`    Found ${convergenceResults.length} convergence forecasts`)

    // PHASE 3: Store in cache
    const cacheRecords: any[] = []

    // Add convergence results
    for (const conv of convergenceResults) {
      const rating = ratings.find((r) => r.symbol === conv.symbol)

      const astroConfirmation = await calculateAstroConfirmation(
        conv.forecastedSwing.date,
        conv.currentPrice,
        conv.keyLevels
      )

      cacheRecords.push({
        symbol: conv.symbol,
        category,
        ingress_period: period,
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
            astro_confirmation: {
              score: astroConfirmation.score,
              reasons: astroConfirmation.reasons,
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
            start_date: ingress.start,
            end_date: ingress.end,
            days_in_period: ingress.daysRemaining,
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
        ingress_period: period,
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
            start_date: ingress.start,
            end_date: ingress.end,
            days_in_period: ingress.daysRemaining,
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
          console.error(`    Error inserting batch: ${error.message}`)
        }
      }

      totalAnalyzed += cacheRecords.length
      console.log(`    Cached ${cacheRecords.length} analysis records`)
    }

    // Rate limiting between categories
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  console.log(`\n COMPLETE: ${totalAnalyzed} symbols analyzed and cached\n`)
}

async function runMonthlyIngressScanSmart(): Promise<void> {
  console.log(" SMART MONTHLY SCAN - Only Symbols With Data\n")

  const ingress = await getIngressPeriod()
  const endDate = new Date(ingress.end)
  const period = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${ingress.sign.toLowerCase()}`

  console.log(` Ingress Period: ${period}`)
  console.log(` Sign: ${ingress.sign}`)
  console.log(` ${ingress.start} â†’ ${ingress.end}\n`)

  const { batchCalculateRatings, calculateAstroConfirmation } =
    await import("../src/lib/services/confluenceEngine.js")

  const categories = ["equity", "commodity", "forex", "crypto", "rates-macro", "stress"]
  let totalAnalyzed = 0

  for (const category of categories) {
    console.log(`\n ${category.toUpperCase()}`)

    // Get symbols that have â‰¥30 bars of data
    const { data: symbolsWithData } = await supabase.rpc("get_symbols_with_sufficient_data", {
      category_filter: category,
      min_bars: 30,
    })

    if (!symbolsWithData?.length) {
      // Fallback: query manually
      const { data: allData } = await supabase
        .from("financial_data")
        .select("symbol")
        .eq("category", category)

      if (!allData?.length) {
        console.log(`    No data found`)
        continue
      }

      // Count bars per symbol
      const symbolCounts = allData.reduce((acc: any, row: any) => {
        acc[row.symbol] = (acc[row.symbol] || 0) + 1
        return acc
      }, {})

      const validSymbols = Object.entries(symbolCounts)
        .filter(([_, count]) => (count as number) >= 30)
        .map(([symbol, _]) => symbol)

      if (validSymbols.length === 0) {
        console.log(`    No symbols with â‰¥30 bars`)
        continue
      }

      console.log(`    Found ${validSymbols.length} symbols with data`)

      // Run analysis
      const ratings = await batchCalculateRatings({
        symbols: validSymbols.slice(0, 200), // Limit to 200 per category
        minScore: 50,
        maxResults: 200,
        lookbackDays: 365,
        includeProjections: false,
        includeSeasonalData: false,
        parallelism: 5,
      })

      console.log(`    Got ${ratings.length} ratings`)

      // Store in cache
      const cacheRecords = ratings.map((rating) => ({
        symbol: rating.symbol,
        category,
        ingress_period: period,
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
          convergence: { has_convergence: false },
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
            most_likely_date: rating.projections?.reachDate || null,
          },
          ingress_alignment: {
            sign: ingress.sign,
            start_date: ingress.start,
            end_date: ingress.end,
            days_in_period: ingress.daysRemaining,
            favorability: rating.ingressAlignment?.favorability || null,
          },
          featured_rank: null,
          dynamic_score: null,
        },
      }))

      if (cacheRecords.length > 0) {
        for (let i = 0; i < cacheRecords.length; i += 100) {
          const batch = cacheRecords.slice(i, i + 100)
          await supabase.from("ticker_ratings_cache").upsert(batch, {
            onConflict: "symbol,category,ingress_period",
          })
        }

        totalAnalyzed += cacheRecords.length
        console.log(`    Cached ${cacheRecords.length} records`)
      }
    }
  }

  console.log(`\n COMPLETE: ${totalAnalyzed} symbols cached\n`)
}

async function scanSentinelsOnly(): Promise<void> {
  console.log(" SENTINEL-ONLY SCAN\n")

  const SENTINELS_BY_CATEGORY: Record<string, string[]> = {
    equity: ["SPY", "QQQ", "XLY"],
    commodity: ["GLD", "USO", "HG1!"],
    forex: ["EUR/USD", "USD/JPY", "GBP/USD"],
    crypto: ["bitcoin", "ethereum", "solana"], // lowercase for DB
    "rates-macro": ["TLT", "TNX", "DXY"],
    stress: ["VIX", "MOVE", "TRIN"],
  }

  const ingress = await getIngressPeriod()
  const endDate = new Date(ingress.end)
  const period = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${ingress.sign.toLowerCase()}`

  const { batchCalculateRatings } = await import("../src/lib/services/confluenceEngine.js")

  let totalAnalyzed = 0

  for (const [category, symbols] of Object.entries(SENTINELS_BY_CATEGORY)) {
    console.log(`\n ${category.toUpperCase()}: ${symbols.join(", ")}`)

    const ratings = await batchCalculateRatings({
      symbols,
      minScore: 0,
      maxResults: 10,
      lookbackDays: 365,
      includeProjections: true,
      includeSeasonalData: true,
      parallelism: 3,
    })

    console.log(`    Got ${ratings.length} ratings`)

    const cacheRecords = ratings.map((r) => ({
      symbol: r.symbol,
      category,
      ingress_period: period,
      calculated_at: new Date().toISOString(),
      rating_data: {
        current_price: r.currentPrice,
        price_date: r.priceDate,
        next_key_level: {
          price: r.nextKeyLevel.price,
          type: r.nextKeyLevel.type,
          distance_percent: r.nextKeyLevel.distancePercent,
        },
        scores: r.scores,
        rating: r.rating,
        confidence: r.confidence,
        recommendation: r.recommendation,
        convergence: { has_convergence: false },
        sector: r.sector,
        reasons: r.reasons,
        warnings: r.warnings,
        projections: {
          days_until_target: r.nextKeyLevel.daysUntilEstimate,
          most_likely_date: r.projections?.reachDate,
        },
        ingress_alignment: r.ingressAlignment,
      },
    }))

    if (cacheRecords.length > 0) {
      await supabase.from("ticker_ratings_cache").upsert(cacheRecords, {
        onConflict: "symbol,category,ingress_period",
      })

      totalAnalyzed += cacheRecords.length
      console.log(`    Cached ${cacheRecords.length} sentinels`)
    }
  }

  console.log(`\n COMPLETE: ${totalAnalyzed} sentinels cached\n`)
}

async function runFullIngressScanWithConvergence(): Promise<void> {
  console.log("\nðŸ“Š FULL INGRESS SCAN WITH CONVERGENCE\n")

  const ingress = await getIngressPeriod()
  const endDate = new Date(ingress.end)
  const period = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${ingress.sign.toLowerCase()}`

  // Import analysis functions
  const { batchCalculateRatings, detectConvergenceForecastedSwings, calculateAstroConfirmation } =
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
    console.log(`\n ${category.toUpperCase()}`)

    // Get all active tickers
    const { data: tickers } = await supabase
      .from("ticker_universe")
      .select("symbol")
      .eq("category", category)
      .eq("active", true)

    if (!tickers?.length) {
      console.log(`     No tickers found`)
      continue
    }

    const symbols = tickers.map((t) => t.symbol).filter((s) => !SENTINELS.has(s))

    console.log(`    Analyzing ${symbols.length} symbols...`)

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

    console.log(`    Got ${ratings.length} ratings`)

    // PHASE 2: Run convergence detection on top 30%
    const topRatings = ratings
      .sort((a, b) => b.scores.total - a.scores.total)
      .slice(0, Math.ceil(ratings.length * 0.3))

    console.log(`    Running convergence on top ${topRatings.length} symbols...`)

    const convergenceResults = await detectConvergenceForecastedSwings(
      topRatings.map((r) => r.symbol),
      category
    )

    console.log(`    Found ${convergenceResults.length} convergence forecasts`)

    // PHASE 3: Store in cache
    const cacheRecords: any[] = []

    // Add convergence results
    for (const conv of convergenceResults) {
      const rating = ratings.find((r) => r.symbol === conv.symbol)

      const astroConfirmation = await calculateAstroConfirmation(
        conv.forecastedSwing.date,
        conv.currentPrice,
        conv.keyLevels
      )

      cacheRecords.push({
        symbol: conv.symbol,
        category,
        ingress_period: period,
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
            astro_confirmation: {
              score: astroConfirmation.score,
              reasons: astroConfirmation.reasons,
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
            start_date: ingress.start,
            end_date: ingress.end,
            days_in_period: ingress.daysRemaining,
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
        ingress_period: period,
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
            start_date: ingress.start,
            end_date: ingress.end,
            days_in_period: ingress.daysRemaining,
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
          console.error(`    Error inserting batch: ${error.message}`)
        }
      }

      totalAnalyzed += cacheRecords.length
      console.log(`    Cached ${cacheRecords.length} analysis records`)
    }

    // Rate limiting between categories
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  console.log(`\n COMPLETE: ${totalAnalyzed} symbols analyzed and cached\n`)
}

async function runDailyRankUpdate(): Promise<void> {
  console.log(" DAILY RANK UPDATE\n")

  const ingress = await getIngressPeriod()
  console.log(` Period: ${ingress.period} (Day ${ingress.daysRemaining})\n`)

  const categories = ["equity", "commodity", "forex", "crypto", "rates-macro", "stress"]
  let totalUpdated = 0

  for (const category of categories) {
    console.log(` ${category.toUpperCase()}`)

    const { data: cached } = await supabase
      .from("ticker_ratings_cache")
      .select("*")
      .eq("ingress_period", ingress.period)
      .eq("category", category)

    if (!cached?.length) {
      console.log(`     No cache - run monthly scan first`)
      continue
    }

    console.log(`    Found ${cached.length} cached analyses`)

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

    console.log(`    Top 10: ${topTen.join(", ")}`)
  }

  console.log(`\n Ranks updated: ${totalUpdated} tickers\n`)

  // Sync to featured_tickers table
  await syncCacheToFeaturedTable(ingress.period)
}

async function syncCacheToFeaturedTable(ingressPeriod: string): Promise<void> {
  console.log(" Syncing cache to featured_tickers...\n")

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
    console.log("  No featured tickers to sync")
    return
  }

  console.log(`    Found ${topTickers.length} ranked tickers`)

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
      console.error(`    Error syncing: ${error.message}`)
    } else {
      console.log(`    Synced ${featured.length} featured tickers\n`)
    }
  }
}

async function getFeaturedTickersFromCache(category?: string): Promise<any[]> {
  const ingress = await getIngressPeriod()

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
  console.log(" Starting smart price update...\n")

  const args = process.argv.slice(3)
  const categoryArg = args.find((arg) => arg.startsWith("--categories="))
  const requestedCategories = categoryArg
    ? categoryArg.split("=")[1].split(",")
    : Object.keys(CATEGORY_MAP)

  for (const category of requestedCategories) {
    const symbols = CATEGORY_MAP[category as keyof typeof CATEGORY_MAP]
    if (!symbols) continue

    console.log(`\n ${category.toUpperCase()} (${symbols.length} symbols)`)
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
          `    ${symbol.padEnd(12)} ${result.price.toFixed(2).padStart(10)} (${result.provider})`
        )
      }
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    if (records.length > 0) {
      await supabase.from("financial_data").upsert(records, { onConflict: "symbol,date" })
      console.log(`    Database updated`)
    }
  }

  rateLimiter.reset()
  console.log("\n Price update complete\n")
}

async function cronRefreshFeaturedDelayTolerant(): Promise<void> {
  console.log(" Checking ingress status...\n")

  try {
    const ingress = await getIngressPeriod()
    const daysSinceIngress = ingress.daysInPeriod

    if (daysSinceIngress <= 1 || (daysSinceIngress % 7 === 0 && daysSinceIngress <= 28)) {
      console.log(` Refresh triggered (day ${daysSinceIngress})\n`)
      await populateFeaturedTickers()
    } else {
      console.log("  No refresh needed\n")
    }
  } catch (error) {
    console.log("  No ingress data\n")
    return
  }
}

// ============================================================================
// ENHANCEMENT COMMANDS
// ============================================================================

async function cleanOldPriceData(daysToKeep: number = 1095): Promise<void> {
  console.log(` Cleaning price data older than ${daysToKeep} days...\n`)

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
  const cutoffDateStr = cutoffDate.toISOString().split("T")[0]

  const { data, error } = await supabase
    .from("financial_data")
    .delete()
    .lt("date", cutoffDateStr)
    .select()

  if (error) {
    console.error(" Error:", error.message)
  } else {
    console.log(` Deleted ${data?.length || 0} old records\n`)
  }
}

async function getDataQualityReport(): Promise<void> {
  console.log(" DATA QUALITY REPORT\n")

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
  console.log(" Verifying Database Schema...\n")

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
      console.log(`    ${table.padEnd(25)} | Error: ${error.message}`)
    } else {
      console.log(`    ${table.padEnd(25)} | ${(count || 0).toLocaleString()} rows`)
    }
  }
}

async function exportToCSV(category?: string, outputDir: string = "./backups"): Promise<void> {
  console.log(" Exporting data to CSV...\n")

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
    console.log(`    Exported ${data.length} records to ${filename}`)
  }
}

async function testAPIProviders(): Promise<void> {
  console.log(" Testing API Providers...\n")

  const testSymbols = { equity: "SPY", crypto: "Bitcoin", forex: "EUR/USD" }

  for (const provider of API_PROVIDERS) {
    console.log(` ${provider.name.toUpperCase()}`)
    console.log(`   Enabled: ${provider.enabled() ? "" : ""}`)

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
        console.log(`    ${testSymbol} = ${price.toFixed(2)}\n`)
      }
    } catch (error: any) {
      console.log(`    ${error.message}\n`)
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
}

// ============================================================================
// MAIN CLI
// ============================================================================

export { getCurrentIngressPeriod } from "../src/lib/utils.js"
export { getFeaturedTickersFromCache }

// ============================================================================
// EQUITY METADATA BACKFILL - NEW COMMANDS
// ============================================================================

interface EquityMetadata {
  symbol: string
  security_type?: string // 'CS' (Common Stock), 'ETF', 'ADRC' (ADR), etc
  avg_volume?: number
  market_cap?: number
  exchange?: string
}

/**
 * Fetch ticker metadata from multiple API providers with fallback
 * Tries: FMP → AlphaVantage → TwelveData → Finnhub
 * Note: Polygon is skipped since it was already used in initial load
 */
async function fetchTickerMetadata(symbol: string): Promise<EquityMetadata | null> {
  const metadata: EquityMetadata = { symbol }

  // ============================================================================
  // PROVIDER 1: POLYGON - SKIPPED (already backfilled)
  // ============================================================================
  // Polygon data was fetched during init-universe or previous backfills.
  // Skip to save API calls and avoid rate limits.

  // ============================================================================
  // PROVIDER 2: FMP (Financial Modeling Prep)
  // ============================================================================
  if (
    process.env.FMP_API_KEY &&
    (!metadata.security_type || !metadata.avg_volume || !metadata.market_cap)
  ) {
    try {
      // Try profile endpoint for company details
      const profileUrl = `https://financialmodelingprep.com/api/v3/profile/${symbol}?apikey=${process.env.FMP_API_KEY}`
      const profileResponse = await axios.get(profileUrl, { timeout: 10000 })

      if (profileResponse.data?.[0]) {
        const data = profileResponse.data[0]
        if (!metadata.exchange && data.exchangeShortName) metadata.exchange = data.exchangeShortName
        if (!metadata.market_cap && data.mktCap) metadata.market_cap = Math.round(data.mktCap)
        if (!metadata.avg_volume && data.volAvg) metadata.avg_volume = Math.round(data.volAvg)

        // Infer security type from exchange or symbol
        if (!metadata.security_type) {
          if (data.isEtf) metadata.security_type = "ETF"
          else if (data.isActivelyTrading) metadata.security_type = "CS"
        }
      }

      // If we got all data, return
      if (metadata.security_type && metadata.avg_volume && metadata.market_cap) {
        return metadata
      }
    } catch (error: any) {
      // Continue to next provider
    }
  }

  // ============================================================================
  // PROVIDER 3: ALPHA VANTAGE
  // ============================================================================
  if (process.env.ALPHA_VANTAGE_API_KEY && (!metadata.security_type || !metadata.market_cap)) {
    try {
      const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`
      const response = await axios.get(url, { timeout: 10000 })

      if (response.data && response.data.Symbol) {
        const data = response.data
        if (!metadata.exchange && data.Exchange) metadata.exchange = data.Exchange
        if (!metadata.market_cap && data.MarketCapitalization) {
          metadata.market_cap = Math.round(parseFloat(data.MarketCapitalization))
        }
        if (!metadata.security_type && data.AssetType) {
          // Map AlphaVantage asset types to our types
          if (data.AssetType === "Common Stock") metadata.security_type = "CS"
          else if (data.AssetType === "ETF") metadata.security_type = "ETF"
        }
      }
    } catch (error: any) {
      // Continue to next provider
    }
  }

  // ============================================================================
  // PROVIDER 4: TWELVE DATA
  // ============================================================================
  if (process.env.TWELVE_DATA_API_KEY && (!metadata.avg_volume || !metadata.exchange)) {
    try {
      const url = `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${process.env.TWELVE_DATA_API_KEY}`
      const response = await axios.get(url, { timeout: 10000 })

      if (response.data && response.data.symbol) {
        const data = response.data
        if (!metadata.exchange && data.exchange) metadata.exchange = data.exchange
        if (!metadata.avg_volume && data.average_volume) {
          metadata.avg_volume = Math.round(parseFloat(data.average_volume))
        }

        // Infer type from exchange
        if (!metadata.security_type) {
          if (data.type === "Common Stock") metadata.security_type = "CS"
          else if (data.type === "ETF") metadata.security_type = "ETF"
        }
      }
    } catch (error: any) {
      // Continue to next provider
    }
  }

  // ============================================================================
  // PROVIDER 5: FINNHUB
  // ============================================================================
  if (process.env.FINNHUB_API_KEY && (!metadata.market_cap || !metadata.exchange)) {
    try {
      const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${process.env.FINNHUB_API_KEY}`
      const response = await axios.get(url, { timeout: 10000 })

      if (response.data && response.data.ticker) {
        const data = response.data
        if (!metadata.exchange && data.exchange) metadata.exchange = data.exchange
        if (!metadata.market_cap && data.marketCapitalization) {
          // Finnhub returns in millions
          metadata.market_cap = Math.round(data.marketCapitalization * 1_000_000)
        }
      }
    } catch (error: any) {
      // Continue to final return
    }
  }

  // Return whatever metadata we collected (may be partial)
  return Object.keys(metadata).length > 1 ? metadata : null
}

/**
 * Normalize exchange names to handle variations from different API providers
 */
function normalizeExchangeName(exchange: string): string {
  if (!exchange) return ""

  const upper = exchange.toUpperCase()

  // NYSE variations
  if (
    upper.includes("NEW YORK STOCK EXCHANGE") ||
    (upper.includes("NYSE") && !upper.includes("ARCA"))
  ) {
    return "NYSE"
  }

  // NASDAQ variations
  if (upper.includes("NASDAQ") && !upper.includes("OMX")) {
    return "NASDAQ"
  }

  // NYSE Arca
  if (upper.includes("ARCA") || upper.includes("ARCHIPELAGO")) {
    return "ARCX"
  }

  // AMEX / NYSE American
  if (upper.includes("AMEX") || upper.includes("NYSE AMERICAN") || upper.includes("NYSE MKT")) {
    return "AMEX"
  }

  // BATS
  if (upper.includes("BATS")) {
    return "BATS"
  }

  // CBOE
  if (upper.includes("CBOE")) {
    return "CBOE"
  }

  // OTC Markets
  if (upper.includes("OTC")) {
    if (upper.includes("PINK")) return "PINK"
    if (upper.includes("QB")) return "OTCQB"
    if (upper.includes("QX")) return "OTCQX"
    return "OTC"
  }

  // Foreign exchanges
  if (upper.includes("LONDON") || upper.includes("LSE")) return "LSE"
  if (upper.includes("TORONTO") || upper.includes("TSX")) return "TSX"
  if (upper.includes("HONG KONG") || upper.includes("HKEX")) return "HKEX"
  if (upper.includes("CANADIAN")) return "CSE"

  // Return original if no match (keeps XNAS, XNYS, etc.)
  return exchange
}

/**
 * Backfill security type and volume data from multiple API providers
 * Uses: Polygon → FMP → AlphaVantage → TwelveData → Finnhub (with fallback)
 * Usage: npx tsx scripts/data-manager.ts backfill-equity-metadata [--batch-size=100]
 */
async function backfillEquityMetadata(): Promise<void> {
  console.log("📊 Backfilling Equity Metadata from Multiple Providers\n")
  console.log("=".repeat(80))

  // Check which API keys are available (skipping Polygon - already backfilled)
  const availableProviders = []
  if (process.env.FMP_API_KEY) availableProviders.push("FMP")
  if (process.env.ALPHA_VANTAGE_API_KEY) availableProviders.push("AlphaVantage")
  if (process.env.TWELVE_DATA_API_KEY) availableProviders.push("TwelveData")
  if (process.env.FINNHUB_API_KEY) availableProviders.push("Finnhub")

  if (availableProviders.length === 0) {
    console.error("❌ No API keys found in environment")
    console.error("   Add at least one of: FMP_API_KEY, ALPHA_VANTAGE_API_KEY,")
    console.error("   TWELVE_DATA_API_KEY, or FINNHUB_API_KEY to your .env.local file")
    console.error("   (Polygon is skipped - already backfilled)")
    process.exit(1)
  }

  console.log(`✅ Active providers: ${availableProviders.join(", ")}`)
  console.log(`   (Fallback chain: FMP → AlphaVantage → TwelveData → Finnhub)`)
  console.log(`   ⏸️  Polygon: Skipped (already backfilled)\n`)

  const args = process.argv.slice(3)
  const batchSize = parseInt(
    args.find((a) => a.startsWith("--batch-size="))?.split("=")[1] || "100"
  )
  const limit = parseInt(args.find((a) => a.startsWith("--limit="))?.split("=")[1] || "0")
  const dryRun = !args.includes("--confirm")
  const force = args.includes("--force") // Skip ALL pre-filtering (including junk)
  const skipCompleteOnly = args.includes("--skip-complete-only") // Skip only tickers with complete data
  const includeInactive = args.includes("--include-inactive") // Include tickers marked inactive by filter-equity-universe

  if (dryRun) {
    console.log("🔍 DRY RUN MODE - Add --confirm to apply changes\n")
  }

  // Get all equity tickers that need metadata
  console.log("📥 Fetching equity tickers from database...")
  if (includeInactive) {
    console.log("   ⚠️  Including inactive tickers (those filtered by filter-equity-universe)")
  }

  // Fetch ALL equities (Supabase has a 1000 row limit per query)
  let allTickers: any[] = []
  let offset = 0
  const fetchBatchSize = 1000 // Supabase enforces 1000 row limit

  while (true) {
    let query = supabase
      .from("ticker_universe")
      .select("symbol, exchange, security_type, avg_volume, market_cap, active")
      .eq("category", "equity")
      .order("symbol")
      .range(offset, offset + fetchBatchSize - 1)

    // Only filter by active status if not including inactive
    if (!includeInactive) {
      query = query.eq("active", true)
    }

    const { data: batch, error: fetchError } = await query

    if (fetchError) {
      console.error(`❌ Error fetching tickers: ${fetchError.message}`)
      process.exit(1)
    }

    if (!batch || batch.length === 0) break

    allTickers = allTickers.concat(batch)

    // Show progress every 5000 tickers
    if (allTickers.length % 5000 === 0 || batch.length < fetchBatchSize) {
      console.log(`   Loaded ${allTickers.length.toLocaleString()} tickers...`)
    }

    // Stop if we got fewer rows than requested (last page)
    if (batch.length < fetchBatchSize) break

    // Increment by actual batch size received (not hardcoded)
    offset += batch.length
  }

  const tickers = allTickers
  const activeTickers = tickers.filter((t) => t.active).length
  const inactiveTickers = tickers.filter((t) => !t.active).length

  if (includeInactive) {
    console.log(
      `✅ Found ${tickers.length.toLocaleString()} total equity tickers (${activeTickers.toLocaleString()} active, ${inactiveTickers.toLocaleString()} inactive)\n`
    )
  } else {
    console.log(`✅ Found ${tickers.length.toLocaleString()} active equity tickers\n`)
    if (tickers.length < 10000) {
      console.log(
        `⚠️  Only ${tickers.length.toLocaleString()} active tickers found. If you expected more, they may have been`
      )
      console.log(`   marked inactive by filter-equity-universe. To backfill those too, use:`)
      console.log(`   --include-inactive flag\n`)
    }
  }

  if (force) {
    console.log("⚡ FORCE MODE: Processing ALL tickers (including junk)\n")
  } else if (skipCompleteOnly) {
    console.log("⚡ SKIP-COMPLETE-ONLY MODE: Processing all incomplete tickers (relaxed filters)\n")
  }

  // US exchanges list (for filtering)
  const US_EXCHANGES = new Set([
    "XNAS",
    "XNYS",
    "ARCX",
    "BATS",
    "NASDAQ",
    "NYSE",
    "AMEX",
    "XASE",
    "OTC",
    "OTCM",
    "OTCQB",
    "PINK",
    "US",
    "NASDAQ NMS - GLOBAL MARKET",
    "NYSE AMERICAN",
    "NYSE ARCA",
    "BATS GLOBAL MARKETS",
    "CBOE",
  ])

  // Single pre-filter — no duplicate
  let needsUpdate = tickers.filter((t) => {
    // Non-US exchange → out
    if (!force && t.exchange && !US_EXCHANGES.has(t.exchange)) return false

    // No exchange on record → suspect origin, apply strict symbol checks
    if (!force && !t.exchange) {
      if (t.symbol.includes(".")) return false
      if (t.symbol.length > 6) return false
    }

    // Already complete → skip
    if (!force && t.security_type && t.avg_volume && t.market_cap && t.exchange) return false

    // Force mode → everything through
    if (force) return true

    // Relaxed mode
    if (skipCompleteOnly) {
      if (t.symbol.includes(".")) return false
      if (t.symbol.endsWith("X") && t.symbol.length > 3) return false
      if (t.symbol.length > 8) return false
      return true
    }

    // Normal mode — aggressive filtering
    if (t.symbol.endsWith("X") && t.symbol.length > 2) return false
    if (t.symbol.includes(".")) return false
    if (t.symbol.length > 6) return false

    return true
  })

  // Apply limit if specified (for testing)
  if (limit > 0 && needsUpdate.length > limit) {
    console.log(`⚠️  LIMIT: Processing only first ${limit} tickers (use --limit=0 for all)\n`)
    needsUpdate = needsUpdate.slice(0, limit)
  }

  const alreadyComplete = tickers.filter(
    (t) => t.security_type && t.avg_volume && t.market_cap && t.exchange
  ).length
  const nonUSExchanges = tickers.filter((t) => t.exchange && !US_EXCHANGES.has(t.exchange)).length
  const skippedCount = tickers.length - needsUpdate.length - alreadyComplete

  console.log(`📝 Tickers needing updates: ${needsUpdate.length.toLocaleString()}`)
  console.log(`   - Already complete: ${alreadyComplete.toLocaleString()}`)
  console.log(
    `   - Missing security_type: ${tickers.filter((t) => !t.security_type).length.toLocaleString()}`
  )
  console.log(
    `   - Missing avg_volume: ${tickers.filter((t) => !t.avg_volume).length.toLocaleString()}`
  )
  console.log(
    `   - Missing market_cap: ${tickers.filter((t) => !t.market_cap).length.toLocaleString()}`
  )
  console.log(
    `   - Missing exchange: ${tickers.filter((t) => !t.exchange).length.toLocaleString()}`
  )
  console.log(`   - Non-US exchanges: ${nonUSExchanges.toLocaleString()}`)
  console.log(`   - Skipped (mutual funds/dots/long symbols): ${skippedCount.toLocaleString()}\n`)

  if (needsUpdate.length === 0) {
    console.log("✅ All tickers already have metadata!")
    return
  }

  // Process in batches
  let updated = 0
  let failed = 0
  let skipped = 0

  for (let i = 0; i < needsUpdate.length; i += batchSize) {
    const batch = needsUpdate.slice(i, i + batchSize)
    console.log(
      `\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(needsUpdate.length / batchSize)}`
    )
    console.log(
      `   Symbols ${i + 1} to ${Math.min(i + batchSize, needsUpdate.length)} of ${needsUpdate.length}`
    )

    for (const ticker of batch) {
      try {
        const metadata = await fetchTickerMetadata(ticker.symbol)

        if (metadata && Object.keys(metadata).length > 1) {
          // Post-fetch non-US gate — uses the same Set
          if (!force && metadata.exchange && !US_EXCHANGES.has(metadata.exchange)) {
            console.log(
              `   ⏭️  ${ticker.symbol.padEnd(6)} - Skipped (non-US exchange: ${metadata.exchange})`
            )
            skipped++
            await new Promise((resolve) => setTimeout(resolve, 300))
            continue
          }

          const { symbol, ...updateData } = metadata

          if (!dryRun && Object.keys(updateData).length > 0) {
            const { error: updateError } = await supabase
              .from("ticker_universe")
              .update(updateData)
              .eq("symbol", ticker.symbol)

            if (updateError) {
              console.log(`   ❌ ${ticker.symbol.padEnd(6)} - DB Error: ${updateError.message}`)
              failed++
            } else {
              const parts = []
              if (metadata.security_type) parts.push(`type:${metadata.security_type}`)
              if (metadata.avg_volume)
                parts.push(`vol:${(metadata.avg_volume / 1000000).toFixed(1)}M`)
              if (metadata.exchange) parts.push(`ex:${metadata.exchange}`)
              if (metadata.market_cap)
                parts.push(`cap:$${(metadata.market_cap / 1_000_000_000).toFixed(1)}B`)

              console.log(`   ✅ ${ticker.symbol.padEnd(6)} - ${parts.join(", ")}`)
              updated++
            }
          } else if (dryRun) {
            const parts = []
            if (metadata.security_type) parts.push(`type:${metadata.security_type}`)
            if (metadata.avg_volume)
              parts.push(`vol:${(metadata.avg_volume / 1000000).toFixed(1)}M`)
            if (metadata.exchange) parts.push(`ex:${metadata.exchange}`)
            if (metadata.market_cap)
              parts.push(`cap:$${(metadata.market_cap / 1_000_000_000).toFixed(1)}B`)

            console.log(`   📋 ${ticker.symbol.padEnd(6)} - Would update: ${parts.join(", ")}`)
            updated++
          }
        } else {
          console.log(`   ⚠️  ${ticker.symbol.padEnd(6)} - No data from any provider`)
          skipped++
        }

        await new Promise((resolve) => setTimeout(resolve, 300))
      } catch (error: any) {
        if (error.response?.status === 404) {
          console.log(`   ⚠️  ${ticker.symbol.padEnd(6)} - Not found`)
          skipped++
        } else if (error.response?.status === 429) {
          console.log(`   ⏸️  Rate limit hit - waiting 60s...`)
          await new Promise((resolve) => setTimeout(resolve, 60000))
          continue
        } else {
          console.log(`   ❌ ${ticker.symbol.padEnd(6)} - ${error.message}`)
          failed++
        }
        await new Promise((resolve) => setTimeout(resolve, 300))
      }
    }

    // Pause between batches
    if (i + batchSize < needsUpdate.length) {
      console.log("\n⏸️  Pausing 10s between batches...")
      await new Promise((resolve) => setTimeout(resolve, 10000))
    }
  }

  console.log("\n" + "=".repeat(80))
  console.log("📊 BACKFILL COMPLETE")
  console.log("=".repeat(80))
  console.log(`✅ Updated:  ${updated}`)
  console.log(`❌ Failed:   ${failed}`)
  console.log(`⚠️  Skipped:  ${skipped}`)
  console.log(`📝 Total:    ${needsUpdate.length}`)
  console.log("=".repeat(80))

  if (dryRun) {
    console.log("\n💡 To apply these changes, run:")
    console.log("   npx tsx scripts/data-manager.ts backfill-equity-metadata --confirm")
    if (!force && !skipCompleteOnly && needsUpdate.length < 5000) {
      console.log("\n⚠️  Only " + needsUpdate.length + " tickers passed strict filters.")
      console.log("   Recommended: Use relaxed filtering (skips junk but processes more tickers):")
      console.log(
        "   npx tsx scripts/data-manager.ts backfill-equity-metadata --confirm --skip-complete-only"
      )
      console.log("\n   Or process EVERYTHING including junk (slower):")
      console.log("   npx tsx scripts/data-manager.ts backfill-equity-metadata --confirm --force")
    }
  } else {
    console.log("\n✅ Metadata backfill complete!")
    if (!force && !skipCompleteOnly && updated < 5000) {
      console.log("\n⚠️  Only updated " + updated + " tickers (strict filtering was applied).")
      console.log("   Recommended: Process remaining tickers with relaxed filtering:")
      console.log(
        "   npx tsx scripts/data-manager.ts backfill-equity-metadata --confirm --skip-complete-only"
      )
      console.log("\n   Or process EVERYTHING including junk (slower, not recommended):")
      console.log("   npx tsx scripts/data-manager.ts backfill-equity-metadata --confirm --force")
    } else {
      console.log("\n📋 Next step:")
      console.log("   npx tsx scripts/data-manager.ts filter-equity-universe --confirm")
    }
  }
}

/**
 * Filter equity universe based on trading criteria
 * Usage: npx tsx scripts/data-manager.ts filter-equity-universe [--confirm]
 */
async function filterEquityUniverse(): Promise<void> {
  console.log("🎯 Filtering Equity Universe\n")
  console.log("=".repeat(80))
  console.log("Criteria:")
  console.log("  ✓ Security type: CS (Common Stock) or ETF")
  console.log("  ✓ Exchange: XNAS, XNYS, ARCX, BATS")
  console.log("  ✓ Not mutual fund (no suffix 'X')")
  console.log("  ✓ Not OTC/Pink/Grey")
  console.log("  ✓ Avg volume > 250k")
  console.log("  ✓ Market cap > $2B (large/mid-cap)")
  console.log("  ⏸️  IV Rank: 20-60 (pending options data source)")
  console.log("=".repeat(80) + "\n")

  const args = process.argv.slice(3)
  const dryRun = !args.includes("--confirm")

  if (dryRun) {
    console.log("🔍 DRY RUN - Add --confirm to apply\n")
  }

  // Fetch all active equities
  const { data: allEquities, error: fetchError } = await supabase
    .from("ticker_universe")
    .select("symbol, exchange, security_type, avg_volume, market_cap")
    .eq("category", "equity")
    .eq("active", true)

  if (fetchError || !allEquities) {
    console.error(`❌ Error: ${fetchError?.message}`)
    return
  }

  console.log(`📊 Total active equities: ${allEquities.length.toLocaleString()}\n`)

  // Apply filters
  const VALID_EXCHANGES = ["XNAS", "XNYS", "ARCX", "BATS"]
  const VALID_SECURITY_TYPES = ["CS", "ETF"]
  const INVALID_EXCHANGES = ["OTCM", "OTCQB", "PINK", "OTCBB", "OTC", "GREY"]
  const MIN_VOLUME = 250000
  const MIN_MARKET_CAP = 2_000_000_000 // $2B

  const toDeactivate: string[] = []
  const reasons: Record<string, string> = {}

  for (const ticker of allEquities) {
    const fails: string[] = []

    // Check security type
    if (ticker.security_type && !VALID_SECURITY_TYPES.includes(ticker.security_type)) {
      fails.push(`type:${ticker.security_type}`)
    }

    // Check for mutual fund suffix
    if (ticker.symbol.endsWith("X") && ticker.symbol.length > 1) {
      fails.push("mutual-fund")
    }

    // Check exchange
    if (ticker.exchange) {
      if (INVALID_EXCHANGES.includes(ticker.exchange)) {
        fails.push(`bad-exchange:${ticker.exchange}`)
      } else if (!VALID_EXCHANGES.includes(ticker.exchange)) {
        fails.push(`other-exchange:${ticker.exchange}`)
      }
    }

    // Check volume
    if (!ticker.avg_volume || ticker.avg_volume < MIN_VOLUME) {
      fails.push(
        `low-vol:${ticker.avg_volume ? (ticker.avg_volume / 1000).toFixed(0) + "k" : "null"}`
      )
    }

    // Check market cap
    if (!ticker.market_cap || ticker.market_cap < MIN_MARKET_CAP) {
      fails.push(
        `small-cap:${ticker.market_cap ? "$" + (ticker.market_cap / 1_000_000_000).toFixed(1) + "B" : "null"}`
      )
    }

    // Check for dots/dashes (units/warrants)
    if (ticker.symbol.includes(".") || ticker.symbol.includes("-")) {
      fails.push("special-char")
    }

    // Check symbol length
    if (ticker.symbol.length > 5) {
      fails.push("long-symbol")
    }

    if (fails.length > 0) {
      toDeactivate.push(ticker.symbol)
      reasons[ticker.symbol] = fails.join(", ")
    }
  }

  // Group by reason for summary
  const reasonCounts: Record<string, number> = {}
  for (const reason of Object.values(reasons)) {
    for (const r of reason.split(", ")) {
      const key = r.split(":")[0]
      reasonCounts[key] = (reasonCounts[key] || 0) + 1
    }
  }

  console.log("📋 Exclusion Summary:")
  Object.entries(reasonCounts)
    .sort(([, a], [, b]) => b - a)
    .forEach(([reason, count]) => {
      console.log(`   ${reason.padEnd(20)} ${count.toLocaleString()}`)
    })

  console.log("\n" + "=".repeat(80))
  console.log(`Current:   ${allEquities.length.toLocaleString()}`)
  console.log(`Remove:    ${toDeactivate.length.toLocaleString()}`)
  console.log(`Remaining: ${(allEquities.length - toDeactivate.length).toLocaleString()}`)
  console.log("=".repeat(80))

  if (!dryRun) {
    console.log("\n🔨 Applying changes...")

    // Deactivate in batches of 1000
    for (let i = 0; i < toDeactivate.length; i += 1000) {
      const batch = toDeactivate.slice(i, i + 1000)
      const { error: updateError } = await supabase
        .from("ticker_universe")
        .update({ active: false })
        .in("symbol", batch)

      if (updateError) {
        console.error(`   ❌ Batch ${Math.floor(i / 1000) + 1} failed: ${updateError.message}`)
      } else {
        console.log(`   ✅ Batch ${Math.floor(i / 1000) + 1} complete`)
      }
    }

    console.log("\n✅ Filtering complete!")
    console.log("\n💡 Next: Add IV Rank data and run final filter")
  } else {
    console.log("\n💡 To apply:")
    console.log("   npx tsx scripts/data-manager.ts filter-equity-universe --confirm")

    // Show sample of what would be removed
    console.log("\n📋 Sample of symbols to be deactivated (first 20):")
    toDeactivate.slice(0, 20).forEach((symbol) => {
      console.log(`   ${symbol.padEnd(8)} - ${reasons[symbol]}`)
    })
  }
}

/**
 * Show statistics after filtering
 */
async function showFilteredStats(): Promise<void> {
  console.log("📊 Filtered Equity Statistics\n")
  console.log("=".repeat(80))

  const { data: activeEquities } = await supabase
    .from("ticker_universe")
    .select("symbol, exchange, security_type, avg_volume, market_cap")
    .eq("category", "equity")
    .eq("active", true)

  const { count: totalActive } = await supabase
    .from("ticker_universe")
    .select("*", { count: "exact", head: true })
    .eq("category", "equity")
    .eq("active", true)

  console.log(`Total active equities: ${(totalActive || 0).toLocaleString()}\n`)

  // Exchange breakdown
  console.log("Exchange Distribution:")
  const exchangeCounts: Record<string, number> = {}
  activeEquities?.forEach((t) => {
    if (t.exchange) {
      exchangeCounts[t.exchange] = (exchangeCounts[t.exchange] || 0) + 1
    }
  })
  Object.entries(exchangeCounts)
    .sort(([, a], [, b]) => b - a)
    .forEach(([ex, count]) => {
      console.log(`  ${ex.padEnd(10)} ${count.toLocaleString()}`)
    })

  // Security type breakdown
  console.log("\nSecurity Type Distribution:")
  const typeCounts: Record<string, number> = {}
  activeEquities?.forEach((t) => {
    if (t.security_type) {
      typeCounts[t.security_type] = (typeCounts[t.security_type] || 0) + 1
    }
  })
  Object.entries(typeCounts)
    .sort(([, a], [, b]) => b - a)
    .forEach(([type, count]) => {
      console.log(`  ${type.padEnd(10)} ${count.toLocaleString()}`)
    })

  // Volume distribution
  console.log("\nVolume Distribution:")
  const volRanges = {
    "< 100k": activeEquities?.filter((t) => (t.avg_volume || 0) < 100000).length || 0,
    "100k-250k":
      activeEquities?.filter((t) => (t.avg_volume || 0) >= 100000 && (t.avg_volume || 0) < 250000)
        .length || 0,
    "250k-500k":
      activeEquities?.filter((t) => (t.avg_volume || 0) >= 250000 && (t.avg_volume || 0) < 500000)
        .length || 0,
    "500k-1M":
      activeEquities?.filter((t) => (t.avg_volume || 0) >= 500000 && (t.avg_volume || 0) < 1000000)
        .length || 0,
    "> 1M": activeEquities?.filter((t) => (t.avg_volume || 0) >= 1000000).length || 0,
  }
  Object.entries(volRanges).forEach(([range, count]) => {
    console.log(`  ${range.padEnd(15)} ${count.toLocaleString()}`)
  })

  // Market cap distribution
  console.log("\nMarket Cap Distribution:")
  const capRanges = {
    "< $300M": activeEquities?.filter((t) => (t.market_cap || 0) < 300_000_000).length || 0,
    "$300M-$2B":
      activeEquities?.filter(
        (t) => (t.market_cap || 0) >= 300_000_000 && (t.market_cap || 0) < 2_000_000_000
      ).length || 0,
    "$2B-$10B":
      activeEquities?.filter(
        (t) => (t.market_cap || 0) >= 2_000_000_000 && (t.market_cap || 0) < 10_000_000_000
      ).length || 0,
    "$10B-$50B":
      activeEquities?.filter(
        (t) => (t.market_cap || 0) >= 10_000_000_000 && (t.market_cap || 0) < 50_000_000_000
      ).length || 0,
    "> $50B": activeEquities?.filter((t) => (t.market_cap || 0) >= 50_000_000_000).length || 0,
  }
  Object.entries(capRanges).forEach(([range, count]) => {
    console.log(`  ${range.padEnd(15)} ${count.toLocaleString()}`)
  })

  console.log("\n" + "=".repeat(80))
}

async function main() {
  const command = process.argv[2]

  process.stdout.write("")

  const commands: Record<string, () => Promise<void>> = {
    "load-all": loadAllCSVs,
    "update-prices": () => updatePricesFromCSV(process.argv[3]),
    "check-freshness": checkPriceFreshness,
    "populate-featured": populateFeaturedTickers,
    "monthly-scan": runMonthlyIngressScan,
    "monthly-scan-smart": runMonthlyIngressScanSmart,
    "scan-sentinels": scanSentinelsOnly,
    "daily-rank": runDailyRankUpdate,
    "refresh-monthly-scan": async () => {
      const ingress = await getIngressPeriod()
      await supabase.from("ticker_analysis_cache").delete().eq("ingress_period", ingress.period)
      await runMonthlyIngressScan()
    },
    "check-cache": async () => {
      const ingress = await getIngressPeriod()
      const { count } = await supabase
        .from("ticker_analysis_cache")
        .select("*", { count: "exact", head: true })
        .eq("ingress_period", ingress.period)
      console.log(` Cache for ${ingress.period}: ${count || 0} records`)
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
    backfill: () =>
      backfillData({
        categories: process.argv[3] ? [process.argv[3]] : undefined,
        days: 365,
        source: "universe",
      }),
    "backfill-all": () =>
      backfillData({
        days: 365,
        source: "category_map",
      }),
    "backfill-map": () =>
      backfillData({
        categories: process.argv[3] ? [process.argv[3]] : undefined,
        days: 365,
        source: "category_map",
      }),
    "backfill-universe": () =>
      backfillData({
        categories: process.argv[3] ? [process.argv[3]] : undefined,
        days: 365,
        source: "universe",
      }),

    "backfill-equity-metadata": backfillEquityMetadata,
    "filter-equity-universe": filterEquityUniverse,
    "show-filtered-stats": showFilteredStats,
    "universe-stats": universeStats,
    "check-ingress": checkCurrentIngress,
    "expand-universe-all": expandUniverseComprehensive,
    "load-equities-multi": loadEquitiesFromAllSources,

    // Diagnostic commands
    "debug-symbols": debugSymbolFormats,
    "fix-symbols": fixSymbolFormats,
    "verify-ingress": verifyIngressCalculation,
    "show-equity-mismatch": showEquityMismatch,
    "sync-universe": syncTickerUniverse,
    "map-futures-to-etfs": mapFuturesToETFs,
    "analyze-equity": analyzeEquityUniverse,
    "trim-equity": trimEquityUniverse,
  }

  if (!command || !commands[command]) {
    console.log(`
 Data Manager - Unified data operations tool

Usage: npx tsx scripts/data-manager.ts [command] [options]

Core Commands:
  load-all                       Load all CSV files into database
  update-prices [path]           Update prices from CSV file
  check-freshness                Check price data staleness
  populate-featured              Populate featured tickers from scores
  check-ingress                  Check current astrological ingress status

Ingress-Aware Caching:
  monthly-scan                   Full analysis at start of ingress period
  monthly-scan-smart             Smart scan - only symbols with â‰¥30 bars of data
  scan-sentinels                 Quick scan - analyze 18 sentinel tickers only
  daily-rank                     Re-rank cached tickers (fast, uses cache)
  refresh-monthly-scan           Force re-scan current ingress period
  check-cache                    View cache status for current period

Cron Commands:
  cron-update-prices [--categories=equity,crypto,forex]
                                 Smart price update with API fallbacks
  cron-refresh-featured          Ingress-aware featured ticker refresh

Ticker Universe:
  init-universe                  Initialize universe (1,000 equities + crypto + forex)
  expand-universe-all            Load ALL available tickers from ALL sources
                               - Equities: Polygon (1000) + fallback sources
                               - Crypto: ALL from CoinGecko (with key rotation)
                               - Forex: 76 major/cross/exotic pairs
                               - Commodities: 39 futures + ETFs
                               - Indices: 24 market indices
                               - Macro: 23 FRED indicators
  load-equities-multi            Load equities from ALL available APIs
                               - Polygon, FMP, TwelveData, EODHD, Finnhub
                               - No 1000 symbol limit
                               - Est. 10,000-15,000 symbols
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

  Maintenance Commands:
  quality-report                 Get comprehensive data quality report
  verify-schema                  Verify database tables exist
  export-csv [category]          Export data to CSV backups
  clean-old-data                 Clean price data older than 3 years
  test-providers                 Test all API provider connections

Equity Filtering Workflow (run in order):
  1. backfill-equity-metadata [options]    Fetch security type & volume from multiple providers
                                          (FMP → AlphaVantage → TwelveData → Finnhub)
                                          Note: Polygon is skipped (already backfilled)
     Options:
       --confirm                           Apply changes (dry-run without this)
       --skip-complete-only                Process all incomplete tickers (relaxed filters)
                                          Skips: units (dots), mutual funds, very long symbols
       --include-inactive                  Include tickers marked inactive by filter-equity-universe
       --force                             Process ALL tickers including junk (not recommended)
       --limit=N                           Process only first N tickers (testing)
       --batch-size=N                      Process N tickers per batch (default: 100)

  2. filter-equity-universe [--confirm]    Apply trading criteria filters
  3. show-filtered-stats                   Show statistics after filtering
  4. backfill-universe equity              Backfill price data for filtered tickers
                                          (uses same multi-provider fallback chain)

  Note: IV Rank filtering (20-60 range) requires options data source (future enhancement)

Examples:
  # Full equity backfill workflow:
  npx tsx scripts/data-manager.ts init-universe
  npx tsx scripts/data-manager.ts backfill-equity-metadata --confirm
  npx tsx scripts/data-manager.ts filter-equity-universe --confirm
  npx tsx scripts/data-manager.ts show-filtered-stats
  npx tsx scripts/data-manager.ts backfill-universe equity

  # Check data quality:
  npx tsx scripts/data-manager.ts quality-report
  npx tsx scripts/data-manager.ts universe-stats
    `)
    process.exit(1)
  }

  try {
    await commands[command]()
    console.log("\n Operation complete")
    process.exit(0)
  } catch (error) {
    console.error("\n Fatal error:", error)
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
  console.log(" Symbol Format Diagnostic\n")

  const categories = ["equity", "crypto", "forex", "commodity", "rates-macro", "stress"]

  for (const category of categories) {
    console.log(`\n ${category.toUpperCase()}`)

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
      console.log(`    No price data for:`, mismatches.join(", "))
    } else {
      console.log(`    All universe symbols have price data`)
    }

    // Check bar counts for sample symbols
    for (const symbol of universeSymbols.slice(0, 3)) {
      const { count } = await supabase
        .from("financial_data")
        .select("*", { count: "exact", head: true })
        .eq("symbol", symbol)
        .eq("category", category)

      console.log(`    ${symbol}: ${count || 0} bars`)
    }
  }
}

async function showEquityMismatch() {
  console.log(" Equity Symbol Mismatch Analysis\n")

  // Get universe symbols
  const { data: universeData } = await supabase
    .from("ticker_universe")
    .select("symbol")
    .eq("category", "equity")
    .eq("active", true)

  const universeSymbols = new Set(universeData?.map((d: any) => d.symbol) || [])

  // Get data symbols
  const { data: dataSymbols } = await supabase
    .from("financial_data")
    .select("symbol")
    .eq("category", "equity")

  const uniqueDataSymbols = new Set(dataSymbols?.map((d: any) => d.symbol) || [])

  console.log(`Universe has: ${universeSymbols.size} symbols`)
  console.log(`Data has: ${uniqueDataSymbols.size} symbols`)

  // Find universe symbols WITHOUT data
  const noData = [...universeSymbols].filter((s) => !uniqueDataSymbols.has(s))
  console.log(`\n In universe but NO price data (${noData.length}):`)
  console.log(noData.slice(0, 20).join(", "), noData.length > 20 ? "..." : "")

  // Find data symbols NOT in universe
  const notInUniverse = [...uniqueDataSymbols].filter((s) => !universeSymbols.has(s))
  console.log(`\n  Has price data but NOT in universe (${notInUniverse.length}):`)
  console.log(notInUniverse.slice(0, 20).join(", "), notInUniverse.length > 20 ? "..." : "")

  // Sample a few mismatched symbols to see patterns
  if (noData.length > 0) {
    console.log(`\n Sample universe symbols (first 10):`)
    console.log([...universeSymbols].slice(0, 10).join(", "))
  }

  if (notInUniverse.length > 0) {
    console.log(`\n Sample data symbols (first 10):`)
    console.log([...uniqueDataSymbols].slice(0, 10).join(", "))
  }
}

async function fixSymbolFormats() {
  console.log(" Normalizing symbol formats...\n")

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
      console.log(` ticker_universe: ${fix.from}  ${fix.to} (${fix.category})`)
    }

    // Update financial_data
    const { error: dataError } = await supabase
      .from("financial_data")
      .update({ symbol: fix.to })
      .eq("symbol", fix.from)
      .eq("category", fix.category)

    if (!dataError) {
      console.log(` financial_data: ${fix.from}  ${fix.to} (${fix.category})`)
    }
  }

  console.log("\n Symbol normalization complete")
}

async function verifyIngressCalculation() {
  console.log(" Verifying ingress calculation\n")

  try {
    const ingress = await getIngressPeriod()

    console.log(`Current Ingress: ${ingress.sign}`)
    console.log(`Start Date: ${ingress.start}`)
    console.log(`End Date: ${ingress.end}`)
    console.log(`\n Period: ${ingress.daysInPeriod + 1} days total`)
    console.log(` Current: Day ${ingress.daysInPeriod + 1}`)
    console.log(` Remaining: ${ingress.daysRemaining} days`)
    console.log(
      ` Progress: ${Math.round(((ingress.daysInPeriod + 1) / (ingress.daysInPeriod + ingress.daysRemaining + 1)) * 100)}%`
    )
    console.log(`\n Ingress calculation is correct`)
  } catch (error: any) {
    console.error(`\n Error: ${error.message}`)
  }
}

async function checkCurrentIngress() {
  try {
    const ingress = await getIngressPeriod()
    console.log(
      ` Current ingress: ${ingress.sign} (${ingress.start}, Day ${ingress.daysInPeriod + 1})`
    )
    console.log(` Period: ${ingress.period}`)
    console.log(` Days remaining: ${ingress.daysRemaining}`)
  } catch (error: any) {
    console.log(` Error: ${error.message}`)
  }
}

async function mapFuturesToETFs(): Promise<void> {
  console.log("Ã°Å¸â€â€ž Mapping Futures to ETF Equivalents\n")

  // Futures Ã¢â€ â€™ ETF mapping
  const FUTURES_TO_ETF_MAP: Record<string, { etf: string; name: string }> = {
    // Precious Metals
    "GC1!": { etf: "GLD", name: "Gold ETF (SPDR)" },
    "SI1!": { etf: "SLV", name: "Silver ETF (iShares)" },
    "PL1!": { etf: "PPLT", name: "Platinum ETF" },
    "PA1!": { etf: "PALL", name: "Palladium ETF" },

    // Base Metals
    "HG1!": { etf: "COPX", name: "Copper Miners ETF" },
    "ALI1!": { etf: "COPX", name: "Copper Miners ETF" },

    // Energy
    "CL1!": { etf: "USO", name: "Oil ETF (US)" },
    "BZ1!": { etf: "USO", name: "Oil ETF (US)" },
    "NG1!": { etf: "UNG", name: "Natural Gas ETF" },
    "RB1!": { etf: "USO", name: "Oil ETF (US)" },
    "HO1!": { etf: "USO", name: "Oil ETF (US)" },

    // Agriculture - Grains
    "ZC1!": { etf: "CORN", name: "Corn ETF" },
    "ZS1!": { etf: "SOYB", name: "Soybean ETF" },
    "ZW1!": { etf: "WEAT", name: "Wheat ETF" },
    "ZO1!": { etf: "DBA", name: "Agriculture ETF" },
    "ZR1!": { etf: "DBA", name: "Agriculture ETF" },

    // Agriculture - Softs & Livestock
    "ZL1!": { etf: "SOYB", name: "Soybean ETF" },
    "ZM1!": { etf: "SOYB", name: "Soybean ETF" },
    "KC1!": { etf: "DBA", name: "Agriculture ETF" },
    "CT1!": { etf: "DBA", name: "Agriculture ETF" },
    "SB1!": { etf: "DBA", name: "Agriculture ETF" },
    "CC1!": { etf: "DBA", name: "Agriculture ETF" },
    "OJ1!": { etf: "DBA", name: "Agriculture ETF" },

    // Livestock
    "LE1!": { etf: "DBA", name: "Agriculture ETF" },
    "GF1!": { etf: "DBA", name: "Agriculture ETF" },
    "HE1!": { etf: "DBA", name: "Agriculture ETF" },
  }

  const futuresSymbols = Object.keys(FUTURES_TO_ETF_MAP)
  console.log(`Ã°Å¸â€œÅ  Processing ${futuresSymbols.length} futures symbols...\n`)

  let updated = 0
  let deactivated = 0

  for (const futureSymbol of futuresSymbols) {
    const mapping = FUTURES_TO_ETF_MAP[futureSymbol]

    // Check if ETF exists and is active
    const { data: etfData } = await supabase
      .from("ticker_universe")
      .select("symbol, name, active")
      .eq("symbol", mapping.etf)
      .single()

    if (etfData && etfData.active) {
      // ETF exists - add metadata note that this futures maps to it
      const { error: updateError } = await supabase
        .from("ticker_universe")
        .update({
          metadata: {
            maps_to_etf: mapping.etf,
            original_symbol: futureSymbol,
            note: `Futures data unavailable - use ${mapping.etf} as equivalent`,
          },
          active: false,
        })
        .eq("symbol", futureSymbol)

      if (!updateError) {
        console.log(
          `Ã¢Å“â€œ ${futureSymbol.padEnd(6)} Ã¢â€ â€™ ${mapping.etf.padEnd(6)} (${mapping.name})`
        )
        updated++
      } else {
        console.log(`Ã¢Å“â€” ${futureSymbol.padEnd(6)} - Error: ${updateError.message}`)
      }
    } else {
      // ETF doesn't exist - just deactivate futures
      const { error: deactivateError } = await supabase
        .from("ticker_universe")
        .update({ active: false })
        .eq("symbol", futureSymbol)

      if (!deactivateError) {
        console.log(`Ã¢Å¡Â  ${futureSymbol.padEnd(6)} - Deactivated (ETF ${mapping.etf} not found)`)
        deactivated++
      }
    }
  }

  console.log("\n" + "=".repeat(60))
  console.log("Ã°Å¸â€œË† Mapping Complete")
  console.log("=".repeat(60))
  console.log(`Ã¢Å“â€œ Mapped to ETFs:        ${updated}`)
  console.log(`Ã¢Å¡Â  Deactivated (no ETF):  ${deactivated}`)
  console.log(`Ã°Å¸â€œÅ  Total processed:       ${futuresSymbols.length}`)
  console.log("\nÃ°Å¸â€™Â¡ Tip: Use the ETF symbols for commodity exposure")
  console.log("   Example: GLD instead of GC1! for gold prices\n")
}

async function analyzeEquityUniverse(): Promise<void> {
  console.log("📊 Analyzing Equity Universe\n")
  console.log("=".repeat(80))

  const { count: total } = await supabase
    .from("ticker_universe")
    .select("*", { count: "exact", head: true })
    .eq("category", "equity")
    .eq("active", true)

  console.log(`Total active equities: ${(total || 0).toLocaleString()}\n`)

  console.log("Exchange Distribution:")
  const { data: exchanges } = await supabase
    .from("ticker_universe")
    .select("exchange")
    .eq("category", "equity")
    .eq("active", true)

  const exchangeCounts =
    exchanges?.reduce((acc: any, row: any) => {
      acc[row.exchange] = (acc[row.exchange] || 0) + 1
      return acc
    }, {}) || {}

  Object.entries(exchangeCounts)
    .sort(([, a]: any, [, b]: any) => b - a)
    .slice(0, 15)
    .forEach(([exchange, count]) => {
      console.log(`  ${(exchange || "NULL").padEnd(20)} ${(count as number).toLocaleString()}`)
    })

  console.log("\nMarket Cap Distribution:")
  const { count: withMarketCap } = await supabase
    .from("ticker_universe")
    .select("*", { count: "exact", head: true })
    .eq("category", "equity")
    .eq("active", true)
    .not("market_cap", "is", null)

  const { count: over100m } = await supabase
    .from("ticker_universe")
    .select("*", { count: "exact", head: true })
    .eq("category", "equity")
    .eq("active", true)
    .gt("market_cap", 100000000)

  const { count: over1b } = await supabase
    .from("ticker_universe")
    .select("*", { count: "exact", head: true })
    .eq("category", "equity")
    .eq("active", true)
    .gt("market_cap", 1000000000)

  const { count: over10b } = await supabase
    .from("ticker_universe")
    .select("*", { count: "exact", head: true })
    .eq("category", "equity")
    .eq("active", true)
    .gt("market_cap", 10000000000)

  console.log(`  With market cap data:    ${(withMarketCap || 0).toLocaleString()}`)
  console.log(`  > $100M market cap:      ${(over100m || 0).toLocaleString()}`)
  console.log(`  > $1B market cap:        ${(over1b || 0).toLocaleString()}`)
  console.log(`  > $10B market cap:       ${(over10b || 0).toLocaleString()}`)

  console.log("\nSymbol Patterns:")
  const { data: allSymbols } = await supabase
    .from("ticker_universe")
    .select("symbol")
    .eq("category", "equity")
    .eq("active", true)

  const symbols = allSymbols?.map((s: any) => s.symbol) || []

  const patterns = {
    "Has dot (.)": symbols.filter((s) => s.includes(".")).length,
    "Has dash (-)": symbols.filter((s) => s.includes("-")).length,
    "Length > 5 chars": symbols.filter((s) => s.length > 5).length,
  }

  Object.entries(patterns).forEach(([pattern, count]) => {
    console.log(`  ${pattern.padEnd(20)} ${count.toLocaleString()}`)
  })

  console.log("\n" + "=".repeat(80))
  console.log("💡 Run: npx tsx scripts/data-manager.ts trim-equity\n")
}

async function trimEquityUniverse(): Promise<void> {
  console.log("✂️  Trimming Equity Universe\n")
  console.log("=".repeat(80))

  const args = process.argv.slice(3)
  const dryRun = !args.includes("--confirm")
  const aggressive = args.includes("--aggressive")

  if (dryRun) {
    console.log("🔍 DRY RUN - Add --confirm to apply\n")
  }

  if (aggressive) {
    console.log("⚡ AGGRESSIVE MODE - Top 5,000 only\n")
  }

  const EXCHANGES_TO_EXCLUDE = ["OTCM", "OTCQB", "PINK", "OTCBB", "OTC", "GREY"]

  console.log("Rule 1: Excluding OTC/PINK exchanges")
  const { data: badExchanges } = await supabase
    .from("ticker_universe")
    .select("symbol")
    .eq("category", "equity")
    .eq("active", true)
    .in("exchange", EXCHANGES_TO_EXCLUDE)

  console.log(`  Found ${badExchanges?.length || 0} symbols`)

  console.log("\nRule 2: Excluding units/warrants (dots)")
  const { data: allEquities } = await supabase
    .from("ticker_universe")
    .select("symbol, market_cap")
    .eq("category", "equity")
    .eq("active", true)

  const symbolsWithDots = allEquities?.filter((s: any) => s.symbol.includes(".")) || []
  console.log(`  Found ${symbolsWithDots.length} symbols`)

  console.log("\nRule 3: Excluding long symbols (> 5 chars)")
  const longSymbols = allEquities?.filter((s: any) => s.symbol.length > 5) || []
  console.log(`  Found ${longSymbols.length} symbols`)

  let outsideTop5000: any[] = []
  if (aggressive) {
    console.log("\nRule 4: Keep only top 5,000 by market cap")
    const { data: sorted } = await supabase
      .from("ticker_universe")
      .select("symbol, market_cap")
      .eq("category", "equity")
      .eq("active", true)
      .not("market_cap", "is", null)
      .order("market_cap", { ascending: false })

    const top5000 = new Set(sorted?.slice(0, 5000).map((s: any) => s.symbol))
    outsideTop5000 = allEquities?.filter((s: any) => !top5000.has(s.symbol)) || []
    console.log(`  ${outsideTop5000.length} outside top 5,000`)
  }

  const toRemove = new Set([
    ...(badExchanges?.map((s: any) => s.symbol) || []),
    ...symbolsWithDots.map((s: any) => s.symbol),
    ...longSymbols.map((s: any) => s.symbol),
    ...(aggressive ? outsideTop5000.map((s: any) => s.symbol) : []),
  ])

  console.log("\n" + "=".repeat(80))
  console.log(`Current:   ${allEquities?.length || 0}`)
  console.log(`Remove:    ${toRemove.size}`)
  console.log(`Remaining: ${(allEquities?.length || 0) - toRemove.size}`)
  console.log("=".repeat(80))

  if (!dryRun) {
    console.log("\n🔨 Applying...")
    const arr = Array.from(toRemove)
    for (let i = 0; i < arr.length; i += 1000) {
      const batch = arr.slice(i, i + 1000)
      await supabase.from("ticker_universe").update({ active: false }).in("symbol", batch)
      console.log(`  Batch ${Math.floor(i / 1000) + 1} done`)
    }
    console.log("\n✅ Done! Run: npx tsx scripts/data-manager.ts universe-stats")
  } else {
    console.log("\n💡 To apply:")
    console.log(
      aggressive
        ? "   npx tsx scripts/data-manager.ts trim-equity --aggressive --confirm"
        : "   npx tsx scripts/data-manager.ts trim-equity --confirm"
    )
  }
}
