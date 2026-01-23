"use client"

import { Button } from "@/components/ui/button"
import { useEffect } from "react"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error to console (could extend to send to error tracking service)
    console.error("Dashboard error:", error)
  }, [error])

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-8">
      <div className="text-center max-w-md">
        <h1 className="mb-4 text-3xl font-bold">Something went wrong</h1>
        <h2 className="mb-3 text-xl font-semibold text-muted-foreground">
          Dashboard Error
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred while loading the dashboard."}
        </p>
        <div className="flex items-center justify-center gap-4">
          <Button onClick={reset}>Try Again</Button>
          <Button variant="outline" asChild>
            <a href="/1watchlist">Go to Dashboard Home</a>
          </Button>
        </div>
      </div>
    </div>
  )
}
