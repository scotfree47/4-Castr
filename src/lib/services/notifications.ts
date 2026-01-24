// Browser notification service for trading window alerts

export interface NotificationOptions {
  title: string
  body: string
  icon?: string
  tag?: string
  data?: any
}

export class NotificationService {
  private static instance: NotificationService
  private permission: NotificationPermission = "default"

  private constructor() {
    if (typeof window !== "undefined" && "Notification" in window) {
      this.permission = Notification.permission
    }
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (typeof window === "undefined" || !("Notification" in window)) {
      console.warn("Notifications not supported in this browser")
      return "denied"
    }

    if (this.permission === "granted") {
      return "granted"
    }

    try {
      const permission = await Notification.requestPermission()
      this.permission = permission
      return permission
    } catch (err) {
      console.error("Failed to request notification permission:", err)
      return "denied"
    }
  }

  async showNotification(options: NotificationOptions): Promise<void> {
    if (this.permission !== "granted") {
      console.warn("Notification permission not granted")
      return
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || "/icon-192x192.png",
        tag: options.tag,
        data: options.data,
        badge: "/icon-72x72.png",
        requireInteraction: false,
        silent: false,
      })

      notification.onclick = () => {
        window.focus()
        notification.close()

        // Navigate to watchlist if data contains a symbol
        if (options.data?.symbol) {
          window.location.href = "/1watchlist"
        }
      }

      // Auto-close after 10 seconds
      setTimeout(() => notification.close(), 10000)
    } catch (err) {
      console.error("Failed to show notification:", err)
    }
  }

  getPermission(): NotificationPermission {
    return this.permission
  }

  isSupported(): boolean {
    return typeof window !== "undefined" && "Notification" in window
  }
}

// Trading window notification helper
export async function notifyTradingWindow(
  symbol: string,
  windowType: "high_probability" | "moderate",
  score: number
) {
  const service = NotificationService.getInstance()

  if (service.getPermission() !== "granted") {
    return
  }

  const emoji = windowType === "high_probability" ? "🌞" : "⛅"
  const typeLabel = windowType === "high_probability" ? "High Probability" : "Moderate"

  await service.showNotification({
    title: `${emoji} ${symbol} Trading Window Opened`,
    body: `${typeLabel} opportunity detected with score ${score}. Check the dashboard for details.`,
    tag: `trading-window-${symbol}`,
    data: { symbol, windowType, score },
  })
}

// Hook for React components
export function useNotifications() {
  const service = NotificationService.getInstance()

  const requestPermission = async () => {
    return await service.requestPermission()
  }

  const showNotification = async (options: NotificationOptions) => {
    await service.showNotification(options)
  }

  return {
    requestPermission,
    showNotification,
    permission: service.getPermission(),
    isSupported: service.isSupported(),
  }
}
