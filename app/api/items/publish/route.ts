import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';
import { uploadImageToWebflow, updateCollectionItem } from '@/lib/webflow';
import { PublishLink, PublishStreamEvent } from '@/lib/types';

type StagedField =
  | { kind: 'text'; value: string }
  | { kind: 'image'; value: string; fileName?: string };

interface PublishRequest {
  collectionId: string;
  changes: Record<string, Record<string, StagedField>>; // itemId -> field -> staged data
  itemsMeta?: Record<string, { slug?: string | null; name?: string | null }>;
}

const encoder = new TextEncoder();

const dataUrlToBuffer = (dataUrl: string): Buffer => {
  const [, base64] = dataUrl.split(',');
  return Buffer.from(base64, 'base64');
};

const buildItemUrl = (baseUrl: string | null, slug?: string | null) => {
  if (!baseUrl || !slug) return null;
  const sanitizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${sanitizedBase}/${slug}`;
};

export async function POST(request: NextRequest) {
  try {
    const { collectionId, changes, itemsMeta = {} } = (await request.json()) as PublishRequest;

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
        site_id,
        webflow_collection_id,
        site:sites (
          id,
          short_name,
          preview_url,
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
    const baseUrl = siteObj?.preview_url || (siteObj?.short_name ? `https://${siteObj.short_name}.webflow.io` : null);

    // Pre-compute totals for logging and client progress.
    const totalItems = Object.keys(changes).length;
    const totalFields = Object.values(changes).reduce((sum, fields) => sum + Object.keys(fields || {}).length, 0);

    // Record the publication so we keep an audit trail regardless of UI state.
    const { data: publicationRow, error: publicationError } = await supabase
      .from('publications')
      .insert({
        user_id: user.id,
        collection_id: collection.id,
        site_id: siteId,
        webflow_collection_id: webflowCollectionId,
        total_items: totalItems,
        total_fields: totalFields,
        started_at: new Date().toISOString(),
        status: 'processing',
      })
      .select()
      .single();

    if (publicationError || !publicationRow) {
      console.error('[publish-items] failed to create publication log', publicationError);
      return NextResponse.json({ error: 'Unable to create publication log' }, { status: 500 });
    }

    const publicationId = publicationRow.id;
    console.log('[publish-items] publish start', { collectionId, publicationId, totalItems, totalFields });

    // Stream per-item progress to the client; do not stop if a single item fails.
    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: PublishStreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(payload) + '\n'));

        send({
          type: 'started',
          publicationId,
          totalItems,
          totalFields,
          message: 'Publishing items to Webflow...',
        });

        let itemsSucceeded = 0;
        let itemsFailed = 0;
        let fieldsSucceeded = 0;
        let fieldsFailed = 0;
        const links: PublishLink[] = [];

        for (const [itemId, fields] of Object.entries(changes)) {
          const meta = (itemsMeta as Record<string, { slug?: string | null }>)[itemId] || {};
          const slug = meta.slug ?? null;
          const itemUrl = buildItemUrl(baseUrl, slug);
          const fieldTotal = Object.keys(fields || {}).length;

          let preparedFailures = 0;
          const fieldData: Record<string, any> = {};

          // Prepare field payloads (image uploads are handled one by one)
          for (const [fieldName, staged] of Object.entries(fields || {})) {
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
              preparedFailures += 1;
              console.error(`[publish-items] image upload failed for item ${itemId} field ${fieldName}`, error);
            }
          }

          // Log per-item record early so background job is traceable
          const { data: publicationItem, error: publicationItemError } = await supabase
            .from('publication_items')
            .insert({
              publication_id: publicationId,
              collection_id: collection.id,
              webflow_item_id: itemId,
              slug,
              published_url: itemUrl,
              fields_total: fieldTotal,
              status: 'processing',
            })
            .select()
            .single();

          if (publicationItemError) {
            console.error('[publish-items] failed to log publication item', publicationItemError);
          }

          let itemFieldsSucceeded = 0;
          let itemFieldsFailed = preparedFailures;
          let itemStatus: 'succeeded' | 'failed' = 'succeeded';
          let itemError: string | null = null;

          if (Object.keys(fieldData).length === 0) {
            itemStatus = 'failed';
            itemError = 'No fields ready to publish';
            itemFieldsFailed = fieldTotal || preparedFailures || 0;
            itemsFailed += 1;
            fieldsFailed += itemFieldsFailed;
          } else {
            try {
              await updateCollectionItem(webflowApiKey, webflowCollectionId, itemId, fieldData);
              itemFieldsSucceeded = Object.keys(fieldData).length;
              itemFieldsFailed += 0; // only prepared failures count as failed
              itemsSucceeded += 1;
              fieldsSucceeded += itemFieldsSucceeded;
              fieldsFailed += itemFieldsFailed;
            } catch (error: any) {
              itemStatus = 'failed';
              itemError = error?.message || 'Failed to update item';
              itemFieldsFailed += Object.keys(fieldData).length;
              itemsFailed += 1;
              fieldsFailed += itemFieldsFailed;
            }
          }

          if (publicationItem) {
            await supabase
              .from('publication_items')
              .update({
                status: itemStatus,
                fields_succeeded: itemFieldsSucceeded,
                fields_failed: itemFieldsFailed,
                error_message: itemError,
                completed_at: new Date().toISOString(),
              })
              .eq('id', publicationItem.id);
          }

          const appliedFields = itemStatus === 'succeeded' ? Object.keys(fieldData) : [];

          links.push({
            itemId,
            slug,
            url: itemUrl,
            status: itemStatus,
            error: itemError || null,
          });

          send({
            type: 'item',
            publicationId,
            itemId,
            slug,
            url: itemUrl,
            fieldsSucceeded: itemFieldsSucceeded,
            fieldsFailed: itemFieldsFailed,
            itemsCompleted: itemsSucceeded,
            itemsFailed,
            appliedFields,
            status: itemStatus,
            message: itemStatus === 'succeeded' ? 'Published' : itemError || 'Publish failed',
            error: itemError || undefined,
          });
        }

        const finalStatus = itemsFailed > 0 && itemsSucceeded > 0
          ? 'partial'
          : itemsFailed > 0
            ? 'failed'
            : 'completed';

        await supabase
          .from('publications')
          .update({
            status: finalStatus,
            items_succeeded: itemsSucceeded,
            items_failed: itemsFailed,
            fields_succeeded: fieldsSucceeded,
            fields_failed: fieldsFailed,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', publicationId);

        send({
          type: 'completed',
          status: finalStatus,
          publicationId,
          totalItems,
          totalFields,
          itemsSucceeded,
          itemsFailed,
          fieldsSucceeded,
          fieldsFailed,
          links,
          message: finalStatus === 'completed'
            ? 'Published successfully'
            : 'Publish finished with some errors',
        });

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  } catch (error: any) {
    console.error('[publish-items] error', error);
    return NextResponse.json({ error: error?.message || 'Failed to publish' }, { status: 500 });
  }
}
