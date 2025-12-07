-- Migration: Add Billing Tracking & Generation Logs
-- This migration adds free tier tracking to profiles and creates generation_logs table
-- for detailed tracking of each generation attempt

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. Add free_generations_used to profiles table
-- ============================================================
-- Tracks how many free generations the user has consumed (max 5 for free tier)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS free_generations_used INTEGER DEFAULT 0;

-- ============================================================
-- 2. Create generation_logs table
-- ============================================================
-- Tracks each individual generation attempt with collection/item attribution
CREATE TABLE IF NOT EXISTS public.generation_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- User reference
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    
    -- Collection references (both our DB UUID and Webflow ID)
    collection_id UUID REFERENCES public.collections(id) ON DELETE SET NULL,
    webflow_collection_id TEXT NOT NULL,
    
    -- Item reference (Webflow CMS item)
    webflow_item_id TEXT NOT NULL,
    item_name TEXT, -- Human-readable name for easy reference in logs
    
    -- Payment reference (NULL if free tier or own API key)
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    
    -- Generation status tracking
    status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    
    -- Billing tracking flags
    is_free_tier BOOLEAN DEFAULT FALSE,      -- True if this used a free tier slot
    uses_own_api_key BOOLEAN DEFAULT FALSE,  -- True if user provided their own OpenAI key
    
    -- Error tracking
    error_message TEXT,
    
    -- Cost tracking (in cents, 0 if free)
    cost_cents INTEGER DEFAULT 0,
    
    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 3. Update payments table - Add generation_logs_count column
-- ============================================================
-- Tracks how many generation_logs are linked to this payment
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS generation_logs_count INTEGER DEFAULT 0;

-- Add item_ids column to store the Webflow item IDs for this payment
-- Stored as JSONB array for efficient querying
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS item_ids JSONB;

-- Add column to track if payment has been used for generation
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS generation_started BOOLEAN DEFAULT FALSE;

-- ============================================================
-- 4. Create indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_generation_logs_user_id 
    ON public.generation_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_generation_logs_collection_id 
    ON public.generation_logs(collection_id);

CREATE INDEX IF NOT EXISTS idx_generation_logs_payment_id 
    ON public.generation_logs(payment_id);

CREATE INDEX IF NOT EXISTS idx_generation_logs_created_at 
    ON public.generation_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generation_logs_status 
    ON public.generation_logs(status);

-- Composite index for querying user's recent generations
CREATE INDEX IF NOT EXISTS idx_generation_logs_user_status 
    ON public.generation_logs(user_id, status, created_at DESC);

-- ============================================================
-- 5. Enable RLS and create policies for generation_logs
-- ============================================================
ALTER TABLE public.generation_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own generation logs
CREATE POLICY "Users can view own generation logs" 
    ON public.generation_logs
    FOR SELECT 
    USING (auth.uid() = user_id);

-- Users cannot directly insert/update/delete generation_logs
-- Only service role (backend) can manage generation_logs
-- This is enforced by not having INSERT/UPDATE/DELETE policies for users

-- ============================================================
-- 6. Add helpful comments to tables
-- ============================================================
COMMENT ON TABLE public.generation_logs IS 
    'Tracks individual image generation attempts with billing and status information';

COMMENT ON COLUMN public.generation_logs.is_free_tier IS 
    'True if this generation used one of the user''s 5 free tier slots';

COMMENT ON COLUMN public.generation_logs.uses_own_api_key IS 
    'True if the user provided their own OpenAI API key (not billed)';

COMMENT ON COLUMN public.generation_logs.cost_cents IS 
    'Cost charged for this generation in cents (0 if free tier or own API key)';

COMMENT ON COLUMN public.profiles.free_generations_used IS 
    'Number of free tier generations used (max 5 before payment required)';

COMMENT ON COLUMN public.payments.generation_logs_count IS 
    'Count of generation_logs entries linked to this payment';

COMMENT ON COLUMN public.payments.item_ids IS 
    'JSONB array of Webflow item IDs included in this payment';

COMMENT ON COLUMN public.payments.generation_started IS 
    'True once image generation has been triggered for this payment';


