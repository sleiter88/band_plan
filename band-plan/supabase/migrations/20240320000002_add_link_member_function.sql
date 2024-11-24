-- Drop existing function if exists
DROP FUNCTION IF EXISTS public.link_group_member(UUID, UUID, UUID);

-- Function to safely link a group member to a user
CREATE OR REPLACE FUNCTION public.link_group_member(
  p_member_id UUID,
  p_user_id UUID,
  p_group_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the member exists and belongs to the specified group
  IF NOT EXISTS (
    SELECT 1 
    FROM group_members 
    WHERE id = p_member_id 
    AND group_id = p_group_id 
    AND user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Invalid member or member is already linked';
  END IF;

  -- Check if the user is already a member of the group
  IF EXISTS (
    SELECT 1 
    FROM group_members 
    WHERE group_id = p_group_id 
    AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'User is already a member of this group';
  END IF;

  -- Update the member record
  UPDATE group_members
  SET user_id = p_user_id
  WHERE id = p_member_id
  AND group_id = p_group_id
  AND user_id IS NULL;

  -- If no rows were updated, something went wrong
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to link member';
  END IF;
END;
$$;