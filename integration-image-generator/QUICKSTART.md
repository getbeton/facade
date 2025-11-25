# Quick Start Guide

## Generate Ukiyo-e Images for All Integrations

### Step 1: Setup

```bash
cd scripts
npm install
```

### Step 2: Configure API Keys

Create a `.env` file in the scripts directory:

```bash
# Create .env file
touch .env
```

Add your API keys to `.env`:

```env
# Get from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx

# Get from: https://webflow.com/dashboard/account/integrations  
WEBFLOW_API_TOKEN=xxxxxxxxxxxxxxxxxxxxx
```

### Step 3: Test with One Integration

Before running the full batch, test with a single integration:

```bash
npm run test apollo-integration-beton
```

This will:
- Generate one image
- Save it locally as `test-output-apollo-integration-beton.png`
- Show you the image URL for preview
- NOT upload to Webflow or update the CMS

**Check the generated image!** Make sure you're happy with the ukiyo-e style.

### Step 4: Run Full Generation

Once you're satisfied with the test:

```bash
npm run generate-images
```

**This will:**
- Process all 104 integrations
- Generate unique ukiyo-e images for each
- Upload all images to Webflow
- Update all CMS items with OG images
- Publish the changes
- Take approximately 1-2 hours to complete
- Cost approximately $8-9 in OpenAI credits

**Safety Features:**
- 5-second countdown before starting (Ctrl+C to cancel)
- Continues on individual failures
- Saves detailed log file with results
- Only publishes successful updates

### Step 5: Review Results

Check the generated log file:

```bash
cat integration-images-log-*.json | less
```

### Troubleshooting

**"OPENAI_API_KEY not found"**
```bash
# Make sure .env file exists in scripts directory
ls -la .env

# Check the file content (be careful not to expose it)
head .env
```

**"Rate limit exceeded"**
- OpenAI DALL-E has rate limits
- The script already includes delays
- If errors persist, increase `DELAY_BETWEEN_REQUESTS` in the script

**Test output looks wrong**
- Adjust the prompts in `createUkiyoePrompt()` function
- Try different integration slugs to see variety
- Modify theme keywords for better results

### What's Next?

After running, your integration pages will have:
- ✅ Custom ukiyo-e style OG images
- ✅ Unique visual identity for each integration
- ✅ Better social media preview cards
- ✅ Professional Japanese art aesthetic

---

**⚠️ Important Notes:**

1. This is a **one-time script** - don't run it multiple times unless you want to regenerate all images
2. Each run costs money (OpenAI API charges)
3. The script can be safely interrupted (Ctrl+C) and resumed
4. Failed integrations can be processed manually using the test script

