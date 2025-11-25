import { NextRequest, NextResponse } from 'next/server';
import { getCollections } from '@/lib/webflow';

export async function POST(request: NextRequest) {
    try {
        const { apiKey, siteId } = await request.json();

        if (!apiKey || !siteId) {
            return NextResponse.json(
                { error: 'API key and site ID are required' },
                { status: 400 }
            );
        }

        const collections = await getCollections(apiKey, siteId);

        return NextResponse.json({ collections });
    } catch (error) {
        console.error('Error fetching collections:', error);
        return NextResponse.json(
            { error: 'Failed to fetch collections' },
            { status: 500 }
        );
    }
}
