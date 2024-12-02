-- Primero, eliminamos todas las políticas existentes
DO $$ 
BEGIN
  -- Eliminar todas las políticas de groups
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.groups;', E'\n')
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'groups'
  );
  
  -- Eliminar todas las políticas de group_members
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.group_members;', E'\n')
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'group_members'
  );
END $$;

-- Habilitar RLS en las tablas
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Añadir columna de email a group_members si no existe
ALTER TABLE public.group_members
ADD COLUMN IF NOT EXISTS email TEXT;

-- Actualizamos los registros existentes con el email del usuario correspondiente
UPDATE public.group_members gm
SET email = u.email
FROM public.users u
WHERE gm.user_id = u.id
AND (gm.email IS NULL OR gm.email = '');

-- Ahora podemos añadir la restricción NOT NULL
ALTER TABLE public.group_members
ALTER COLUMN email SET NOT NULL;

-- Y finalmente creamos el índice único
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_members_email_group
ON public.group_members(group_id, email);

-- Trigger para verificar que el email corresponde a un usuario existente
CREATE OR REPLACE FUNCTION public.verify_group_member_email()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_group_name TEXT;
BEGIN
  -- Buscar el usuario por email
  SELECT id INTO v_user_id
  FROM public.users
  WHERE users.email = NEW.email;

  -- Si existe el usuario, crear notificación
  IF v_user_id IS NOT NULL THEN
    -- Obtener nombre del grupo
    SELECT name INTO v_group_name
    FROM public.groups
    WHERE id = NEW.group_id;

    -- Crear notificación
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      data
    ) VALUES (
      v_user_id,
      'group_invitation',
      'Nueva invitación a grupo',
      'Has sido invitado a unirte a ' || v_group_name,
      jsonb_build_object(
        'group_id', NEW.group_id,
        'group_name', v_group_name,
        'group_member_id', NEW.id,
        'role', NEW.role_in_group
      )
    );

    -- Ya no vinculamos automáticamente el user_id
    -- NEW.user_id = v_user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Primero eliminar el trigger existente si existe
DROP TRIGGER IF EXISTS verify_group_member_email_trigger ON public.group_members;

-- Luego crear el trigger
CREATE TRIGGER verify_group_member_email_trigger
BEFORE INSERT ON public.group_members
FOR EACH ROW
EXECUTE FUNCTION public.verify_group_member_email();

-- Políticas simples para groups
CREATE POLICY "enable_all_for_admin_groups" ON public.groups
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Política simple para group_members
CREATE POLICY "enable_all_for_admin_members" ON public.group_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Política para permitir a los usuarios ver sus propios registros
CREATE POLICY "enable_select_for_users" ON public.group_members
  FOR SELECT USING (
    user_id = auth.uid()
  );

-- Política para permitir a los usuarios actualizar sus propios registros
CREATE POLICY "enable_update_for_users" ON public.group_members
  FOR UPDATE USING (
    user_id = auth.uid()
  );

-- Permitir a los miembros ver los grupos a los que pertenecen
CREATE POLICY "enable_select_for_members" ON public.groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
    )
  );

-- Permitir a los miembros del grupo añadir nuevos miembros
CREATE POLICY "enable_insert_for_members" ON public.group_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
    )
  );

-- Actualizar la función para incluir el parámetro email
CREATE OR REPLACE FUNCTION public.add_group_member_with_instruments(
  p_group_id UUID,
  p_name TEXT,
  p_email TEXT,
  p_role TEXT,
  p_user_id UUID,
  p_instruments UUID[],
  p_new_instruments TEXT[]
) RETURNS JSONB AS $$
DECLARE
  v_member_id UUID;
  v_instrument_id UUID;
  v_new_instrument_id UUID;
  v_invitation_result JSONB;
BEGIN
  -- Insertar el nuevo miembro
  INSERT INTO public.group_members (
    group_id,
    name,
    email,
    role_in_group,
    user_id
  ) VALUES (
    p_group_id,
    p_name,
    p_email,
    p_role,
    p_user_id
  ) RETURNING id INTO v_member_id;

  -- Procesar instrumentos existentes
  IF array_length(p_instruments, 1) > 0 THEN
    INSERT INTO public.group_member_instruments (group_member_id, instrument_id)
    SELECT v_member_id, unnest(p_instruments);
  END IF;

  -- Procesar nuevos instrumentos
  IF array_length(p_new_instruments, 1) > 0 THEN
    FOR i IN 1..array_length(p_new_instruments, 1) LOOP
      -- Insertar nuevo instrumento
      INSERT INTO public.instruments (name, group_id)
      VALUES (p_new_instruments[i], p_group_id)
      RETURNING id INTO v_new_instrument_id;

      -- Asociar con el miembro
      INSERT INTO public.group_member_instruments (group_member_id, instrument_id)
      VALUES (v_member_id, v_new_instrument_id);
    END LOOP;
  END IF;

  -- Crear y enviar invitación
  v_invitation_result := public.create_group_invitation(v_member_id, p_email);

  RETURN jsonb_build_object(
    'success', true,
    'member_id', v_member_id,
    'invitation', v_invitation_result
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger para vincular usuarios cuando se registran
CREATE OR REPLACE FUNCTION public.link_group_member_on_user_create()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualizar los registros de group_members que coincidan con el email
  UPDATE public.group_members
  SET user_id = NEW.id
  WHERE email = NEW.email
  AND user_id IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar el trigger si existe
DROP TRIGGER IF EXISTS link_group_member_on_user_create_trigger ON public.users;

-- Crear el trigger
CREATE TRIGGER link_group_member_on_user_create_trigger
AFTER INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.link_group_member_on_user_create();

-- Crear tabla para invitaciones
CREATE TABLE IF NOT EXISTS public.group_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  group_member_id UUID NOT NULL REFERENCES public.group_members(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Función para crear invitación (sin envío de email)
CREATE OR REPLACE FUNCTION public.create_group_invitation(
  p_group_member_id UUID,
  p_email TEXT
) RETURNS JSONB AS $$
DECLARE
  v_token TEXT;
  v_group_id UUID;
  v_user_exists BOOLEAN;
  v_group_name TEXT;
BEGIN
  -- Generar token único
  v_token := encode(gen_random_bytes(32), 'hex');
  
  -- Obtener group_id y nombre
  SELECT gm.group_id, g.name INTO v_group_id, v_group_name
  FROM public.group_members gm
  JOIN public.groups g ON g.id = gm.group_id
  WHERE gm.id = p_group_member_id;

  -- Verificar si el usuario ya existe
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE email = p_email
  ) INTO v_user_exists;

  -- Crear la invitación
  INSERT INTO public.group_invitations (
    group_id,
    group_member_id,
    email,
    token
  ) VALUES (
    v_group_id,
    p_group_member_id,
    p_email,
    v_token
  );

  RETURN jsonb_build_object(
    'success', true,
    'token', v_token,
    'userExists', v_user_exists,
    'group_name', v_group_name,
    'email', p_email
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear política para invitaciones
CREATE POLICY "enable_all_for_admin_invitations" ON public.group_invitations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Permitir a los miembros ver invitaciones de sus grupos
CREATE POLICY "enable_select_for_members_invitations" ON public.group_invitations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = group_invitations.group_id
      AND group_members.user_id = auth.uid()
    )
  );

-- Función para validar el registro con invitación
CREATE OR REPLACE FUNCTION public.validate_invitation_registration()
RETURNS TRIGGER AS $$
DECLARE
  v_invitation_email TEXT;
BEGIN
  -- Si hay un token, verificar que el email coincide
  IF TG_ARGV[0] IS NOT NULL THEN
    SELECT email INTO v_invitation_email
    FROM public.group_invitations
    WHERE token = TG_ARGV[0]
    AND status = 'pending'
    AND expires_at > NOW();

    IF v_invitation_email IS NULL THEN
      RAISE EXCEPTION 'Invitación no válida o expirada';
    END IF;

    IF v_invitation_email != NEW.email THEN
      RAISE EXCEPTION 'El email no coincide con la invitación';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar el registro
DROP TRIGGER IF EXISTS validate_invitation_registration_trigger ON auth.users;
CREATE TRIGGER validate_invitation_registration_trigger
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.validate_invitation_registration();

-- Crear tabla de notificaciones
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Políticas para notificaciones
CREATE POLICY "users_can_read_own_notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

-- Función para aceptar/rechazar invitación
CREATE OR REPLACE FUNCTION public.handle_group_invitation(
  p_group_member_id UUID,
  p_accept BOOLEAN
) RETURNS JSONB AS $$
DECLARE
  v_group_name TEXT;
  v_notification_id UUID;
BEGIN
  -- Verificar que el usuario es el destinatario de la invitación
  IF NOT EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.id = p_group_member_id
    AND gm.email = (
      SELECT email FROM public.users WHERE id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para manejar esta invitación';
  END IF;

  IF p_accept THEN
    -- Actualizar el estado de la invitación a aceptada
    UPDATE public.group_invitations
    SET status = 'accepted'
    WHERE group_member_id = p_group_member_id;

    -- Vincular el usuario al aceptar
    UPDATE public.group_members
    SET user_id = auth.uid()
    WHERE id = p_group_member_id;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Invitación aceptada'
    );
  ELSE
    -- Si se rechaza, eliminar el miembro y la invitación
    DELETE FROM public.group_members
    WHERE id = p_group_member_id;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Invitación rechazada'
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Actualizar la función get_invitation_details con tipos específicos
CREATE OR REPLACE FUNCTION public.get_invitation_details(p_token TEXT)
RETURNS TABLE (
  invitation_id UUID,
  group_name VARCHAR,
  role_in_group VARCHAR,
  email VARCHAR,
  status VARCHAR,
  group_member_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gi.id as invitation_id,
    g.name::VARCHAR as group_name,
    gm.role_in_group::VARCHAR as role_in_group,
    gi.email::VARCHAR as email,
    gi.status::VARCHAR as status,
    gi.group_member_id
  FROM group_invitations gi
  JOIN groups g ON g.id = gi.group_id
  JOIN group_members gm ON gm.id = gi.group_member_id
  WHERE gi.token = p_token
  AND gi.status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Habilitar replicación para notificaciones
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Asegurarse de que la tabla tiene habilitado el seguimiento de cambios
ALTER TABLE notifications REPLICA IDENTITY FULL;