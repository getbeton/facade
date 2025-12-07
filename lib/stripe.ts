import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { FreeTierStatus } from './types'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder'

if (!process.env.STRIPE_SECRET_KEY && process.env.NODE_ENV === 'production') {
    console.warn('STRIPE_SECRET_KEY is not set in production environment')
}

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2024-12-18.acacia' as any, // Force version to avoid type error with different SDK versions
    typescript: true,
})

// Pricing constants
export const PRICE_PER_IMAGE_CENTS = 89 // $0.89 per image
export const FREE_TIER_LIMIT = 5 // 5 free generations for users without their own API key

// Supabase admin client for server-side operations (bypasses RLS)
const getSupabaseAdmin = () => {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
        process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder_key'
    )
}

/**
 * Get the user's free tier status (how many free generations used/remaining)
 * @param userId - The user's UUID from auth
 * @returns FreeTierStatus object with used, remaining, and limit counts
 */
export async function getUserFreeTierStatus(userId: string): Promise<FreeTierStatus> {
    const supabase = getSupabaseAdmin()
    
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('free_generations_used')
        .eq('id', userId)
        .single()
    
    if (error) {
        console.error('[getUserFreeTierStatus] Error fetching profile:', error)
        // Default to 0 used if we can't fetch (new user case)
        return { used: 0, remaining: FREE_TIER_LIMIT, limit: FREE_TIER_LIMIT }
    }
    
    const used = profile?.free_generations_used || 0
    const remaining = Math.max(0, FREE_TIER_LIMIT - used)
    
    console.log(`[getUserFreeTierStatus] User ${userId}: used=${used}, remaining=${remaining}`)
    
    return { used, remaining, limit: FREE_TIER_LIMIT }
}

/**
 * Increment the user's free tier usage count
 * @param userId - The user's UUID from auth
 * @param count - Number of free generations used in this batch
 * @returns Updated free tier status
 */
export async function incrementFreeTierUsage(userId: string, count: number): Promise<FreeTierStatus> {
    const supabase = getSupabaseAdmin()
    
    // First get current usage
    const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('free_generations_used')
        .eq('id', userId)
        .single()
    
    if (fetchError) {
        console.error('[incrementFreeTierUsage] Error fetching profile:', fetchError)
        throw new Error('Failed to fetch user profile')
    }
    
    const currentUsed = profile?.free_generations_used || 0
    const newUsed = Math.min(currentUsed + count, FREE_TIER_LIMIT) // Cap at limit
    
    // Update the count
    const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
            free_generations_used: newUsed,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId)
    
    if (updateError) {
        console.error('[incrementFreeTierUsage] Error updating profile:', updateError)
        throw new Error('Failed to update free tier usage')
    }
    
    const remaining = Math.max(0, FREE_TIER_LIMIT - newUsed)
    console.log(`[incrementFreeTierUsage] User ${userId}: incremented by ${count}, now used=${newUsed}, remaining=${remaining}`)
    
    return { used: newUsed, remaining, limit: FREE_TIER_LIMIT }
}

/**
 * Create a Stripe Checkout session for pay-as-you-go image generation
 * @param params - Checkout parameters including user, collection, and items info
 * @returns Stripe Checkout Session
 */
export async function createCheckoutSession({
    userId,
    email,
    collectionId,
    collectionDbId,
    itemsCount,
    collectionName,
    itemIds,
}: {
    userId: string
    email: string
    collectionId: string      // Webflow collection ID
    collectionDbId: string    // Our DB UUID for the collection
    itemsCount: number
    collectionName: string
    itemIds: string[]         // Array of Webflow item IDs to generate
}) {
    // Validate that itemIds count matches itemsCount
    if (itemIds.length !== itemsCount) {
        throw new Error(`Item count mismatch: itemsCount=${itemsCount} but itemIds.length=${itemIds.length}`)
    }

    const session = await stripe.checkout.sessions.create({
        customer_email: email,
        mode: 'payment',
        line_items: [
            {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `AI Image Generation`,
                        description: `${itemsCount} ukiyo-e style OG images for ${collectionName}`,
                    },
                    unit_amount: PRICE_PER_IMAGE_CENTS,
                },
                quantity: itemsCount,
            },
        ],
        metadata: {
            userId,
            collectionId,           // Webflow collection ID
            collectionDbId,         // Our DB UUID
            itemsCount: itemsCount.toString(),
            collectionName,
            itemIds: JSON.stringify(itemIds), // Store as JSON string
        },
        // Correct URLs for the dashboard payment flow
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/collection/${collectionDbId}`,
    })

    console.log(`[createCheckoutSession] Created session ${session.id} for user ${userId}, collection ${collectionDbId}, ${itemsCount} items`)

    return session
}

/**
 * Retrieve a checkout session by ID
 * @param sessionId - Stripe Checkout Session ID
 * @returns Stripe Checkout Session with expanded data
 */
export async function getCheckoutSession(sessionId: string) {
    return await stripe.checkout.sessions.retrieve(sessionId)
}

/**
 * Get payment intent details
 * @param paymentIntentId - Stripe Payment Intent ID
 * @returns Stripe Payment Intent
 */
export async function getPaymentIntent(paymentIntentId: string) {
    return await stripe.paymentIntents.retrieve(paymentIntentId)
}

/**
 * Calculate the billing breakdown for a generation request
 * @param requestedItems - Number of items user wants to generate
 * @param remainingFree - Number of free tier slots remaining
 * @returns Breakdown of free vs paid items and total cost
 */
export function calculateBillingBreakdown(requestedItems: number, remainingFree: number): {
    freeItems: number
    paidItems: number
    totalCents: number
} {
    const freeItems = Math.min(requestedItems, remainingFree)
    const paidItems = requestedItems - freeItems
    const totalCents = paidItems * PRICE_PER_IMAGE_CENTS
    
    return { freeItems, paidItems, totalCents }
}

/**
 * Update user's stripe_customer_id in their profile
 * @param userId - The user's UUID
 * @param stripeCustomerId - The Stripe Customer ID
 */
export async function updateUserStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void> {
    const supabase = getSupabaseAdmin()
    
    const { error } = await supabase
        .from('profiles')
        .update({ 
            stripe_customer_id: stripeCustomerId,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId)
    
    if (error) {
        console.error('[updateUserStripeCustomerId] Error updating profile:', error)
        // Don't throw - this is a non-critical operation
    } else {
        console.log(`[updateUserStripeCustomerId] Updated stripe_customer_id for user ${userId}`)
    }
}
