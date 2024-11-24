-- Drop existing constraint if exists
ALTER TABLE IF EXISTS public.events 
DROP CONSTRAINT IF EXISTS events_selected_members_fkey;

-- Add selected_members column to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS selected_members UUID[] DEFAULT '{}';

-- Add foreign key constraint to ensure all selected members exist
ALTER TABLE public.events
ADD CONSTRAINT events_selected_members_fkey
FOREIGN KEY (selected_members)
REFERENCES public.group_members(id);