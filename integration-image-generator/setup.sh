#!/bin/bash

# Setup script for integration image generator
# This is a one-time setup helper

set -e

echo "🚀 Setting up Integration Image Generator"
echo "=========================================="
echo ""

# Check if we're in the scripts directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: Please run this script from the scripts directory"
  echo "   cd scripts && bash setup.sh"
  exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Create .env file if it doesn't exist
if [ -f ".env" ]; then
  echo "⚠️  .env file already exists, skipping creation"
  echo "   If you need to recreate it, delete .env first"
else
  echo "📝 Creating .env file..."
  cat > .env << 'EOF'
# OpenAI API Key for DALL-E 3 image generation
# Get it from: https://platform.openai.com/api-keys
OPENAI_API_KEY=

# Webflow API Token
# Get it from: https://webflow.com/dashboard/account/integrations
WEBFLOW_API_TOKEN=
EOF
  echo "✅ Created .env file"
  echo ""
  echo "⚠️  IMPORTANT: Edit .env and add your API keys:"
  echo "   - OPENAI_API_KEY from https://platform.openai.com/api-keys"
  echo "   - WEBFLOW_API_TOKEN from https://webflow.com/dashboard/account/integrations"
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env and add your API keys"
echo "2. Test with: npm run test:apollo"
echo "3. Run full generation: npm run generate"
echo ""
echo "For detailed instructions, see QUICKSTART.md"
echo ""

