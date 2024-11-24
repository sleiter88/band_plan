-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.add_band_member_with_instruments;

-- Function to add a band member with instruments
CREATE OR REPLACE FUNCTION public.add_band_member_with_instruments(
  p_group_id UUID,
  p_name TEXT,
  p_role TEXT,
  p_user_id UUID,
  p_instruments UUID[],
  p_new_instruments TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id UUID;
  v_instrument_id UUID;
  v_new_instrument_ids UUID[] := '{}';
  v_user_role TEXT;
  v_band_exists BOOLEAN;
  v_is_admin BOOLEAN;
BEGIN
  -- Check if user exists and get their role
  SELECT role INTO v_user_role
  FROM public.users
  WHERE id = auth.uid();

  -- Set admin flag
  v_is_admin := v_user_role = 'admin';

  -- Check if band exists
  SELECT EXISTS (
    SELECT 1 FROM public.bands WHERE id = p_group_id
  ) INTO v_band_exists;

  IF NOT v_band_exists THEN
    RAISE EXCEPTION 'Band does not exist';
  END IF;

  -- Verify permissions
  IF NOT v_is_admin AND p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Only admins can add other users as members';
  END IF;

  -- Insert new instruments if any
  IF array_length(p_new_instruments, 1) > 0 THEN
    FOR i IN 1..array_length(p_new_instruments, 1) LOOP
      INSERT INTO public.instruments (name, created_by)
      VALUES (p_new_instruments[i], auth.uid())
      RETURNING id INTO v_instrument_id;
      
      v_new_instrument_ids := array_append(v_new_instrument_ids, v_instrument_id);
    END LOOP;
  END IF;

  -- Create band member
  INSERT INTO public.band_members (
    group_id,
    user_id,
    name,
    role_in_band,
    created_by
  )
  VALUES (
    p_group_id,
    p_user_id,
    p_name,
    p_role,
    auth.uid()
  )
  RETURNING id INTO v_member_id;

  -- Add existing instruments
  IF array_length(p_instruments, 1) > 0 THEN
    INSERT INTO public.band_member_instruments (
      band_member_id,
      instrument_id,
      created_by
    )
    SELECT 
      v_member_id,
      instrument_id,
      auth.uid()
    FROM unnest(p_instruments) AS instrument_id;
  END IF;

  -- Add new instruments
  IF array_length(v_new_instrument_ids, 1) > 0 THEN
    INSERT INTO public.band_member_instruments (
      band_member_id,
      instrument_id,
      created_by
    )
    SELECT 
      v_member_id,
      id,
      auth.uid()
    FROM unnest(v_new_instrument_ids) AS id;
  END IF;

  RETURN jsonb_build_object(
    'member_id', v_member_id,
    'new_instrument_ids', v_new_instrument_ids
  );
END;
$$;