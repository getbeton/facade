'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

function PaymentSuccessContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const sessionId = searchParams.get('session_id')

    const [status, setStatus] = useState<'checking' | 'success' | 'error'>('checking')
    const [paymentId, setPaymentId] = useState<string | null>(null)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!sessionId) {
            setStatus('error')
            setError('No session ID provided')
            return
        }

        // Poll for payment record creation (webhook might take a few seconds)
        let attempts = 0
        const maxAttempts = 15 // 30 seconds max

        const checkPayment = async () => {
            try {
                const res = await fetch(`/api/payment-status?session_id=${sessionId}`)
                const data = await res.json()

                if (data.paymentId) {
                    setPaymentId(data.paymentId)
                    setStatus('success')
                    return true
                }

                return false
            } catch (err) {
                console.error('Error checking payment:', err)
                return false
            }
        }

        const pollPayment = async () => {
            const found = await checkPayment()
            if (found) return

            attempts++
            if (attempts < maxAttempts) {
                setTimeout(pollPayment, 2000) // Check every 2 seconds
            } else {
                setStatus('error')
                setError('Payment confirmation timeout. Please check your payment history.')
            }
        }

        pollPayment()
    }, [sessionId])

    if (status === 'checking') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Processing Payment...</CardTitle>
                        <CardDescription>
                            Please wait while we confirm your payment
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

    if (status === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Payment Error</CardTitle>
                        <CardDescription>There was an issue confirming your payment</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Alert variant="error">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                        <Button onClick={() => router.push('/dashboard')} className="w-full">
                            Return to Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>✅ Payment Successful!</CardTitle>
                    <CardDescription>Your payment has been confirmed</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert>
                        <AlertDescription>
                            Your payment was successful. You can now proceed to generate images.
                        </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                        <Button onClick={() => router.push('/dashboard')} className="w-full">
                            Go to Dashboard
                        </Button>
                    </div>

                    {paymentId && (
                        <p className="text-xs text-muted-foreground text-center">
                            Payment ID: {paymentId}
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
