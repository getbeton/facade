import { stripe, PRICE_PER_IMAGE_CENTS, updateUserStripeCustomerId } from '@/lib/stripe'
import Stripe from "stripe"
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'

// Use service role key for webhook handler (bypasses RLS)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder_key'
)

/**
 * POST /api/webhooks/stripe
 * 
 * Handles Stripe webhook events, primarily checkout.session.completed.
 * 
 * On successful payment:
 * 1. Creates a payment record in our database
 * 2. Creates generation_logs entries for each item (in 'pending' status)
 * 3. Updates the user's stripe_customer_id for future reference
 */
export async function POST(request: NextRequest) {
    const body = await request.text()
    const headersList = await headers()
    const signature = headersList.get('stripe-signature')

    if (!signature) {
        console.error('[webhook/stripe] No signature in request')
        return NextResponse.json({ error: 'No signature' }, { status: 400 })
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        )
    } catch (err: any) {
        console.error('[webhook/stripe] ⚠️ Signature verification failed:', err.message)
        return NextResponse.json(
            { error: `Webhook Error: ${err.message}` },
            { status: 400 }
        )
    }

    console.log(`[webhook/stripe] Received event: ${event.type}`)

    // Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session
        const paymentIntentId = session.payment_intent as string

        if (!paymentIntentId) {
            console.error('[webhook/stripe] No payment intent ID in checkout session')
            return NextResponse.json({ error: 'No payment intent' }, { status: 400 })
        }

        console.log(`[webhook/stripe] Processing payment intent: ${paymentIntentId}`)

        // ✅ IDEMPOTENCY CHECK: Prevent duplicate payment records
        const { data: existingPayment } = await supabaseAdmin
            .from('payments')
            .select('id')
            .eq('stripe_payment_intent_id', paymentIntentId)
            .single()

        if (existingPayment) {
            console.log('[webhook/stripe] ✅ Payment already processed (idempotent), skipping:', paymentIntentId)
            return NextResponse.json({ received: true })
        }

        // Extract metadata from session
        const metadata = session.metadata!
        const userId = metadata.userId
        const collectionDbId = metadata.collectionDbId || metadata.collectionId // Fallback for backwards compat
        const webflowCollectionId = metadata.collectionId
        const collectionName = metadata.collectionName
        const itemsCount = parseInt(metadata.itemsCount)
        
        // Parse itemIds from JSON string
        let itemIds: string[] = []
        if (metadata.itemIds) {
            try {
                itemIds = JSON.parse(metadata.itemIds)
            } catch (e) {
                console.error('[webhook/stripe] Failed to parse itemIds:', e)
            }
        }

        console.log(`[webhook/stripe] Metadata: userId=${userId}, collectionDbId=${collectionDbId}, itemsCount=${itemsCount}, itemIds=${itemIds.length}`)

        // Create payment record with new fields
        const { data: payment, error: paymentError } = await supabaseAdmin
            .from('payments')
            .insert({
                user_id: userId,
                stripe_payment_intent_id: paymentIntentId,
                stripe_checkout_session_id: session.id,
                amount_cents: session.amount_total!,
                collection_id: collectionDbId, // Now using our DB UUID
                collection_name: collectionName,
                items_count: itemsCount,
                status: 'pending',
                item_ids: itemIds,  // Store item IDs as JSONB
                generation_logs_count: itemIds.length,
                generation_started: false,
            })
            .select()
            .single()

        if (paymentError) {
            console.error('[webhook/stripe] ❌ Failed to create payment record:', paymentError)
            return NextResponse.json({ error: 'Database error' }, { status: 500 })
        }

        console.log('[webhook/stripe] ✅ Payment record created:', payment.id)

        // Create generation_logs entries for each item in 'pending' status
        if (itemIds.length > 0) {
            const generationLogs = itemIds.map(itemId => ({
                user_id: userId,
                collection_id: collectionDbId,
                webflow_collection_id: webflowCollectionId,
                webflow_item_id: itemId,
                payment_id: payment.id,
                status: 'pending',
                is_free_tier: false,
                uses_own_api_key: false,
                cost_cents: PRICE_PER_IMAGE_CENTS,
            }))

            const { error: logsError } = await supabaseAdmin
                .from('generation_logs')
                .insert(generationLogs)

            if (logsError) {
                console.error('[webhook/stripe] ⚠️ Failed to create generation logs:', logsError)
                // Don't fail the webhook - payment is recorded, logs can be created later
            } else {
                console.log(`[webhook/stripe] ✅ Created ${itemIds.length} generation_logs entries`)
            }
        }

        // Update user's stripe_customer_id if available
        if (session.customer) {
            const customerId = typeof session.customer === 'string' 
                ? session.customer 
                : session.customer.id
            
            await updateUserStripeCustomerId(userId, customerId)
        }
    }

    return NextResponse.json({ received: true })
}
