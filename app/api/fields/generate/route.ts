import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';
import { FieldGenerator } from '@/lib/services/generator/field-generator';
import { getUserFreeTierStatus, incrementFreeTierUsage } from '@/lib/stripe';

type ColumnType = 'PlainText' | 'RichText' | 'Image' | 'Link' | 'User';

interface GenerateRequest {
  collectionId: string;
  items: Array<{ id: string; fieldData: Record<string, any> }>;
  fields: string[]; // field IDs to generate for each item
  columnTypes: Record<string, ColumnType>;
  visibleColumnsCount?: number;
}

interface GeneratedFieldResult {
  itemId: string;
  fieldName: string;
  kind: 'text' | 'image';
  value?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateRequest;
    const { collectionId, items, fields, columnTypes, visibleColumnsCount = 1 } = body;

    if (!collectionId || !Array.isArray(items) || items.length === 0 || !Array.isArray(fields) || fields.length === 0) {
      return NextResponse.json({ error: 'collectionId, items, and fields are required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch collection + keys
    const { data: collection, error: collectionError } = await supabase
      .from('collections')
      .select(`
        id,
        display_name,
        webflow_collection_id,
        site:sites (
          integration:integrations (
            encrypted_openai_key
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
    const encryptedOpenAIKey = integrationObj?.encrypted_openai_key;

    if (!encryptedOpenAIKey) {
      return NextResponse.json({ error: 'No OpenAI key configured for this site' }, { status: 400 });
    }

    const openaiKey = decrypt(encryptedOpenAIKey);
    if (!openaiKey || !openaiKey.startsWith('sk-')) {
      return NextResponse.json({ error: 'Invalid or missing OpenAI key' }, { status: 400 });
    }

    const usesOwnApiKey = Boolean(openaiKey && openaiKey.startsWith('sk-') && !openaiKey.startsWith('FACADE'));
    const generator = new FieldGenerator(openaiKey);

    const totalRequestedFields = items.length * fields.length;
    let freeUsed = 0;

    let freeRemaining = Number.MAX_SAFE_INTEGER;
    if (!usesOwnApiKey) {
      const freeStatus = await getUserFreeTierStatus(user.id, visibleColumnsCount);
      freeRemaining = freeStatus.remaining;
    }

    const results: GeneratedFieldResult[] = [];

    for (const item of items) {
      for (const fieldName of fields) {
        const fieldType: ColumnType = columnTypes[fieldName] || 'PlainText';
        const generatorFieldType: 'PlainText' | 'RichText' | 'Image' =
          fieldType === 'Image' ? 'Image' : (fieldType === 'RichText' ? 'RichText' : 'PlainText');
        const context = { ...item.fieldData };
        delete context[fieldName];

        try {
          const generated = await generator.generate({
            apiKey: openaiKey,
            fieldType: generatorFieldType,
            fieldName,
            context,
            siteContext: collection.display_name,
          });

          if (generatorFieldType === 'Image') {
            const buf = generated as Buffer;
            const dataUrl = `data:image/png;base64,${buf.toString('base64')}`;
            results.push({ itemId: item.id, fieldName, kind: 'image', value: dataUrl });
          } else {
            results.push({ itemId: item.id, fieldName, kind: 'text', value: String(generated) });
          }

          if (!usesOwnApiKey && freeRemaining > 0) {
            freeRemaining -= 1;
            freeUsed += 1;
          }
        } catch (error: any) {
          results.push({
            itemId: item.id,
            fieldName,
            kind: generatorFieldType === 'Image' ? 'image' : 'text',
            error: error?.message || 'Generation failed',
          });
        }
      }
    }

    if (!usesOwnApiKey && freeUsed > 0) {
      await incrementFreeTierUsage(user.id, freeUsed, visibleColumnsCount);
    }

    return NextResponse.json({
      results,
      freeUsed,
      totalRequestedFields,
      remainingFreeAfter: freeRemaining,
      usesOwnApiKey,
    });
  } catch (error: any) {
    console.error('[generate-fields] error', error);
    return NextResponse.json({ error: error?.message || 'Failed to generate fields' }, { status: 500 });
  }
}

