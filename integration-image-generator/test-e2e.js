// Test a single integration with the actual script logic
require('dotenv').config();
const { main } = require('./generate-integration-images-dalle.js');

// Temporarily modify to process only Apollo
const originalMain = require('./generate-integration-images-dalle.js');

async function testSingleItem() {
  const axios = require('axios');
  const WEBFLOW_BASE_URL = 'https://api.webflow.com/v2';
  const WEBFLOW_COLLECTION_ID = '69242b7284d9de0228db4d93';
  const WEBFLOW_API_TOKEN = process.env.WEBFLOW_API_TOKEN;
  
  // Get just Apollo integration
  const response = await axios.get(
    `${WEBFLOW_BASE_URL}/collections/${WEBFLOW_COLLECTION_ID}/items`,
    {
      headers: { 'Authorization': `Bearer ${WEBFLOW_API_TOKEN}` },
      params: { limit: 1 }
    }
  );
  
  const integration = response.data.items[0];
  console.log('Testing with:', integration.fieldData['tool-name']);
  
  // Process it through the actual function
  const processIntegration = eval(require('fs').readFileSync('generate-integration-images-dalle.js', 'utf8').match(/async function processIntegration[\s\S]+?^}/m)[0]);
  
  const result = await processIntegration(integration, 0, 1);
  console.log('\nResult:', JSON.stringify(result, null, 2));
}

testSingleItem();
