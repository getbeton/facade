require('dotenv').config();
const axios = require('axios');

const WEBFLOW_COLLECTION_ID = '69242b7284d9de0228db4d93';
const WEBFLOW_API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const WEBFLOW_BASE_URL = 'https://api.webflow.com/v2';

async function testCMSUpdate() {
  const itemId = '69247f5a401236a9aa4f61eb'; // Apollo integration
  const assetId = '6924d5ea3cbc7a2e4827bf60'; // From our successful upload
  const assetUrl = 'https://cdn.prod.website-files.com/68d4ef468dbbe960d0ed2e86/6924d5ea3cbc7a2e4827bf60_apollo-complete-test-1764021704951.png';
  
  // Format 1: Just string ID
  console.log('Testing Format 1: Plain string');
  try {
    await axios.patch(
      `${WEBFLOW_BASE_URL}/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`,
      {
        fieldData: {
          'og-image': assetId
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${WEBFLOW_API_TOKEN}`
        }
      }
    );
    console.log('✅ Format 1 SUCCESS!\n');
    return;
  } catch (e) {
    console.log('❌ Format 1 failed:', e.response?.data?.message || e.message, '\n');
  }
  
  // Format 2: Object with fileId
  console.log('Testing Format 2: { fileId: ... }');
  try {
    await axios.patch(
      `${WEBFLOW_BASE_URL}/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`,
      {
        fieldData: {
          'og-image': {
            fileId: assetId
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
    console.log('✅ Format 2 SUCCESS!\n');
    return;
  } catch (e) {
    console.log('❌ Format 2 failed:', e.response?.data?.message || e.message, '\n');
  }
  
  // Format 3: Object with url
  console.log('Testing Format 3: { url: ... }');
  try {
    await axios.patch(
      `${WEBFLOW_BASE_URL}/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`,
      {
        fieldData: {
          'og-image': {
            url: assetUrl
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
    console.log('✅ Format 3 SUCCESS!\n');
    return;
  } catch (e) {
    console.log('❌ Format 3 failed:', e.response?.data?.message || e.message, '\n');
  }
  
  // Format 4: Object with fileId and url
  console.log('Testing Format 4: { fileId, url }');
  try {
    await axios.patch(
      `${WEBFLOW_BASE_URL}/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`,
      {
        fieldData: {
          'og-image': {
            fileId: assetId,
            url: assetUrl
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
    console.log('✅ Format 4 SUCCESS!\n');
    return;
  } catch (e) {
    console.log('❌ Format 4 failed:', e.response?.data?.message || e.message, '\n');
  }
  
  console.log('❌ All formats failed!');
}

testCMSUpdate();
