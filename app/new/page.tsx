'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"

/**
 * New Collection Page
 * Allows users to save their Webflow and OpenAI API keys
 * Keys are encrypted and stored in the database for later use
 */
export default function NewCollectionPage() {
    const router = useRouter()
    const [webflowKey, setWebflowKey] = useState('')
    const [openaiKey, setOpenaiKey] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [validating, setValidating] = useState(false)

    /**
     * Handles saving API keys to the database
     */
    const handleSaveKeys = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setSuccess(false)
        setLoading(true)

        try {
            // Save the keys
            const saveResponse = await fetch('/api/user/keys', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    webflowApiKey: webflowKey,
                    openaiApiKey: openaiKey,
                }),
            })

            const saveData = await saveResponse.json()

            if (!saveResponse.ok) {
                throw new Error(saveData.error || 'Failed to save API keys')
            }

            setSuccess(true)
            
            // Optionally validate the keys immediately after saving
            await handleValidateKeys()
        } catch (err: any) {
            setError(err.message || 'Failed to save API keys')
        } finally {
            setLoading(false)
        }
    }

    /**
     * Validates saved API keys by testing them against their respective APIs
     */
    const handleValidateKeys = async () => {
        setValidating(true)
        setError('')

        try {
            const response = await fetch('/api/user/keys', {
                method: 'PUT',
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Validation failed')
            }

            // Redirect to dashboard after successful validation
            setTimeout(() => {
                router.push('/dashboard')
                router.refresh()
            }, 1500)
        } catch (err: any) {
            setError(err.message || 'Failed to validate API keys')
        } finally {
            setValidating(false)
        }
    }

    return (
        <div className="container mx-auto py-10 max-w-2xl">
            <Card>
                <CardHeader>
                    <CardTitle>Link API Keys</CardTitle>
                    <CardDescription>
                        Connect your Webflow site and OpenAI to start generating images.
                        Your keys will be encrypted and stored securely.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSaveKeys} className="space-y-4">
                        {error && (
                            <Alert variant="error">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        
                        {success && (
                            <Alert variant="success">
                                <AlertDescription>
                                    API keys saved successfully! Validating...
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="webflow-key">Webflow API Key</Label>
                            <Input 
                                id="webflow-key" 
                                type="password"
                                placeholder="Enter your Webflow API key" 
                                value={webflowKey}
                                onChange={(e) => setWebflowKey(e.target.value)}
                                required
                                disabled={loading || validating}
                            />
                            <p className="text-xs text-muted-foreground">
                                Get your API key from{' '}
                                <a 
                                    href="https://webflow.com/dashboard/account/integrations" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                >
                                    Webflow Account Settings
                                </a>
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="openai-key">OpenAI API Key</Label>
                            <Input 
                                id="openai-key" 
                                type="password"
                                placeholder="Enter your OpenAI API key" 
                                value={openaiKey}
                                onChange={(e) => setOpenaiKey(e.target.value)}
                                required
                                disabled={loading || validating}
                            />
                            <p className="text-xs text-muted-foreground">
                                Get your API key from{' '}
                                <a 
                                    href="https://platform.openai.com/api-keys" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                >
                                    OpenAI Platform
                                </a>
                            </p>
                        </div>

                        <Button 
                            type="submit" 
                            className="w-full" 
                            disabled={loading || validating}
                        >
                            {loading ? 'Saving...' : validating ? 'Validating...' : 'Save & Validate Keys'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
