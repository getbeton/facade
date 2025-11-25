/**
 * Helper script to list all integrations that will be processed
 * Useful for understanding what the batch script will do
 * 
 * Usage: node scripts/list-integrations.js
 */

require('dotenv').config();
const axios = require('axios');

const WEBFLOW_SITE_ID = '68d4ef468dbbe960d0ed2e86';
const WEBFLOW_COLLECTION_ID = '69242b7284d9de0228db4d93';
const WEBFLOW_API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const WEBFLOW_BASE_URL = 'https://api.webflow.com/v2';

async function listIntegrations() {
  console.log('📋 Fetching all integrations from Webflow...\n');
  
  try {
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
    }
    
    console.log(`✅ Found ${allItems.length} integration items\n`);
    console.log('═'.repeat(80));
    console.log('INTEGRATION LIST');
    console.log('═'.repeat(80));
    console.log();
    
    allItems.forEach((item, index) => {
      const toolName = item.fieldData['tool-name'] || item.fieldData.name;
      const slug = item.fieldData.slug;
      const hasOGImage = item.fieldData['og-image'] ? '✅' : '❌';
      
      console.log(`${(index + 1).toString().padStart(3)}. ${toolName.padEnd(30)} ${slug.padEnd(40)} ${hasOGImage} OG Image`);
    });
    
    console.log();
    console.log('═'.repeat(80));
    
    const withOGImage = allItems.filter(item => item.fieldData['og-image']).length;
    const withoutOGImage = allItems.length - withOGImage;
    
    console.log('\nSTATISTICS:');
    console.log(`Total integrations: ${allItems.length}`);
    console.log(`With OG image: ${withOGImage}`);
    console.log(`Without OG image: ${withoutOGImage}`);
    console.log();
    
    if (withoutOGImage === 0) {
      console.log('🎉 All integrations already have OG images!');
      console.log('   Run the script only if you want to regenerate them.\n');
    } else {
      console.log(`⚠️  ${withoutOGImage} integrations need OG images.`);
      console.log('   Run "npm run generate" to create them.\n');
    }
    
    // Export to file
    const fs = require('fs').promises;
    const outputPath = require('path').join(__dirname, 'integration-list.json');
    
    const exportData = allItems.map(item => ({
      id: item.id,
      name: item.fieldData['tool-name'] || item.fieldData.name,
      slug: item.fieldData.slug,
      hasOGImage: !!item.fieldData['og-image'],
      ogImageUrl: item.fieldData['og-image']?.url || null
    }));
    
    await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2));
    console.log(`📄 Full list exported to: integration-list.json\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Validate environment
if (!WEBFLOW_API_TOKEN) {
  console.error('❌ Error: WEBFLOW_API_TOKEN environment variable is required');
  console.error('   Create a .env file with your Webflow API token');
  process.exit(1);
}

listIntegrations();

