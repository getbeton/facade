import { createClient } from '@/lib/supabase/server'
import { getCheckoutSession } from '@/lib/stripe'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const sessionId = searchParams.get('session_id')

        if (!sessionId) {
            return NextResponse.json({ error: 'No session ID' }, { status: 400 })
        }

        // Get checkout session from Stripe
        const session = await getCheckoutSession(sessionId)

        if (!session || !session.payment_intent) {
            return NextResponse.json({ error: 'Invalid session' }, { status: 400 })
        }

        // Find payment record in database
        const { data: payment } = await supabase
            .from('payments')
            .select('id, status')
            .eq('stripe_checkout_session_id', sessionId)
            .eq('user_id', user.id)
            .single()

        if (!payment) {
            return NextResponse.json({ paymentId: null })
        }

        return NextResponse.json({
            paymentId: payment.id,
            status: payment.status,
        })
    } catch (error) {
        console.error('Error checking payment status:', error)
        return NextResponse.json(
            { error: 'Failed to check payment status' },
            { status: 500 }
        )
    }
}
