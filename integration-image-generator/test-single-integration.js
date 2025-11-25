/**
 * Test script to generate image for a single integration
 * Useful for testing before running the full batch
 * 
 * Usage: node scripts/test-single-integration.js [slug]
 * Example: node scripts/test-single-integration.js apollo-integration-beton
 */

require('dotenv').config();
const axios = require('axios');
const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const WEBFLOW_SITE_ID = '68d4ef468dbbe960d0ed2e86';
const WEBFLOW_COLLECTION_ID = '69242b7284d9de0228db4d93';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WEBFLOW_API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const WEBFLOW_BASE_URL = 'https://api.webflow.com/v2';

// Initialize OpenAI
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

/**
 * Create ukiyo-e style prompt based on integration content
 */
function createUkiyoePrompt(integration) {
  const toolName = integration.fieldData['tool-name'];
  const heroH1 = integration.fieldData['hero-h1'];
  const heroBody = integration.fieldData['hero-body'];
  const problemHeading = integration.fieldData['problem-heading'];
  
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

async function testSingleIntegration(slug) {
  console.log(`🧪 Testing image generation for: ${slug}\n`);
  
  try {
    // Fetch the specific integration
    console.log('📥 Fetching integration from Webflow...');
    const response = await axios.get(
      `${WEBFLOW_BASE_URL}/collections/${WEBFLOW_COLLECTION_ID}/items`,
      {
        headers: {
          'Authorization': `Bearer ${WEBFLOW_API_TOKEN}`
        },
        params: {
          slug: slug
        }
      }
    );
    
    if (!response.data.items || response.data.items.length === 0) {
      console.error(`❌ Integration with slug "${slug}" not found`);
      process.exit(1);
    }
    
    const integration = response.data.items[0];
    const toolName = integration.fieldData['tool-name'] || integration.fieldData.name;
    
    console.log(`✅ Found: ${toolName}\n`);
    
    // Generate prompt
    console.log('📝 Generated prompt:');
    console.log('─'.repeat(60));
    const prompt = createUkiyoePrompt(integration);
    console.log(prompt);
    console.log('─'.repeat(60));
    console.log();
    
    // Generate image
    console.log('🎨 Generating image with DALL-E 3...');
    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1792x1024",
      quality: "hd",
      style: "natural"
    });
    
    const imageUrl = imageResponse.data[0].url;
    console.log(`✅ Image generated: ${imageUrl}\n`);
    
    // Download image
    console.log('📥 Downloading image...');
    const downloadResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer'
    });
    
    const imageBuffer = Buffer.from(downloadResponse.data);
    
    // Save locally for preview
    const outputPath = path.join(__dirname, `test-output-${slug}.png`);
    await fs.writeFile(outputPath, imageBuffer);
    console.log(`✅ Saved test image to: ${outputPath}\n`);
    
    // Display summary
    console.log('✨ TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Integration: ${toolName}`);
    console.log(`Slug: ${slug}`);
    console.log(`Image size: ${(imageBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`Preview URL: ${imageUrl}`);
    console.log(`Local file: ${outputPath}`);
    console.log('='.repeat(60));
    console.log('\n✅ Test completed successfully!');
    console.log('   Open the local file to preview the image.');
    console.log('   If satisfied, run the full script with: npm run generate-images\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Get slug from command line or use default
const slug = process.argv[2] || 'apollo-integration-beton';

// Validate environment
if (!OPENAI_API_KEY) {
  console.error('❌ Error: OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

if (!WEBFLOW_API_TOKEN) {
  console.error('❌ Error: WEBFLOW_API_TOKEN environment variable is required');
  process.exit(1);
}

testSingleIntegration(slug);

