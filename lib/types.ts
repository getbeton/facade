export interface WebflowSite {
    id: string;
    displayName: string;
    shortName: string;
    previewUrl?: string;
    customDomains?: Array<{ url: string }>;
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
