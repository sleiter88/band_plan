-- Add update policies for band members
CREATE POLICY "Enable member updates for admins and self" ON public.band_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        -- Admin can update any member
        u.role = 'admin'
        OR
        -- Users can update their own data
        band_members.user_id = auth.uid()
      )
    )
  );

-- Add update policies for band member instruments
CREATE POLICY "Enable instrument updates for admins and self" ON public.band_member_instruments
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
          SELECT 1 FROM public.band_members bm
          WHERE bm.id = band_member_instruments.band_member_id
          AND bm.user_id = auth.uid()
        )
      )
    )
  );