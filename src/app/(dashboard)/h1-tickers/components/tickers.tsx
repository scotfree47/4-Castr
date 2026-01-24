"use client"

{
  /* Imports / Components / Variables - All */
}
import * as React from "react"

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core"

import { restrictToVerticalAxis } from "@dnd-kit/modifiers"

import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"

import { CSS } from "@dnd-kit/utilities"

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Columns2,
  EyeOff,
  GripVertical,
  Minus,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react"

import {
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type Row,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table"

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { Ticker } from "../../data"

import { useIsMobile } from "@/hooks/use-mobile"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

{
  /* DataTableColumnHeader Component */
}
interface DataTableColumnHeaderProps<TData, TValue> extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>
  title: string
}

function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>
  }

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="-ml-3 h-8 data-[state=open]:bg-accent">
            <span>{title}</span>
            {column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronsUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
            <ArrowUp className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
            Asc
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
            <ArrowDown className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
            Desc
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
            <EyeOff className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
            Hide
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

{
  /* DragHandle Component */
}
function DragHandle({ id }: { id: string | number }) {
  const { attributes, listeners } = useSortable({
    id,
  })

  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="text-muted-foreground size-7 hover:bg-transparent cursor-move"
    >
      <GripVertical className="text-muted-foreground size-3" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  )
}

{
  /* Column Definitions */
}
const columns: ColumnDef<Ticker>[] = [
  // Drag Handle
  {
    id: "drag",
    header: () => null,
    cell: ({ row }) => <DragHandle id={row.original.id} />,
  },

  // Checkbox
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },

  // Ticker (with drawer)
  {
    accessorKey: "ticker",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Ticker" />,
    cell: ({ row }) => {
      return <TableCellViewer item={row.original} />
    },
    enableHiding: false,
  },

  // Sector
  {
    accessorKey: "sector",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Sector" />,
    cell: ({ row }) => {
      const sector = row.getValue("sector") as string
      const formattedSector = sector
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")

      return (
        <div className="flex items-center">
          <span className="max-w-[200px] truncate">{formattedSector}</span>
        </div>
      )
    },
  },

  // Trend
  {
    accessorKey: "trend",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Trend" />,
    cell: ({ row }) => {
      const trend = row.getValue("trend") as string

      const trendConfig: Record<
        string,
        {
          label: string
          icon: any
          color: string
          bg: string
          border: string
        }
      > = {
        favorable: {
          label: "Favorable",
          icon: TrendingUp,
          color: "text-green-600",
          bg: "bg-green-500/10",
          border: "border-green-500/20",
        },
        bullish: {
          label: "Bullish",
          icon: TrendingUp,
          color: "text-green-600",
          bg: "bg-green-500/10",
          border: "border-green-500/20",
        },
        unfavorable: {
          label: "Unfavorable",
          icon: TrendingDown,
          color: "text-red-600",
          bg: "bg-red-500/10",
          border: "border-red-500/20",
        },
        bearish: {
          label: "Bearish",
          icon: TrendingDown,
          color: "text-red-600",
          bg: "bg-red-500/10",
          border: "border-red-500/20",
        },
        neutral: {
          label: "Neutral",
          icon: Minus,
          color: "text-gray-600",
          bg: "bg-gray-500/10",
          border: "border-gray-500/20",
        },
      }

      const config = trendConfig[trend] || trendConfig.neutral
      const Icon = config.icon

      return (
        <div className="flex items-center gap-2">
          <div className={cn("p-1.5 rounded-md", config.bg, config.border, "border")}>
            <Icon className={cn("h-3.5 w-3.5", config.color)} />
          </div>
          <span className={cn("font-medium", config.color)}>{config.label}</span>
        </div>
      )
    },
  },

  // Next Key Price
  {
    accessorKey: "next",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Next" />,
    cell: ({ row }) => {
      const price = row.getValue("next") as string
      return (
        <div className="flex items-center font-medium font-mono">
          <span>${price}</span>
        </div>
      )
    },
  },

  // Previous Key Price
  {
    accessorKey: "last",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Last" />,
    cell: ({ row }) => {
      const price = row.getValue("last") as string
      return (
        <div className="flex items-center font--mono">
          <span>${price}</span>
        </div>
      )
    },
  },

  // Compare
  {
    accessorKey: "compare",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Compare" />,
    cell: ({ row }) => {
      const compare = row.getValue("compare") as string
      const isUnassigned = compare === "Ticker(s)"

      return (
        <div className="flex items-center">
          <span className={isUnassigned ? "text-muted-foreground italic text-sm" : "text-sm"}>
            {compare}
          </span>
        </div>
      )
    },
  },
]

{
  /* DraggableRow Component */
}
function DraggableRow({ row }: { row: Row<Ticker> }) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 1 : 0,
    position: "relative" as const,
  }

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      data-state={row.getIsSelected() && "selected"}
      className="hover:bg-foreground/5 transition-colors"
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  )
}

function SkeletonLoader() {
  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <div className="h-12 bg-foreground/5 rounded-lg animate-pulse" />
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-foreground/5 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  )
}

function SummaryStats({ data }: { data: Ticker[] }) {
  const bullishCount = data.filter((t) => t.trend === "bullish" || t.trend === "favorable").length
  const bearishCount = data.filter((t) => t.trend === "bearish" || t.trend === "unfavorable").length
  const neutralCount = data.filter((t) => t.trend === "neutral").length

  return (
    <div className="grid grid-cols-3 gap-4 p-4 bg-foreground/5 rounded-lg backdrop-blur-sm">
      <div className="text-center">
        <div className="text-2xl font-bold text-green-600">{bullishCount}</div>
        <div className="text-xs text-muted-foreground">Bullish</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-red-600">{bearishCount}</div>
        <div className="text-xs text-muted-foreground">Bearish</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-gray-600">{neutralCount}</div>
        <div className="text-xs text-muted-foreground">Neutral</div>
      </div>
    </div>
  )
}

{
  /* Main Tickers Component */
}
export function Tickers({ data: initialData }: { data: Ticker[] }) {
  // Single data source with API fallback
  const [data, setData] = React.useState<Ticker[]>(() => initialData || [])
  const [loading, setLoading] = React.useState(!initialData || initialData.length === 0)
  const [error, setError] = React.useState<string | null>(null)

  // Load data from API if not provided
  React.useEffect(() => {
    if (!initialData || initialData.length === 0) {
      loadTickersFromAPI()
    }
  }, [])

  // tickers.tsx - UPDATED DATA LOADING (Line ~573)
  const loadTickersFromAPI = async () => {
    try {
      setLoading(true)
      setError(null)

      // ✅ Use existing ticker-ratings endpoint
      const categories = ["equity", "commodity", "forex", "crypto", "rates-macro", "stress"]
      const allTickers: any[] = []

      for (const category of categories) {
        const response = await fetch(
          `/api/ticker-ratings?mode=batch&category=${category}&minScore=0&maxResults=50`,
          { headers: { "Cache-Control": "no-cache" } }
        )

        if (!response.ok) continue

        const result = await response.json()
        if (result.success && result.data?.ratings) {
          allTickers.push(...result.data.ratings)
        }
      }

      // ✅ Transform to expected format
      const formattedTickers = allTickers.map((rating, idx) => ({
        id: idx + 1,
        ticker: rating.symbol,
        type: rating.category,
        sector: rating.sector,
        trend: rating.nextKeyLevel.type === "resistance" ? "bullish" : "bearish",
        next: rating.nextKeyLevel.price.toFixed(2),
        last: (rating.currentPrice * 0.95).toFixed(2), // Mock previous level
        compare: "Ticker(s)",
      }))

      setData(formattedTickers)
    } catch (err: any) {
      console.error("Error loading tickers:", err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Filter by type for each tab
  const equity = React.useMemo(() => data.filter((item) => item.type === "equity"), [data])

  const commodity = React.useMemo(() => data.filter((item) => item.type === "commodity"), [data])

  const forex = React.useMemo(() => data.filter((item) => item.type === "forex"), [data])

  const crypto = React.useMemo(() => data.filter((item) => item.type === "crypto"), [data])

  const ratesMacro = React.useMemo(() => data.filter((item) => item.type === "rates-macro"), [data])

  const stress = React.useMemo(() => data.filter((item) => item.type === "stress"), [data])

  // Chart state
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })

  const sortableId = React.useId()

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  )

  // Create IDs for drag and drop
  const equityIds = React.useMemo<UniqueIdentifier[]>(
    () => equity?.map(({ id }) => id) || [],
    [equity]
  )

  const commodityIds = React.useMemo<UniqueIdentifier[]>(
    () => commodity?.map(({ id }) => id) || [],
    [commodity]
  )

  const forexIds = React.useMemo<UniqueIdentifier[]>(
    () => forex?.map(({ id }) => id) || [],
    [forex]
  )

  const cryptoIds = React.useMemo<UniqueIdentifier[]>(
    () => crypto?.map(({ id }) => id) || [],
    [crypto]
  )

  const ratesMacroIds = React.useMemo<UniqueIdentifier[]>(
    () => ratesMacro?.map(({ id }) => id) || [],
    [ratesMacro]
  )

  const stressIds = React.useMemo<UniqueIdentifier[]>(
    () => stress?.map(({ id }) => id) || [],
    [stress]
  )

  // Create table instances for each tab
  const equityTable = useReactTable({
    data: equity,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  const commodityTable = useReactTable({
    data: commodity,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  const forexTable = useReactTable({
    data: forex,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  const cryptoTable = useReactTable({
    data: crypto,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  const ratesMacroTable = useReactTable({
    data: ratesMacro,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  const stressTable = useReactTable({
    data: stress,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  // Drag end handlers for each tab
  function handleEquityDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setData((currentData) => {
        const equityItems = currentData.filter((item) => item.type === "equity")
        const nonEquityItems = currentData.filter((item) => item.type !== "equity")

        // BOTH active.id AND over.id need .toString()
        const oldIndex = equityItems.findIndex((item) => item.id.toString() === active.id)
        const newIndex = equityItems.findIndex((item) => item.id.toString() === over.id)

        const reorderedEquity = arrayMove(equityItems, oldIndex, newIndex)
        return [...nonEquityItems, ...reorderedEquity]
      })
    }
  }

  function handlecommodityDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setData((currentData) => {
        const cfItems = currentData.filter((item) => item.type === "commodity")
        const nonCfItems = currentData.filter((item) => item.type !== "commodity")

        const oldIndex = cfItems.findIndex((item) => item.id.toString() === active.id)
        const newIndex = cfItems.findIndex((item) => item.id.toString() === over.id)

        const reorderedCf = arrayMove(cfItems, oldIndex, newIndex)
        return [...nonCfItems, ...reorderedCf]
      })
    }
  }

  function handleForexDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setData((currentData) => {
        const forexItems = currentData.filter((item) => item.type === "forex")
        const nonForexItems = currentData.filter((item) => item.type !== "forex")

        const oldIndex = forexItems.findIndex((item) => item.id.toString() === active.id)
        const newIndex = forexItems.findIndex((item) => item.id.toString() === over.id)

        const reorderedForex = arrayMove(forexItems, oldIndex, newIndex)
        return [...nonForexItems, ...reorderedForex]
      })
    }
  }

  function handleCryptoDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setData((currentData) => {
        const cryptoItems = currentData.filter((item) => item.type === "crypto")
        const nonCryptoItems = currentData.filter((item) => item.type !== "crypto")

        const oldIndex = cryptoItems.findIndex((item) => item.id.toString() === active.id)
        const newIndex = cryptoItems.findIndex((item) => item.id.toString() === over.id)

        const reorderedCrypto = arrayMove(cryptoItems, oldIndex, newIndex)
        return [...nonCryptoItems, ...reorderedCrypto]
      })
    }
  }

  function handleRatesMacroDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setData((currentData) => {
        const rmItems = currentData.filter((item) => item.type === "rates-macro")
        const nonRmItems = currentData.filter((item) => item.type !== "rates-macro")

        const oldIndex = rmItems.findIndex((item) => item.id.toString() === active.id)
        const newIndex = rmItems.findIndex((item) => item.id.toString() === over.id)

        const reorderedRm = arrayMove(rmItems, oldIndex, newIndex)
        return [...nonRmItems, ...reorderedRm]
      })
    }
  }

  function handleStressDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setData((currentData) => {
        const stressItems = currentData.filter((item) => item.type === "stress")
        const nonStressItems = currentData.filter((item) => item.type !== "stress")

        const oldIndex = stressItems.findIndex((item) => item.id.toString() === active.id)
        const newIndex = stressItems.findIndex((item) => item.id.toString() === over.id)

        const reorderedStress = arrayMove(stressItems, oldIndex, newIndex)
        return [...nonStressItems, ...reorderedStress]
      })
    }
  }

  // Table content component
  const TableContent = ({
    currentTable,
    currentDataIds,
    handleCurrentDragEnd,
    currentData, // ADD THIS
  }: {
    currentTable: ReturnType<typeof useReactTable<Ticker>>
    currentDataIds: UniqueIdentifier[]
    handleCurrentDragEnd: (event: DragEndEvent) => void
    currentData: Ticker[] // ADD THIS
  }) => (
    <>
      <SummaryStats data={currentData} />
      <div className="cursor-pointer overflow-hidden rounded-lg border bg-background/40 backdrop-blur-xl border-border/40 shadow-lg hover:border-primary/50 hover:shadow-[0_0_20px_rgba(51,255,51,0.3)] hover:scale-[1.01] transition-all duration-300">
        <DndContext
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleCurrentDragEnd}
          sensors={sensors}
          id={sortableId}
        >
          <Table>
            <TableHeader className="bg-muted sticky top-0 z-10">
              {currentTable.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody className="**:data-[slot=table-cell]:first:w-8">
              {currentTable.getRowModel().rows?.length ? (
                <SortableContext items={currentDataIds} strategy={verticalListSortingStrategy}>
                  {currentTable.getRowModel().rows.map((row) => (
                    <DraggableRow key={row.id} row={row} />
                  ))}
                </SortableContext>
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DndContext>
      </div>
      <div className="flex items-center justify-between px-4">
        <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
          {currentTable.getFilteredSelectedRowModel().rows.length} of{" "}
          {currentTable.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="flex w-full items-center gap-8 lg:w-fit">
          <div className="hidden items-center gap-2 lg:flex">
            <Label htmlFor="rows-per-page" className="text-sm font-medium">
              Rows per page
            </Label>
            <Select
              value={`${currentTable.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                currentTable.setPageSize(Number(value))
              }}
            >
              <SelectTrigger size="sm" className="w-20 cursor-pointer" id="rows-per-page">
                <SelectValue placeholder={currentTable.getState().pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex w-fit items-center justify-center text-sm font-medium">
            Page {currentTable.getState().pagination.pageIndex + 1} of {currentTable.getPageCount()}
          </div>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex cursor-pointer"
              onClick={() => currentTable.setPageIndex(0)}
              disabled={!currentTable.getCanPreviousPage()}
            >
              <span className="sr-only">Go to first page</span>
              <ChevronsLeft />
            </Button>
            <Button
              variant="outline"
              className="size-8 cursor-pointer"
              size="icon"
              onClick={() => currentTable.previousPage()}
              disabled={!currentTable.getCanPreviousPage()}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              className="size-8 cursor-pointer"
              size="icon"
              onClick={() => currentTable.nextPage()}
              disabled={!currentTable.getCanNextPage()}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRight />
            </Button>
            <Button
              variant="outline"
              className="hidden size-8 lg:flex cursor-pointer"
              size="icon"
              onClick={() => currentTable.setPageIndex(currentTable.getPageCount() - 1)}
              disabled={!currentTable.getCanNextPage()}
            >
              <span className="sr-only">Go to last page</span>
              <ChevronsRight />
            </Button>
          </div>
        </div>
      </div>
    </>
  )

  // Loading state
  if (loading) {
    return <SkeletonLoader />
  }

  // Error state
  if (error) {
    return (
      <Card className="border-destructive bg-destructive/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive mb-2">
            <AlertTriangle className="h-5 w-5" />
            <p className="font-semibold">Error loading tickers</p>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" onClick={loadTickersFromAPI}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Empty state
  if (data.length === 0) {
    return (
      <Card className="bg-foreground/5">
        <CardContent className="pt-6 text-center">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-lg font-semibold mb-1">No tickers available</p>
          <p className="text-sm text-muted-foreground mb-4">
            Load data to get started with market analysis
          </p>
          <Button variant="outline" onClick={loadTickersFromAPI}>
            <Zap className="mr-2 h-4 w-4" />
            Load Tickers
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Return the tabs UI
  return (
    <Tabs defaultValue="equity" className="relative z-0 w-full flex flex-col gap-6">
      {/* Header container with proper responsive wrapping */}
      <div className="flex items-center gap-3 px-4 lg:px-6 flex-wrap">
        {/* Mobile dropdown selector - visible only on small screens */}
        <div className="flex sm:hidden w-auto">
          <Label htmlFor="view-selector" className="sr-only">
            View
          </Label>

          <Select defaultValue="equity">
            <SelectTrigger
              className="flex cursor-pointer w-auto min-w-[140px]"
              size="sm"
              id="view-selector"
            >
              <SelectValue placeholder="Select a view" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="equity">Equity ({equity.length})</SelectItem>
              <SelectItem value="commodity">Commodity ({commodity.length})</SelectItem>
              <SelectItem value="forex">Forex ({forex.length})</SelectItem>
              <SelectItem value="crypto">Crypto ({crypto.length})</SelectItem>
              <SelectItem value="rates-macro">Rates & Macro ({ratesMacro.length})</SelectItem>
              <SelectItem value="stress">Stress ({stress.length})</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Desktop tabs - hidden on small screens, scrollable */}
        <div className="hidden sm:flex overflow-x-auto overflow-y-visible rounded-sm flex-1 min-w-0 scrollbar-hide">
          <TabsList className="flex gap-1 whitespace-nowrap **:data-[slot=badge]:bg-muted-foreground/25 **:data-[slot=badge]:size-6 **:data-[slot=badge]:px-1">
            <TabsTrigger
              value="equity"
              className={`
              cursor-pointer
              px-2.5
              hover:border-white/55
              hover:border-2
              hover:shadow-[0_0_20px_rgba(51,255,51,50)]
              hover:h-[34px]
              hover:px-[15px]
              data-[state=active]:border-[2.5]
              data-[state=active]:h-[33]
              data-[state=active]:shadow-[0_0_10px_rgba(51,255,51,0.7)]
              data-[state=active]:!border-[#33ff33]/50
              data-[state=active]:pl-2.5
              data-[state=active]:pr-1.5
              transition-all
            `}
            >
              Equity <Badge variant="secondary">{equity.length}</Badge>
            </TabsTrigger>

            <TabsTrigger
              value="commodity"
              className={`
              cursor-pointer
              px-2.5
              hover:border-white/55
              hover:border-2
              hover:shadow-[0_0_20px_rgba(51,255,51,50)]
              hover:h-[34px]
              hover:px-[15px]
              data-[state=active]:border-[2.5]
              data-[state=active]:h-[33]
              data-[state=active]:shadow-[0_0_10px_rgba(51,255,51,0.7)]
              data-[state=active]:!border-[#33ff33]/50
              data-[state=active]:pl-2.5
              data-[state=active]:pr-1.5
              transition-all
            `}
            >
              Commodity <Badge variant="secondary">{commodity.length}</Badge>
            </TabsTrigger>

            <TabsTrigger
              value="forex"
              className={`
              cursor-pointer
              px-2.5
              hover:border-white/55
              hover:border-2
              hover:shadow-[0_0_20px_rgba(51,255,51,50)]
              hover:h-[34px]
              hover:px-[15px]
              data-[state=active]:border-[2.5]
              data-[state=active]:h-[33]
              data-[state=active]:shadow-[0_0_10px_rgba(51,255,51,0.7)]
              data-[state=active]:!border-[#33ff33]/50
              data-[state=active]:pl-2.5
              data-[state=active]:pr-1.5
              transition-all
            `}
            >
              Forex <Badge variant="secondary">{forex.length}</Badge>
            </TabsTrigger>

            <TabsTrigger
              value="crypto"
              className={`
              cursor-pointer
              px-2.5
              hover:border-white/55
              hover:border-2
              hover:shadow-[0_0_20px_rgba(51,255,51,50)]
              hover:h-[34px]
              hover:px-[15px]
              data-[state=active]:border-[2.5]
              data-[state=active]:h-[33]
              data-[state=active]:shadow-[0_0_10px_rgba(51,255,51,0.7)]
              data-[state=active]:!border-[#33ff33]/50
              data-[state=active]:pl-2.5
              data-[state=active]:pr-1.5
              transition-all
            `}
            >
              Crypto <Badge variant="secondary">{crypto.length}</Badge>
            </TabsTrigger>

            <TabsTrigger
              value="rates-macro"
              className={`
              cursor-pointer
              px-2.5
              hover:border-white/55
              hover:border-2
              hover:shadow-[0_0_20px_rgba(51,255,51,50)]
              hover:h-[34px]
              hover:px-[15px]
              data-[state=active]:border-[2.5]
              data-[state=active]:h-[33]
              data-[state=active]:shadow-[0_0_10px_rgba(51,255,51,0.7)]
              data-[state=active]:!border-[#33ff33]/50
              data-[state=active]:pl-2.5
              data-[state=active]:pr-1.5
              transition-all
            `}
            >
              <span className="hidden lg:inline">Rates & Macro</span>
              <span className="lg:hidden">R & M</span>
              <Badge variant="secondary">{stress.length}</Badge>
            </TabsTrigger>

            <TabsTrigger
              value="stress"
              className={`
              cursor-pointer
              px-2.5
              hover:border-white/55
              hover:border-2
              hover:shadow-[0_0_20px_rgba(51,255,51,50)]
              hover:h-[34px]
              hover:px-[15px]
              data-[state=active]:border-[2.5]
              data-[state=active]:h-[33]
              data-[state=active]:shadow-[0_0_10px_rgba(51,255,51,0.7)]
              data-[state=active]:!border-[#33ff33]/50
              data-[state=active]:pl-2.5
              data-[state=active]:pr-1.5
              transition-all
            `}
            >
              Stress <Badge variant="secondary">{stress.length}</Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Action buttons - always visible, wraps on small screens */}
        <div className="flex items-center gap-2 ml-auto sm:ml-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="default" className="cursor-pointer">
                <Columns2 />
                <span>Columns</span>
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              className="w-56"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              {equityTable
                .getAllColumns()
                .filter((column) => typeof column.accessorFn !== "undefined" && column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/*}
        <Button variant="outline" size="sm" className="cursor-pointer">
          <Plus />
          <span className="hidden md:inline">Add Section</span>
          <span className="md:hidden sr-only">Add</span>
        </Button>
        */}
        </div>
      </div>

      {/* TAB CONTENTS - All tabs use filtered data */}

      <TabsContent
        value="equity"
        className="relative flex flex-col gap-4 overflow-visible px-4 lg:px-6"
      >
        <TableContent
          currentTable={equityTable}
          currentDataIds={equityIds}
          handleCurrentDragEnd={handleEquityDragEnd}
          currentData={equity}
        />
      </TabsContent>

      <TabsContent
        value="commodity"
        className="relative flex flex-col gap-4 overflow-visible px-4 lg:px-6"
      >
        <TableContent
          currentTable={commodityTable}
          currentDataIds={commodityIds}
          handleCurrentDragEnd={handlecommodityDragEnd}
          currentData={commodity}
        />
      </TabsContent>

      <TabsContent
        value="forex"
        className="relative flex flex-col gap-4 overflow-visible px-4 lg:px-6"
      >
        <TableContent
          currentTable={commodityTable}
          currentDataIds={commodityIds}
          handleCurrentDragEnd={handlecommodityDragEnd}
          currentData={forex}
        />
      </TabsContent>

      <TabsContent
        value="crypto"
        className="relative flex flex-col gap-4 overflow-visible px-4 lg:px-6"
      >
        <TableContent
          currentTable={commodityTable}
          currentDataIds={commodityIds}
          handleCurrentDragEnd={handlecommodityDragEnd}
          currentData={crypto}
        />
      </TabsContent>

      <TabsContent
        value="rates-macro"
        className="relative flex flex-col gap-4 overflow-visible px-4 lg:px-6"
      >
        <TableContent
          currentTable={commodityTable}
          currentDataIds={commodityIds}
          handleCurrentDragEnd={handlecommodityDragEnd}
          currentData={ratesMacro}
        />
      </TabsContent>

      <TabsContent
        value="stress"
        className="relative flex flex-col gap-4 overflow-visible px-4 lg:px-6"
      >
        <TableContent
          currentTable={commodityTable}
          currentDataIds={commodityIds}
          handleCurrentDragEnd={handlecommodityDragEnd}
          currentData={stress}
        />
      </TabsContent>
    </Tabs>
  )
}

{
  /* Constants / Data - Charts */
}
const chartData = [
  { month: "January", desktop: 186, mobile: 80 },
  { month: "February", desktop: 305, mobile: 200 },
  { month: "March", desktop: 237, mobile: 120 },
  { month: "April", desktop: 73, mobile: 190 },
  { month: "May", desktop: 209, mobile: 130 },
  { month: "June", desktop: 214, mobile: 140 },
]

{
  /* Constants / Configuration - Charts */
}
const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "var(--primary)",
  },
  mobile: {
    label: "Mobile",
    color: "var(--primary)",
  },
} satisfies ChartConfig

{
  /* Function / Data Table / Cell Viewer / Settings - All */
}
function TableCellViewer({ item }: { item: Ticker }) {
  const isMobile = useIsMobile()

  return (
    <Drawer direction={isMobile ? "bottom" : "right"}>
      <DrawerTrigger asChild>
        <Button variant="link" className="text-foreground w-fit px-0 text-left cursor-pointer">
          {item.ticker} {/* CHANGED FROM: item.header */}
        </Button>
      </DrawerTrigger>

      <DrawerContent>
        <DrawerHeader className="gap-1">
          <DrawerTitle>{item.ticker}</DrawerTitle> {/* CHANGED FROM: item.header */}
          <DrawerDescription>Ticker Performance Yearly Review</DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
          {!isMobile && (
            <>
              <ChartContainer config={chartConfig}>
                <AreaChart
                  accessibilityLayer
                  data={chartData}
                  margin={{
                    left: 0,
                    right: 10,
                  }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => value.slice(0, 3)}
                    hide
                  />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                  <Area
                    dataKey="mobile"
                    type="natural"
                    fill="var(--color-mobile)"
                    fillOpacity={0.6}
                    stroke="var(--color-mobile)"
                    stackId="a"
                  />
                  <Area
                    dataKey="desktop"
                    type="natural"
                    fill="var(--color-desktop)"
                    fillOpacity={0.4}
                    stroke="var(--color-desktop)"
                    stackId="a"
                  />
                </AreaChart>
              </ChartContainer>

              <Separator />

              <div className="grid gap-2">
                <div className="flex gap-2 leading-none font-medium">
                  Trending up by 5.2% this month <TrendingUp className="size-4" />
                </div>
                <div className="text-muted-foreground">
                  Showing ticker performance from the past year.
                </div>
              </div>

              <Separator />
            </>
          )}

          <form className="flex flex-col gap-4">
            {/* TICKER INPUT */}
            <div className="flex flex-col gap-3">
              <Label htmlFor="ticker">Ticker</Label> {/* CHANGED FROM: Header */}
              <Input id="ticker" defaultValue={item.ticker} /> {/* CHANGED FROM: item.header */}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* SECTOR SELECT */}
              <div className="flex flex-col gap-3">
                <Label htmlFor="sector">Sector</Label> {/* CHANGED FROM: Type */}
                <Select defaultValue={item.sector}>
                  {" "}
                  {/* CHANGED FROM: item.type */}
                  <SelectTrigger id="sector" className="w-full cursor-pointer">
                    <SelectValue placeholder="Select a sector" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Technology">Technology</SelectItem>
                    <SelectItem value="Finance">Finance</SelectItem>
                    <SelectItem value="Healthcare">Healthcare</SelectItem>
                    <SelectItem value="Energy">Energy</SelectItem>
                    <SelectItem value="Consumer">Consumer</SelectItem>
                    <SelectItem value="Major Pairs">Major Pairs</SelectItem>
                    <SelectItem value="Cryptocurrency">Cryptocurrency</SelectItem>
                    <SelectItem value="Commodity">Commodity</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* TREND SELECT */}
              <div className="flex flex-col gap-3">
                <Label htmlFor="trend">Trend</Label> {/* CHANGED FROM: Status */}
                <Select defaultValue={item.trend}>
                  {" "}
                  {/* CHANGED FROM: item.status */}
                  <SelectTrigger id="trend" className="w-full cursor-pointer">
                    <SelectValue placeholder="Select a trend" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bullish">Bullish</SelectItem> {/* CHANGED */}
                    <SelectItem value="bearish">Bearish</SelectItem> {/* CHANGED */}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* NEXT KEY PRICE */}
              <div className="flex flex-col gap-3">
                <Label htmlFor="next">Next</Label> {/* CHANGED FROM: Target */}
                <Input id="next" defaultValue={item.next} /> {/* CHANGED FROM: item.target */}
              </div>

              {/* PREVIOUS KEY PRICE */}
              <div className="flex flex-col gap-3">
                <Label htmlFor="last">Last</Label> {/* CHANGED FROM: Limit */}
                <Input id="last" defaultValue={item.last} /> {/* CHANGED FROM: item.limit */}
              </div>
            </div>

            {/* COMPARE SELECT */}
            <div className="flex flex-col gap-3">
              <Label htmlFor="compare">Compare</Label>

              <Select defaultValue={item.compare}>
                <SelectTrigger id="compare" className="w-full cursor-pointer">
                  <SelectValue placeholder="Select a compare" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="Eddie Lake">Eddie Lake</SelectItem>
                  <SelectItem value="Jamik Tashpulatov">Jamik Tashpulatov</SelectItem>
                  <SelectItem value="Emily Whalen">Emily Whalen</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </form>
        </div>

        <DrawerFooter>
          <Button className="cursor-pointer">Submit</Button>
          <DrawerClose asChild>
            <Button variant="outline" className="cursor-pointer">
              Done
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
