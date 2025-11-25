'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, Settings, Image as ImageIcon, Loader2 } from 'lucide-react'
import { Collection, Site } from '@/lib/types'
import Link from 'next/link'

interface CollectionCardProps {
    collection: Collection & { site: Site }
    onEditKeys: () => void
}

export function CollectionCard({ collection, onEditKeys }: CollectionCardProps) {
    const [itemCount, setItemCount] = useState<number | null>(null)
    const [loadingCount, setLoadingCount] = useState(true)

    useEffect(() => {
        fetchCount()
    }, [])

    const fetchCount = async () => {
        try {
            const res = await fetch(`/api/collections/${collection.id}/count`)
            if (res.ok) {
                const data = await res.json()
                setItemCount(data.count)
            }
        } catch (err) {
            console.error('Failed to fetch count', err)
        } finally {
            setLoadingCount(false)
        }
    }

    const siteUrl = collection.site.preview_url || `https://${collection.site.short_name}.webflow.io`
    const cmsUrl = `https://webflow.com/design/${collection.site.short_name}` // Best effort deep link to designer

    return (
        <Card className="flex flex-col h-full hover:border-primary/50 transition-colors">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {collection.site.favicon_url ? (
                            <img 
                                src={collection.site.favicon_url} 
                                alt={collection.site.name} 
                                className="h-5 w-5 rounded-sm"
                            />
                        ) : (
                            <div className="h-5 w-5 rounded-sm bg-muted" />
                        )}
                        <span className="font-medium text-sm text-muted-foreground">
                            {collection.site.name}
                        </span>
                    </div>
                    <a 
                        href={siteUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary transition-colors"
                    >
                        <ExternalLink className="h-4 w-4" />
                    </a>
                </div>
            </CardHeader>
            
            <CardContent className="flex-1 pb-2">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-xl truncate" title={collection.display_name}>
                        {collection.display_name}
                    </h3>
                    <a 
                        href={cmsUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs bg-secondary px-2 py-1 rounded flex items-center gap-1 hover:bg-secondary/80 transition-colors"
                    >
                        CMS <ExternalLink className="h-3 w-3" />
                    </a>
                </div>

                <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Total Items:</span>
                    {loadingCount ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                        <Badge variant="secondary">{itemCount ?? '-'}</Badge>
                    )}
                </div>
            </CardContent>

            <CardFooter className="pt-4 border-t flex gap-2">
                <Button asChild className="flex-1" size="sm">
                    <Link href={`/collection/${collection.id}`}>
                        <ImageIcon className="mr-2 h-4 w-4" />
                        Manage Images
                    </Link>
                </Button>
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={onEditKeys}>
                    <Settings className="h-4 w-4" />
                </Button>
            </CardFooter>
        </Card>
    )
}



