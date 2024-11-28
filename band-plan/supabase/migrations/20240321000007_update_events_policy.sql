-- Drop existing select policy
DROP POLICY IF EXISTS "Users can view events for their groups" ON public.events;

-- Create new policy that allows all authenticated users to view events
CREATE POLICY "Users can view events"
  ON public.events FOR SELECT
  USING (auth.role() = 'authenticated');
