'use client'

import { useEffect, useState } from 'react'
import { WebflowCollectionItem } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowLeft, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface CollectionItemsProps {
    collectionId: string
}

export function CollectionItems({ collectionId }: CollectionItemsProps) {
    const router = useRouter()
    const [items, setItems] = useState<WebflowCollectionItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        fetchItems()
    }, [collectionId])

    const fetchItems = async () => {
        try {
            setLoading(true)
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

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (error) {
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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => router.back()}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <h2 className="text-3xl font-bold tracking-tight">Collection Items</h2>
                    </div>
                    <p className="text-muted-foreground pl-12">
                        Manage items and generate images for this collection
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={fetchItems} variant="outline">
                        Refresh
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Items ({items.length})</CardTitle>
                    <CardDescription>
                        List of all items in this collection
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {items.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No items found in this collection
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Last Updated</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">
                                                {item.fieldData.name || item.fieldData['tool-name'] || 'Untitled'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    {item.isDraft && <Badge variant="secondary">Draft</Badge>}
                                                    {item.isArchived && <Badge variant="outline">Archived</Badge>}
                                                    {!item.isDraft && !item.isArchived && <Badge className="bg-green-500">Published</Badge>}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {item.lastUpdated ? new Date(item.lastUpdated).toLocaleDateString() : '-'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" variant="ghost">
                                                    View Details
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}


