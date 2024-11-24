-- Drop existing policy if exists
DROP POLICY IF EXISTS "Enable member removal for admins and principals" ON public.group_members;

-- Add delete policy for group members
CREATE POLICY "Enable member removal for admins and principals" ON public.group_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        -- Admin can remove any member
        u.role = 'admin'
        OR
        -- Principal members can remove other members from their group
        EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = group_members.group_id
          AND gm.user_id = auth.uid()
          AND gm.role_in_group = 'principal'
        )
      )
    )
  );