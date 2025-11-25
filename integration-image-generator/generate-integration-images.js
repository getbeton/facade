/**
 * One-time script to generate ukiyo-e style images for integration pages
 * using Gemini API and upload them to Webflow
 * 
 * Requirements:
 * - GEMINI_API_KEY environment variable
 * - WEBFLOW_API_TOKEN environment variable
 * 
 * Usage: node scripts/generate-integration-images.js
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Configuration
const WEBFLOW_SITE_ID = '68d4ef468dbbe960d0ed2e86';
const WEBFLOW_COLLECTION_ID = '69242b7284d9de0228db4d93';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const WEBFLOW_API_TOKEN = process.env.WEBFLOW_API_TOKEN;

// API Endpoints
const WEBFLOW_BASE_URL = 'https://api.webflow.com/v2';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Rate limiting
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds between requests
const MAX_CONCURRENT = 3; // Maximum concurrent operations

/**
 * Delay helper for rate limiting
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
  let theme = 'flowing data streams';
  if (content.includes('email') || content.includes('messaging')) {
    theme = 'flowing letters and communication symbols like birds carrying messages';
  } else if (content.includes('analytics') || content.includes('data')) {
    theme = 'waves representing data flows and insights';
  } else if (content.includes('customer') || content.includes('success')) {
    theme = 'cherry blossoms representing growth and success';
  } else if (content.includes('sales') || content.includes('prospecting')) {
    theme = 'fishing boats and nets representing prospecting';
  } else if (content.includes('call') || content.includes('phone')) {
    theme = 'traditional Japanese bells and communication symbols';
  } else if (content.includes('form') || content.includes('survey')) {
    theme = 'scrolls and writing materials';
  } else if (content.includes('intent') || content.includes('visitor')) {
    theme = 'footprints in sand and pathways';
  } else if (content.includes('verification') || content.includes('validation')) {
    theme = 'stamps and seals of approval';
  }
  
  return `Create an elegant ukiyo-e (Japanese woodblock print) style image with ${theme}. 
The composition should feature:
- Traditional Japanese art style with bold outlines and flat colors
- A serene color palette: deep indigo blues, warm oranges, muted greens, and cream
- Minimalist composition with clean negative space
- Abstract representation of ${toolName} functionality
- No text or words in the image
- Suitable for OG (Open Graph) social media preview
- 1200x630 pixel aspect ratio (landscape orientation)
- Professional and modern interpretation of traditional ukiyo-e aesthetics
Style reference: Hokusai's "The Great Wave" meets modern data visualization`;
}

/**
 * Generate image using Gemini API (Imagen 3)
 * Note: As of now, Gemini API via @google/generative-ai doesn't support direct image generation
 * This uses the REST API endpoint for Imagen
 */
async function generateImageWithGemini(prompt, integrationName) {
  try {
    console.log(`🎨 Generating image for ${integrationName}...`);
    
    // Use Imagen 3 via Google AI Studio API
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${GEMINI_API_KEY}`,
      {
        instances: [{
          prompt: prompt
        }],
        parameters: {
          sampleCount: 1,
          aspectRatio: '16:9',
          negativePrompt: 'text, words, letters, numbers, watermark, signature, blur, distorted',
          mode: 'foreground'
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 90000 // 90 second timeout for image generation
      }
    );
    
    // Extract base64 image from response
    if (response.data?.predictions?.[0]?.bytesBase64Encoded) {
      const base64Data = response.data.predictions[0].bytesBase64Encoded;
      return Buffer.from(base64Data, 'base64');
    }
    
    // Alternative response format
    if (response.data?.predictions?.[0]?.image?.bytesBase64Encoded) {
      const base64Data = response.data.predictions[0].image.bytesBase64Encoded;
      return Buffer.from(base64Data, 'base64');
    }
    
    throw new Error('No image data in Gemini response');
  } catch (error) {
    console.error(`❌ Error generating image for ${integrationName}:`, error.response?.data || error.message);
    
    // If Gemini image generation fails, provide a fallback message
    if (error.response?.status === 400 || error.response?.status === 404) {
      console.log(`⚠️  Note: Gemini image generation might not be available in your region/plan`);
      console.log(`   Consider using DALL-E 3 or another image generation API instead`);
    }
    
    throw error;
  }
}

/**
 * Upload image to Webflow as an asset
 */
async function uploadImageToWebflow(imageBuffer, fileName) {
  try {
    console.log(`📤 Uploading ${fileName} to Webflow...`);
    
    // Convert buffer to form data
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('file', imageBuffer, {
      filename: fileName,
      contentType: 'image/png'
    });
    
    const response = await axios.post(
      `${WEBFLOW_BASE_URL}/sites/${WEBFLOW_SITE_ID}/assets`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${WEBFLOW_API_TOKEN}`
        },
        timeout: 60000
      }
    );
    
    console.log(`✅ Uploaded ${fileName}, asset ID: ${response.data.id}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Error uploading ${fileName}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get all integration items from Webflow
 */
async function getAllIntegrations() {
  try {
    console.log('📥 Fetching all integration items from Webflow...');
    
    let allItems = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;
    
    while (hasMore) {
      const response = await axios.get(
        `${WEBFLOW_BASE_URL}/collections/${WEBFLOW_COLLECTION_ID}/items`,
        {
          headers: {
            'Authorization': `Bearer ${WEBFLOW_API_TOKEN}`
          },
          params: {
            offset,
            limit
          }
        }
      );
      
      allItems = allItems.concat(response.data.items);
      offset += limit;
      hasMore = response.data.items.length === limit;
      
      await delay(500); // Rate limiting
    }
    
    console.log(`✅ Fetched ${allItems.length} integration items`);
    return allItems;
  } catch (error) {
    console.error('❌ Error fetching integrations:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Update CMS item with OG image
 */
async function updateIntegrationWithOGImage(itemId, imageAssetId) {
  try {
    console.log(`🔄 Updating integration ${itemId} with OG image...`);
    
    const response = await axios.patch(
      `${WEBFLOW_BASE_URL}/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`,
      {
        fieldData: {
          'og-image': imageAssetId
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${WEBFLOW_API_TOKEN}`
        }
      }
    );
    
    console.log(`✅ Updated integration ${itemId}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Error updating integration ${itemId}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Publish updated CMS items
 */
async function publishIntegrations(itemIds) {
  try {
    console.log(`📢 Publishing ${itemIds.length} integration items...`);
    
    // Webflow has a limit on bulk publishing, so we'll do it in batches
    const batchSize = 50;
    for (let i = 0; i < itemIds.length; i += batchSize) {
      const batch = itemIds.slice(i, i + batchSize);
      
      await axios.post(
        `${WEBFLOW_BASE_URL}/collections/${WEBFLOW_COLLECTION_ID}/items/publish`,
        {
          itemIds: batch
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${WEBFLOW_API_TOKEN}`
          }
        }
      );
      
      console.log(`✅ Published batch ${Math.floor(i / batchSize) + 1}`);
      await delay(1000);
    }
    
    console.log(`✅ All items published`);
  } catch (error) {
    console.error('❌ Error publishing items:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Process a single integration
 */
async function processIntegration(integration, index, total) {
  const toolName = integration.fieldData['tool-name'] || integration.fieldData.name;
  const slug = integration.fieldData.slug;
  
  console.log(`\n[${ index + 1}/${total}] Processing: ${toolName} (${slug})`);
  
  try {
    // Step 1: Generate ukiyo-e prompt
    const prompt = createUkiyoePrompt(integration);
    console.log(`📝 Generated prompt for ${toolName}`);
    
    // Step 2: Generate image with Gemini
    const imageBuffer = await generateImageWithGemini(prompt, toolName);
    await delay(DELAY_BETWEEN_REQUESTS); // Rate limiting
    
    // Step 3: Upload to Webflow
    const fileName = `${slug}-ukiyo-e-og.png`;
    const uploadedAsset = await uploadImageToWebflow(imageBuffer, fileName);
    await delay(1000); // Rate limiting
    
    // Step 4: Update CMS item with OG image
    await updateIntegrationWithOGImage(integration.id, uploadedAsset.id);
    await delay(1000); // Rate limiting
    
    console.log(`✅ Completed: ${toolName}`);
    
    return {
      success: true,
      integrationId: integration.id,
      toolName,
      assetId: uploadedAsset.id
    };
  } catch (error) {
    console.error(`❌ Failed processing ${toolName}:`, error.message);
    
    return {
      success: false,
      integrationId: integration.id,
      toolName,
      error: error.message
    };
  }
}

/**
 * Process integrations in batches with concurrency control
 */
async function processIntegrationsInBatches(integrations) {
  const results = [];
  
  for (let i = 0; i < integrations.length; i += MAX_CONCURRENT) {
    const batch = integrations.slice(i, i + MAX_CONCURRENT);
    
    console.log(`\n🔄 Processing batch ${Math.floor(i / MAX_CONCURRENT) + 1}...`);
    
    const batchResults = await Promise.all(
      batch.map((integration, batchIndex) => 
        processIntegration(integration, i + batchIndex, integrations.length)
      )
    );
    
    results.push(...batchResults);
    
    // Delay between batches
    if (i + MAX_CONCURRENT < integrations.length) {
      console.log('⏳ Waiting before next batch...');
      await delay(5000);
    }
  }
  
  return results;
}

/**
 * Save results to a log file
 */
async function saveResults(results) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = path.join(__dirname, `integration-images-log-${timestamp}.json`);
  
  const summary = {
    timestamp: new Date().toISOString(),
    total: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results
  };
  
  await fs.writeFile(logPath, JSON.stringify(summary, null, 2));
  console.log(`\n📄 Results saved to: ${logPath}`);
  
  return summary;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting Integration Images Generation Script');
  console.log('================================================\n');
  
  // Validate environment variables
  if (!GEMINI_API_KEY) {
    console.error('❌ Error: GEMINI_API_KEY environment variable is required');
    process.exit(1);
  }
  
  if (!WEBFLOW_API_TOKEN) {
    console.error('❌ Error: WEBFLOW_API_TOKEN environment variable is required');
    process.exit(1);
  }
  
  try {
    // Step 1: Fetch all integrations
    const integrations = await getAllIntegrations();
    
    if (integrations.length === 0) {
      console.log('⚠️  No integrations found. Exiting.');
      return;
    }
    
    console.log(`\n🎯 Will process ${integrations.length} integrations`);
    console.log(`⚙️  Max concurrent: ${MAX_CONCURRENT}`);
    console.log(`⏱️  Delay between requests: ${DELAY_BETWEEN_REQUESTS}ms\n`);
    
    // Optional: Ask for confirmation (can be removed for full automation)
    console.log('⚠️  This will generate and upload approximately', integrations.length, 'images.');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    await delay(5000);
    
    // Step 2: Process all integrations
    const results = await processIntegrationsInBatches(integrations);
    
    // Step 3: Save results
    const summary = await saveResults(results);
    
    // Step 4: Publish successful updates
    const successfulIds = results.filter(r => r.success).map(r => r.integrationId);
    
    if (successfulIds.length > 0) {
      console.log(`\n📢 Publishing ${successfulIds.length} updated items...`);
      await publishIntegrations(successfulIds);
    }
    
    // Print summary
    console.log('\n✨ SUMMARY');
    console.log('================================================');
    console.log(`Total integrations: ${summary.total}`);
    console.log(`✅ Successful: ${summary.successful}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log('================================================\n');
    
    if (summary.failed > 0) {
      console.log('⚠️  Some integrations failed. Check the log file for details.');
      process.exit(1);
    }
    
    console.log('🎉 All done! Images generated and uploaded successfully.');
    
  } catch (error) {
    console.error('\n💥 Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main };

