-- Eliminamos todas las versiones de la función
DROP FUNCTION IF EXISTS add_group_member_with_instruments(UUID, UUID, UUID[]);
DROP FUNCTION IF EXISTS add_group_member_with_instruments(UUID, UUID, INTEGER[]);
DROP FUNCTION IF EXISTS add_group_member_with_instruments(p_group_id UUID, p_user_id UUID, p_instrument_ids UUID[]);
DROP FUNCTION IF EXISTS add_group_member_with_instruments(UUID, TEXT, TEXT, TEXT, UUID, UUID[], TEXT[]);

-- Creamos la función actualizada con todos los parámetros necesarios
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
    v_member_id UUID;
    v_token TEXT;
    v_user_exists BOOLEAN;
    v_group_name TEXT;
    v_result JSON;
    v_role_id UUID;
BEGIN
    -- Obtener el nombre del grupo
    SELECT name INTO v_group_name
    FROM groups
    WHERE id = p_group_id;

    -- Buscar usuario existente por email
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = p_email;

    -- Si se proporciona p_user_id, usarlo en lugar del email lookup
    IF p_user_id IS NOT NULL THEN
        v_user_id := p_user_id;
    END IF;

    v_user_exists := v_user_id IS NOT NULL;

    -- Insertar el miembro en el grupo
    INSERT INTO group_members (group_id, user_id, email, name, role_in_group)
    VALUES (p_group_id, v_user_id, p_email, p_name, p_role)
    RETURNING id INTO v_member_id;

    -- Insertar los roles existentes
    IF array_length(p_instruments, 1) > 0 THEN
        INSERT INTO group_member_roles (group_member_id, role_id)
        SELECT v_member_id, role_id
        FROM unnest(p_instruments) AS role_id;
    END IF;

    -- Crear e insertar nuevos roles si existen
    IF array_length(p_new_instruments, 1) > 0 THEN
        FOR i IN 1..array_length(p_new_instruments, 1) LOOP
            -- Insertar nuevo rol con group_id
            INSERT INTO roles (name, group_id)
            VALUES (p_new_instruments[i], p_group_id)
            RETURNING id INTO v_role_id;

            -- Asignar el nuevo rol al miembro del grupo
            INSERT INTO group_member_roles (group_member_id, role_id)
            VALUES (v_member_id, v_role_id);
        END LOOP;
    END IF;

    -- Generar token de invitación SIEMPRE
    v_token := encode(gen_random_bytes(32), 'hex');
    
    -- Crear o actualizar la invitación
    INSERT INTO invitations (email, token, group_member_id)
    VALUES (p_email, v_token, v_member_id)
    ON CONFLICT (group_member_id) DO UPDATE
    SET token = v_token,
        email = p_email,
        updated_at = now();

    -- Construir el objeto JSON de respuesta
    v_result := json_build_object(
        'invitation', json_build_object(
            'email', p_email,
            'token', v_token,
            'userExists', v_user_exists,
            'groupName', v_group_name,
            'groupMemberId', v_member_id
        )
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 