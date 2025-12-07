import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { decrypt } from '@/lib/crypto';
import { updateCollectionItem } from '@/lib/webflow';

export async function POST(request: NextRequest) {
    const { suggestionId } = await request.json();

    if (!suggestionId) {
        return NextResponse.json({ error: 'Missing suggestionId' }, { status: 400 });
    }

    const supabase = await createClient(); // Authenticated client to check user permissions
    
    // Check if user owns this suggestion (via RLS or manual check)
    // We'll fetch the suggestion first.
    
    try {
        const { data: suggestion, error: fetchError } = await supabase
            .from('seo_suggestions')
            .select(`
                *,
                generation:seo_generations (
                    id,
                    field_name,
                    webflow_item_id,
                    collection:collections (
                        id,
                        webflow_collection_id,
                        site:sites (
                            integration:integrations (
                                encrypted_webflow_key
                            )
                        )
                    )
                )
            `)
            .eq('id', suggestionId)
            .single();

        if (fetchError || !suggestion) {
            console.error('Error fetching suggestion:', fetchError);
            return NextResponse.json({ error: 'Suggestion not found or access denied' }, { status: 404 });
        }

        const generation = suggestion.generation;
        if (!generation || !generation.collection) {
            return NextResponse.json({ error: 'Invalid suggestion data' }, { status: 500 });
        }

        const collection = generation.collection;
        
        // Extract integration
        const site = (collection as any).site;
        const siteObj = Array.isArray(site) ? site[0] : site;
        const integration = siteObj?.integration;
        const integrationObj = Array.isArray(integration) ? integration[0] : integration;

        if (!integrationObj) {
            return NextResponse.json({ error: 'Integration not found' }, { status: 500 });
        }
        
        // Decrypt Webflow API Key
        // We might need admin client if RLS prevents reading encrypted keys?
        // Usually keys are readable by owner. But if not, we use service role.
        // Let's try to decrypt what we got.
        
        let webflowApiKey: string;
        try {
             webflowApiKey = decrypt(integrationObj.encrypted_webflow_key);
        } catch (e) {
             // If we failed, maybe we couldn't read the key column properly?
             // Or maybe we need admin access to read sensitive columns?
             // Assuming RLS allows reading keys for owner.
             return NextResponse.json({ error: 'Failed to decrypt Webflow API key' }, { status: 500 });
        }

        // Apply to Webflow
        const fieldName = generation.field_name;
        const value = suggestion.suggested_value;
        
        // Map fieldName to Webflow field slug if necessary
        // Assuming 'meta-title' -> 'meta-title' or 'name' etc.
        // For standard SEO fields in Webflow, they are usually 'meta-title' and 'meta-description' 
        // in the API payload or under 'seo-title' / 'seo-description'?
        // Webflow API v2 documentation says:
        // "fieldData": { "name": "...", "slug": "...", ... }
        // SEO fields are top-level properties in some contexts or inside fieldData.
        // Actually, for CMS items, SEO fields are just fields in the collection structure.
        // However, standard fields are often: 'name', 'slug'.
        // SEO fields are user-defined in the collection unless they are standard properties?
        // Webflow CMS doesn't enforce standard SEO fields on all collections unless added.
        // But usually they are just text fields.
        // If the user mapped them in our DB (we don't have mapping yet), we would know.
        // For now, we assume the `field_name` stored in `seo_generations` IS the Webflow slug.
        
        await updateCollectionItem(
            webflowApiKey,
            collection.webflow_collection_id,
            generation.webflow_item_id,
            { [fieldName]: value }
        );

        // Update status to approved
        const { error: updateError } = await supabase
            .from('seo_suggestions')
            .update({ status: 'approved' })
            .eq('id', suggestionId);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Error applying suggestion:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}





