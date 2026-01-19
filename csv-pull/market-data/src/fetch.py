#!/usr/bin/env python3
"""
Fallback fetcher using Python's yfinance library
Install: pip install yfinance pandas
"""

import yfinance as yf
import pandas as pd
from datetime import datetime
import os

# Target dates
DATES = [
    '2005-03-20', '2005-06-21', '2005-09-22', '2005-12-21',
    '2015-03-20', '2015-06-21', '2015-09-23', '2015-12-21',
    '2018-03-20', '2018-06-21', '2018-09-22', '2018-12-21',
    '2022-03-20', '2022-06-21', '2022-09-22', '2022-12-21',
    '2025-03-20', '2025-06-20', '2025-09-22', '2025-12-21'
]

# Symbols from your config
EQUITIES = [
    "SPY", "QQQ", "XLY", "AAL", "AIG", "AMZN", "AXP", "BA", "BABA", "BAC",
    "C", "CLF", "CLSK", "COST", "CSCO", "CVX", "DIS", "DKNG", "EQT", "F",
    "GE", "GS", "HLT", "HP", "IBM", "IBIT", "ILMN", "INTC", "JNJ", "JPM",
    "KO", "LYV", "MRVL", "NKE", "NUE", "NVDA", "PG", "PTON", "QCOM", "RACE",
    "RIOT", "RKT", "SPCE", "T", "TEVA", "TSLA", "V", "WKHS", "WMG"
]

CRYPTO = {
    'BTC': 'BTC-USD', 'ETH': 'ETH-USD', 'BNB': 'BNB-USD',
    'XRP': 'XRP-USD', 'BCH': 'BCH-USD', 'SOL': 'SOL-USD',
    'ADA': 'ADA-USD', 'DOT': 'DOT-USD', 'LINK': 'LINK-USD', 'XLM': 'XLM-USD'
}

FOREX = [
    ('EUR', 'USD', 'EURUSD=X'), ('USD', 'JPY', 'USDJPY=X'),
    ('GBP', 'JPY', 'GBPJPY=X'), ('GBP', 'NZD', 'GBPNZD=X'),
    ('EUR', 'NZD', 'EURNZD=X'), ('GBP', 'AUD', 'GBPAUD=X'),
    ('GBP', 'CAD', 'GBPCAD=X'), ('NZD', 'CAD', 'NZDCAD=X'),
    ('NZD', 'CHF', 'NZDCHF=X'), ('AUD', 'NZD', 'AUDNZD=X')
]

# Expanded commodities - map futures to ETFs where available
COMMODITIES = {
    # Original
    'COTTON': 'CT=F',
    'WHEAT': 'ZW=F',
    'CORN': 'ZC=F',
    'SUGAR': 'SB=F',
    'COFFEE': 'KC=F',
    # Additional from routes
    'CRUDE_OIL_ETF': 'USO',
    'CRUDE_OIL': 'CL=F',
    'NAT_GAS': 'NG=F',
    'GOLD_ETF': 'GLD',
    'GOLD': 'GC=F',
    'SILVER_ETF': 'SLV',
    'SILVER': 'SI=F',
    'COPPER_ETF': 'COPX',
    'COPPER': 'HG=F',
    'SOYBEANS': 'ZS=F',
    'SOYBEAN_OIL': 'ZL=F',
    'LIVE_CATTLE': 'LE=F'
}

# Expanded stress indicators
STRESS = {
    'VIX': '^VIX',
    'TNX': '^TNX',
    'DXY': 'DX-Y.NYB',
    'TYX': '^TYX',
    'VVIX': '^VVIX',
    'VXN': '^VXN',
    'RVX': '^RVX'
    # Note: MOVE, TRIN, BVOL may not be available in yfinance
}

# Rates/Macro market symbols
RATES_MACRO = {
    'TLT': 'TLT'  # 20+ Year Treasury Bond ETF
}

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')

def fetch_data(symbol, start='2005-01-01', end='2025-12-31'):
    """Fetch data for a symbol"""
    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(start=start, end=end, interval='1d')
        
        if df.empty:
            return None
        
        # Filter to target dates
        df.index = pd.to_datetime(df.index).strftime('%Y-%m-%d')
        df = df[df.index.isin(DATES)]
        
        return df
    except Exception as e:
        print(f"  ✗ {symbol}: {str(e)[:50]}")
        return None

def save_equities():
    """Fetch and save equity data"""
    print("\n📈 Fetching Equities...")
    all_data = []
    success = 0
    
    for symbol in EQUITIES:
        df = fetch_data(symbol)
        if df is not None and not df.empty:
            for date, row in df.iterrows():
                all_data.append({
                    'Symbol': symbol,
                    'Date': date,
                    'Open': row['Open'],
                    'High': row['High'],
                    'Low': row['Low'],
                    'Close': row['Close'],
                    'Volume': row['Volume']
                })
            success += 1
            print(f"  ✓ {symbol}")
        else:
            print(f"  ✗ {symbol}")
    
    if all_data:
        df_out = pd.DataFrame(all_data)
        output_path = os.path.join(DATA_DIR, 'equities', 'equities_solstice_equinox.csv')
        df_out.to_csv(output_path, index=False)
        print(f"✓ Saved: {len(all_data)} rows ({success}/{len(EQUITIES)} symbols)")
    else:
        print("⚠️  No equity data collected")

def save_crypto():
    """Fetch and save crypto data"""
    print("\n📊 Fetching Crypto...")
    all_data = []
    success = 0
    
    for ticker, yahoo_symbol in CRYPTO.items():
        df = fetch_data(yahoo_symbol)
        if df is not None and not df.empty:
            for date, row in df.iterrows():
                all_data.append({
                    'Symbol': ticker,
                    'Date': date,
                    'Price': row['Close'],
                    'Volume': row['Volume'],
                    'Market Cap': None
                })
            success += 1
            print(f"  ✓ {ticker}")
        else:
            print(f"  ✗ {ticker}")
    
    if all_data:
        df_out = pd.DataFrame(all_data)
        output_path = os.path.join(DATA_DIR, 'crypto', 'crypto_solstice_equinox.csv')
        df_out.to_csv(output_path, index=False)
        print(f"✓ Saved: {len(all_data)} rows ({success}/{len(CRYPTO)} coins)")
    else:
        print("⚠️  No crypto data collected")

def save_forex():
    """Fetch and save forex data"""
    print("\n💱 Fetching Forex...")
    all_data = []
    success = 0
    
    for base, quote, yahoo_symbol in FOREX:
        df = fetch_data(yahoo_symbol)
        if df is not None and not df.empty:
            for date, row in df.iterrows():
                all_data.append({
                    'Pair': f"{base}{quote}",
                    'Date': date,
                    'Rate': row['Close'],
                    'Change %': 0
                })
            success += 1
            print(f"  ✓ {base}{quote}")
        else:
            print(f"  ✗ {base}{quote}")
    
    if all_data:
        df_out = pd.DataFrame(all_data)
        output_path = os.path.join(DATA_DIR, 'forex', 'forex_solstice_equinox.csv')
        df_out.to_csv(output_path, index=False)
        print(f"✓ Saved: {len(all_data)} rows ({success}/{len(FOREX)} pairs)")
    else:
        print("⚠️  No forex data collected")

def save_commodities():
    """Fetch and save commodity data"""
    print("\n🌾 Fetching Commodities...")
    all_data = []
    success = 0
    
    for name, yahoo_symbol in COMMODITIES.items():
        df = fetch_data(yahoo_symbol)
        if df is not None and not df.empty:
            for date, row in df.iterrows():
                all_data.append({
                    'Commodity': name,
                    'Date': date,
                    'Price': row['Close'],
                    'Unit': 'USD'
                })
            success += 1
            print(f"  ✓ {name}")
        else:
            print(f"  ✗ {name}")
    
    if all_data:
        df_out = pd.DataFrame(all_data)
        output_path = os.path.join(DATA_DIR, 'commodities', 'commodities_solstice_equinox.csv')
        df_out.to_csv(output_path, index=False)
        print(f"✓ Saved: {len(all_data)} rows ({success}/{len(COMMODITIES)} commodities)")
    else:
        print("⚠️  No commodity data collected")

def save_stress():
    """Fetch and save stress indicators"""
    print("\n⚡ Fetching Stress Indicators...")
    all_data = []
    success = 0
    
    for name, yahoo_symbol in STRESS.items():
        df = fetch_data(yahoo_symbol)
        if df is not None and not df.empty:
            for date, row in df.iterrows():
                all_data.append({
                    'Indicator': name,
                    'Date': date,
                    'Value': row['Close'],
                    'Unit': 'index'
                })
            success += 1
            print(f"  ✓ {name}")
        else:
            print(f"  ✗ {name}")
    
    if all_data:
        df_out = pd.DataFrame(all_data)
        output_path = os.path.join(DATA_DIR, 'stress', 'stress_solstice_equinox.csv')
        df_out.to_csv(output_path, index=False)
        print(f"✓ Saved: {len(all_data)} rows ({success}/{len(STRESS)} indicators)")
    else:
        print("⚠️  No stress data collected")

def save_rates_macro():
    """Fetch and save rates/macro data"""
    print("\n📉 Fetching Rates/Macro...")
    all_data = []
    success = 0
    
    for name, yahoo_symbol in RATES_MACRO.items():
        df = fetch_data(yahoo_symbol)
        if df is not None and not df.empty:
            for date, row in df.iterrows():
                all_data.append({
                    'Symbol': name,
                    'Date': date,
                    'Open': row['Open'],
                    'High': row['High'],
                    'Low': row['Low'],
                    'Close': row['Close'],
                    'Volume': row['Volume']
                })
            success += 1
            print(f"  ✓ {name}")
        else:
            print(f"  ✗ {name}")
    
    if all_data:
        df_out = pd.DataFrame(all_data)
        output_path = os.path.join(DATA_DIR, 'rates-macro', 'rates_macro_solstice_equinox.csv')
        df_out.to_csv(output_path, index=False)
        print(f"✓ Saved: {len(all_data)} rows ({success}/{len(RATES_MACRO)} symbols)")
    else:
        print("⚠️  No rates/macro data collected")

def main():
    print("🚀 Python yfinance Fetcher")
    print("📅 Years: 2005, 2015, 2018, 2022, 2025\n")
    
    # Ensure directories exist
    for subdir in ['equities', 'crypto', 'forex', 'commodities', 'stress', 'rates-macro']:
        os.makedirs(os.path.join(DATA_DIR, subdir), exist_ok=True)
    
    save_equities()
    save_crypto()
    save_forex()
    save_commodities()
    save_stress()
    save_rates_macro()
    
    print("\n✅ Complete!\n")

if __name__ == '__main__':
    main()