import { Site, Collection, WebflowCollectionItem } from './types';

// Mock Sites
export const MOCK_SITES: Site[] = [
    {
        id: 'mock-site-1',
        user_id: 'mock-user',
        name: 'TechStartup Landing',
        short_name: 'tech-startup',
        preview_url: 'https://webflow.com/templates/html/startup-template-website-template',
        favicon_url: 'https://uploads-ssl.webflow.com/5f2b1c0e3e2b2c0017c0c0c0/5f2b1c0e3e2b2c0017c0c0c4_favicon.png',
        last_synced_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        integration_id: 'mock-integration',
    },
    {
        id: 'mock-site-2',
        user_id: 'mock-user',
        name: 'Design Portfolio',
        short_name: 'portfolio',
        preview_url: 'https://webflow.com/templates/html/portfolio-template-website-template',
        favicon_url: 'https://uploads-ssl.webflow.com/5f2b1c0e3e2b2c0017c0c0c0/5f2b1c0e3e2b2c0017c0c0c4_favicon.png',
        last_synced_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        integration_id: 'mock-integration',
    }
];

// Mock Collections
export const MOCK_COLLECTIONS: (Collection & { site?: Site })[] = [
    {
        id: 'mock-col-1',
        user_id: 'mock-user',
        site_id: 'mock-site-1',
        webflow_collection_id: 'wf-col-1',
        display_name: 'Blog Posts',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        site: MOCK_SITES[0]
    },
    {
        id: 'mock-col-2',
        user_id: 'mock-user',
        site_id: 'mock-site-1',
        webflow_collection_id: 'wf-col-2',
        display_name: 'Team Members',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        site: MOCK_SITES[0]
    },
    {
        id: 'mock-col-3',
        user_id: 'mock-user',
        site_id: 'mock-site-2',
        webflow_collection_id: 'wf-col-3',
        display_name: 'Projects',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        site: MOCK_SITES[1]
    }
];

// Mock Items for Blog Posts
export const MOCK_ITEMS_BLOG: WebflowCollectionItem[] = [
    {
        id: 'item-1',
        isDraft: false,
        isArchived: false,
        createdOn: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        fieldData: {
            name: 'The Future of AI in Design',
            slug: 'future-of-ai-design',
            'post-body': '',
            'post-summary': '',
            'main-image': null,
            'author': 'Jane Doe'
        }
    },
    {
        id: 'item-2',
        isDraft: true,
        isArchived: false,
        createdOn: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        fieldData: {
            name: '10 Tips for Better UX',
            slug: '10-tips-better-ux',
            'post-body': '',
            'post-summary': '',
            'main-image': null,
            'author': 'John Smith'
        }
    },
    {
        id: 'item-3',
        isDraft: false,
        isArchived: false,
        createdOn: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        fieldData: {
            name: 'Why We Switched to Webflow',
            slug: 'why-we-switched-webflow',
            'post-body': '',
            'post-summary': '',
            'main-image': null,
            'author': 'Jane Doe'
        }
    }
];

// Mock Schema Definition (for Grid Headers)
export const MOCK_SCHEMA_BLOG = [
    { name: 'name', type: 'PlainText', displayName: 'Name' },
    { name: 'slug', type: 'PlainText', displayName: 'Slug' },
    { name: 'post-summary', type: 'PlainText', displayName: 'Summary' },
    { name: 'post-body', type: 'RichText', displayName: 'Body' },
    { name: 'main-image', type: 'Image', displayName: 'Main Image' },
    { name: 'author', type: 'PlainText', displayName: 'Author' },
];



