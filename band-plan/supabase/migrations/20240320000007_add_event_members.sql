-- Create event_members table
CREATE TABLE IF NOT EXISTS public.event_members (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES public.events(id) ON DELETE CASCADE,
  band_member_id UUID REFERENCES public.band_members(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  UNIQUE(event_id, band_member_id)
);

-- Enable RLS
ALTER TABLE public.event_members ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can view event members for their bands"
  ON public.event_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.band_members bm
      JOIN public.events e ON e.band_id = bm.band_id
      WHERE e.id = event_members.event_id
      AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Principal members and admins can manage event members"
  ON public.event_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.band_members bm ON bm.user_id = u.id
      JOIN public.events e ON e.band_id = bm.band_id
      WHERE e.id = event_members.event_id
      AND u.id = auth.uid()
      AND (
        u.role = 'admin'
        OR bm.role_in_band = 'principal'
      )
    )
  );