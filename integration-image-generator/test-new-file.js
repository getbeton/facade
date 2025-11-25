require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

const WEBFLOW_SITE_ID = '68d4ef468dbbe960d0ed2e86';
const WEBFLOW_API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const WEBFLOW_BASE_URL = 'https://api.webflow.com/v2';

async function testUpload() {
  try {
    const imageBuffer = fs.readFileSync('test-output-apollo-integration-beton.png');
    const crypto = require('crypto');
    
    // Use timestamp to ensure unique hash
    const timestamp = Date.now();
    const modifiedBuffer = Buffer.concat([imageBuffer, Buffer.from(timestamp.toString())]);
    const fileHash = crypto.createHash('md5').update(modifiedBuffer).digest('hex');
    
    console.log('Creating asset with unique hash...');
    console.log('Hash:', fileHash);
    
    const createResponse = await axios.post(
      `${WEBFLOW_BASE_URL}/sites/${WEBFLOW_SITE_ID}/assets`,
      {
        fileName: `apollo-test-${timestamp}.png`,
        fileHash: fileHash
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${WEBFLOW_API_TOKEN}`
        }
      }
    );
    
    console.log('\nFull create response:');
    console.log(JSON.stringify(createResponse.data, null, 2));
    
    console.log('\nuploadDetails exists:', !!createResponse.data.uploadDetails);
    console.log('fields exists:', !!createResponse.data.uploadDetails?.fields);
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
  }
}

testUpload();
