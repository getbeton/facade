/**
 * IndexNow Setup & Submission Script
 *
 * This script helps set up IndexNow for a Webflow site by:
 * 1. Generating a verification key
 * 2. Instructing the user how to host it on Webflow (via redirect workaround)
 * 3. Submitting URLs to IndexNow
 *
 * Usage:
 *   node scripts/setup-indexnow.js [generate|submit]
 *
 * Environment variables required:
 *   - ENCRYPTION_KEY (for decrypting stored API keys)
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Configuration
const CONFIG = {
  collectionId: '68c2d046-9629-40dc-a558-7ecb1c4ab483', // Integrations collection
  webflowCollectionId: '69242b7284d9de0228db4d93',
  siteDomain: 'getbeton.ai',
  keyFile: 'indexnow-key.txt', // Local file to store the generated key
  host: 'getbeton.ai',
  recentFixesFile: './audit-reports/fixes/fix-results-2025-12-06.json'
};

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sthidehegwyiwoishltl.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Decryption function (from lib/crypto.ts)
function decrypt(ciphertext) {
  const ALGORITHM = 'aes-256-gcm';
  const keyString = process.env.ENCRYPTION_KEY || '0'.repeat(64);
  const key = Buffer.from(keyString, 'hex');

  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Fetch Webflow items via API (reused from fix-seo-issues.js)
async function fetchWebflowItems(token, collectionId) {
  const WEBFLOW_BASE_URL = 'https://api.webflow.com/v2';

  let allItems = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  console.log('Fetching Webflow items...');

  while (hasMore) {
    const response = await axios.get(
      `${WEBFLOW_BASE_URL}/collections/${collectionId}/items`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
        params: { offset, limit }
      }
    );

    allItems = allItems.concat(response.data.items || []);
    offset += limit;
    hasMore = (response.data.items || []).length === limit;

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`Fetched ${allItems.length} items from Webflow`);
  return allItems;
}

async function getWebflowToken() {
  console.log('Fetching API keys from database...');
  const { data: collection, error } = await supabase
    .from('collections')
    .select('webflow_api_key')
    .eq('id', CONFIG.collectionId)
    .single();

  if (error || !collection) {
    throw new Error(`Error fetching collection: ${error?.message}`);
  }

  try {
    return decrypt(collection.webflow_api_key);
  } catch (e) {
    throw new Error(`Error decrypting API keys: ${e.message}`);
  }
}

function generateKey() {
  // Generate a random key (32-128 chars, alphanumeric)
  return crypto.randomBytes(16).toString('hex') + crypto.randomBytes(16).toString('hex');
}

async function verifyKeyOnSite(key) {
  const url = `https://${CONFIG.host}/${key}.txt`;
  console.log(`Verifying key at: ${url}`);
  try {
    const response = await axios.get(url);
    if (response.status === 200 && response.data.trim() === key) {
      console.log('✅ Key verification successful!');
      return true;
    } else {
      console.error(`❌ Verification failed. Content mismatch or status ${response.status}.`);
      console.log(`Expected: "${key}"`);
      console.log(`Received: "${response.data.trim()}"`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Verification failed: ${error.message}`);
    if (error.response) {
       console.error(`Status: ${error.response.status}`);
    }
    return false;
  }
}

async function submitUrls(key, urls) {
  console.log(`Submitting ${urls.length} URLs to IndexNow...`);
  
  const payload = {
    host: CONFIG.host,
    key: key,
    keyLocation: `https://${CONFIG.host}/${key}.txt`,
    urlList: urls
  };

  try {
    const response = await axios.post('https://api.indexnow.org/indexnow', payload, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
    
    if (response.status === 200 || response.status === 202) {
      console.log('✅ Submission successful!');
    } else {
      console.error(`❌ Submission failed with status: ${response.status}`);
      console.error(response.data);
    }
  } catch (error) {
    console.error(`❌ Submission failed: ${error.message}`);
    if (error.response) {
      console.error(error.response.data);
    }
  }
}

async function main() {
  const mode = process.argv[2] || 'generate';
  
  console.log('='.repeat(60));
  console.log(`IndexNow Setup - Mode: ${mode.toUpperCase()}`);
  console.log('='.repeat(60));

  if (mode === 'generate') {
    const key = generateKey();
    const filename = `${key}.txt`;
    
    // Save locally
    fs.writeFileSync(CONFIG.keyFile, key);
    fs.writeFileSync(filename, key);
    
    console.log(`
1. Generated IndexNow Key: ${key}
2. Saved to local file: ${filename}

INSTRUCTIONS FOR WEBFLOW SETUP:
-------------------------------
Since Webflow doesn't support uploading files to root directly, follow these steps:

1. Upload the file "${filename}" to your Webflow Assets (Media Library).
2. Copy the URL of the uploaded asset (e.g., https://cdn.prod.website-files.com/...).
3. Go to Webflow Site Settings -> Publishing -> 301 Redirects.
4. Add a new redirect:
   Old Path: /${filename}
   New Path: [Paste the Asset URL here]
5. Publish your site.

Once you have done this, run this script again with "submit":
   node scripts/setup-indexnow.js submit
`);

  } else if (mode === 'submit') {
    // Read key from local file
    if (!fs.existsSync(CONFIG.keyFile)) {
      console.error('Error: Key file not found. Run "generate" mode first.');
      process.exit(1);
    }
    
    const key = fs.readFileSync(CONFIG.keyFile, 'utf-8').trim();
    console.log(`Using key: ${key}`);
    
    // Verify
    const isVerified = await verifyKeyOnSite(key);
    if (!isVerified) {
      console.log('Please complete the Webflow setup steps and publish your site before submitting.');
      process.exit(1);
    }
    
    // Get URLs
    let urls = [];
    
    // Try to load from recent fixes first
    if (fs.existsSync(CONFIG.recentFixesFile)) {
      console.log(`Loading URLs from ${CONFIG.recentFixesFile}...`);
      const fixes = JSON.parse(fs.readFileSync(CONFIG.recentFixesFile, 'utf-8'));
      // Extract unique URLs with successful status
      const uniqueUrls = new Set(
        fixes
          .filter(f => f.status === 'success')
          .map(f => f.url)
      );
      urls = Array.from(uniqueUrls);
      console.log(`Found ${urls.length} recently updated URLs.`);
    }
    
    // Fallback or addition: Fetch from Webflow (commented out to prefer recent fixes, but can be enabled)
    /*
    if (urls.length === 0) {
      try {
        const token = await getWebflowToken();
        const items = await fetchWebflowItems(token, CONFIG.webflowCollectionId);
        
        // Convert items to URLs
        urls = items
          .filter(item => item.fieldData?.slug)
          .map(item => `https://${CONFIG.host}/integrations/${item.fieldData.slug}`);
          
        console.log(`Fetched ${urls.length} URLs from Webflow.`);
      } catch (e) {
        console.error('Failed to fetch from Webflow:', e.message);
      }
    }
    */
   
    if (urls.length === 0) {
      console.error('No URLs found to submit.');
      process.exit(1);
    }
    
    // Submit
    await submitUrls(key, urls);
    
  } else {
    console.error('Invalid mode. Use "generate" or "submit".');
  }
}

main().catch(console.error);



