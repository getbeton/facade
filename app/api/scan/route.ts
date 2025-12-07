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
        const { integrationId, siteId } = body;

        if (!integrationId || !siteId) {
            return NextResponse.json({ error: 'Missing integrationId or siteId' }, { status: 400 });
        }

        const discovery = new DiscoveryService(supabase);

        // Scan collections for the site
        const collections = await discovery.scanSite(integrationId, siteId);

        return NextResponse.json({ 
            success: true, 
            collections 
        });

    } catch (error) {
        console.error('Error in /api/scan:', error);
        return NextResponse.json({ 
            error: error instanceof Error ? error.message : 'Internal Server Error' 
        }, { status: 500 });
    }
}
