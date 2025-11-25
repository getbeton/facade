import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'

// Use service role key for webhook handler (bypasses RLS)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
    const body = await request.text()
    const headersList = await headers()
    const signature = headersList.get('stripe-signature')

    if (!signature) {
        return NextResponse.json({ error: 'No signature' }, { status: 400 })
    }

    let event: Stripe.Event

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        )
    } catch (err: any) {
        console.error('⚠️ Webhook signature verification failed:', err.message)
        return NextResponse.json(
            { error: `Webhook Error: ${err.message}` },
            { status: 400 }
        )
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session
        const paymentIntentId = session.payment_intent as string

        if (!paymentIntentId) {
            console.error('No payment intent ID in checkout session')
            return NextResponse.json({ error: 'No payment intent' }, { status: 400 })
        }

        // ✅ IDEMPOTENCY CHECK: Prevent duplicate payment records
        const { data: existingPayment } = await supabaseAdmin
            .from('payments')
            .select('id')
            .eq('stripe_payment_intent_id', paymentIntentId)
            .single()

        if (existingPayment) {
            console.log('✅ Payment already processed (idempotent), skipping:', paymentIntentId)
            return NextResponse.json({ received: true })
        }

        // Create payment record
        const { data: payment, error } = await supabaseAdmin
            .from('payments')
            .insert({
                user_id: session.metadata!.userId,
                stripe_payment_intent_id: paymentIntentId,
                stripe_checkout_session_id: session.id,
                amount_cents: session.amount_total!,
                collection_id: session.metadata!.collectionId,
                collection_name: session.metadata!.collectionName,
                items_count: parseInt(session.metadata!.itemsCount),
                status: 'pending',
            })
            .select()
            .single()

        if (error) {
            console.error('❌ Failed to create payment record:', error)
            return NextResponse.json({ error: 'Database error' }, { status: 500 })
        }

        console.log('✅ Payment record created:', payment.id)

        // Note: In the simplified MVP, we're NOT auto-triggering generation here
        // The user will manually trigger it after seeing payment success
        // This simplifies error handling and gives users control
    }

    return NextResponse.json({ received: true })
}
