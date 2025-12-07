# Webflow CMS Image Generator

A powerful Next.js application for generating and managing AI images for Webflow CMS collections. This tool integrates with OpenAI (DALL-E) and Webflow to automate the process of creating and updating OG images and other assets for your CMS items.

## 🔗 Related Projects & Resources

Check out our other tools and resources:
- [**Beton App**](https://getbeton.ai/app) - The main application.
- [**Beton Facade**](https://getbeton.ai/facade) - Manage your AI facades.
- [**Beton Blog**](https://getbeton.ai/blog) - Tips, tricks, and updates.

## ✨ Features

- **Webflow Integration**: Seamlessly connect to your Webflow sites and collections.
- **AI Image Generation**: Generate images using OpenAI's DALL-E 3 based on your CMS content.
- **Automated Updates**: Automatically upload generated images to Webflow and update CMS items.
- **Billing System**: Integrated Stripe billing for pay-as-you-go usage.
- **SEO Tools**: Built-in SEO auditing and improvement suggestions (using Ahrefs data).

## 🧠 Generation & publishing flow

- All text edits and AI generations are **staged locally**; nothing is pushed to Webflow until you press **Publish**.
- **Generate Selected** counts only the **visible columns** in the grid. If 9 rows are selected and 5 columns are visible, only 45 fields are generated.
- **Free limit** = `5 * (visible columns)` fields. Usage is tracked per field; inline single-field generation consumes 1 free field if applicable.
- **Inline actions**: click/drag-drop on image cells to stage uploads; use the wand button to generate a single field immediately (still staged).
- **SEO/meta ready**: all CMS fields, including SEO/open graph fields returned by Webflow, are surfaced for editing and generation.
- Generations run **field-by-field** with full row context and field names to keep prompts accurate and avoid failing entire batches.

## 🛠 Prerequisites

- Node.js 18+
- Supabase Account
- Webflow Account (and API Token)
- OpenAI API Key
- Stripe Account

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/getbeton/facade
cd webflow-cms-image-generator
npm install
```

### 2. Environment Setup

Copy the example environment file:

```bash
cp env.example .env.local
```

Fill in your credentials in `.env.local`:
- **Supabase**: URL and Anon Key.
- **Stripe**: Secret Key, Webhook Secret, Publishable Key.
- **App URL**: `http://localhost:3000` for development.

### 3. Database Setup (Supabase)

This project uses Supabase for the backend. You need to apply the database migrations to set up the schema.

1. Install Supabase CLI (if not installed).
2. Login to Supabase: `supabase login`
3. Link your project: `supabase link --project-ref your-project-ref`
4. Apply migrations:

```bash
supabase db push
```

## 🗄️ Database Schema

This project uses Supabase (PostgreSQL). The schema is managed via migrations in `supabase/migrations`.

### Tables

- **`integrations`**
  - Stores user API keys (Webflow, OpenAI) encrypted.
  - Linked to `profiles`.

- **`sites`**
  - Stores connected Webflow sites.
  - Linked to `integrations`.

- **`collections`**
  - Stores Webflow collections synced from sites.
  - Linked to `sites`.

- **`profiles`**
  - Extends Supabase Auth users.
  - Tracks free tier usage and Stripe customer ID.

- **`payments`**
  - Stores Stripe payment records for pay-as-you-go.

- **`generation_logs`**
  - Tracks every image generation attempt, cost, and status.

- **`seo_generations`**
  - Tracks SEO metadata generation requests.

- **`seo_suggestions`**
  - Stores generated SEO suggestions (title/description) for review.

### 4. Google OAuth Setup

To enable Google Login:
1. Go to the [Google Cloud Console](https://console.cloud.google.com).
2. Create a new OAuth 2.0 Client ID.
3. Add `https://<your-project>.supabase.co/auth/v1/callback` to **Authorized redirect URIs**.
4. Add your Google Client ID and Secret to your Supabase Auth settings.
5. In Supabase > Authentication > URL Configuration, add `http://localhost:3000/**` to **Redirect URLs**.

### 5. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## 🤝 Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
