import { WebflowCollectionItem } from './types';

/**
 * Create ukiyo-e style prompt based on integration content
 * Ported from generate-integration-images-dalle.js
 */
export function createUkiyoePrompt(integration: WebflowCollectionItem): string {
    const toolName = integration.fieldData['tool-name'] || '';
    const heroH1 = integration.fieldData['hero-h1'] || '';
    const heroBody = integration.fieldData['hero-body'] || '';
    const problemHeading = integration.fieldData['problem-heading'] || '';

    // Extract key themes from the integration
    const content = `${toolName} ${heroH1} ${heroBody} ${problemHeading}`.toLowerCase();

    // Determine theme based on content keywords
    let theme = 'flowing data streams and connections';
    let elements = 'abstract patterns representing technology and automation';

    if (content.includes('email') || content.includes('messaging') || content.includes('customer.io')) {
        theme = 'messages flowing like birds across the sky';
        elements = 'stylized envelopes, paper cranes, and communication symbols';
    } else if (content.includes('analytics') || content.includes('data') || content.includes('posthog') || content.includes('amplitude')) {
        theme = 'waves and ripples representing data insights';
        elements = 'concentric circles, flowing water, and mountain peaks with clouds';
    } else if (content.includes('customer') || content.includes('success') || content.includes('gainsight') || content.includes('vitally')) {
        theme = 'cherry blossoms and growing trees representing success';
        elements = 'blooming flowers, bamboo growth, and ascending paths';
    } else if (content.includes('sales') || content.includes('prospecting') || content.includes('apollo') || content.includes('outreach')) {
        theme = 'fishing boats and nets on calm waters';
        elements = 'traditional fishing vessels, nets catching fish, and coastal landscapes';
    } else if (content.includes('call') || content.includes('phone') || content.includes('aircall') || content.includes('justcall')) {
        theme = 'temple bells and sound waves';
        elements = 'traditional Japanese bells, sound ripples, and communication towers';
    } else if (content.includes('form') || content.includes('survey') || content.includes('typeform') || content.includes('jotform')) {
        theme = 'scrolls and calligraphy materials';
        elements = 'unrolling scrolls, ink brushes, and paper sheets';
    } else if (content.includes('intent') || content.includes('visitor') || content.includes('warmly') || content.includes('leadfeeder')) {
        theme = 'footprints in sand and winding pathways';
        elements = 'stone paths, footsteps, and journey markers';
    } else if (content.includes('verification') || content.includes('validation') || content.includes('zerobounce') || content.includes('bouncer')) {
        theme = 'official seals and stamps of authenticity';
        elements = 'traditional hanko stamps, seal impressions, and official markers';
    } else if (content.includes('crm') || content.includes('salesforce') || content.includes('hubspot')) {
        theme = 'organized filing systems as traditional Japanese storage';
        elements = 'tansu chests, organized compartments, and filing systems';
    } else if (content.includes('meeting') || content.includes('calendar') || content.includes('scheduling')) {
        theme = 'lunar phases and time measurement';
        elements = 'moon phases, sundials, and seasonal markers';
    } else if (content.includes('marketing') || content.includes('campaign') || content.includes('braze') || content.includes('iterable')) {
        theme = 'fireworks and celebrations';
        elements = 'festival lanterns, firework bursts, and celebratory banners';
    }

    return `A beautiful ukiyo-e style Japanese woodblock print featuring ${theme}. 
The artwork should include ${elements}.
Artistic style: Traditional ukiyo-e with:
- Bold, clean outlines (characteristic of woodblock printing)
- Flat areas of color without gradients
- Limited color palette: deep indigo blue, burnt orange, sage green, cream white, and muted red
- Minimalist composition with significant negative space
- Geometric patterns and stylized natural forms
- No text, numbers, or latin characters
- Professional modern interpretation of Hokusai and Hiroshige's work
- Abstract and symbolic representation suitable for modern tech context
- Landscape orientation (16:9 aspect ratio)
The overall feeling should be serene, elegant, and timeless while subtly representing ${toolName} technology.`;
}
