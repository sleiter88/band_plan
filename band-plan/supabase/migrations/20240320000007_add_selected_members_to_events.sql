-- Add selected_members column to events table
ALTER TABLE public.events
ADD COLUMN selected_members UUID[] DEFAULT '{}';

-- Add foreign key constraint to ensure all selected members exist
ALTER TABLE public.events
ADD CONSTRAINT events_selected_members_fkey
FOREIGN KEY (selected_members)
REFERENCES public.band_members(id);