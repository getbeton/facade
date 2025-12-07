import { createClient } from '@/lib/supabase/server'
import { getCheckoutSession } from '@/lib/stripe'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/payment-status
 * 
 * Checks the status of a payment after Stripe checkout completion.
 * Returns payment details including collectionId and itemIds for auto-generation.
 * 
 * Query params:
 * - session_id: Stripe Checkout Session ID
 * 
 * Response:
 * - paymentId: Our DB payment ID
 * - status: Payment status (pending, processing, completed, etc.)
 * - collectionId: Our DB collection UUID (for redirecting to generation)
 * - itemIds: Array of Webflow item IDs to generate
 * - collectionName: Display name of the collection
 * - itemsCount: Number of items in this payment
 * - generationStarted: Whether generation has already been triggered
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            console.log('[payment-status] Unauthorized - no user')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const sessionId = searchParams.get('session_id')

        if (!sessionId) {
            console.log('[payment-status] No session ID provided')
            return NextResponse.json({ error: 'No session ID' }, { status: 400 })
        }

        console.log(`[payment-status] Checking session: ${sessionId}`)

        // Get checkout session from Stripe to verify
        const session = await getCheckoutSession(sessionId)

        if (!session || !session.payment_intent) {
            console.log('[payment-status] Invalid Stripe session')
            return NextResponse.json({ error: 'Invalid session' }, { status: 400 })
        }

        // Find payment record in database with full details
        const { data: payment, error: paymentError } = await supabase
            .from('payments')
            .select('id, status, collection_id, collection_name, items_count, item_ids, generation_started')
            .eq('stripe_checkout_session_id', sessionId)
            .eq('user_id', user.id)
            .single()

        if (paymentError || !payment) {
            console.log('[payment-status] Payment not found in DB yet')
            // Payment might not be created yet by webhook - return null for polling
            return NextResponse.json({ paymentId: null })
        }

        console.log(`[payment-status] Found payment: ${payment.id}, status: ${payment.status}, generationStarted: ${payment.generation_started}`)

        return NextResponse.json({
            paymentId: payment.id,
            status: payment.status,
            collectionId: payment.collection_id,      // Our DB UUID
            collectionName: payment.collection_name,
            itemsCount: payment.items_count,
            itemIds: payment.item_ids || [],          // Array of Webflow item IDs
            generationStarted: payment.generation_started || false,
        })
    } catch (error) {
        console.error('[payment-status] Error:', error)
        return NextResponse.json(
            { error: 'Failed to check payment status' },
            { status: 500 }
        )
    }
}
