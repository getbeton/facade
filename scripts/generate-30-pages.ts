import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { decrypt } from '../lib/crypto';
import { createCollectionItem, getCollectionItems } from '../lib/webflow';
import { FieldGenerator } from '../lib/services/generator/field-generator';
import cliProgress from 'cli-progress';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function generatePages(collectionId: string, count: number) {
    console.log(`Starting generation for ${count} pages in collection ${collectionId}...`);

    // 1. Get Integration Keys
    const { data: collection, error: colError } = await supabase
        .from('collections')
        .select(`
            webflow_collection_id,
            site:sites(
                name,
                integration_id
            )
        `)
        .eq('id', collectionId)
        .single();

    if (colError || !collection) {
        console.error('Collection not found:', colError);
        return;
    }

    const site = (collection as any).site;
    // Handle array/object difference from potential join issues
    const siteObj = Array.isArray(site) ? site[0] : site;
    
    if (!siteObj || !siteObj.integration_id) {
        console.error('Site or Integration ID not found');
        return;
    }

    // Fetch integration separately to avoid PGRST200
    const { data: integration, error: intError } = await supabase
        .from('integrations')
        .select('encrypted_webflow_key, encrypted_openai_key')
        .eq('id', siteObj.integration_id)
        .single();

    if (intError || !integration) {
        console.error('Integration not found:', intError);
        return;
    }

    const webflowKey = decrypt(integration.encrypted_webflow_key);
    // Use stored key or fallback to env for dev
    const openaiKey = integration.encrypted_openai_key 
        ? decrypt(integration.encrypted_openai_key)
        : process.env.OPENAI_API_KEY;

    if (!openaiKey) {
        console.error('OpenAI Key not found (neither in DB nor env)');
        return;
    }

    // 2. Analyze Schema
    console.log('Fetching sample item to infer schema...');
    const existingItems = await getCollectionItems(webflowKey, collection.webflow_collection_id);
    const sampleItem = existingItems[0];
    
    if (!sampleItem) {
         console.error('Collection is empty, cannot infer schema. Please create at least one item manually.');
         return;
    }

    const fieldsToGenerate = Object.keys(sampleItem.fieldData).filter(key => {
        return !['slug', 'updated-on', 'created-on', 'published-on', 'created-by', 'updated-by', '_archived', '_draft'].includes(key);
    });

    console.log(`Found ${fieldsToGenerate.length} fields to generate:`, fieldsToGenerate.join(', '));

    const generator = new FieldGenerator(openaiKey);
    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progressBar.start(count, 0);

    for (let i = 0; i < count; i++) {
        try {
            const itemData: Record<string, any> = {};
            const itemTopic = `AI SaaS Trend ${i + 1}`;

            // Generate Name
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
                .replace(/^-|-$/g, '') + `-${Date.now().toString().slice(-4)}`;

            // Generate other fields
            for (const field of fieldsToGenerate) {
                if (field === 'name' || field === 'slug') continue;

                const sampleValue = sampleItem.fieldData[field];
                let type: 'PlainText' | 'RichText' | 'Image' = 'PlainText';
                
                // Better heuristic
                if (typeof sampleValue === 'string') {
                    if (sampleValue.includes('<') && sampleValue.includes('>')) type = 'RichText';
                    else if (sampleValue.length > 200) type = 'RichText'; // Long text -> Rich Text likely
                } else if (typeof sampleValue === 'object' && sampleValue?.fileId) {
                    type = 'Image';
                }

                // Skip images for speed/cost in this batch unless essential?
                // The prompt didn't strictly say NO images, but let's assume we want full pages.
                // However, generating 30 images takes time. Let's do it if it's an image field.
                
                itemData[field] = await generator.generate({
                    apiKey: openaiKey,
                    fieldType: type,
                    fieldName: field,
                    context: { ...itemData, topic: itemTopic }, // Pass accumulated context
                    siteContext: site.name
                });
            }

            // Create in Webflow
            await createCollectionItem(
                webflowKey, 
                collection.webflow_collection_id, 
                itemData,
                false, 
                true // Draft
            );
            
            progressBar.increment();

        } catch (e) {
            console.error(`\nFailed to generate item ${i+1}:`, e);
        }
    }

    progressBar.stop();
    console.log('\nGeneration complete!');
}

// Hardcoded collection ID found from previous step
const TARGET_COLLECTION_ID = '68c2d046-9629-40dc-a558-7ecb1c4ab483';

generatePages(TARGET_COLLECTION_ID, 30).catch(console.error);

