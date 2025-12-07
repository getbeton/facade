import { createClient } from '@/lib/supabase/server'
import { createCheckoutSession } from '@/lib/stripe'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/stripe/create-checkout
 * 
 * Creates a Stripe Checkout session for paying for image generations.
 * 
 * Request body:
 * - collectionDbId: string (our DB UUID for the collection)
 * - webflowCollectionId: string (the Webflow collection ID)
 * - itemIds: string[] (array of Webflow item IDs to generate)
 * - collectionName: string (display name for the collection)
 * 
 * Response:
 * - url: string (Stripe Checkout URL to redirect user to)
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            console.log('[create-checkout] Unauthorized - no user')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { 
            collectionDbId,         // Our DB UUID
            webflowCollectionId,    // Webflow's collection ID
            itemIds,                // Array of Webflow item IDs
            collectionName 
        } = body

        console.log(`[create-checkout] User ${user.id} requesting checkout for ${itemIds?.length || 0} items`)

        // Validation
        if (!collectionDbId || !itemIds || !Array.isArray(itemIds) || itemIds.length < 1) {
            console.log('[create-checkout] Invalid request parameters:', { collectionDbId, itemIds })
            return NextResponse.json(
                { error: 'Invalid request parameters. Required: collectionDbId, itemIds (array)' },
                { status: 400 }
            )
        }

        // Verify user owns this collection
        const { data: collection, error: collectionError } = await supabase
            .from('collections')
            .select('id, webflow_collection_id, display_name, site_id')
            .eq('id', collectionDbId)
            .eq('user_id', user.id)
            .single()

        if (collectionError || !collection) {
            console.log('[create-checkout] Collection not found or access denied:', collectionError)
            return NextResponse.json(
                { error: 'Collection not found or access denied' },
                { status: 404 }
            )
        }

        // Create Stripe checkout session with all necessary metadata
        const session = await createCheckoutSession({
            userId: user.id,
            email: user.email!,
            collectionId: webflowCollectionId || collection.webflow_collection_id,
            collectionDbId: collectionDbId,
            itemsCount: itemIds.length,
            collectionName: collectionName || collection.display_name || 'Collection',
            itemIds: itemIds,
        })

        console.log(`[create-checkout] Created session ${session.id} for ${itemIds.length} items`)

        return NextResponse.json({ url: session.url })
    } catch (error) {
        console.error('[create-checkout] Error:', error)
        return NextResponse.json(
            { error: 'Failed to create checkout session' },
            { status: 500 }
        )
    }
}
