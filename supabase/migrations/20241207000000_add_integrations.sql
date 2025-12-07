-- Create integrations table
CREATE TABLE IF NOT EXISTS public.integrations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL DEFAULT 'webflow',
  encrypted_webflow_key TEXT NOT NULL,
  encrypted_openai_key TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for integrations
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'integrations' AND policyname = 'Users can view own integrations') THEN
    CREATE POLICY "Users can view own integrations" ON public.integrations
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'integrations' AND policyname = 'Users can insert own integrations') THEN
    CREATE POLICY "Users can insert own integrations" ON public.integrations
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'integrations' AND policyname = 'Users can update own integrations') THEN
    CREATE POLICY "Users can update own integrations" ON public.integrations
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'integrations' AND policyname = 'Users can delete own integrations') THEN
    CREATE POLICY "Users can delete own integrations" ON public.integrations
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Add integration_id to sites
ALTER TABLE public.sites 
ADD COLUMN IF NOT EXISTS integration_id UUID REFERENCES public.integrations(id) ON DELETE CASCADE;

-- Create index for integration lookup
CREATE INDEX IF NOT EXISTS idx_sites_integration_id ON public.sites(integration_id);
CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON public.integrations(user_id);

-- Remove keys from collections as they are now managed at integration level
ALTER TABLE public.collections 
DROP COLUMN IF EXISTS webflow_api_key,
DROP COLUMN IF EXISTS openai_api_key;
