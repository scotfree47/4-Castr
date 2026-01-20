"use client"

import { Calendar } from "@/components/ui/calendar"
import { useState } from "react"

interface DatePickerProps {
  selectedDate?: Date
  onDateSelect?: (date: Date) => void
}

export function DatePicker({ selectedDate, onDateSelect }: DatePickerProps) {
  const [date, setDate] = useState<Date | undefined>(selectedDate || new Date())

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      setDate(selectedDate)
      onDateSelect?.(selectedDate)
    }
  }

  return (
    <div className="flex justify-center">
      <Calendar
        mode="single"
        selected={date}
        onSelect={handleDateSelect}
        className="w-full [&_[role=gridcell]_button]:cursor-pointer [&_button]:cursor-pointer"
      />
    </div>
  )
}
