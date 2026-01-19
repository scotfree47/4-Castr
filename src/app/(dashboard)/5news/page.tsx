'use client'

import { useState, useEffect } from 'react'
import { Mail } from "./components/mail"
import { accounts, mails } from "./data"

export default function MailPage() {
  const [navSize, setNavSize] = useState(8)
  
  useEffect(() => {
    const handleResize = () => {
      setNavSize(window.innerWidth >= 1024 ? 3 : 6)
    }
    
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="w-full max-w-full overflow-hidden">
      <div className="flex flex-1 flex-col gap-6 px-6">
        {/* Enhanced Header */}
        <div className="flex md:flex-row flex-col md:items-center justify-between gap-4 md:gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold tracking-tight">News</h1>
            <p className="text-muted-foreground">Monitor ticker updates</p>
          </div>
        </div>
        
        {/* Mail Component */}
        <div className="h-[calc(100vh-16rem)] w-full">
          <Mail
            accounts={accounts}
            mails={mails}
            defaultLayout={[20, 32, 48]}
            defaultCollapsed={false}
            navCollapsedSize={navSize}
          />
        </div>
      </div>
    </div>
  )
}
