import { 
    ColumnDef,
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    useReactTable,
    SortingState,
    ColumnFiltersState,
    VisibilityState,
} from "@tanstack/react-table"
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Type, Image as ImageIcon, AlignLeft, User, Link as LinkIcon, ArrowUpDown, ChevronDown, UploadCloud } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useState, useEffect, useRef, DragEvent, useMemo } from "react"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { EditableCell } from "./editable-cell"

// --- Types ---

export interface GridColumn {
    id: string;
    label: string;
    type: 'PlainText' | 'RichText' | 'Image' | 'Link' | 'User';
    isGenerated?: boolean;
}

export interface GridRow {
    id: string;
    data: Record<string, any>;
    status?: 'idle' | 'generating' | 'success' | 'error';
    selected?: boolean;
    displayId?: string; // For auto-increment ID display
}

interface ContentGridProps {
    columns: GridColumn[];
    data: GridRow[];
    onSelectionChange?: (selectedIds: string[]) => void;
    onCellEdit?: (rowId: string, columnId: string, value: any) => void;
    onImageUpload?: (rowId: string, columnId: string, file: File) => void;
    onSingleFieldGenerate?: (rowId: string, columnId: string) => void;
    onVisibleColumnsChange?: (columnIds: string[]) => void;
    slugBaseUrl?: string | null;
}

// --- Icons ---

const TypeIcon = ({ type }: { type: string }) => {
    switch (type) {
        case 'PlainText': return <Type className="w-3 h-3" />;
        case 'RichText': return <AlignLeft className="w-3 h-3" />;
        case 'Image': return <ImageIcon className="w-3 h-3" />;
        case 'Link': return <LinkIcon className="w-3 h-3" />;
        case 'User': return <User className="w-3 h-3" />;
        default: return <Type className="w-3 h-3" />;
    }
}

interface ImageCellProps {
    value: string | undefined;
    rowId: string;
    columnId: string;
    status?: GridRow['status'];
    onImageUpload?: (rowId: string, columnId: string, file: File) => void;
}

const ImageCell = ({ value, rowId, columnId, status, onImageUpload }: ImageCellProps) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = (file?: File) => {
        if (!file) return;
        if (onImageUpload) onImageUpload(rowId, columnId, file);
    };

    const onDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const file = event.dataTransfer?.files?.[0];
        handleFile(file);
    };

    const onClickEmpty = () => {
        inputRef.current?.click();
    };

    const isGenerating = status === 'generating';

    return (
        <div
            className="relative group w-12 h-12"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
        >
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {isGenerating ? (
                <div className="h-full w-full flex items-center justify-center bg-muted rounded">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
            ) : value ? (
                <div className="relative h-full w-full">
                    <img src={value} alt="" className="w-full h-full object-cover rounded border" />
                    <button
                        type="button"
                        className="absolute inset-0 bg-black/30 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] font-medium rounded"
                        onClick={() => inputRef.current?.click()}
                        title="Replace image"
                    >
                        Replace
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    className="w-full h-full bg-muted rounded border flex items-center justify-center text-[11px] text-muted-foreground gap-1"
                    onClick={onClickEmpty}
                    title="Upload image"
                >
                    <UploadCloud className="w-3 h-3" />
                    Empty
                </button>
            )}
        </div>
    );
};

// --- Components ---

export function ContentGrid({ columns, data, onSelectionChange, onCellEdit, onImageUpload, onSingleFieldGenerate, onVisibleColumnsChange, slugBaseUrl }: ContentGridProps) {
    const [rowSelection, setRowSelection] = useState({})
    const [sorting, setSorting] = useState<SortingState>([])
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 10,
    })

    // Enhanced selection handler
    const handleSelectionChange = (updaterOrValue: any) => {
        setRowSelection(updaterOrValue);
        // We defer the callback to useEffect or handle it here if we can resolve the IDs
    };
    
    // UseEffect for selection callback with correct ID resolution
    useEffect(() => {
        if (onSelectionChange) {
            // rowSelection keys are the row IDs because we set getRowId
            const selectedIds = Object.keys(rowSelection);
            onSelectionChange(selectedIds);
        }
    }, [rowSelection, onSelectionChange]);


    const labelMap = useMemo(() => {
        const map: Record<string, string> = {}
        columns.forEach(col => { map[col.id] = col.label })
        // provide a friendly label for the built-in displayId column
        map['displayId'] = map['displayId'] || 'ID'
        return map
    }, [columns])

    const toHumanLabel = (fieldId: string) => {
        if (labelMap[fieldId]) return labelMap[fieldId]
        const cleaned = fieldId.replace(/^data\./, '').replace(/[-_]/g, ' ')
        return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
    }

    const tableColumns: ColumnDef<GridRow>[] = [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
            size: 40,
        },
        // ID Column
        {
            accessorKey: "displayId", // or "id" if we want the long UUID
            header: ({ column }: { column: any }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="h-8 px-2 text-xs font-medium"
                >
                    ID
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                </Button>
            ),
            cell: ({ row }) => <div className="text-xs font-mono text-muted-foreground px-2">{row.original.displayId || row.index + 1}</div>,
            size: 60,
        },
        ...columns.map((col) => ({
            accessorKey: `data.${col.id}`,
            header: ({ column }: { column: any }) => {
                const isSorted = column.getIsSorted();
                return (
                    <div className="flex items-center gap-2">
                        <TypeIcon type={col.type} />
                        <span className="text-xs font-medium">{col.label}</span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 ml-1"
                            onClick={() => column.toggleSorting(isSorted === "asc")}
                        >
                            <ArrowUpDown className="h-3 w-3" />
                        </Button>
                    </div>
                );
            },
            cell: ({ row, getValue }: { row: { original: GridRow }, getValue: () => any }) => {
                const value = getValue() as any;
                const rowId = row.original.id;
                const status = row.original.status;

                // Render based on type
                if (col.type === 'Image') {
                    return (
                        <ImageCell
                            value={value}
                            rowId={rowId}
                            columnId={col.id}
                            status={status}
                            onImageUpload={onImageUpload}
                        />
                    );
                }

                // Check for slug column
                const isSlug = col.id.toLowerCase() === 'slug';
                const slugHref = isSlug && slugBaseUrl && value
                    ? `${slugBaseUrl.replace(/\/$/, '')}/${String(value).replace(/^\//, '')}`
                    : null;

                return (
                    <EditableCell 
                        value={value}
                        rowId={rowId}
                        columnId={col.id}
                        isReadOnly={isSlug} // Disable editing for slugs
                        linkHref={slugHref}
                        onSave={(rId, cId, val) => onCellEdit?.(rId, cId, val)}
                        onGenerate={!isSlug ? (rId, cId) => onSingleFieldGenerate?.(rId, cId) : undefined}
                    />
                )
            }
        }))
    ];

    const table = useReactTable({
        data,
        columns: tableColumns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onRowSelectionChange: handleSelectionChange,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onPaginationChange: setPagination,
        getRowId: (row) => row.id, // Use actual ID for selection
        state: {
            rowSelection,
            sorting,
            columnFilters,
            columnVisibility,
            pagination,
        },
    })

    // Surface visible data columns to parent so counts/pricing can reflect current view
    useEffect(() => {
        if (!onVisibleColumnsChange) return;
        const visibleIds = table.getAllLeafColumns()
            .filter(col => col.id.startsWith('data.') && col.getIsVisible())
            .map(col => col.id.replace('data.', ''));
        onVisibleColumnsChange(visibleIds);
    }, [columnVisibility, onVisibleColumnsChange, table]);

    return (
        <div className="space-y-4">
            {/* Controls Toolbar */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 max-w-sm">
                    <Input
                        placeholder="Search all columns..."
                        value={(table.getState().globalFilter as string) ?? ""}
                        onChange={(event) => table.setGlobalFilter(event.target.value)}
                        className="max-w-sm"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="ml-auto">
                                Columns <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {table
                                .getAllColumns()
                                .filter((column) => column.getCanHide())
                                .map((column) => {
                                    const fieldId = column.id.replace('data.', '')
                                    const humanLabel = toHumanLabel(fieldId)
                                    return (
                                        <DropdownMenuCheckboxItem
                                            key={column.id}
                                            className="capitalize"
                                            checked={column.getIsVisible()}
                                            onCheckedChange={(value) =>
                                                column.toggleVisibility(!!value)
                                            }
                                        >
                                            <div className="flex flex-col leading-tight">
                                                <span className="text-sm">{humanLabel}</span>
                                                    <span className="text-[11px] italic text-muted-foreground">{fieldId}</span>
                                            </div>
                                        </DropdownMenuCheckboxItem>
                                    )
                                })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id}>
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
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length + 2} className="h-24 text-center">
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between px-2">
                <div className="flex-1 text-sm text-muted-foreground">
                    {table.getFilteredSelectedRowModel().rows.length} of{" "}
                    {table.getFilteredRowModel().rows.length} row(s) selected.
                </div>
                <div className="flex items-center space-x-6 lg:space-x-8">
                    <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium">Rows per page</p>
                        <Select
                            value={`${table.getState().pagination.pageSize}`}
                            onValueChange={(value) => {
                                table.setPageSize(Number(value))
                            }}
                        >
                            <SelectTrigger className="h-8 w-[70px]">
                                <SelectValue>
                                    {table.getState().pagination.pageSize}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {[10, 20, 30, 40, 50, 100].map((pageSize) => (
                                    <SelectItem key={pageSize} value={`${pageSize}`}>
                                        {pageSize}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                        Page {table.getState().pagination.pageIndex + 1} of{" "}
                        {table.getPageCount()}
                    </div>
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            className="hidden h-8 w-8 p-0 lg:flex"
                            onClick={() => table.setPageIndex(0)}
                            disabled={!table.getCanPreviousPage()}
                        >
                            <span className="sr-only">Go to first page</span>
                            <span aria-hidden="true">«</span>
                        </Button>
                        <Button
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                        >
                            <span className="sr-only">Go to previous page</span>
                            <span aria-hidden="true">‹</span>
                        </Button>
                        <Button
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                        >
                            <span className="sr-only">Go to next page</span>
                            <span aria-hidden="true">›</span>
                        </Button>
                        <Button
                            variant="outline"
                            className="hidden h-8 w-8 p-0 lg:flex"
                            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                            disabled={!table.getCanNextPage()}
                        >
                            <span className="sr-only">Go to last page</span>
                            <span aria-hidden="true">»</span>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
