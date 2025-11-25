require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const WEBFLOW_SITE_ID = '68d4ef468dbbe960d0ed2e86';
const WEBFLOW_COLLECTION_ID = '69242b7284d9de0228db4d93';
const WEBFLOW_API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const WEBFLOW_BASE_URL = 'https://api.webflow.com/v2';

async function testCompleteFlow() {
  try {
    const imageBuffer = fs.readFileSync('test-output-apollo-integration-beton.png');
    const crypto = require('crypto');
    
    // Step 1: Create asset with unique hash
    const timestamp = Date.now();
    const fileHash = crypto.createHash('md5').update(Buffer.concat([imageBuffer, Buffer.from(timestamp.toString())])).digest('hex');
    
    console.log('Step 1: Creating asset record...');
    const createResponse = await axios.post(
      `${WEBFLOW_BASE_URL}/sites/${WEBFLOW_SITE_ID}/assets`,
      {
        fileName: `apollo-complete-test-${timestamp}.png`,
        fileHash: fileHash
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${WEBFLOW_API_TOKEN}`
        }
      }
    );
    
    const uploadUrl = createResponse.data.uploadUrl;
    const uploadDetails = createResponse.data.uploadDetails;
    const assetId = createResponse.data.id;
    
    console.log('✅ Asset created, ID:', assetId);
    
    // Step 2: Upload to S3
    console.log('\nStep 2: Uploading to S3...');
    const formData = new FormData();
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
    formData.append('file', imageBuffer, `apollo-complete-test-${timestamp}.png`);
    
    await axios.post(uploadUrl, formData, {
      headers: formData.getHeaders()
    });
    
    console.log('✅ S3 upload successful!');
    
    // Step 3: Update CMS item
    console.log('\nStep 3: Updating CMS item...');
    const itemId = '69247f5a401236a9aa4f61eb'; // Apollo integration
    
    // Try just the asset ID
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
    
    console.log('✅ CMS item updated!');
    console.log('\n🎉 Complete flow successful!');
    console.log('View at: https://getbeton.ai/integrations/apollo-integration-beton');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      const data = error.response.data;
      console.error('Response:', typeof data === 'string' ? data.substring(0, 500) : JSON.stringify(data, null, 2));
    }
  }
}

testCompleteFlow();
