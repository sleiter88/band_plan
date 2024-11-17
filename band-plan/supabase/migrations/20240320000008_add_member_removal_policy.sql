-- Add delete policy for band members
CREATE POLICY "Enable member removal for admins and principals" ON public.band_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        -- Admin can remove any member
        u.role = 'admin'
        OR
        -- Principal members can remove other members from their band
        EXISTS (
          SELECT 1 FROM public.band_members bm
          WHERE bm.band_id = band_members.band_id
          AND bm.user_id = auth.uid()
          AND bm.role_in_band = 'principal'
        )
      )
    )
  );