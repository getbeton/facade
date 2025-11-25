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
