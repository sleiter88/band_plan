-- Asegurarnos de que las eliminaciones en cascada están configuradas correctamente
ALTER TABLE public.event_members
DROP CONSTRAINT IF EXISTS event_members_band_member_id_fkey,
ADD CONSTRAINT event_members_band_member_id_fkey 
FOREIGN KEY (band_member_id) 
REFERENCES public.band_members(id) 
ON DELETE CASCADE;

ALTER TABLE public.band_member_instruments
DROP CONSTRAINT IF EXISTS band_member_instruments_band_member_id_fkey,
ADD CONSTRAINT band_member_instruments_band_member_id_fkey 
FOREIGN KEY (band_member_id) 
REFERENCES public.band_members(id) 
ON DELETE CASCADE;

-- Asegurarnos de que la política de eliminación está correctamente configurada
DROP POLICY IF EXISTS "Enable member removal for admins and principals" ON public.band_members;

CREATE POLICY "Enable member removal for admins and principals" ON public.band_members
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
    AND (
      u.role = 'admin'
      OR EXISTS (
        SELECT 1 FROM public.band_members bm
        WHERE bm.band_id = band_members.band_id
        AND bm.user_id = auth.uid()
        AND bm.role_in_band = 'principal'
      )
    )
  )
);