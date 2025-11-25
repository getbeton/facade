# Integration Image Generator

This directory contains the scripts and tools used to generate custom ukiyo-e style OG images for all integration pages using AI (DALL-E 3) and upload them to Webflow.

## Contents

- **Core Scripts**:
  - `generate-integration-images-dalle.js`: Main script using DALL-E 3
  - `test-single-integration.js`: Tool to test generation for a single item
  - `list-integrations.js`: Utility to list all integrations and their image status

- **Documentation**:
  - `START-HERE.md`: Quick start guide
  - `EXECUTION-GUIDE.md`: Detailed execution manual
  - `SUMMARY.md`: Architecture overview and results summary

- **Logs & Output**:
  - `integration-images-log-*.json`: Execution logs from runs
  - `test-output-*.png`: Generated test images

## Usage

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure API keys in `.env`:
   ```env
   OPENAI_API_KEY=...
   WEBFLOW_API_TOKEN=...
   ```

3. Run the generator:
   ```bash
   npm run generate
   ```

For more details, see `START-HERE.md`.

