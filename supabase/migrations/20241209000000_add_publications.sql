-- Migration: Add publication logging tables
-- Tracks publish runs and per-item outcomes with foreign keys

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1) Publications table (one row per publish action)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.publications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    collection_id UUID REFERENCES public.collections(id) ON DELETE SET NULL,
    site_id TEXT REFERENCES public.sites(id) ON DELETE SET NULL,
    webflow_collection_id TEXT NOT NULL,
    total_items INTEGER NOT NULL DEFAULT 0,
    total_fields INTEGER NOT NULL DEFAULT 0,
    items_succeeded INTEGER NOT NULL DEFAULT 0,
    items_failed INTEGER NOT NULL DEFAULT 0,
    fields_succeeded INTEGER NOT NULL DEFAULT 0,
    fields_failed INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'partial', 'failed')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 2) Publication items table (per CMS item in a publish run)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.publication_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    publication_id UUID REFERENCES public.publications(id) ON DELETE CASCADE NOT NULL,
    collection_id UUID REFERENCES public.collections(id) ON DELETE SET NULL,
    webflow_item_id TEXT NOT NULL,
    slug TEXT,
    published_url TEXT,
    fields_total INTEGER NOT NULL DEFAULT 0,
    fields_succeeded INTEGER NOT NULL DEFAULT 0,
    fields_failed INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'succeeded', 'failed', 'skipped')),
    error_message TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 3) Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_publications_user_id ON public.publications(user_id);
CREATE INDEX IF NOT EXISTS idx_publications_collection_id ON public.publications(collection_id);
CREATE INDEX IF NOT EXISTS idx_publication_items_publication_id ON public.publication_items(publication_id);
CREATE INDEX IF NOT EXISTS idx_publication_items_collection_id ON public.publication_items(collection_id);

-- ============================================================
-- 4) RLS + Policies
-- ============================================================
ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publication_items ENABLE ROW LEVEL SECURITY;

-- Publications policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'publications' AND policyname = 'Users can view own publications') THEN
    CREATE POLICY "Users can view own publications"
      ON public.publications
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'publications' AND policyname = 'Users can insert own publications') THEN
    CREATE POLICY "Users can insert own publications"
      ON public.publications
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'publications' AND policyname = 'Users can update own publications') THEN
    CREATE POLICY "Users can update own publications"
      ON public.publications
      FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Publication items policies (scoped via publication ownership)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'publication_items' AND policyname = 'Users can view own publication items') THEN
    CREATE POLICY "Users can view own publication items"
      ON public.publication_items
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.publications p
          WHERE p.id = publication_items.publication_id
          AND p.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'publication_items' AND policyname = 'Users can insert own publication items') THEN
    CREATE POLICY "Users can insert own publication items"
      ON public.publication_items
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.publications p
          WHERE p.id = publication_items.publication_id
          AND p.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'publication_items' AND policyname = 'Users can update own publication items') THEN
    CREATE POLICY "Users can update own publication items"
      ON public.publication_items
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.publications p
          WHERE p.id = publication_items.publication_id
          AND p.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ============================================================
-- 5) Comments
-- ============================================================
COMMENT ON TABLE public.publications IS 'Tracks each publish action initiated by a user';
COMMENT ON TABLE public.publication_items IS 'Tracks per-item publish results for a publication run';
COMMENT ON COLUMN public.publications.status IS 'processing | completed | partial | failed';
COMMENT ON COLUMN public.publication_items.status IS 'processing | succeeded | failed | skipped';



