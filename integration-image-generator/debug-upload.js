require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

const WEBFLOW_SITE_ID = '68d4ef468dbbe960d0ed2e86';
const WEBFLOW_COLLECTION_ID = '69242b7284d9de0228db4d93';
const WEBFLOW_API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const WEBFLOW_BASE_URL = 'https://api.webflow.com/v2';

async function debugUploadAndUpdate() {
  try {
    // Read the test image we already generated
    const imageBuffer = fs.readFileSync('test-output-apollo-integration-beton.png');
    
    console.log('Step 1: Uploading to Webflow...');
    
    const crypto = require('crypto');
    const fileHash = crypto.createHash('md5').update(imageBuffer).digest('hex');
    
    // Create asset
    const createResponse = await axios.post(
      `${WEBFLOW_BASE_URL}/sites/${WEBFLOW_SITE_ID}/assets`,
      {
        fileName: 'test-apollo-ukiyo-e.png',
        fileHash: fileHash
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${WEBFLOW_API_TOKEN}`
        }
      }
    );
    
    console.log('Asset created:', JSON.stringify(createResponse.data, null, 2));
    
    const uploadUrl = createResponse.data.uploadUrl;
    const uploadDetails = createResponse.data.uploadDetails;
    
    // Upload file
    const FormData = require('form-data');
    const formData = new FormData();
    
    if (uploadDetails?.fields) {
      Object.entries(uploadDetails.fields).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }
    
    formData.append('file', imageBuffer, {
      filename: 'test-apollo-ukiyo-e.png',
      contentType: 'image/png'
    });
    
    await axios.post(uploadUrl, formData, {
      headers: formData.getHeaders()
    });
    
    console.log('\nStep 2: Testing different update formats...\n');
    
    const itemId = '69247f5a401236a9aa4f61eb'; // Apollo integration
    
    // Try format 1: Just the asset ID string
    console.log('Trying format 1: Just asset ID as string');
    try {
      await axios.patch(
        `${WEBFLOW_BASE_URL}/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`,
        {
          fieldData: {
            'og-image': createResponse.data.id
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${WEBFLOW_API_TOKEN}`
          }
        }
      );
      console.log('✅ Format 1 WORKED!');
      return;
    } catch (error) {
      console.log('❌ Format 1 failed:', error.response?.data?.message || error.message);
    }
    
    // Try format 2: fileId in object
    console.log('\nTrying format 2: { fileId: ... }');
    try {
      await axios.patch(
        `${WEBFLOW_BASE_URL}/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`,
        {
          fieldData: {
            'og-image': {
              fileId: createResponse.data.id
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
      console.log('✅ Format 2 WORKED!');
      return;
    } catch (error) {
      console.log('❌ Format 2 failed:', error.response?.data?.message || error.message);
    }
    
    // Try format 3: Full object with fileId and url
    console.log('\nTrying format 3: { fileId, url, alt }');
    try {
      await axios.patch(
        `${WEBFLOW_BASE_URL}/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`,
        {
          fieldData: {
            'og-image': {
              fileId: createResponse.data.id,
              url: createResponse.data.url,
              alt: 'Test'
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
      console.log('✅ Format 3 WORKED!');
      return;
    } catch (error) {
      console.log('❌ Format 3 failed:', error.response?.data?.message || error.message);
    }
    
    console.log('\n❌ All formats failed!');
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

debugUploadAndUpdate();
