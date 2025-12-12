'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { WebflowCollectionItem, BillingCheckResponse, GenerationStatus, FreeTierStatus, PublishLink, PublishStreamEvent } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress, ProgressTrack, ProgressIndicator } from '@/components/ui/progress'
import { Loader2, ArrowLeft, Sparkles, CreditCard, Zap, CheckCircle2, AlertTriangle, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Badge } from "@/components/ui/badge"
import { ContentGrid, GridColumn, GridRow } from '@/components/grid/content-grid'
import { GenerationDialog } from '@/components/generation-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface CollectionItemsProps {
    collectionId: string
}

import { SeoReview } from '@/components/seo-review'

type StagedField =
    | { kind: 'text'; value: string }
    | { kind: 'image'; value: string; fileName?: string }

type PublishSummary = {
    publicationId: string
    totalItems: number
    totalFields: number
    itemsSucceeded: number
    itemsFailed: number
    fieldsSucceeded: number
    fieldsFailed: number
    status: 'completed' | 'partial' | 'failed'
    links: PublishLink[]
}

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
    const [publishConfirmOpen, setPublishConfirmOpen] = useState(false)
    const [publishStats, setPublishStats] = useState<{ items: number; fields: number }>({ items: 0, fields: 0 })
    const [publishResults, setPublishResults] = useState<PublishSummary | null>(null)
    const [activeOperation, setActiveOperation] = useState<'generate' | 'publish' | null>(null)
    const [toastMessage, setToastMessage] = useState<string | null>(null)
    const [siteInfo, setSiteInfo] = useState<{ shortName?: string | null; previewUrl?: string | null; primaryDomain?: string | null; webflowDomain?: string | null; siteId?: string | null } | null>(null)
    const [collectionMeta, setCollectionMeta] = useState<{ urlBase: string | null; collectionSlug: string | null; webflowCollectionId: string | null; siteId: string | null } | null>(null)

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
            setActiveOperation('generate')
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
        } finally {
            setActiveOperation(null)
        }
    }

    // Track how many fields are currently staged so we can enable publish even after selection is cleared
    const stagedFieldCount = useMemo(() => {
        return Object.values(stagedChanges).reduce((count, fields) => count + Object.keys(fields || {}).length, 0)
    }, [stagedChanges])
    const hasStagedChanges = useMemo(() => Object.keys(stagedChanges).length > 0, [stagedChanges])

    // Count how many staged rows/fields will be published so we can show it in the confirmation.
    const computePublishStats = useCallback(() => {
        const entries = Object.entries(stagedChanges)
        const fields = entries.reduce((count, [, fields]) => count + Object.keys(fields || {}).length, 0)
        return { items: entries.length, fields }
    }, [stagedChanges])

    // Pass slugs/names down to the API for logging and link building.
    const buildItemsMeta = useCallback(() => {
        const meta: Record<string, { slug?: string | null; name?: string | null }> = {}
        Object.keys(stagedChanges).forEach((itemId) => {
            const item = items.find((i) => i.id === itemId)
            if (item) {
                meta[itemId] = {
                    slug: (item.fieldData as any)?.slug || (item.fieldData as any)?.Slug || null,
                    name: (item.fieldData as any)?.name || (item.fieldData as any)?.Name || null,
                }
            }
        })
        return meta
    }, [items, stagedChanges])

    // Apply already-published fields to the UI and clear them from the staged queue.
    const applyPublishedFields = useCallback((itemId: string, appliedFields: string[]) => {
        if (appliedFields.length === 0) return
        setItems((prev) =>
            prev.map((item) => {
                if (item.id !== itemId) return item
                const staged = stagedChanges[itemId] || {}
                const updatedFieldData = { ...item.fieldData }
                appliedFields.forEach((fieldName) => {
                    const field = staged[fieldName]
                    if (field) {
                        updatedFieldData[fieldName] = field.value
                    }
                })
                return { ...item, fieldData: updatedFieldData }
            })
        )
        setStagedChanges((prev) => {
            const next = { ...prev }
            const staged = next[itemId] || {}
            const remaining = Object.keys(staged).filter((fieldName) => !appliedFields.includes(fieldName))
            if (remaining.length === 0) {
                delete next[itemId]
            } else {
                const kept: Record<string, StagedField> = {}
                remaining.forEach((fieldName) => {
                    kept[fieldName] = staged[fieldName]
                })
                next[itemId] = kept
            }
            return next
        })
    }, [stagedChanges])

    const startPublishJob = async () => {
        if (!hasStagedChanges) return
        const stats = computePublishStats()
        if (stats.items === 0) return

        console.log('[collection-items] publish start', { items: stats.items, fields: stats.fields })
        setActiveOperation('publish')
        setGenerationStatus({ status: 'processing', progress: 0, total: stats.items })
        setGenerationMessage('Publishing staged changes to Webflow...')
        setPublishConfirmOpen(false)
        setPublishResults(null)

        try {
            // Fire the publish request as a stream so we get per-item progress.
            const response = await fetch('/api/items/publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    collectionId,
                    changes: stagedChanges,
                    itemsMeta: buildItemsMeta(),
                }),
            })

            if (!response.ok) {
                const data = await response.json().catch(() => ({}))
                throw new Error(data.error || 'Publish failed')
            }

            const reader = response.body?.getReader()
            if (!reader) {
                throw new Error('No response stream from publish endpoint')
            }

            const decoder = new TextDecoder()
            let buffer = ''
            let processed = 0

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const parts = buffer.split('\n')
                buffer = parts.pop() || ''

                for (const part of parts) {
                    if (!part.trim()) continue
                    const event = JSON.parse(part) as PublishStreamEvent

                    if (event.type === 'started') {
                        setGenerationStatus({ status: 'processing', progress: 0, total: event.totalItems })
                        setGenerationMessage(event.message || 'Publishing items...')
                    }

                    if (event.type === 'item') {
                        processed += 1
                        if (event.status === 'succeeded') {
                            applyPublishedFields(event.itemId, event.appliedFields || [])
                        }
                        setGenerationStatus({ status: 'processing', progress: processed, total: stats.items })
                        setGenerationMessage(event.message || `Publishing item ${processed}/${stats.items}`)
                    }

                    if (event.type === 'completed') {
                        const summary: PublishSummary = {
                            publicationId: event.publicationId,
                            totalItems: event.totalItems,
                            totalFields: event.totalFields,
                            itemsSucceeded: event.itemsSucceeded,
                            itemsFailed: event.itemsFailed,
                            fieldsSucceeded: event.fieldsSucceeded,
                            fieldsFailed: event.fieldsFailed,
                            status: event.status,
                            links: event.links || [],
                        }
                        setPublishResults(summary)
                        setGenerationStatus({
                            status: event.itemsFailed > 0 ? 'error' : 'success',
                            progress: event.totalItems,
                            total: event.totalItems,
                        })
                        setGenerationMessage(event.message || 'Publish finished')
                        setToastMessage(event.itemsFailed > 0 ? 'Publish finished with some errors' : 'Published successfully')
                    }

                    if (event.type === 'error') {
                        setGenerationStatus({ status: 'error', progress: 0, total: 0 })
                        setGenerationMessage(event.message)
                    }
                }
            }
        } catch (err: any) {
            console.error('Publish error:', err)
            setGenerationStatus({ status: 'error', progress: 0, total: 0 })
            setGenerationMessage(err?.message || 'Publish failed')
        } finally {
            setActiveOperation(null)
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
            setSiteInfo(data.site || null)
            setCollectionMeta(data.collection || null)
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

    const openPublishConfirm = () => {
        const stats = computePublishStats()
        if (stats.items === 0) return
        setPublishStats(stats)
        setPublishConfirmOpen(true)
    }

    const handleConfirmPublish = async () => {
        await startPublishJob()
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
            setActiveOperation('generate')
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
        } finally {
            setActiveOperation(null)
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
            label: key.toLowerCase() === 'slug'
                ? 'URL'
                : key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, ' '),
            type: key.toLowerCase() === 'slug'
                ? 'Link'
                : key.toLowerCase().includes('image') ? 'Image' : 'PlainText' // Simple heuristic
        }));
    };

    const gridColumns = inferColumns();

    const generationColumns = useMemo(() => {
        const base = gridColumns.filter(col => col.id.toLowerCase() !== 'slug');
        if (visibleColumns.length === 0) return base;
        return base.filter(col => visibleColumns.includes(col.id));
    }, [gridColumns, visibleColumns]);

    const slugBaseUrl = useMemo(() => {
        const normalizedBase = collectionMeta?.urlBase?.replace(/\/$/, '');
        if (normalizedBase) return normalizedBase;

        const domain =
            siteInfo?.primaryDomain ||
            siteInfo?.previewUrl ||
            (siteInfo?.webflowDomain ? `https://${siteInfo.webflowDomain}` : null) ||
            (siteInfo?.shortName ? `https://${siteInfo.shortName}.webflow.io` : null);

        if (domain && collectionMeta?.collectionSlug) {
            return `${domain.replace(/\/$/, '')}/${collectionMeta.collectionSlug.replace(/^\//, '')}`;
        }

        return domain ? domain.replace(/\/$/, '') : null;
    }, [collectionMeta, siteInfo]);

    const buildItemUrl = useCallback(
        (slug?: string | null) => {
            if (!slugBaseUrl || !slug) return null;
            return `${slugBaseUrl.replace(/\/$/, '')}/${String(slug).replace(/^\//, '')}`;
        },
        [slugBaseUrl]
    );

    const webflowCollectionAdminUrl = useMemo(() => {
        if (collectionMeta?.siteId && collectionMeta.webflowCollectionId) {
            return `https://webflow.com/dashboard/sites/${collectionMeta.siteId}/collections/${collectionMeta.webflowCollectionId}`;
        }
        return null;
    }, [collectionMeta]);

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
    const displayOperation = activeOperation || (publishResults ? 'publish' : null)
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
    const canPublish = hasStagedChanges
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
                                    {isGenerating
                                        ? displayOperation === 'publish'
                                            ? 'Publishing to Webflow...'
                                            : 'Generating Images...'
                                        : generationStatus.status === 'success'
                                            ? displayOperation === 'publish'
                                                ? 'Publish Complete'
                                                : 'Generation Complete'
                                            : 'Operation Error'}
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

                    {publishResults && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    Publish summary
                                </CardTitle>
                                <div className="flex items-center gap-2">
                                    <CardDescription>Job {publishResults.publicationId}</CardDescription>
                                    <Badge variant={publishResults.status === 'failed' ? 'destructive' : 'secondary'}>
                                        {publishResults.status === 'completed'
                                            ? 'Success'
                                            : publishResults.status === 'partial'
                                                ? 'Partial'
                                                : 'Failed'}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                                    Publishing here updates CMS items only. Webflow site republish is not triggered—confirm changes inside Webflow when you are ready to go live.
                                    {webflowCollectionAdminUrl && (
                                        <div className="mt-1">
                                            <a href={webflowCollectionAdminUrl} target="_blank" rel="noreferrer" className="underline">
                                                Open this collection in Webflow
                                            </a>
                                        </div>
                                    )}
                                </div>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Metric</TableHead>
                                            <TableHead>Success</TableHead>
                                            <TableHead>Failed</TableHead>
                                            <TableHead>Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow>
                                            <TableCell>Items</TableCell>
                                            <TableCell>{publishResults.itemsSucceeded}</TableCell>
                                            <TableCell>{publishResults.itemsFailed}</TableCell>
                                            <TableCell>{publishResults.totalItems}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell>Fields</TableCell>
                                            <TableCell>{publishResults.fieldsSucceeded}</TableCell>
                                            <TableCell>{publishResults.fieldsFailed}</TableCell>
                                            <TableCell>{publishResults.totalFields}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                                <div className="space-y-2">
                                    <p className="text-sm font-medium">Updated pages</p>
                                    {publishResults.links.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No item links returned.</p>
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            {publishResults.links.map((link) => {
                                                const derivedUrl = link.url || buildItemUrl(link.slug)
                                                return (
                                                    <div key={link.itemId} className="flex items-center justify-between rounded border p-2">
                                                        <div>
                                                            <p className="text-sm font-medium">{link.slug || link.itemId}</p>
                                                            {derivedUrl ? (
                                                                <a
                                                                    href={derivedUrl}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="text-sm text-primary underline"
                                                                >
                                                                    Open page
                                                                </a>
                                                            ) : (
                                                                <p className="text-xs text-muted-foreground">No URL available</p>
                                                            )}
                                                        </div>
                                                        <Badge variant={link.status === 'succeeded' ? 'secondary' : 'destructive'}>
                                                            {link.status === 'succeeded' ? 'Success' : 'Failed'}
                                                        </Badge>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
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
                                        onClick={openPublishConfirm}
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
                                    slugBaseUrl={slugBaseUrl}
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
            <Dialog open={publishConfirmOpen} onOpenChange={setPublishConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Publish staged changes</DialogTitle>
                        <DialogDescription>
                            {publishStats.items} row{publishStats.items === 1 ? '' : 's'} · {publishStats.fields} field{publishStats.fields === 1 ? '' : 's'} will be updated.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 text-sm">
                        <p>You are about to push all staged edits to Webflow.</p>
                        <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                            <li>This action is final and cannot be undone.</li>
                            <li>The job keeps running even if you close this dialog.</li>
                            <li>Partial failures do not cancel other rows; we log everything.</li>
                        </ul>
                    </div>
                    <DialogFooter className="pt-4">
                        <Button variant="outline" onClick={() => setPublishConfirmOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleConfirmPublish} disabled={isGenerating}>
                            {isGenerating ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Publishing...
                                </>
                            ) : (
                                'Publish now'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {toastMessage && (
                <div className="fixed bottom-4 right-4 z-50">
                    <div className="flex items-start gap-3 rounded-lg border bg-background p-3 shadow-lg">
                        {publishResults && publishResults.status !== 'completed' ? (
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                        ) : (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                        )}
                        <div className="space-y-1">
                            <p className="text-sm font-medium">Publish complete</p>
                            <p className="text-xs text-muted-foreground">{toastMessage}</p>
                        </div>
                        <button
                            aria-label="Close toast"
                            onClick={() => setToastMessage(null)}
                            className="ml-2 text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
