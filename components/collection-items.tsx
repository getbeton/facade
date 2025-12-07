'use client'

import { useEffect, useState, useMemo } from 'react'
import { WebflowCollectionItem, BillingCheckResponse, GenerationStatus, FreeTierStatus } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress, ProgressTrack, ProgressIndicator } from '@/components/ui/progress'
import { Loader2, ArrowLeft, Sparkles, CreditCard, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Badge } from "@/components/ui/badge"
import { ContentGrid, GridColumn, GridRow } from '@/components/grid/content-grid'
import { GenerationDialog } from '@/components/generation-dialog'

interface CollectionItemsProps {
    collectionId: string
}

import { SeoReview } from '@/components/seo-review'

type StagedField =
    | { kind: 'text'; value: string }
    | { kind: 'image'; value: string; fileName?: string }

export function CollectionItems({ collectionId }: CollectionItemsProps) {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState<'images' | 'seo'>('images')
    
    // Item data state
    const [items, setItems] = useState<WebflowCollectionItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [stagedChanges, setStagedChanges] = useState<Record<string, Record<string, StagedField>>>({})
    
    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [visibleColumns, setVisibleColumns] = useState<string[]>([])
    
    // Billing state
    const [billingStatus, setBillingStatus] = useState<BillingCheckResponse | null>(null)
    const [checkingBilling, setCheckingBilling] = useState(false)
    const [freeStatus, setFreeStatus] = useState<FreeTierStatus | null>(null)
    
    // Generation state
    const [generationStatus, setGenerationStatus] = useState<GenerationStatus>({
        status: 'idle',
        progress: 0,
        total: 0
    })
    const [generationMessage, setGenerationMessage] = useState('')
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [confirmStats, setConfirmStats] = useState<{ selectedCount: number; fieldCount: number; mode: 'byok' | 'paid'; }>({
        selectedCount: 0,
        fieldCount: 0,
        mode: 'paid',
    })
    const [confirmProcessing, setConfirmProcessing] = useState(false)

    // Fetch items on mount
    useEffect(() => {
        fetchItems()
    }, [collectionId])

    const setStagedField = (itemId: string, fieldName: string, field: StagedField) => {
        setStagedChanges((prev) => {
            const next = { ...prev }
            const itemFields = { ...(next[itemId] || {}) }
            itemFields[fieldName] = field
            next[itemId] = itemFields
            return next
        })
    }

    // Inline single-field generation for quick fills
    const handleSingleFieldGenerate = async (rowId: string, columnId: string) => {
        try {
            const column = gridColumns.find(c => c.id === columnId)
            if (!column) return
            const item = mergedItems.find(i => i.id === rowId)
            if (!item) return

            console.log('[collection-items] single field generate', { rowId, columnId })
            setGenerationStatus({ status: 'processing', progress: 0, total: 1 })
            setGenerationMessage(`Generating ${column.label}...`)

            const response = await fetch('/api/fields/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    collectionId,
                    items: [{ id: rowId, fieldData: item.fieldData }],
                    fields: [columnId],
                    columnTypes: { [columnId]: column.type },
                    visibleColumnsCount: generationColumns.length || 1
                })
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || 'Generation failed')
            }

            const data = await response.json()
            const result = data.results?.[0]
            if (result?.value) {
                const kind: 'text' | 'image' = result.kind === 'image' ? 'image' : 'text'
                setStagedField(rowId, columnId, { kind, value: result.value })
            }

            if (data.freeUsed) {
                const limit = freeStatus?.limit ?? Math.max((generationColumns.length || 1) * 5, 0)
                const used = (freeStatus?.used || 0) + data.freeUsed
                setFreeStatus({
                    used,
                    remaining: Math.max(0, limit - used),
                    limit
                })
            }

            setGenerationStatus({ status: 'success', progress: 1, total: 1 })
            setGenerationMessage('Generated. Remember to publish to push changes.')
        } catch (err: any) {
            console.error('Single field generation error:', err)
            setGenerationStatus({ status: 'error', progress: 0, total: 0 })
            setGenerationMessage(err.message || 'Generation failed')
        }
    }

    // Track how many fields are currently staged so we can enable publish even after selection is cleared
    const stagedFieldCount = useMemo(() => {
        return Object.values(stagedChanges).reduce((count, fields) => count + Object.keys(fields || {}).length, 0)
    }, [stagedChanges])
    const hasStagedChanges = useMemo(() => Object.keys(stagedChanges).length > 0, [stagedChanges])

    const handlePublish = async () => {
        if (!hasStagedChanges) return
        try {
            console.log('[collection-items] publish start', { changes: Object.keys(stagedChanges).length })
            setGenerationStatus({ status: 'processing', progress: 0, total: Object.keys(stagedChanges).length })
            setGenerationMessage('Publishing to Webflow...')

            const response = await fetch('/api/items/publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    collectionId,
                    changes: stagedChanges
                })
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || 'Publish failed')
            }

            const result = await response.json()

            // Apply staged changes to local items so UI reflects published data
            setItems((prev) =>
                prev.map((item) => {
                    const pending = stagedChanges[item.id]
                    if (!pending) return item
                    const updatedFieldData = { ...item.fieldData }
                    Object.entries(pending).forEach(([field, data]) => {
                        updatedFieldData[field] = data.value
                    })
                    return { ...item, fieldData: updatedFieldData }
                })
            )

            setStagedChanges({})
            setGenerationStatus({ status: 'success', progress: result.success || 0, total: result.success || 0 })
            setGenerationMessage('Published to Webflow successfully.')
        } catch (err: any) {
            console.error('Publish error:', err)
            setGenerationStatus({ status: 'error', progress: 0, total: 0 })
            setGenerationMessage(err.message || 'Publish failed')
        }
    }

    // Fetch collection items from API
    const fetchItems = async () => {
        try {
            setLoading(true)
            setError('')
            const response = await fetch(`/api/items?collectionId=${collectionId}`)

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || 'Failed to fetch items')
            }

            const data = await response.json()
            setItems(data.items || [])
            setStagedChanges({})
            setSelectedIds(new Set())
            setBillingStatus(null)
            setFreeStatus(null)
        } catch (err: any) {
            setError(err.message || 'Failed to load items')
        } finally {
            setLoading(false)
        }
    }

    // Check billing status for selected items
    const checkBillingStatus = async () => {
        if (selectedIds.size === 0) return

        try {
            console.log('[collection-items] checking billing status')
            const { fieldCount } = computeFieldCounts()
            if (fieldCount === 0) return

            setCheckingBilling(true)
            const response = await fetch('/api/billing/check-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    collectionId,
                    fieldCount,
                    visibleColumnsCount: generationColumns.length || 1
                })
            })

            if (!response.ok) {
                throw new Error('Failed to check billing status')
            }

            const data: BillingCheckResponse = await response.json()
            setBillingStatus(data)
            if (data.remainingFreeGenerations !== undefined) {
                const limit = Math.max((generationColumns.length || 1) * 5, data.remainingFreeGenerations + (data.freeItemsCount || 0))
                setFreeStatus({
                    used: Math.max(0, limit - (data.remainingAfterGeneration ?? data.remainingFreeGenerations)),
                    remaining: data.remainingFreeGenerations,
                    limit
                })
            }
        } catch (err: any) {
            console.error('Billing check error:', err)
            setError(err.message || 'Failed to check billing status')
        } finally {
            setCheckingBilling(false)
        }
    }

    // Compute field count based on visible, non-slug columns
    const computeFieldCounts = () => {
        const selectedCount = selectedIds.size;
        const fieldCount = selectedCount * generationColumns.length;
        const mode: 'byok' | 'paid' = billingStatus?.reason === 'own_api_key'
            ? 'byok'
            : (billingStatus?.requiresPayment ? 'paid' : 'byok');
        return { selectedCount, fieldCount, mode };
    }

    const openConfirm = async () => {
        if (selectedIds.size === 0) return
        // ensure billing status fetched to know mode if possible
        if (!billingStatus) {
            await checkBillingStatus()
        }
        const stats = computeFieldCounts()
        setConfirmStats(stats)
        setConfirmOpen(true)
    }

    const handleConfirmGenerate = async () => {
        setConfirmProcessing(true)
        // First check billing status (again in case not fetched)
        if (!billingStatus) {
            await checkBillingStatus()
        }

        await startGeneration()
        setConfirmProcessing(false)
        setConfirmOpen(false)
    }

    // Start field generation (text + images) without publishing
    const startGeneration = async () => {
        const { fieldCount } = computeFieldCounts()
        if (fieldCount === 0) return
        try {
            console.log('[collection-items] startGeneration', { fieldCount })
            setGenerationStatus({ status: 'processing', progress: 0, total: fieldCount })
            setGenerationMessage('Generating fields...')

            const selectedItems = mergedItems.filter(item => selectedIds.has(item.id)).map(item => ({
                id: item.id,
                fieldData: item.fieldData
            }))

            const columnTypes = generationColumns.reduce<Record<string, GridColumn['type']>>((acc, col) => {
                acc[col.id] = col.type
                return acc
            }, {})

            const response = await fetch('/api/fields/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    collectionId,
                    items: selectedItems,
                    fields: generationColumns.map(c => c.id),
                    columnTypes,
                    visibleColumnsCount: generationColumns.length || 1
                })
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || 'Failed to start generation')
            }

            const data = await response.json()
            let completed = 0
            data.results.forEach((res: any) => {
                if (res.value) {
                    const kind: 'text' | 'image' = res.kind === 'image' ? 'image' : 'text'
                    setStagedField(res.itemId, res.fieldName, { kind, value: res.value })
                }
                completed += 1
            })

            if (data.freeUsed) {
                const limit = freeStatus?.limit ?? Math.max((generationColumns.length || 1) * 5, 0)
                const used = (freeStatus?.used || 0) + data.freeUsed
                setFreeStatus({
                    used,
                    remaining: Math.max(0, limit - used),
                    limit
                })
            }

            setGenerationStatus({
                status: 'success',
                progress: completed,
                total: fieldCount
            })
            setGenerationMessage('Generation complete. Review and publish to push changes to Webflow.')
            setSelectedIds(new Set())
            setBillingStatus(null)
        } catch (err: any) {
            console.error('Generation error:', err)
            setGenerationStatus({ status: 'error', progress: 0, total: 0 })
            setGenerationMessage(err.message || 'Generation failed')
        }
    }

    // Render billing badge
    const renderBillingBadge = () => {
        if (!billingStatus) return null

        if (billingStatus.reason === 'own_api_key') {
            return (
                <Badge className="bg-green-500 text-white">
                    <Zap className="h-3 w-3 mr-1" />
                    Using your API key - Free
                </Badge>
            )
        }

        if (billingStatus.reason === 'free_tier') {
            return (
                <Badge className="bg-blue-500 text-white">
                    <Sparkles className="h-3 w-3 mr-1" />
                    {billingStatus.remainingFreeGenerations} free generations remaining
                </Badge>
            )
        }

        if (billingStatus.requiresPayment) {
            const amount = ((billingStatus.amountCents || 0) / 100).toFixed(2)
            return (
                <Badge variant="secondary">
                    <CreditCard className="h-3 w-3 mr-1" />
                    {billingStatus.freeItemsCount || 0} free + {billingStatus.itemsToCharge} paid (${amount})
                </Badge>
            )
        }

        return null
    }

    // Merge staged changes into displayed data so edits/generation remain local until publish
    const mergedItems = useMemo(() => {
        return items.map((item) => {
            const staged = stagedChanges[item.id] || {};
            const mergedFieldData = { ...item.fieldData };
            Object.entries(staged).forEach(([field, data]) => {
                mergedFieldData[field] = data.value;
            });
            return { ...item, fieldData: mergedFieldData };
        });
    }, [items, stagedChanges]);

    // Transform items for grid
    const gridData: GridRow[] = mergedItems.map((item, index) => ({
        id: item.id,
        displayId: String(index + 1), // Simple auto-increment for display
        data: item.fieldData,
        status: 'idle', // You might want to track item-specific status if needed
    }));

    // Generate columns from item data keys (simple inference)
    // Ideally this comes from schema or a defined config
    const inferColumns = (): GridColumn[] => {
        if (mergedItems.length === 0) return [];
        const keys = new Set<string>();
        mergedItems.forEach(item => {
            Object.keys(item.fieldData).forEach(k => keys.add(k));
        });
        return Array.from(keys).map(key => ({
            id: key,
            label: key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, ' '),
            type: key.toLowerCase().includes('image') ? 'Image' : 'PlainText' // Simple heuristic
        }));
    };

    const gridColumns = inferColumns();

    const generationColumns = useMemo(() => {
        const base = gridColumns.filter(col => col.id.toLowerCase() !== 'slug');
        if (visibleColumns.length === 0) return base;
        return base.filter(col => visibleColumns.includes(col.id));
    }, [gridColumns, visibleColumns]);

    const handleSelectionChange = (ids: string[]) => {
        setSelectedIds(new Set(ids));
        setBillingStatus(null);
    }

    const handleVisibleColumnsChange = (cols: string[]) => {
        setVisibleColumns(cols);
    }

    const handleImageUpload = (rowId: string, columnId: string, file: File) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            setStagedField(rowId, columnId, { kind: 'image', value: dataUrl, fileName: file.name });
        };
        reader.readAsDataURL(file);
    };

    const handleCellEdit = (rowId: string, columnId: string, value: string) => {
        if (columnId.toLowerCase() === 'slug') return
        setStagedField(rowId, columnId, { kind: 'text', value })
    }

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    // Error state
    if (error && items.length === 0) {
        return (
            <div className="space-y-4">
                <Button variant="outline" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Dashboard
                </Button>
                <Card className="border-destructive/50">
                    <CardHeader>
                        <CardTitle className="text-destructive">Error</CardTitle>
                        <CardDescription>{error}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={fetchItems}>Try Again</Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const isGenerating = generationStatus.status === 'processing'
    const progressPercent = generationStatus.total > 0 
        ? (generationStatus.progress / generationStatus.total) * 100 
        : 0
    // Surface summary + button availability when rows are selected or staged edits exist
    const selectedFieldCount = computeFieldCounts().fieldCount
    const actionSummaryParts: string[] = []
    if (selectedIds.size > 0) {
        actionSummaryParts.push(`${selectedIds.size} items selected · ${selectedFieldCount} fields`)
    }
    if (stagedFieldCount > 0) {
        actionSummaryParts.push(`${stagedFieldCount} staged field${stagedFieldCount === 1 ? '' : 's'}`)
    }
    const actionSummary = actionSummaryParts.join(' · ') || 'No selection yet'
    const canPublish = hasStagedChanges || selectedIds.size > 0
    const showSelectionActions = (selectedIds.size > 0 || hasStagedChanges) && !isGenerating

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => router.back()}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <h2 className="text-3xl font-bold tracking-tight">Collection Items</h2>
                    </div>
                    <p className="text-muted-foreground pl-12">
                        Manage your collection items
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-lg border p-1 bg-muted">
                        <Button 
                            variant={activeTab === 'images' ? 'secondary' : 'ghost'} 
                            size="sm"
                            onClick={() => setActiveTab('images')}
                            className="h-8"
                        >
                            Image Generation
                        </Button>
                        <Button 
                            variant={activeTab === 'seo' ? 'secondary' : 'ghost'} 
                            size="sm"
                            onClick={() => setActiveTab('seo')}
                            className="h-8"
                        >
                            SEO Audit
                        </Button>
                    </div>
                    <Button onClick={fetchItems} variant="outline" disabled={isGenerating}>
                        Refresh
                    </Button>
                </div>
            </div>

            {activeTab === 'seo' ? (
                <SeoReview collectionId={collectionId} />
            ) : (
                <div className="space-y-6">
                    {/* Generation Progress */}
                    {(isGenerating || generationStatus.status === 'success' || generationStatus.status === 'error') && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg">
                                    {isGenerating ? 'Generating Images...' : 
                                     generationStatus.status === 'success' ? 'Generation Complete' : 'Generation Error'}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Progress value={progressPercent}>
                                    <ProgressTrack>
                                        <ProgressIndicator />
                                    </ProgressTrack>
                                </Progress>
                                <p className="text-sm text-muted-foreground">
                                    {generationMessage || `${generationStatus.progress} / ${generationStatus.total} items`}
                                </p>
                                {generationStatus.currentItem && isGenerating && (
                                    <p className="text-sm">
                                        Current: <span className="font-medium">{generationStatus.currentItem}</span>
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Selection Actions */}
                    {showSelectionActions && (
                        <Card>
                            <CardContent className="flex items-center justify-between py-4">
                                <div className="flex items-center gap-4 flex-wrap">
                                    <span className="font-medium">{actionSummary}</span>
                                    {renderBillingBadge()}
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Button 
                                        variant="outline" 
                                        onClick={() => {
                                            setSelectedIds(new Set())
                                            setBillingStatus(null)
                                        }}
                                        disabled={selectedIds.size === 0}
                                    >
                                        Clear Selection
                                    </Button>
                                    <Button 
                                        variant="secondary"
                                        onClick={handlePublish}
                                        disabled={!canPublish || isGenerating}
                                    >
                                        Publish
                                    </Button>
                                    <Button 
                                        onClick={openConfirm}
                                        disabled={selectedIds.size === 0 || checkingBilling}
                                    >
                                        {checkingBilling ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Checking...
                                            </>
                                        ) : billingStatus?.requiresPayment ? (
                                            <>
                                                <CreditCard className="mr-2 h-4 w-4" />
                                                Pay & Generate
                                            </>
                                        ) : billingStatus ? (
                                            <>
                                                <Sparkles className="mr-2 h-4 w-4" />
                                                Generate Images
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="mr-2 h-4 w-4" />
                                                Check & Generate
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Items Grid */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Items ({items.length})</CardTitle>
                                    <CardDescription>
                                        Select items to generate images
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {items.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    No items found in this collection
                                </div>
                            ) : (
                                <ContentGrid 
                                    columns={gridColumns}
                                    data={gridData}
                                    onSelectionChange={handleSelectionChange}
                                    onCellEdit={handleCellEdit}
                                    onImageUpload={handleImageUpload}
                                    onSingleFieldGenerate={handleSingleFieldGenerate}
                                    onVisibleColumnsChange={handleVisibleColumnsChange}
                                />
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            <GenerationDialog
                open={confirmOpen}
                onCancel={() => setConfirmOpen(false)}
                onConfirm={handleConfirmGenerate}
                mode={confirmStats.mode}
                selectedCount={confirmStats.selectedCount}
                fieldCount={confirmStats.fieldCount}
                pricePerField={billingStatus?.pricePerImageCents ? (billingStatus.pricePerImageCents / 100) : 0.01}
                isProcessing={confirmProcessing}
            />
        </div>
    )
}
