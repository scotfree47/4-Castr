#!/usr/bin/env python3
"""
Fetch and compute comprehensive astrological data for market timing.
Includes primary planets, outer planets, lunar cycles, and chart points.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
import json
from skyfield.api import load, Topos
from skyfield import almanac
from skyfield.framelib import ecliptic_frame
import swisseph as swe

# Configuration
START_DATE = datetime(2004, 12, 21)
END_DATE = datetime.now()
DATA_DIR = Path("~/Dev/Workspaces/Dec-2025/4castr/csv-pull/market-data/data").expanduser()
OUTPUT_DIR = Path("~/Dev/Workspaces/Dec-2025/4castr/csv-pull/market-data/data/astro").expanduser()
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Initialize ephemeris
ts = load.timescale()
eph = load('de421.bsp')  # JPL ephemeris

# Setup Swiss Ephemeris data directory
EPHE_PATH = Path.home() / '.swisseph'
EPHE_PATH.mkdir(exist_ok=True)
swe.set_ephe_path(str(EPHE_PATH))

# Download ephemeris files if needed
import urllib.request
EPHE_FILES = ['seas_18.se1', 'semo_18.se1', 'sepl_18.se1']
for filename in EPHE_FILES:
    filepath = EPHE_PATH / filename
    if not filepath.exists():
        print(f'📥 Downloading ephemeris file: {filename}...')
        url = f'https://github.com/astrorigin/pyswisseph/raw/master/swisseph/{filename}'
        try:
            urllib.request.urlretrieve(url, filepath)
            print(f'✅ Downloaded {filename}')
        except Exception as e:
            print(f'⚠️  Could not download {filename}: {e}')
            print(f'   You may need to manually download from: https://www.astro.com/ftp/swisseph/ephe/')

# Planet definitions
PRIMARY_PLANETS = {
    'Sun': 0,
    'Moon': 1,
    'Mercury': 2,
    'Venus': 3,
    'Mars': 4,
    'Jupiter': 5,
    'Saturn': 6
}

OUTER_PLANETS = {
    'Uranus': {'code': 7, 'influence': 90, 'orb_strict': 1.0},
    'Neptune': {'code': 8, 'influence': 85, 'orb_strict': 1.0},
    'Pluto': {'code': 9, 'influence': 95, 'orb_strict': 1.0}
}

CHART_POINTS = {
    'North_Node': {'code': 11, 'influence': 50, 'orb_strict': 0.5},
    'South_Node': {'code': 10, 'influence': 45, 'orb_strict': 0.5},
    'Chiron': {'code': 15, 'influence': 35, 'orb_strict': 1.0},
    'Lilith': {'code': 12, 'influence': 30, 'orb_strict': 1.0}
}

ANGLES = {
    'MC': {'influence': 65, 'orb_strict': 1.0},
    'IC': {'influence': 60, 'orb_strict': 1.0},
    'ASC': {'influence': 40, 'orb_strict': 1.0},
    'DESC': {'influence': 40, 'orb_strict': 1.0}
}

# Aspect definitions with orbs and nature
ASPECTS = [
    {'name': 'conjunction', 'degrees': 0, 'orb': 8, 'nature': 'neutral'},
    {'name': 'sextile', 'degrees': 60, 'orb': 4, 'nature': 'harmonious'},
    {'name': 'square', 'degrees': 90, 'orb': 6, 'nature': 'harsh'},
    {'name': 'trine', 'degrees': 120, 'orb': 6, 'nature': 'harmonious'},
    {'name': 'opposition', 'degrees': 180, 'orb': 6, 'nature': 'harsh'}
]

# Zodiac signs with rulerships
ZODIAC_SIGNS = [
    {'name': 'Aries', 'ruler': 'Mars', 'element': 'fire', 'modality': 'cardinal'},
    {'name': 'Taurus', 'ruler': 'Venus', 'element': 'earth', 'modality': 'fixed'},
    {'name': 'Gemini', 'ruler': 'Mercury', 'element': 'air', 'modality': 'mutable'},
    {'name': 'Cancer', 'ruler': 'Moon', 'element': 'water', 'modality': 'cardinal'},
    {'name': 'Leo', 'ruler': 'Sun', 'element': 'fire', 'modality': 'fixed'},
    {'name': 'Virgo', 'ruler': 'Mercury', 'element': 'earth', 'modality': 'mutable'},
    {'name': 'Libra', 'ruler': 'Venus', 'element': 'air', 'modality': 'cardinal'},
    {'name': 'Scorpio', 'ruler': 'Mars', 'element': 'water', 'modality': 'fixed'},
    {'name': 'Sagittarius', 'ruler': 'Jupiter', 'element': 'fire', 'modality': 'mutable'},
    {'name': 'Capricorn', 'ruler': 'Saturn', 'element': 'earth', 'modality': 'cardinal'},
    {'name': 'Aquarius', 'ruler': 'Saturn', 'element': 'air', 'modality': 'fixed'},
    {'name': 'Pisces', 'ruler': 'Jupiter', 'element': 'water', 'modality': 'mutable'}
]


def get_zodiac_sign(longitude):
    """Convert ecliptic longitude to zodiac sign."""
    sign_index = int(longitude / 30) % 12
    return ZODIAC_SIGNS[sign_index]


def normalize_angle(angle):
    """Normalize angle to 0-360 range."""
    return angle % 360


def check_aspect(lon1, lon2):
    """Check if two longitudes form an aspect."""
    diff = abs(lon1 - lon2)
    if diff > 180:
        diff = 360 - diff
    
    for aspect in ASPECTS:
        orb_diff = abs(diff - aspect['degrees'])
        if orb_diff <= aspect['orb']:
            return {
                'type': aspect['name'],
                'nature': aspect['nature'],
                'orb': round(orb_diff, 2),
                'exact': orb_diff < 1
            }
    return None


def calculate_lunar_phase(sun_lon, moon_lon):
    """Calculate detailed lunar phase."""
    angle = normalize_angle(moon_lon - sun_lon)
    illumination = (1 - np.cos(np.radians(angle))) / 2 * 100
    
    phases = [
        (22.5, 'new'),
        (67.5, 'waxing_crescent'),
        (112.5, 'first_quarter'),
        (157.5, 'waxing_gibbous'),
        (202.5, 'full'),
        (247.5, 'waning_gibbous'),
        (292.5, 'last_quarter'),
        (337.5, 'waning_crescent'),
        (360, 'new')
    ]
    
    phase = 'new'
    for threshold, name in phases:
        if angle < threshold:
            phase = name
            break
    
    return {
        'phase': phase,
        'illumination': round(illumination, 1),
        'angle': round(angle, 2)
    }


def calculate_lunar_cycle_phase(date):
    """
    Calculate 18.6-year lunar nodal cycle phase.
    Based on Louise McWhirter's principles.
    Returns bonus-eligible status when within tight orb of major phases.
    """
    # Reference: J2000 epoch node position
    j2000_node = 125.04  # Mean longitude at J2000
    node_rate = -0.052954  # degrees per day (retrograde)
    
    days_since_j2000 = (date - datetime(2000, 1, 1)).days
    current_node = normalize_angle(j2000_node + (node_rate * days_since_j2000))
    
    # 18.6 year cycle = 6793.5 days
    cycle_length = 6793.5
    cycle_position = (days_since_j2000 % cycle_length) / cycle_length * 360
    
    # Key phases of the 18.6yr cycle
    cycle_phases = [
        (0, 'start', 'Ascending Node - Cycle initiation', 2),
        (90, 'first_quadrature', 'Interim volatility pivot', 2),
        (137, 'fibonacci_38', 'Minor reaction / harmonic pivot', 3),
        (180, 'opposition', 'Major volatility / turning point', 1),  # MOST IMPORTANT
        (223, 'fibonacci_61', 'Secondary reaction pivot', 3),
        (270, 'second_quadrature', 'Intermediate volatility peak', 2),
        (360, 'completion', 'Cycle reset / secular trend pivot', 1)  # MOST IMPORTANT
    ]
    
    phase_info = None
    bonus_eligible = False
    
    for degree, phase_name, description, orb in cycle_phases:
        diff = abs(cycle_position - degree)
        if diff < orb:
            phase_info = {
                'phase': phase_name,
                'description': description,
                'orb': round(diff, 2),
                'at_key_point': True
            }
            # Only tight orbs qualify for bonus scoring
            bonus_eligible = diff < 2 and phase_name in ['opposition', 'completion', 'start']
            break
    
    return {
        'cycle_position': round(cycle_position, 2),
        'node_longitude': round(current_node, 2),
        'key_phase': phase_info,
        'bonus_eligible': bonus_eligible,
        'cycle_days_elapsed': int(days_since_j2000 % cycle_length)
    }


def get_planet_position(planet_code, jd):
    """Get planet position using Swiss Ephemeris."""
    result = swe.calc_ut(jd, planet_code)
    longitude = result[0][0]
    speed = result[0][3]
    is_stationary = abs(speed) < 0.01  # Nearly stationary = stronger influence
    return {
        'longitude': round(longitude, 4),
        'retrograde': speed < 0,
        'stationary': is_stationary,
        'speed': round(speed, 4),
        'sign': get_zodiac_sign(longitude)
    }


def calculate_angles(jd, latitude=40.7128, longitude=-74.0060):
    """Calculate MC, IC, ASC, DESC."""
    # Use New York as default location (can be parameterized)
    houses = swe.houses(jd, latitude, longitude, b'P')  # Placidus house system
    
    asc = houses[1][0]  # Ascendant
    mc = houses[1][1]   # MC (Midheaven)
    
    return {
        'ASC': {'longitude': round(asc, 4), 'sign': get_zodiac_sign(asc)},
        'DESC': {'longitude': round((asc + 180) % 360, 4), 'sign': get_zodiac_sign((asc + 180) % 360)},
        'MC': {'longitude': round(mc, 4), 'sign': get_zodiac_sign(mc)},
        'IC': {'longitude': round((mc + 180) % 360, 4), 'sign': get_zodiac_sign((mc + 180) % 360)}
    }


def compute_daily_positions(date):
    """Compute all planetary positions and events for a given date."""
    jd = swe.julday(date.year, date.month, date.day, 12.0)  # Noon
    
    positions = {}
    
    # Primary planets
    for name, code in PRIMARY_PLANETS.items():
        positions[name] = get_planet_position(code, jd)
    
    # Outer planets (for supplemental bonus scoring)
    for name, data in OUTER_PLANETS.items():
        pos = get_planet_position(data['code'], jd)
        pos['influence_weight'] = data['influence']
        pos['bonus_eligible'] = pos['stationary']  # Only stationary outer planets count
        positions[name] = pos
    
    # Chart points (for supplemental bonus scoring)
    for name, data in CHART_POINTS.items():
        pos = get_planet_position(data['code'], jd)
        pos['influence_weight'] = data['influence']
        positions[name] = pos
    
    # Angles (MC, IC, ASC, DESC)
    angles = calculate_angles(jd)
    for angle_name, angle_data in angles.items():
        angle_data['influence_weight'] = ANGLES[angle_name]['influence']
    positions.update(angles)
    
    return positions


def generate_aspects(positions, date, primary_only=True):
    """Generate all aspects for the day."""
    aspects = []
    
    bodies = list(PRIMARY_PLANETS.keys()) if primary_only else list(positions.keys())
    
    for i, body1 in enumerate(bodies):
        for body2 in bodies[i+1:]:
            if body1 in positions and body2 in positions:
                lon1 = positions[body1]['longitude']
                lon2 = positions[body2]['longitude']
                aspect = check_aspect(lon1, lon2)
                
                if aspect:
                    aspects.append({
                        'date': date.strftime('%Y-%m-%d'),
                        'body1': body1,
                        'body2': body2,
                        'aspect_type': aspect['type'],
                        'aspect_nature': aspect['nature'],
                        'orb': aspect['orb'],
                        'exact': aspect['exact'],
                        'body1_sign': positions[body1]['sign']['name'],
                        'body2_sign': positions[body2]['sign']['name'],
                        'primary_scoring': True
                    })
    
    # Generate bonus aspects (outer planets with tight orbs only)
    bonus_aspects = []
    outer_bodies = list(OUTER_PLANETS.keys())
    
    for outer in outer_bodies:
        if outer not in positions:
            continue
        for primary in PRIMARY_PLANETS.keys():
            lon1 = positions[outer]['longitude']
            lon2 = positions[primary]['longitude']
            aspect = check_aspect(lon1, lon2)
            
            # Only exact aspects (<1° orb) qualify for bonus
            if aspect and aspect['exact']:
                bonus_aspects.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'body1': outer,
                    'body2': primary,
                    'aspect_type': aspect['type'],
                    'aspect_nature': aspect['nature'],
                    'orb': aspect['orb'],
                    'exact': True,
                    'body1_sign': positions[outer]['sign']['name'],
                    'body2_sign': positions[primary]['sign']['name'],
                    'primary_scoring': False,
                    'bonus_eligible': True,
                    'influence_weight': positions[outer]['influence_weight']
                })
    
    return aspects + bonus_aspects


def detect_ingresses(current_positions, previous_positions, date):
    """Detect sign changes (ingresses)."""
    ingresses = []
    
    for body in PRIMARY_PLANETS.keys():
        if body in previous_positions:
            curr_sign = current_positions[body]['sign']['name']
            prev_sign = previous_positions[body]['sign']['name']
            
            if curr_sign != prev_sign:
                ingresses.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'body': body,
                    'sign': curr_sign,
                    'from_sign': prev_sign,
                    'ruler': current_positions[body]['sign']['ruler'],
                    'element': current_positions[body]['sign']['element']
                })
    
    return ingresses


def compute_solstices_equinoxes(year):
    """Compute exact solstice and equinox dates for a year."""
    t0 = ts.utc(year, 1, 1)
    t1 = ts.utc(year, 12, 31)
    
    earth = eph['earth']
    sun = eph['sun']
    
    times, events = almanac.find_discrete(t0, t1, almanac.seasons(eph))
    
    seasonal_points = []
    event_names = ['vernal_equinox', 'summer_solstice', 'autumn_equinox', 'winter_solstice']
    signs = ['Aries', 'Cancer', 'Libra', 'Capricorn']
    
    for time, event in zip(times, events):
        seasonal_points.append({
            'date': time.utc_datetime().strftime('%Y-%m-%d'),
            'type': event_names[event],
            'sign': signs[event],
            'fibonacci_anchor': True,
            'anchor_type': 'high' if event in [1, 3] else 'low'  # Solstices=high, Equinoxes=low
        })
    
    return seasonal_points


def main():
    print("🌟 Starting comprehensive astrological data computation...")
    print(f"📅 Date range: {START_DATE.date()} → {END_DATE.date()}")
    
    # Storage
    all_aspects = []
    all_ingresses = []
    all_lunar_phases = []
    all_seasonal_points = []
    all_retrogrades = []
    all_lunar_cycle_phases = []
    
    # Compute seasonal points for all years
    print("\n🔆 Computing solstice/equinox anchor dates...")
    for year in range(START_DATE.year, END_DATE.year + 1):
        seasonal = compute_solstices_equinoxes(year)
        all_seasonal_points.extend(seasonal)
    print(f"✅ Found {len(all_seasonal_points)} seasonal anchor points")
    
    # Daily computation
    print("\n📊 Processing daily planetary positions...")
    current_date = START_DATE
    previous_positions = None
    previous_retrogrades = {}
    
    day_count = 0
    
    while current_date <= END_DATE:
        positions = compute_daily_positions(current_date)
        
        # Aspects (primary planets only for scoring)
        aspects = generate_aspects(positions, current_date, primary_only=True)
        all_aspects.extend(aspects)
        
        # Ingresses
        if previous_positions:
            ingresses = detect_ingresses(positions, previous_positions, current_date)
            all_ingresses.extend(ingresses)
        
        # Retrograde stations (including outer planets for bonus scoring)
        all_bodies = {**PRIMARY_PLANETS, **{k: v['code'] for k, v in OUTER_PLANETS.items()}}
        for body in list(all_bodies.keys())[2:]:  # Skip Sun and Moon
            if body not in positions:
                continue
            is_rx = positions[body]['retrograde']
            is_stationary = positions[body].get('stationary', False)
            
            if body in previous_retrogrades and previous_retrogrades[body] != is_rx:
                retrograde_entry = {
                    'date': current_date.strftime('%Y-%m-%d'),
                    'body': body,
                    'status': 'starts' if is_rx else 'ends',
                    'sign': positions[body]['sign']['name'],
                    'stationary': is_stationary
                }
                
                # Mark outer planets as bonus-eligible when stationary
                if body in OUTER_PLANETS:
                    retrograde_entry['primary_scoring'] = False
                    retrograde_entry['bonus_eligible'] = is_stationary
                    retrograde_entry['influence_weight'] = OUTER_PLANETS[body]['influence']
                else:
                    retrograde_entry['primary_scoring'] = True
                
                all_retrogrades.append(retrograde_entry)
            
            previous_retrogrades[body] = is_rx
        
        # Lunar phase
        lunar_phase = calculate_lunar_phase(
            positions['Sun']['longitude'],
            positions['Moon']['longitude']
        )
        all_lunar_phases.append({
            'date': current_date.strftime('%Y-%m-%d'),
            'phase': lunar_phase['phase'],
            'illumination': lunar_phase['illumination'],
            'sign': positions['Moon']['sign']['name'],
            'ruler': positions['Moon']['sign']['ruler']
        })
        
        # 18.6yr Lunar Cycle Phase
        lunar_cycle = calculate_lunar_cycle_phase(current_date)
        if lunar_cycle['key_phase']:  # Only store when near key points
            all_lunar_cycle_phases.append({
                'date': current_date.strftime('%Y-%m-%d'),
                **lunar_cycle
            })
        
        previous_positions = positions
        day_count += 1
        
        if day_count % 365 == 0:
            print(f"   Processed {day_count} days ({current_date.year})...")
        
        current_date += timedelta(days=1)
    
    # Save all data
    print("\n💾 Saving data files...")
    
    pd.DataFrame(all_seasonal_points).to_csv(
        OUTPUT_DIR / 'seasonal_anchors.csv', index=False
    )
    pd.DataFrame(all_aspects).to_csv(
        OUTPUT_DIR / 'aspects.csv', index=False
    )
    pd.DataFrame(all_ingresses).to_csv(
        OUTPUT_DIR / 'ingresses.csv', index=False
    )
    pd.DataFrame(all_lunar_phases).to_csv(
        OUTPUT_DIR / 'lunar_phases.csv', index=False
    )
    pd.DataFrame(all_retrogrades).to_csv(
        OUTPUT_DIR / 'retrogrades.csv', index=False
    )
    pd.DataFrame(all_lunar_cycle_phases).to_csv(
        OUTPUT_DIR / 'lunar_cycle_18yr.csv', index=False
    )
    
    print("\n✅ Computation complete!")
    print(f"\n📋 Summary:")
    print(f"   • Seasonal Anchors: {len(all_seasonal_points)}")
    print(f"   • Aspects: {len(all_aspects)}")
    print(f"   • Ingresses: {len(all_ingresses)}")
    print(f"   • Lunar Phases: {len(all_lunar_phases)}")
    print(f"   • Retrograde Stations: {len(all_retrogrades)}")
    print(f"   • 18.6yr Cycle Key Points: {len(all_lunar_cycle_phases)}")
    print(f"\n📁 Data saved to: {OUTPUT_DIR}")


if __name__ == '__main__':
    main()