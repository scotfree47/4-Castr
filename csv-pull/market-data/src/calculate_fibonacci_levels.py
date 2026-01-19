#!/usr/bin/env python3
"""
Calculate Fibonacci fan and retracement levels from solstice/equinox anchors.
Combines price data with astrological timing for market forecasting.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
import json

# Configuration
DATA_DIR = Path("~/Dev/Workspaces/Dec-2025/4castr/csv-pull/market-data/data").expanduser()
ASTRO_DIR = Path("~/Dev/Workspaces/Dec-2025/4castr/csv-pull/market-data/data/astro").expanduser()
OUTPUT_DIR = Path("~/Dev/Workspaces/Dec-2025/4castr/csv-pull/market-data/data/fibonacci").expanduser()
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Fibonacci ratios for retracement levels
RETRACEMENT_LEVELS = [0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.272, 1.618]

# Fibonacci ratios for fan/speed lines
FAN_LEVELS = [0.382, 0.5, 0.618]

# Years to analyze (6 years of historical data for pattern recognition)
ANALYSIS_YEARS = 6


def load_price_data(category):
    """Load price data for a category."""
    csv_path = DATA_DIR / category / f"{category.replace('-', '_')}_solstice_equinox.csv"
    
    if not csv_path.exists():
        print(f"⚠️  Warning: {csv_path} not found, skipping...")
        return None
    
    try:
        df = pd.read_csv(csv_path)
        # Standardize column names (preserve original case first)
        
        # Map different column names to standard format
        column_mapping = {}
        
        # Symbol/Ticker columns
        for col in df.columns:
            col_lower = col.lower()
            if col_lower in ['symbol', 'ticker']:
                column_mapping[col] = 'symbol'
            elif col_lower in ['commodity', 'pair', 'indicator']:
                column_mapping[col] = 'symbol'
            elif col_lower == 'date':
                column_mapping[col] = 'date'
            elif col_lower in ['price', 'rate', 'value', 'close']:
                column_mapping[col] = 'price'
            elif col_lower in ['high']:
                column_mapping[col] = 'high'
            elif col_lower in ['low']:
                column_mapping[col] = 'low'
        
        df = df.rename(columns=column_mapping)
        
        # Skip if no symbol or price column
        if 'symbol' not in df.columns or 'price' not in df.columns:
            print(f"⚠️  Skipping {category}: missing symbol or price columns")
            return None
        
        # Parse date column
        if 'date' in df.columns:
            df['date'] = pd.to_datetime(df['date'])
        else:
            print(f"⚠️  No date column found in {csv_path}")
            return None
        
        return df
    except Exception as e:
        print(f"❌ Error loading {csv_path}: {e}")
        return None


def load_seasonal_anchors():
    """Load precomputed seasonal anchor dates."""
    anchors_path = ASTRO_DIR / 'seasonal_anchors.csv'
    
    if not anchors_path.exists():
        print(f"❌ Seasonal anchors not found at {anchors_path}")
        return None
    
    df = pd.read_csv(anchors_path)
    df['date'] = pd.to_datetime(df['date'])
    return df


def get_anchor_price(price_df, anchor_date, anchor_type, symbol):
    """
    Get the appropriate price for an anchor date.
    Solstices use HIGH, Equinoxes use LOW.
    """
    # Find the row for this date and symbol
    date_match = price_df[(price_df['date'] == anchor_date) & (price_df['symbol'] == symbol)]
    
    if date_match.empty:
        # Try nearby dates (±3 days)
        for offset in [-3, -2, -1, 1, 2, 3]:
            nearby_date = anchor_date + timedelta(days=offset)
            date_match = price_df[(price_df['date'] == nearby_date) & (price_df['symbol'] == symbol)]
            if not date_match.empty:
                break
    
    if date_match.empty:
        return None
    
    row = date_match.iloc[0]
    
    # Determine which price to use based on anchor type
    if anchor_type == 'high':  # Solstices
        # Try to use 'high' column, fallback to 'price'
        price = row.get('high', row.get('price', None))
    else:  # Equinoxes (low)
        # Try to use 'low' column, fallback to 'price'
        price = row.get('low', row.get('price', None))
    
    return float(price) if price is not None and pd.notna(price) else None


def calculate_fibonacci_retracement(high, low, levels=RETRACEMENT_LEVELS):
    """Calculate Fibonacci retracement levels between high and low."""
    diff = high - low
    
    retracements = {}
    for level in levels:
        if level <= 1.0:
            # Standard retracements (below 100%)
            retracements[f'{level:.3f}'] = low + (diff * level)
        else:
            # Extensions (above 100%)
            retracements[f'{level:.3f}'] = high + (diff * (level - 1))
    
    return retracements


def calculate_fibonacci_fan(start_price, end_price, start_date, end_date, levels=FAN_LEVELS):
    """
    Calculate Fibonacci fan (speed resistance) lines.
    These are trend lines drawn at Fibonacci angles.
    """
    time_diff = (end_date - start_date).days
    price_diff = end_price - start_price
    
    fan_lines = {}
    for level in levels:
        # Calculate the slope for this Fibonacci level
        slope = (price_diff * level) / time_diff
        fan_lines[f'{level:.3f}'] = {
            'slope': slope,
            'start_price': start_price,
            'start_date': start_date.strftime('%Y-%m-%d'),
            'level': level
        }
    
    return fan_lines


def calculate_time_projections(start_date, end_date, target_levels):
    """
    Project when price might reach certain levels based on time.
    Uses Fibonacci time ratios.
    """
    time_span = (end_date - start_date).days
    
    projections = {}
    for level_name, level_price in target_levels.items():
        # Project dates using Fibonacci time extensions
        for time_ratio in [1.0, 1.272, 1.618, 2.618]:
            projected_days = int(time_span * time_ratio)
            projected_date = end_date + timedelta(days=projected_days)
            
            if projected_date > datetime.now():
                projections[f'{level_name}_t{time_ratio}'] = {
                    'target_price': level_price,
                    'target_date': projected_date.strftime('%Y-%m-%d'),
                    'time_ratio': time_ratio,
                    'days_from_anchor': projected_days
                }
    
    return projections


def process_symbol(symbol, price_df, anchors_df, category):
    """Process a single symbol and calculate all Fibonacci levels."""
    result = {
        'symbol': symbol,
        'category': category,
        'anchors': [],
        'fibonacci_levels': {},
        'projections': []
    }
    
    # Get recent anchors (last 6 years)
    recent_date = datetime.now() - timedelta(days=365 * ANALYSIS_YEARS)
    recent_anchors = anchors_df[anchors_df['date'] >= recent_date].sort_values('date')
    
    if recent_anchors.empty:
        return None
    
    # Filter price data for this symbol
    symbol_df = price_df[price_df['symbol'] == symbol].copy()
    
    if symbol_df.empty:
        return None
    
    # Process each anchor
    for idx, anchor in recent_anchors.iterrows():
        anchor_date = anchor['date']
        anchor_type = anchor['anchor_type']
        seasonal_type = anchor['type']
        
        # Get the appropriate price for this anchor
        anchor_price = get_anchor_price(
            symbol_df, 
            anchor_date, 
            anchor_type, 
            symbol
        )
        
        if anchor_price is None:
            continue
        
        result['anchors'].append({
            'date': anchor_date.strftime('%Y-%m-%d'),
            'type': seasonal_type,
            'anchor_type': anchor_type,
            'price': anchor_price,
            'sign': anchor['sign']
        })
    
    # Skip if we don't have enough anchors
    if len(result['anchors']) < 2:
        return None
    
    # Calculate Fibonacci levels between consecutive anchors
    anchors_list = result['anchors']
    
    for i in range(len(anchors_list) - 1):
        anchor1 = anchors_list[i]
        anchor2 = anchors_list[i + 1]
        
        price1 = anchor1['price']
        price2 = anchor2['price']
        date1 = pd.to_datetime(anchor1['date'])
        date2 = pd.to_datetime(anchor2['date'])
        
        # Determine high and low
        high = max(price1, price2)
        low = min(price1, price2)
        
        # Calculate retracements
        retracements = calculate_fibonacci_retracement(high, low)
        
        # Calculate fan lines
        fan_lines = calculate_fibonacci_fan(price1, price2, date1, date2)
        
        # Calculate time projections
        projections = calculate_time_projections(date1, date2, retracements)
        
        level_key = f"{anchor1['date']}_to_{anchor2['date']}"
        result['fibonacci_levels'][level_key] = {
            'from_anchor': anchor1,
            'to_anchor': anchor2,
            'high': high,
            'low': low,
            'retracements': retracements,
            'fan_lines': fan_lines,
            'current_range': high - low,
            'time_span_days': (date2 - date1).days
        }
        
        # Add projections for future dates
        if projections:
            result['projections'].extend([
                {**proj, 'anchor_pair': level_key} 
                for proj in projections.values()
            ])
    
    return result


def main():
    print("🎯 Starting Fibonacci level calculations...")
    print(f"📊 Analyzing {ANALYSIS_YEARS} years of historical anchor data")
    
    # Load seasonal anchors
    print("\n📅 Loading seasonal anchor dates...")
    anchors_df = load_seasonal_anchors()
    
    if anchors_df is None:
        print("❌ Cannot proceed without seasonal anchors")
        return
    
    print(f"✅ Loaded {len(anchors_df)} seasonal anchor points")
    
    # Process each category
    categories = ['commodities', 'crypto', 'equities', 'forex', 'rates-macro', 'stress']
    all_results = []
    
    for category in categories:
        print(f"\n📈 Processing {category}...")
        
        price_df = load_price_data(category)
        
        if price_df is None:
            continue
        
        # Get unique symbols
        if 'symbol' not in price_df.columns:
            print(f"⚠️  No symbol column found in {category}")
            continue
        
        symbols = price_df['symbol'].unique()
        print(f"   Found {len(symbols)} symbols")
        
        processed_count = 0
        for symbol in symbols:
            result = process_symbol(
                symbol, 
                price_df, 
                anchors_df, 
                category
            )
            
            if result and result['anchors']:
                all_results.append(result)
                processed_count += 1
        
        print(f"   ✅ Processed {processed_count} symbols")
    
    # Save results
    print(f"\n💾 Saving Fibonacci calculations...")
    
    # Save as JSON for easy API consumption
    output_file = OUTPUT_DIR / 'fibonacci_levels.json'
    with open(output_file, 'w') as f:
        json.dump(all_results, f, indent=2)
    
    # Also save as CSV for analysis
    flat_results = []
    for result in all_results:
        for level_key, level_data in result['fibonacci_levels'].items():
            flat_results.append({
                'symbol': result['symbol'],
                'category': result['category'],
                'anchor_pair': level_key,
                'high': level_data['high'],
                'low': level_data['low'],
                'range': level_data['current_range'],
                'time_span_days': level_data['time_span_days'],
                **{f'fib_{k}': v for k, v in level_data['retracements'].items()}
            })
    
    if flat_results:
        csv_output = OUTPUT_DIR / 'fibonacci_levels.csv'
        pd.DataFrame(flat_results).to_csv(csv_output, index=False)
    
    print(f"\n✅ Calculation complete!")
    print(f"📊 Processed {len(all_results)} symbols")
    print(f"📁 Data saved to: {OUTPUT_DIR}")
    print(f"   • {output_file.name} - Full data with projections")
    print(f"   • fibonacci_levels.csv - Flattened for analysis")


if __name__ == '__main__':
    main()