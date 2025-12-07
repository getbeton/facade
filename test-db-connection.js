const { createClient } = require('@supabase/supabase-js');

// Use environment variables or local setup instructions
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log('Testing connection to:', supabaseUrl);

    // 1. Test sites table visibility
    const { data: sites, error: sitesError } = await supabase
        .from('sites')
        .select('*')
        .limit(1);

    if (sitesError) {
        console.error('Sites table error:', sitesError);
    } else {
        console.log('Sites table access successful. Rows:', sites.length);
    }

    // 2. Test collections table visibility
    const { data: cols, error: colsError } = await supabase
        .from('collections')
        .select('*')
        .limit(1);

    if (colsError) {
        console.error('Collections table error:', colsError);
    } else {
        console.log('Collections table access successful. Rows:', cols.length);
    }
}

test();
