#!/usr/bin/env python3
"""
Fetch daily price history from Dec 22, 2024 to present
Prioritizes yfinance, handles different asset classes
Note: auto_adjust=True means Close prices are already adjusted
"""

import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path
import os
import gc
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')
DATA_DIR = Path(os.getenv('DATA_DIR', './market-data/data'))
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Ticker mapping for yfinance compatibility
TICKERS = {
    'Equity': [
        'SPY', 'QQQ', 'XLY', 'AAL', 'AIG', 'AMZN', 'AXP', 'BA', 'BABA', 
        'BAC', 'C', 'CLF', 'CLSK', 'COST', 'CSCO', 'CVX', 'DIS', 'DKNG',
        'EQT', 'F', 'GE', 'GS', 'HLT', 'HP', 'IBM', 'IBIT', 'ILMN', 'INTC',
        'JNJ', 'JPM', 'KO', 'LYV', 'MRVL', 'NKE', 'NUE', 'NVDA', 'PG',
        'PTON', 'QCOM', 'RACE', 'RIOT', 'RKT', 'SPCE', 'T', 'TEVA', 'TSLA',
        'V', 'WKHS', 'WMG'
    ],
    'Rates/Macro': [
        '^TNX', 'TLT', 'DX-Y.NYB'  # TNX, TLT, DXY
        # Note: CPI, PCE, NFP, USINTR, USUR need FRED API
    ],
    'Commodities/Futures': [
        'USO', 'GLD', 'COPX', '^DJI', '^IXIC', '^GSPC',  # US30, NAS100, SPX500
        'CT=F', 'ZW=F', 'ZC=F', 'ZS=F', 'SB=F', 'KC=F'  # Cotton, Wheat, Corn, Soy, Sugar, Coffee
    ],
    'Forex': [
        'EURUSD=X', 'USDJPY=X', 'GBPJPY=X', 'GBPNZD=X', 
        'EURNZD=X', 'GBPAUD=X', 'GBPCAD=X', 'NZDCAD=X', 'NZDCHF=X'
    ],
    'Crypto': [
        'BTC-USD', 'ETH-USD', 'BNB-USD', 'XRP-USD', 
        'BCH-USD', 'SOL-USD', 'ADA-USD', 'DOT-USD', 'LINK-USD', 'XLM-USD'
    ],
    'Stress': [
        '^VIX', '^VVIX', '^MOVE', '^VXN', '^RVX', '$TRIN.X', '^TYX'
        # Note: BVOL may need different source
    ]
}

def fetch_ticker_data(ticker, start_date='2024-12-22', end_date=None):
    """Fetch historical data for a single ticker"""
    if end_date is None:
        end_date = datetime.now().strftime('%Y-%m-%d')
    
    try:
        # Disable cache to avoid database errors
        data = yf.download(ticker, start=start_date, end=end_date, progress=False, auto_adjust=True)
        if data.empty:
            print(f"⚠️  No data: {ticker}")
            return None
        
        # Flatten multi-index columns if present
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.get_level_values(0)
        
        data['Ticker'] = ticker
        data['Date'] = data.index
        print(f"✅ {ticker}: {len(data)} rows")
        return data
    except Exception as e:
        print(f"❌ {ticker}: {e}")
        return None

def main():
    print("🚀 Starting data fetch (Dec 22, 2024 - Present)...\n")
    
    all_data = []
    failed = []
    
    # Flatten all tickers
    all_tickers = []
    for category, tickers in TICKERS.items():
        print(f"\n📊 {category}")
        for ticker in tickers:
            data = fetch_ticker_data(ticker)
            if data is not None:
                all_data.append(data)
            else:
                failed.append(ticker)
    
    # Combine all data
    if all_data:
        df = pd.concat(all_data, ignore_index=True)
        
        # Reorder columns
        cols = ['Date', 'Ticker', 'Open', 'High', 'Low', 'Close', 'Volume']
        df = df[[col for col in cols if col in df.columns]]
        
        # Export with proper file handling
        output_file = DATA_DIR / f"price_data_dec22_{datetime.now().strftime('%Y%m%d')}.csv"
        try:
            df.to_csv(output_file, index=False, mode='w')
            print(f"\n✅ Saved {len(df)} rows to: {output_file}")
            print(f"📈 Tickers processed: {df['Ticker'].nunique()}")
            print(f"⏱️  Timeframe: Daily bars (Dec 22, 2024 - {datetime.now().strftime('%b %d, %Y')})")
        except OSError as e:
            print(f"\n❌ Error saving file: {e}")
            print("Trying alternative save method...")
            # Try saving in chunks
            df.to_csv(output_file, index=False, chunksize=1000)
            print(f"✅ Saved with chunking")
    
    if failed:
        print(f"\n⚠️  Failed tickers ({len(failed)}): {', '.join(failed)}")
        print("\nNote: Macro indicators (CPI, PCE, NFP, etc.) require FRED API")
    
    # Cleanup to free file handles
    gc.collect()

if __name__ == "__main__":
    main()