import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { DiscoveryService } from '@/lib/services/discovery';

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { webflowApiKey, openaiApiKey, managedOpenai = false } = body;

        if (!webflowApiKey) {
            return NextResponse.json({ error: 'Missing Webflow API key' }, { status: 400 });
        }

        // When managed mode is enabled we do not require a user OpenAI key; use a placeholder.
        const openaiKeyToUse = managedOpenai ? 'managed' : openaiApiKey;
        if (!openaiKeyToUse) {
            return NextResponse.json({ error: 'Missing OpenAI API key' }, { status: 400 });
        }

        const discovery = new DiscoveryService(supabase);

        // 1. Connect Integration
        const integration = await discovery.connectIntegration(user.id, webflowApiKey, openaiKeyToUse);

        // 2. Initial Scan (Fetch Sites)
        const sites = await discovery.scanAccount(integration.id);

        return NextResponse.json({ 
            success: true, 
            integration, 
            sites 
        });

    } catch (error) {
        console.error('Error in /api/connect:', error);
        return NextResponse.json({ 
            error: error instanceof Error ? error.message : 'Internal Server Error' 
        }, { status: 500 });
    }
}
