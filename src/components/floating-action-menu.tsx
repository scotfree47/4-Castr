"use client"

import * as React from "react"
import { PanelLeft, Search, PanelsTopLeft } from "lucide-react"
import { useSidebar } from "@/components/ui/sidebar"
import { CommandSearch } from "@/components/command-search"

export function FloatingActionMenu() {
  const [isScrolled, setIsScrolled] = React.useState(false)
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)
  
  // Safely get sidebar context, fallback if not available
  let toggleSidebar = () => {}
  try {
    const sidebar = useSidebar()
    toggleSidebar = sidebar.toggleSidebar
  } catch (e) {
    // No sidebar provider, that's okay
  }

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100)
      if (isExpanded) {
        setIsExpanded(false)
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsExpanded(false)
      }
    }

    window.addEventListener('scroll', handleScroll)
    document.addEventListener('mousedown', handleClickOutside)
    
    return () => {
      window.removeEventListener('scroll', handleScroll)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isExpanded])

  const handleMainButtonClick = () => {
    if (isExpanded) {
      // When expanded, main button opens search
      setSearchOpen(true)
      setIsExpanded(false)
    } else {
      // When collapsed, main button expands the menu
      setIsExpanded(true)
    }
  }

  const handleSidebarClick = () => {
    toggleSidebar()
    setIsExpanded(false)
  }

  return (
    <>
      <div
        ref={menuRef}
        className={`
          fixed bottom-6 right-6 z-50
          md:hidden
          flex items-center gap-3 
          transition-all duration-500
          ${isScrolled ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}
        `}
      >
        {/* Sidebar Button - only shows when expanded */}
        <button
          onClick={handleSidebarClick}
          className={`
            h-11 w-11 rounded-full
            border-2 border-white text-white bg-white/20
            shadow-lg hover:shadow-xl hover:bg-[#33ff33]/40
            transition-all duration-500
            ${isExpanded ? 'translate-x-0 opacity-100 scale-100' : 'translate-x-15 opacity-0 scale-1 pointer-events-none'}
          `}
        >
          <PanelLeft className="h-5 w-5 mx-auto" />
        </button>

        {/* Main Toggle/Search Button - always visible, changes icon and function */}
        <button
          onClick={handleMainButtonClick}
          className={`
            h-11 w-11 rounded-full
            border-2 border-white text-white bg-white/20
            shadow-lg hover:shadow-xl hover:bg-[#33ff33]/40
            transition-all duration-500
          `}
        >
          {isExpanded ? (
            <Search className="h-5 w-5 mx-auto" />
          ) : (
            <PanelsTopLeft className="h-5 w-5 mx-auto" />
          )}
        </button>
      </div>

      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  )
}
