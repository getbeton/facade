import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { decrypt } from '../lib/crypto';
import { getCollectionItems } from '../lib/webflow';
import { generateSeoMetaData, SeoGenerationResult } from '../lib/openai';
import cliProgress from 'cli-progress';
import chalk from 'chalk';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runAudit() {
    console.log(chalk.blue('Starting SEO Audit...'));

    // 1. Fetch all collections
    const { data: collections, error: collectionsError } = await supabase
        .from('collections')
        .select('*');

    if (collectionsError || !collections) {
        console.error('Error fetching collections:', collectionsError);
        return;
    }

    console.log(chalk.green(`Found ${collections.length} collections.`));

    for (const collection of collections) {
        console.log(chalk.yellow(`\nProcessing collection: ${collection.display_name} (${collection.id})`));

        // 2. Get credentials
        let webflowApiKey: string;
        let openaiApiKey: string;

        try {
            webflowApiKey = decrypt(collection.webflow_api_key);
            openaiApiKey = decrypt(collection.openai_api_key);
        } catch (e) {
            console.error(`Error decrypting keys for collection ${collection.id}:`, e);
            continue;
        }

        // 3. Fetch items from Webflow
        let items;
        try {
            items = await getCollectionItems(webflowApiKey, collection.webflow_collection_id);
        } catch (e) {
            console.error(`Error fetching items from Webflow for collection ${collection.id}:`, e);
            continue;
        }

        console.log(`Found ${items.length} items.`);
        
        const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
        progressBar.start(items.length, 0);

        for (const item of items) {
            // Define fields to generate
            const fieldsToGenerate = ['meta-title', 'meta-description'];

            for (const fieldName of fieldsToGenerate) {
                // Check if already generated
                const { data: existing } = await supabase
                    .from('seo_generations')
                    .select('id')
                    .eq('collection_id', collection.id)
                    .eq('webflow_item_id', item.id)
                    .eq('field_name', fieldName)
                    .maybeSingle();

                if (existing) {
                    // Skip if already exists
                    continue;
                }

                // Create generation record
                const { data: generation, error: genError } = await supabase
                    .from('seo_generations')
                    .insert({
                        collection_id: collection.id,
                        webflow_item_id: item.id,
                        field_name: fieldName,
                        status: 'processing'
                    })
                    .select()
                    .single();

                if (genError || !generation) {
                    console.error(`Error creating generation record:`, genError);
                    continue;
                }

                try {
                    // Generate suggestion
                    const result: SeoGenerationResult = await generateSeoMetaData({
                        apiKey: openaiApiKey,
                        itemData: item.fieldData,
                        fieldName: fieldName,
                        siteName: collection.display_name // Approximate site name
                    });

                    // Update generation status
                    await supabase
                        .from('seo_generations')
                        .update({
                            status: 'completed',
                            cost_tokens: 0 // TODO: track usage if possible
                        })
                        .eq('id', generation.id);

                    // Create suggestion
                    await supabase
                        .from('seo_suggestions')
                        .insert({
                            generation_id: generation.id,
                            original_value: item.fieldData[fieldName] || item.fieldData[fieldName.replace('-', '_')] || '', // Try to find original value
                            suggested_value: result.suggestion,
                            review_notes: result.reasoning,
                            status: 'pending'
                        });

                } catch (err: any) {
                    console.error(`Error generating for item ${item.id}:`, err);
                    await supabase
                        .from('seo_generations')
                        .update({
                            status: 'failed',
                            error_code: 500
                        })
                        .eq('id', generation.id);
                }
            }
            progressBar.increment();
        }
        progressBar.stop();
    }
    console.log(chalk.blue('\nAudit completed.'));
}

runAudit().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});







