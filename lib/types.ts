export interface WebflowSite {
    id: string;
    displayName: string;
    shortName: string;
    previewUrl?: string;
    customDomains?: Array<{ url: string }>;
    faviconUrl?: string;
}

export interface WebflowCollection {
    id: string;
    displayName: string;
    singularName: string;
    slug: string;
}

export interface WebflowCollectionItem {
    id: string;
    fieldData: {
        [key: string]: any;
        'tool-name'?: string;
        'hero-h1'?: string;
        'hero-body'?: string;
        'problem-heading'?: string;
    };
    isDraft?: boolean;
    isArchived?: boolean;
    createdOn?: string;
    lastUpdated?: string;
}

export interface WebflowAsset {
    id: string;
    url: string;
    uploadUrl?: string;
    uploadDetails?: {
        [key: string]: string;
    };
}

export interface GenerationStatus {
    status: 'idle' | 'processing' | 'success' | 'error';
    currentItem?: string;
    progress: number;
    total: number;
    message?: string;
}

export interface BulkOperation {
    type: 'generate' | 'delete' | 'edit';
    itemIds: string[];
    fieldToEdit?: string;
    newValue?: any;
}

export interface TableFilters {
    searchTerm: string;
    columnFilters: Record<string, string>;
    sortColumn?: string;
    sortDirection?: 'asc' | 'desc';
}

export interface EditedCell {
    itemId: string;
    fieldName: string;
    originalValue: any;
    newValue: any;
}

// Database Entities
export interface Site {
    id: string; // Webflow Site ID
    user_id: string;
    name: string;
    short_name: string;
    preview_url: string | null;
    favicon_url: string | null;
    last_synced_at: string;
    created_at: string;
    integration_id?: string;
}

export interface Collection {
    id: string; // UUID from our DB
    user_id: string;
    site_id: string;
    webflow_collection_id: string;
    display_name: string;
    created_at: string;
    updated_at: string;
    // Join fields (optional)
    site?: Site;
    item_count?: number; // Fetched dynamically
}

// ============================================================
// Billing & Generation Types
// ============================================================

/**
 * Generation log entry - tracks each individual image generation attempt
 */
export interface GenerationLog {
    id: string;
    user_id: string;
    collection_id: string | null; // Our DB UUID
    webflow_collection_id: string;
    webflow_item_id: string;
    item_name: string | null;
    payment_id: string | null;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    is_free_tier: boolean;
    uses_own_api_key: boolean;
    error_message: string | null;
    cost_cents: number;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
}

/**
 * Payment record - tracks billing transactions
 */
export interface Payment {
    id: string;
    user_id: string;
    stripe_payment_intent_id: string;
    stripe_checkout_session_id: string | null;
    amount_cents: number;
    collection_id: string; // Our DB collection UUID
    collection_name: string | null;
    items_count: number;
    items_completed: number;
    items_failed: number;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
    error_message: string | null;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
    // New billing fields
    generation_logs_count: number;
    item_ids: string[] | null; // JSONB array of Webflow item IDs
    generation_started: boolean;
}

/**
 * User profile with billing information
 */
export interface Profile {
    id: string;
    email: string;
    stripe_customer_id: string | null;
    free_generations_used: number;
    created_at: string;
    updated_at: string;
}

/**
 * Response from billing check-status API
 */
export interface BillingCheckResponse {
    requiresPayment: boolean;
    reason?: 'own_api_key' | 'free_tier';
    remainingFreeGenerations?: number;
    remainingAfterGeneration?: number;
    itemsToCharge?: number;
    freeItemsCount?: number;
    amountCents?: number;
    pricePerImageCents?: number;
}

/**
 * Request body for generation with payment
 */
export interface GenerationRequest {
    collectionId: string; // Our DB UUID
    itemIds: string[]; // Webflow item IDs to generate
    paymentId?: string; // Payment ID if paid generation
}

/**
 * Free tier status for a user
 */
export interface FreeTierStatus {
    used: number;
    remaining: number;
    limit: number;
}
