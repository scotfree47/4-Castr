export const SYMBOLS = {
  equities: [
    "SPY","QQQ","XLY","AAL","AIG","AMZN","AXP","BA","BABA","BAC",
    "C","CLF","CLSK","COST","CSCO","CVX","DIS","DKNG","EQT","F",
    "GE","GS","HLT","HP","IBM","IBIT","ILMN","INTC","JNJ","JPM",
    "KO","LYV","MRVL","NKE","NUE","NVDA","PG","PTON","QCOM","RACE",
    "RIOT","RKT","SPCE","T","TEVA","TSLA","V","WKHS","WMG"
  ],

  crypto: {
    BTC: "bitcoin",
    ETH: "ethereum",
    BNB: "binancecoin",
    XRP: "ripple",
    BCH: "bitcoin-cash",
    SOL: "solana",
    ADA: "cardano",
    DOT: "polkadot",
    LINK: "chainlink",
    XLM: "stellar"
  },

  forex: [
    ["EUR","USD","EURUSD"],
    ["USD","JPY","USDJPY"],
    ["GBP","JPY","GBPJPY"],
    ["GBP","NZD","GBPNZD"],
    ["EUR","NZD","EURNZD"],
    ["GBP","AUD","GBPAUD"],
    ["GBP","CAD","GBPCAD"],
    ["NZD","CAD","NZDCAD"],
    ["NZD","CHF","NZDCHF"]
  ],

  quandl: {
    commodities: {
      COTTON: "CHRIS/ICE_CT1",
      WHEAT: "CHRIS/CME_W1",
      CORN: "CHRIS/CME_C1",
      SUGAR: "CHRIS/ICE_SB1",
      COFFEE: "CHRIS/ICE_KC1"
    },
    stress: {
      VIX: "CBOE/VIX",
      MOVE: "ICE/BAML_MOVE"
    }
  }
};