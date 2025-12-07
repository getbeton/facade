"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogOverlay,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type Mode = "byok" | "paid"

interface GenerationDialogProps {
  open: boolean
  mode: Mode
  selectedCount: number
  fieldCount: number
  pricePerField?: number // only relevant for paid mode
  onConfirm: () => void
  onCancel: () => void
  isProcessing?: boolean
}

export function GenerationDialog({
  open,
  mode,
  selectedCount,
  fieldCount,
  pricePerField = 0.01,
  onConfirm,
  onCancel,
  isProcessing = false,
}: GenerationDialogProps) {
  const totalCost = mode === "paid" ? (fieldCount * pricePerField) : 0

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onCancel() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Confirm generation
          </DialogTitle>
          <DialogDescription>
            {mode === "byok"
              ? `You are about to generate ${fieldCount} text fields across ${selectedCount} item(s) using your own API key.`
              : `You are about to generate ${fieldCount} text fields across ${selectedCount} item(s).`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span>Items selected</span>
            <Badge variant="outline">{selectedCount}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Text fields to generate (excluding slugs)</span>
            <Badge variant="secondary">{fieldCount}</Badge>
          </div>
          {mode === "paid" && (
            <div className="flex items-center justify-between">
              <span>Cost</span>
              <Badge className="bg-green-600 hover:bg-green-700">
                ${totalCost.toFixed(2)}
              </Badge>
            </div>
          )}
          {mode === "byok" && (
            <p className="text-xs text-muted-foreground">
              This will use your own OpenAI API key. Charges apply to your key usage.
            </p>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onCancel} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isProcessing}>
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "paid" ? "Proceed to checkout" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

