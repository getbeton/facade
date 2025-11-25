require('dotenv').config();
const axios = require('axios');
const OpenAI = require('openai');
const FormData = require('form-data');
const fs = require('fs');
const crypto = require('crypto');

const WEBFLOW_SITE_ID = '68d4ef468dbbe960d0ed2e86';
const WEBFLOW_COLLECTION_ID = '69242b7284d9de0228db4d93';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WEBFLOW_API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const WEBFLOW_BASE_URL = 'https://api.webflow.com/v2';

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function testFullFlow() {
  try {
    // Use test image we already have
    const imageBuffer = fs.readFileSync('test-output-apollo-integration-beton.png');
    const timestamp = Date.now();
    const fileName = `apollo-final-${timestamp}.png`;
    
    // Step 1: Create asset
    console.log('Step 1: Creating Webflow asset...');
    const fileHash = crypto.createHash('md5').update(Buffer.concat([imageBuffer, Buffer.from(timestamp.toString())])).digest('hex');
    
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
        }
      }
    );
    
    console.log('✅ Asset created, ID:', createResponse.data.id);
    
    // Step 2: Upload to S3
    console.log('\nStep 2: Uploading to S3...');
    const uploadUrl = createResponse.data.uploadUrl;
    const uploadDetails = createResponse.data.uploadDetails;
    
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
    formData.append('file', imageBuffer, fileName);
    
    await axios.post(uploadUrl, formData, {
      headers: formData.getHeaders()
    });
    
    console.log('✅ S3 upload successful!');
    
    // Step 3: Get integration data
    console.log('\nStep 3: Fetching integration data...');
    const itemId = '69247f5a401236a9aa4f61eb';
    const getResponse = await axios.get(
      `${WEBFLOW_BASE_URL}/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`,
      {
        headers: {
          'Authorization': `Bearer ${WEBFLOW_API_TOKEN}`
        }
      }
    );
    
    console.log('✅ Fetched integration data');
    
    // Step 4: Update CMS
    console.log('\nStep 4: Updating CMS item...');
    await axios.patch(
      `${WEBFLOW_BASE_URL}/collections/${WEBFLOW_COLLECTION_ID}/items/${itemId}`,
      {
        isArchived: false,
        isDraft: false,
        fieldData: {
          'name': getResponse.data.fieldData.name,
          'slug': getResponse.data.fieldData.slug,
          'og-image': {
            fileId: createResponse.data.id,
            url: createResponse.data.hostedUrl,
            alt: `${getResponse.data.fieldData['tool-name']} Integration OG Image`
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
    
    console.log('✅ CMS item updated!');
    
    console.log('\n🎉 COMPLETE FLOW SUCCESSFUL!');
    console.log('═'.repeat(60));
    console.log('Asset ID:', createResponse.data.id);
    console.log('Hosted URL:', createResponse.data.hostedUrl);
    console.log('View at: https://getbeton.ai/integrations/apollo-integration-beton');
    console.log('═'.repeat(60));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testFullFlow();
