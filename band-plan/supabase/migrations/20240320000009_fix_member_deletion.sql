-- Asegurarnos de que las eliminaciones en cascada están configuradas correctamente
ALTER TABLE public.event_members
DROP CONSTRAINT IF EXISTS event_members_group_member_id_fkey,
ADD CONSTRAINT event_members_group_member_id_fkey 
FOREIGN KEY (group_member_id) 
REFERENCES public.group_members(id) 
ON DELETE CASCADE;

ALTER TABLE public.group_member_instruments
DROP CONSTRAINT IF EXISTS group_member_instruments_group_member_id_fkey,
ADD CONSTRAINT group_member_instruments_group_member_id_fkey 
FOREIGN KEY (group_member_id) 
REFERENCES public.group_members(id) 
ON DELETE CASCADE;

-- Asegurarnos de que la política de eliminación está correctamente configurada
DROP POLICY IF EXISTS "Enable member removal for admins and principals" ON public.group_members;

CREATE POLICY "Enable member removal for admins and principals" ON public.group_members
FOR DELETE USING (
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