'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, X, Trash2 } from 'lucide-react'
import { Collection } from '@/lib/types'

interface EditCollectionDialogProps {
    collection: Collection | null
    isOpen: boolean
    onClose: () => void
    onUpdate: () => void
}

export function EditCollectionDialog({ collection, isOpen, onClose, onUpdate }: EditCollectionDialogProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [displayName, setDisplayName] = useState(collection?.display_name || '')
    const [webflowKey, setWebflowKey] = useState('')
    const [openaiKey, setOpenaiKey] = useState('')

    if (!isOpen || !collection) return null

    const handleUpdate = async () => {
        setLoading(true)
        setError('')
        try {
            const res = await fetch(`/api/collections/${collection.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    displayName: displayName !== collection.display_name ? displayName : undefined,
                    webflowApiKey: webflowKey || undefined,
                    openaiApiKey: openaiKey || undefined
                })
            })

            if (!res.ok) throw new Error('Failed to update collection')

            onUpdate()
            onClose()
        } catch (err) {
            setError('Failed to update collection')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this collection? This action cannot be undone.')) return

        setLoading(true)
        setError('')
        try {
            const res = await fetch(`/api/collections/${collection.id}`, {
                method: 'DELETE'
            })

            if (!res.ok) throw new Error('Failed to delete collection')

            onUpdate()
            onClose()
        } catch (err) {
            setError('Failed to delete collection')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <Card className="w-full max-w-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="flex flex-col space-y-1.5">
                        <CardTitle>Edit Collection</CardTitle>
                        <CardDescription>Update settings for {collection.display_name}</CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </CardHeader>
                
                <CardContent className="pt-6 space-y-4">
                    {error && (
                        <Alert variant="error">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-2">
                        <Label>Display Name</Label>
                        <Input 
                            value={displayName} 
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder={collection.display_name}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>New Webflow API Key (Optional)</Label>
                        <Input 
                            type="password" 
                            value={webflowKey} 
                            onChange={(e) => setWebflowKey(e.target.value)}
                            placeholder="Leave empty to keep current key"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>New OpenAI API Key (Optional)</Label>
                        <Input 
                            type="password" 
                            value={openaiKey} 
                            onChange={(e) => setOpenaiKey(e.target.value)}
                            placeholder="Leave empty to keep current key"
                        />
                    </div>

                    <div className="flex justify-between pt-4">
                        <Button variant="destructive" size="sm" onClick={handleDelete} disabled={loading}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Collection
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
                            <Button onClick={handleUpdate} disabled={loading}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Save Changes
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}



