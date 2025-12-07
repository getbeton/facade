'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Loader2, Check, X, Edit, RotateCcw } from 'lucide-react'

interface Suggestion {
    id: string
    original_value: string
    suggested_value: string
    status: 'pending' | 'approved' | 'rejected'
    review_notes: string
    generation: {
        field_name: string
        webflow_item_id: string
    }
}

interface SeoReviewProps {
    collectionId: string
}

export function SeoReview({ collectionId }: SeoReviewProps) {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([])
    const [loading, setLoading] = useState(true)
    const [processingId, setProcessingId] = useState<string | null>(null)

    const fetchSuggestions = async () => {
        try {
            setLoading(true)
            const res = await fetch(`/api/seo/suggestions?collectionId=${collectionId}`)
            const data = await res.json()
            if (data.suggestions) {
                setSuggestions(data.suggestions)
            }
        } catch (error) {
            console.error('Failed to fetch suggestions', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchSuggestions()
    }, [collectionId])

    const handleApply = async (suggestionId: string) => {
        try {
            setProcessingId(suggestionId)
            const res = await fetch('/api/seo/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ suggestionId })
            })
            
            if (!res.ok) throw new Error('Failed to apply')

            // Refresh local state
            setSuggestions(prev => prev.map(s => 
                s.id === suggestionId ? { ...s, status: 'approved' } : s
            ))

        } catch (error) {
            console.error('Failed to apply suggestion', error)
        } finally {
            setProcessingId(null)
        }
    }

    const handleReject = async (suggestionId: string) => {
         try {
            setProcessingId(suggestionId)
            const res = await fetch(`/api/seo/suggestions/${suggestionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'rejected' })
            })
            
            if (!res.ok) throw new Error('Failed to reject')

            // Refresh local state
            setSuggestions(prev => prev.map(s => 
                s.id === suggestionId ? { ...s, status: 'rejected' } : s
            ))

        } catch (error) {
            console.error(error)
        } finally {
            setProcessingId(null)
        }
    }

    if (loading) {
         return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (suggestions.length === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <p>No SEO suggestions found.</p>
                    <p className="text-sm mt-2">Run the SEO audit script to generate suggestions.</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>SEO Audit Results</CardTitle>
                <CardDescription>Review and apply AI-generated SEO improvements</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Field</TableHead>
                            <TableHead>Original</TableHead>
                            <TableHead>Suggested</TableHead>
                            <TableHead>Reasoning</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {suggestions.map((suggestion) => (
                            <TableRow key={suggestion.id}>
                                <TableCell className="font-medium">{suggestion.generation.field_name}</TableCell>
                                <TableCell className="max-w-[200px] truncate" title={suggestion.original_value}>
                                    {suggestion.original_value || <span className="text-muted-foreground italic">Empty</span>}
                                </TableCell>
                                <TableCell className="max-w-[300px]">
                                    <div className="font-medium">{suggestion.suggested_value}</div>
                                </TableCell>
                                <TableCell className="max-w-[200px] text-xs text-muted-foreground">
                                    {suggestion.review_notes}
                                </TableCell>
                                <TableCell>
                                    <Badge variant={
                                        suggestion.status === 'approved' ? 'default' :
                                        suggestion.status === 'rejected' ? 'destructive' : 'secondary'
                                    }>
                                        {suggestion.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        {suggestion.status === 'pending' && (
                                            <>
                                                <Button 
                                                    size="icon" 
                                                    variant="outline" 
                                                    className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                    onClick={() => handleApply(suggestion.id)}
                                                    disabled={!!processingId}
                                                >
                                                    {processingId === suggestion.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                                </Button>
                                                <Button 
                                                    size="icon" 
                                                    variant="outline" 
                                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleReject(suggestion.id)}
                                                    disabled={!!processingId}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </>
                                        )}
                                        {suggestion.status !== 'pending' && (
                                            <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                onClick={() => {
                                                    // Allow undoing status to pending
                                                    handleReject(suggestion.id) // This actually sets to rejected, we might want a way to reset to pending
                                                    // For now, let's just leave it.
                                                }}
                                                disabled
                                            >
                                                {suggestion.status === 'approved' ? 'Applied' : 'Rejected'}
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}

