// ============================================================================
// ADDITIONS TO EXISTING keyLevels.ts
// Add these functions to the END of your current file
// ============================================================================

// ============================================================================
// CONFLUENCE DETECTION & SCORING
// ============================================================================

export interface ConfluenceZone {
  price: number;
  levels: KeyLevel[];
  confluenceScore: number; // 0-100
  types: Set<string>; // unique level types present
  strength: number; // combined strength of all levels
  proximity: number; // distance from current price (%)
}

/**
 * Detect confluence zones where multiple levels cluster
 * Groups levels within tolerance range and scores their confluence
 */
export function detectConfluenceZones(
  allLevels: KeyLevel[],
  currentPrice: number,
  tolerance: number = 0.5, // percentage
  minLevels: number = 2
): ConfluenceZone[] {
  if (allLevels.length === 0) return [];

  const zones: ConfluenceZone[] = [];
  const processed = new Set<number>();

  allLevels.forEach((level, index) => {
    if (processed.has(index)) return;

    const toleranceRange = level.price * (tolerance / 100);
    const nearbyLevels: KeyLevel[] = [level];
    processed.add(index);

    // Find all levels within tolerance
    allLevels.forEach((otherLevel, otherIndex) => {
      if (otherIndex === index || processed.has(otherIndex)) return;
      
      if (Math.abs(otherLevel.price - level.price) <= toleranceRange) {
        nearbyLevels.push(otherLevel);
        processed.add(otherIndex);
      }
    });

    if (nearbyLevels.length >= minLevels) {
      const avgPrice = nearbyLevels.reduce((sum, l) => sum + l.price, 0) / nearbyLevels.length;
      const types = new Set(nearbyLevels.map(l => l.type));
      const totalStrength = nearbyLevels.reduce((sum, l) => sum + (l.strength || 5), 0);
      
      // Confluence score calculation
      let score = 0;
      score += nearbyLevels.length * 15; // +15 per level
      score += types.size * 10; // +10 per unique type
      score += Math.min(40, totalStrength / 2); // strength bonus (max 40)
      
      zones.push({
        price: avgPrice,
        levels: nearbyLevels,
        confluenceScore: Math.min(100, score),
        types,
        strength: totalStrength,
        proximity: ((avgPrice - currentPrice) / currentPrice) * 100
      });
    }
  });

  // Sort by confluence score (highest first)
  zones.sort((a, b) => b.confluenceScore - a.confluenceScore);

  return zones;
}

/**
 * Find nearest key levels (support below, resistance above)
 */
export function findNearestLevels(
  allLevels: KeyLevel[],
  currentPrice: number
): {
  nearestSupport: KeyLevel | null;
  nearestResistance: KeyLevel | null;
  supportDistance: number;
  resistanceDistance: number;
} {
  let nearestSupport: KeyLevel | null = null;
  let nearestResistance: KeyLevel | null = null;
  let supportDistance = Infinity;
  let resistanceDistance = Infinity;

  allLevels.forEach(level => {
    const distance = Math.abs(level.price - currentPrice);
    const percentDistance = (distance / currentPrice) * 100;

    if (level.price < currentPrice && percentDistance < supportDistance) {
      nearestSupport = level;
      supportDistance = percentDistance;
    }

    if (level.price > currentPrice && percentDistance < resistanceDistance) {
      nearestResistance = level;
      resistanceDistance = percentDistance;
    }
  });

  return {
    nearestSupport,
    nearestResistance,
    supportDistance,
    resistanceDistance
  };
}

/**
 * Calculate "trade-ability" score for a symbol
 * Based on confluence + proximity to next key level
 */
export function calculateTradeabilityScore(
  currentPrice: number,
  allLevels: KeyLevel[],
  options: {
    maxDistancePercent?: number; // levels beyond this are ignored
    confluenceWeight?: number; // 0-1 (importance of confluence)
    proximityWeight?: number; // 0-1 (importance of being near a level)
  } = {}
): {
  score: number; // 0-100
  nearestLevel: KeyLevel | null;
  confluence: ConfluenceZone | null;
  reason: string;
} {
  const {
    maxDistancePercent = 5,
    confluenceWeight = 0.6,
    proximityWeight = 0.4
  } = options;

  // Find confluence zones
  const zones = detectConfluenceZones(allLevels, currentPrice, 0.5, 2);
  
  // Find nearest levels
  const { nearestSupport, nearestResistance, supportDistance, resistanceDistance } = 
    findNearestLevels(allLevels, currentPrice);

  const nearestLevel = supportDistance < resistanceDistance ? nearestSupport : nearestResistance;
  const nearestDistance = Math.min(supportDistance, resistanceDistance);

  // Find closest confluence zone within range
  const relevantZone = zones.find(z => Math.abs(z.proximity) <= maxDistancePercent);

  if (!relevantZone && !nearestLevel) {
    return {
      score: 0,
      nearestLevel: null,
      confluence: null,
      reason: 'No significant levels nearby'
    };
  }

  let score = 0;
  let reason = '';

  // Confluence component
  if (relevantZone) {
    const confluenceComponent = relevantZone.confluenceScore * confluenceWeight;
    score += confluenceComponent;
    reason += `${relevantZone.levels.length} levels confluent`;
  }

  // Proximity component
  if (nearestLevel && nearestDistance <= maxDistancePercent) {
    const proximityScore = 100 * (1 - nearestDistance / maxDistancePercent);
    const proximityComponent = proximityScore * proximityWeight;
    score += proximityComponent;
    
    if (reason) reason += ', ';
    reason += `${nearestDistance.toFixed(2)}% from ${nearestLevel.type}`;
  }

  return {
    score: Math.min(100, score),
    nearestLevel,
    confluence: relevantZone || null,
    reason: reason || 'Moderate setup'
  };
}

/**
 * Rank symbols by best trading setup
 * Returns sorted list with scores and reasons
 */
export interface SymbolRanking {
  symbol: string;
  score: number;
  currentPrice: number;
  nextLevel: {
    price: number;
    type: string;
    distancePercent: number;
  } | null;
  confluence: {
    price: number;
    levelCount: number;
    score: number;
  } | null;
  reason: string;
}

export function rankSymbolsBySetup(
  symbols: Array<{
    symbol: string;
    currentPrice: number;
    levels: KeyLevel[];
  }>,
  options?: {
    maxDistancePercent?: number;
    confluenceWeight?: number;
    proximityWeight?: number;
  }
): SymbolRanking[] {
  const rankings: SymbolRanking[] = symbols.map(({ symbol, currentPrice, levels }) => {
    const analysis = calculateTradeabilityScore(currentPrice, levels, options);

    return {
      symbol,
      score: analysis.score,
      currentPrice,
      nextLevel: analysis.nearestLevel ? {
        price: analysis.nearestLevel.price,
        type: analysis.nearestLevel.type,
        distancePercent: Math.abs(
          ((analysis.nearestLevel.price - currentPrice) / currentPrice) * 100
        )
      } : null,
      confluence: analysis.confluence ? {
        price: analysis.confluence.price,
        levelCount: analysis.confluence.levels.length,
        score: analysis.confluence.confluenceScore
      } : null,
      reason: analysis.reason
    };
  });

  // Sort by score (highest first)
  rankings.sort((a, b) => b.score - a.score);

  return rankings;
}

// ============================================================================
// MULTI-TIMEFRAME CONFLUENCE
// ============================================================================

export interface MultiTimeframeLevels {
  timeframe: string;
  levels: KeyLevel[];
  confluenceZones: ConfluenceZone[];
}

/**
 * Analyze levels across multiple timeframes
 * Detects when levels align across timeframes (strongest confluence)
 */
export function analyzeMultiTimeframeConfluence(
  timeframeLevels: Array<{
    timeframe: string;
    data: OHLCVBar[];
  }>,
  currentPrice: number,
  tolerance: number = 1.0 // percentage for cross-timeframe matching
): {
  byTimeframe: MultiTimeframeLevels[];
  crossTimeframeZones: Array<{
    price: number;
    timeframes: string[];
    totalLevels: number;
    confluenceScore: number;
  }>;
} {
  // Calculate levels for each timeframe
  const byTimeframe: MultiTimeframeLevels[] = timeframeLevels.map(({ timeframe, data }) => {
    const levels = getAllKeyLevels(data, {
      swingLength: 20,
      pivotBars: 5,
      includeGann: true,
      includePivots: true,
      includeValueArea: true,
      includeFibonacci: true
    });

    const zones = detectConfluenceZones(levels, currentPrice, 0.5, 2);

    return { timeframe, levels, confluenceZones: zones };
  });

  // Find cross-timeframe confluence
  const crossTimeframeZones: Array<{
    price: number;
    timeframes: string[];
    totalLevels: number;
    confluenceScore: number;
  }> = [];

  // Compare all timeframes pairwise
  byTimeframe.forEach((tf1, i) => {
    tf1.levels.forEach(level1 => {
      const matchingTimeframes = [tf1.timeframe];
      let totalLevels = 1;
      const toleranceRange = level1.price * (tolerance / 100);

      byTimeframe.forEach((tf2, j) => {
        if (i === j) return;

        const hasMatch = tf2.levels.some(level2 => 
          Math.abs(level2.price - level1.price) <= toleranceRange
        );

        if (hasMatch) {
          matchingTimeframes.push(tf2.timeframe);
          totalLevels++;
        }
      });

      if (matchingTimeframes.length >= 2) {
        // Check if we already have this zone
        const exists = crossTimeframeZones.find(z => 
          Math.abs(z.price - level1.price) <= toleranceRange
        );

        if (!exists) {
          crossTimeframeZones.push({
            price: level1.price,
            timeframes: matchingTimeframes,
            totalLevels,
            confluenceScore: matchingTimeframes.length * 25 // 25 points per timeframe
          });
        }
      }
    });
  });

  // Sort cross-timeframe zones by score
  crossTimeframeZones.sort((a, b) => b.confluenceScore - a.confluenceScore);

  return { byTimeframe, crossTimeframeZones };
}

// ============================================================================
// EXPORT ENHANCED TYPES
// ============================================================================

export interface EnhancedComprehensiveLevels extends ComprehensiveLevels {
  confluenceZones: ConfluenceZone[];
  nearestSupport: KeyLevel | null;
  nearestResistance: KeyLevel | null;
  tradeabilityScore: number;
  tradeabilityReason: string;
}

/**
 * Enhanced comprehensive analysis with confluence detection
 */
export function calculateEnhancedLevels(
  data: OHLCVBar[],
  currentPrice: number,
  options?: Parameters<typeof calculateComprehensiveLevels>[1]
): EnhancedComprehensiveLevels {
  // Get base levels
  const baseLevels = calculateComprehensiveLevels(data, options);

  // Flatten all levels into single array
  const allLevels: KeyLevel[] = [
    ...baseLevels.gannOctaves,
    ...baseLevels.fibonacci,
    ...baseLevels.supportResistance.map(sr => ({
      price: sr.price,
      type: sr.type,
      label: sr.type === 'support' ? 'Support' : 'Resistance',
      strength: sr.strength / 10 // normalize to 1-10 scale
    }))
  ];

  // Add pivot levels
  baseLevels.pivots.pivotHighs.forEach(p => {
    allLevels.push({ price: p.price, type: 'pivot', label: 'Pivot High', strength: 8 });
  });
  baseLevels.pivots.pivotLows.forEach(p => {
    allLevels.push({ price: p.price, type: 'pivot', label: 'Pivot Low', strength: 8 });
  });

  // Add value area if exists
  if (baseLevels.valueArea) {
    allLevels.push(
      { price: baseLevels.valueArea.valueAreaHigh, type: 'value_area', label: 'VAH', strength: 9 },
      { price: baseLevels.valueArea.valueAreaLow, type: 'value_area', label: 'VAL', strength: 9 },
      { price: baseLevels.valueArea.pointOfControl, type: 'poc', label: 'POC', strength: 10 }
    );
  }

  // Detect confluence
  const confluenceZones = detectConfluenceZones(allLevels, currentPrice, 0.5, 2);

  // Find nearest levels
  const { nearestSupport, nearestResistance } = findNearestLevels(allLevels, currentPrice);

  // Calculate tradeability
  const { score, reason } = calculateTradeabilityScore(currentPrice, allLevels);

  return {
    ...baseLevels,
    confluenceZones,
    nearestSupport,
    nearestResistance,
    tradeabilityScore: score,
    tradeabilityReason: reason
  };
}