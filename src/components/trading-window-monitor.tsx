"use client"

import { useEffect, useRef } from "react"
import { notifyTradingWindow, NotificationService } from "@/lib/services/notifications"

/**
 * Background monitor for trading windows
 * Checks periodically for new high-probability windows and sends notifications
 */
export function TradingWindowMonitor() {
  const lastCheckRef = useRef<Set<string>>(new Set())
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Load alert preferences
    const getPreferences = () => {
      const stored = localStorage.getItem("4castr-alert-preferences")
      if (!stored) return null
      try {
        return JSON.parse(stored)
      } catch {
        return null
      }
    }

    const checkForNewWindows = async () => {
      const prefs = getPreferences()

      // Skip if alerts disabled
      if (!prefs || !prefs.enabled || !prefs.pushAlerts) {
        return
      }

      // Request notification permission if needed
      const service = NotificationService.getInstance()
      if (service.getPermission() === "default") {
        await service.requestPermission()
      }

      if (service.getPermission() !== "granted") {
        return
      }

      try {
        // Fetch latest trading windows
        const response = await fetch(
          "/api/trading-windows-bulk?sentinels=true&topN=20&daysAhead=90",
          { cache: "no-store" }
        )

        if (!response.ok) return

        const result = await response.json()
        if (!result.success || !result.data.windows) return

        const windows = result.data.windows

        // Filter based on user preferences
        const relevantWindows = windows.filter((w: any) => {
          // Check window type preferences
          if (w.type === "high_probability" && !prefs.notifyOnHighProbability) return false
          if (w.type === "moderate" && !prefs.notifyOnModerate) return false
          if (w.type === "avoid" || w.type === "extreme_volatility") return false

          // Check if we've already notified about this window
          const windowKey = `${w.symbol}-${w.startDate}-${w.type}`
          if (lastCheckRef.current.has(windowKey)) return false

          return true
        })

        // Send notifications for new windows
        for (const window of relevantWindows) {
          const windowKey = `${window.symbol}-${window.startDate}-${window.type}`
          lastCheckRef.current.add(windowKey)

          await notifyTradingWindow(window.symbol, window.type, window.combinedScore)

          // Small delay between notifications to avoid spam
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }

        // Cleanup old entries (keep last 100)
        if (lastCheckRef.current.size > 100) {
          const entries = Array.from(lastCheckRef.current)
          lastCheckRef.current = new Set(entries.slice(-100))
        }
      } catch (err) {
        console.error("Trading window monitor error:", err)
      }
    }

    // Check immediately on mount
    checkForNewWindows()

    // Then check every 30 minutes
    intervalRef.current = setInterval(checkForNewWindows, 30 * 60 * 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  // This component doesn't render anything
  return null
}
