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
        const { collectionId } = body;

        if (!collectionId) {
            return NextResponse.json({ error: 'Missing collectionId' }, { status: 400 });
        }

        const discovery = new DiscoveryService(supabase);

        // Deep analyze collection
        const stats = await discovery.analyzeCollection(collectionId);

        return NextResponse.json({ 
            success: true, 
            stats 
        });

    } catch (error) {
        console.error('Error in /api/scan/analyze:', error);
        return NextResponse.json({ 
            error: error instanceof Error ? error.message : 'Internal Server Error' 
        }, { status: 500 });
    }
}


