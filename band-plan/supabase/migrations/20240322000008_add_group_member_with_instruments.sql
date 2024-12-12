CREATE OR REPLACE FUNCTION add_group_member_with_instruments(
  p_group_id UUID,
  p_name TEXT,
  p_email TEXT,
  p_role TEXT,
  p_user_id UUID,
  p_instruments UUID[],
  p_new_instruments TEXT[]
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_group_member_id UUID;
  v_token UUID;
  v_user_exists BOOLEAN;
  v_group_name TEXT;
  v_new_role_id UUID;
  v_invitation JSON;
BEGIN
  -- Obtener el nombre del grupo
  SELECT name INTO v_group_name
  FROM groups
  WHERE id = p_group_id;

  -- Verificar si el usuario ya existe
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email;

  v_user_exists := v_user_id IS NOT NULL;
  
  -- Si se proporciona p_user_id, usarlo
  IF p_user_id IS NOT NULL THEN
    v_user_id := p_user_id;
  END IF;

  -- Generar token para la invitación
  v_token := gen_random_uuid();

  -- Crear el miembro del grupo
  INSERT INTO group_members (
    group_id,
    user_id,
    email,
    name,
    role_in_group,
    invitation_token,
    status
  )
  VALUES (
    p_group_id,
    v_user_id,
    p_email,
    p_name,
    p_role,
    v_token,
    CASE WHEN v_user_id IS NOT NULL THEN 'active' ELSE 'pending' END
  )
  RETURNING id INTO v_group_member_id;

  -- Crear nuevos roles si existen
  IF p_new_instruments IS NOT NULL AND array_length(p_new_instruments, 1) > 0 THEN
    FOR i IN 1..array_length(p_new_instruments, 1) LOOP
      INSERT INTO roles (name, group_id)
      VALUES (p_new_instruments[i], p_group_id)
      RETURNING id INTO v_new_role_id;
      
      -- Asociar el nuevo rol con el miembro
      INSERT INTO group_member_roles (group_member_id, role_id)
      VALUES (v_group_member_id, v_new_role_id);
    END LOOP;
  END IF;

  -- Asociar roles existentes
  IF p_instruments IS NOT NULL AND array_length(p_instruments, 1) > 0 THEN
    INSERT INTO group_member_roles (group_member_id, role_id)
    SELECT v_group_member_id, unnest(p_instruments);
  END IF;

  -- Preparar la respuesta JSON
  v_invitation := json_build_object(
    'email', p_email,
    'token', v_token,
    'userExists', v_user_exists,
    'groupName', v_group_name,
    'groupMemberId', v_group_member_id
  );

  RETURN json_build_object('invitation', v_invitation);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 