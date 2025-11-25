import { NextRequest, NextResponse } from 'next/server';
import { bulkUpdateItems, updateCollectionItem } from '@/lib/webflow';

export async function POST(request: NextRequest) {
    try {
        const { apiKey, collectionId, itemIds, fieldName, value, singleItem } = await request.json();

        if (!apiKey || !collectionId) {
            return NextResponse.json(
                { error: 'API key and collection ID are required' },
                { status: 400 }
            );
        }

        // Single item update (inline editing)
        if (singleItem && itemIds && itemIds.length === 1 && fieldName) {
            const fieldData = { [fieldName]: value };
            await updateCollectionItem(apiKey, collectionId, itemIds[0], fieldData);
            return NextResponse.json({
                success: 1,
                failed: 0,
                message: 'Item updated successfully'
            });
        }

        // Bulk update
        if (!itemIds || itemIds.length === 0 || !fieldName) {
            return NextResponse.json(
                { error: 'Item IDs and field name are required for bulk update' },
                { status: 400 }
            );
        }

        const result = await bulkUpdateItems(apiKey, collectionId, itemIds, fieldName, value);

        return NextResponse.json({
            success: result.success,
            failed: result.failed,
            message: `Updated ${result.success} items, ${result.failed} failed`
        });
    } catch (error) {
        console.error('Error in bulk update:', error);
        return NextResponse.json(
            { error: 'Failed to update items' },
            { status: 500 }
        );
    }
}
