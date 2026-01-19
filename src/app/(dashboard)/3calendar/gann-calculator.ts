/**
 * Gann Calendar Calculator
 * Dynamically generates Gann moments for any given date
 * No need to pre-generate millions of events!
 */

export interface GannMoment {
  id: string
  title: string
  date: Date
  time: string
  duration: string
  type: 'meeting' | 'event' | 'personal' | 'task' | 'reminder'
  attendees: string[]
  location: string
  color: string
  description: string
  timeframe: 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly'
  angle: string
  category: string
}

// Color mapping
const COLORS = {
  anchor: 'bg-green-500',
  major_pivot: 'bg-green-500',
  balance: 'bg-green-500',
  reversal: 'bg-green-500',
  golden_ratio: 'bg-amber-600',
  fib_major: 'bg-amber-600',
  angle_2x1_after_fib: 'bg-amber-600',
  market_hours: 'bg-sky-400',
  angle_all: 'bg-gray-300',
  fib_minor: 'bg-gray-300',
  default: 'bg-gray-400',
}

const EVENT_TYPES = {
  anchor: 'reminder',
  major_pivot: 'event',
  balance: 'event',
  golden_ratio: 'event',
  fib_major: 'event',
  reversal: 'event',
  market_hours: 'event',
  default: 'task',
} as const

// Daily Gann Moments (same every day)
const DAILY_MOMENTS = [
  { time: '00:00', angle: '0°', desc: 'Anchor / Reset', category: 'anchor' },
  { time: '00:30', angle: '7.5°', desc: '1x8 angle', category: 'angle_all' },
  { time: '01:00', angle: '15°', desc: '1x4 angle', category: 'angle_all' },
  { time: '01:15', angle: '18.75°', desc: '1x3 angle', category: 'angle_all' },
  { time: '01:24', angle: '21.24°', desc: 'Fib 23.6% from 0°', category: 'fib_minor' },
  { time: '01:45', angle: '26.25°', desc: '1x2 angle', category: 'angle_all' },
  { time: '02:17', angle: '34.38°', desc: 'Fib 38.2% from 0º', category: 'fib_minor' },
  { time: '03:00', angle: '45°', desc: 'BALANCE POINT (1/8 of Day)', category: 'balance' },
  { time: '03:42', angle: '55.62°', desc: 'Fib 61.8% from 0º (Golden Ratio)', category: 'golden_ratio' },
  { time: '04:07', angle: '61.8º', desc: 'Fib 0.618 (Actual)', category: 'golden_ratio' },
  { time: '04:15', angle: '63.75°', desc: '2x1 angle (After 61.8º Actual)', category: 'angle_2x1_after_fib' },
  { time: '04:42', angle: '70.74º', desc: 'Fib 78.6% from 90°', category: 'fib_minor' },
  { time: '04:45', angle: '71.25°', desc: '3x1 angle', category: 'angle_all' },
  { time: '05:00', angle: '75°', desc: '4x1 angle', category: 'angle_all' },
  { time: '05:14', angle: '78.6°', desc: 'Fib 78.6 (Actual)', category: 'fib_minor' },
  { time: '05:30', angle: '82.5°', desc: '8x1 angle', category: 'angle_all' },
  { time: '06:00', angle: '90°', desc: 'MAJOR PIVOT POINT', category: 'major_pivot' },
  { time: '06:30', angle: '97.5°', desc: '8x1 angle (mirrored)', category: 'angle_all' },
  { time: '07:00', angle: '105°', desc: '4x1 angle (mirrored)', category: 'angle_all' },
  { time: '07:15', angle: '108.75°', desc: '3x1 angle (mirrored)', category: 'angle_all' },
  { time: '07:48', angle: '117.2°', desc: 'Fib 1.272 (Actual)', category: 'fib_major' },
  { time: '08:17', angle: '124.38°', desc: 'Fib 38.2% from 90° mark', category: 'fib_minor' },
  { time: '09:00', angle: '135°', desc: 'BALANCE POINT (3/8 of Day)', category: 'balance' },
  { time: '09:30', angle: '(0º)', desc: 'MARKET OPEN', category: 'market_hours' },
  { time: '10:07', angle: '151.8º', desc: 'Fib 1.618 (Actual)', category: 'fib_major' },
  { time: '10:15', angle: '153.75°', desc: '1x2 angle (mirrored)', category: 'angle_all' },
  { time: '10:43', angle: '160.74°', desc: 'Fib 78.6% from 90°', category: 'fib_minor' },
  { time: '10:45', angle: '161.25°', desc: '1x3 angle (mirrored)', category: 'angle_all' },
  { time: '11:00', angle: '165°', desc: '1x4 angle (mirrored)', category: 'angle_all' },
  { time: '11:30', angle: '172.5°', desc: '1x8 angle (mirrored)', category: 'angle_all' },
  { time: '12:00', angle: '180°', desc: 'REVERSALS (50% of Day)', category: 'reversal' },
  { time: '12:30', angle: '187.5°', desc: '1x8 angle', category: 'angle_all' },
  { time: '13:00', angle: '195°', desc: '1x4 angle', category: 'angle_all' },
  { time: '13:15', angle: '198.75°', desc: '1x3 angle', category: 'angle_all' },
  { time: '13:24', angle: '201.24°', desc: 'Fib 23.6% from 180°', category: 'fib_minor' },
  { time: '13:45', angle: '206.25°', desc: '1x2 angle', category: 'angle_all' },
  { time: '14:17', angle: '214.38°', desc: 'Fib 38.2% from 180°', category: 'fib_minor' },
  { time: '15:00', angle: '225°', desc: 'BALANCE POINT (5/8 of Day)', category: 'balance' },
  { time: '15:42', angle: '235.62°', desc: 'Fib 61.8% from 180°', category: 'golden_ratio' },
  { time: '16:00', angle: '(360º)', desc: 'MARKET CLOSE', category: 'market_hours' },
  { time: '16:15', angle: '243.75°', desc: '2x1 angle (After 61.8º Actual)', category: 'angle_2x1_after_fib' },
  { time: '16:42', angle: '250.74°', desc: 'Fib 78.6% from 180°', category: 'fib_minor' },
  { time: '16:45', angle: '251.25°', desc: '3x1 angle', category: 'angle_all' },
  { time: '17:00', angle: '255°', desc: '4x1 angle', category: 'angle_all' },
  { time: '17:14', angle: '258.6º', desc: 'Fib 78.6 (Actual)', category: 'fib_minor' },
  { time: '17:30', angle: '262.5°', desc: '8x1 angle', category: 'angle_all' },
  { time: '18:00', angle: '270°', desc: 'MAJOR PIVOT (75% of Day)', category: 'major_pivot' },
  { time: '19:30', angle: '277.5°', desc: '8x1 angle (mirrored)', category: 'angle_all' },
  { time: '20:00', angle: '285°', desc: '4x1 angle (mirrored)', category: 'angle_all' },
  { time: '20:15', angle: '288.75°', desc: '3x1 angle (mirrored)', category: 'angle_all' },
  { time: '19:48', angle: '297.2°', desc: 'Fib 1.272 (Actual)', category: 'fib_major' },
  { time: '20:45', angle: '304.38°', desc: 'Fib 38.2% from 270°', category: 'fib_minor' },
  { time: '21:00', angle: '315°', desc: 'BALANCE POINT (7/8 of Day)', category: 'balance' },
  { time: '21:42', angle: '325.62°', desc: 'Fib 61.8% from 270°', category: 'golden_ratio' },
  { time: '22:07', angle: '331.8°', desc: 'Fib 1.618 (Actual)', category: 'fib_major' },
  { time: '22:15', angle: '333.75°', desc: '1x2 angle (mirrored)', category: 'angle_all' },
  { time: '22:43', angle: '340.74°', desc: 'Fib 78.6% from 270°', category: 'fib_minor' },
  { time: '22:45', angle: '341.25°', desc: '1x3 angle (mirrored)', category: 'angle_all' },
  { time: '23:16', angle: '345°', desc: '1x4 angle (mirrored)', category: 'angle_all' },
  { time: '23:30', angle: '352.5°', desc: '1x8 angle (mirrored)', category: 'angle_all' },
]

// Weekly Gann Moments (repeats every week starting Monday)
const WEEKLY_MOMENTS = [
  { day: 'Mon', time: '00:00', angle: '0°', desc: 'Anchor / Reset', category: 'anchor' },
  { day: 'Mon', time: '21:00', angle: '45°', desc: 'BALANCE POINT (1/8 of Week)', category: 'balance' },
  { day: 'Tue', time: '18:00', angle: '90°', desc: 'MAJOR PIVOT POINT', category: 'major_pivot' },
  { day: 'Wed', time: '15:00', angle: '135°', desc: 'BALANCE POINT (3/8 of Week)', category: 'balance' },
  { day: 'Thu', time: '12:00', angle: '180°', desc: 'REVERSALS (50% of Week)', category: 'reversal' },
  { day: 'Fri', time: '09:00', angle: '225°', desc: 'BALANCE POINT (5/8 of Week)', category: 'balance' },
  { day: 'Sat', time: '06:00', angle: '270°', desc: 'MAJOR PIVOT (75% of Week)', category: 'major_pivot' },
  { day: 'Sun', time: '03:00', angle: '315°', desc: 'BALANCE POINT (7/8 of Week)', category: 'balance' },
]

// Monthly patterns by month length
const MONTHLY_PATTERNS: Record<28 | 29 | 30 | 31, Array<{ day: number; time: string; angle: string; desc: string; category: string }>> = {
  28: [
    { day: 1, time: '00:00', angle: '0°', desc: 'Anchor / Reset', category: 'anchor' },
    { day: 4, time: '12:00', angle: '45°', desc: 'BALANCE POINT (1/8 of Month)', category: 'balance' },
    { day: 8, time: '00:00', angle: '90°', desc: 'MAJOR PIVOT POINT', category: 'major_pivot' },
    { day: 11, time: '12:00', angle: '135°', desc: 'BALANCE POINT (3/8 of Month)', category: 'balance' },
    { day: 15, time: '00:00', angle: '180°', desc: 'REVERSALS (50% of Month)', category: 'reversal' },
    { day: 18, time: '12:00', angle: '225°', desc: 'BALANCE POINT (5/8 of Month)', category: 'balance' },
    { day: 22, time: '00:00', angle: '270°', desc: 'MAJOR PIVOT (75% of Month)', category: 'major_pivot' },
    { day: 25, time: '12:00', angle: '315°', desc: 'BALANCE POINT (7/8 of Month)', category: 'balance' },
  ],
  29: [
    { day: 1, time: '00:00', angle: '0°', desc: 'Anchor / Reset', category: 'anchor' },
    { day: 4, time: '15:00', angle: '45°', desc: 'BALANCE POINT (1/8 of Month)', category: 'balance' },
    { day: 8, time: '06:00', angle: '90°', desc: 'MAJOR PIVOT POINT', category: 'major_pivot' },
    { day: 11, time: '21:00', angle: '135°', desc: 'BALANCE POINT (3/8 of Month)', category: 'balance' },
    { day: 15, time: '12:00', angle: '180°', desc: 'REVERSALS (50% of Month)', category: 'reversal' },
    { day: 19, time: '03:00', angle: '225°', desc: 'BALANCE POINT (5/8 of Month)', category: 'balance' },
    { day: 22, time: '18:00', angle: '270°', desc: 'MAJOR PIVOT (75% of Month)', category: 'major_pivot' },
    { day: 26, time: '09:00', angle: '315°', desc: 'BALANCE POINT (7/8 of Month)', category: 'balance' },
  ],
  30: [
    { day: 1, time: '00:00', angle: '0°', desc: 'Anchor / Reset', category: 'anchor' },
    { day: 4, time: '18:00', angle: '45°', desc: 'BALANCE POINT (1/8 of Month)', category: 'balance' },
    { day: 8, time: '12:00', angle: '90°', desc: 'MAJOR PIVOT POINT', category: 'major_pivot' },
    { day: 12, time: '06:00', angle: '135°', desc: 'BALANCE POINT (3/8 of Month)', category: 'balance' },
    { day: 16, time: '00:00', angle: '180°', desc: 'REVERSALS (50% of Month)', category: 'reversal' },
    { day: 19, time: '18:00', angle: '225°', desc: 'BALANCE POINT (5/8 of Month)', category: 'balance' },
    { day: 23, time: '12:00', angle: '270°', desc: 'MAJOR PIVOT (75% of Month)', category: 'major_pivot' },
    { day: 27, time: '06:00', angle: '315°', desc: 'BALANCE POINT (7/8 of Month)', category: 'balance' },
  ],
  31: [
    { day: 1, time: '00:00', angle: '0°', desc: 'Anchor / Reset', category: 'anchor' },
    { day: 4, time: '21:00', angle: '45°', desc: 'BALANCE POINT (1/8 of Month)', category: 'balance' },
    { day: 8, time: '18:00', angle: '90°', desc: 'MAJOR PIVOT POINT', category: 'major_pivot' },
    { day: 12, time: '15:00', angle: '135°', desc: 'BALANCE POINT (3/8 of Month)', category: 'balance' },
    { day: 16, time: '12:00', angle: '180°', desc: 'REVERSALS (50% of Month)', category: 'reversal' },
    { day: 20, time: '09:00', angle: '225°', desc: 'BALANCE POINT (5/8 of Month)', category: 'balance' },
    { day: 24, time: '06:00', angle: '270°', desc: 'MAJOR PIVOT (75% of Month)', category: 'major_pivot' },
    { day: 28, time: '03:00', angle: '315°', desc: 'BALANCE POINT (7/8 of Month)', category: 'balance' },
  ],
}

// Quarterly moments
const QUARTERLY_MOMENTS: Record<'Q1' | 'Q2' | 'Q3' | 'Q4', Array<{ month: number; day: number; time: string; angle: string; desc: string; category: string }>> = {
  Q1: [
    { month: 3, day: 21, time: '00:00', angle: '0°', desc: 'Anchor / Reset', category: 'anchor' },
    { month: 4, day: 1, time: '09:45', angle: '45°', desc: 'BALANCE POINT (1/8 of Quarter)', category: 'balance' },
    { month: 4, day: 12, time: '19:30', angle: '90°', desc: 'MAJOR PIVOT POINT', category: 'major_pivot' },
    { month: 5, day: 5, time: '15:00', angle: '180°', desc: 'REVERSALS (50% of Quarter)', category: 'reversal' },
    { month: 5, day: 28, time: '10:30', angle: '270°', desc: 'MAJOR PIVOT (75% of Quarter)', category: 'major_pivot' },
  ],
  Q2: [
    { month: 6, day: 21, time: '00:00', angle: '0°', desc: 'Anchor / Reset', category: 'anchor' },
    { month: 7, day: 2, time: '09:45', angle: '45°', desc: 'BALANCE POINT (1/8 of Quarter)', category: 'balance' },
    { month: 7, day: 13, time: '19:30', angle: '90°', desc: 'MAJOR PIVOT POINT', category: 'major_pivot' },
    { month: 8, day: 5, time: '15:00', angle: '180°', desc: 'REVERSALS (50% of Quarter)', category: 'reversal' },
    { month: 8, day: 28, time: '10:30', angle: '270°', desc: 'MAJOR PIVOT (75% of Quarter)', category: 'major_pivot' },
  ],
  Q3: [
    { month: 9, day: 23, time: '00:00', angle: '0°', desc: 'Anchor / Reset', category: 'anchor' },
    { month: 10, day: 4, time: '09:45', angle: '45°', desc: 'BALANCE POINT (1/8 of Quarter)', category: 'balance' },
    { month: 10, day: 15, time: '19:30', angle: '90°', desc: 'MAJOR PIVOT POINT', category: 'major_pivot' },
    { month: 11, day: 7, time: '15:00', angle: '180°', desc: 'REVERSALS (50% of Quarter)', category: 'reversal' },
    { month: 11, day: 30, time: '10:30', angle: '270°', desc: 'MAJOR PIVOT (75% of Quarter)', category: 'major_pivot' },
  ],
  Q4: [
    { month: 12, day: 21, time: '00:00', angle: '0°', desc: 'Anchor / Reset', category: 'anchor' },
    { month: 1, day: 1, time: '09:45', angle: '45°', desc: 'BALANCE POINT (1/8 of Quarter)', category: 'balance' },
    { month: 1, day: 12, time: '19:30', angle: '90°', desc: 'MAJOR PIVOT POINT', category: 'major_pivot' },
    { month: 2, day: 4, time: '15:00', angle: '180°', desc: 'REVERSALS (50% of Quarter)', category: 'reversal' },
    { month: 2, day: 27, time: '10:30', angle: '270°', desc: 'MAJOR PIVOT (75% of Quarter)', category: 'major_pivot' },
  ],
}

// Yearly moments
const YEARLY_MOMENTS: Record<365 | 366, Array<{ month: number; day: number; time: string; angle: string; desc: string; category: string }>> = {
  365: [
    { month: 3, day: 21, time: '00:00', angle: '0°', desc: 'Anchor / Reset', category: 'anchor' },
    { month: 5, day: 5, time: '15:00', angle: '45°', desc: 'BALANCE POINT (1/8 of Year)', category: 'balance' },
    { month: 6, day: 20, time: '06:00', angle: '90°', desc: 'MAJOR PIVOT POINT', category: 'major_pivot' },
    { month: 9, day: 19, time: '12:00', angle: '180°', desc: 'REVERSALS (50% of Year)', category: 'reversal' },
    { month: 12, day: 19, time: '18:00', angle: '270°', desc: 'MAJOR PIVOT (75% of Year)', category: 'major_pivot' },
  ],
  366: [
    { month: 3, day: 21, time: '00:00', angle: '0°', desc: 'Anchor / Reset', category: 'anchor' },
    { month: 5, day: 5, time: '18:00', angle: '45°', desc: 'BALANCE POINT (1/8 of Year)', category: 'balance' },
    { month: 6, day: 20, time: '12:00', angle: '90°', desc: 'MAJOR PIVOT POINT', category: 'major_pivot' },
    { month: 9, day: 20, time: '00:00', angle: '180°', desc: 'REVERSALS (50% of Year)', category: 'reversal' },
    { month: 12, day: 20, time: '12:00', angle: '270°', desc: 'MAJOR PIVOT (75% of Year)', category: 'major_pivot' },
  ],
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function createMoment(
  date: Date,
  time: string,
  angle: string,
  desc: string,
  category: string,
  timeframe: GannMoment['timeframe']
): GannMoment {
  const [hours, minutes] = time.split(':').map(Number)
  const momentDate = new Date(date)
  momentDate.setHours(hours, minutes, 0, 0)

  const color = COLORS[category as keyof typeof COLORS] || COLORS.default
  const type = EVENT_TYPES[category as keyof typeof EVENT_TYPES] || EVENT_TYPES.default

  return {
    id: `${timeframe}-${date.toISOString()}-${time}-${angle}`,
    title: `${angle} ${desc}`,
    date: momentDate,
    time: momentDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    duration: 'moment',
    type,
    attendees: [],
    location: 'Market',
    color,
    description: `${timeframe} - ${angle} - ${desc}`,
    timeframe,
    angle,
    category,
  }
}

export function getDailyMoments(date: Date): GannMoment[] {
  return DAILY_MOMENTS.map(moment =>
    createMoment(date, moment.time, moment.angle, moment.desc, moment.category, 'Daily')
  )
}

export function getWeeklyMoments(date: Date): GannMoment[] {
  const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]
  
  return WEEKLY_MOMENTS
    .filter(moment => moment.day === dayOfWeek)
    .map(moment =>
      createMoment(date, moment.time, moment.angle, moment.desc, moment.category, 'Weekly')
    )
}

export function getMonthlyMoments(date: Date): GannMoment[] {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  
  let monthLength: 28 | 29 | 30 | 31
  
  if (month === 2) {
    monthLength = isLeapYear(year) ? 29 : 28
  } else if ([4, 6, 9, 11].includes(month)) {
    monthLength = 30
  } else {
    monthLength = 31
  }
  
  const patterns = MONTHLY_PATTERNS[monthLength] || []
  
  return patterns
    .filter(pattern => pattern.day === day)
    .map(pattern =>
      createMoment(date, pattern.time, pattern.angle, pattern.desc, pattern.category, 'Monthly')
    )
}

export function getQuarterlyMoments(date: Date): GannMoment[] {
  const month = date.getMonth() + 1
  const day = date.getDate()
  
  let quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'
  if (month >= 3 && month <= 5) {
    quarter = 'Q1'
  } else if (month >= 6 && month <= 8) {
    quarter = 'Q2'
  } else if (month >= 9 && month <= 11) {
    quarter = 'Q3'
  } else {
    quarter = 'Q4'
  }
  
  const patterns = QUARTERLY_MOMENTS[quarter] || []
  
  return patterns
    .filter(pattern => pattern.month === month && pattern.day === day)
    .map(pattern =>
      createMoment(date, pattern.time, pattern.angle, pattern.desc, pattern.category, 'Quarterly')
    )
}

export function getYearlyMoments(date: Date): GannMoment[] {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  
  const yearLength = isLeapYear(year) ? 366 : 365
  const patterns = YEARLY_MOMENTS[yearLength] || []
  
  return patterns
    .filter(pattern => pattern.month === month && pattern.day === day)
    .map(pattern =>
      createMoment(date, pattern.time, pattern.angle, pattern.desc, pattern.category, 'Yearly')
    )
}

export function getGannMomentsForDate(date: Date): GannMoment[] {
  const moments: GannMoment[] = []

  moments.push(...getDailyMoments(date))
  moments.push(...getWeeklyMoments(date))
  moments.push(...getMonthlyMoments(date))
  moments.push(...getQuarterlyMoments(date))
  moments.push(...getYearlyMoments(date))

  return moments
}

export function getGannMomentsForRange(startDate: Date, endDate: Date): GannMoment[] {
  const moments: GannMoment[] = []
  const currentDate = new Date(startDate)

  while (currentDate <= endDate) {
    moments.push(...getGannMomentsForDate(currentDate))
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return moments
}