-- Function to safely link a band member to a user
CREATE OR REPLACE FUNCTION public.link_band_member(
  p_member_id UUID,
  p_user_id UUID,
  p_band_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the member exists and belongs to the specified band
  IF NOT EXISTS (
    SELECT 1 
    FROM band_members 
    WHERE id = p_member_id 
    AND band_id = p_band_id 
    AND user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Invalid member or member is already linked';
  END IF;

  -- Check if the user is already a member of the band
  IF EXISTS (
    SELECT 1 
    FROM band_members 
    WHERE band_id = p_band_id 
    AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'User is already a member of this band';
  END IF;

  -- Update the member record
  UPDATE band_members
  SET user_id = p_user_id
  WHERE id = p_member_id
  AND band_id = p_band_id
  AND user_id IS NULL;

  -- If no rows were updated, something went wrong
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to link member';
  END IF;
END;
$$;