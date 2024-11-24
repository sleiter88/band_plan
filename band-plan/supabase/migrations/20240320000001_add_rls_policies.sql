-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for groups" ON public.groups;
DROP POLICY IF EXISTS "Enable insert for admin users only on groups" ON public.groups;

DROP POLICY IF EXISTS "Enable read access for group members" ON public.group_members;
DROP POLICY IF EXISTS "Enable member management" ON public.group_members;

DROP POLICY IF EXISTS "Enable read access for instruments" ON public.instruments;
DROP POLICY IF EXISTS "Enable instrument management" ON public.instruments;

DROP POLICY IF EXISTS "Enable read access for group member instruments" ON public.group_member_instruments;
DROP POLICY IF EXISTS "Enable instrument assignment" ON public.group_member_instruments;

-- Enable RLS on all tables
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_member_instruments ENABLE ROW LEVEL SECURITY;

-- Groups policies
CREATE POLICY "Enable read access for groups" ON public.groups
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for admin users only on groups" ON public.groups
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Group members policies
CREATE POLICY "Enable read access for group members" ON public.group_members
  FOR SELECT USING (true);

CREATE POLICY "Enable member management" ON public.group_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        -- Admin can add anyone
        u.role = 'admin'
        OR
        -- Principal members can add new members
        EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = group_members.group_id
          AND gm.user_id = auth.uid()
          AND gm.role_in_group = 'principal'
        )
        OR
        -- Users can add themselves if they're not already members
        (
          group_members.user_id = auth.uid()
          AND NOT EXISTS (
            SELECT 1 FROM public.group_members existing
            WHERE existing.group_id = group_members.group_id
            AND existing.user_id = auth.uid()
          )
        )
      )
    )
  );

-- Instruments policies
CREATE POLICY "Enable read access for instruments" ON public.instruments
  FOR SELECT USING (true);

CREATE POLICY "Enable instrument management" ON public.instruments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        -- Admin can add instruments
        u.role = 'admin'
        OR
        -- Principal members can add instruments
        EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.user_id = auth.uid()
          AND gm.role_in_group = 'principal'
        )
        OR
        -- First member of a group can add instruments
        EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.user_id = auth.uid()
          AND NOT EXISTS (
            SELECT 1 FROM public.group_members prev
            WHERE prev.group_id = gm.group_id
            AND prev.created_at < gm.created_at
          )
        )
      )
    )
  );

-- Group member instruments policies
CREATE POLICY "Enable read access for group member instruments" ON public.group_member_instruments
  FOR SELECT USING (true);

CREATE POLICY "Enable instrument assignment" ON public.group_member_instruments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        -- Admin can assign instruments
        u.role = 'admin'
        OR
        -- Principal members can assign instruments
        EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.user_id = auth.uid()
          AND gm.role_in_group = 'principal'
        )
        OR
        -- Users can assign instruments to themselves when joining
        EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.id = group_member_instruments.group_member_id
          AND gm.user_id = auth.uid()
          AND gm.created_by = auth.uid()
        )
      )
    )
  );