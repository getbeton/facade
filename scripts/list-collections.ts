import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listCollections() {
    const { data: collections, error } = await supabase
        .from('collections')
        .select('id, display_name, webflow_collection_id, site:sites(name)');

    if (error) {
        console.error('Error fetching collections:', error);
        return;
    }

    console.log('Available Collections:');
    collections.forEach(c => {
        console.log(`- [${c.display_name}] (Site: ${(c.site as any)?.name})`);
        console.log(`  ID: ${c.id}`);
        console.log(`  Webflow ID: ${c.webflow_collection_id}`);
        console.log('---');
    });
}

listCollections();


