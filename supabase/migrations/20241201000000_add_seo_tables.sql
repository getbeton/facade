-- Create seo_generations table
create table if not exists public.seo_generations (
    id uuid default gen_random_uuid() primary key,
    collection_id uuid references public.collections(id) on delete cascade,
    webflow_item_id text not null,
    field_name text not null,
    prompt_used text,
    status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
    error_code integer,
    cost_tokens integer,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create seo_suggestions table
create table if not exists public.seo_suggestions (
    id uuid default gen_random_uuid() primary key,
    generation_id uuid references public.seo_generations(id) on delete cascade,
    original_value text,
    suggested_value text,
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    review_notes text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.seo_generations enable row level security;
alter table public.seo_suggestions enable row level security;

-- Add policies (assuming authenticated users can view their own data, but for now allowing all authenticated for simplicity in this step, or linking to user_id via collections if possible. 
-- The collections table usually has a user_id or site_id linked to user. Let's check collections schema to be sure about RLS policies.)
-- For now, I will add basic policies that allow access for authenticated users, assuming the application logic handles ownership checks or Supabase RLS policies are refined later. 
-- Better: Check collections schema first to see how to link back to user.

-- Policy for seo_generations
create policy "Users can view their own seo generations via collections"
    on public.seo_generations for select
    using (
        exists (
            select 1 from public.collections c
            where c.id = seo_generations.collection_id
            and c.user_id = auth.uid()
        )
    );

create policy "Users can insert their own seo generations via collections"
    on public.seo_generations for insert
    with check (
        exists (
            select 1 from public.collections c
            where c.id = seo_generations.collection_id
            and c.user_id = auth.uid()
        )
    );

create policy "Users can update their own seo generations via collections"
    on public.seo_generations for update
    using (
        exists (
            select 1 from public.collections c
            where c.id = seo_generations.collection_id
            and c.user_id = auth.uid()
        )
    );

-- Policy for seo_suggestions
create policy "Users can view their own seo suggestions via generations"
    on public.seo_suggestions for select
    using (
        exists (
            select 1 from public.seo_generations g
            join public.collections c on g.collection_id = c.id
            where g.id = seo_suggestions.generation_id
            and c.user_id = auth.uid()
        )
    );

create policy "Users can update their own seo suggestions via generations"
    on public.seo_suggestions for update
    using (
        exists (
            select 1 from public.seo_generations g
            join public.collections c on g.collection_id = c.id
            where g.id = seo_suggestions.generation_id
            and c.user_id = auth.uid()
        )
    );

