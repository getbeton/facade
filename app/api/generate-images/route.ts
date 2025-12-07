import { NextRequest, NextResponse } from 'next/server';
import {
    getCollectionItems,
    uploadImageToWebflow,
    updateItemWithOGImage,
} from '@/lib/webflow';
import { generateImage } from '@/lib/openai';
import { createUkiyoePrompt } from '@/lib/prompt-generator';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { decrypt } from '@/lib/crypto';
import { 
    getUserFreeTierStatus, 
    incrementFreeTierUsage, 
    PRICE_PER_IMAGE_CENTS
} from '@/lib/stripe';

// Admin client for server-side operations (bypasses RLS)
const getSupabaseAdmin = () => {
    return createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
};

/**
 * Billing mode for generation
 * - 'own_api_key': User has their own OpenAI API key, no billing
 * - 'free_tier': Using free tier slots, no payment required
 * - 'paid': Using paid generations from a payment record
 * - 'mixed': Some free tier + some paid
 */
type BillingMode = 'own_api_key' | 'free_tier' | 'paid' | 'mixed';

/**
 * POST /api/generate-images
 * 
 * Generates AI images for Webflow CMS items with billing tracking.
 * 
 * Request body:
 * - collectionId: string (our DB UUID)
 * - itemIds: string[] (Webflow item IDs to generate)
 * - paymentId: string (optional, required if paid items)
 * 
 * Streams progress updates to the client.
 */
export async function POST(request: NextRequest) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const supabaseAdmin = getSupabaseAdmin();
            let completedCount = 0;
            let failedCount = 0;
            let freeTierUsed = 0;
            let billingMode: BillingMode = 'own_api_key';

            try {
                // ============================================================
                // 1. Parse and validate request
                // ============================================================
                const body = await request.json();
                let { collectionId, itemIds, paymentId, visibleColumnsCount = 1 } = body;

                console.log(`[generate-images] Starting generation: collectionId=${collectionId}, items=${itemIds?.length || 0}, paymentId=${paymentId || 'none'}`);

                if (!collectionId || !itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
                    controller.enqueue(encoder.encode(JSON.stringify({
                        status: 'error',
                        message: 'Invalid request: collectionId and itemIds array required',
                    }) + '\n'));
                    controller.close();
                    return;
                }

                // ============================================================
                // 2. Authenticate user
                // ============================================================
                const supabase = await createClient();
                const { data: { user } } = await supabase.auth.getUser();

                if (!user) {
                    controller.enqueue(encoder.encode(JSON.stringify({
                        status: 'error',
                        message: 'Unauthorized',
                    }) + '\n'));
                    controller.close();
                    return;
                }

                console.log(`[generate-images] User authenticated: ${user.id}`);

                // ============================================================
                // 3. Get collection and decrypt API keys
                // ============================================================
                const { data: collection, error: collectionError } = await supabase
                    .from('collections')
                    .select(`
                        id, 
                        webflow_collection_id, 
                        site_id, 
                        display_name,
                        site:sites (
                            integration:integrations (
                                encrypted_webflow_key,
                                encrypted_openai_key
                            )
                        )
                    `)
                    .eq('id', collectionId)
                    .eq('user_id', user.id)
                    .single();

                if (collectionError || !collection) {
                    console.error('[generate-images] Collection not found:', collectionError);
                    controller.enqueue(encoder.encode(JSON.stringify({
                        status: 'error',
                        message: 'Collection not found or access denied',
                    }) + '\n'));
                    controller.close();
                    return;
                }

                // Safely extract nested relation
                const site = (collection as any).site;
                const siteObj = Array.isArray(site) ? site[0] : site;
                const integration = siteObj?.integration;
                const integrationObj = Array.isArray(integration) ? integration[0] : integration;

                if (!integrationObj) {
                    console.error('[generate-images] Integration not found for collection');
                    controller.enqueue(encoder.encode(JSON.stringify({
                        status: 'error',
                        message: 'Integration not connected',
                    }) + '\n'));
                    controller.close();
                    return;
                }

                const webflowApiKey = decrypt(integrationObj.encrypted_webflow_key);
                const openaiApiKey = integrationObj.encrypted_openai_key 
                    ? decrypt(integrationObj.encrypted_openai_key)
                    : '';
                const webflowCollectionId = collection.webflow_collection_id;
                const siteId = collection.site_id;

                // ============================================================
                // 4. Determine billing mode and validate payment
                // ============================================================
                
                // Check if user has their own OpenAI API key
                const usesOwnApiKey = openaiApiKey && 
                    openaiApiKey.startsWith('sk-') && 
                    !openaiApiKey.startsWith('FACADE');

                let payment = null;
                let remainingFree = 0;
                let freeItemsCount = 0;
                let paidItemsCount = 0;

                if (usesOwnApiKey) {
                    // User has their own API key - no billing required
                    billingMode = 'own_api_key';
                    console.log('[generate-images] Using own API key - no billing');
                } else {
                    // User needs billing - check free tier and payment
                    const freeTierStatus = await getUserFreeTierStatus(user.id, visibleColumnsCount);
                    remainingFree = freeTierStatus.remaining;

                    // Calculate how many can be free vs paid
                    freeItemsCount = Math.min(itemIds.length, remainingFree);
                    paidItemsCount = itemIds.length - freeItemsCount;

                    console.log(`[generate-images] Billing: freeItems=${freeItemsCount}, paidItems=${paidItemsCount}, remainingFree=${remainingFree}`);

                    if (paidItemsCount > 0) {
                        // Need payment - verify paymentId
                        if (!paymentId) {
                            controller.enqueue(encoder.encode(JSON.stringify({
                                status: 'error',
                                message: `Payment required for ${paidItemsCount} items. Please complete checkout first.`,
                            }) + '\n'));
                            controller.close();
                            return;
                        }

                        // Verify payment exists and is valid
                        const { data: paymentData, error: paymentError } = await supabaseAdmin
                            .from('payments')
                            .select('*')
                            .eq('id', paymentId)
                            .eq('user_id', user.id)
                            .single();

                        if (paymentError || !paymentData) {
                            console.error('[generate-images] Payment not found:', paymentError);
                            controller.enqueue(encoder.encode(JSON.stringify({
                                status: 'error',
                                message: 'Payment not found or access denied',
                            }) + '\n'));
                            controller.close();
                            return;
                        }

                        // Verify payment hasn't been used yet
                        if (paymentData.generation_started) {
                            controller.enqueue(encoder.encode(JSON.stringify({
                                status: 'error',
                                message: 'This payment has already been used for generation',
                            }) + '\n'));
                            controller.close();
                            return;
                        }

                        // Verify payment status is valid
                        if (paymentData.status !== 'pending' && paymentData.status !== 'processing') {
                            controller.enqueue(encoder.encode(JSON.stringify({
                                status: 'error',
                                message: `Invalid payment status: ${paymentData.status}`,
                            }) + '\n'));
                            controller.close();
                            return;
                        }

                        payment = paymentData;
                        billingMode = freeItemsCount > 0 ? 'mixed' : 'paid';

                        // Mark payment as started
                        await supabaseAdmin
                            .from('payments')
                            .update({ 
                                generation_started: true, 
                                status: 'processing',
                                started_at: new Date().toISOString() 
                            })
                            .eq('id', paymentId);

                    } else {
                        // All items covered by free tier
                        billingMode = 'free_tier';
                    }
                }

                controller.enqueue(encoder.encode(JSON.stringify({
                    status: 'processing',
                    message: `Starting generation (${billingMode} mode)...`,
                    billingMode,
                    freeItems: freeItemsCount,
                    paidItems: paidItemsCount,
                }) + '\n'));

                // ============================================================
                // 5. Fetch and filter collection items
                // ============================================================
                controller.enqueue(encoder.encode(JSON.stringify({
                    status: 'processing',
                    message: 'Fetching collection items...',
                }) + '\n'));

                let items = await getCollectionItems(webflowApiKey, webflowCollectionId);
                items = items.filter(item => itemIds.includes(item.id));
                const total = items.length;

                if (total === 0) {
                    controller.enqueue(encoder.encode(JSON.stringify({
                        status: 'error',
                        message: 'No matching items found in collection',
                    }) + '\n'));
                    controller.close();
                    return;
                }

                controller.enqueue(encoder.encode(JSON.stringify({
                    status: 'processing',
                    message: `Found ${total} items to process`,
                    total,
                }) + '\n'));

                // ============================================================
                // 6. Process each item with logging
                // ============================================================
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    const itemName = item.fieldData['tool-name'] || item.fieldData.name || item.id;
                    const isFreeTierItem = !usesOwnApiKey && i < freeItemsCount;
                    
                    // Create or update generation log entry
                    let generationLogId: string | null = null;

                    try {
                        // Check if generation log already exists (from webhook)
                        const { data: existingLog } = await supabaseAdmin
                            .from('generation_logs')
                            .select('id')
                            .eq('user_id', user.id)
                            .eq('webflow_item_id', item.id)
                            .eq('payment_id', payment?.id || null)
                            .single();

                        if (existingLog) {
                            generationLogId = existingLog.id;
                            // Update to processing
                            await supabaseAdmin
                                .from('generation_logs')
                                .update({ 
                                    status: 'processing', 
                                    started_at: new Date().toISOString(),
                                    item_name: itemName,
                                })
                                .eq('id', generationLogId);
                        } else {
                            // Create new log entry
                            const { data: newLog } = await supabaseAdmin
                                .from('generation_logs')
                                .insert({
                                    user_id: user.id,
                                    collection_id: collectionId,
                                    webflow_collection_id: webflowCollectionId,
                                    webflow_item_id: item.id,
                                    item_name: itemName,
                                    payment_id: payment?.id || null,
                                    status: 'processing',
                                    is_free_tier: isFreeTierItem,
                                    uses_own_api_key: usesOwnApiKey,
                                    cost_cents: usesOwnApiKey ? 0 : (isFreeTierItem ? 0 : PRICE_PER_IMAGE_CENTS),
                                    started_at: new Date().toISOString(),
                                })
                                .select('id')
                                .single();

                            generationLogId = newLog?.id || null;
                        }

                        controller.enqueue(encoder.encode(JSON.stringify({
                            status: 'processing',
                            currentItem: itemName,
                            progress: i + 1,
                            total,
                            message: `Processing ${itemName}...`,
                        }) + '\n'));

                        // Generate prompt
                        const prompt = createUkiyoePrompt(item);

                        // Generate image
                        controller.enqueue(encoder.encode(JSON.stringify({
                            status: 'processing',
                            currentItem: itemName,
                            progress: i + 1,
                            total,
                            message: `Generating image for ${itemName}...`,
                        }) + '\n'));

                        const imageBuffer = await generateImage(prompt, openaiApiKey);

                        // Upload to Webflow
                        controller.enqueue(encoder.encode(JSON.stringify({
                            status: 'processing',
                            currentItem: itemName,
                            progress: i + 1,
                            total,
                            message: `Uploading image for ${itemName}...`,
                        }) + '\n'));

                        const fileName = `${itemName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`;
                        const asset = await uploadImageToWebflow(
                            imageBuffer,
                            fileName,
                            webflowApiKey,
                            siteId
                        );

                        // Update CMS item
                        await updateItemWithOGImage(
                            webflowApiKey,
                            webflowCollectionId,
                            item.id,
                            asset.id
                        );

                        // Mark generation log as completed
                        if (generationLogId) {
                            await supabaseAdmin
                                .from('generation_logs')
                                .update({ 
                                    status: 'completed', 
                                    completed_at: new Date().toISOString() 
                                })
                                .eq('id', generationLogId);
                        }

                        completedCount++;
                        if (isFreeTierItem) {
                            freeTierUsed++;
                        }

                        controller.enqueue(encoder.encode(JSON.stringify({
                            status: 'processing',
                            currentItem: itemName,
                            progress: i + 1,
                            total,
                            message: `Completed ${itemName}`,
                        }) + '\n'));

                        // Rate limiting delay
                        await new Promise((resolve) => setTimeout(resolve, 3000));

                    } catch (error) {
                        console.error(`[generate-images] Error processing ${itemName}:`, error);
                        failedCount++;

                        // Mark generation log as failed
                        if (generationLogId) {
                            await supabaseAdmin
                                .from('generation_logs')
                                .update({ 
                                    status: 'failed', 
                                    error_message: error instanceof Error ? error.message : 'Unknown error',
                                    completed_at: new Date().toISOString()
                                })
                                .eq('id', generationLogId);
                        }

                        controller.enqueue(encoder.encode(JSON.stringify({
                            status: 'error',
                            currentItem: itemName,
                            progress: i + 1,
                            total,
                            message: `Error processing ${itemName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        }) + '\n'));
                    }
                }

                // ============================================================
                // 7. Finalize billing tracking
                // ============================================================
                
                // Update free tier usage if applicable
                if (freeTierUsed > 0 && !usesOwnApiKey) {
                    await incrementFreeTierUsage(user.id, freeTierUsed, visibleColumnsCount);
                    console.log(`[generate-images] Incremented free tier usage by ${freeTierUsed}`);
                }

                // Update payment status if applicable
                if (payment) {
                    await supabaseAdmin
                        .from('payments')
                        .update({ 
                            status: failedCount === 0 ? 'completed' : 'completed',
                            items_completed: completedCount,
                            items_failed: failedCount,
                            completed_at: new Date().toISOString()
                        })
                        .eq('id', payment.id);
                }

                // ============================================================
                // 8. Send final status
                // ============================================================
                controller.enqueue(encoder.encode(JSON.stringify({
                    status: 'success',
                    progress: total,
                    total,
                    completedCount,
                    failedCount,
                    freeTierUsed,
                    message: `Generation complete: ${completedCount} succeeded, ${failedCount} failed`,
                }) + '\n'));

                console.log(`[generate-images] Complete: ${completedCount} succeeded, ${failedCount} failed, ${freeTierUsed} free tier used`);
                controller.close();

            } catch (error) {
                console.error('[generate-images] Fatal error:', error);
                controller.enqueue(encoder.encode(JSON.stringify({
                    status: 'error',
                    message: error instanceof Error ? error.message : 'Unknown error occurred',
                }) + '\n'));
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        },
    });
}
