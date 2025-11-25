-- Sites table
CREATE TABLE public.sites (
  id TEXT PRIMARY KEY, -- Webflow Site ID
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  preview_url TEXT,
  favicon_url TEXT,
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Collections table (replacing user_api_keys concept with per-collection keys)
CREATE TABLE public.collections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  site_id TEXT REFERENCES public.sites(id) ON DELETE CASCADE NOT NULL,
  webflow_collection_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  webflow_api_key TEXT NOT NULL, -- Encrypted
  openai_api_key TEXT NOT NULL,  -- Encrypted
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own sites" ON public.sites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sites" ON public.sites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sites" ON public.sites
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sites" ON public.sites
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own collections" ON public.collections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own collections" ON public.collections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own collections" ON public.collections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own collections" ON public.collections
  FOR DELETE USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_sites_user_id ON public.sites(user_id);
CREATE INDEX idx_collections_user_id ON public.collections(user_id);
CREATE INDEX idx_collections_site_id ON public.collections(site_id);



