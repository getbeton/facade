const fs = require('fs');
const path = require('path');

// Try to load dotenv if available, otherwise rely on --env-file or pre-loaded env
try {
    const envPath = fs.existsSync('.env.local') ? '.env.local' : path.join(__dirname, '../.env.local');
    if (fs.existsSync(envPath)) {
        require('dotenv').config({ path: envPath });
    }
} catch (e) {
    // dotenv not found, ignore
}

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Config
const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = 'billing.test.user.123@gmail.com'; // Changed from example.com to avoid validation errors
const TEST_PASSWORD = 'password123';

// Colors for console
const red = '\x1b[31m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const reset = '\x1b[0m';

const log = (msg) => console.log(msg);
const success = (msg) => console.log(`${green}✅ ${msg}${reset}`);
const fail = (msg) => console.log(`${red}❌ ${msg}${reset}`);
const info = (msg) => console.log(`${yellow}ℹ️ ${msg}${reset}`);

async function runTests() {
    log('🚀 Starting Billing System Local Tests...\n');

    // 1. Setup Supabase Client
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        fail('Missing Supabase credentials in .env.local');
        return;
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 2. Authentication (Get JWT)
    info('Step 1: Authenticating Test User...');
    let { data: { user, session }, error } = await supabaseAdmin.auth.signInWithPassword({
        email: TEST_EMAIL,
        password: TEST_PASSWORD
    });

    if (error) {
        info('Sign in failed, checking if user exists...');
        
        // Check if user exists via Admin API to clean up stale state
        // Note: listUsers pagination default is 50, usually fine for local dev
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = users?.find(u => u.email === TEST_EMAIL);

        if (existingUser) {
            info('User exists but sign in failed (likely unconfirmed). Deleting and re-creating...');
            await supabaseAdmin.auth.admin.deleteUser(existingUser.id);
        } else {
            info('User not found, creating new test user...');
        }
        
        // Use admin.createUser to auto-confirm email
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: TEST_EMAIL,
            password: TEST_PASSWORD,
            email_confirm: true,
            user_metadata: { full_name: 'Billing Test User' }
        });
        
        if (createError) {
            fail(`Failed to create user: ${createError.message}`);
            return;
        }
        
        // Now sign in to get the session
        const signIn = await supabaseAdmin.auth.signInWithPassword({
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        });
        
        if (signIn.error) {
            fail(`Failed to sign in after creation: ${signIn.error.message}`);
            return;
        }
        
        user = signIn.data.user;
        session = signIn.data.session;
    }

    if (!session) {
        // If signup didn't return session (email confirm required), we might be stuck.
        // Try admin sign in or assume auto-confirm is on.
        // For local dev, usually email confirm is off or we can use admin to generate link.
        fail('Could not get session. Ensure Email Confirm is disabled locally or user exists.');
        return;
    }

    const token = session.access_token;
    success(`Authenticated as ${user.email} (ID: ${user.id})`);

    const api = axios.create({
        baseURL: BASE_URL,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        validateStatus: () => true // Don't throw on 4xx/5xx
    });

    // 3. Reset User State (Free Generations)
    info('\nStep 2: Resetting User State...');
    await supabaseAdmin
        .from('profiles')
        .update({ free_generations_used: 0 })
        .eq('id', user.id);
    
    // Clean up old test collections
    const { data: oldCols } = await supabaseAdmin.from('collections').select('id').eq('user_id', user.id);
    if (oldCols?.length) {
        await supabaseAdmin.from('collections').delete().eq('user_id', user.id);
    }
    success('User state reset (0 free generations used)');

    // 4. Create Test Collections via API
    info('\nStep 3: Creating Test Collections...');
    
    // Collection A: No API Key (Uses Facade Key / Billing)
    const colARes = await api.post('/api/collections', {
        siteId: 'test-site-billing',
        siteName: 'Test Site',
        siteShortName: 'TS',
        webflowCollectionId: 'wf-col-billing',
        collectionDisplayName: 'Billing Test Collection',
        webflowApiKey: 'wf-test-key',
        openaiApiKey: 'FACADE-MANAGED' // Explicit placeholder
    });

    if (colARes.status !== 200) {
        fail(`Failed to create Collection A: ${colARes.status} ${JSON.stringify(colARes.data)}`);
        return;
    }
    const collectionA = colARes.data.collection;
    success(`Created Collection A (No Own Key): ${collectionA.id}`);

    // Collection B: With Own API Key
    const colBRes = await api.post('/api/collections', {
        siteId: 'test-site-byok',
        siteName: 'Test Site BYOK',
        siteShortName: 'BYOK',
        webflowCollectionId: 'wf-col-byok',
        collectionDisplayName: 'BYOK Test Collection',
        webflowApiKey: 'wf-test-key',
        openaiApiKey: 'sk-test-fake-key-123456' // Looks like real key
    });

    if (colBRes.status !== 200) {
        fail(`Failed to create Collection B: ${colBRes.status}`);
        return;
    }
    const collectionB = colBRes.data.collection;
    success(`Created Collection B (Own Key): ${collectionB.id}`);

    // 5. Test Billing Check - Free Tier
    info('\nStep 4: Testing Free Tier Check...');
    const check1 = await api.post('/api/billing/check-status', {
        collectionId: collectionA.id,
        itemCount: 5
    });

    if (check1.data.requiresPayment === false && check1.data.reason === 'free_tier') {
        success('Free Tier Check Passed: Payment not required for 5 items');
    } else {
        fail(`Free Tier Check Failed: ${JSON.stringify(check1.data)}`);
    }

    // 6. Test Billing Check - Payment Required
    info('\nStep 5: Testing Payment Required Check...');
    // Simulate used up free tier
    await supabaseAdmin.from('profiles').update({ free_generations_used: 5 }).eq('id', user.id);
    
    const check2 = await api.post('/api/billing/check-status', {
        collectionId: collectionA.id,
        itemCount: 1
    });

    if (check2.data.requiresPayment === true && check2.data.itemsToCharge === 1) {
        success('Payment Required Check Passed: Payment required after limit reached');
    } else {
        fail(`Payment Required Check Failed: ${JSON.stringify(check2.data)}`);
    }

    // 7. Test Billing Check - Own API Key
    info('\nStep 6: Testing Own API Key Check...');
    const check3 = await api.post('/api/billing/check-status', {
        collectionId: collectionB.id,
        itemCount: 100
    });

    if (check3.data.requiresPayment === false && check3.data.reason === 'own_api_key') {
        success('BYOK Check Passed: No payment required with own key');
    } else {
        fail(`BYOK Check Failed: ${JSON.stringify(check3.data)}`);
    }

    // 8. Test Stripe Checkout Creation
    info('\nStep 7: Creating Stripe Checkout Session...');
    const itemIds = ['item1', 'item2', 'item3'];
    const checkoutRes = await api.post('/api/stripe/create-checkout', {
        collectionDbId: collectionA.id,
        webflowCollectionId: 'wf-col-billing',
        itemIds: itemIds,
        collectionName: 'Billing Test Collection'
    });

    if (checkoutRes.status === 200 && checkoutRes.data.url) {
        success(`Checkout Session Created: ${checkoutRes.data.url}`);
    } else {
        fail(`Checkout Creation Failed: ${JSON.stringify(checkoutRes.data)}`);
        return;
    }

    // 9. Simulate Stripe Webhook
    info('\nStep 8: Simulating Stripe Webhook...');
    
    const paymentId = crypto.randomUUID(); // Note: Webhook will generate its own UUID, so we can't predict it easily unless we query after.
    const stripePaymentIntentId = `pi_mock_${Date.now()}`;
    const stripeSessionId = `cs_mock_${Date.now()}`;

    // Construct valid Stripe event payload
    const payload = {
        id: `evt_mock_${Date.now()}`,
        object: 'event',
        api_version: '2024-12-18.acacia',
        created: Math.floor(Date.now() / 1000),
        type: 'checkout.session.completed',
        data: {
            object: {
                id: stripeSessionId,
                object: 'checkout.session',
                payment_intent: stripePaymentIntentId,
                amount_total: 267, // 3 * 89
                currency: 'usd',
                payment_status: 'paid',
                status: 'complete',
                metadata: {
                    userId: user.id,
                    collectionDbId: collectionA.id, // Our DB UUID
                    collectionId: 'wf-col-billing', // Webflow ID
                    collectionName: 'Billing Test Collection',
                    itemsCount: '3',
                    itemIds: JSON.stringify(itemIds)
                },
                customer: 'cus_test_123'
            }
        }
    };

    try {
        // Try to sign the payload if Stripe key is available
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const payloadString = JSON.stringify(payload);
        
        // Use webhook secret to sign
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET missing');

        const signature = stripe.webhooks.generateTestHeaderString({
            payload: payloadString,
            secret: secret,
        });

        // Hit the real webhook endpoint
        const webhookRes = await api.post('/api/webhooks/stripe', payload, {
            headers: {
                'Stripe-Signature': signature
            }
        });

        if (webhookRes.status === 200) {
            success('Webhook Endpoint Accepted Request');
        } else {
            fail(`Webhook Endpoint Rejected: ${webhookRes.status} ${JSON.stringify(webhookRes.data)}`);
            // Fallback to manual insert so test continues?
            // throw new Error('Webhook failed');
        }

    } catch (e) {
        info(`Could not use real webhook (Error: ${e.message}). Falling back to manual DB insert...`);
        
        // Fallback: Manual Insert
        const { error: payError } = await supabaseAdmin.from('payments').insert({
            // id: paymentId, // Let DB generate ID
            user_id: user.id,
            stripe_payment_intent_id: stripePaymentIntentId,
            stripe_checkout_session_id: stripeSessionId,
            amount_cents: 267,
            collection_id: collectionA.id,
            collection_name: 'Billing Test Collection',
            items_count: 3,
            status: 'pending',
            item_ids: itemIds,
            generation_logs_count: 3,
            generation_started: false
        }).select().single();

        if (payError) {
            fail(`Failed to insert mock payment: ${payError.message}`);
            return;
        }
        success('Mock Payment Record Inserted (Fallback)');
        
        // Insert logs manually too
        const logs = itemIds.map(id => ({
            user_id: user.id,
            collection_id: collectionA.id,
            webflow_collection_id: 'wf-col-billing',
            webflow_item_id: id,
            // payment_id: ... we'd need the ID from insert above
            status: 'pending',
            cost_cents: 89
        }));
        // Skipping log insert for fallback to keep simple, or would need to fetch payment ID
    }

    // 10. Check Payment Status Endpoint
    info('\nStep 9: Checking Payment Status API...');
    // Give webhook a moment to process
    await new Promise(r => setTimeout(r, 1000));
    
    const statusRes = await api.get(`/api/payment-status?session_id=${stripeSessionId}`);

    if (statusRes.data.status === 'pending') {
        success('Payment Status Check Passed');
        // Capture the real payment ID from the API response
        const realPaymentId = statusRes.data.paymentId;
        
        // 11. Test Generation Start (Mock)
        info('\nStep 10: Testing Generation Trigger...');
        try {
            const genRes = await fetch(`${BASE_URL}/api/generate-images`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    collectionId: collectionA.id,
                    itemIds: itemIds,
                    paymentId: realPaymentId
                })
            });

            if (genRes.ok) {
                success('Generation Endpoint Accepted Request');
            } else {
                fail(`Generation Endpoint Rejected Request: ${genRes.status}`);
            }
        } catch (e) {
            fail(`Generation Request Error: ${e.message}`);
        }

    } else {
        fail(`Payment Status Check Failed: ${JSON.stringify(statusRes.data)}`);
    }

    log('\n🏁 Tests Completed.');
}

runTests().catch(e => console.error(e));

