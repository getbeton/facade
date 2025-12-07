import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

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

async function setupDevUser() {
    const email = 'dev@example.com';
    const password = 'password123';

    console.log(`Checking/Creating dev user: ${email}`);

    // Check if user exists (by listing users, limited to 1 for simplicity if unique search supported, 
    // but listUsers doesn't filter by email easily without iterating or exact match if supported?)
    // Actually admin.listUsers() doesn't filter by email.
    // Try createUser, if it fails with "User already registered", then we list to find ID.

    let userId: string;

    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
    });

    if (createError) {
        // Assume user exists, try to find it
        // Note: listUsers is paginated.
        const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) {
            console.error('Failed to list users:', listError);
            return;
        }
        
        const existingUser = usersData.users.find(u => u.email === email);
        if (!existingUser) {
            console.error('User creation failed and user not found in list (maybe paginated out?):', createError);
            return;
        }
        userId = existingUser.id;
        console.log(`User already exists. ID: ${userId}`);
    } else {
        userId = newUser.user.id;
        console.log(`User created. ID: ${userId}`);
    }

    // Upsert into public.profiles
    // Note: The trigger on auth.users usually handles this, but let's ensure it exists.
    const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
            id: userId,
            email: email,
            free_generations_used: 0
        }, { onConflict: 'id' });

    if (profileError) {
        console.error('Error upserting profile:', profileError);
    } else {
        console.log('Profile ensured.');
    }

    console.log('\n--- DEV USER SETUP COMPLETE ---');
    console.log(`UUID: ${userId}`);
    console.log('Use this UUID in your development mocks.');
}

setupDevUser().catch(console.error);







