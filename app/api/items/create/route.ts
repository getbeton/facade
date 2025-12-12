import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';
import { createCollectionItem, getCollectionItems } from '@/lib/webflow';
import { FieldGenerator } from '@/lib/services/generator/field-generator';

export async function POST(request: NextRequest) {
    try {
        const { collectionId, count = 1, topic } = await request.json();

        if (!collectionId) {
            return NextResponse.json({ error: 'Collection ID is required' }, { status: 400 });
        }

        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Get Integration Keys
        const { data: collection, error: colError } = await supabase
            .from('collections')
            .select(`
                webflow_collection_id,
                site:sites(
                    name,
                    integration:integrations(
                        encrypted_webflow_key,
                        encrypted_openai_key
                    )
                )
            `)
            .eq('id', collectionId)
            .single();

        if (colError || !collection) {
            return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
        }

        const site = (collection as any).site;
        // Handle array/object difference from potential join issues
        const integration = Array.isArray(site?.integration) ? site.integration[0] : site?.integration;

        if (!integration) {
            return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
        }

        const webflowKey = decrypt(integration.encrypted_webflow_key);
        const openaiKey = integration.encrypted_openai_key 
            ? decrypt(integration.encrypted_openai_key)
            : process.env.OPENAI_API_KEY!; // Fallback to env if using managed

        // 2. Analyze Schema from existing items
        // We fetch 1 item to understand the structure
        // In a real app, we'd fetch the schema definition from Webflow API
        const existingItems = await getCollectionItems(webflowKey, collection.webflow_collection_id);
        const sampleItem = existingItems[0];
        
        if (!sampleItem) {
             return NextResponse.json({ error: 'Collection is empty, cannot infer schema' }, { status: 400 });
        }

        // Identify fields to generate
        // We'll skip system fields
        const fieldsToGenerate = Object.keys(sampleItem.fieldData).filter(key => {
            return !['slug', 'updated-on', 'created-on', 'published-on', 'created-by', 'updated-by', '_archived', '_draft'].includes(key);
        });

        const generator = new FieldGenerator(openaiKey);
        const results = [];

        // 3. Loop and Generate
        for (let i = 0; i < count; i++) {
            const itemData: Record<string, any> = {};
            const itemTopic = topic ? `${topic} ${i + 1}` : `Generated Item ${i + 1}`;

            // Generate Name first
            itemData['name'] = await generator.generate({
                apiKey: openaiKey,
                fieldType: 'PlainText',
                fieldName: 'name',
                context: { topic: itemTopic },
                siteContext: site.name
            });

            // Generate Slug
            itemData['slug'] = (itemData['name'] as string)
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '') + `-${Date.now()}`; // Ensure uniqueness

            // Generate other fields
            for (const field of fieldsToGenerate) {
                if (field === 'name' || field === 'slug') continue;

                // Guess type (simple heuristic)
                // In production, we should fetch the schema definition
                const sampleValue = sampleItem.fieldData[field];
                let type: 'PlainText' | 'RichText' | 'Image' = 'PlainText';
                
                if (typeof sampleValue === 'string' && (sampleValue.includes('<p>') || sampleValue.length > 200)) {
                    type = 'RichText';
                } else if (typeof sampleValue === 'object' && sampleValue?.fileId) {
                    type = 'Image';
                }

                // Skip images for bulk text generation to save cost/time unless requested?
                // The user asked for "pages", implying content. 
                // Let's generate text fields.
                if (type === 'Image') continue; 

                itemData[field] = await generator.generate({
                    apiKey: openaiKey,
                    fieldType: type,
                    fieldName: field,
                    context: { ...itemData },
                    siteContext: site.name
                });
            }

            // Create in Webflow
            try {
                const newItem = await createCollectionItem(
                    webflowKey, 
                    collection.webflow_collection_id, 
                    itemData,
                    false, // isArchived
                    true   // isDraft (safer)
                );
                results.push({ status: 'success', id: newItem.id, name: itemData['name'] });
            } catch (e: any) {
                console.error('Failed to create item:', e);
                results.push({ status: 'error', message: e.message });
            }
        }

        return NextResponse.json({ results });

    } catch (error: any) {
        console.error('Error creating pages:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}





