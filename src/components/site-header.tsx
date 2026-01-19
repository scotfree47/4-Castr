"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { CommandSearch, SearchTrigger } from "@/components/command-search"
import { ModeToggle } from "@/components/mode-toggle"
import { MoreHorizontal } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function SiteHeader() {
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [menuExpanded, setMenuExpanded] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuExpanded(false)
      }
    }

    const handleScroll = () => {
      setMenuExpanded(false)
    }

    const handleResize = () => {
      setMenuExpanded(false)
    }

    // Add media query listener for sm breakpoint (640px)
    const mediaQuery = window.matchMedia('(min-width: 640px)')
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setMenuExpanded(false)
    }
    
    if (menuExpanded) {
      document.addEventListener("mousedown", handleClickOutside)
      document.addEventListener("scroll", handleScroll, true)
      window.addEventListener("resize", handleResize)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("scroll", handleScroll, true)
      window.removeEventListener("resize", handleResize)
    }
  }, [menuExpanded])

  return (
    <>
      <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
        <div className="flex w-full items-center gap-1 px-4 py-3 lg:gap-2 lg:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mx-2 data-[orientation=vertical]:h-4"
          />
          <div className="flex-1 max-w-sm">
            <SearchTrigger onClick={() => setSearchOpen(true)} />
          </div>
          
          <div className="ml-auto">
            {/* Desktop expandable menu (sm and up) */}
            <div className="hidden sm:flex items-center gap-2" ref={menuRef}>
              <div className="flex items-center gap-2 overflow-visible pr-3">
                <div
                  className={`flex items-center gap-2 transition-all duration-300 ease-in-out ${
                    menuExpanded
                      ? "opacity-100 translate-x-0 max-w-[500px]"
                      : "opacity-0 translate-x-4 max-w-0 pointer-events-none"
                  }`}
                >
                  <Button variant="ghost" asChild size="sm" className="whitespace-nowrap">
                    <a
                      href="/1watchlist"
                      className="dark:text-foreground"
                    >
                      Home
                    </a>
                  </Button>
                  <Button variant="ghost" asChild size="sm" className="whitespace-nowrap">
                    <a
                      href="/h1-tickers"
                      rel="noopener noreferrer"
                      className="dark:text-foreground"
                    >
                      Tickers
                    </a>
                  </Button>
                  <Button variant="ghost" asChild size="sm" className="whitespace-nowrap">
                    <a
                      href="https://substack.com/@scotfree47"
                      rel="noopener noreferrer"
                      target="_blank"
                      className="dark:text-foreground"
                    >
                      Substack
                    </a>
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMenuExpanded(!menuExpanded)}
                  className={`h-7 w-7 hover:shadow-[0_0_10px_rgba(255,255,255,0.3)] dark:hover:shadow-[0_0_3px_rgba(55,255,55,1)] transition-all ${
                    menuExpanded ? "opacity-0 pointer-events-none" : "opacity-100"
                  }`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Mobile dropdown menu (below sm) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild className="sm:hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  className="hover:shadow-[0_0_10px_rgba(55,255,55,1)] dark:hover:shadow-[0_0_10px_rgba(55,255,55,1)] transition-shadow"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-12">
                <DropdownMenuItem asChild className="justify-end pr-5">
                  <a
                    href="/1watchlist"
                    className="cursor-pointer"
                  >
                    Home
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="justify-end pr-5">
                  <a
                    href="/h1-tickers"
                    className="cursor-pointer"
                  >
                    Tickers
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="justify-end pr-5">
                  <a
                    href="https://substack.com/@scotfree47"
                    rel="noopener noreferrer"
                    target="_blank"
                    className="cursor-pointer"
                  >
                    Substack
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  )
}
