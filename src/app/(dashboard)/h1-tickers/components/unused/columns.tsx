"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

import type { Ticker } from "../../data/"
import { DataTableColumnHeader } from "./data-table-column-header"
import { DataTableRowActions } from "./data-table-row-actions"

export const columns: ColumnDef<Ticker>[] = [
  // SELECT CHECKBOX
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="translate-y-[2px] cursor-pointer"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-[2px] cursor-pointer"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },

  // TICKER (this will call TableCellViewer from tickers.tsx)
  {
    accessorKey: "ticker",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Ticker" />
    ),
    cell: ({ row }) => {
      return <TableCellViewer item={row.original} />
    },
    enableHiding: false,
  },

  // SECTOR
  {
    accessorKey: "sector",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Sector" />
    ),
    cell: ({ row }) => {
      const sector = row.getValue("sector") as string
      // Format sector nicely (real_estate -> Real Estate)
      const formattedSector = sector
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
      
      return (
        <div className="flex items-center">
          <span className="max-w-[200px] truncate">
            {formattedSector}
          </span>
        </div>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },

  // TREND
  {
    accessorKey: "trend",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Trend" />
    ),
    cell: ({ row }) => {
      const trend = row.getValue("trend") as string
      
      // Map your trend values to display
      const trendConfig: Record<string, { label: string; icon: any; color: string }> = {
        favorable: { 
          label: "Favorable", 
          icon: TrendingUp, 
          color: "text-green-600" 
        },
        unfavorable: { 
          label: "Unfavorable", 
          icon: TrendingDown, 
          color: "text-red-600" 
        },
        neutral: { 
          label: "Neutral", 
          icon: Minus, 
          color: "text-gray-600" 
        },
      }
      
      const config = trendConfig[trend] || trendConfig.neutral
      const Icon = config.icon
      
      return (
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${config.color}`} />
          <span className={config.color}>
            {config.label}
          </span>
        </div>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },

  // NEXT KEY PRICE
  {
    accessorKey: "nextKeyPrice",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Next Key Price" />
    ),
    cell: ({ row }) => {
      const price = row.getValue("nextKeyPrice") as string
      return (
        <div className="flex items-center font-medium">
          <span>${price}</span>
        </div>
      )
    },
  },

  // PREVIOUS KEY PRICE
  {
    accessorKey: "previousKeyPrice",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Previous Key Price" />
    ),
    cell: ({ row }) => {
      const price = row.getValue("previousKeyPrice") as string
      return (
        <div className="flex items-center">
          <span>${price}</span>
        </div>
      )
    },
  },

  // REVIEWER
  {
    accessorKey: "reviewer",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Reviewer" />
    ),
    cell: ({ row }) => {
      const reviewer = row.getValue("reviewer") as string
      const isUnassigned = reviewer === "Assign reviewer"
      
      return (
        <div className="flex items-center">
          <span className={isUnassigned ? "text-muted-foreground italic text-sm" : "text-sm"}>
            {reviewer}
          </span>
        </div>
      )
    },
  },

  // ACTIONS
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
]
