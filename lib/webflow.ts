import axios from 'axios';
import * as crypto from 'crypto';
import FormData from 'form-data';
import { WebflowSite, WebflowCollection, WebflowCollectionItem, WebflowAsset } from './types';

const WEBFLOW_BASE_URL = 'https://api.webflow.com/v2';

/**
 * Calculate MD5 hash of buffer
 */
function calculateMD5(buffer: Buffer): string {
    return crypto.createHash('md5').update(buffer).digest('hex');
}

/**
 * Validate Webflow API token by fetching user info
 */
export async function validateWebflowToken(token: string): Promise<boolean> {
    try {
        await axios.get(`${WEBFLOW_BASE_URL}/token/authorized_by`, {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            timeout: 10000
        });
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Helper to get favicon URL
 */
function getFaviconUrl(site: any): string {
    // If a custom domain is connected, use it
    if (site.customDomains && site.customDomains.length > 0) {
        return `https://www.google.com/s2/favicons?domain=${site.customDomains[0].url}&sz=64`;
    }
    
    // Fallback to webflow.io subdomain
    // Ensure shortName doesn't already have .webflow.io
    const shortName = site.shortName || '';
    const domain = shortName.includes('.') ? shortName : `${shortName}.webflow.io`;
    
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

/**
 * Get all sites accessible with the token
 */
export async function getAllSites(token: string): Promise<WebflowSite[]> {
    const response = await axios.get(
        `${WEBFLOW_BASE_URL}/sites`,
        {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }
    );

    const sites = response.data.sites || [];
    
    // Add favicon URLs
    return sites.map((site: any) => ({
        ...site,
        faviconUrl: getFaviconUrl(site)
    }));
}

/**
 * Get all collections for a specific site
 */
export async function getCollections(token: string, siteId: string): Promise<WebflowCollection[]> {
    const response = await axios.get(
        `${WEBFLOW_BASE_URL}/sites/${siteId}/collections`,
        {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }
    );

    return response.data.collections || [];
}

/**
 * Get total item count for a collection
 */
export async function getCollectionCount(token: string, collectionId: string): Promise<number> {
    try {
        const response = await axios.get(
            `${WEBFLOW_BASE_URL}/collections/${collectionId}/items`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                params: {
                    limit: 1,
                    offset: 0
                }
            }
        );
        
        // For V2 API, the count is often in pagination object
        // We'll try to inspect the response more carefully
        return response.data.pagination?.total ?? response.data.count ?? 0;
    } catch (error) {
        console.error('Error fetching collection count:', error);
        return 0;
    }
}

/**
 * Get all items from a collection
 */
export async function getCollectionItems(
    token: string,
    collectionId: string
): Promise<WebflowCollectionItem[]> {
    let allItems: WebflowCollectionItem[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
        const response = await axios.get(
            `${WEBFLOW_BASE_URL}/collections/${collectionId}/items`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                params: {
                    offset,
                    limit
                }
            }
        );

        allItems = allItems.concat(response.data.items || []);
        offset += limit;
        hasMore = (response.data.items || []).length === limit;

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    return allItems;
}

/**
 * Upload image to Webflow as an asset (two-step process)
 * Ported from generate-integration-images-dalle.js
 */
export async function uploadImageToWebflow(
    imageBuffer: Buffer,
    fileName: string,
    token: string,
    siteId: string
): Promise<WebflowAsset> {
    // Step 1: Calculate MD5 hash
    const fileHash = calculateMD5(imageBuffer);

    // Step 2: Create asset record
    const createResponse = await axios.post(
        `${WEBFLOW_BASE_URL}/sites/${siteId}/assets`,
        {
            fileName: fileName,
            fileHash: fileHash
        },
        {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            timeout: 30000
        }
    );

    const uploadUrl = createResponse.data.uploadUrl;
    const uploadDetails = createResponse.data.uploadDetails;

    // Step 3: Upload actual file to provided URL
    const formData = new FormData();

    // Add fields in AWS-required order
    formData.append('key', uploadDetails.key);
    formData.append('acl', uploadDetails.acl);
    formData.append('Cache-Control', uploadDetails['Cache-Control']);
    formData.append('content-type', uploadDetails['content-type']);
    formData.append('success_action_status', uploadDetails.success_action_status);
    formData.append('X-Amz-Algorithm', uploadDetails['X-Amz-Algorithm']);
    formData.append('X-Amz-Credential', uploadDetails['X-Amz-Credential']);
    formData.append('X-Amz-Date', uploadDetails['X-Amz-Date']);
    formData.append('Policy', uploadDetails.Policy);
    formData.append('X-Amz-Signature', uploadDetails['X-Amz-Signature']);

    // Add the file last
    formData.append('file', imageBuffer, fileName);

    await axios.post(uploadUrl, formData, {
        headers: formData.getHeaders(),
        timeout: 60000
    });

    return createResponse.data;
}

/**
 * Update CMS item with OG image
 */
export async function updateItemWithOGImage(
    token: string,
    collectionId: string,
    itemId: string,
    assetId: string
): Promise<void> {
    await axios.patch(
        `${WEBFLOW_BASE_URL}/collections/${collectionId}/items/${itemId}`,
        {
            fieldData: {
                'og-image': assetId
            }
        },
        {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        }
    );
}

/**
 * Update a single collection item with new field data
 */
export async function updateCollectionItem(
    token: string,
    collectionId: string,
    itemId: string,
    fieldData: Record<string, any>
): Promise<void> {
    await axios.patch(
        `${WEBFLOW_BASE_URL}/collections/${collectionId}/items/${itemId}`,
        {
            fieldData
        },
        {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        }
    );
}

/**
 * Delete a single collection item
 */
export async function deleteCollectionItem(
    token: string,
    collectionId: string,
    itemId: string
): Promise<void> {
    await axios.delete(
        `${WEBFLOW_BASE_URL}/collections/${collectionId}/items/${itemId}`,
        {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }
    );
}

/**
 * Bulk delete collection items
 */
export async function bulkDeleteItems(
    token: string,
    collectionId: string,
    itemIds: string[]
): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const itemId of itemIds) {
        try {
            await deleteCollectionItem(token, collectionId, itemId);
            success++;
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
            console.error(`Failed to delete item ${itemId}:`, error);
            failed++;
        }
    }

    return { success, failed };
}

/**
 * Bulk update collection items with same field value
 */
export async function bulkUpdateItems(
    token: string,
    collectionId: string,
    itemIds: string[],
    fieldName: string,
    value: any
): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const itemId of itemIds) {
        try {
            await updateCollectionItem(token, collectionId, itemId, {
                [fieldName]: value
            });
            success++;
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
            console.error(`Failed to update item ${itemId}:`, error);
            failed++;
        }
    }

    return { success, failed };
}
