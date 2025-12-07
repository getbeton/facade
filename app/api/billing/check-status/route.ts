import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'
import { 
    getUserFreeTierStatus, 
    calculateBillingBreakdown,
    PRICE_PER_IMAGE_CENTS
} from '@/lib/stripe'
import { BillingCheckResponse } from '@/lib/types'

/**
 * POST /api/billing/check-status
 * 
 * Pre-flight check before generation to determine if payment is required.
 * 
 * Request body:
 * - collectionId: string (our DB UUID)
 * - fieldCount: number (number of fields user wants to generate)
 * - visibleColumnsCount: number (columns currently visible in UI, used for free limit)
 * 
 * Response:
 * - requiresPayment: boolean
 * - reason: 'own_api_key' | 'free_tier' (if no payment required)
 * - remainingFreeGenerations: number
 * - itemsToCharge: number (if payment required)
 * - amountCents: number (if payment required)
 */
export async function POST(request: NextRequest) {
    try {
        console.log('[billing/check-status] Starting billing check...')
        
        // 1. Authenticate user
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            console.log('[billing/check-status] Unauthorized - no valid user')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // 2. Parse request body
        const body = await request.json()
        const { collectionId, fieldCount, visibleColumnsCount = 1 } = body

        if (!collectionId || typeof fieldCount !== 'number' || fieldCount < 1) {
            console.log('[billing/check-status] Invalid request parameters:', { collectionId, fieldCount })
            return NextResponse.json(
                { error: 'Invalid request parameters. Required: collectionId (string), fieldCount (number > 0)' },
                { status: 400 }
            )
        }

        console.log(`[billing/check-status] User ${user.id}, collection ${collectionId}, ${fieldCount} fields, visibleColumns=${visibleColumnsCount}`)

        // 3. Get collection from DB and check if it has user's own OpenAI key
        const { data: collection, error: collectionError } = await supabase
            .from('collections')
            .select(`
                id, 
                display_name, 
                webflow_collection_id, 
                site_id,
                site:sites (
                    integration:integrations (
                        encrypted_openai_key
                    )
                )
            `)
            .eq('id', collectionId)
            .eq('user_id', user.id)
            .single()

        if (collectionError || !collection) {
            console.log('[billing/check-status] Collection not found:', collectionError)
            return NextResponse.json(
                { error: 'Collection not found or access denied' },
                { status: 404 }
            )
        }

        // 4. Check if collection has a user-provided OpenAI API key
        // A valid user-provided key should:
        // - Exist and be non-empty after decryption
        // - Not be a placeholder value like "FACADE" or empty string
        let usesOwnApiKey = false
        
        // Safely extract nested relation which might be array or object
        const site = (collection as any).site
        const siteObj = Array.isArray(site) ? site[0] : site
        const integration = siteObj?.integration
        const integrationObj = Array.isArray(integration) ? integration[0] : integration
        const encryptedOpenAIKey = integrationObj?.encrypted_openai_key
        
        if (encryptedOpenAIKey) {
            try {
                const decryptedKey = decrypt(encryptedOpenAIKey)
                // Check if it's a valid OpenAI API key format (starts with sk-)
                // and not a special placeholder value
                usesOwnApiKey = Boolean(
                    decryptedKey && 
                    decryptedKey.length > 0 && 
                    !decryptedKey.startsWith('FACADE') &&
                    decryptedKey !== 'placeholder' &&
                    decryptedKey.startsWith('sk-')
                )
                    
                console.log(`[billing/check-status] OpenAI key check: usesOwnApiKey=${usesOwnApiKey}`)
            } catch (decryptError) {
                console.error('[billing/check-status] Failed to decrypt OpenAI key:', decryptError)
                // If we can't decrypt, assume no valid key
                usesOwnApiKey = false
            }
        }

        // 5. If using own API key, no payment required
        if (usesOwnApiKey) {
            console.log(`[billing/check-status] User has own API key - no payment required`)
            
            const response: BillingCheckResponse = {
                requiresPayment: false,
                reason: 'own_api_key',
                remainingFreeGenerations: 0, // Not applicable but included for consistency
                pricePerImageCents: PRICE_PER_IMAGE_CENTS
            }
            
            return NextResponse.json(response)
        }

        // 6. User doesn't have own API key - check free tier status
        const freeTierStatus = await getUserFreeTierStatus(user.id, visibleColumnsCount)
        console.log(`[billing/check-status] Free tier status: used=${freeTierStatus.used}, remaining=${freeTierStatus.remaining}`)

        // 7. Calculate billing breakdown
        const { freeItems, paidItems, totalCents } = calculateBillingBreakdown(
            fieldCount, 
            freeTierStatus.remaining
        )

        console.log(`[billing/check-status] Billing breakdown: freeItems=${freeItems}, paidItems=${paidItems}, totalCents=${totalCents}`)

        // 8. Determine if payment is required
        const requiresPayment = paidItems > 0

        if (!requiresPayment) {
            // All items covered by free tier
            const response: BillingCheckResponse = {
                requiresPayment: false,
                reason: 'free_tier',
                remainingFreeGenerations: freeTierStatus.remaining,
                remainingAfterGeneration: freeTierStatus.remaining - fieldCount,
                freeItemsCount: freeItems,
                pricePerImageCents: PRICE_PER_IMAGE_CENTS
            }
            
            console.log(`[billing/check-status] No payment required - using free tier`)
            return NextResponse.json(response)
        }

        // 9. Payment is required
        const response: BillingCheckResponse = {
            requiresPayment: true,
            remainingFreeGenerations: freeTierStatus.remaining,
            freeItemsCount: freeItems,
            itemsToCharge: paidItems,
            amountCents: totalCents,
            pricePerImageCents: PRICE_PER_IMAGE_CENTS
        }

        console.log(`[billing/check-status] Payment required: ${paidItems} items, $${(totalCents / 100).toFixed(2)}`)
        return NextResponse.json(response)

    } catch (error) {
        console.error('[billing/check-status] Error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

