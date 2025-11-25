import { NextRequest, NextResponse } from 'next/server';
import { getCollectionItems } from '@/lib/webflow';
import { createClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';

/**
 * GET - Fetch items for a Webflow collection using user's saved API key
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const collectionId = searchParams.get('collectionId');

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

        // Get the user's encrypted Webflow API key
        const { data: keysData, error: keysError } = await supabase
            .from('user_api_keys')
            .select('webflow_api_key')
            .eq('user_id', user.id)
            .single();

        if (keysError || !keysData) {
            return NextResponse.json(
                { error: 'No API keys found. Please save your keys first.' },
                { status: 404 }
            );
        }

        // Decrypt the API key
        const webflowApiKey = decrypt(keysData.webflow_api_key);

        // Fetch items using the decrypted API key
        const items = await getCollectionItems(webflowApiKey, collectionId);

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
 * Kept for backward compatibility
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
