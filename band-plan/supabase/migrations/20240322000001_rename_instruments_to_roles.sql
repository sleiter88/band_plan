-- Asegurarnos de que la tabla group_members existe
CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  role_in_group TEXT NOT NULL CHECK (role_in_group IN ('principal', 'sustituto')),
  sync_calendar BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Asegurarnos de que la tabla roles existe
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Crear la tabla de relación si no existe
CREATE TABLE IF NOT EXISTS group_member_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_member_id UUID NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_member_id, role_id)
);

-- Migrar datos si existen las tablas antiguas
DO $$
BEGIN
    -- Migrar datos de band_members a group_members si existe
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'band_members') THEN
        INSERT INTO group_members (id, group_id, user_id, name, role_in_group, created_at, updated_at)
        SELECT id, group_id, user_id, name, role_in_band, created_at, updated_at
        FROM band_members
        ON CONFLICT (id) DO NOTHING;
        
        DROP TABLE band_members;
    END IF;

    -- Migrar datos de band_member_instruments a group_member_roles si existe
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'band_member_instruments') THEN
        INSERT INTO group_member_roles (id, group_member_id, role_id, created_at, updated_at)
        SELECT gen_random_uuid(), band_member_id, instrument_id, created_at, updated_at
        FROM band_member_instruments
        ON CONFLICT (group_member_id, role_id) DO NOTHING;
        
        DROP TABLE band_member_instruments;
    END IF;
END $$;

-- Crear nueva política si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'roles' 
        AND policyname = 'Users can view roles in their groups'
    ) THEN
        CREATE POLICY "Users can view roles in their groups" ON roles
          FOR SELECT
          TO authenticated
          USING (true);
    END IF;
END $$;

-- Crear políticas para group_member_roles si no existen
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'group_member_roles' 
        AND policyname = 'Users can view roles of their group members'
    ) THEN
        CREATE POLICY "Users can view roles of their group members" ON group_member_roles
          FOR SELECT
          TO authenticated
          USING (
            EXISTS (
              SELECT 1 FROM group_members gm
              WHERE gm.id = group_member_roles.group_member_id
              AND EXISTS (
                SELECT 1 FROM group_members my_membership
                WHERE my_membership.group_id = gm.group_id
                AND my_membership.user_id = auth.uid()
              )
            )
          );
    END IF;
END $$;

-- Actualizar cualquier trigger o función que use el nombre anterior
-- (Ajusta esto según tus triggers específicos) 