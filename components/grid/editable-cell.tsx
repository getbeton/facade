"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Wand2, Link2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface EditableCellProps {
    value: string;
    rowId: string;
    columnId: string;
    isReadOnly?: boolean;
    linkHref?: string | null;
    openInNewTab?: boolean;
    onSave: (rowId: string, columnId: string, value: string) => void;
    onGenerate?: (rowId: string, columnId: string) => void;
}

export function EditableCell({ 
    value: initialValue, 
    rowId, 
    columnId, 
    isReadOnly = false,
    linkHref,
    openInNewTab = true,
    onSave,
    onGenerate 
}: EditableCellProps) {
    const [value, setValue] = useState(initialValue || "")
    const [isEditing, setIsEditing] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    // Sync internal state with prop changes, but only when not editing to avoid conflicts
    useEffect(() => {
        if (!isEditing) {
            setValue(initialValue || "")
        }
    }, [initialValue, isEditing])

    const handleBlur = () => {
        setIsEditing(false);
        if (value !== initialValue) {
            onSave(rowId, columnId, value);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            inputRef.current?.blur();
        }
        if (e.key === 'Escape') {
            setValue(initialValue || ""); // Revert
            setIsEditing(false);
            inputRef.current?.blur();
        }
    };

    if (isReadOnly) {
        const href = linkHref && value ? linkHref : null;
        const content = value || <span className="italic opacity-50">Empty</span>;

        if (href) {
            return (
                <a
                    href={href}
                    target={openInNewTab ? "_blank" : undefined}
                    rel="noreferrer"
                    className="px-2 py-1 text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                    <Link2 className="h-3 w-3" />
                    <span className="truncate">{content}</span>
                </a>
            )
        }

        return (
            <div className="px-2 py-1 text-sm text-muted-foreground truncate opacity-80 cursor-not-allowed">
                {content}
            </div>
        )
    }

    return (
        <div className="relative group w-full flex items-center">
            <Input 
                ref={inputRef}
                className={cn(
                    "h-8 text-sm bg-transparent px-2 shadow-none rounded-sm w-full transition-all pr-8",
                    isEditing 
                        ? "border-input ring-1 ring-ring" 
                        : "border-transparent hover:bg-muted/50 focus:bg-background"
                )}
                value={value}
                placeholder="" // Empty state = empty input
                onChange={(e) => setValue(e.target.value)}
                onFocus={() => setIsEditing(true)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
            />
            {onGenerate && (
                <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                        "absolute right-0 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity",
                        isEditing && "opacity-100"
                    )}
                    onMouseDown={(e) => {
                        e.preventDefault(); // Prevent input blur
                        onGenerate(rowId, columnId);
                    }}
                    title="Generate content for this field"
                >
                    <Wand2 className="h-3 w-3 text-muted-foreground" />
                </Button>
            )}
        </div>
    )
}


