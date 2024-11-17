-- Enable RLS on all tables
ALTER TABLE public.bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_member_instruments ENABLE ROW LEVEL SECURITY;

-- Bands policies
CREATE POLICY "Enable read access for all users" ON public.bands
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for admin users only" ON public.bands
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Band members policies
CREATE POLICY "Enable read access for all users" ON public.band_members
  FOR SELECT USING (true);

CREATE POLICY "Enable member management" ON public.band_members
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
          SELECT 1 FROM public.band_members bm
          WHERE bm.band_id = band_members.band_id
          AND bm.user_id = auth.uid()
          AND bm.role_in_band = 'principal'
        )
        OR
        -- Users can add themselves if they're not already members
        (
          band_members.user_id = auth.uid()
          AND NOT EXISTS (
            SELECT 1 FROM public.band_members existing
            WHERE existing.band_id = band_members.band_id
            AND existing.user_id = auth.uid()
          )
        )
      )
    )
  );

-- Instruments policies
CREATE POLICY "Enable read access for all users" ON public.instruments
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
          SELECT 1 FROM public.band_members bm
          WHERE bm.user_id = auth.uid()
          AND bm.role_in_band = 'principal'
        )
        OR
        -- First member of a band can add instruments
        EXISTS (
          SELECT 1 FROM public.band_members bm
          WHERE bm.user_id = auth.uid()
          AND NOT EXISTS (
            SELECT 1 FROM public.band_members prev
            WHERE prev.band_id = bm.band_id
            AND prev.created_at < bm.created_at
          )
        )
      )
    )
  );

-- Band member instruments policies
CREATE POLICY "Enable read access for all users" ON public.band_member_instruments
  FOR SELECT USING (true);

CREATE POLICY "Enable instrument assignment" ON public.band_member_instruments
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
          SELECT 1 FROM public.band_members bm
          WHERE bm.user_id = auth.uid()
          AND bm.role_in_band = 'principal'
        )
        OR
        -- Users can assign instruments to themselves when joining
        EXISTS (
          SELECT 1 FROM public.band_members bm
          WHERE bm.id = band_member_instruments.band_member_id
          AND bm.user_id = auth.uid()
          AND bm.created_by = auth.uid()
        )
      )
    )
  );