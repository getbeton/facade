import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const { id } = params;
    
    if (!id) {
        return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const body = await request.json();
    const { status, suggested_value } = body;

    if (!status && !suggested_value) {
        return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const supabase = await createClient();

    try {
        const updates: any = {};
        if (status) updates.status = status;
        if (suggested_value) updates.suggested_value = suggested_value;

        const { data, error } = await supabase
            .from('seo_suggestions')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ suggestion: data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}







