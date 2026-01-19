// src/lib/csvAdapter.js
import fs from "fs"
import path from "path"
import Papa from "papaparse"

const CSV_BASE = path.join(process.cwd(), "csv-pull", "market-data", "data")

// ========================================
// EXISTING FUNCTIONS (unchanged)
// ========================================

export async function readEquityCSV(symbol, startDate, endDate) {
  const csvPath = path.join(CSV_BASE, "equities", "equities_solstice_equinox.csv")
  return readAndFilterCSV(csvPath, "Symbol", symbol, startDate, endDate)
}

export async function readCryptoCSV(symbol, startDate, endDate) {
  const csvPath = path.join(CSV_BASE, "crypto", "crypto_solstice_equinox.csv")
  return readAndFilterCSV(csvPath, "Symbol", symbol, startDate, endDate)
}

export async function readForexCSV(pair, startDate, endDate) {
  const csvPath = path.join(CSV_BASE, "forex", "forex_solstice_equinox.csv")
  return readAndFilterCSV(csvPath, "Pair", pair, startDate, endDate)
}

export async function readCommodityCSV(commodity, startDate, endDate) {
  const csvPath = path.join(CSV_BASE, "commodities", "commodities_solstice_equinox.csv")
  return readAndFilterCSV(csvPath, "Commodity", commodity, startDate, endDate)
}

export async function readStressCSV(indicator, startDate, endDate) {
  const csvPath = path.join(CSV_BASE, "stress", "stress_solstice_equinox.csv")
  return readAndFilterCSV(csvPath, "Indicator", indicator, startDate, endDate)
}

export async function readRatesMacroCSV(symbol, startDate, endDate) {
  const csvPath = path.join(CSV_BASE, "rates-macro", "rates_macro_solstice_equinox.csv")
  return readAndFilterCSV(csvPath, "Symbol", symbol, startDate, endDate)
}

async function readAndFilterCSV(csvPath, symbolKey, symbolValue, startDate, endDate) {
  if (!fs.existsSync(csvPath)) {
    console.warn(`⚠ CSV not found: ${csvPath}`)
    return null
  }

  const fileContent = fs.readFileSync(csvPath, "utf8")
  const parsed = Papa.parse(fileContent, { header: true, dynamicTyping: true })

  const filtered = parsed.data
    .filter((row) => row[symbolKey] === symbolValue)
    .filter((row) => {
      const rowDate = row.Date
      return rowDate >= startDate && rowDate <= endDate
    })
    .map((row) => ({
      symbol: row[symbolKey],
      date: row.Date,
      open: row.Open || null,
      high: row.High || null,
      low: row.Low || null,
      close: row.Close || row.Price || row.Rate || row.Value,
      volume: row.Volume || null,
    }))

  return filtered.length > 0 ? filtered : null
}

// ========================================
// NEW FUNCTIONS (for Fibonacci & Astro)
// ========================================

/**
 * Read Fibonacci levels from CSV
 * Supports both fibonacci_levels.csv and fibonacci_levels.json
 */
export async function readFibonacciCSV(symbol, startDate, endDate) {
  try {
    const fibDir = path.join(CSV_BASE, "fibonacci")

    // Try CSV first
    const csvPath = path.join(fibDir, "fibonacci_levels.csv")
    if (fs.existsSync(csvPath)) {
      const csvContent = fs.readFileSync(csvPath, "utf-8")
      const parsed = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
      })

      const filtered = parsed.data.filter((row) => {
        const matchesSymbol = row.symbol === symbol || row.Symbol === symbol
        const rowDate = row.date || row.Date
        const matchesDate = (!startDate || rowDate >= startDate) && (!endDate || rowDate <= endDate)
        return matchesSymbol && matchesDate
      })

      if (filtered.length > 0) {
        console.log(`✓ Fibonacci CSV hit for ${symbol}: ${filtered.length} records`)
        return filtered
      }
    }

    // Fallback to JSON
    const jsonPath = path.join(fibDir, "fibonacci_levels.json")
    if (fs.existsSync(jsonPath)) {
      const jsonContent = fs.readFileSync(jsonPath, "utf-8")
      const jsonData = JSON.parse(jsonContent)

      // Handle both array and object formats
      const dataArray = Array.isArray(jsonData) ? jsonData : Object.values(jsonData)

      const filtered = dataArray.filter((item) => {
        const matchesSymbol = item.symbol === symbol || item.Symbol === symbol
        const rowDate = item.date || item.Date
        const matchesDate = (!startDate || rowDate >= startDate) && (!endDate || rowDate <= endDate)
        return matchesSymbol && matchesDate
      })

      if (filtered.length > 0) {
        console.log(`✓ Fibonacci JSON hit for ${symbol}: ${filtered.length} records`)
        return filtered
      }
    }

    console.log(`⚠ No Fibonacci CSV/JSON data for ${symbol}`)
    return null
  } catch (error) {
    console.warn(`⚠ Error reading Fibonacci data for ${symbol}:`, error.message)
    return null
  }
}

/**
 * Read astro alignment data from CSV files
 * Reads all astro event types from csv-pull/market-data/data/astro/
 */
export async function readAstroAlignmentCSV(startDate, endDate, eventType = null) {
  try {
    const astroDir = path.join(CSV_BASE, "astro")

    // Map of event types to CSV files with their specific field mappings
    const files = {
      seasonal: {
        filename: "seasonal_anchors.csv",
        eventField: "type", // vernal_equinox, summer_solstice, etc.
        dateField: "date",
      },
      aspects: {
        filename: "aspects.csv",
        eventField: "aspect_type", // trine, conjunction, opposition, etc.
        dateField: "date",
      },
      ingresses: {
        filename: "ingresses.csv",
        eventField: "sign", // Planet entering sign
        dateField: "date",
      },
      retrogrades: {
        filename: "retrogrades.csv",
        eventField: "status", // starts, ends
        dateField: "date",
      },
      lunar_phases: {
        filename: "lunar_phases.csv",
        eventField: "phase", // full, new, waxing_gibbous, etc.
        dateField: "date",
      },
      lunar_cycle: {
        filename: "lunar_cycle_18yr.csv",
        eventField: "key_phase", // Fibonacci cycle phases
        dateField: "date",
      },
    }

    const results = []

    for (const [type, config] of Object.entries(files)) {
      // Skip if specific type requested and doesn't match
      if (eventType && type !== eventType) continue

      const filePath = path.join(astroDir, config.filename)

      if (!fs.existsSync(filePath)) {
        console.log(`⚠ Skipping ${config.filename} (not found)`)
        continue
      }

      try {
        const content = fs.readFileSync(filePath, "utf-8")
        const parsed = Papa.parse(content, {
          header: true,
          skipEmptyLines: true,
        })

        const filtered = parsed.data
          .filter((row) => {
            const rowDate = row[config.dateField]
            if (!rowDate) return false

            return (!startDate || rowDate >= startDate) && (!endDate || rowDate <= endDate)
          })
          .map((row) => ({
            ...row,
            event_type: type,
            date: row[config.dateField],
            event: row[config.eventField] || type,
            // Add type-specific enrichment
            ...(type === "seasonal" && {
              event: row.type, // vernal_equinox, etc.
              sign: row.sign,
              fibonacci_anchor: row.fibonacci_anchor === "True",
              anchor_type: row.anchor_type, // high or low
            }),
            ...(type === "aspects" && {
              event: `${row.body1} ${row.aspect_type} ${row.body2}`,
              body1: row.body1,
              body2: row.body2,
              aspect_nature: row.aspect_nature,
              orb: parseFloat(row.orb),
              exact: row.exact === "True",
            }),
            ...(type === "retrogrades" && {
              event: `${row.body} ${row.status} retrograde`,
              body: row.body,
              sign: row.sign,
              stationary: row.stationary === "True",
            }),
            ...(type === "ingresses" && {
              event: `${row.body} enters ${row.sign}`,
              body: row.body,
              sign: row.sign,
              from_sign: row.from_sign,
            }),
          }))

        if (filtered.length > 0) {
          console.log(`✓ Found ${filtered.length} ${type} events`)
          results.push(...filtered)
        }
      } catch (fileError) {
        console.warn(`⚠ Error reading ${config.filename}:`, fileError.message)
      }
    }

    return results.length > 0 ? results : null
  } catch (error) {
    console.warn("⚠ Error reading astro alignment data:", error.message)
    return null
  }
}

/**
 * Read price touch data (if you have pre-calculated touches in CSV)
 * This is optional - the API will calculate touches on-the-fly if this returns null
 */
export async function readPriceTouchCSV(symbol, startDate, endDate) {
  try {
    // Adjust path if you decide to store pre-calculated touches
    const touchPath = path.join(CSV_BASE, "price-touches", `${symbol.toLowerCase()}_touches.csv`)

    if (!fs.existsSync(touchPath)) {
      return null // No pre-calculated data, API will calculate
    }

    const content = fs.readFileSync(touchPath, "utf-8")
    const parsed = Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    })

    const filtered = parsed.data.filter((row) => {
      return (!startDate || row.date >= startDate) && (!endDate || row.date <= endDate)
    })

    if (filtered.length > 0) {
      console.log(`✓ Price touch CSV hit for ${symbol}: ${filtered.length} touches`)
      return filtered
    }

    return null
  } catch (error) {
    console.log(`⚠ No price touch CSV for ${symbol} (will calculate):`, error.message)
    return null
  }
}
