import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encrypt } from '@/lib/crypto';

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { error } = await supabase
            .from('collections')
            .delete()
            .eq('id', params.id)
            .eq('user_id', user.id);

        if (error) {
            return NextResponse.json({ error: 'Failed to delete collection' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const updates: any = {};

        if (body.webflowApiKey) updates.webflow_api_key = encrypt(body.webflowApiKey);
        if (body.openaiApiKey) updates.openai_api_key = encrypt(body.openaiApiKey);
        if (body.displayName) updates.display_name = body.displayName;

        const { error } = await supabase
            .from('collections')
            .update(updates)
            .eq('id', params.id)
            .eq('user_id', user.id);

        if (error) {
            return NextResponse.json({ error: 'Failed to update collection' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}



