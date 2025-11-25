'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

interface CollectionManagementProps {
    keysValidated: boolean
}

interface Site {
    id: string
    displayName: string
    shortName: string
}

interface Collection {
    id: string
    displayName: string
    slug: string
}

/**
 * Collection Management Component
 * Displays user's Webflow sites and collections
 * Allows them to manage and generate images
 */
export function CollectionManagement({ keysValidated }: CollectionManagementProps) {
    const [sites, setSites] = useState<Site[]>([])
    const [collections, setCollections] = useState<Record<string, Collection[]>>({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [selectedSite, setSelectedSite] = useState<string | null>(null)

    useEffect(() => {
        fetchSites()
    }, [])

    /**
     * Fetch user's Webflow sites
     */
    const fetchSites = async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/sites')
            
            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || 'Failed to fetch sites')
            }

            const data = await response.json()
            setSites(data.sites || [])
            
            // Auto-select first site if available
            if (data.sites && data.sites.length > 0) {
                setSelectedSite(data.sites[0].id)
                fetchCollections(data.sites[0].id)
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load sites')
        } finally {
            setLoading(false)
        }
    }

    /**
     * Fetch collections for a specific site
     */
    const fetchCollections = async (siteId: string) => {
        try {
            const response = await fetch(`/api/collections?siteId=${siteId}`)
            
            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || 'Failed to fetch collections')
            }

            const data = await response.json()
            setCollections(prev => ({
                ...prev,
                [siteId]: data.collections || []
            }))
        } catch (err: any) {
            console.error('Failed to load collections:', err)
        }
    }

    /**
     * Handle site selection
     */
    const handleSiteSelect = async (siteId: string) => {
        setSelectedSite(siteId)
        
        // Fetch collections if not already loaded
        if (!collections[siteId]) {
            fetchCollections(siteId)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (error) {
        return (
            <Alert variant="error">
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )
    }

    if (!keysValidated) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>API Keys Not Validated</CardTitle>
                    <CardDescription>
                        Your API keys need to be validated before you can manage collections.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={() => window.location.href = '/new'}>
                        Validate API Keys
                    </Button>
                </CardContent>
            </Card>
        )
    }

    if (sites.length === 0) {
        return (
            <Alert>
                <AlertDescription>
                    No Webflow sites found. Make sure your Webflow API key has access to at least one site.
                </AlertDescription>
            </Alert>
        )
    }

    const selectedSiteData = sites.find(s => s.id === selectedSite)
    const selectedCollections = selectedSite ? collections[selectedSite] || [] : []

    return (
        <div className="space-y-6">
            {/* Validation Status */}
            <div className="flex items-center gap-2 text-sm">
                {keysValidated ? (
                    <>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-green-600 dark:text-green-400">API Keys Validated</span>
                    </>
                ) : (
                    <>
                        <XCircle className="h-4 w-4 text-yellow-500" />
                        <span className="text-yellow-600 dark:text-yellow-400">API Keys Not Validated</span>
                    </>
                )}
            </div>

            {/* Site Selection */}
            <Card>
                <CardHeader>
                    <CardTitle>Your Webflow Sites</CardTitle>
                    <CardDescription>
                        Select a site to view and manage its collections
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {sites.map((site) => (
                            <button
                                key={site.id}
                                onClick={() => handleSiteSelect(site.id)}
                                className={`p-4 rounded-lg border-2 text-left transition-all hover:border-primary ${
                                    selectedSite === site.id
                                        ? 'border-primary bg-primary/5'
                                        : 'border-border'
                                }`}
                            >
                                <h3 className="font-semibold">{site.displayName}</h3>
                                <p className="text-sm text-muted-foreground">{site.shortName}</p>
                            </button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Collections */}
            {selectedSite && (
                <Card>
                    <CardHeader>
                        <CardTitle>Collections in {selectedSiteData?.displayName}</CardTitle>
                        <CardDescription>
                            Select a collection to generate OG images for its items
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {selectedCollections.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                No collections found in this site
                            </div>
                        ) : (
                            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                                {selectedCollections.map((collection) => (
                                    <Card key={collection.id} className="hover:shadow-md transition-shadow">
                                        <CardHeader>
                                            <CardTitle className="text-base">{collection.displayName}</CardTitle>
                                            <CardDescription className="text-xs">
                                                {collection.slug}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <Button 
                                                className="w-full" 
                                                size="sm"
                                                onClick={() => window.location.href = `/collection/${collection.id}`}
                                            >
                                                Manage Images
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}


