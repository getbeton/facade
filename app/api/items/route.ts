import { NextRequest, NextResponse } from 'next/server';
import { getCollectionItems } from '@/lib/webflow';
import { createClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';

/**
 * GET - Fetch items for a saved collection
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const collectionId = searchParams.get('collectionId'); // This is now our DB UUID

        if (!collectionId) {
            return NextResponse.json(
                { error: 'Collection ID is required' },
                { status: 400 }
            );
        }

        const supabase = await createClient();
        
        // Get the authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get the collection details including API key
        const { data: collection, error: collectionError } = await supabase
            .from('collections')
            .select(`
                webflow_collection_id, 
                site:sites (
                    integration:integrations (
                        encrypted_webflow_key
                    )
                )
            `)
            .eq('id', collectionId)
            .eq('user_id', user.id)
            .single();

        const site = (collection as any)?.site;
        const siteObj = Array.isArray(site) ? site[0] : site;
        const integration = siteObj?.integration;
        const integrationObj = Array.isArray(integration) ? integration[0] : integration;

        if (collectionError || !collection || !integrationObj) {
            return NextResponse.json(
                { error: 'Collection not found' },
                { status: 404 }
            );
        }

        // Decrypt the API key
        const webflowApiKey = decrypt(integrationObj.encrypted_webflow_key);
        const webflowCollectionId = collection.webflow_collection_id;

        // Fetch items using the decrypted API key and actual Webflow Collection ID
        const items = await getCollectionItems(webflowApiKey, webflowCollectionId);

        return NextResponse.json({ items });
    } catch (error) {
        console.error('Error fetching items:', error);
        return NextResponse.json(
            { error: 'Failed to fetch items' },
            { status: 500 }
        );
    }
}

/**
 * POST - Legacy endpoint that accepts API key in body
 * Kept for backward compatibility or direct usage
 */
export async function POST(request: NextRequest) {
    try {
        const { apiKey, collectionId } = await request.json();

        if (!apiKey || !collectionId) {
            return NextResponse.json(
                { error: 'API key and collection ID are required' },
                { status: 400 }
            );
        }

        const items = await getCollectionItems(apiKey, collectionId);

        return NextResponse.json({ items });
    } catch (error) {
        console.error('Error fetching items:', error);
        return NextResponse.json(
            { error: 'Failed to fetch items' },
            { status: 500 }
        );
    }
}
