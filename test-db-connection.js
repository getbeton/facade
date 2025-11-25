const { createClient } = require('@supabase/supabase-js');

// Manually pasting from .env.local since source command was failing/weird
const supabaseUrl = 'https://sthidehegwyiwoishltl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0aGlkZWhlZ3d5aXdvaXNobHRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMjQ0MDEsImV4cCI6MjA3OTYwMDQwMX0.0bKOGzuOB0dzaZtfHJyKUohlOYb16eew9UmHB9TtEBc';

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
