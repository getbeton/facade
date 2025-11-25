require('dotenv').config();
const axios = require('axios');

const WEBFLOW_COLLECTION_ID = '69242b7284d9de0228db4d93';
const WEBFLOW_API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const WEBFLOW_BASE_URL = 'https://api.webflow.com/v2';

async function testUpdate() {
  // Test with Apollo integration
  const itemId = '69247f5a401236a9aa4f61eb';
  
  // First, let's see what the current item looks like
  try {
    const getResponse = await axios.get(
      `${WEBFLOW_BASE_URL}/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`,
      {
        headers: {
          'Authorization': `Bearer ${WEBFLOW_API_TOKEN}`
        }
      }
    );
    
    console.log('Current item structure:');
    console.log(JSON.stringify(getResponse.data.fieldData['og-image'], null, 2));
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testUpdate();
