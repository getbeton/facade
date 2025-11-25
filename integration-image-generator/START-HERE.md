# 🎌 START HERE: Generate Ukiyo-e OG Images

## Quick Instructions (5 Minutes to Start)

### 1️⃣ Go to Scripts Folder
```bash
cd scripts
```

### 2️⃣ Create API Keys File
```bash
touch .env
```

Edit the `.env` file and add:
```env
OPENAI_API_KEY=sk-proj-xxxxx_your_key_here
WEBFLOW_API_TOKEN=xxxxx_your_token_here
```

**Get your keys:**
- OpenAI: https://platform.openai.com/api-keys
- Webflow: https://webflow.com/dashboard/account/integrations

### 3️⃣ See What Will Be Processed
```bash
npm run list
```

This shows all 104 integrations and their current OG image status.

### 4️⃣ Test with ONE Integration
```bash
npm run test:apollo
```

This generates one test image saved as `test-output-apollo-integration-beton.png`.  
Open it to see if you like the ukiyo-e style!

### 5️⃣ Generate ALL Images
```bash
npm run generate
```

**This will:**
- ⏱️ Take 1-2 hours
- 💰 Cost ~$8 in OpenAI credits
- 🎨 Generate 104 unique images
- 📤 Upload to Webflow
- 📢 Publish all changes
- 📝 Create a detailed log file

---

## That's It!

For detailed instructions, see:
- **`QUICKSTART.md`** - Detailed setup guide
- **`EXECUTION-GUIDE.md`** - Complete execution manual
- **`README.md`** - Technical reference
- **`SUMMARY.md`** - Architecture and design details

---

## One-Line Commands Reference

```bash
npm run list          # List all integrations
npm run test          # Test single integration
npm run test:apollo   # Test Apollo integration specifically
npm run generate      # Generate ALL images (main command)
```

---

## Expected Result

After running, each integration page will have:
- ✨ Custom ukiyo-e style OG image
- 🎨 Unique visual themed to the tool's function
- 🔗 Properly configured Open Graph tags
- 📱 Beautiful social media preview cards

Example themes:
- **Apollo.io** → Fishing boats (prospecting theme)
- **PostHog** → Ocean waves (analytics theme)
- **Typeform** → Calligraphy scrolls (forms theme)
- **Calendly** → Moon phases (scheduling theme)

---

**Total Time Investment**: ~5 min setup + 1-2 hours automated execution  
**Total Cost**: ~$8-9 USD in API credits  
**Total Benefit**: 104 unique, beautiful, professional OG images for social sharing

🎉 **Ready to start? Follow steps 1-5 above!**

