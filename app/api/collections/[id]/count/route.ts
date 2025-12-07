import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';
import { getCollectionCount } from '@/lib/webflow';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get collection details including encrypted key
        const { data: collection, error } = await supabase
            .from('collections')
            .select(`
                webflow_collection_id, 
                site:sites (
                    integration:integrations (
                        encrypted_webflow_key
                    )
                )
            `)
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        const site = (collection as any)?.site;
        const siteObj = Array.isArray(site) ? site[0] : site;
        const integration = siteObj?.integration;
        const integrationObj = Array.isArray(integration) ? integration[0] : integration;

        if (error || !collection || !integrationObj) {
            return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
        }

        const webflowApiKey = decrypt(integrationObj.encrypted_webflow_key);
        const count = await getCollectionCount(webflowApiKey, collection.webflow_collection_id);

        return NextResponse.json({ count });
    } catch (error) {
        console.error('Error fetching count:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}



