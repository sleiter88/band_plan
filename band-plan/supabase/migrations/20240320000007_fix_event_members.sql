

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view event members for their groups" ON public.event_members;
DROP POLICY IF EXISTS "Principal members and admins can manage event members" ON public.event_members;

-- Recreate event_members table with proper relationships
CREATE TABLE IF NOT EXISTS public.event_members (
  id SERIAL PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  group_member_id UUID NOT NULL REFERENCES public.group_members(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  UNIQUE(event_id, group_member_id)
);

-- Enable RLS
ALTER TABLE public.event_members ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can view event members for their groups"
  ON public.event_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      JOIN public.events e ON e.group_id = gm.group_id
      WHERE e.id = event_members.event_id
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Principal members and admins can manage event members"
  ON public.event_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.group_members gm ON gm.user_id = u.id
      JOIN public.events e ON e.group_id = gm.group_id
      WHERE e.id = event_members.event_id
      AND u.id = auth.uid()
      AND (
        u.role = 'admin'
        OR gm.role_in_group = 'principal'
      )
    )
  );