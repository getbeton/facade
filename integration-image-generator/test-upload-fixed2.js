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
        fileName: 'test-fixed2.png',
        fileHash: fileHash
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${WEBFLOW_API_TOKEN}`
        }
      }
    );
    
    console.log('\nFull response:', JSON.stringify(createResponse.data, null, 2));
    
    const uploadUrl = createResponse.data.uploadUrl;
    const uploadDetails = createResponse.data.uploadDetails;
    
    if (!uploadDetails) {
      console.error('❌ No uploadDetails in response');
      return;
    }
    
    const fields = uploadDetails.fields;
    console.log('\nUpload fields:', Object.keys(fields));
    
    // Create form data with EXACT field order
    const formData = new FormData();
    
    // AWS S3 requires these fields in this specific order
    if (fields.key) formData.append('key', fields.key);
    if (fields.acl) formData.append('acl', fields.acl);
    if (fields['Cache-Control']) formData.append('Cache-Control', fields['Cache-Control']);
    if (fields['content-type']) formData.append('Content-Type', fields['content-type']);
    if (fields.success_action_status) formData.append('success_action_status', fields.success_action_status);
    if (fields['X-Amz-Algorithm']) formData.append('X-Amz-Algorithm', fields['X-Amz-Algorithm']);
    if (fields['X-Amz-Credential']) formData.append('X-Amz-Credential', fields['X-Amz-Credential']);
    if (fields['X-Amz-Date']) formData.append('X-Amz-Date', fields['X-Amz-Date']);
    if (fields.Policy) formData.append('Policy', fields.Policy);
    if (fields['X-Amz-Signature']) formData.append('X-Amz-Signature', fields['X-Amz-Signature']);
    
    formData.append('file', imageBuffer, {
      filename: 'test-fixed2.png',
      contentType: 'image/png'
    });
    
    console.log('\nUploading to S3...');
    const uploadResponse = await axios.post(uploadUrl, formData, {
      headers: formData.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });
    
    console.log('✅ Upload successful!');
    console.log('Status:', uploadResponse.status);
    console.log('Asset ID:', createResponse.data.id);
    console.log('Hosted URL:', createResponse.data.hostedUrl);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response data:', error.response.data.substring(0, 500));
    }
  }
}

testUpload();
