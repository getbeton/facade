-- Add site domain metadata so we can build item URLs
ALTER TABLE public.sites
ADD COLUMN IF NOT EXISTS primary_domain TEXT,
ADD COLUMN IF NOT EXISTS webflow_domain TEXT,
ADD COLUMN IF NOT EXISTS custom_domains JSONB;

-- Add collection URL metadata for item links
ALTER TABLE public.collections
ADD COLUMN IF NOT EXISTS collection_slug TEXT,
ADD COLUMN IF NOT EXISTS url_base TEXT;

-- Index to quickly look up collections by Webflow ID
CREATE INDEX IF NOT EXISTS idx_collections_webflow_id ON public.collections(webflow_collection_id);



