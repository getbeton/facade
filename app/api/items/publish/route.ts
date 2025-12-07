import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';
import { uploadImageToWebflow, updateCollectionItem } from '@/lib/webflow';

type StagedField =
  | { kind: 'text'; value: string }
  | { kind: 'image'; value: string; fileName?: string };

interface PublishRequest {
  collectionId: string;
  changes: Record<string, Record<string, StagedField>>; // itemId -> field -> staged data
}

const dataUrlToBuffer = (dataUrl: string): Buffer => {
  const [, base64] = dataUrl.split(',');
  return Buffer.from(base64, 'base64');
};

export async function POST(request: NextRequest) {
  try {
    const { collectionId, changes } = (await request.json()) as PublishRequest;

    if (!collectionId || !changes || Object.keys(changes).length === 0) {
      return NextResponse.json({ error: 'collectionId and changes are required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: collection, error: collectionError } = await supabase
      .from('collections')
      .select(`
        id,
        webflow_collection_id,
        site_id,
        site:sites (
          integration:integrations (
            encrypted_webflow_key
          )
        )
      `)
      .eq('id', collectionId)
      .eq('user_id', user.id)
      .single();

    if (collectionError || !collection) {
      return NextResponse.json({ error: 'Collection not found or access denied' }, { status: 404 });
    }

    const site = (collection as any).site;
    const siteObj = Array.isArray(site) ? site[0] : site;
    const integration = siteObj?.integration;
    const integrationObj = Array.isArray(integration) ? integration[0] : integration;
    const encryptedWebflowKey = integrationObj?.encrypted_webflow_key;

    if (!encryptedWebflowKey) {
      return NextResponse.json({ error: 'No Webflow key configured' }, { status: 400 });
    }

    const webflowApiKey = decrypt(encryptedWebflowKey);
    const webflowCollectionId = collection.webflow_collection_id;
    const siteId = collection.site_id;

    let success = 0;
    let failed = 0;
    const errors: Record<string, string> = {};

    for (const [itemId, fields] of Object.entries(changes)) {
      const fieldData: Record<string, any> = {};

      for (const [fieldName, staged] of Object.entries(fields)) {
        if (staged.kind === 'text') {
          fieldData[fieldName] = staged.value;
          continue;
        }

        try {
          const buffer = dataUrlToBuffer(staged.value);
          const fileName = staged.fileName || `${fieldName}-${itemId}.png`;
          const asset = await uploadImageToWebflow(buffer, fileName, webflowApiKey, siteId);
          fieldData[fieldName] = asset.id;
        } catch (error: any) {
          failed += 1;
          errors[itemId] = error?.message || 'Failed to upload image';
        }
      }

      if (Object.keys(fieldData).length === 0) continue;

      try {
        await updateCollectionItem(webflowApiKey, webflowCollectionId, itemId, fieldData);
        success += 1;
      } catch (error: any) {
        failed += 1;
        errors[itemId] = error?.message || 'Failed to update item';
      }
    }

    return NextResponse.json({ success, failed, errors });
  } catch (error: any) {
    console.error('[publish-items] error', error);
    return NextResponse.json({ error: error?.message || 'Failed to publish' }, { status: 500 });
  }
}

