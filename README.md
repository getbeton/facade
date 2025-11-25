# One-Time Scripts

This directory contains one-time utility scripts for Beton AI. These scripts are meant for local development and maintenance tasks only.

## Integration Images Generator

### Purpose
Generates custom ukiyo-e (Japanese woodblock print) style images for all integration pages and uploads them to Webflow as OG (Open Graph) images.

### Available Versions

1. **DALL-E 3** (Recommended) - `generate-integration-images-dalle.js`
   - Uses OpenAI's DALL-E 3 for reliable, high-quality image generation
   - HD quality images in 1792x1024 resolution
   - More expensive (~$0.08 per image) but more reliable

2. **Gemini Imagen** - `generate-integration-images.js`
   - Uses Google's Gemini Imagen 3 API
   - More affordable but may have regional availability issues
   - Experimental implementation

### Prerequisites

**For DALL-E Version (Recommended):**
1. **OpenAI API Key** - Get from [OpenAI Platform](https://platform.openai.com/api-keys)
2. **Webflow API Token** - Get from [Webflow Account Integrations](https://webflow.com/dashboard/account/integrations)

**For Gemini Version:**
1. **Gemini API Key** - Get from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. **Webflow API Token** - Get from [Webflow Account Integrations](https://webflow.com/dashboard/account/integrations)

### Setup

```bash
cd scripts
npm install

# Create .env file
cat > .env << EOF
OPENAI_API_KEY=your_openai_key_here
WEBFLOW_API_TOKEN=your_webflow_token_here
EOF
```

### Usage

```bash
# Using DALL-E 3 (Recommended)
npm run generate-images

# Or using Gemini
npm run generate-images-gemini

# Or directly
node generate-integration-images-dalle.js
node generate-integration-images.js
```

### What It Does

1. **Fetches** all integration items from Webflow CMS (104 items)
2. **Analyzes** each integration's content (tool name, hero text, problems, use cases)
3. **Generates** a unique ukiyo-e style prompt based on the integration's theme:
   - Email/Messaging tools → Flying birds and paper cranes
   - Analytics tools → Waves and data ripples
   - Customer Success → Cherry blossoms and growth
   - Sales/Prospecting → Fishing boats and nets
   - Phone systems → Temple bells and sound waves
   - Forms/Surveys → Scrolls and calligraphy
   - Visitor tracking → Footprints and pathways
   - Email verification → Stamps and seals
   - CRM systems → Traditional storage chests
   - Scheduling → Moon phases and time
   - Marketing → Fireworks and festivals
4. **Creates** an image using DALL-E 3 or Gemini Imagen API
5. **Uploads** the image to Webflow as a site asset
6. **Updates** the CMS item with the new OG image reference
7. **Publishes** the updated items to make them live

### Features

- ✅ **Fully Async** - Processes multiple integrations concurrently
- ✅ **Rate Limited** - Respects API rate limits with delays
- ✅ **Error Handling** - Continues on failure, logs all errors
- ✅ **Progress Tracking** - Real-time console output
- ✅ **Result Logging** - Saves detailed JSON log with timestamp
- ✅ **Batch Processing** - Handles large collections efficiently
- ✅ **Smart Theming** - Creates unique prompts based on integration type

### Configuration

Edit the script to adjust:

- `MAX_CONCURRENT` - Number of concurrent operations (default: 3)
- `DELAY_BETWEEN_REQUESTS` - Milliseconds between API calls (default: 2000)
- Theme keywords in `createUkiyoePrompt()` function

### Output

The script creates a log file: `integration-images-log-YYYY-MM-DDTHH-MM-SS.json`

Example log structure:
```json
{
  "timestamp": "2025-11-24T12:00:00.000Z",
  "total": 104,
  "successful": 102,
  "failed": 2,
  "results": [...]
}
```

### Image Specifications

- **Style**: Ukiyo-e (Japanese woodblock print) aesthetic
- **Aspect Ratio**: 16:9 (landscape, suitable for OG images)
- **Size**: 1024px (Gemini output, scaled for OG use)
- **Colors**: Traditional ukiyo-e palette (indigo, orange, green, cream)
- **Content**: Abstract representation of each integration's function
- **No Text**: Images are purely visual, no text overlays

### Cost Estimation

**DALL-E 3 Version:**
- ~$0.08 per HD image (1792x1024)
- **Total for 104 images**: ~$8.32
- Generally more reliable and better quality

**Gemini Imagen Version:**
- ~$0.04 per image (estimated, check current pricing)
- **Total for 104 images**: ~$4.16
- May have availability issues in some regions

**Webflow**: No additional costs for asset uploads (included in plan)

### Troubleshooting

**"Invalid API key"**
- Verify your Gemini API key is correct
- Ensure you've enabled the Imagen API in Google Cloud Console

**"Upload failed"**
- Check Webflow API token permissions
- Verify site ID is correct
- Ensure you have asset upload permissions

**"Rate limit exceeded"**
- Increase `DELAY_BETWEEN_REQUESTS` value
- Decrease `MAX_CONCURRENT` value

### Safety

- This script is **one-time use** only
- It will **overwrite existing OG images** without backup
- **Test on a subset first** by modifying the integrations array
- All operations are logged for audit purposes

---

**Note**: This script is for local development only and should not be committed to version control with API keys.

