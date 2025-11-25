import { NextRequest, NextResponse } from 'next/server';
import { validateWebflowToken } from '@/lib/webflow';

export async function POST(request: NextRequest) {
    try {
        const { apiKey } = await request.json();

        if (!apiKey) {
            return NextResponse.json(
                { valid: false, message: 'API key is required' },
                { status: 400 }
            );
        }

        const isValid = await validateWebflowToken(apiKey);

        return NextResponse.json({ valid: isValid });
    } catch (error) {
        console.error('Error validating Webflow token:', error);
        return NextResponse.json(
            { valid: false, message: 'Validation failed' },
            { status: 500 }
        );
    }
}
