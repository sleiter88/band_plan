-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all availabilities" ON public.member_availability;
DROP POLICY IF EXISTS "Users can manage their own availability" ON public.member_availability;
DROP POLICY IF EXISTS "Users can delete their own availability" ON public.member_availability;

-- Create member_availability table
CREATE TABLE IF NOT EXISTS public.member_availability (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE public.member_availability ENABLE ROW LEVEL SECURITY;

-- Add updated_at trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.member_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Policies
CREATE POLICY "Users can view all availabilities"
  ON public.member_availability FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their own availability"
  ON public.member_availability FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own availability"
  ON public.member_availability FOR DELETE
  USING (auth.uid() = user_id);