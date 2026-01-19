#!/usr/bin/env python3
"""
Calculate confidence scores for symbols based on astrological alignments.
Combines planetary conditions, ingresses, aspects, and lunar phases to score
how favorable conditions are for each symbol.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
import json

# Configuration
ASTRO_DIR = Path("~/Dev/Workspaces/Dec-2025/4castr/csv-pull/market-data/data/astro").expanduser()
FIBONACCI_DIR = Path("~/Dev/Workspaces/Dec-2025/4castr/csv-pull/market-data/data/fibonacci").expanduser()
OUTPUT_DIR = Path("~/Dev/Workspaces/Dec-2025/4castr/csv-pull/market-data/data/scores").expanduser()
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Scoring thresholds
FEATURED_THRESHOLD = 85  # Symbols above this are "featured"
FAVORABLE_THRESHOLD = 70  # Above this is generally favorable
NEUTRAL_THRESHOLD = 50   # Below this is unfavorable

# Planetary rulerships and associations for different sectors
SECTOR_RULERSHIPS = {
    # Technology & Innovation
    'tech': {
        'rulers': ['Uranus', 'Mercury'],
        'favorable_signs': ['Aquarius', 'Gemini', 'Virgo'],
        'keywords': ['tech', 'software', 'innovation', 'digital', 'ai', 'computer']
    },
    # Athletics & Energy
    'athletics': {
        'rulers': ['Mars'],
        'favorable_signs': ['Aries', 'Scorpio'],
        'keywords': ['sport', 'athletic', 'nike', 'fitness', 'gym', 'energy']
    },
    # Finance & Wealth
    'finance': {
        'rulers': ['Jupiter', 'Venus'],
        'favorable_signs': ['Taurus', 'Sagittarius', 'Libra'],
        'keywords': ['bank', 'financial', 'wealth', 'insurance', 'capital']
    },
    # Luxury & Beauty
    'luxury': {
        'rulers': ['Venus'],
        'favorable_signs': ['Taurus', 'Libra'],
        'keywords': ['luxury', 'beauty', 'fashion', 'jewelry', 'cosmetic']
    },
    # Healthcare & Pharmaceuticals
    'healthcare': {
        'rulers': ['Neptune', 'Pluto'],
        'favorable_signs': ['Virgo', 'Pisces', 'Scorpio'],
        'keywords': ['health', 'pharma', 'medical', 'hospital', 'drug', 'biotech']
    },
    # Real Estate & Construction
    'real_estate': {
        'rulers': ['Saturn'],
        'favorable_signs': ['Capricorn', 'Taurus'],
        'keywords': ['real estate', 'construction', 'property', 'building', 'home']
    },
    # Communication & Media
    'communication': {
        'rulers': ['Mercury'],
        'favorable_signs': ['Gemini', 'Virgo'],
        'keywords': ['media', 'communication', 'telecom', 'broadcast', 'news']
    },
    # Entertainment
    'entertainment': {
        'rulers': ['Sun', 'Venus'],
        'favorable_signs': ['Leo', 'Libra'],
        'keywords': ['entertainment', 'movie', 'gaming', 'music', 'streaming']
    }
}

# Aspect scoring weights
ASPECT_SCORES = {
    'harmonious': {
        'conjunction': 0,    # Neutral - depends on planets involved
        'sextile': 15,
        'trine': 20
    },
    'harsh': {
        'square': -15,
        'opposition': -10
    }
}


def load_astro_data():
    """Load all astrological event data."""
    data = {}
    
    files = {
        'aspects': 'aspects.csv',
        'ingresses': 'ingresses.csv',
        'lunar_phases': 'lunar_phases.csv',
        'retrogrades': 'retrogrades.csv',
        'lunar_cycle': 'lunar_cycle_18yr.csv'
    }
    
    for key, filename in files.items():
        path = ASTRO_DIR / filename
        if path.exists():
            df = pd.read_csv(path)
            df['date'] = pd.to_datetime(df['date'])
            data[key] = df
        else:
            print(f"⚠️  Warning: {filename} not found")
            data[key] = pd.DataFrame()
    
    return data


def load_fibonacci_data():
    """Load Fibonacci levels for all symbols."""
    json_path = FIBONACCI_DIR / 'fibonacci_levels.json'
    
    if not json_path.exists():
        print("❌ Fibonacci data not found!")
        return []
    
    with open(json_path, 'r') as f:
        return json.load(f)


def identify_sector(symbol, category):
    """Identify which sector a symbol belongs to."""
    symbol_lower = symbol.lower()
    
    # Check against keywords
    for sector, data in SECTOR_RULERSHIPS.items():
        for keyword in data['keywords']:
            if keyword in symbol_lower:
                return sector
    
    # Default sector based on category
    category_defaults = {
        'crypto': 'tech',
        'forex': 'finance',
        'rates-macro': 'finance',
        'stress': 'finance',
        'commodities': 'real_estate',  # General tangible assets
        'equities': None  # Will need individual analysis
    }
    
    return category_defaults.get(category, None)


def score_ingress_period(current_date, ingresses_df, sector_info):
    """
    Score the current ingress period (like hours on a clock).
    Returns score 0-30 based on how favorable the current sign period is.
    """
    if ingresses_df.empty or not sector_info:
        return 15  # Neutral
    
    # Find the current ingress period (most recent Sun ingress)
    sun_ingresses = ingresses_df[ingresses_df['body'] == 'Sun'].copy()
    sun_ingresses = sun_ingresses[sun_ingresses['date'] <= current_date]
    
    if sun_ingresses.empty:
        return 15
    
    current_ingress = sun_ingresses.iloc[-1]
    current_sign = current_ingress['sign']
    
    # Check if current sign is favorable for this sector
    favorable_signs = sector_info.get('favorable_signs', [])
    
    if current_sign in favorable_signs:
        return 30  # Highly favorable
    elif current_sign in ['Aries', 'Leo', 'Sagittarius']:  # Fire signs - generally active
        return 22
    elif current_sign in ['Taurus', 'Virgo', 'Capricorn']:  # Earth signs - stability
        return 20
    elif current_sign in ['Gemini', 'Libra', 'Aquarius']:  # Air signs - movement
        return 18
    else:  # Water signs - emotional/volatile
        return 12


def score_planetary_aspects(current_date, aspects_df, retrogrades_df, sector_info):
    """
    Score planetary aspects within a ±3 day window.
    Returns score 0-40 based on aspect quality and planetary alignment.
    """
    if aspects_df.empty or not sector_info:
        return 20  # Neutral
    
    # Get aspects within ±3 days
    start_date = current_date - timedelta(days=3)
    end_date = current_date + timedelta(days=3)
    
    active_aspects = aspects_df[
        (aspects_df['date'] >= start_date) & 
        (aspects_df['date'] <= end_date)
    ]
    
    if active_aspects.empty:
        return 20
    
    score = 20  # Start neutral
    sector_rulers = sector_info.get('rulers', [])
    
    # Score primary aspects
    primary_aspects = active_aspects[active_aspects.get('primary_scoring', True) == True]
    
    for _, aspect in primary_aspects.iterrows():
        body1 = aspect['body1']
        body2 = aspect['body2']
        aspect_type = aspect['aspect_type']
        aspect_nature = aspect['aspect_nature']
        
        # Check if sector rulers are involved
        ruler_involved = body1 in sector_rulers or body2 in sector_rulers
        
        # Get base score for aspect
        if aspect_nature == 'harmonious':
            base_score = ASPECT_SCORES['harmonious'].get(aspect_type, 0)
        else:
            base_score = ASPECT_SCORES['harsh'].get(aspect_type, 0)
        
        # Amplify if ruler is involved
        if ruler_involved:
            base_score *= 1.5
        
        score += base_score
    
    # Check for retrograde rulers (reduces score)
    if not retrogrades_df.empty:
        active_retrogrades = retrogrades_df[
            (retrogrades_df['date'] >= start_date) & 
            (retrogrades_df['date'] <= end_date) &
            (retrogrades_df['status'] == 'starts')
        ]
        
        for _, rx in active_retrogrades.iterrows():
            if rx['body'] in sector_rulers:
                score -= 10  # Penalty for ruler going retrograde
    
    # Add bonus points for exact outer planet aspects
    bonus_aspects = active_aspects[active_aspects.get('bonus_eligible', False) == True]
    for _, bonus in bonus_aspects.iterrows():
        if bonus.get('exact', False):
            influence = bonus.get('influence_weight', 85)
            score += (influence / 100) * 5  # Small bonus (max +5)
    
    return max(0, min(40, score))  # Clamp to 0-40


def score_lunar_phase(current_date, lunar_phases_df):
    """
    Score the lunar phase (precision timing).
    Returns score 0-20 based on lunar phase favorability.
    """
    if lunar_phases_df.empty:
        return 10  # Neutral
    
    # Find current lunar phase
    phases_before = lunar_phases_df[lunar_phases_df['date'] <= current_date]
    
    if phases_before.empty:
        return 10
    
    current_phase_row = phases_before.iloc[-1]
    current_phase = current_phase_row['phase']
    
    # Score based on phase
    phase_scores = {
        'new': 18,              # New beginnings
        'waxing_crescent': 16,  # Building momentum
        'first_quarter': 15,    # Action phase
        'waxing_gibbous': 14,   # Refinement
        'full': 12,             # Peak/reversal
        'waning_gibbous': 10,   # Releasing
        'last_quarter': 8,      # Restructuring
        'waning_crescent': 6    # Ending/rest
    }
    
    return phase_scores.get(current_phase, 10)


def score_18yr_lunar_cycle(current_date, lunar_cycle_df):
    """
    Score the 18.6-year lunar cycle bonus (power-up).
    Returns 0-10 bonus points for being near critical cycle points.
    """
    if lunar_cycle_df.empty:
        return 0
    
    # Check if we're at a bonus-eligible cycle point
    active_cycles = lunar_cycle_df[
        (lunar_cycle_df['date'] >= current_date - timedelta(days=30)) &
        (lunar_cycle_df['date'] <= current_date + timedelta(days=30))
    ]
    
    bonus_cycles = active_cycles[active_cycles.get('bonus_eligible', False) == True]
    
    if not bonus_cycles.empty:
        # Major cycle point detected - give bonus
        return 10
    
    return 0


def calculate_confidence_score(symbol_data, astro_data, current_date=None):
    """
    Calculate overall confidence score for a symbol.
    
    Score components:
    - Ingress Period: 0-30 (general timing)
    - Planetary Aspects: 0-40 (specific alignments)
    - Lunar Phase: 0-20 (precision timing)
    - 18.6yr Cycle Bonus: 0-10 (power-up)
    
    Total: 0-100+ (can exceed 100 with bonuses)
    """
    if current_date is None:
        current_date = datetime.now()
    
    symbol = symbol_data['symbol']
    category = symbol_data['category']
    
    # Identify sector
    sector = identify_sector(symbol, category)
    sector_info = SECTOR_RULERSHIPS.get(sector) if sector else None
    
    # Calculate component scores
    ingress_score = score_ingress_period(
        current_date,
        astro_data['ingresses'],
        sector_info
    )
    
    aspects_score = score_planetary_aspects(
        current_date,
        astro_data['aspects'],
        astro_data['retrogrades'],
        sector_info
    )
    
    lunar_score = score_lunar_phase(
        current_date,
        astro_data['lunar_phases']
    )
    
    cycle_bonus = score_18yr_lunar_cycle(
        current_date,
        astro_data['lunar_cycle']
    )
    
    # Calculate total
    base_score = ingress_score + aspects_score + lunar_score
    total_score = base_score + cycle_bonus
    
    # Determine rating
    if total_score >= FEATURED_THRESHOLD:
        rating = 'featured'
    elif total_score >= FAVORABLE_THRESHOLD:
        rating = 'favorable'
    elif total_score >= NEUTRAL_THRESHOLD:
        rating = 'neutral'
    else:
        rating = 'unfavorable'
    
    return {
        'symbol': symbol,
        'category': category,
        'sector': sector,
        'date': current_date.strftime('%Y-%m-%d'),
        'total_score': round(total_score, 2),
        'base_score': round(base_score, 2),
        'rating': rating,
        'components': {
            'ingress_period': round(ingress_score, 2),
            'planetary_aspects': round(aspects_score, 2),
            'lunar_phase': round(lunar_score, 2),
            'cycle_bonus': round(cycle_bonus, 2)
        },
        'is_featured': total_score >= FEATURED_THRESHOLD
    }


def main():
    print("🎯 Starting confidence score calculations...")
    
    # Load data
    print("\n📊 Loading astrological data...")
    astro_data = load_astro_data()
    
    print("📈 Loading Fibonacci levels...")
    fibonacci_data = load_fibonacci_data()
    
    if not fibonacci_data:
        print("❌ No Fibonacci data to score!")
        return
    
    print(f"✅ Loaded data for {len(fibonacci_data)} symbols")
    
    # Calculate scores for current date
    current_date = datetime.now()
    print(f"\n📅 Calculating scores for: {current_date.strftime('%Y-%m-%d')}")
    
    all_scores = []
    featured_symbols = []
    
    for symbol_data in fibonacci_data:
        score_result = calculate_confidence_score(symbol_data, astro_data, current_date)
        all_scores.append(score_result)
        
        if score_result['is_featured']:
            featured_symbols.append(score_result)
    
    # Sort by score
    all_scores.sort(key=lambda x: x['total_score'], reverse=True)
    
    # Save results
    print("\n💾 Saving confidence scores...")
    
    # Current scores
    scores_file = OUTPUT_DIR / f"confidence_scores_{current_date.strftime('%Y%m%d')}.json"
    with open(scores_file, 'w') as f:
        json.dump(all_scores, f, indent=2)
    
    # Featured symbols
    featured_file = OUTPUT_DIR / f"featured_symbols_{current_date.strftime('%Y%m%d')}.json"
    with open(featured_file, 'w') as f:
        json.dump(featured_symbols, f, indent=2)
    
    # Summary CSV
    scores_df = pd.DataFrame(all_scores)
    csv_file = OUTPUT_DIR / f"confidence_scores_{current_date.strftime('%Y%m%d')}.csv"
    scores_df.to_csv(csv_file, index=False)
    
    print("\n✅ Scoring complete!")
    print(f"\n📊 Summary:")
    print(f"   • Total symbols scored: {len(all_scores)}")
    print(f"   • Featured symbols (≥85): {len(featured_symbols)}")
    print(f"   • Favorable symbols (≥70): {len([s for s in all_scores if s['total_score'] >= 70])}")
    print(f"   • Average score: {np.mean([s['total_score'] for s in all_scores]):.2f}")
    print(f"\n🌟 Top 10 Symbols:")
    for i, score in enumerate(all_scores[:10], 1):
        print(f"   {i}. {score['symbol']} ({score['category']}) - {score['total_score']:.2f} [{score['rating']}]")
    
    print(f"\n📁 Data saved to: {OUTPUT_DIR}")


if __name__ == '__main__':
    main()