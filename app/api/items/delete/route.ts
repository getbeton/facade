import { NextRequest, NextResponse } from 'next/server';
import { bulkDeleteItems } from '@/lib/webflow';

export async function POST(request: NextRequest) {
    try {
        const { apiKey, collectionId, itemIds } = await request.json();

        if (!apiKey || !collectionId || !itemIds || itemIds.length === 0) {
            return NextResponse.json(
                { error: 'API key, collection ID, and item IDs are required' },
                { status: 400 }
            );
        }

        const result = await bulkDeleteItems(apiKey, collectionId, itemIds);

        return NextResponse.json({
            success: result.success,
            failed: result.failed,
            message: `Deleted ${result.success} items, ${result.failed} failed`
        });
    } catch (error) {
        console.error('Error in bulk delete:', error);
        return NextResponse.json(
            { error: 'Failed to delete items' },
            { status: 500 }
        );
    }
}
