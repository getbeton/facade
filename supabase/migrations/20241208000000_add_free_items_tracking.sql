-- Add free_items_used to collections table
ALTER TABLE public.collections 
ADD COLUMN IF NOT EXISTS free_items_used INTEGER DEFAULT 0;

-- Ensure the column defaults to 0 for existing rows
UPDATE public.collections SET free_items_used = 0 WHERE free_items_used IS NULL;


