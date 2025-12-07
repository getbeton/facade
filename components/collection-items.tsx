'use client'

import { useEffect, useState, useCallback } from 'react'
import { WebflowCollectionItem, BillingCheckResponse, GenerationStatus } from '@/lib/types'
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

// Generation stream message type
interface StreamMessage {
    status: 'processing' | 'success' | 'error'
    message?: string
    currentItem?: string
    progress?: number
    total?: number
    completedCount?: number
    failedCount?: number
    freeTierUsed?: number
    billingMode?: string
}

import { SeoReview } from '@/components/seo-review'

export function CollectionItems({ collectionId }: CollectionItemsProps) {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState<'images' | 'seo'>('images')
    
    // Item data state
    const [items, setItems] = useState<WebflowCollectionItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    
    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    
    // Billing state
    const [billingStatus, setBillingStatus] = useState<BillingCheckResponse | null>(null)
    const [checkingBilling, setCheckingBilling] = useState(false)
    
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
            setCheckingBilling(true)
            const response = await fetch('/api/billing/check-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    collectionId,
                    itemCount: selectedIds.size
                })
            })

            if (!response.ok) {
                throw new Error('Failed to check billing status')
            }

            const data: BillingCheckResponse = await response.json()
            setBillingStatus(data)
        } catch (err: any) {
            console.error('Billing check error:', err)
            setError(err.message || 'Failed to check billing status')
        } finally {
            setCheckingBilling(false)
        }
    }

    // Compute field count (text fields, excluding slug and images)
    const computeFieldCounts = () => {
        const textColumns = gridColumns.filter(col => col.type !== 'Image' && col.id.toLowerCase() !== 'slug')
        const selectedCount = selectedIds.size
        const fieldCount = selectedCount * textColumns.length
        const mode: 'byok' | 'paid' = billingStatus?.reason === 'own_api_key' ? 'byok' : 'paid'
        return { selectedCount, fieldCount, mode }
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

        if (billingStatus?.requiresPayment) {
            await startCheckout()
            setConfirmProcessing(false)
            return
        }

        await startGeneration()
        setConfirmProcessing(false)
        setConfirmOpen(false)
    }

    // Start Stripe checkout for paid items
    const startCheckout = async () => {
        try {
            setGenerationStatus({ status: 'processing', progress: 0, total: 0 })
            setGenerationMessage('Redirecting to payment...')

            const response = await fetch('/api/stripe/create-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    collectionDbId: collectionId,
                    itemIds: Array.from(selectedIds),
                    collectionName: 'Collection' // Could fetch actual name
                })
            })

            if (!response.ok) {
                throw new Error('Failed to create checkout session')
            }

            const data = await response.json()
            if (data.url) {
                window.location.href = data.url
            }
        } catch (err: any) {
            console.error('Checkout error:', err)
            setGenerationStatus({ status: 'error', progress: 0, total: 0 })
            setGenerationMessage(err.message || 'Failed to start checkout')
        }
    }

    // Start image generation (free tier or own API key)
    const startGeneration = async (paymentId?: string) => {
        try {
            setGenerationStatus({ status: 'processing', progress: 0, total: selectedIds.size })
            setGenerationMessage('Starting generation...')

            const response = await fetch('/api/generate-images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    collectionId,
                    itemIds: Array.from(selectedIds),
                    paymentId
                })
            })

            if (!response.ok) {
                throw new Error('Failed to start generation')
            }

            // Handle streaming response
            const reader = response.body?.getReader()
            const decoder = new TextDecoder()

            if (!reader) {
                throw new Error('No response stream')
            }

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value)
                const lines = chunk.split('\n').filter(Boolean)

                for (const line of lines) {
                    try {
                        const message: StreamMessage = JSON.parse(line)
                        
                        setGenerationMessage(message.message || '')
                        
                        if (message.progress !== undefined && message.total !== undefined) {
                            setGenerationStatus(prev => ({
                                ...prev,
                                status: message.status === 'error' ? 'error' : 'processing',
                                progress: message.progress!,
                                total: message.total!,
                                currentItem: message.currentItem
                            }))
                        }

                        if (message.status === 'success') {
                            setGenerationStatus({
                                status: 'success',
                                progress: message.total || selectedIds.size,
                                total: message.total || selectedIds.size
                            })
                            // Refresh items after successful generation
                            await fetchItems()
                            // Clear selection
                            setSelectedIds(new Set())
                            setBillingStatus(null)
                        }
                    } catch (e) {
                        // Ignore JSON parse errors for incomplete chunks
                    }
                }
            }
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

    // Transform items for grid
    const gridData: GridRow[] = items.map((item, index) => ({
        id: item.id,
        displayId: String(index + 1), // Simple auto-increment for display
        data: item.fieldData,
        status: 'idle', // You might want to track item-specific status if needed
    }));

    // Generate columns from item data keys (simple inference)
    // Ideally this comes from schema or a defined config
    const inferColumns = (): GridColumn[] => {
        if (items.length === 0) return [];
        const sample = items[0].fieldData;
        return Object.keys(sample).map(key => ({
            id: key,
            label: key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, ' '),
            type: key.toLowerCase().includes('image') ? 'Image' : 'PlainText' // Simple heuristic
        }));
    };

    const gridColumns = inferColumns();

    const handleSelectionChange = (ids: string[]) => {
        setSelectedIds(new Set(ids));
        setBillingStatus(null);
    }

    const handleCellEdit = (rowId: string, columnId: string, value: string) => {
        // Don't allow editing slug
        if (columnId.toLowerCase() === 'slug') return
        setItems((prev) =>
            prev.map((item) =>
                item.id === rowId
                    ? { ...item, fieldData: { ...item.fieldData, [columnId]: value } }
                    : item
            )
        )
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
                    {selectedIds.size > 0 && !isGenerating && (
                        <Card>
                            <CardContent className="flex items-center justify-between py-4">
                                <div className="flex items-center gap-4">
                                    <span className="font-medium">{selectedIds.size} items selected</span>
                                    {renderBillingBadge()}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button 
                                        variant="outline" 
                                        onClick={() => {
                                            setSelectedIds(new Set())
                                            setBillingStatus(null)
                                        }}
                                    >
                                        Clear Selection
                                    </Button>
                                    <Button 
                                        onClick={openConfirm}
                                        disabled={checkingBilling}
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
                pricePerField={0.01}
                isProcessing={confirmProcessing}
            />
        </div>
    )
}
