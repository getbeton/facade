import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const collectionId = searchParams.get('collectionId');

    if (!collectionId) {
        return NextResponse.json({ error: 'Missing collectionId' }, { status: 400 });
    }

    const supabase = await createClient();

    try {
        // Fetch suggestions for the collection
        // We join with seo_generations to get field_name and webflow_item_id
        const { data, error } = await supabase
            .from('seo_suggestions')
            .select(`
                *,
                generation:seo_generations (
                    collection_id,
                    webflow_item_id,
                    field_name
                )
            `)
            .eq('generation.collection_id', collectionId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching suggestions:', error);
            // If the error is due to the join filtering not working directly in top-level, we might need to filter manually or use inner join syntax if Supabase supports it cleanly in one go with RLS.
            // Actually, querying nested fields in filter (.eq('generation.collection_id', ...)) works in Supabase JS client.
            throw error;
        }

        // Filter out null generations (if any left join issues, though inner join is implied by the filter)
        // The .eq filter on joined table usually implies inner join behavior for the result set.
        const filteredData = data?.filter(item => item.generation !== null) || [];

        return NextResponse.json({ suggestions: filteredData });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}







