"use client"

{/* Imports / Components / Variables - All */}
import * as React from "react"
  
  import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    type UniqueIdentifier,
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
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    CircleCheckBig,
    EllipsisVertical,
    GripVertical,
    Columns2,
    Loader,
    Plus,
    TrendingUp,
  } from "lucide-react"
  
  import {
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
  
  import { toast } from "sonner"
  
  import { z } from "zod"

  import { schema } from "../../2charts/schemas/task-schema"
  
  import { useIsMobile } from "@/hooks/use-mobile"
  
  import { Badge } from "@/components/ui/badge"
  
  import { Button } from "@/components/ui/button"
  
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
  
  import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
  } from "@/components/ui/tabs"


{/* // Create a separate component for the drag handle Buttons  */}
function DragHandle({ id }: { id: number }) {
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


{/* Constants / Data Table / Columns / Settings - All */}
const columns: ColumnDef<z.infer<typeof schema>>[] = [
  
  // - / - / - / - / Menu / Settings - Drag Handle
  {
    id: "drag",
    header: () => null,
    cell: ({ row }) => <DragHandle id={row.original.id} />,
  },
  
  // - / - / - / - / Menu / Settings - Checkbox
  {
    
    // Checkbox / Settings - All
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
    
    // - / - / - / Rows / Checkbox / Settings - All
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
  
  // - / - / - / - / Menu / Settings / Options / Accessor / Ticker - All
  {/*
    accessorKey: "Ticker",
    header: "Ticker",
    cell: ({ row }) => {
      return <TableCellViewer item={row.original} />
    },
    enableHiding: false,
  */},
  
  {
    accessorKey: "ticker",  // CHANGED FROM: "header"
    header: ({ column }) => (
      
      <DataTableColumnHeader column={column} title="Ticker" />

    ),
    
    cell: ({ row }) => {
      
      return (
        
        <div className="flex space-x-2">
          
          <span className="max-w-[500px] truncate font-medium">
            {row.getValue("ticker")}
          </span>

        </div>

      )

    },
  },

  // - / - / Rows / Column ID / Sector / Settings - All
  {
    accessorKey: "Sector",
    header: "Sector",
    cell: ({ row }) => (
      
      <div className="w-32">
        
        <Badge variant="outline" className="text-muted-foreground px-1.5">
          {row.original.type}
        </Badge>

      </div>

    ),
  },
  
  // - / - / Rows / Column ID / Target ("Trend") / Settings - All
  {
    accessorKey: "trend",
    header: "Trend",
    cell: ({ row }) => (
      
      <Badge variant="outline" className="text-muted-foreground px-1.5">
        {row.original.status === "Done" ? (
          
          <CircleCheckBig className="text-green-500 dark:text-green-400" />
        ) : (
          <Loader />
          
        )}
        {row.original.status}

      </Badge>

    ),
  },
  
  // - / - / Rows / Column ID / Target ("Next") / Settings - All
  {
    accessorKey: "target",
    header: () => <div className="w-full">Target</div>,
    cell: ({ row }) => (
      
      <form
        
        onSubmit={(e) => {
          
          e.preventDefault()
          toast.promise(new Promise((resolve) => setTimeout(resolve, 1000)), {
            
            loading: `Saving ${row.original.header}`,
            success: "Done",
            error: "Failed",

          })

        }}
      >
        
        <Label htmlFor={`${row.original.id}-target`} className="sr-only">
          Target
        </Label>
        
        <Input
          className="hover:bg-input/30 focus-visible:bg-background dark:hover:bg-input/30 dark:focus-visible:bg-input/30 h-8 w-16 border-transparent bg-transparent shadow-none focus-visible:border dark:bg-transparent"
          defaultValue={row.original.target}
          id={`${row.original.id}-target`}
        />

      </form>

    ),
  },
  
  // - / - / Rows / Column ID / Limit ("Last") / Settings - All
  {
    accessorKey: "limit",
    header: () => <div className="w-full">Limit</div>,
    cell: ({ row }) => (
      
      <form
        
        onSubmit={(e) => {
          
          e.preventDefault()
          toast.promise(new Promise((resolve) => setTimeout(resolve, 1000)), {
            loading: `Saving ${row.original.header}`,
            success: "Done",
            error: "Error",
          })

        }}
      >
        
        <Label htmlFor={`${row.original.id}-limit`} className="sr-only">
          Limit
        </Label>

        <Input
          className="hover:bg-input/30 focus-visible:bg-background dark:hover:bg-input/30 dark:focus-visible:bg-input/30 h-8 w-16 border-transparent bg-transparent shadow-none focus-visible:border dark:bg-transparent"
          defaultValue={row.original.limit}
          id={`${row.original.id}-limit`}
        />

      </form>

    ),
  },
  
  // - / Data Table / Rows / Components / Column ID / Reviewer / Settings - All
  {
    accessorKey: "reviewer",
    header: "Reviewer",
    cell: ({ row }) => {
      const isAssigned = row.original.reviewer !== "Assign reviewer"

      if (isAssigned) {
        return row.original.reviewer
      }


      return (
        <>
          
          <Label htmlFor={`${row.original.id}-reviewer`} className="sr-only">
            Reviewer
          </Label>
          
          <Select>
            
            <SelectTrigger
              className="w-38 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate cursor-pointer"
              size="sm"
              id={`${row.original.id}-reviewer`}
            >
              
              <SelectValue placeholder="Assign reviewer" />

            </SelectTrigger>
            
            <SelectContent align="end">
              
              <SelectItem value="Eddie Lake">Eddie Lake</SelectItem>
              
              <SelectItem value="Jamik Tashpulatov">
                Jamik Tashpulatov
              </SelectItem>

            </SelectContent>

          </Select>

        </>

      )

    },
  },
  
  // Constants / Data Table / Rows / Components / Dropdown Menu / Settings - All
  {
    id: "actions",
    cell: () => (
      
      // - / - / - / Rows / Dropdown Menu / Settings / Options - All
      <DropdownMenu>
        
        <DropdownMenuTrigger asChild>
          
          <Button
            variant="ghost"
            className="data-[state=open]:bg-muted text-muted-foreground flex size-8 cursor-pointer"
            size="icon"
          >
            
            <EllipsisVertical />
            <span className="sr-only">Open menu</span>

          </Button>

        </DropdownMenuTrigger>
        
        {/* Constants / Data Table / Rows / Menu / Settings / Options - All */}
        <DropdownMenuContent align="end" className="w-32">
          
          <DropdownMenuItem>Metrics</DropdownMenuItem>
          <DropdownMenuItem>Alert Me</DropdownMenuItem>
          <DropdownMenuItem>Favorite</DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem variant="destructive">Unfavorite</DropdownMenuItem>

        </DropdownMenuContent>

      </DropdownMenu>

    ),
  },
]

// Function / Data Table / Rows / Comonponents / Draggable Row / Settings - All
{/* Draggable Row Function */}
function DraggableRow({ row }: { row: Row<z.infer<typeof schema>> }) {
  
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.id,
  })

  return (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      data-dragging={isDragging}
      ref={setNodeRef}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
      
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
    >
      {row.getVisibleCells().map((cell) => (
        
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>

      ))}

    </TableRow>
  )
}

{/* Compononent / Tickers / Table / Function / Export */}
export function Tickers({
  
  data: initialData,
  equityData = [],
  commoditiesFuturesData = [],
  forexData = [],
  cryptoData = [],
  ratesMacroData = [],
  stressData = []

}: {
  
  data: z.infer<typeof schema>[]
  equityData?: z.infer<typeof schema>[]
  commoditiesFuturesData?: z.infer<typeof schema>[]
  forexData?: z.infer<typeof schema>[]
  cryptoData?: z.infer<typeof schema>[]
  ratesMacroData?: z.infer<typeof schema>[]
  stressData?: z.infer<typeof schema>[]

}) {
  
  {/* Chart Tabs */}
  
  const [data, setData] = React.useState(() => initialData)
  
  const [equity, setEquity] = React.useState(() => equityData)
  
  const [commoditiesFutures, setCommoditiesFutures] = React.useState(() => commoditiesFuturesData)
  
  const [forex, setForex] = React.useState(() => forexData)
  
  const [crypto, setCrypto] = React.useState(() => cryptoData)

  const [ratesMacro, setRatesMacro] = React.useState(() => ratesMacroData)

  const [stress, setStress] = React.useState(() => stressData)
  
  {/* Chart Constants */}
  const [rowSelection, setRowSelection] = React.useState({})
  
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  
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

  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => data?.map(({ id }) => id) || [],
    [data]
  )

  // Create separate table instances for each tab
  const equityIds = React.useMemo<UniqueIdentifier[]>(
    () => equity?.map(({ id }) => id) || [],
    [equity]
  )  
  
  const commoditiesFuturesIds = React.useMemo<UniqueIdentifier[]>(
    () => commoditiesFutures?.map(({ id }) => id) || [],
    [commoditiesFutures]
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
    () => stressData?.map(({ id }) => id) || [],
    [stress]
  )

  {/* Constants / Table / Variables - All */}
  
  const table = useReactTable({
    data,
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
  

  {/* Constants / Equity Table / Variables - All */}
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

  {/* Constants / Commodities & Futures / Variables - All */}
  const commoditiesFuturesTable = useReactTable({
    data: commoditiesFutures,
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

  {/* Constants / Forex / Variables - All */}
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

  {/* Constants / Crypto Table / Variables - All */}
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

  {/* Constants / Rates & Macro / Variables - All */}
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

  {/* Constants / Stress / Variables - All */}
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

  
  // Function / Drag End / Data (Might Need) / Variables - All 
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    
    // Function / Drag End / Variables / "if" Function / Constants - All
    if (active && over && active.id !== over.id) {
      
      {/*
      // Function / Drag End / Variables - All
      setData((data) => {
        const oldIndex = dataIds.indexOf(active.id)
        const newIndex = dataIds.indexOf(over.id)
        return arrayMove(data, oldIndex, newIndex)
      })
      */}
    }

  }
  
  {/* Function / Drag End / Equity / Variables - All */}
  function handleEquityDragEnd(event: DragEndEvent) {
    const { active, over } = event
    
    {/* Function / Drag End / Variables / if-Function / Constants - All */}
    if (active && over && active.id !== over.id) {
      
      {/* Function / Drag End / Variables - All */}
      setEquity((data) => {
        const oldIndex = equityIds.indexOf(active.id)
        const newIndex = equityIds.indexOf(over.id)
        return arrayMove(data, oldIndex, newIndex)
      })

    }

  }

  {/* Function / Drag End / Commodities & Futures / Variables - All */}
  function handleCommoditiesFuturesDragEnd(event: DragEndEvent) {
    const { active, over } = event
    
    if (active && over && active.id !== over.id) {
      setCommoditiesFutures((data) => {
        const oldIndex = commoditiesFuturesIds.indexOf(active.id)
        const newIndex = commoditiesFuturesIds.indexOf(over.id)
        return arrayMove(data, oldIndex, newIndex)
      })
    }
  }

  {/* Function / Drag End / Forex / Variables - All */}
  function handleForexDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setForex((data) => {
        const oldIndex = forexIds.indexOf(active.id)
        const newIndex = forexIds.indexOf(over.id)
        return arrayMove(data, oldIndex, newIndex)
      })
    }
  }

  {/* Function / Drag End / Crypto / Variables - All */}
  function handleCryptoDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setCrypto((data) => {
        const oldIndex = cryptoIds.indexOf(active.id)
        const newIndex = cryptoIds.indexOf(over.id)
        return arrayMove(data, oldIndex, newIndex)
      })
    }
  }

  {/* Function / Drag End / Rates & Macro / Variables - All */}
  function handleRatesMacroDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setRatesMacro((data) => {
        const oldIndex = ratesMacroIds.indexOf(active.id)
        const newIndex = ratesMacroIds.indexOf(over.id)
        return arrayMove(data, oldIndex, newIndex)
      })
    }
  }
  
  {/* Function / Drag End / Stress / Variables - All */}
  function handleStressDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setStress((data) => {
        const oldIndex = stressIds.indexOf(active.id)
        const newIndex = stressIds.indexOf(over.id)
        return arrayMove(data, oldIndex, newIndex)
      })
    }
  }
  
  {/* Table / Settings - All */}  
  // Component for rendering table content
  const TableContent = ({ 
    currentTable, 
    currentDataIds, 
    handleCurrentDragEnd 
  }: { 
    currentTable: ReturnType<typeof useReactTable<z.infer<typeof schema>>>, 
    currentDataIds: UniqueIdentifier[], 
    handleCurrentDragEnd: (event: DragEndEvent) => void 
  }) => (
    <>
      <div className="overflow-hidden rounded-lg border">
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
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody className="**:data-[slot=table-cell]:first:w-8">
              {currentTable.getRowModel().rows?.length ? (
                <SortableContext
                  items={currentDataIds}
                  strategy={verticalListSortingStrategy}
                >
                  {currentTable.getRowModel().rows.map((row) => (
                    <DraggableRow key={row.id} row={row} />
                  ))}
                </SortableContext>
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
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
          
          {/* Rows Per Page Menu */}
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
                <SelectValue
                  placeholder={currentTable.getState().pagination.pageSize}
                />
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
          
          {/* Page Count Indicator & Buttons */}
          <div className="flex w-fit items-center justify-center text-sm font-medium">
            Page {currentTable.getState().pagination.pageIndex + 1} of{" "}
            {currentTable.getPageCount()}
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

  {/* Components / Data Table / Tabs / Settings - All */}
  
  {/* Table / Settings / Columns / Tabs - All */}
  return (
    
    <Tabs
      defaultValue="outline"
      className="w-full flex-col justify-start gap-6"
    >
      
      <div className="flex items-center justify-between px-4 lg:px-6 flex-wrap gap-3">
        
        <Label htmlFor="view-selector" className="sr-only">
          View
        </Label>
        
        <Select defaultValue="outline">
          
          <SelectTrigger
            className="flex w-fit sm:hidden cursor-pointer"
            size="sm"
            id="view-selector"
          >
            <SelectValue placeholder="Select a view" />

          </SelectTrigger>

          <SelectContent>

            <SelectItem value="equity">Equity</SelectItem>

            <SelectItem value="commodities-futures">Commodities & Futures</SelectItem>

            <SelectItem value="forex">Forex</SelectItem>

            <SelectItem value="crypto">Crypto</SelectItem>

            <SelectItem value="rate-macro">Rates & Macro</SelectItem>

            <SelectItem value="stress">Stress</SelectItem>

          </SelectContent>

        </Select>

        <TabsList className="**:data-[slot=badge]:bg-muted-foreground/30 hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:px-1 sm:flex">

          <TabsTrigger value="equity" className="cursor-pointer">Equity</TabsTrigger>

          <TabsTrigger value="commodities-futures" className="cursor-pointer">
            Commodities & Futures <Badge variant="secondary">3</Badge>
          </TabsTrigger>

          <TabsTrigger value="forex" className="cursor-pointer">
            Forex <Badge variant="secondary">2</Badge>
          </TabsTrigger>

          <TabsTrigger value="crypto" className="cursor-pointer">Crypto</TabsTrigger>

          <TabsTrigger value="rates-macro" className="cursor-pointer">Rates & Macro</TabsTrigger>

          <TabsTrigger value="stress" className="cursor-pointer">Stress</TabsTrigger>

        </TabsList>
        
        <div className="flex items-center gap-2">
          
          {/* Table / Settings / Columns /  Dropdown Menu - All */}
          <DropdownMenu>
            
            {/* Table / Settings / Columns /  Dropdown Menu / - Trigger */}
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="cursor-pointer">
                <Columns2 />
                <span className="hidden lg:inline">Customize Columns</span>
                <span className="lg:hidden">Columns</span>
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            
            {/* Table / Settings / Columns / Dropdown Menu - Content */}
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== "undefined" &&
                    column.getCanHide()
                )
                .map((column) => {
                  return (
                    
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      
                      {column.id}

                    </DropdownMenuCheckboxItem>
                    
                  ) 
                })
              }
            </DropdownMenuContent>
          
          </DropdownMenu>
          
          <Button variant="outline" size="sm" className="cursor-pointer">
            <Plus />
            <span className="hidden lg:inline">Add Section</span>
          </Button>

        </div>

      </div>
      
      {/* Tabs / Settings / All */}
      <TabsContent
        value="outline"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        <div className="overflow-hidden rounded-lg border">
          
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            sensors={sensors}
            id={sortableId}
          >
            
            {/* Table / Settings - All */}
            <Table className="cursor-pointer hover:border-primary/50 transition-colors">
              
              {/* Table / Settings / Header - All */}
              <TableHeader className="bg-muted sticky top-0 z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        
                        <TableHead key={header.id} colSpan={header.colSpan}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>

                      )
                    })}
                  </TableRow>
                  
                ))}
              </TableHeader>
              
              {/* Table / Settings / Body - All */}
              <TableBody className="**:data-[slot=table-cell]:first:w-8">
                {table.getRowModel().rows?.length ? (
                  
                  <SortableContext
                    items={equityIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {table.getRowModel().rows.map((row) => (
                      <DraggableRow key={row.id} row={row} />
                    ))}
                  </SortableContext>

                ) : (
                  
                  <TableRow>
                    
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No results.
                    </TableCell>

                  </TableRow>
                  
                )}
              </TableBody>

            </Table>

          </DndContext>

        </div>
        
        {/* Table / Settings / Header - All */}
        <div className="flex items-center justify-between px-4">
          
          <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
          
          <div className="flex w-full items-center gap-8 lg:w-fit">
            
            <div className="hidden items-center gap-2 lg:flex">
              
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                Rows per page
              </Label>
              
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value))
                }}
              >
                <SelectTrigger size="sm" className="w-20 cursor-pointer" id="rows-per-page">
                  <SelectValue
                    placeholder={table.getState().pagination.pageSize}
                  />
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
            
            {/* Page / Settings - All */}
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
            
            {/* Page / Settings / Text - Page Number */}
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </div>
            
              {/* Page / Settings / Buttons - Page First */}
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex cursor-pointer"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft />
              </Button>
              
              {/* Page / Settings / Buttons - Page Previous */}
              <Button
                variant="outline"
                className="size-8 cursor-pointer"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft />
              </Button>
              
              {/* Page / Settings / Buttons - Page Next */}
              <Button
                variant="outline"
                className="size-8 cursor-pointer"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight />
              </Button>
              
              {/* Page / Settings / Buttons - Page Last */}
              <Button
                variant="outline"
                className="hidden size-8 lg:flex cursor-pointer"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRight />
              </Button>
            </div>


          </div>
        </div>
      </TabsContent>
      

      {/* Tabs / Settings - All */}
      
        {/* Columns / Tabs / Settings / Names - Equity */}
          <TabsContent
            value="outline"
            className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
          >
            <TableContent 
              currentTable={equityTable}
              currentDataIds={equityIds}
              handleCurrentDragEnd={handleEquityDragEnd}
            />
          </TabsContent>
          
          {/* Columns / Tabs / Settings / Names - Commodities & Futures */}
          <TabsContent
            value="commodities-futures"
            className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
          >
            <TableContent 
              currentTable={commoditiesFuturesTable}
              currentDataIds={commoditiesFuturesIds}
              handleCurrentDragEnd={handleCommoditiesFuturesDragEnd}
            />
          </TabsContent>
        
        {/* Settings / Content/ Tabs / Names - Forex */}
          <TabsContent 
            value="forex" 
            className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
          >
            <TableContent 
              currentTable={forexTable}
              currentDataIds={forexIds}
              handleCurrentDragEnd={handleForexDragEnd}
            />
          </TabsContent>
        
        {/* Settings / Content / Tabs / Names - Crypto */}
          <TabsContent
            value="crypto"
            className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
          >
            <TableContent 
              currentTable={cryptoTable}
              currentDataIds={cryptoIds}
              handleCurrentDragEnd={handleCryptoDragEnd}
            />
          </TabsContent>


        {/* Settings / Content/ Tabs / Names - Rates & Macro */}
          <TabsContent
            value="rates-macro"
            className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
          >
            <TableContent 
              currentTable={ratesMacroTable}
              currentDataIds={ratesMacroIds}
              handleCurrentDragEnd={handleRatesMacroDragEnd}
            />
          </TabsContent>

        {/* Settings / Tabs / Names - Stress */}
          <TabsContent
            value="stress"
            className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
          >
            
            <TableContent 
              currentTable={stressTable}
              currentDataIds={stressIds}
              handleCurrentDragEnd={handleStressDragEnd}
            />
            
          </TabsContent>

    </Tabs>
  )
}

{/* Constants / Data - Charts */}
const chartData = [
  { month: "January", desktop: 186, mobile: 80 },
  { month: "February", desktop: 305, mobile: 200 },
  { month: "March", desktop: 237, mobile: 120 },
  { month: "April", desktop: 73, mobile: 190 },
  { month: "May", desktop: 209, mobile: 130 },
  { month: "June", desktop: 214, mobile: 140 },
]

{/* Constants / Configuration - Charts */}
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

{/* Function / Data Table / Cell Viewer / Settings - All */}
function TableCellViewer({ item }: { item: z.infer<typeof schema> }) {
  
  const isMobile = useIsMobile()
  return (
    <Drawer direction={isMobile ? "bottom" : "right"}>
      
      {/* Function / Data Table / Cell Viewer / Settings - Button */}
      <DrawerTrigger asChild>

        <Button variant="link" className="text-foreground w-fit px-0 text-left cursor-pointer">
          {item.header}
        </Button>

      </DrawerTrigger>
      
      {/* Function / Data Table / Cell Viewer / Settings - All */}
      <DrawerContent>
        
        {/* Function / Data Table / Cell Viewer / Settings / Header - All */}
        <DrawerHeader className="gap-1">
          
          {/* Function / Data Table / Cell Viewer / Settings / Header - Title */}
          <DrawerTitle>{item.header}</DrawerTitle>

          {/* Function / Data Table / Cell Viewer / Settings / Header - Description */}
          <DrawerDescription>
            Ticker Performance Yearly Review
          </DrawerDescription>

        </DrawerHeader>
        
        {/* Function / Data Table / Cell Viewer / Settings / Header - All */}
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
                  
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                  />
                  
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
                  Trending up by 5.2% this month{" "}
                  <TrendingUp className="size-4" />
                </div>
                
                <div className="text-muted-foreground">
                  Showing ticker performance from the past year.
                </div>

              </div>
              
              <Separator />

            </>
          )}
          
          <form className="flex flex-col gap-4">
            
            <div className="flex flex-col gap-3">
              <Label htmlFor="header">Header</Label>
              <Input id="header" defaultValue={item.header} />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              
              <div className="flex flex-col gap-3">
                <Label htmlFor="type">Type</Label>
                
                <Select defaultValue={item.type}>
                  
                  <SelectTrigger id="type" className="w-full cursor-pointer">
                    <SelectValue placeholder="Select a type" />
                  </SelectTrigger>
                  
                  {/* / - / Sector / Trigger / Options - All */}
                  <SelectContent>

                    
                    <SelectItem value="Table of Contents">
                      Table of Contents
                    </SelectItem>

                    <SelectItem value="Executive Summary">
                      Executive Summary
                    </SelectItem>

                    <SelectItem value="Technical Approach">
                      Technical Approach
                    </SelectItem>

                    <SelectItem value="Design">Design</SelectItem>

                    <SelectItem value="Capabilities">Capabilities</SelectItem>

                    <SelectItem value="Focus Documents">
                      Focus Documents
                    </SelectItem>
                    
                    <SelectItem value="Narrative">Narrative</SelectItem>
                    
                    <SelectItem value="Cover Page">Cover Page</SelectItem>

                  </SelectContent>

                </Select>
              </div>
              
              <div className="flex flex-col gap-3">
                
                <Label htmlFor="trend">Trend</Label>
                
                <Select defaultValue={item.status}>
                  
                  <SelectTrigger id="trend" className="w-full cursor-pointer">
                    <SelectValue placeholder="Select a trend" />
                  </SelectTrigger>
                  
                  <SelectContent>
                    <SelectItem value="Done">Done</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Not Started">Not Started</SelectItem>
                  </SelectContent>

                </Select>

              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              
              <div className="flex flex-col gap-3">
                <Label htmlFor="target">Target</Label>
                <Input id="target" defaultValue={item.target} />
              </div>
              
              <div className="flex flex-col gap-3">
                <Label htmlFor="limit">Limit</Label>
                <Input id="limit" defaultValue={item.limit} />
              </div>

            </div>
            
            {/* / - / Reviewer / Dropdown Menu / Selection - Names */}
            <div className="flex flex-col gap-3">
              <Label htmlFor="reviewer">Reviewer</Label>
              
              {/* / - / Reviewer / Dropdown Menu / Selection - Names */}
              <Select defaultValue={item.reviewer}>
                
                {/* / - / Reviewer / Dropdown Menu / Trigger / Options - All */}
                <SelectTrigger id="reviewer" className="w-full cursor-pointer">
                  <SelectValue placeholder="Select a reviewer" />
                </SelectTrigger>

                {/* / - / Reviewer / Cell Viewer / Options - All */}
                <SelectContent>
                  
                  {/* / - / Reviewer / Dropdown Menu / Triggers / Options - #1 */}
                  <SelectItem value="Eddie Lake">Eddie Lake</SelectItem>
                  
                  {/* / - / Reviewer / Dropdown Menu / Triggers / Options - #2 */}
                  <SelectItem value="Jamik Tashpulatov">
                    Jamik Tashpulatov
                  </SelectItem>
                  
                  {/* / - / Reviewer / Dropdown Menu / Triggers / Options - #3 */}
                  <SelectItem value="Emily Whalen">Emily Whalen</SelectItem>

                </SelectContent>

              </Select>

            </div>

          </form>

        </div>
        
        <DrawerFooter>
          
          <Button className="cursor-pointer">Submit</Button>
          
          <DrawerClose asChild>
            <Button variant="outline" className="cursor-pointer">Done</Button>
          </DrawerClose>

        </DrawerFooter>

      </DrawerContent>

    </Drawer>
  )
}
