-- Primero eliminamos las políticas existentes
DROP POLICY IF EXISTS "Enable read access for group members" ON public.group_members;
DROP POLICY IF EXISTS "Enable member management" ON public.group_members;
DROP POLICY IF EXISTS "Enable member updates" ON public.group_members;
DROP POLICY IF EXISTS "Enable member deletion" ON public.group_members;

-- Recreamos las políticas usando group_id
CREATE POLICY "Enable read access for group members"
  ON public.group_members FOR SELECT
  USING (true);

CREATE POLICY "Enable member management"
  ON public.group_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        u.role = 'admin'
        OR EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = group_members.group_id
          AND gm.user_id = auth.uid()
          AND gm.role_in_group = 'principal'
        )
      )
    )
  );

CREATE POLICY "Enable member updates"
  ON public.group_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        u.role = 'admin'
        OR auth.uid() = user_id
        OR EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = group_members.group_id
          AND gm.user_id = auth.uid()
          AND gm.role_in_group = 'principal'
        )
      )
    )
  );

CREATE POLICY "Enable member deletion"
  ON public.group_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        u.role = 'admin'
        OR EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = group_members.group_id
          AND gm.user_id = auth.uid()
          AND gm.role_in_group = 'principal'
        )
      )
    )
  ); 