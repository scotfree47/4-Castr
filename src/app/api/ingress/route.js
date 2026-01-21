export const dynamic = "force-dynamic"
export const revalidate = 0

// app/api/ingress/route.js - CORRECTED VERSION
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

    // ✅ Fetch the last 2 solar ingress events
    const { data, error } = await supabaseAdmin
      .from("astro_events")
      .select("*")
      .eq("event_type", "solar_ingress")
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

      // ✅ FALLBACK: Return synthetic data so components don't break
      const now = new Date()
      const nextMonth = new Date(now)
      nextMonth.setMonth(now.getMonth() + 1)
      const prevMonth = new Date(now)
      prevMonth.setMonth(now.getMonth() - 1)

      return NextResponse.json({
        success: true,
        data: {
          start: now.toISOString().split("T")[0],
          end: nextMonth.toISOString().split("T")[0],
          previousEnd: prevMonth.toISOString().split("T")[0],
          sign: "Capricorn",
          month: "January",
          daysRemaining: 30,
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
