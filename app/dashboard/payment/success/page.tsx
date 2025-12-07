'use client'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress, ProgressTrack, ProgressIndicator } from '@/components/ui/progress'
import { CheckCircle, XCircle, Loader2, Sparkles } from 'lucide-react'

// Payment status from API
interface PaymentStatus {
    paymentId: string
    status: string
    collectionId: string
    collectionName: string
    itemsCount: number
    itemIds: string[]
    generationStarted: boolean
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
}

function PaymentSuccessContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const sessionId = searchParams.get('session_id')

    // Payment verification state
    const [paymentStatus, setPaymentStatus] = useState<'checking' | 'verified' | 'error'>('checking')
    const [payment, setPayment] = useState<PaymentStatus | null>(null)
    const [verificationError, setVerificationError] = useState('')

    // Generation state
    const [generationState, setGenerationState] = useState<'idle' | 'generating' | 'complete' | 'error'>('idle')
    const [generationProgress, setGenerationProgress] = useState(0)
    const [generationTotal, setGenerationTotal] = useState(0)
    const [generationMessage, setGenerationMessage] = useState('')
    const [currentItem, setCurrentItem] = useState('')
    const [completedCount, setCompletedCount] = useState(0)
    const [failedCount, setFailedCount] = useState(0)

    // Start image generation using the payment
    const startGeneration = useCallback(async (paymentData: PaymentStatus) => {
        if (generationState !== 'idle') return
        
        console.log('[PaymentSuccess] Starting generation for payment:', paymentData.paymentId)
        setGenerationState('generating')
        setGenerationTotal(paymentData.itemsCount)
        setGenerationMessage('Starting generation...')

        try {
            const response = await fetch('/api/generate-images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    collectionId: paymentData.collectionId,
                    itemIds: paymentData.itemIds,
                    paymentId: paymentData.paymentId
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
                        
                        if (message.currentItem) {
                            setCurrentItem(message.currentItem)
                        }
                        
                        if (message.progress !== undefined) {
                            setGenerationProgress(message.progress)
                        }
                        
                        if (message.total !== undefined) {
                            setGenerationTotal(message.total)
                        }

                        if (message.status === 'success') {
                            setCompletedCount(message.completedCount || 0)
                            setFailedCount(message.failedCount || 0)
                            setGenerationState('complete')
                        } else if (message.status === 'error' && !message.progress) {
                            // Fatal error (not per-item error)
                            setGenerationState('error')
                        }
                    } catch (e) {
                        // Ignore JSON parse errors for incomplete chunks
                    }
                }
            }
        } catch (err: any) {
            console.error('[PaymentSuccess] Generation error:', err)
            setGenerationState('error')
            setGenerationMessage(err.message || 'Generation failed')
        }
    }, [generationState])

    // Poll for payment confirmation and auto-start generation
    useEffect(() => {
        if (!sessionId) {
            setPaymentStatus('error')
            setVerificationError('No session ID provided')
            return
        }

        let attempts = 0
        const maxAttempts = 15 // 30 seconds max
        let cancelled = false

        const checkPayment = async (): Promise<PaymentStatus | null> => {
            try {
                const res = await fetch(`/api/payment-status?session_id=${sessionId}`)
                const data = await res.json()

                if (data.paymentId) {
                    return data as PaymentStatus
                }
                return null
            } catch (err) {
                console.error('Error checking payment:', err)
                return null
            }
        }

        const pollPayment = async () => {
            if (cancelled) return

            const paymentData = await checkPayment()
            
            if (paymentData) {
                setPayment(paymentData)
                setPaymentStatus('verified')
                
                // Auto-start generation if not already started
                if (!paymentData.generationStarted) {
                    startGeneration(paymentData)
                } else {
                    // Generation already started (maybe from another tab)
                    setGenerationState('complete')
                    setGenerationMessage('Generation was already triggered')
                }
                return
            }

            attempts++
            if (attempts < maxAttempts) {
                setTimeout(pollPayment, 2000)
            } else {
                setPaymentStatus('error')
                setVerificationError('Payment confirmation timeout. Please check your payment history.')
            }
        }

        pollPayment()

        return () => {
            cancelled = true
        }
    }, [sessionId, startGeneration])

    // Render progress percentage
    const progressPercent = generationTotal > 0 
        ? (generationProgress / generationTotal) * 100 
        : 0

    // Checking payment state
    if (paymentStatus === 'checking') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Confirming Payment...
                        </CardTitle>
                        <CardDescription>
                            Please wait while we verify your payment
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Payment verification error
    if (paymentStatus === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-destructive">
                            <XCircle className="h-5 w-5" />
                            Payment Error
                        </CardTitle>
                        <CardDescription>There was an issue confirming your payment</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Alert variant="error">
                            <AlertDescription>{verificationError}</AlertDescription>
                        </Alert>
                        <Button onClick={() => router.push('/dashboard')} className="w-full">
                            Return to Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Payment verified - show generation status
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
            <Card className="w-full max-w-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        {generationState === 'complete' ? (
                            <>
                                <CheckCircle className="h-5 w-5 text-green-500" />
                                Generation Complete!
                            </>
                        ) : generationState === 'error' ? (
                            <>
                                <XCircle className="h-5 w-5 text-destructive" />
                                Generation Error
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                                Generating Images...
                            </>
                        )}
                    </CardTitle>
                    <CardDescription>
                        {payment?.collectionName || 'Your collection'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Progress bar */}
                    <div className="space-y-2">
                        <Progress value={progressPercent}>
                            <ProgressTrack>
                                <ProgressIndicator />
                            </ProgressTrack>
                        </Progress>
                        <div className="flex justify-between text-sm text-muted-foreground">
                            <span>{generationProgress} / {generationTotal} items</span>
                            <span>{Math.round(progressPercent)}%</span>
                        </div>
                    </div>

                    {/* Current status message */}
                    <div className="text-center">
                        <p className="text-sm text-muted-foreground">{generationMessage}</p>
                        {currentItem && generationState === 'generating' && (
                            <p className="text-sm mt-1">
                                Processing: <span className="font-medium">{currentItem}</span>
                            </p>
                        )}
                    </div>

                    {/* Completion stats */}
                    {generationState === 'complete' && (
                        <Alert>
                            <AlertDescription>
                                <div className="flex justify-center gap-6 text-center">
                                    <div>
                                        <div className="text-2xl font-bold text-green-500">{completedCount}</div>
                                        <div className="text-xs text-muted-foreground">Completed</div>
                                    </div>
                                    {failedCount > 0 && (
                                        <div>
                                            <div className="text-2xl font-bold text-destructive">{failedCount}</div>
                                            <div className="text-xs text-muted-foreground">Failed</div>
                                        </div>
                                    )}
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                        {generationState === 'complete' && payment?.collectionId && (
                            <Button 
                                onClick={() => router.push(`/collection/${payment.collectionId}`)}
                                className="w-full"
                            >
                                View Collection
                            </Button>
                        )}
                        <Button 
                            onClick={() => router.push('/dashboard')} 
                            variant={generationState === 'complete' ? 'outline' : 'default'}
                            className="w-full"
                        >
                            Go to Dashboard
                        </Button>
                    </div>

                    {/* Payment ID */}
                    {payment?.paymentId && (
                        <p className="text-xs text-muted-foreground text-center">
                            Payment ID: {payment.paymentId}
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

export default function PaymentSuccessPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Loading...</CardTitle>
                        <CardDescription>Please wait</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        }>
            <PaymentSuccessContent />
        </Suspense>
    )
}
