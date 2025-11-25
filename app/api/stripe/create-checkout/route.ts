import { createClient } from '@/lib/supabase/server'
import { createCheckoutSession } from '@/lib/stripe'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { collectionId, itemsCount, collectionName } = await request.json()

        // Validation
        if (!collectionId || !itemsCount || itemsCount < 1) {
            return NextResponse.json(
                { error: 'Invalid request parameters' },
                { status: 400 }
            )
        }

        // Create Stripe checkout session
        const session = await createCheckoutSession({
            userId: user.id,
            email: user.email!,
            collectionId,
            itemsCount,
            collectionName: collectionName || 'Collection',
        })

        return NextResponse.json({ url: session.url })
    } catch (error) {
        console.error('Error creating checkout session:', error)
        return NextResponse.json(
            { error: 'Failed to create checkout session' },
            { status: 500 }
        )
    }
}
