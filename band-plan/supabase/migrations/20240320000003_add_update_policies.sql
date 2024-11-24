-- Remove all existing policies for group_members
DROP POLICY IF EXISTS "Enable member updates for admins and self" ON public.group_members;
DROP POLICY IF EXISTS "Enable member inserts for admins" ON public.group_members;
DROP POLICY IF EXISTS "Enable member deletes for admins" ON public.group_members;
DROP POLICY IF EXISTS "Enable member selects for admins and self" ON public.group_members;

-- Remove all existing policies for group_member_instruments
DROP POLICY IF EXISTS "Enable instrument updates for admins and self" ON public.group_member_instruments;
DROP POLICY IF EXISTS "Enable instrument inserts for admins and self" ON public.group_member_instruments;
DROP POLICY IF EXISTS "Enable instrument deletes for admins and self" ON public.group_member_instruments;
DROP POLICY IF EXISTS "Enable instrument selects for admins and self" ON public.group_member_instruments;

-- Add update policies for group members
CREATE POLICY "Enable member updates for admins and self" ON public.group_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        -- Admin can update any member
        u.role = 'admin'
        OR
        -- Users can update their own data
        group_members.user_id = auth.uid()
      )
    )
  );

-- Add update policies for group member instruments
CREATE POLICY "Enable instrument updates for admins and self" ON public.group_member_instruments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        -- Admin can update any member's instruments
        u.role = 'admin'
        OR
        -- Users can update their own instruments
        EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.id = group_member_instruments.group_member_id
          AND gm.user_id = auth.uid()
        )
      )
    )
  );