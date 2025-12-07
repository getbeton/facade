import OpenAI from 'openai';
import axios from 'axios';

/**
 * Validate OpenAI API key by making a simple API call
 */
export async function validateOpenAIKey(apiKey: string): Promise<boolean> {
    try {
        const openai = new OpenAI({ apiKey });
        // Try to list models as a simple validation check
        await openai.models.list();
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Generate image using OpenAI DALL-E 3
 * Ported from generate-integration-images-dalle.js
 */
export async function generateImage(
    prompt: string,
    apiKey: string
): Promise<Buffer> {
    const openai = new OpenAI({ apiKey });

    try {
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1792x1024", // Closest to 16:9 landscape
            quality: "hd",
            style: "natural" // More suitable for ukiyo-e style
        });

        const imageUrl = response.data?.[0]?.url;
        if (!imageUrl) {
            throw new Error('No image URL returned from DALL-E');
        }

        // Download the image
        const imageResponse = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 30000
        });

        return Buffer.from(imageResponse.data);
    } catch (error) {
        console.error(`Error generating image:`, error);
        throw error;
    }
}

export interface SeoGenerationInput {
    apiKey: string;
    itemData: Record<string, any>;
    fieldName: string; // e.g., 'meta-title', 'meta-description'
    targetKeyword?: string;
    siteName?: string;
}

export interface SeoGenerationResult {
    suggestion: string;
    reasoning?: string;
}

/**
 * Generate SEO metadata (title or description) using OpenAI
 */
export async function generateSeoMetaData(
    input: SeoGenerationInput
): Promise<SeoGenerationResult> {
    const { apiKey, itemData, fieldName, targetKeyword, siteName } = input;
    const openai = new OpenAI({ apiKey });

    // Construct a context-aware prompt
    // We filter out likely irrelevant fields (ids, dates) to keep token count reasonable
    const relevantContent = Object.entries(itemData)
        .filter(([key, value]) => {
            const k = key.toLowerCase();
            return (
                typeof value === 'string' &&
                value.length > 0 &&
                !k.includes('id') &&
                !k.includes('date') &&
                !k.includes('url') &&
                !k.includes('slug')
            );
        })
        .map(([key, value]) => `${key}: ${String(value).substring(0, 500)}`) // Truncate long fields
        .join('\n');

    let systemPrompt = `You are an expert SEO specialist. Your task is to generate a high-quality ${fieldName} for a webpage.`;
    
    if (fieldName.includes('title')) {
        systemPrompt += `
The title should be:
- Under 60 characters
- Compelling and clickable
- Include the target keyword (if provided) naturally
- Relevant to the content
- Brand-aware (include site name if appropriate and space permits)
`;
    } else if (fieldName.includes('description')) {
        systemPrompt += `
The description should be:
- Between 150-160 characters
- A summary of the page content
- Action-oriented (include a call to action if appropriate)
- Include the target keyword (if provided) naturally
`;
    }

    const userPrompt = `
Context:
Site Name: ${siteName || 'Unknown'}
Target Keyword: ${targetKeyword || 'None provided'}

Page Content (extract):
${relevantContent}

Please generate a ${fieldName}.
Return JSON in the format: { "suggestion": "string", "reasoning": "string" }
`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o", // Use a smart model for reasoning
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) throw new Error('No content returned from OpenAI');

        const result = JSON.parse(content) as SeoGenerationResult;
        return result;

    } catch (error) {
        console.error(`Error generating SEO metadata for ${fieldName}:`, error);
        throw error;
    }
}
