import { NextRequest, NextResponse } from 'next/server';
import {
    getCollectionItems,
    uploadImageToWebflow,
    updateItemWithOGImage,
} from '@/lib/webflow';
import { generateImage } from '@/lib/openai';
import { createUkiyoePrompt } from '@/lib/prompt-generator';
import { createClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';

export async function POST(request: NextRequest) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            try {
                const body = await request.json();
                let { webflowApiKey, openaiApiKey, collectionId, siteId, itemIds } = body;

                // Resolve keys if collectionId is our DB UUID (simplified check for hyphen)
                if (collectionId && collectionId.includes('-') && (!webflowApiKey || !openaiApiKey)) {
                     const supabase = await createClient();
                     // We might need auth check here, but this is a stream, so it's tricky. 
                     // Assuming the route is protected or we check auth quickly.
                     const { data: { user } } = await supabase.auth.getUser();
                     if (user) {
                         const { data: collection } = await supabase
                             .from('collections')
                             .select('webflow_api_key, openai_api_key, webflow_collection_id, site_id')
                             .eq('id', collectionId)
                             .eq('user_id', user.id)
                             .single();
                        
                        if (collection) {
                            webflowApiKey = decrypt(collection.webflow_api_key);
                            openaiApiKey = decrypt(collection.openai_api_key);
                            // Update collectionId to the actual Webflow Collection ID for downstream calls
                            collectionId = collection.webflow_collection_id;
                            // Also get siteId if not provided (though usually needed for assets)
                            if (!siteId) siteId = collection.site_id;
                        }
                     }
                }

                if (!webflowApiKey || !openaiApiKey || !collectionId || !siteId) {
                    controller.enqueue(
                        encoder.encode(
                            JSON.stringify({
                                status: 'error',
                                message: 'Missing required parameters or invalid collection',
                            }) + '\n'
                        )
                    );
                    controller.close();
                    return;
                }

                // Fetch collection items
                controller.enqueue(
                    encoder.encode(
                        JSON.stringify({
                            status: 'processing',
                            message: 'Fetching collection items...',
                        }) + '\n'
                    )
                );

                let items = await getCollectionItems(webflowApiKey, collectionId);

                // Filter to only selected items if itemIds provided
                if (itemIds && itemIds.length > 0) {
                    items = items.filter(item => itemIds.includes(item.id));
                }

                const total = items.length;

                controller.enqueue(
                    encoder.encode(
                        JSON.stringify({
                            status: 'processing',
                            message: `Found ${total} items`,
                            total,
                        }) + '\n'
                    )
                );

                // Process each item
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    const itemName = item.fieldData['tool-name'] || item.id;

                    try {
                        controller.enqueue(
                            encoder.encode(
                                JSON.stringify({
                                    status: 'processing',
                                    currentItem: itemName,
                                    progress: i + 1,
                                    total,
                                    message: `Processing ${itemName}...`,
                                }) + '\n'
                            )
                        );

                        // Generate prompt
                        const prompt = createUkiyoePrompt(item);

                        // Generate image
                        controller.enqueue(
                            encoder.encode(
                                JSON.stringify({
                                    status: 'processing',
                                    currentItem: itemName,
                                    progress: i + 1,
                                    total,
                                    message: `Generating image for ${itemName}...`,
                                }) + '\n'
                            )
                        );

                        const imageBuffer = await generateImage(prompt, openaiApiKey);

                        // Upload to Webflow
                        controller.enqueue(
                            encoder.encode(
                                JSON.stringify({
                                    status: 'processing',
                                    currentItem: itemName,
                                    progress: i + 1,
                                    total,
                                    message: `Uploading image for ${itemName}...`,
                                }) + '\n'
                            )
                        );

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
                            collectionId,
                            item.id,
                            asset.id
                        );

                        controller.enqueue(
                            encoder.encode(
                                JSON.stringify({
                                    status: 'processing',
                                    currentItem: itemName,
                                    progress: i + 1,
                                    total,
                                    message: `Completed ${itemName}`,
                                }) + '\n'
                            )
                        );

                        // Rate limiting delay
                        await new Promise((resolve) => setTimeout(resolve, 3000));
                    } catch (error) {
                        console.error(`Error processing ${itemName}:`, error);
                        controller.enqueue(
                            encoder.encode(
                                JSON.stringify({
                                    status: 'error',
                                    currentItem: itemName,
                                    progress: i + 1,
                                    total,
                                    message: `Error processing ${itemName}: ${error instanceof Error ? error.message : 'Unknown error'
                                        }`,
                                }) + '\n'
                            )
                        );
                    }
                }

                // Success
                controller.enqueue(
                    encoder.encode(
                        JSON.stringify({
                            status: 'success',
                            progress: total,
                            total,
                            message: `Successfully processed ${total} items`,
                        }) + '\n'
                    )
                );

                controller.close();
            } catch (error) {
                console.error('Error in generate-images:', error);
                controller.enqueue(
                    encoder.encode(
                        JSON.stringify({
                            status: 'error',
                            message:
                                error instanceof Error ? error.message : 'Unknown error occurred',
                        }) + '\n'
                    )
                );
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
