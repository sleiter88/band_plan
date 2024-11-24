-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view events for their groups" ON public.events;
DROP POLICY IF EXISTS "Principal members and admins can manage events" ON public.events;
DROP POLICY IF EXISTS "Principal members and admins can update events" ON public.events;
DROP POLICY IF EXISTS "Principal members and admins can delete events" ON public.events;

-- Create events table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id),
  name VARCHAR NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Add updated_at trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Policies
CREATE POLICY "Users can view events for their groups"
  ON public.events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = events.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Principal members and admins can manage events"
  ON public.events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        -- Admin can manage any group's events
        u.role = 'admin'
        OR
        -- Principal members can manage their group's events
        EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = events.group_id
          AND gm.user_id = auth.uid()
          AND gm.role_in_group = 'principal'
        )
      )
    )
  );

CREATE POLICY "Principal members and admins can update events"
  ON public.events FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        -- Admin can manage any group's events
        u.role = 'admin'
        OR
        -- Principal members can manage their group's events
        EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = events.group_id
          AND gm.user_id = auth.uid()
          AND gm.role_in_group = 'principal'
        )
      )
    )
  );

CREATE POLICY "Principal members and admins can delete events"
  ON public.events FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        -- Admin can manage any group's events
        u.role = 'admin'
        OR
        -- Principal members can manage their group's events
        EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = events.group_id
          AND gm.user_id = auth.uid()
          AND gm.role_in_group = 'principal'
        )
      )
    )
  );