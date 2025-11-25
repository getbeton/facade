import { NextRequest, NextResponse } from 'next/server';
import { getAllSites } from '@/lib/webflow';

export async function POST(request: NextRequest) {
    try {
        const { apiKey } = await request.json();

        if (!apiKey) {
            return NextResponse.json(
                { error: 'API key is required' },
                { status: 400 }
            );
        }

        const sites = await getAllSites(apiKey);

        return NextResponse.json({ sites });
    } catch (error) {
        console.error('Error fetching sites:', error);
        return NextResponse.json(
            { error: 'Failed to fetch sites' },
            { status: 500 }
        );
    }
}
