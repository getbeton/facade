import { NextRequest, NextResponse } from 'next/server';
import { getCollections } from '@/lib/webflow';
import { createClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';

/**
 * GET - Fetch collections for a Webflow site using user's saved API key
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const siteId = searchParams.get('siteId');

        if (!siteId) {
            return NextResponse.json(
                { error: 'Site ID is required' },
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

        // Fetch collections using the decrypted API key
        const collections = await getCollections(webflowApiKey, siteId);

        return NextResponse.json({ collections });
    } catch (error) {
        console.error('Error fetching collections:', error);
        return NextResponse.json(
            { error: 'Failed to fetch collections' },
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
        const { apiKey, siteId } = await request.json();

        if (!apiKey || !siteId) {
            return NextResponse.json(
                { error: 'API key and site ID are required' },
                { status: 400 }
            );
        }

        const collections = await getCollections(apiKey, siteId);

        return NextResponse.json({ collections });
    } catch (error) {
        console.error('Error fetching collections:', error);
        return NextResponse.json(
            { error: 'Failed to fetch collections' },
            { status: 500 }
        );
    }
}
