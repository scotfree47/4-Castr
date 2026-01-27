export const dynamic = "force-dynamic"
export const revalidate = 0

// app/api/ingress/route.js - FIXED VERSION
import { getSupabaseAdmin } from "@/lib/supabase"
import { NextResponse } from "next/server"

const ZODIAC_TO_MONTH = {
  Aries: "April",
  Taurus: "May",
  Gemini: "June",
  Cancer: "July",
  Leo: "August",
  Virgo: "September",
  Libra: "October",
  Scorpio: "November",
  Sagittarius: "December",
  Capricorn: "January",
  Aquarius: "February",
  Pisces: "March",
}

export async function GET() {
  try {
    const today = new Date().toISOString().split("T")[0]

    // ✅ FIXED: Use 'ingress' not 'solar_ingress'
    const { data, error } = await getSupabaseAdmin()
      .from("astro_events")
      .select("*")
      .eq("event_type", "ingress") // CRITICAL FIX
      .eq("body", "Sun") // CRITICAL FIX
      .lte("date", today)
      .order("date", { ascending: false })
      .limit(2)

    if (error) {
      console.error("Database error fetching ingress:", error)
      return NextResponse.json(
        { success: false, error: `Database error: ${error.message}` },
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      console.error("No ingress data found in database")

      // ✅ FALLBACK: Calculate current zodiac sign based on date
      const now = new Date()
      const month = now.getMonth() + 1 // 1-12
      const day = now.getDate()

      let sign = "Aquarius"
      let startDate = "2026-01-20"
      let endDate = "2026-02-18"
      let monthName = "January"

      // Determine sign based on date ranges (approximate)
      if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) {
        sign = "Capricorn"
        startDate = "2025-12-22"
        endDate = "2026-01-19"
        monthName = "January"
      } else if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) {
        sign = "Aquarius"
        startDate = "2026-01-20"
        endDate = "2026-02-18"
        monthName = "February"
      } else if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) {
        sign = "Pisces"
        startDate = "2026-02-19"
        endDate = "2026-03-20"
        monthName = "March"
      } else if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) {
        sign = "Aries"
        startDate = "2026-03-21"
        endDate = "2026-04-19"
        monthName = "April"
      } else if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) {
        sign = "Taurus"
        startDate = "2026-04-20"
        endDate = "2026-05-20"
        monthName = "May"
      } else if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) {
        sign = "Gemini"
        startDate = "2026-05-21"
        endDate = "2026-06-20"
        monthName = "June"
      } else if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) {
        sign = "Cancer"
        startDate = "2026-06-21"
        endDate = "2026-07-22"
        monthName = "July"
      } else if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) {
        sign = "Leo"
        startDate = "2026-07-23"
        endDate = "2026-08-22"
        monthName = "August"
      } else if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) {
        sign = "Virgo"
        startDate = "2026-08-23"
        endDate = "2026-09-22"
        monthName = "September"
      } else if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) {
        sign = "Libra"
        startDate = "2026-09-23"
        endDate = "2026-10-22"
        monthName = "October"
      } else if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) {
        sign = "Scorpio"
        startDate = "2026-10-23"
        endDate = "2026-11-21"
        monthName = "November"
      } else if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) {
        sign = "Sagittarius"
        startDate = "2026-11-22"
        endDate = "2026-12-21"
        monthName = "December"
      }

      const start = new Date(startDate)
      const end = new Date(endDate)
      const daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)))

      // Calculate previous period end (start - 1 day)
      const prevEnd = new Date(start)
      prevEnd.setDate(prevEnd.getDate() - 1)

      return NextResponse.json({
        success: true,
        data: {
          start: startDate,
          end: endDate,
          previousEnd: prevEnd.toISOString().split("T")[0],
          sign: sign,
          month: monthName,
          daysRemaining: daysRemaining,
          period: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${sign.toLowerCase()}`,
          isFallback: true,
        },
      })
    }

    const currentIngress = data[0]
    const previousIngress = data.length > 1 ? data[1] : null

    // ✅ Get zodiac sign from the sign column
    const zodiacSign = currentIngress.sign || currentIngress.zodiac_sign || "Unknown"
    const month = ZODIAC_TO_MONTH[zodiacSign] || "Unknown"

    // ✅ Calculate dates
    const currentDate = new Date(currentIngress.date)

    // Previous period end is the date of the previous ingress
    const previousEndDate = previousIngress
      ? previousIngress.date
      : new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

    // Next ingress is approximately 30 days after current
    const nextIngressDate = new Date(currentDate)
    nextIngressDate.setDate(currentDate.getDate() + 30)

    // ✅ Days remaining in current period
    const now = new Date()
    const daysRemaining = Math.max(
      0,
      Math.floor((nextIngressDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    )

    // ✅ Calculate ingress period string for cache lookup
    const period = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${zodiacSign.toLowerCase()}`

    // ✅ Return all fields that components expect
    return NextResponse.json({
      success: true,
      data: {
        // New format fields
        start: currentIngress.date,
        end: nextIngressDate.toISOString().split("T")[0],
        previousEnd: previousEndDate,
        sign: zodiacSign,
        month: month,
        daysRemaining: daysRemaining,
        period: period, // CRITICAL: Added for cache queries

        // Legacy format fields (for backward compatibility)
        currentStart: currentIngress.date,
        zodiacSign: zodiacSign,

        // Metadata
        isFallback: false,
      },
    })
  } catch (error) {
    console.error("Ingress API error:", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
