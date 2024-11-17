-- Update the member_availability policies to allow admin management
DROP POLICY IF EXISTS "Users can manage their own availability" ON public.member_availability;
DROP POLICY IF EXISTS "Users can delete their own availability" ON public.member_availability;

-- New policies that include admin privileges
CREATE POLICY "Users can manage availability"
  ON public.member_availability FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        -- Admin can manage any member's availability
        u.role = 'admin'
        OR
        -- Users can only manage their own availability
        auth.uid() = user_id
      )
    )
  );

CREATE POLICY "Users can delete availability"
  ON public.member_availability FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        -- Admin can manage any member's availability
        u.role = 'admin'
        OR
        -- Users can only manage their own availability
        auth.uid() = user_id
      )
    )
  );