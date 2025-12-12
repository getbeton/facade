import { createClient } from '@/lib/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { encrypt, decrypt } from '@/lib/crypto';
import { 
    getAllSites, 
    getCollections, 
    getCollectionCount, 
    validateWebflowToken,
    getCollectionItems
} from '@/lib/webflow';
import { validateOpenAIKey } from '@/lib/openai';

export interface DiscoveryStats {
    totalItems: number;
    itemsMissingOgImage: number;
    opportunityScore: number; // 0-100
}

export class DiscoveryService {
    private supabase: SupabaseClient;

    constructor(supabaseClient: SupabaseClient) {
        this.supabase = supabaseClient;
    }

    /**
     * Pick the preferred domain for a site (custom first, fallback to webflow subdomain)
     */
    private deriveDomains(site: { shortName?: string; customDomains?: Array<{ url: string }> | null }) {
        const webflowDomain = site.shortName
            ? (site.shortName.includes('.') ? site.shortName : `${site.shortName}.webflow.io`)
            : null;
        const firstCustom = site.customDomains?.[0]?.url;
        const normalizedCustom = firstCustom
            ? firstCustom.replace(/^https?:\/\//, '').replace(/\/$/, '')
            : null;

        const domains = {
            primary: normalizedCustom || webflowDomain || null,
            webflow: webflowDomain || null,
            customDomains: site.customDomains || null,
        };
        console.log('[discovery] deriveDomains', { shortName: site.shortName, primary: domains.primary, webflow: domains.webflow });
        return domains;
    }

    /**
     * Step 1: Validate keys and create/update integration record
     */
    async connectIntegration(userId: string, webflowKey: string, openaiKey: string) {
        // 1. Validate Keys
        const isWebflowValid = await validateWebflowToken(webflowKey);
        if (!isWebflowValid) throw new Error('Invalid Webflow API Token');

        // Only validate OpenAI key if it looks like a real key (not a placeholder/facade for dev)
        // If it starts with 'sk-', we assume it's real and validate.
        if (openaiKey.startsWith('sk-')) {
            const isOpenAIValid = await validateOpenAIKey(openaiKey);
            if (!isOpenAIValid) throw new Error('Invalid OpenAI API Key');
        }

        // 2. Encrypt
        const encryptedWebflow = encrypt(webflowKey);
        const encryptedOpenAI = encrypt(openaiKey);

        // 3. Upsert Integration
        // We assume one active integration per user for this SaaS model (or at least one per provider)
        // For now, simple insert.
        const { data: integration, error } = await this.supabase
            .from('integrations')
            .insert({
                user_id: userId,
                provider: 'webflow',
                encrypted_webflow_key: encryptedWebflow,
                encrypted_openai_key: encryptedOpenAI,
                status: 'active'
            })
            .select()
            .single();

        if (error) throw new Error(`Failed to create integration: ${error.message}`);
        return integration;
    }

    /**
     * Step 2: Scan account for all sites
     */
    async scanAccount(integrationId: string) {
        // 1. Get credentials
        const { data: integration } = await this.supabase
            .from('integrations')
            .select('encrypted_webflow_key, user_id')
            .eq('id', integrationId)
            .single();
        
        if (!integration) throw new Error('Integration not found');

        const webflowKey = decrypt(integration.encrypted_webflow_key);

        // 2. Fetch from Webflow
        const webflowSites = await getAllSites(webflowKey);

        // 3. Upsert to DB
        const sitesToUpsert = webflowSites.map(site => {
            const domains = this.deriveDomains(site);
            return {
                id: site.id,
                user_id: integration.user_id,
                integration_id: integrationId,
                name: site.displayName,
                short_name: site.shortName,
                primary_domain: domains.primary,
                webflow_domain: domains.webflow,
                custom_domains: domains.customDomains,
                preview_url: site.previewUrl,
                favicon_url: site.faviconUrl,
                last_synced_at: new Date().toISOString()
            };
        });

        if (sitesToUpsert.length > 0) {
            const { error } = await this.supabase
                .from('sites')
                .upsert(sitesToUpsert, { onConflict: 'id' });
            
            if (error) throw new Error(`Failed to sync sites: ${error.message}`);
        }

        return webflowSites;
    }

    /**
     * Step 3: Scan a specific site for collections and simple stats
     */
    async scanSite(integrationId: string, siteId: string) {
        // 1. Get credentials
        const { data: integration } = await this.supabase
            .from('integrations')
            .select('encrypted_webflow_key, user_id')
            .eq('id', integrationId)
            .single();
        
        if (!integration) throw new Error('Integration not found');
        const webflowKey = decrypt(integration.encrypted_webflow_key);

        // 2. Fetch Collections
        const webflowCollections = await getCollections(webflowKey, siteId);

        // 2b. Fetch site domain context to build item URL bases
        const { data: siteRecord } = await this.supabase
            .from('sites')
            .select('short_name, primary_domain, webflow_domain')
            .eq('id', siteId)
            .single();
        const preferredDomain = siteRecord?.primary_domain || siteRecord?.webflow_domain || null;

        // 3. Sync Collections
        // Note: We no longer store API keys on the collection
        const collectionsToUpsert = webflowCollections.map(col => {
            const urlBase = preferredDomain ? `https://${preferredDomain.replace(/\/$/, '')}/${col.slug}` : null;
            console.log('[discovery] collection url base', { siteId, collectionId: col.id, urlBase });
            return {
                user_id: integration.user_id,
                site_id: siteId,
                webflow_collection_id: col.id,
                display_name: col.displayName,
                collection_slug: col.slug,
                url_base: urlBase,
                updated_at: new Date().toISOString()
            };
        });

        // We need to upsert based on webflow_collection_id, but our PK is UUID.
        // We can look them up first or use a unique constraint on webflow_collection_id.
        // For now, let's look up existing ones to preserve UUIDs if they exist.
        
        const results = [];
        for (const col of collectionsToUpsert) {
            // Check existence
            const { data: existing } = await this.supabase
                .from('collections')
                .select('id')
                .eq('webflow_collection_id', col.webflow_collection_id)
                .single();
            
            let result;
            if (existing) {
                const { data, error } = await this.supabase
                    .from('collections')
                    .update(col)
                    .eq('id', existing.id)
                    .select()
                    .single();
                if (error) console.error('Error updating collection:', error);
                result = data;
            } else {
                const { data, error } = await this.supabase
                    .from('collections')
                    .insert(col)
                    .select()
                    .single();
                if (error) console.error('Error inserting collection:', error);
                result = data;
            }
            if (result) results.push(result);
        }

        return results;
    }

    /**
     * Step 4: Deep analyze a collection for opportunity score
     * (Items missing OG images)
     */
    async analyzeCollection(collectionDbId: string): Promise<DiscoveryStats> {
        // 1. Get Collection & Integration
        const { data: collection } = await this.supabase
            .from('collections')
            .select(`
                *,
                site:sites(
                    integration:integrations(encrypted_webflow_key)
                )
            `)
            .eq('id', collectionDbId)
            .single();
            
        if (!collection || !collection.site?.integration) {
            throw new Error('Collection or Integration not found');
        }

        const webflowKey = decrypt(collection.site.integration.encrypted_webflow_key);

        // 2. Fetch Items (First page or summary?)
        // Fetching all might be slow for huge collections, but accurate.
        // Let's stick to getCollectionItems (fetches all pages) for now as MVP.
        const items = await getCollectionItems(webflowKey, collection.webflow_collection_id);

        const totalItems = items.length;
        let itemsMissingOgImage = 0;

        for (const item of items) {
            // Check if og-image field is empty
            if (!item.fieldData['og-image']) {
                itemsMissingOgImage++;
            }
        }

        const opportunityScore = totalItems > 0 
            ? Math.round((itemsMissingOgImage / totalItems) * 100)
            : 0;

        return {
            totalItems,
            itemsMissingOgImage,
            opportunityScore
        };
    }
}
