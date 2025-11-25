'use client'

import { useEffect, useState } from 'react'
import { CollectionWizard } from '@/components/collection-wizard'
import { CollectionCard } from '@/components/collection-card'
import { EditCollectionDialog } from '@/components/edit-collection-dialog'
import { Collection, Site } from '@/lib/types'
import { Loader2, Plus } from 'lucide-react'
import { Button } from './ui/button'

export function DashboardCollections() {
    const [collections, setCollections] = useState<(Collection & { site: Site })[]>([])
    const [loading, setLoading] = useState(true)
    const [editingCollection, setEditingCollection] = useState<(Collection & { site: Site }) | null>(null)

    useEffect(() => {
        fetchCollections()
    }, [])

    const fetchCollections = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/collections')
            if (res.ok) {
                const data = await res.json()
                setCollections(data.collections)
            }
        } catch (err) {
            console.error('Failed to load collections', err)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Your Collections</h2>
                    <p className="text-muted-foreground">
                        Manage your Webflow collections and generate images
                    </p>
                </div>
                <CollectionWizard onCollectionAdded={fetchCollections} />
            </div>

            {collections.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
                    <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                            <Plus className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="mt-4 text-lg font-semibold">No collections added</h3>
                        <p className="mb-4 mt-2 text-sm text-muted-foreground">
                            Connect a Webflow collection to start generating OG images.
                        </p>
                        <CollectionWizard onCollectionAdded={fetchCollections} />
                    </div>
                </div>
            ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {collections.map((collection) => (
                        <CollectionCard 
                            key={collection.id} 
                            collection={collection} 
                            onEditKeys={() => setEditingCollection(collection)}
                        />
                    ))}
                </div>
            )}

            <EditCollectionDialog 
                collection={editingCollection} 
                isOpen={!!editingCollection} 
                onClose={() => setEditingCollection(null)} 
                onUpdate={fetchCollections}
            />
        </div>
    )
}


