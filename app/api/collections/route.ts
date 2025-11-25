import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encrypt } from '@/lib/crypto';
import { validateOpenAIKey } from '@/lib/openai';

/**
 * GET - Fetch user's saved collections from database
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch collections with site data
        const { data: collections, error } = await supabase
            .from('collections')
            .select(`
                *,
                site:sites(*)
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching collections:', error);
            return NextResponse.json({ error: 'Failed to fetch collections' }, { status: 500 });
        }

        // Return without sensitive keys
        const sanitizedCollections = collections.map(col => ({
            ...col,
            webflow_api_key: undefined,
            openai_api_key: undefined
        }));

        return NextResponse.json({ collections: sanitizedCollections });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * POST - Create/Save a new collection (and site if needed)
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { 
            // Site Data
            siteId, siteName, siteShortName, sitePreviewUrl, siteFaviconUrl,
            // Collection Data
            webflowCollectionId, collectionDisplayName,
            // Keys
            webflowApiKey, openaiApiKey 
        } = body;

        // Basic validation
        if (!siteId || !webflowCollectionId || !webflowApiKey || !openaiApiKey) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Validate OpenAI Key
        const isValidOpenAI = await validateOpenAIKey(openaiApiKey);
        if (!isValidOpenAI) {
            return NextResponse.json({ error: 'Invalid OpenAI API Key' }, { status: 400 });
        }

        // 1. Upsert Site
        const { error: siteError } = await supabase
            .from('sites')
            .upsert({
                id: siteId,
                user_id: user.id,
                name: siteName,
                short_name: siteShortName,
                preview_url: sitePreviewUrl,
                favicon_url: siteFaviconUrl,
                last_synced_at: new Date().toISOString()
            }, { onConflict: 'id' });

        if (siteError) {
            console.error('Error saving site:', siteError);
            return NextResponse.json({ error: 'Failed to save site information' }, { status: 500 });
        }

        // 2. Create Collection
        const { data: collection, error: collectionError } = await supabase
            .from('collections')
            .insert({
                user_id: user.id,
                site_id: siteId,
                webflow_collection_id: webflowCollectionId,
                display_name: collectionDisplayName,
                webflow_api_key: encrypt(webflowApiKey),
                openai_api_key: encrypt(openaiApiKey)
            })
            .select()
            .single();

        if (collectionError) {
            console.error('Error saving collection:', collectionError);
            return NextResponse.json({ error: 'Failed to save collection' }, { status: 500 });
        }

        return NextResponse.json({ collection });
    } catch (error) {
        console.error('Error in POST /api/collections:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
