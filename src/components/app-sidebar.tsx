"use client"

import * as React from "react"
import { LayoutDashboard, Mail, CheckSquare, MessageCircle, Calendar, Shield, AlertTriangle, Settings, HelpCircle, CreditCard, Users, House, Bell, Newspaper, ChartSpline, AlignHorizontalDistributeCenter, Gem } from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { SidebarNotification } from "@/components/sidebar-notification"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "Scot Free",
    email: "scotproton@gmail.com",
    avatar: "",
  },
  navGroups: [
    {
      label: "Market",
      items: [
        {
          title: "Watchlist",
          url: "/1watchlist",
          icon: Gem,
        },
        {
          title: "Tickers",
          url: "/h1-tickers",
          icon: AlignHorizontalDistributeCenter,
        },
        {
          title: "Charts",
          url: "/2charts",
          icon: ChartSpline,
        },
      ],
    },
    {
      label: "Events",
      items: [
        {
          title: "Calendar",
          url: "/3calendar",
          icon: Calendar,
        },
        {
          title: "Alerts",
          url: "/4alerts",
          icon: Bell,
        },
        {
          title: "News",
          url: "/5news",
          icon: Newspaper,
        },
      ],
    },
    {
      label: "Admin",
      items: [
        {
          title: "Landing",
          url: "/landing",
          target: "_blank",
          icon: LayoutDashboard,
        },
        {
          title: "Mail",
          url: "/6mail",
          icon: Mail,
        },
        {
          title: "Users",
          url: "/7users",
          icon: Users,
        },
        {
          title: "Auth Pages",
          url: "#",
          icon: Shield,
          items: [
            {
              title: "Sign In 1",
              url: "/sign-in",
            },
            {
              title: "Sign In 2",
              url: "/sign-in-2",
            },
            {
              title: "Sign In 3",
              url: "/sign-in-3",
            },
            {
              title: "Sign Up 1",
              url: "/sign-up",
            },
            {
              title: "Sign Up 2",
              url: "/sign-up-2",
            },
            {
              title: "Sign Up 3",
              url: "/sign-up-3",
            },
            {
              title: "Forgot Password 1",
              url: "/forgot-password",
            },
            {
              title: "Forgot Password 2",
              url: "/forgot-password-2",
            },
            {
              title: "Forgot Password 3",
              url: "/forgot-password-3",
            }
          ],
        },
        {
          title: "Errors",
          url: "#",
          icon: AlertTriangle,
          items: [
            {
              title: "Unauthorized",
              url: "/errors/unauthorized",
            },
            {
              title: "Forbidden",
              url: "/errors/forbidden",
            },
            {
              title: "Not Found",
              url: "/errors/not-found",
            },
            {
              title: "Internal Server Error",
              url: "/errors/internal-server-error",
            },
            {
              title: "Under Maintenance",
              url: "/errors/under-maintenance",
            },
          ],
        },
        {
          title: "Settings",
          url: "#",
          icon: Settings,
          items: [
            {
              title: "User Settings",
              url: "/settings/user",
            },
            {
              title: "Account Settings",
              url: "/settings/account",
            },
            {
              title: "Plans & Billing",
              url: "/settings/billing",
            },
            {
              title: "Appearance",
              url: "/settings/appearance",
            },
            {
              title: "Notifications",
              url: "/settings/notifications",
            },
            {
              title: "Connections",
              url: "/settings/connections",
            },
          ],
        },
        {
          title: "FAQs",
          url: "/8faqs",
          icon: HelpCircle,
        },
        {
          title: "Pricing",
          url: "/9pricing",
          icon: CreditCard,
        },
      ],
    },
  ],
}

export function AppSidebar({...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/1watchlist">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Logo size={24} className="text-current" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-large">4Castr</span>
                  {/*
                  <span className="truncate text-xs">"Stars Impel, Not Compel"</span>
                  */}
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {data.navGroups.map((group) => (
          <NavMain key={group.label} label={group.label} items={group.items} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        {/*}
        <SidebarNotification />
        */}
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
