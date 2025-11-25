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
        const openai = new OpenAI({ apiKey });

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
