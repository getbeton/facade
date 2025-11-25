/**
 * One-time script to generate ukiyo-e style images for integration pages
 * using OpenAI DALL-E 3 API and upload them to Webflow
 * 
 * This is an alternative to the Gemini version, using DALL-E 3
 * which is more reliable and widely available.
 * 
 * Requirements:
 * - OPENAI_API_KEY environment variable
 * - WEBFLOW_API_TOKEN environment variable
 * 
 * Usage: node scripts/generate-integration-images-dalle.js
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const OpenAI = require('openai');

// Configuration
const WEBFLOW_SITE_ID = '68d4ef468dbbe960d0ed2e86';
const WEBFLOW_COLLECTION_ID = '69242b7284d9de0228db4d93';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WEBFLOW_API_TOKEN = process.env.WEBFLOW_API_TOKEN;

// API Endpoints
const WEBFLOW_BASE_URL = 'https://api.webflow.com/v2';

// Initialize OpenAI
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Rate limiting
const DELAY_BETWEEN_REQUESTS = 3000; // 3 seconds between requests (DALL-E is slower)
const MAX_CONCURRENT = 2; // Reduced for DALL-E rate limits

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

/**
 * Generate image using OpenAI DALL-E 3
 */
async function generateImageWithDALLE(prompt, integrationName) {
  try {
    console.log(`🎨 Generating image with DALL-E 3 for ${integrationName}...`);
    
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1792x1024", // Closest to 16:9 landscape
      quality: "hd",
      style: "natural" // More suitable for ukiyo-e style
    });
    
    const imageUrl = response.data[0].url;
    console.log(`📥 Downloading generated image...`);
    
    // Download the image
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });
    
    return Buffer.from(imageResponse.data);
    
  } catch (error) {
    console.error(`❌ Error generating image for ${integrationName}:`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Calculate MD5 hash of buffer
 */
function calculateMD5(buffer) {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(buffer).digest('hex');
}

/**
 * Upload image to Webflow as an asset (two-step process)
 */
async function uploadImageToWebflow(imageBuffer, fileName) {
  try {
    console.log(`📤 Uploading ${fileName} to Webflow...`);
    
    // Step 1: Calculate MD5 hash
    const fileHash = calculateMD5(imageBuffer);
    console.log(`   Calculated hash: ${fileHash}`);
    
    // Step 2: Create asset record
    const createResponse = await axios.post(
      `${WEBFLOW_BASE_URL}/sites/${WEBFLOW_SITE_ID}/assets`,
      {
        fileName: fileName,
        fileHash: fileHash
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${WEBFLOW_API_TOKEN}`
        },
        timeout: 30000
      }
    );
    
    const uploadUrl = createResponse.data.uploadUrl;
    const uploadDetails = createResponse.data.uploadDetails;
    
    console.log(`   Created asset record, uploading file...`);
    
    // Step 3: Upload actual file to provided URL
    const FormData = require('form-data');
    const formData = new FormData();
    
    // S3 requires fields in specific order - fields are directly on uploadDetails
    // Add fields in AWS-required order
    formData.append('key', uploadDetails.key);
    formData.append('acl', uploadDetails.acl);
    formData.append('Cache-Control', uploadDetails['Cache-Control']);
    formData.append('content-type', uploadDetails['content-type']);
    formData.append('success_action_status', uploadDetails.success_action_status);
    formData.append('X-Amz-Algorithm', uploadDetails['X-Amz-Algorithm']);
    formData.append('X-Amz-Credential', uploadDetails['X-Amz-Credential']);
    formData.append('X-Amz-Date', uploadDetails['X-Amz-Date']);
    formData.append('Policy', uploadDetails.Policy);
    formData.append('X-Amz-Signature', uploadDetails['X-Amz-Signature']);
    
    // Add the file last
    formData.append('file', imageBuffer, fileName);
    
    await axios.post(uploadUrl, formData, {
      headers: formData.getHeaders(),
      timeout: 60000
    });
    
    console.log(`✅ Uploaded ${fileName}, asset ID: ${createResponse.data.id}`);
    return createResponse.data;
    
  } catch (error) {
    console.error(`❌ Error uploading ${fileName}:`, error.response?.data || error.message);
    if (error.response?.data) {
      console.error('   Details:', JSON.stringify(error.response.data, null, 2));
    }
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
async function updateIntegrationWithOGImage(itemId, assetData, integrationData) {
  try {
    console.log(`🔄 Updating integration ${itemId} with OG image...`);
    
    // Webflow requires including required fields (name, slug) in PATCH
    // Image field format: { fileId, url, alt }
    const response = await axios.patch(
      `${WEBFLOW_BASE_URL}/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`,
      {
        isArchived: false,
        isDraft: false,
        fieldData: {
          'name': integrationData.fieldData.name,
          'slug': integrationData.fieldData.slug,
          'og-image': {
            fileId: assetData.id,
            url: assetData.hostedUrl,
            alt: `${integrationData.fieldData['tool-name']} Integration OG Image`
          }
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
    if (error.response?.data) {
      console.error('   Response details:', JSON.stringify(error.response.data, null, 2));
    }
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
  
  console.log(`\n[${index + 1}/${total}] Processing: ${toolName} (${slug})`);
  
  try {
    // Step 1: Generate ukiyo-e prompt
    const prompt = createUkiyoePrompt(integration);
    console.log(`📝 Generated prompt for ${toolName}`);
    
    // Step 2: Generate image with DALL-E 3
    const imageBuffer = await generateImageWithDALLE(prompt, toolName);
    await delay(DELAY_BETWEEN_REQUESTS); // Rate limiting
    
    // Step 3: Upload to Webflow
    const fileName = `${slug}-ukiyo-e-og.png`;
    const uploadedAsset = await uploadImageToWebflow(imageBuffer, fileName);
    await delay(1000); // Rate limiting
    
    // Step 4: Update CMS item with OG image (passes integration data for required fields)
    await updateIntegrationWithOGImage(integration.id, uploadedAsset, integration);
    await delay(1000); // Rate limiting
    
    console.log(`✅ Completed: ${toolName}`);
    
    return {
      success: true,
      integrationId: integration.id,
      toolName,
      slug,
      assetId: uploadedAsset.id,
      assetUrl: uploadedAsset.hostedUrl
    };
  } catch (error) {
    console.error(`❌ Failed processing ${toolName}:`, error.message);
    
    return {
      success: false,
      integrationId: integration.id,
      toolName,
      slug,
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
    
    console.log(`\n🔄 Processing batch ${Math.floor(i / MAX_CONCURRENT) + 1}/${Math.ceil(integrations.length / MAX_CONCURRENT)}...`);
    
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
  console.log('🚀 Starting Integration Images Generation Script (DALL-E 3)');
  console.log('==========================================================\n');
  
  // Validate environment variables
  if (!OPENAI_API_KEY) {
    console.error('❌ Error: OPENAI_API_KEY environment variable is required');
    console.error('   Get your API key from: https://platform.openai.com/api-keys');
    process.exit(1);
  }
  
  if (!WEBFLOW_API_TOKEN) {
    console.error('❌ Error: WEBFLOW_API_TOKEN environment variable is required');
    console.error('   Get your token from: https://webflow.com/dashboard/account/integrations');
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
    console.log(`⏱️  Delay between requests: ${DELAY_BETWEEN_REQUESTS}ms`);
    console.log(`💰 Estimated cost: ~$${(integrations.length * 0.04).toFixed(2)} (DALL-E 3 HD)\n`);
    
    // Optional: Ask for confirmation
    console.log('⚠️  This will generate and upload approximately', integrations.length, 'images.');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    await delay(5000);
    
    // Step 2: Process all integrations
    console.log('🎬 Starting generation process...\n');
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
    console.log('\n✨ FINAL SUMMARY');
    console.log('==========================================================');
    console.log(`Total integrations: ${summary.total}`);
    console.log(`✅ Successful: ${summary.successful}`);
    console.log(`❌ Failed: ${summary.failed}`);
    
    if (summary.failed > 0) {
      console.log('\n⚠️  Failed integrations:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`   - ${r.toolName}: ${r.error}`);
      });
    }
    
    console.log('==========================================================\n');
    
    if (summary.failed > 0) {
      console.log('⚠️  Some integrations failed. Check the log file for details.');
      process.exit(1);
    }
    
    console.log('🎉 All done! Images generated and uploaded successfully.');
    
  } catch (error) {
    console.error('\n💥 Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { main };

