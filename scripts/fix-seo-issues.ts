/**
 * SEO Issue Fixer Script
 *
 * This script processes the Ahrefs audit data and fixes SEO issues by:
 * 1. Mapping URLs to Webflow CMS items
 * 2. Generating SEO metadata using OpenAI
 * 3. Updating Webflow CMS with the generated content
 *
 * Usage:
 *   npx ts-node scripts/fix-seo-issues.ts
 *
 * Environment variables required:
 *   - ENCRYPTION_KEY (for decrypting stored API keys)
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Import from existing codebase
const crypto = require('crypto');

// Configuration
const CONFIG = {
  collectionId: '68c2d046-9629-40dc-a558-7ecb1c4ab483', // Integrations collection
  webflowCollectionId: '69242b7284d9de0228db4d93',
  siteId: '68d4ef468dbbe960d0ed2e86',
  siteName: 'GetBeton.ai',
  siteDomain: 'getbeton.ai',
  csvPath: './audit-reports/ahrefs-audit-consolidated-2025-12-06.csv',
  outputDir: './audit-reports/fixes',
  dryRun: true, // Set to false to actually update Webflow
  batchSize: 10, // Process items in batches
  delayBetweenItems: 1000, // ms between API calls
};

// Issue types that can be fixed by updating CMS fields
const FIXABLE_ISSUES = {
  'indexable-Title_tag_missing_or_empty': {
    webflowField: 'seo-title',
    generationField: 'meta-title',
    priority: 1,
  },
  'indexable-Meta_description_tag_missing_or_empty': {
    webflowField: 'seo-description',
    generationField: 'meta-description',
    priority: 2,
  },
  'Open_Graph_tags_incomplete': {
    webflowField: 'og-title', // May need og-description too
    generationField: 'og-title',
    priority: 3,
  },
  'Open_Graph_tags_missing': {
    webflowField: 'og-title',
    generationField: 'og-title',
    priority: 3,
  },
};

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sthidehegwyiwoishltl.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Decryption function (from lib/crypto.ts)
function decrypt(ciphertext: string): string {
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

interface CSVRow {
  priority: number;
  url: string;
  issueType: string;
  severity: string;
  severityScore: number;
  category: string;
  title: string;
  organicTraffic: string;
  depth: string;
  isIndexable: string;
  httpStatus: string;
  sourceFile: string;
}

interface WebflowItem {
  id: string;
  fieldData: Record<string, any>;
  slug?: string;
}

interface FixResult {
  url: string;
  itemId: string;
  issueType: string;
  field: string;
  originalValue: string;
  generatedValue: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
}

// Parse CSV file
function parseCSV(filePath: string): CSVRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');

  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Handle quoted fields with commas
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.replace(/^"|"$/g, ''));

    rows.push({
      priority: parseInt(values[0]) || 0,
      url: values[1] || '',
      issueType: values[2] || '',
      severity: values[3] || '',
      severityScore: parseInt(values[4]) || 0,
      category: values[5] || '',
      title: values[6] || '',
      organicTraffic: values[7] || '0',
      depth: values[8] || '0',
      isIndexable: values[9] || 'false',
      httpStatus: values[10] || '',
      sourceFile: values[11] || '',
    });
  }

  return rows;
}

// Extract slug from URL
function extractSlugFromUrl(url: string, domain: string): string | null {
  try {
    const urlObj = new URL(url);
    if (!urlObj.hostname.includes(domain)) return null;

    // Extract the slug (last part of path)
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    if (pathParts.length >= 2 && pathParts[0] === 'integrations') {
      return pathParts[1];
    }
    return pathParts[pathParts.length - 1] || null;
  } catch {
    return null;
  }
}

// Fetch Webflow items via API
async function fetchWebflowItems(token: string, collectionId: string): Promise<WebflowItem[]> {
  const axios = (await import('axios')).default;
  const WEBFLOW_BASE_URL = 'https://api.webflow.com/v2';

  let allItems: WebflowItem[] = [];
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

// Create URL to item mapping
function createUrlToItemMap(items: WebflowItem[], domain: string): Map<string, WebflowItem> {
  const map = new Map<string, WebflowItem>();

  for (const item of items) {
    const slug = item.fieldData?.slug || item.slug;
    if (slug) {
      // Create possible URL variations
      const urls = [
        `https://${domain}/integrations/${slug}`,
        `https://www.${domain}/integrations/${slug}`,
        `https://${domain}/integrations/${slug}/`,
      ];

      for (const url of urls) {
        map.set(url.toLowerCase(), item);
      }
    }
  }

  console.log(`Created mapping for ${map.size} URLs`);
  return map;
}

// Generate SEO content using OpenAI
async function generateSeoContent(
  apiKey: string,
  itemData: Record<string, any>,
  fieldType: 'meta-title' | 'meta-description' | 'og-title' | 'og-description'
): Promise<{ suggestion: string; reasoning: string }> {
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey });

  // Extract relevant content from item
  const itemName = itemData['tool-name'] || itemData['name'] || itemData['slug'] || 'Unknown';
  const heroH1 = itemData['hero-h1'] || '';
  const heroBody = itemData['hero-body'] || '';
  const problemHeading = itemData['problem-heading'] || '';

  let systemPrompt = `You are an expert SEO specialist for GetBeton.ai, a B2B sales automation platform.
You are generating ${fieldType} for an integration page.`;

  let constraints = '';
  if (fieldType === 'meta-title' || fieldType === 'og-title') {
    constraints = `
Requirements:
- Maximum 60 characters
- Include the integration name
- Include "GetBeton" or "Beton" brand
- Make it compelling and clickable
- Focus on the value proposition`;
  } else {
    constraints = `
Requirements:
- Between 150-160 characters
- Summarize what the integration does
- Include a call-to-action
- Mention GetBeton platform`;
  }

  const userPrompt = `
Generate a ${fieldType} for this integration page:

Integration Name: ${itemName}
Headline: ${heroH1}
Description: ${heroBody.substring(0, 500)}
Problem Solved: ${problemHeading}

${constraints}

Return JSON: { "suggestion": "your generated text", "reasoning": "brief explanation" }
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('No content returned from OpenAI');

  return JSON.parse(content);
}

// Update Webflow item
async function updateWebflowItem(
  token: string,
  collectionId: string,
  itemId: string,
  fieldData: Record<string, any>
): Promise<void> {
  const axios = (await import('axios')).default;
  const WEBFLOW_BASE_URL = 'https://api.webflow.com/v2';

  await axios.patch(
    `${WEBFLOW_BASE_URL}/collections/${collectionId}/items/${itemId}`,
    { fieldData },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }
  );
}

// Main execution
async function main() {
  console.log('='.repeat(60));
  console.log('SEO ISSUE FIXER');
  console.log('='.repeat(60));
  console.log(`Mode: ${CONFIG.dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  console.log('');

  // Create output directory
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  // Step 1: Get API keys from database
  console.log('Step 1: Fetching API keys from database...');
  const { data: collection, error } = await supabase
    .from('collections')
    .select('webflow_api_key, openai_api_key')
    .eq('id', CONFIG.collectionId)
    .single();

  if (error || !collection) {
    console.error('Error fetching collection:', error);
    process.exit(1);
  }

  let webflowToken: string;
  let openaiKey: string;

  try {
    webflowToken = decrypt(collection.webflow_api_key);
    openaiKey = collection.openai_api_key ? decrypt(collection.openai_api_key) : '';

    // Fallback to platform key if user doesn't have one
    if (!openaiKey || !openaiKey.startsWith('sk-')) {
      openaiKey = process.env.PLATFORM_OPENAI_API_KEY || '';
    }

    if (!openaiKey.startsWith('sk-')) {
      console.error('No valid OpenAI API key found');
      process.exit(1);
    }

    console.log('  API keys retrieved successfully');
  } catch (e) {
    console.error('Error decrypting API keys:', e);
    process.exit(1);
  }

  // Step 2: Parse CSV data
  console.log('\nStep 2: Parsing audit CSV...');
  const csvRows = parseCSV(CONFIG.csvPath);
  console.log(`  Found ${csvRows.length} issues in CSV`);

  // Filter to only fixable issues
  const fixableRows = csvRows.filter(row =>
    FIXABLE_ISSUES[row.issueType as keyof typeof FIXABLE_ISSUES] &&
    row.url.includes(CONFIG.siteDomain) &&
    row.url.includes('/integrations/')
  );
  console.log(`  ${fixableRows.length} issues are fixable via CMS`);

  // Group by URL to avoid duplicates
  const issuesByUrl = new Map<string, CSVRow[]>();
  for (const row of fixableRows) {
    const existing = issuesByUrl.get(row.url) || [];
    existing.push(row);
    issuesByUrl.set(row.url, existing);
  }
  console.log(`  ${issuesByUrl.size} unique URLs to process`);

  // Step 3: Fetch Webflow items
  console.log('\nStep 3: Fetching Webflow collection items...');
  const webflowItems = await fetchWebflowItems(webflowToken, CONFIG.webflowCollectionId);

  // Create URL mapping
  const urlToItemMap = createUrlToItemMap(webflowItems, CONFIG.siteDomain);

  // Step 4: Process each URL
  console.log('\nStep 4: Processing issues...');
  const results: FixResult[] = [];
  let processed = 0;
  let matched = 0;
  let generated = 0;
  let updated = 0;

  for (const [url, issues] of issuesByUrl) {
    processed++;
    console.log(`\n[${processed}/${issuesByUrl.size}] ${url}`);

    // Find matching Webflow item
    const item = urlToItemMap.get(url.toLowerCase());
    if (!item) {
      console.log(`  SKIP: No matching Webflow item found`);
      for (const issue of issues) {
        results.push({
          url,
          itemId: '',
          issueType: issue.issueType,
          field: '',
          originalValue: '',
          generatedValue: '',
          status: 'skipped',
          error: 'No matching Webflow item',
        });
      }
      continue;
    }

    matched++;
    console.log(`  Matched to item: ${item.id} (${item.fieldData?.['tool-name'] || item.fieldData?.slug})`);

    // Process each issue for this URL
    for (const issue of issues) {
      const fixConfig = FIXABLE_ISSUES[issue.issueType as keyof typeof FIXABLE_ISSUES];
      if (!fixConfig) continue;

      const { webflowField, generationField } = fixConfig;
      const originalValue = item.fieldData?.[webflowField] || '';

      console.log(`  Issue: ${issue.issueType}`);
      console.log(`    Current ${webflowField}: "${originalValue.substring(0, 50)}..."`);

      // Skip if already has value
      if (originalValue && originalValue.length > 5) {
        console.log(`    SKIP: Field already has content`);
        results.push({
          url,
          itemId: item.id,
          issueType: issue.issueType,
          field: webflowField,
          originalValue,
          generatedValue: '',
          status: 'skipped',
          error: 'Field already has content',
        });
        continue;
      }

      try {
        // Generate content
        console.log(`    Generating ${generationField}...`);
        const { suggestion, reasoning } = await generateSeoContent(
          openaiKey,
          item.fieldData,
          generationField as any
        );
        generated++;

        console.log(`    Generated: "${suggestion}"`);
        console.log(`    Reasoning: ${reasoning}`);

        // Update Webflow (if not dry run)
        if (!CONFIG.dryRun) {
          console.log(`    Updating Webflow...`);
          await updateWebflowItem(webflowToken, CONFIG.webflowCollectionId, item.id, {
            [webflowField]: suggestion
          });
          updated++;
          console.log(`    Updated!`);
        } else {
          console.log(`    [DRY RUN] Would update ${webflowField}`);
        }

        results.push({
          url,
          itemId: item.id,
          issueType: issue.issueType,
          field: webflowField,
          originalValue,
          generatedValue: suggestion,
          status: 'success',
        });

      } catch (error: any) {
        console.log(`    ERROR: ${error.message}`);
        results.push({
          url,
          itemId: item.id,
          issueType: issue.issueType,
          field: webflowField,
          originalValue,
          generatedValue: '',
          status: 'failed',
          error: error.message,
        });
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, CONFIG.delayBetweenItems));
    }
  }

  // Step 5: Save results
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total URLs processed: ${processed}`);
  console.log(`URLs matched to Webflow items: ${matched}`);
  console.log(`Content generated: ${generated}`);
  console.log(`Items updated: ${updated}`);

  // Save results as JSON
  const resultsPath = path.join(CONFIG.outputDir, `fix-results-${new Date().toISOString().split('T')[0]}.json`);
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${resultsPath}`);

  // Save results as CSV
  const csvResultsPath = path.join(CONFIG.outputDir, `fix-results-${new Date().toISOString().split('T')[0]}.csv`);
  const csvHeaders = ['URL', 'Item ID', 'Issue Type', 'Field', 'Original Value', 'Generated Value', 'Status', 'Error'];
  const csvContent = [
    csvHeaders.join(','),
    ...results.map(r => [
      `"${r.url}"`,
      r.itemId,
      r.issueType,
      r.field,
      `"${r.originalValue.replace(/"/g, '""')}"`,
      `"${r.generatedValue.replace(/"/g, '""')}"`,
      r.status,
      `"${r.error || ''}"`,
    ].join(','))
  ].join('\n');
  fs.writeFileSync(csvResultsPath, csvContent);
  console.log(`CSV results saved to: ${csvResultsPath}`);

  // Generate markdown summary
  const mdPath = path.join(CONFIG.outputDir, `fix-summary-${new Date().toISOString().split('T')[0]}.md`);
  const successResults = results.filter(r => r.status === 'success');
  const failedResults = results.filter(r => r.status === 'failed');
  const skippedResults = results.filter(r => r.status === 'skipped');

  const mdContent = `# SEO Fix Results

**Date:** ${new Date().toISOString()}
**Mode:** ${CONFIG.dryRun ? 'DRY RUN' : 'LIVE'}
**Collection:** Integrations (${CONFIG.collectionId})

## Summary

- **Total URLs Processed:** ${processed}
- **URLs Matched:** ${matched}
- **Content Generated:** ${generated}
- **Items Updated:** ${updated}

## Results by Status

### Successful (${successResults.length})

| URL | Field | Generated Value |
|-----|-------|-----------------|
${successResults.slice(0, 20).map(r => `| ${r.url} | ${r.field} | ${r.generatedValue.substring(0, 50)}... |`).join('\n')}
${successResults.length > 20 ? `\n*...and ${successResults.length - 20} more*` : ''}

### Failed (${failedResults.length})

| URL | Error |
|-----|-------|
${failedResults.map(r => `| ${r.url} | ${r.error} |`).join('\n')}

### Skipped (${skippedResults.length})

| URL | Reason |
|-----|--------|
${skippedResults.slice(0, 10).map(r => `| ${r.url} | ${r.error} |`).join('\n')}
${skippedResults.length > 10 ? `\n*...and ${skippedResults.length - 10} more*` : ''}

## Next Steps

${CONFIG.dryRun ? `
1. Review the generated content above
2. Set \`CONFIG.dryRun = false\` to apply changes
3. Re-run the script to update Webflow
` : `
1. Verify changes in Webflow CMS
2. Publish the site to make changes live
3. Re-run Ahrefs crawl to verify fixes
`}

---
*Generated by fix-seo-issues.ts*
`;

  fs.writeFileSync(mdPath, mdContent);
  console.log(`Markdown summary saved to: ${mdPath}`);

  console.log('\n' + '='.repeat(60));
  console.log('DONE');
  console.log('='.repeat(60));
}

// Run
main().catch(console.error);
