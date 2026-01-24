"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Bell, BellOff, Mail, Smartphone } from "lucide-react"
import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"

interface AlertPreferences {
  enabled: boolean
  emailAlerts: boolean
  pushAlerts: boolean
  minScore: number
  notifyOnHighProbability: boolean
  notifyOnModerate: boolean
}

export function AlertPreferences() {
  const [preferences, setPreferences] = useState<AlertPreferences>({
    enabled: false,
    emailAlerts: false,
    pushAlerts: false,
    minScore: 80,
    notifyOnHighProbability: true,
    notifyOnModerate: false,
  })

  const [saved, setSaved] = useState(false)

  // Load preferences from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("4castr-alert-preferences")
    if (stored) {
      try {
        setPreferences(JSON.parse(stored))
      } catch (err) {
        console.error("Failed to load alert preferences:", err)
      }
    }
  }, [])

  // Save preferences to localStorage
  const updatePreference = <K extends keyof AlertPreferences>(
    key: K,
    value: AlertPreferences[K]
  ) => {
    const updated = { ...preferences, [key]: value }
    setPreferences(updated)
    localStorage.setItem("4castr-alert-preferences", JSON.stringify(updated))

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Card className="bg-background/40 backdrop-blur-xl border-border/40 shadow-lg hover:border-primary/50 transition-colors">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {preferences.enabled ? (
              <Bell className="h-5 w-5 text-primary" />
            ) : (
              <BellOff className="h-5 w-5 text-muted-foreground" />
            )}
            <CardTitle>Trading Window Alerts</CardTitle>
          </div>
          {saved && (
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
              Saved ✓
            </Badge>
          )}
        </div>
        <CardDescription>
          Get notified when high-probability trading windows open
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Master Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-background/20 border border-border/40">
          <div className="space-y-0.5">
            <Label htmlFor="alerts-enabled" className="text-base font-medium cursor-pointer">
              Enable Alerts
            </Label>
            <p className="text-sm text-muted-foreground">
              Master switch for all alert notifications
            </p>
          </div>
          <Switch
            id="alerts-enabled"
            checked={preferences.enabled}
            onCheckedChange={(checked) => updatePreference("enabled", checked)}
          />
        </div>

        {/* Alert Type Selection */}
        {preferences.enabled && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between p-4 rounded-lg bg-background/20 border border-border/40 hover:bg-background/30 transition-colors">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div className="space-y-0.5">
                  <Label htmlFor="email-alerts" className="text-sm font-medium cursor-pointer">
                    Email Notifications
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Coming soon - requires email configuration
                  </p>
                </div>
              </div>
              <Switch
                id="email-alerts"
                checked={preferences.emailAlerts}
                onCheckedChange={(checked) => updatePreference("emailAlerts", checked)}
                disabled
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-background/20 border border-border/40 hover:bg-background/30 transition-colors">
              <div className="flex items-center gap-3">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <div className="space-y-0.5">
                  <Label htmlFor="push-alerts" className="text-sm font-medium cursor-pointer">
                    Push Notifications
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Browser notifications when windows open
                  </p>
                </div>
              </div>
              <Switch
                id="push-alerts"
                checked={preferences.pushAlerts}
                onCheckedChange={(checked) => updatePreference("pushAlerts", checked)}
              />
            </div>

            {/* Window Type Filters */}
            <div className="space-y-3 p-4 rounded-lg bg-background/20 border border-border/40">
              <p className="text-sm font-medium">Notify me for:</p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🌞</span>
                  <Label htmlFor="notify-high" className="text-sm cursor-pointer">
                    High Probability Windows
                  </Label>
                </div>
                <Switch
                  id="notify-high"
                  checked={preferences.notifyOnHighProbability}
                  onCheckedChange={(checked) => updatePreference("notifyOnHighProbability", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⛅</span>
                  <Label htmlFor="notify-moderate" className="text-sm cursor-pointer">
                    Moderate Windows
                  </Label>
                </div>
                <Switch
                  id="notify-moderate"
                  checked={preferences.notifyOnModerate}
                  onCheckedChange={(checked) => updatePreference("notifyOnModerate", checked)}
                />
              </div>
            </div>

            {/* Browser Notification Permission */}
            {preferences.pushAlerts && (
              <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/30 text-sm">
                <p className="text-blue-400 font-medium mb-2">📱 Browser Permission Required</p>
                <p className="text-muted-foreground text-xs">
                  Click "Allow" when your browser asks for notification permission. This enables real-time
                  alerts when high-probability trading windows are detected.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Info Card */}
        <div className="p-4 rounded-lg bg-muted/20 border border-border/40">
          <p className="text-xs text-muted-foreground">
            <strong>How it works:</strong> Alerts trigger when new trading windows are detected with
            scores above {preferences.minScore}. You'll receive notifications for{" "}
            {preferences.notifyOnHighProbability && preferences.notifyOnModerate
              ? "high-probability and moderate"
              : preferences.notifyOnHighProbability
              ? "high-probability"
              : preferences.notifyOnModerate
              ? "moderate"
              : "no"}{" "}
            windows across all monitored symbols.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
