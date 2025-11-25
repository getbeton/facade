import Stripe from 'stripe'

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

/**
 * Create a Stripe Checkout session for pay-as-you-go image generation
 */
export async function createCheckoutSession({
    userId,
    email,
    collectionId,
    itemsCount,
    collectionName,
}: {
    userId: string
    email: string
    collectionId: string
    itemsCount: number
    collectionName: string
}) {
    const totalCents = itemsCount * PRICE_PER_IMAGE_CENTS

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
            collectionId,
            itemsCount: itemsCount.toString(),
            collectionName,
        },
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/app`,
    })

    return session
}

/**
 * Retrieve a checkout session by ID
 */
export async function getCheckoutSession(sessionId: string) {
    return await stripe.checkout.sessions.retrieve(sessionId)
}

/**
 * Get payment intent details
 */
export async function getPaymentIntent(paymentIntentId: string) {
    return await stripe.paymentIntents.retrieve(paymentIntentId)
}
