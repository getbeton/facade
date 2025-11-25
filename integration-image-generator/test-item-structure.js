require('dotenv').config();
const axios = require('axios');

const WEBFLOW_COLLECTION_ID = '69242b7284d9de0228db4d93';
const WEBFLOW_API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const WEBFLOW_BASE_URL = 'https://api.webflow.com/v2';

async function checkItemStructure() {
  try {
    // Get Apollo item
    const itemId = '69247f5a401236a9aa4f61eb';
    
    console.log('Fetching item...');
    const getResponse = await axios.get(
      `${WEBFLOW_BASE_URL}/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`,
      {
        headers: {
          'Authorization': `Bearer ${WEBFLOW_API_TOKEN}`
        }
      }
    );
    
    console.log('\nCurrent fieldData keys:');
    console.log(Object.keys(getResponse.data.fieldData));
    
    console.log('\nRequired fields (name and slug):');
    console.log('- name:', getResponse.data.fieldData.name);
    console.log('- slug:', getResponse.data.fieldData.slug);
    
    // Now try updating with required fields included
    console.log('\nTrying update with required fields...');
    const assetId = '6924d5ea3cbc7a2e4827bf60';
    
    await axios.patch(
      `${WEBFLOW_BASE_URL}/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`,
      {
        isArchived: false,
        isDraft: false,
        fieldData: {
          'name': getResponse.data.fieldData.name,
          'slug': getResponse.data.fieldData.slug,
          'og-image': {
            fileId: assetId,
            url: `https://cdn.prod.website-files.com/68d4ef468dbbe960d0ed2e86/${assetId}_apollo-complete-test-1764021704951.png`,
            alt: 'Apollo.io Integration OG Image'
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
    
    console.log('✅ Update successful!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

checkItemStructure();
