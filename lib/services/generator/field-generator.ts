import { OpenAI } from 'openai';
import { generateImage } from '@/lib/openai';

interface GenerateFieldParams {
    apiKey: string;
    fieldType: 'PlainText' | 'RichText' | 'Image';
    fieldName: string;
    context: Record<string, any>; // Item data
    siteContext?: string; // Site description or name
    prompt?: string; // Optional custom prompt
}

export class FieldGenerator {
    private openai: OpenAI;

    constructor(apiKey: string) {
        this.openai = new OpenAI({ apiKey });
    }

    async generate(params: GenerateFieldParams): Promise<string | Buffer> {
        const { fieldType, fieldName, context, siteContext } = params;

        if (fieldType === 'Image') {
            return this.generateImageField(params);
        }

        return this.generateTextField(params);
    }

    private async generateTextField(params: GenerateFieldParams): Promise<string> {
        const { fieldName, context, siteContext, fieldType } = params;
        
        // Filter context to remove empty/null values to save tokens
        const cleanContext = Object.fromEntries(
            Object.entries(context).filter(([_, v]) => v != null && v !== '')
        );

        const systemPrompt = `You are a professional content writer for a website.
Site Context: ${siteContext || 'General Website'}
Task: Write content for a CMS field named "${fieldName}".
Format: ${fieldType === 'RichText' ? 'HTML (no markdown, just tags like <p>, <h2>, <ul>)' : 'Plain text'}.
Style: Professional, engaging, and SEO-friendly.
Keep it concise unless the field name implies long form (e.g., "body", "article").`;

        const userPrompt = `Context Data (other fields):
${JSON.stringify(cleanContext, null, 2)}

Please generate content for the "${fieldName}" field.`;

        const completion = await this.openai.chat.completions.create({
            model: "gpt-4o", // Use high quality model
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.7,
        });

        let content = completion.choices[0]?.message?.content || '';

        // Clean up markdown code blocks if present
        if (content.startsWith('```html')) content = content.replace(/^```html\n/, '').replace(/\n```$/, '');
        if (content.startsWith('```')) content = content.replace(/^```\n/, '').replace(/\n```$/, '');

        return content;
    }

    private async generateImageField(params: GenerateFieldParams): Promise<Buffer> {
        const { fieldName, context, siteContext } = params;

        // Generate a prompt for the image first
        const promptGen = await this.openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "You are an expert AI art prompter. Create a detailed DALL-E 3 prompt." },
                { role: "user", content: `
                    Create a prompt for an image field named "${fieldName}".
                    Context: ${JSON.stringify(context)}
                    Site: ${siteContext}
                    Style: Professional, high-quality, suitable for a website.
                    Return ONLY the prompt string.
                `}
            ],
        });

        const prompt = promptGen.choices[0]?.message?.content || `Image for ${fieldName}`;
        
        // Generate the image
        // Re-use our existing wrapper which handles download
        return await generateImage(prompt, this.openai.apiKey);
    }
}



