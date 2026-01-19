// src/app/api/cron-refresh-featured/route.ts
import {
  calculateAllFeaturedTickers,
  shouldRefreshFeatured,
  storeFeaturedTickers,
} from "@/lib/services/confluenceEngine"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")

    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { shouldRefresh, reason } = await shouldRefreshFeatured()

    if (!shouldRefresh) {
      return NextResponse.json({
        success: true,
        message: `No refresh needed: ${reason}`,
        refreshed: false,
      })
    }

    const featured = await calculateAllFeaturedTickers()
    const allFeatured = Object.values(featured).flat()
    await storeFeaturedTickers(allFeatured)

    return NextResponse.json({
      success: true,
      message: `Refreshed: ${reason}`,
      refreshed: true,
    })
  } catch (error: any) {
    console.error("Cron error:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
