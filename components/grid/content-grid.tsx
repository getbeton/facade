import { 
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
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
import { Badge } from "@/components/ui/badge"
import { Loader2, Type, Image as ImageIcon, AlignLeft, User, Link as LinkIcon, AlertCircle, CheckCircle2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useState, useEffect } from "react"

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
}

interface ContentGridProps {
    columns: GridColumn[];
    data: GridRow[];
    onSelectionChange?: (selectedIds: string[]) => void;
    onCellEdit?: (rowId: string, columnId: string, value: any) => void;
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

// --- Components ---

export function ContentGrid({ columns, data, onSelectionChange, onCellEdit }: ContentGridProps) {
    const [rowSelection, setRowSelection] = useState({})

    // Update selection callback
    useEffect(() => {
        if (onSelectionChange) {
            const selectedIds = Object.keys(rowSelection)
                .filter(key => rowSelection[key as keyof typeof rowSelection])
                .map(index => data[parseInt(index)]?.id)
                .filter(Boolean);
            onSelectionChange(selectedIds);
        }
    }, [rowSelection, data, onSelectionChange]);

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
        },
        ...columns.map((col) => ({
            accessorKey: `data.${col.id}`,
            header: () => (
                <div className="flex items-center gap-2">
                    <TypeIcon type={col.type} />
                    <span>{col.label}</span>
                </div>
            ),
            cell: ({ row, getValue }: { row: { original: GridRow }, getValue: () => any }) => {
                const value = getValue() as any;
                const rowId = row.original.id;
                const status = row.original.status;

                // Render based on type
                if (col.type === 'Image') {
                    if (status === 'generating') {
                        return <div className="h-10 w-10 flex items-center justify-center bg-muted rounded"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                    }
                    if (value) {
                        return (
                            <div className="relative group w-12 h-12">
                                <img src={value} alt="" className="w-full h-full object-cover rounded border" />
                            </div>
                        )
                    }
                    return <div className="w-12 h-12 bg-muted rounded border flex items-center justify-center text-xs text-muted-foreground">Empty</div>
                }

                if (col.type === 'RichText') {
                    return (
                        <div className="max-w-[300px] max-h-[60px] overflow-hidden text-xs text-muted-foreground">
                            {value || <span className="italic opacity-50">Empty</span>}
                        </div>
                    )
                }

                // Default text input
                return (
                    <Input 
                        className="h-8 text-sm border-transparent hover:border-input focus:border-input bg-transparent" 
                        value={value || ''} 
                        onChange={(e) => onCellEdit?.(rowId, col.id, e.target.value)}
                    />
                )
            }
        }))
    ];

    const table = useReactTable({
        data,
        columns: tableColumns,
        getCoreRowModel: getCoreRowModel(),
        onRowSelectionChange: setRowSelection,
        state: {
            rowSelection,
        },
    })

    return (
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
                            <TableCell colSpan={columns.length + 1} className="h-24 text-center">
                                No results.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    )
}

