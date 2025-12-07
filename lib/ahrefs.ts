import axios from 'axios';

const AHREFS_API_BASE = 'https://api.ahrefs.com/v3';

export interface KeywordMetrics {
    volume: number;
    difficulty: number;
    clicks: number;
    cpc: number;
}

export interface KeywordSuggestion {
    keyword: string;
    metrics: KeywordMetrics;
}

export class AhrefsClient {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    /**
     * Get keyword metrics for a specific keyword
     * Note: This is a placeholder structure as Ahrefs API usage requires specific endpoints
     * and enterprise plans usually.
     */
    async getKeywordMetrics(keyword: string, country: string = 'us'): Promise<KeywordMetrics | null> {
        if (!this.apiKey) {
            console.warn('Ahrefs API key is missing. Returning mock data.');
            return {
                volume: 1000,
                difficulty: 50,
                clicks: 500,
                cpc: 1.5
            };
        }

        try {
            // Placeholder for actual API call
            // const response = await axios.get(`${AHREFS_API_BASE}/keywords/overview`, {
            //     headers: { Authorization: `Bearer ${this.apiKey}` },
            //     params: { keyword, country }
            // });
            // return response.data;
            
            // Mock return for now
            return {
                volume: Math.floor(Math.random() * 10000),
                difficulty: Math.floor(Math.random() * 100),
                clicks: Math.floor(Math.random() * 5000),
                cpc: Number((Math.random() * 5).toFixed(2))
            };
        } catch (error) {
            console.error('Error fetching Ahrefs data:', error);
            return null;
        }
    }

    /**
     * Get keyword suggestions based on a seed keyword
     */
    async getKeywordSuggestions(seed: string, limit: number = 5): Promise<KeywordSuggestion[]> {
        if (!this.apiKey) {
             console.warn('Ahrefs API key is missing. Returning mock data.');
             return Array(limit).fill(0).map((_, i) => ({
                 keyword: `${seed} variation ${i + 1}`,
                 metrics: {
                     volume: 1000 - (i * 100),
                     difficulty: 40 + (i * 5),
                     clicks: 500 - (i * 50),
                     cpc: 1.0 + (i * 0.1)
                 }
             }));
        }

        try {
            // Placeholder for actual API call
            return [];
        } catch (error) {
            console.error('Error fetching Ahrefs suggestions:', error);
            return [];
        }
    }
}

// Export a singleton instance if env var exists, otherwise null or a default instance
export const ahrefsClient = new AhrefsClient(process.env.AHREFS_API_KEY || '');






