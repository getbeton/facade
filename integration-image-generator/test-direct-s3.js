require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const WEBFLOW_SITE_ID = '68d4ef468dbbe960d0ed2e86';
const WEBFLOW_API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const WEBFLOW_BASE_URL = 'https://api.webflow.com/v2';

async function testUpload() {
  try {
    const imageBuffer = fs.readFileSync('test-output-apollo-integration-beton.png');
    const crypto = require('crypto');
    const fileHash = crypto.createHash('md5').update(imageBuffer).digest('hex');
    
    console.log('Creating asset record...');
    const createResponse = await axios.post(
      `${WEBFLOW_BASE_URL}/sites/${WEBFLOW_SITE_ID}/assets`,
      {
        fileName: 'apollo-ukiyo-final-test.png',
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
    const fields = createResponse.data.uploadDetails.fields;
    
    console.log('Upload URL:', uploadUrl);
    console.log('Fields:', fields);
    
    // Create FormData with exact field names and order from AWS
    const formData = new FormData();
    formData.append('key', fields.key);
    formData.append('acl', fields.acl);
    formData.append('Cache-Control', fields['Cache-Control']);
    formData.append('content-type', fields['content-type']); // Note: lowercase!
    formData.append('success_action_status', fields.success_action_status);
    formData.append('X-Amz-Algorithm', fields['X-Amz-Algorithm']);
    formData.append('X-Amz-Credential', fields['X-Amz-Credential']);
    formData.append('X-Amz-Date', fields['X-Amz-Date']);
    formData.append('Policy', fields.Policy);
    formData.append('X-Amz-Signature', fields['X-Amz-Signature']);
    formData.append('file', imageBuffer, 'apollo-ukiyo-final-test.png');
    
    console.log('\nUploading to S3...');
    const uploadResponse = await axios.post(uploadUrl, formData, {
      headers: formData.getHeaders()
    });
    
    console.log('✅ S3 Upload successful!');
    console.log('Status:', uploadResponse.status);
    console.log('\nAsset details:');
    console.log('- ID:', createResponse.data.id);
    console.log('- Hosted URL:', createResponse.data.hostedUrl);
    
    return createResponse.data;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      const data = error.response.data;
      console.error('Response:', typeof data === 'string' ? data.substring(0, 300) : JSON.stringify(data, null, 2));
    }
  }
}

testUpload();
