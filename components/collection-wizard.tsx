'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Check, Plus, X, ChevronRight, ArrowLeft } from 'lucide-react'
import { WebflowSite, WebflowCollection } from '@/lib/types'

interface CollectionWizardProps {
    onCollectionAdded: () => void
}

export function CollectionWizard({ onCollectionAdded }: CollectionWizardProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // Form Data
    const [webflowKey, setWebflowKey] = useState('')
    const [openaiKey, setOpenaiKey] = useState('')
    const [sites, setSites] = useState<WebflowSite[]>([])
    const [selectedSite, setSelectedSite] = useState<WebflowSite | null>(null)
    const [collections, setCollections] = useState<WebflowCollection[]>([])
    const [selectedCollection, setSelectedCollection] = useState<WebflowCollection | null>(null)

    const reset = () => {
        setStep(1)
        setLoading(false)
        setError('')
        setWebflowKey('')
        setOpenaiKey('')
        setSites([])
        setSelectedSite(null)
        setCollections([])
        setSelectedCollection(null)
    }

    const handleClose = () => {
        setIsOpen(false)
        reset()
    }

    // Step 1 -> 2: Fetch Sites
    const fetchSites = async () => {
        if (!webflowKey) {
            setError('Please enter your Webflow API Key')
            return
        }

        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/sites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: webflowKey })
            })
            
            if (!res.ok) throw new Error('Failed to fetch sites')
            
            const data = await res.json()
            setSites(data.sites)
            setStep(2)
        } catch (err) {
            setError('Invalid API Key or failed to fetch sites')
        } finally {
            setLoading(false)
        }
    }

    // Step 2 -> 3: Fetch Collections
    const handleSiteSelect = async (site: WebflowSite) => {
        setSelectedSite(site)
        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/webflow/collections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: webflowKey, siteId: site.id })
            })

            if (!res.ok) throw new Error('Failed to fetch collections')
            
            const data = await res.json()
            setCollections(data.collections)
            setStep(3)
        } catch (err) {
            setError('Failed to fetch collections for this site')
        } finally {
            setLoading(false)
        }
    }

    // Step 3 -> 4: Select Collection
    const handleCollectionSelect = (collection: WebflowCollection) => {
        setSelectedCollection(collection)
        setStep(4)
    }

    // Step 4 -> 5: Submit
    const handleSubmit = async () => {
        if (!openaiKey) {
            setError('Please enter your OpenAI API Key')
            return
        }

        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/collections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    siteId: selectedSite!.id,
                    siteName: selectedSite!.displayName,
                    siteShortName: selectedSite!.shortName,
                    sitePreviewUrl: selectedSite!.previewUrl,
                    siteFaviconUrl: (selectedSite as any).faviconUrl,
                    webflowCollectionId: selectedCollection!.id,
                    collectionDisplayName: selectedCollection!.displayName,
                    webflowApiKey: webflowKey,
                    openaiApiKey: openaiKey
                })
            })

            if (!res.ok) throw new Error('Failed to save collection')

            onCollectionAdded()
            handleClose()
        } catch (err) {
            setError('Failed to save collection. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) {
        return (
            <Button onClick={() => setIsOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Add New Collection
            </Button>
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="flex flex-col space-y-1.5">
                        <CardTitle>Add New Collection</CardTitle>
                        <CardDescription>Connect a Webflow collection to start generating images</CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </CardHeader>
                
                <CardContent className="pt-6">
                    {/* Progress */}
                    <div className="mb-8 flex items-center justify-between px-8">
                        {[1, 2, 3, 4].map((s) => (
                            <div key={s} className="flex flex-col items-center gap-2">
                                <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                                    s <= step ? 'border-primary bg-primary text-primary-foreground' : 'border-muted text-muted-foreground'
                                }`}>
                                    {s < step ? <Check className="h-4 w-4" /> : s}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    {s === 1 ? 'API Key' : s === 2 ? 'Site' : s === 3 ? 'Collection' : 'OpenAI'}
                                </span>
                            </div>
                        ))}
                    </div>

                    {error && (
                        <Alert variant="error" className="mb-6">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="min-h-[300px]">
                        {step === 1 && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Webflow API Key</Label>
                                    <Input 
                                        type="password" 
                                        value={webflowKey} 
                                        onChange={(e) => setWebflowKey(e.target.value)}
                                        placeholder="Enter your Webflow API Token"
                                    />
                                    <p className="text-sm text-muted-foreground">
                                        You can generate this in your Webflow Dashboard under Integrations.
                                    </p>
                                </div>
                                <div className="flex justify-end">
                                    <Button onClick={fetchSites} disabled={loading || !webflowKey}>
                                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Next: Select Site
                                        <ChevronRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label>Select a Site</Label>
                                    <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                                    </Button>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    {sites.map((site) => (
                                        <button
                                            key={site.id}
                                            onClick={() => handleSiteSelect(site)}
                                            className="flex flex-col items-start rounded-lg border p-4 text-left hover:bg-accent transition-colors"
                                            disabled={loading}
                                        >
                                            <div className="flex items-center gap-2 font-semibold">
                                                {(site as any).faviconUrl && (
                                                    <img src={(site as any).faviconUrl} alt="" className="h-4 w-4" />
                                                )}
                                                {site.displayName}
                                            </div>
                                            <span className="text-sm text-muted-foreground">{site.shortName}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label>Select a Collection</Label>
                                    <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
                                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                                    </Button>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    {collections.map((col) => (
                                        <button
                                            key={col.id}
                                            onClick={() => handleCollectionSelect(col)}
                                            className="rounded-lg border p-4 text-left hover:bg-accent transition-colors"
                                        >
                                            <div className="font-semibold">{col.displayName}</div>
                                            <span className="text-sm text-muted-foreground">{col.slug}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {step === 4 && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label>OpenAI API Key</Label>
                                    <Button variant="ghost" size="sm" onClick={() => setStep(3)}>
                                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                                    </Button>
                                </div>
                                <Input 
                                    type="password" 
                                    value={openaiKey} 
                                    onChange={(e) => setOpenaiKey(e.target.value)}
                                    placeholder="sk-..."
                                />
                                <p className="text-sm text-muted-foreground">
                                    Used to generate image prompts and descriptions.
                                </p>
                                <div className="flex justify-end mt-8">
                                    <Button onClick={handleSubmit} disabled={loading || !openaiKey}>
                                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Save Collection
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}



