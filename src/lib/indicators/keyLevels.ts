/**
 * Trading Key Levels Calculator
 * 
 * Combines mathematical principles from multiple indicators:
 * - Gann octave levels (1/8 divisions)
 * - Daily session levels (previous day, current day)
 * - Value Area and Point of Control (volume profile)
 * - Pivot point calculations
 * - Gann Fan angle projections
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface OHLCVBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface KeyLevel {
  price: number;
  type: string;
  label: string;
  strength?: number; // 1-10 scale
}

export interface SessionLevels {
  previousDayHigh: number;
  previousDayLow: number;
  previousDayOpen: number;
  previousDayClose: number;
  currentDayHigh: number;
  currentDayLow: number;
  currentDayOpen: number;
  preMarketHigh?: number;
  preMarketLow?: number;
  extendedHoursHigh?: number;
  extendedHoursLow?: number;
}

export interface ValueAreaLevels {
  valueAreaHigh: number;
  valueAreaLow: number;
  pointOfControl: number;
}

export interface PivotLevels {
  pivotHighs: Array<{ price: number; index: number }>;
  pivotLows: Array<{ price: number; index: number }>;
}

export interface GannFanLevel {
  price: number;
  ratio: string; // e.g., "1x1", "2x1", etc.
  angle: number;
}

// ============================================================================
// GANN OCTAVE LEVELS (Auto Swing-based)
// ============================================================================

/**
 * Calculate Gann octave levels based on swing high/low
 * Divides the range into 8 equal parts (1/8 to 7/8)
 */
export function calculateGannLevels(
  data: OHLCVBar[],
  swingLength: number = 10
): KeyLevel[] {
  if (data.length < swingLength) return [];

  // Calculate swing high and low
  const recentData = data.slice(-swingLength);
  const swingHigh = Math.max(...recentData.map(d => d.high));
  const swingLow = Math.min(...recentData.map(d => d.low));
  const range = swingHigh - swingLow;

  const levels: KeyLevel[] = [
    { price: swingHigh, type: 'swing', label: 'Swing High', strength: 10 },
    { price: swingLow, type: 'swing', label: 'Swing Low', strength: 10 },
  ];

  // Gann octave levels (1/8 through 7/8)
  const octaves = [
    { ratio: 0.125, label: '1/8', strength: 5 },
    { ratio: 0.250, label: '2/8', strength: 6 },
    { ratio: 0.375, label: '3/8', strength: 7 },
    { ratio: 0.500, label: '4/8 (Mid)', strength: 9 },
    { ratio: 0.625, label: '5/8', strength: 7 },
    { ratio: 0.750, label: '6/8', strength: 6 },
    { ratio: 0.875, label: '7/8', strength: 5 },
  ];

  octaves.forEach(({ ratio, label, strength }) => {
    levels.push({
      price: swingLow + range * ratio,
      type: 'gann',
      label: `Gann ${label}`,
      strength,
    });
  });

  return levels;
}

// ============================================================================
// DAILY SESSION LEVELS
// ============================================================================

/**
 * Calculate previous and current day OHLC levels
 * Assumes data is in chronological order with timestamps
 */
export function calculateSessionLevels(
  data: OHLCVBar[],
  currentTime: number
): SessionLevels | null {
  if (data.length < 2) return null;

  const currentDayStart = new Date(currentTime);
  currentDayStart.setHours(0, 0, 0, 0);
  const currentDayMs = currentDayStart.getTime();

  const previousDayStart = new Date(currentDayMs - 86400000);
  const previousDayMs = previousDayStart.getTime();

  // Filter bars for previous day
  const prevDayBars = data.filter(
    d => d.time >= previousDayMs && d.time < currentDayMs
  );

  // Filter bars for current day
  const currentDayBars = data.filter(d => d.time >= currentDayMs);

  if (prevDayBars.length === 0 || currentDayBars.length === 0) return null;

  const previousDayHigh = Math.max(...prevDayBars.map(d => d.high));
  const previousDayLow = Math.min(...prevDayBars.map(d => d.low));
  const previousDayOpen = prevDayBars[0].open;
  const previousDayClose = prevDayBars[prevDayBars.length - 1].close;

  const currentDayHigh = Math.max(...currentDayBars.map(d => d.high));
  const currentDayLow = Math.min(...currentDayBars.map(d => d.low));
  const currentDayOpen = currentDayBars[0].open;

  return {
    previousDayHigh,
    previousDayLow,
    previousDayOpen,
    previousDayClose,
    currentDayHigh,
    currentDayLow,
    currentDayOpen,
  };
}

// ============================================================================
// PIVOT POINT DETECTION
// ============================================================================

/**
 * Detect pivot highs and lows
 * A pivot high has lower highs on both sides
 * A pivot low has higher lows on both sides
 */
export function calculatePivotLevels(
  data: OHLCVBar[],
  leftBars: number = 5,
  rightBars: number = 5
): PivotLevels {
  const pivotHighs: Array<{ price: number; index: number }> = [];
  const pivotLows: Array<{ price: number; index: number }> = [];

  for (let i = leftBars; i < data.length - rightBars; i++) {
    const currentHigh = data[i].high;
    const currentLow = data[i].low;

    // Check for pivot high
    let isPivotHigh = true;
    for (let j = 1; j <= leftBars; j++) {
      if (data[i - j].high >= currentHigh) {
        isPivotHigh = false;
        break;
      }
    }
    if (isPivotHigh) {
      for (let j = 1; j <= rightBars; j++) {
        if (data[i + j].high >= currentHigh) {
          isPivotHigh = false;
          break;
        }
      }
    }
    if (isPivotHigh) {
      pivotHighs.push({ price: currentHigh, index: i });
    }

    // Check for pivot low
    let isPivotLow = true;
    for (let j = 1; j <= leftBars; j++) {
      if (data[i - j].low <= currentLow) {
        isPivotLow = false;
        break;
      }
    }
    if (isPivotLow) {
      for (let j = 1; j <= rightBars; j++) {
        if (data[i + j].low <= currentLow) {
          isPivotLow = false;
          break;
        }
      }
    }
    if (isPivotLow) {
      pivotLows.push({ price: currentLow, index: i });
    }
  }

  return { pivotHighs, pivotLows };
}

// ============================================================================
// VALUE AREA AND POINT OF CONTROL (Volume Profile)
// ============================================================================

/**
 * Calculate Value Area High, Low, and Point of Control
 * Based on volume distribution across price levels
 */
export function calculateValueArea(
  data: OHLCVBar[],
  numPriceLevels: number = 50
): ValueAreaLevels | null {
  if (data.length === 0) return null;

  const priceHigh = Math.max(...data.map(d => d.high));
  const priceLow = Math.min(...data.map(d => d.low));
  const priceStep = (priceHigh - priceLow) / numPriceLevels;

  if (priceStep <= 0) return null;

  // Build volume profile
  const volumeProfile = new Array(numPriceLevels).fill(0);

  data.forEach(bar => {
    const barRange = bar.high - bar.low;
    if (barRange > 0) {
      const lowIndex = Math.max(
        0,
        Math.floor((bar.low - priceLow) / priceStep)
      );
      const highIndex = Math.min(
        numPriceLevels - 1,
        Math.floor((bar.high - priceLow) / priceStep)
      );

      const volumePerLevel = bar.volume / (highIndex - lowIndex + 1);
      for (let i = lowIndex; i <= highIndex; i++) {
        volumeProfile[i] += volumePerLevel;
      }
    }
  });

  // Find POC (highest volume level)
  const maxVolume = Math.max(...volumeProfile);
  const pocIndex = volumeProfile.indexOf(maxVolume);
  const pointOfControl = priceLow + pocIndex * priceStep;

  // Calculate Value Area (70% of total volume)
  const totalVolume = volumeProfile.reduce((a, b) => a + b, 0);
  const targetVolume = totalVolume * 0.7;

  let currentVolume = volumeProfile[pocIndex];
  let vaLowIndex = pocIndex;
  let vaHighIndex = pocIndex;

  // Expand value area from POC
  while (currentVolume < targetVolume && (vaLowIndex > 0 || vaHighIndex < numPriceLevels - 1)) {
    const volumeBelow = vaLowIndex > 0 ? volumeProfile[vaLowIndex - 1] : 0;
    const volumeAbove = vaHighIndex < numPriceLevels - 1 ? volumeProfile[vaHighIndex + 1] : 0;

    if (volumeBelow > volumeAbove && vaLowIndex > 0) {
      vaLowIndex--;
      currentVolume += volumeBelow;
    } else if (vaHighIndex < numPriceLevels - 1) {
      vaHighIndex++;
      currentVolume += volumeAbove;
    } else {
      break;
    }
  }

  const valueAreaHigh = priceLow + vaHighIndex * priceStep;
  const valueAreaLow = priceLow + vaLowIndex * priceStep;

  return { valueAreaHigh, valueAreaLow, pointOfControl };
}

// ============================================================================
// GANN FAN LEVELS (Angle-based projections)
// ============================================================================

/**
 * Calculate Gann Fan levels from an anchor point
 * Uses standard Gann angles: 1x8, 1x4, 1x3, 1x2, 1x1, 2x1, 3x1, 4x1, 8x1
 */
export function calculateGannFanLevels(
  anchorPrice: number,
  anchorIndex: number,
  currentIndex: number,
  pricePerBar: number, // ATR or fixed tick value
  isUptrend: boolean = true
): GannFanLevel[] {
  const barsSinceAnchor = currentIndex - anchorIndex;
  if (barsSinceAnchor <= 0) return [];

  const multipliers = [
    { mult: 1 / 8, label: '1x8' },
    { mult: 1 / 4, label: '1x4' },
    { mult: 1 / 3, label: '1x3' },
    { mult: 1 / 2, label: '1x2' },
    { mult: 1, label: '1x1' },
    { mult: 2, label: '2x1' },
    { mult: 3, label: '3x1' },
    { mult: 4, label: '4x1' },
    { mult: 8, label: '8x1' },
  ];

  const levels: GannFanLevel[] = [];
  const sign = isUptrend ? 1 : -1;

  multipliers.forEach(({ mult, label }) => {
    const priceChange = pricePerBar * barsSinceAnchor * mult;
    const price = anchorPrice + sign * priceChange;
    const angle = Math.atan(mult) * (180 / Math.PI);

    levels.push({ price, ratio: label, angle });
  });

  return levels;
}

// ============================================================================
// FIBONACCI RETRACEMENT LEVELS
// ============================================================================

/**
 * Calculate Fibonacci retracement levels
 * Standard levels: 0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0
 */
export function calculateFibonacciLevels(
  high: number,
  low: number
): KeyLevel[] {
  const range = high - low;

  const fibLevels = [
    { ratio: 0.0, label: '0%', strength: 10 },
    { ratio: 0.236, label: '23.6%', strength: 6 },
    { ratio: 0.382, label: '38.2%', strength: 7 },
    { ratio: 0.5, label: '50%', strength: 8 },
    { ratio: 0.618, label: '61.8%', strength: 9 },
    { ratio: 0.786, label: '78.6%', strength: 7 },
    { ratio: 1.0, label: '100%', strength: 10 },
  ];

  return fibLevels.map(({ ratio, label, strength }) => ({
    price: high - range * ratio,
    type: 'fibonacci',
    label: `Fib ${label}`,
    strength,
  }));
}

// ============================================================================
// ATR CALCULATION (for Gann Fan scaling)
// ============================================================================

/**
 * Calculate Average True Range
 */
export function calculateATR(data: OHLCVBar[], period: number = 14): number {
  if (data.length < period + 1) return 0;

  const trueRanges: number[] = [];

  for (let i = 1; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevClose = data[i - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );

    trueRanges.push(tr);
  }

  const recentTR = trueRanges.slice(-period);
  return recentTR.reduce((a, b) => a + b, 0) / period;
}

// ============================================================================
// COMBINED KEY LEVELS DETECTOR
// ============================================================================

/**
 * Combine all methods to find comprehensive support/resistance levels
 */
export function getAllKeyLevels(
  data: OHLCVBar[],
  options: {
    swingLength?: number;
    pivotBars?: number;
    includeGann?: boolean;
    includePivots?: boolean;
    includeValueArea?: boolean;
    includeFibonacci?: boolean;
  } = {}
): KeyLevel[] {
  const {
    swingLength = 10,
    pivotBars = 5,
    includeGann = true,
    includePivots = true,
    includeValueArea = true,
    includeFibonacci = true,
  } = options;

  let allLevels: KeyLevel[] = [];

  // Gann octave levels
  if (includeGann) {
    const gannLevels = calculateGannLevels(data, swingLength);
    allLevels = allLevels.concat(gannLevels);
  }

  // Pivot levels
  if (includePivots) {
    const pivots = calculatePivotLevels(data, pivotBars, pivotBars);
    pivots.pivotHighs.forEach(p => {
      allLevels.push({
        price: p.price,
        type: 'pivot',
        label: 'Pivot High',
        strength: 8,
      });
    });
    pivots.pivotLows.forEach(p => {
      allLevels.push({
        price: p.price,
        type: 'pivot',
        label: 'Pivot Low',
        strength: 8,
      });
    });
  }

  // Value Area
  if (includeValueArea) {
    const va = calculateValueArea(data);
    if (va) {
      allLevels.push(
        { price: va.valueAreaHigh, type: 'value_area', label: 'VAH', strength: 9 },
        { price: va.valueAreaLow, type: 'value_area', label: 'VAL', strength: 9 },
        { price: va.pointOfControl, type: 'poc', label: 'POC', strength: 10 }
      );
    }
  }

  // Fibonacci (using recent swing high/low)
  if (includeFibonacci && data.length >= swingLength) {
    const recent = data.slice(-swingLength);
    const swingHigh = Math.max(...recent.map(d => d.high));
    const swingLow = Math.min(...recent.map(d => d.low));
    const fibLevels = calculateFibonacciLevels(swingHigh, swingLow);
    allLevels = allLevels.concat(fibLevels);
  }

  return allLevels;
}

// ============================================================================
// FUTURE LEVEL PROJECTIONS
// ============================================================================

export interface FutureLevelProjection {
  price: number;
  timestamp: number;
  type: string;
  label: string;
  confidence: number; // 0-1 scale
  barsAhead: number;
}

/**
 * Project Gann Fan levels into the future
 * Extends angle-based projections forward
 */
export function projectGannFanLevels(
  anchorPrice: number,
  anchorTime: number,
  currentTime: number,
  barInterval: number, // milliseconds per bar
  pricePerBar: number,
  barsToProject: number = 50,
  isUptrend: boolean = true
): FutureLevelProjection[] {
  const projections: FutureLevelProjection[] = [];
  const currentBarIndex = Math.floor((currentTime - anchorTime) / barInterval);

  const multipliers = [
    { mult: 1 / 8, label: '1x8', conf: 0.5 },
    { mult: 1 / 4, label: '1x4', conf: 0.6 },
    { mult: 1 / 3, label: '1x3', conf: 0.65 },
    { mult: 1 / 2, label: '1x2', conf: 0.7 },
    { mult: 1, label: '1x1', conf: 0.9 },
    { mult: 2, label: '2x1', conf: 0.7 },
    { mult: 3, label: '3x1', conf: 0.65 },
    { mult: 4, label: '4x1', conf: 0.6 },
    { mult: 8, label: '8x1', conf: 0.5 },
  ];

  const sign = isUptrend ? 1 : -1;

  for (let i = 1; i <= barsToProject; i++) {
    const futureBarIndex = currentBarIndex + i;
    const futureTime = currentTime + i * barInterval;

    multipliers.forEach(({ mult, label, conf }) => {
      const priceChange = pricePerBar * futureBarIndex * mult;
      const price = anchorPrice + sign * priceChange;

      projections.push({
        price,
        timestamp: futureTime,
        type: 'gann_fan',
        label: `Gann ${label}`,
        confidence: conf * (1 - i / (barsToProject * 2)), // decay over time
        barsAhead: i,
      });
    });
  }

  return projections;
}

/**
 * Project support/resistance levels based on trend extension
 * Uses linear regression of pivot points to forecast future levels
 */
export function projectTrendLevels(
  data: OHLCVBar[],
  barsToProject: number = 50,
  barInterval: number = 3600000 // 1 hour default
): FutureLevelProjection[] {
  if (data.length < 10) return [];

  const projections: FutureLevelProjection[] = [];
  const lastTime = data[data.length - 1].time;

  // Get recent pivots
  const pivots = calculatePivotLevels(data, 5, 5);
  
  // Linear regression on pivot highs
  if (pivots.pivotHighs.length >= 3) {
    const recentHighs = pivots.pivotHighs.slice(-5);
    const { slope, intercept } = linearRegression(
      recentHighs.map(p => p.index),
      recentHighs.map(p => p.price)
    );

    for (let i = 1; i <= barsToProject; i++) {
      const futureIndex = data.length - 1 + i;
      const futurePrice = slope * futureIndex + intercept;
      const futureTime = lastTime + i * barInterval;

      projections.push({
        price: futurePrice,
        timestamp: futureTime,
        type: 'resistance_trend',
        label: 'Projected Resistance',
        confidence: Math.max(0.3, 0.9 - i * 0.01),
        barsAhead: i,
      });
    }
  }

  // Linear regression on pivot lows
  if (pivots.pivotLows.length >= 3) {
    const recentLows = pivots.pivotLows.slice(-5);
    const { slope, intercept } = linearRegression(
      recentLows.map(p => p.index),
      recentLows.map(p => p.price)
    );

    for (let i = 1; i <= barsToProject; i++) {
      const futureIndex = data.length - 1 + i;
      const futurePrice = slope * futureIndex + intercept;
      const futureTime = lastTime + i * barInterval;

      projections.push({
        price: futurePrice,
        timestamp: futureTime,
        type: 'support_trend',
        label: 'Projected Support',
        confidence: Math.max(0.3, 0.9 - i * 0.01),
        barsAhead: i,
      });
    }
  }

  return projections;
}

/**
 * Project Fibonacci extension levels (beyond 100%)
 * Used for profit targets in trending markets
 */
export function projectFibonacciExtensions(
  swingLow: number,
  swingHigh: number,
  retraceLevel: number, // current retracement price
  isUptrend: boolean = true
): KeyLevel[] {
  const range = swingHigh - swingLow;
  const extensions = [
    { ratio: 1.272, label: '127.2%', strength: 7 },
    { ratio: 1.414, label: '141.4%', strength: 6 },
    { ratio: 1.618, label: '161.8%', strength: 9 },
    { ratio: 2.0, label: '200%', strength: 7 },
    { ratio: 2.618, label: '261.8%', strength: 8 },
  ];

  return extensions.map(({ ratio, label, strength }) => {
    const extendedRange = range * ratio;
    const price = isUptrend 
      ? swingLow + extendedRange 
      : swingHigh - extendedRange;

    return {
      price,
      type: 'fibonacci_extension',
      label: `Fib Ext ${label}`,
      strength,
    };
  });
}

/**
 * Project Volume Profile forward using historical distribution
 * Assumes similar volume patterns will continue
 */
export function projectValueAreaLevels(
  data: OHLCVBar[],
  barsToProject: number = 20,
  barInterval: number = 3600000
): FutureLevelProjection[] {
  const projections: FutureLevelProjection[] = [];
  const va = calculateValueArea(data);
  
  if (!va) return [];

  const lastTime = data[data.length - 1].time;
  const lastClose = data[data.length - 1].close;

  // Calculate average daily drift
  const priceChange = lastClose - data[0].close;
  const drift = priceChange / data.length;

  for (let i = 1; i <= barsToProject; i++) {
    const futureTime = lastTime + i * barInterval;
    const driftAdjustment = drift * i;

    projections.push(
      {
        price: va.valueAreaHigh + driftAdjustment,
        timestamp: futureTime,
        type: 'value_area',
        label: 'Projected VAH',
        confidence: Math.max(0.4, 0.8 - i * 0.02),
        barsAhead: i,
      },
      {
        price: va.valueAreaLow + driftAdjustment,
        timestamp: futureTime,
        type: 'value_area',
        label: 'Projected VAL',
        confidence: Math.max(0.4, 0.8 - i * 0.02),
        barsAhead: i,
      },
      {
        price: va.pointOfControl + driftAdjustment,
        timestamp: futureTime,
        type: 'poc',
        label: 'Projected POC',
        confidence: Math.max(0.5, 0.9 - i * 0.015),
        barsAhead: i,
      }
    );
  }

  return projections;
}

/**
 * Project swing-based Gann levels forward
 * Assumes current swing range continues
 */
export function projectGannOctaveLevels(
  data: OHLCVBar[],
  swingLength: number = 10,
  barsToProject: number = 20,
  barInterval: number = 3600000
): FutureLevelProjection[] {
  const projections: FutureLevelProjection[] = [];
  const recentData = data.slice(-swingLength);
  const swingHigh = Math.max(...recentData.map(d => d.high));
  const swingLow = Math.min(...recentData.map(d => d.low));
  const range = swingHigh - swingLow;
  const lastTime = data[data.length - 1].time;

  // Project assuming range expands/contracts slightly
  const avgVolatility = calculateATR(data, 14);
  
  for (let i = 1; i <= barsToProject; i++) {
    const futureTime = lastTime + i * barInterval;
    const rangeAdjustment = avgVolatility * Math.sqrt(i) * 0.1; // slight expansion
    const adjustedRange = range + rangeAdjustment;

    const octaves = [
      { ratio: 0.125, label: '1/8', strength: 5 },
      { ratio: 0.250, label: '2/8', strength: 6 },
      { ratio: 0.375, label: '3/8', strength: 7 },
      { ratio: 0.500, label: '4/8', strength: 9 },
      { ratio: 0.625, label: '5/8', strength: 7 },
      { ratio: 0.750, label: '6/8', strength: 6 },
      { ratio: 0.875, label: '7/8', strength: 5 },
    ];

    octaves.forEach(({ ratio, label, strength }) => {
      const price = swingLow + adjustedRange * ratio;
      projections.push({
        price,
        timestamp: futureTime,
        type: 'gann_octave',
        label: `Gann ${label}`,
        confidence: Math.max(0.3, (strength / 10) * (1 - i * 0.02)),
        barsAhead: i,
      });
    });
  }

  return projections;
}

/**
 * Master function to get all future level projections
 */
export function getAllFutureLevels(
  data: OHLCVBar[],
  options: {
    barsToProject?: number;
    barInterval?: number; // milliseconds
    includeGannFan?: boolean;
    includeTrendLevels?: boolean;
    includeValueArea?: boolean;
    includeGannOctaves?: boolean;
    anchorPrice?: number;
    anchorTime?: number;
    pricePerBar?: number;
  } = {}
): FutureLevelProjection[] {
  const {
    barsToProject = 50,
    barInterval = 3600000,
    includeGannFan = true,
    includeTrendLevels = true,
    includeValueArea = true,
    includeGannOctaves = true,
  } = options;

  let allProjections: FutureLevelProjection[] = [];

  // Trend-based projections
  if (includeTrendLevels) {
    const trendLevels = projectTrendLevels(data, barsToProject, barInterval);
    allProjections = allProjections.concat(trendLevels);
  }

  // Value Area projections
  if (includeValueArea) {
    const vaLevels = projectValueAreaLevels(data, barsToProject, barInterval);
    allProjections = allProjections.concat(vaLevels);
  }

  // Gann Octave projections
  if (includeGannOctaves) {
    const gannLevels = projectGannOctaveLevels(data, 10, barsToProject, barInterval);
    allProjections = allProjections.concat(gannLevels);
  }

  // Gann Fan projections (requires anchor)
  if (includeGannFan && options.anchorPrice && options.anchorTime) {
    const currentTime = data[data.length - 1].time;
    const pricePerBar = options.pricePerBar || calculateATR(data, 14) * 0.25;
    
    const fanLevels = projectGannFanLevels(
      options.anchorPrice,
      options.anchorTime,
      currentTime,
      barInterval,
      pricePerBar,
      barsToProject,
      data[data.length - 1].close > options.anchorPrice
    );
    allProjections = allProjections.concat(fanLevels);
  }

  return allProjections;
}

// ============================================================================
// UTILITY: LINEAR REGRESSION
// ============================================================================

function linearRegression(
  xValues: number[],
  yValues: number[]
): { slope: number; intercept: number } {
  const n = xValues.length;
  if (n === 0) return { slope: 0, intercept: 0 };

  const sumX = xValues.reduce((a, b) => a + b, 0);
  const sumY = yValues.reduce((a, b) => a + b, 0);
  const sumXY = xValues.reduce((acc, x, i) => acc + x * yValues[i], 0);
  const sumX2 = xValues.reduce((acc, x) => acc + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

// ============================================================================
// GANN SQUARE CALCULATIONS (Sacred Geometry)
// ============================================================================

export interface GannSquare {
  topLeft: { bar: number; price: number };
  bottomRight: { bar: number; price: number };
  levels: Array<{ price: number; percentage: number }>;
  ratio: string; // e.g., "1x1", "2x1"
}

/**
 * Calculate Gann Square from swing high to swing low
 * Uses sacred geometry ratios (25%, 38.2%, 50%, 61.8%, 75%)
 */
export function calculateGannSquare(
  swingHigh: number,
  swingLow: number,
  highBar: number,
  lowBar: number
): GannSquare {
  const priceRange = swingHigh - swingLow;
  const timeRange = Math.abs(lowBar - highBar);
  
  // Determine ratio (how many price units per time unit)
  const ratio = priceRange / timeRange;
  
  // Classify the ratio
  let ratioStr = "1x1";
  if (Math.abs(ratio - 4.0) < 0.2) ratioStr = "4x1";
  else if (Math.abs(ratio - 3.0) < 0.2) ratioStr = "3x1";
  else if (Math.abs(ratio - 2.0) < 0.2) ratioStr = "2x1";
  else if (Math.abs(ratio - 1.0) < 0.2) ratioStr = "1x1";
  else if (Math.abs(ratio - 0.5) < 0.2) ratioStr = "1x2";
  else if (Math.abs(ratio - 0.333) < 0.2) ratioStr = "1x3";
  else if (Math.abs(ratio - 0.25) < 0.2) ratioStr = "1x4";
  
  // Sacred geometry percentages
  const percentages = [0, 0.25, 0.382, 0.5, 0.618, 0.75, 1.0];
  
  const levels = percentages.map(pct => ({
    price: swingLow + priceRange * pct,
    percentage: pct * 100,
  }));
  
  return {
    topLeft: { bar: Math.min(highBar, lowBar), price: swingHigh },
    bottomRight: { bar: Math.max(highBar, lowBar), price: swingLow },
    levels,
    ratio: ratioStr,
  };
}

// ============================================================================
// CPR (CENTRAL PIVOT RANGE) CALCULATIONS
// ============================================================================

export interface CPRLevels {
  pivot: number;
  bc: number; // Bottom Central
  tc: number; // Top Central
  upper: number;
  lower: number;
  width: number;
  widthClassification: string;
}

/**
 * Calculate CPR (Central Pivot Range) - daily, weekly, or monthly
 * Used by institutional traders for intraday levels
 */
export function calculateCPR(
  high: number,
  low: number,
  close: number,
  previousCPR?: CPRLevels
): CPRLevels {
  const pivot = (high + low + close) / 3;
  const bc = (high + low) / 2;
  const tc = 2 * pivot - bc;
  
  const upper = Math.max(bc, tc);
  const lower = Math.min(bc, tc);
  const width = upper - lower;
  
  // Calculate average width for classification (if we have history)
  let widthClassification = "NORMAL";
  if (previousCPR) {
    const avgWidth = previousCPR.width;
    if (width < avgWidth * 0.6) widthClassification = "EXTREMELY NARROW";
    else if (width < avgWidth * 0.7) widthClassification = "NARROW";
    else if (width > avgWidth * 1.3) widthClassification = "WIDE";
  }
  
  return { pivot, bc, tc, upper, lower, width, widthClassification };
}

/**
 * Calculate value migration (ascending/descending/overlapping)
 */
export function calculateValueMigration(
  currentPivot: number,
  previousPivot: number
): string {
  if (currentPivot > previousPivot) return "ASCENDING";
  if (currentPivot < previousPivot) return "DESCENDING";
  return "OVERLAPPING";
}

// ============================================================================
// TREND CHANNEL DETECTION
// ============================================================================

export interface TrendChannel {
  upperLine: { x1: number; y1: number; x2: number; y2: number };
  lowerLine: { x1: number; y1: number; x2: number; y2: number };
  direction: 'ascending' | 'descending';
  slope: number;
  broken: boolean;
}

/**
 * Detect trend channels from pivot points
 * Connects swing highs/lows to form parallel channels
 */
export function detectTrendChannels(
  data: OHLCVBar[],
  pivotLength: number = 10,
  maxChannels: number = 2
): TrendChannel[] {
  const channels: TrendChannel[] = [];
  const pivots = calculatePivotLevels(data, pivotLength, pivotLength);
  
  // Ascending channels (from pivot lows)
  if (pivots.pivotLows.length >= 2) {
    for (let i = 0; i < Math.min(pivots.pivotLows.length - 1, maxChannels); i++) {
      const p1 = pivots.pivotLows[i];
      const p2 = pivots.pivotLows[i + 1];
      
      // Only if ascending (p1 is lower than p2)
      if (p2.price < p1.price) {
        const slope = (p1.price - p2.price) / (p1.index - p2.index);
        
        // Find highest high between these two lows for parallel line
        let highestHigh = 0;
        let highestIndex = p2.index;
        
        for (let j = p2.index; j <= p1.index; j++) {
          if (data[j] && data[j].high > highestHigh) {
            highestHigh = data[j].high;
            highestIndex = j;
          }
        }
        
        const offset = highestHigh - p2.price;
        
        channels.push({
          upperLine: {
            x1: p2.index,
            y1: p2.price + offset,
            x2: p1.index,
            y2: p1.price + offset,
          },
          lowerLine: {
            x1: p2.index,
            y1: p2.price,
            x2: p1.index,
            y2: p1.price,
          },
          direction: 'ascending',
          slope,
          broken: data[data.length - 1].close < p1.price,
        });
      }
    }
  }
  
  // Descending channels (from pivot highs)
  if (pivots.pivotHighs.length >= 2) {
    for (let i = 0; i < Math.min(pivots.pivotHighs.length - 1, maxChannels); i++) {
      const p1 = pivots.pivotHighs[i];
      const p2 = pivots.pivotHighs[i + 1];
      
      // Only if descending (p1 is higher than p2)
      if (p2.price > p1.price) {
        const slope = (p1.price - p2.price) / (p1.index - p2.index);
        
        // Find lowest low between these two highs
        let lowestLow = Infinity;
        let lowestIndex = p2.index;
        
        for (let j = p2.index; j <= p1.index; j++) {
          if (data[j] && data[j].low < lowestLow) {
            lowestLow = data[j].low;
            lowestIndex = j;
          }
        }
        
        const offset = p2.price - lowestLow;
        
        channels.push({
          upperLine: {
            x1: p2.index,
            y1: p2.price,
            x2: p1.index,
            y2: p1.price,
          },
          lowerLine: {
            x1: p2.index,
            y1: p2.price - offset,
            x2: p1.index,
            y2: p1.price - offset,
          },
          direction: 'descending',
          slope,
          broken: data[data.length - 1].close > p1.price,
        });
      }
    }
  }
  
  return channels;
}

// ============================================================================
// TIME-BASED KEY LEVELS (Monday, Weekly, Monthly, Quarterly, Yearly)
// ============================================================================

export interface TimeBasedLevels {
  mondayHigh?: number;
  mondayLow?: number;
  mondayMid?: number;
  weeklyHigh?: number;
  weeklyLow?: number;
  weeklyOpen?: number;
  monthlyHigh?: number;
  monthlyLow?: number;
  monthlyOpen?: number;
  quarterlyHigh?: number;
  quarterlyLow?: number;
  quarterlyOpen?: number;
  yearlyHigh?: number;
  yearlyLow?: number;
  yearlyOpen?: number;
}

/**
 * Calculate key levels based on time periods
 * Monday range is crucial for weekly direction
 */
export function calculateTimeBasedLevels(
  data: OHLCVBar[],
  currentTime: number
): TimeBasedLevels {
  const levels: TimeBasedLevels = {};
  
  if (data.length === 0) return levels;
  
  const now = new Date(currentTime);
  
  // Monday levels (current week)
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
  weekStart.setHours(0, 0, 0, 0);
  
  const mondayBars = data.filter(d => {
    const barDate = new Date(d.time);
    return barDate >= weekStart && barDate.getDay() === 1;
  });
  
  if (mondayBars.length > 0) {
    levels.mondayHigh = Math.max(...mondayBars.map(b => b.high));
    levels.mondayLow = Math.min(...mondayBars.map(b => b.low));
    levels.mondayMid = (levels.mondayHigh + levels.mondayLow) / 2;
  }
  
  // Weekly levels
  const weekBars = data.filter(d => d.time >= weekStart.getTime());
  if (weekBars.length > 0) {
    levels.weeklyHigh = Math.max(...weekBars.map(b => b.high));
    levels.weeklyLow = Math.min(...weekBars.map(b => b.low));
    levels.weeklyOpen = weekBars[0].open;
  }
  
  // Monthly levels
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthBars = data.filter(d => d.time >= monthStart.getTime());
  if (monthBars.length > 0) {
    levels.monthlyHigh = Math.max(...monthBars.map(b => b.high));
    levels.monthlyLow = Math.min(...monthBars.map(b => b.low));
    levels.monthlyOpen = monthBars[0].open;
  }
  
  // Quarterly levels
  const quarter = Math.floor(now.getMonth() / 3);
  const quarterStart = new Date(now.getFullYear(), quarter * 3, 1);
  const quarterBars = data.filter(d => d.time >= quarterStart.getTime());
  if (quarterBars.length > 0) {
    levels.quarterlyHigh = Math.max(...quarterBars.map(b => b.high));
    levels.quarterlyLow = Math.min(...quarterBars.map(b => b.low));
    levels.quarterlyOpen = quarterBars[0].open;
  }
  
  // Yearly levels
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearBars = data.filter(d => d.time >= yearStart.getTime());
  if (yearBars.length > 0) {
    levels.yearlyHigh = Math.max(...yearBars.map(b => b.high));
    levels.yearlyLow = Math.min(...yearBars.map(b => b.low));
    levels.yearlyOpen = yearBars[0].open;
  }
  
  return levels;
}

// ============================================================================
// SUPPORT/RESISTANCE WITH STRENGTH SCORING
// ============================================================================

export interface SRLevel {
  price: number;
  type: 'support' | 'resistance';
  strength: number; // 0-100 score
  touches: number;
  volume: number;
  age: number; // bars since last touch
}

/**
 * Advanced S/R detection with strength scoring
 * Considers multiple touches, volume, and age decay
 */
export function calculateSupportResistance(
  data: OHLCVBar[],
  lookback: number = 100,
  tolerance: number = 0.5, // percentage
  maxLevels: number = 10
): SRLevel[] {
  if (data.length < lookback) return [];
  
  const recentData = data.slice(-lookback);
  const levels: SRLevel[] = [];
  
  // Find pivot points
  const pivots = calculatePivotLevels(data, 5, 5);
  
  // Process pivot highs (resistance)
  pivots.pivotHighs.forEach(pivot => {
    const toleranceRange = pivot.price * (tolerance / 100);
    
    // Check if level exists
    const existingLevel = levels.find(
      l => Math.abs(l.price - pivot.price) <= toleranceRange
    );
    
    if (existingLevel) {
      existingLevel.touches++;
      existingLevel.volume += data[pivot.index]?.volume || 0;
      existingLevel.age = data.length - 1 - pivot.index;
    } else {
      levels.push({
        price: pivot.price,
        type: 'resistance',
        strength: 50,
        touches: 1,
        volume: data[pivot.index]?.volume || 0,
        age: data.length - 1 - pivot.index,
      });
    }
  });
  
  // Process pivot lows (support)
  pivots.pivotLows.forEach(pivot => {
    const toleranceRange = pivot.price * (tolerance / 100);
    
    const existingLevel = levels.find(
      l => Math.abs(l.price - pivot.price) <= toleranceRange
    );
    
    if (existingLevel) {
      existingLevel.touches++;
      existingLevel.volume += data[pivot.index]?.volume || 0;
      existingLevel.age = data.length - 1 - pivot.index;
    } else {
      levels.push({
        price: pivot.price,
        type: 'support',
        strength: 50,
        touches: 1,
        volume: data[pivot.index]?.volume || 0,
        age: data.length - 1 - pivot.index,
      });
    }
  });
  
  // Calculate strength scores
  const avgVolume = recentData.reduce((sum, b) => sum + b.volume, 0) / recentData.length;
  
  levels.forEach(level => {
    let score = 50; // base score
    
    // Touch bonus (max +30)
    score += Math.min(30, level.touches * 10);
    
    // Volume bonus (max +20)
    const volRatio = level.volume / (avgVolume * level.touches);
    score += Math.min(20, volRatio * 10);
    
    // Age penalty (max -30)
    const ageFactor = Math.min(1, level.age / lookback);
    score -= ageFactor * 30;
    
    level.strength = Math.max(0, Math.min(100, score));
  });
  
  // Sort by strength and limit
  levels.sort((a, b) => b.strength - a.strength);
  
  return levels.slice(0, maxLevels);
}

// ============================================================================
// GANN SQUARE OF 144 (Master Square)
// ============================================================================

export interface GannSquare144 {
  startBar: number;
  endBar: number;
  upperPrice: number;
  lowerPrice: number;
  middlePrice: number;
  gridLevels: Array<{ bar: number; price: number; value: number }>;
  diagonals: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  keyAngles: Array<{ name: string; x1: number; y1: number; x2: number; y2: number }>;
}

/**
 * Calculate Gann Square of 144 - The Master Square
 * 144 = 12² (most powerful Gann number)
 * Creates a 144x144 grid with sacred diagonal angles
 */
export function calculateGannSquare144(
  data: OHLCVBar[],
  startBar: number,
  candlesPerDivision: number = 1
): GannSquare144 {
  const squares = 144;
  const endBar = startBar + squares * candlesPerDivision;
  
  // Calculate price range
  const barsInRange = data.slice(
    Math.max(0, startBar),
    Math.min(data.length, endBar)
  );
  
  const upperPrice = Math.max(...barsInRange.map(b => b.high));
  const lowerPrice = Math.min(...barsInRange.map(b => b.low));
  const middlePrice = (upperPrice + lowerPrice) / 2;
  const priceRange = upperPrice - lowerPrice;
  
  // Grid levels (every 6 divisions as per Gann's method)
  const gridLevels: Array<{ bar: number; price: number; value: number }> = [];
  
  for (let i = 0; i <= squares; i += 6) {
    const barPos = startBar + i * candlesPerDivision;
    const pricePos = upperPrice - (priceRange / squares) * i;
    gridLevels.push({ bar: barPos, price: pricePos, value: i });
  }
  
  // Key diagonal angles (18°, 36°, 45°, 72°, 108°, 144°)
  const keyAngles = [
    { name: '18°', division: 18 },
    { name: '36°', division: 36 },
    { name: '45°', division: 72 }, // This is the 1x1 angle
    { name: '72°', division: 72 },
    { name: '108°', division: 108 },
    { name: '144°', division: 144 },
  ];
  
  const diagonals: GannSquare144['diagonals'] = [];
  const keyAngleLines: GannSquare144['keyAngles'] = [];
  
  keyAngles.forEach(angle => {
    const endIndex = startBar + angle.division * candlesPerDivision;
    const endPrice = upperPrice - (priceRange / squares) * angle.division;
    
    // Top-left to bottom diagonal
    diagonals.push({
      x1: startBar,
      y1: upperPrice,
      x2: endIndex,
      y2: lowerPrice,
    });
    
    // Top-left to right diagonal
    diagonals.push({
      x1: startBar,
      y1: upperPrice,
      x2: endBar,
      y2: endPrice,
    });
    
    keyAngleLines.push({
      name: `${angle.name} TL-B`,
      x1: startBar,
      y1: upperPrice,
      x2: endIndex,
      y2: lowerPrice,
    });
    
    keyAngleLines.push({
      name: `${angle.name} TL-R`,
      x1: startBar,
      y1: upperPrice,
      x2: endBar,
      y2: endPrice,
    });
  });
  
  return {
    startBar,
    endBar,
    upperPrice,
    lowerPrice,
    middlePrice,
    gridLevels,
    diagonals,
    keyAngles: keyAngleLines,
  };
}

// ============================================================================
// GANN SEASONAL/ASTRONOMICAL DATES
// ============================================================================

export interface SeasonalDate {
  month: number;
  day: number;
  name: string;
  type: 'solstice' | 'equinox' | 'midpoint';
  strength: number; // 1-10
}

/**
 * Gann Seasonal Dates - Major turning points based on astronomy
 * These dates historically correlate with market trend changes
 */
export const GANN_SEASONAL_DATES: SeasonalDate[] = [
  // Solstices & Equinoxes (strongest)
  { month: 12, day: 22, name: 'Winter Solstice', type: 'solstice', strength: 10 },
  { month: 3, day: 21, name: 'Spring Equinox', type: 'equinox', strength: 10 },
  { month: 6, day: 22, name: 'Summer Solstice', type: 'solstice', strength: 10 },
  { month: 9, day: 23, name: 'Fall Equinox', type: 'equinox', strength: 10 },
  
  // Midpoints between solstices/equinoxes (moderate)
  { month: 2, day: 4, name: 'Winter-Spring Midpoint', type: 'midpoint', strength: 7 },
  { month: 5, day: 6, name: 'Spring-Summer Midpoint', type: 'midpoint', strength: 7 },
  { month: 8, day: 8, name: 'Summer-Fall Midpoint', type: 'midpoint', strength: 7 },
  { month: 11, day: 7, name: 'Fall-Winter Midpoint', type: 'midpoint', strength: 7 },
];

/**
 * Check if a given date is a Gann seasonal date
 * Returns the seasonal date info if match, otherwise null
 */
export function isGannSeasonalDate(timestamp: number): SeasonalDate | null {
  const date = new Date(timestamp);
  const month = date.getMonth() + 1; // JavaScript months are 0-indexed
  const day = date.getDate();
  
  return GANN_SEASONAL_DATES.find(
    sd => sd.month === month && sd.day === day
  ) || null;
}

/**
 * Get upcoming Gann seasonal dates
 */
export function getUpcomingSeasonalDates(
  currentTime: number,
  daysAhead: number = 90
): Array<SeasonalDate & { timestamp: number; daysUntil: number }> {
  const now = new Date(currentTime);
  const upcoming: Array<SeasonalDate & { timestamp: number; daysUntil: number }> = [];
  
  GANN_SEASONAL_DATES.forEach(sd => {
    // Check this year
    const thisYear = new Date(now.getFullYear(), sd.month - 1, sd.day);
    const nextYear = new Date(now.getFullYear() + 1, sd.month - 1, sd.day);
    
    const checkDates = [thisYear, nextYear];
    
    checkDates.forEach(dateToCheck => {
      if (dateToCheck.getTime() > currentTime) {
        const daysUntil = Math.floor(
          (dateToCheck.getTime() - currentTime) / (1000 * 60 * 60 * 24)
        );
        
        if (daysUntil <= daysAhead) {
          upcoming.push({
            ...sd,
            timestamp: dateToCheck.getTime(),
            daysUntil,
          });
        }
      }
    });
  });
  
  // Sort by timestamp
  upcoming.sort((a, b) => a.timestamp - b.timestamp);
  
  return upcoming;
}

/**
 * Calculate if current time is within a seasonal window
 * (±3 days from a seasonal date = high probability turning point)
 */
export function isInSeasonalWindow(
  timestamp: number,
  windowDays: number = 3
): { inWindow: boolean; seasonalDate?: SeasonalDate; daysOffset?: number } {
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  
  for (const sd of GANN_SEASONAL_DATES) {
    const date = new Date(timestamp);
    const seasonalDate = new Date(date.getFullYear(), sd.month - 1, sd.day);
    const diff = Math.abs(timestamp - seasonalDate.getTime());
    
    if (diff <= windowMs) {
      const daysOffset = Math.floor(diff / (24 * 60 * 60 * 1000));
      return {
        inWindow: true,
        seasonalDate: sd,
        daysOffset,
      };
    }
  }
  
  return { inWindow: false };
}

// ============================================================================
// COMPREHENSIVE LEVEL DETECTION (ALL METHODS COMBINED)
// ============================================================================

export interface ComprehensiveLevels {
  gannOctaves: KeyLevel[];
  gannSquare?: GannSquare;
  gannSquare144?: GannSquare144;
  gannFan: GannFanLevel[];
  fibonacci: KeyLevel[];
  pivots: PivotLevels;
  valueArea?: ValueAreaLevels;
  supportResistance: SRLevel[];
  cpr?: CPRLevels;
  timeBased: TimeBasedLevels;
  trendChannels: TrendChannel[];
  seasonalDates: Array<SeasonalDate & { timestamp: number; daysUntil: number }>;
}

/**
 * Master function - calculates ALL key levels using every method
 * This is the ultimate all-in-one analysis function
 */
export function calculateComprehensiveLevels(
  data: OHLCVBar[],
  options: {
    currentTime?: number;
    includeGannSquare144?: boolean;
    includeSeasonalDates?: boolean;
    swingLength?: number;
    pivotBars?: number;
    anchorPrice?: number;
    anchorBar?: number;
  } = {}
): ComprehensiveLevels {
  const {
    currentTime = Date.now(),
    includeGannSquare144 = true,
    includeSeasonalDates = true,
    swingLength = 10,
    pivotBars = 5,
    anchorPrice,
    anchorBar,
  } = options;
  
  // Gann octaves
  const gannOctaves = calculateGannLevels(data, swingLength);
  
  // Gann square
  let gannSquare: GannSquare | undefined;
  const recentData = data.slice(-swingLength);
  if (recentData.length > 0) {
    const swingHigh = Math.max(...recentData.map(d => d.high));
    const swingLow = Math.min(...recentData.map(d => d.low));
    const highIdx = data.length - swingLength + recentData.findIndex(d => d.high === swingHigh);
    const lowIdx = data.length - swingLength + recentData.findIndex(d => d.low === swingLow);
    gannSquare = calculateGannSquare(swingHigh, swingLow, highIdx, lowIdx);
  }
  
  // Gann Square of 144 (master square)
  let gannSquare144: GannSquare144 | undefined;
  if (includeGannSquare144 && anchorBar !== undefined) {
    gannSquare144 = calculateGannSquare144(data, anchorBar);
  }
  
  // Gann Fan
  const gannFan: GannFanLevel[] = [];
  if (anchorPrice !== undefined && anchorBar !== undefined) {
    const atr = calculateATR(data, 14);
    const currentBar = data.length - 1;
    const isUptrend = data[data.length - 1].close > anchorPrice;
    gannFan.push(...calculateGannFanLevels(
      anchorPrice,
      anchorBar,
      currentBar,
      atr * 0.25,
      isUptrend
    ));
  }
  
  // Fibonacci
  const fibonacci = recentData.length > 0
    ? calculateFibonacciLevels(
        Math.max(...recentData.map(d => d.high)),
        Math.min(...recentData.map(d => d.low))
      )
    : [];
  
  // Pivots
  const pivots = calculatePivotLevels(data, pivotBars, pivotBars);
  
  // Value Area
  const valueArea = calculateValueArea(data);
  
  // Support/Resistance with strength
  const supportResistance = calculateSupportResistance(data, 100, 0.5, 10);
  
  // CPR (if we have OHLC data)
  let cpr: CPRLevels | undefined;
  if (data.length >= 2) {
    const yesterday = data[data.length - 2];
    cpr = calculateCPR(yesterday.high, yesterday.low, yesterday.close);
  }
  
  // Time-based levels
  const timeBased = calculateTimeBasedLevels(data, currentTime);
  
  // Trend channels
  const trendChannels = detectTrendChannels(data, 10, 2);
  
  // Seasonal dates
  const seasonalDates = includeSeasonalDates
    ? getUpcomingSeasonalDates(currentTime, 90)
    : [];
  
  return {
    gannOctaves,
    gannSquare,
    gannSquare144,
    gannFan,
    fibonacci,
    pivots,
    valueArea: valueArea === null ? undefined : valueArea,
    supportResistance,
    cpr,
    timeBased,
    trendChannels,
    seasonalDates,
  };
}


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

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

/*
const sampleData: OHLCVBar[] = [
  { time: 1704067200000, open: 100, high: 105, low: 98, close: 103, volume: 1000 },
  { time: 1704153600000, open: 103, high: 108, low: 102, close: 106, volume: 1200 },
  // ... more bars
];

// === INDIVIDUAL CALCULATIONS ===

// Gann Square
const gannSquare = calculateGannSquare(108, 98, 10, 50);

// Gann Square of 144 (Master Square)
const gannSquare144 = calculateGannSquare144(sampleData, 100);

// CPR Levels
const dailyCPR = calculateCPR(108, 98, 103);

// Time-based levels
const timeLevels = calculateTimeBasedLevels(sampleData, Date.now());

// Trend channels
const channels = detectTrendChannels(sampleData, 10, 2);

// S/R with strength
const srLevels = calculateSupportResistance(sampleData, 100, 0.5, 10);

// Seasonal dates
const upcoming = getUpcomingSeasonalDates(Date.now(), 90);
const inWindow = isInSeasonalWindow(Date.now());

// === COMPREHENSIVE (ALL-IN-ONE) ===

const allLevels = calculateComprehensiveLevels(sampleData, {
  currentTime: Date.now(),
  includeGannSquare144: true,
  includeSeasonalDates: true,
  swingLength: 10,
  pivotBars: 5,
  anchorPrice: 100,
  anchorBar: 50,
});

console.log('All Key Levels:', allLevels);
console.log('Upcoming Seasonal Turning Points:', allLevels.seasonalDates);
console.log('Current CPR Classification:', allLevels.cpr?.widthClassification);
console.log('Monday Range (key for week):', allLevels.timeBased.mondayHigh, allLevels.timeBased.mondayLow);

// === FUTURE PROJECTIONS ===

const futureLevels = getAllFutureLevels(sampleData, {
  barsToProject: 50,
  barInterval: 3600000,
  includeGannFan: true,
  includeTrendLevels: true,
  includeValueArea: true,
  includeGannOctaves: true,
  anchorPrice: 100,
  anchorTime: 1704067200000,
});

console.log('Future Level Projections:', futureLevels);
*/