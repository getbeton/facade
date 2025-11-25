# Execution Guide: Generate Ukiyo-e Images for Integrations

## Overview

This guide walks you through the complete process of generating custom ukiyo-e (Japanese woodblock print) style images for all 104 integration pages and uploading them to Webflow.

---

## Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] OpenAI API key with credits (recommended $10+ balance)
- [ ] Webflow API token with write permissions
- [ ] Access to Webflow site: getbeton.ai
- [ ] ~1-2 hours of uninterrupted time

---

## Step-by-Step Execution

### 1. Navigate to Scripts Directory

```bash
cd /Users/nadyyym/yarik-beton-ai/beton-ai/scripts
```

### 2. Verify Installation

```bash
# Check if dependencies are installed
ls node_modules

# If not, run:
npm install
```

### 3. Configure API Keys

```bash
# Create .env file
nano .env
```

Add your keys:
```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx
WEBFLOW_API_TOKEN=xxxxxxxxxxxxxxxxxxxxx
```

Save and exit (Ctrl+X, then Y, then Enter)

### 4. Test with Single Integration

**IMPORTANT**: Always test first!

```bash
npm run test apollo-integration-beton
```

This will:
- Generate ONE test image
- Save it as `test-output-apollo-integration-beton.png`
- NOT upload to Webflow
- Show you the image URL for preview

**Review the image:**
```bash
open test-output-apollo-integration-beton.png
```

**If the image looks good**, proceed to step 5.  
**If not**, adjust the prompts in `generate-integration-images-dalle.js` and test again.

### 5. Run Full Generation (Point of No Return)

Once satisfied with the test:

```bash
npm run generate
```

**What happens:**
- 5-second countdown (Ctrl+C to cancel)
- Processes 2 integrations concurrently
- 3-second delay between requests
- Continues on individual failures
- Saves progress to log file
- Auto-publishes successful updates

**Progress monitoring:**
```
[1/104] Processing: Apollo.io (apollo-integration-beton)
📝 Generated prompt for Apollo.io
🎨 Generating image with DALL-E 3...
📥 Downloading generated image...
📤 Uploading apollo-integration-beton-ukiyo-e-og.png to Webflow...
✅ Uploaded apollo-integration-beton-ukiyo-e-og.png, asset ID: xxx
🔄 Updating integration xxx with OG image...
✅ Updated integration xxx
✅ Completed: Apollo.io
```

### 6. Monitor Execution

The script will take **approximately 1-2 hours** to complete.

**You can safely:**
- Let it run in the background
- Close the terminal (if using screen/tmux)
- Interrupt with Ctrl+C (progress saved to log)

**Do NOT:**
- Run multiple instances simultaneously
- Close laptop/lose connection (unless using screen/tmux)

### 7. Review Results

After completion:

```bash
# Find the latest log file
ls -lt integration-images-log-*.json | head -1

# View summary
cat integration-images-log-*.json | jq '.total, .successful, .failed'

# View failed items (if any)
cat integration-images-log-*.json | jq '.results[] | select(.success == false)'
```

### 8. Handle Failures (If Any)

If some integrations failed:

```bash
# Test the failed integration manually
npm run test failed-integration-slug

# Review the error
cat integration-images-log-*.json | jq '.results[] | select(.slug == "failed-integration-slug")'

# Fix and re-run just that one
# (You'll need to modify the script to process specific slugs)
```

---

## Expected Output

### Console Output

```
🚀 Starting Integration Images Generation Script (DALL-E 3)
==========================================================

📥 Fetching all integration items from Webflow...
✅ Fetched 104 integration items

🎯 Will process 104 integrations
⚙️  Max concurrent: 2
⏱️  Delay between requests: 3000ms
💰 Estimated cost: ~$8.32 (DALL-E 3 HD)

⚠️  This will generate and upload approximately 104 images.
Press Ctrl+C to cancel, or wait 5 seconds to continue...

🎬 Starting generation process...

[1/104] Processing: Apollo.io (apollo-integration-beton)
...
[104/104] Processing: Salesforce (salesforce-integration)

📄 Results saved to: integration-images-log-2025-11-24T12-00-00-000Z.json

📢 Publishing 104 updated items...
✅ Published batch 1
✅ Published batch 2
✅ All items published

✨ FINAL SUMMARY
==========================================================
Total integrations: 104
✅ Successful: 104
❌ Failed: 0
==========================================================

🎉 All done! Images generated and uploaded successfully.
```

### Log File Structure

```json
{
  "timestamp": "2025-11-24T12:00:00.000Z",
  "total": 104,
  "successful": 104,
  "failed": 0,
  "results": [
    {
      "success": true,
      "integrationId": "69247f5a401236a9aa4f61eb",
      "toolName": "Apollo.io",
      "slug": "apollo-integration-beton",
      "assetId": "asset_id_here",
      "assetUrl": "https://uploads-ssl.webflow.com/..."
    }
  ]
}
```

---

## Verification

After the script completes:

### 1. Check Webflow Assets
- Go to: https://webflow.com/design/getbeton-ai
- Navigate to Assets panel
- Search for "ukiyo-e-og"
- Verify ~104 new images exist

### 2. Check CMS Collection
- Go to CMS → Integrations collection
- Open any integration item
- Scroll to "og-image" field
- Verify image is set

### 3. Check Live Site
- Visit: https://getbeton.ai/integrations/apollo-integration-beton
- Open in Facebook Debugger: https://developers.facebook.com/tools/debug/
- Verify OG image appears

### 4. Test Social Sharing
- Share an integration page link on Slack/Twitter/LinkedIn
- Verify the ukiyo-e image appears in the preview card

---

## Rollback (If Needed)

If you need to undo the changes:

1. **Manual rollback in Webflow:**
   - Go to CMS → Integrations
   - Bulk select all items
   - Clear the "og-image" field
   - Publish

2. **Delete uploaded assets:**
   - Go to Webflow Assets
   - Filter by "ukiyo-e-og"
   - Bulk delete

3. **Keep the log file** for reference of what was changed

---

## Cost Breakdown

### DALL-E 3 (Default)
- 104 images × $0.080 = **$8.32**
- High quality, reliable
- HD quality (1792x1024)

### API Requests
- Webflow API: Free (included in plan)
- No additional costs

### Total: ~$8-9 USD

---

## Troubleshooting

### "OPENAI_API_KEY not found"
```bash
# Verify .env exists
cat .env

# Make sure it's in scripts directory
pwd  # Should show: .../beton-ai/scripts
```

### "Rate limit exceeded"
```bash
# Edit generate-integration-images-dalle.js
# Increase DELAY_BETWEEN_REQUESTS to 5000 (5 seconds)
# Decrease MAX_CONCURRENT to 1
```

### "Upload failed"
```bash
# Verify Webflow token has correct permissions
# Check that site ID is correct: 68d4ef468dbbe960d0ed2e86
# Ensure you're not hitting Webflow's rate limits
```

### "Out of OpenAI credits"
```bash
# Add credits at: https://platform.openai.com/account/billing
# Minimum recommended: $10
# The script will resume from where it failed
```

### Script crashes mid-run
```bash
# Check the log file to see what completed
cat integration-images-log-*.json | jq '.successful'

# Modify the script to skip completed items
# Or manually process remaining items with test script
```

---

## Performance Optimization

### Faster Execution (Use at Own Risk)
Edit `generate-integration-images-dalle.js`:

```javascript
const MAX_CONCURRENT = 4; // Increase from 2
const DELAY_BETWEEN_REQUESTS = 2000; // Decrease from 3000
```

⚠️ **Warning**: May hit rate limits or cause API errors

### Safer Execution
```javascript
const MAX_CONCURRENT = 1; // Process one at a time
const DELAY_BETWEEN_REQUESTS = 5000; // Longer delays
```

---

## After Execution

### Update Project Documentation

1. Add note to main README.md about custom OG images
2. Document the artistic direction chosen
3. Archive the log files for reference

### Share with Team

- Share a few examples of generated images
- Document the prompt patterns used
- Share the log file for audit trail

### Monitor Performance

- Track social media CTR with new images
- Compare engagement before/after
- Use insights to refine future image generation

---

## Notes

- **One-time use**: Don't run repeatedly unless regenerating all images
- **Resumable**: Script can be safely interrupted and logs track progress
- **Async**: Multiple integrations process concurrently for speed
- **Safe**: Only publishes items that successfully completed all steps
- **Logged**: Every action is recorded for audit and debugging

---

**Questions or issues?** Check the log file first, then review the Troubleshooting section.

