import { NextRequest, NextResponse } from 'next/server';
import { getAllSites } from '@/lib/webflow';
import { createClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';

/**
 * GET - Fetch user's Webflow sites using their saved API key
 */
export async function GET(request: NextRequest) {
    try {
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

        // Fetch sites using the decrypted API key
        const sites = await getAllSites(webflowApiKey);

        return NextResponse.json({ sites });
    } catch (error) {
        console.error('Error fetching sites:', error);
        return NextResponse.json(
            { error: 'Failed to fetch sites' },
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
        const { apiKey } = await request.json();

        if (!apiKey) {
            return NextResponse.json(
                { error: 'API key is required' },
                { status: 400 }
            );
        }

        const sites = await getAllSites(apiKey);

        return NextResponse.json({ sites });
    } catch (error) {
        console.error('Error fetching sites:', error);
        return NextResponse.json(
            { error: 'Failed to fetch sites' },
            { status: 500 }
        );
    }
}
