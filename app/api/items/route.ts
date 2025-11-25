import { NextRequest, NextResponse } from 'next/server';
import { getCollectionItems } from '@/lib/webflow';

export async function POST(request: NextRequest) {
    try {
        const { apiKey, collectionId } = await request.json();

        if (!apiKey || !collectionId) {
            return NextResponse.json(
                { error: 'API key and collection ID are required' },
                { status: 400 }
            );
        }

        const items = await getCollectionItems(apiKey, collectionId);

        return NextResponse.json({ items });
    } catch (error) {
        console.error('Error fetching items:', error);
        return NextResponse.json(
            { error: 'Failed to fetch items' },
            { status: 500 }
        );
    }
}
