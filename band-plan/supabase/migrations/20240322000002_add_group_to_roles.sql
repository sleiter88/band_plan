-- Primero, eliminamos todas las restricciones existentes que puedan causar conflictos
DO $$ 
BEGIN
    -- Intentar eliminar las restricciones si existen
    EXECUTE (
        SELECT 'ALTER TABLE roles DROP CONSTRAINT ' || constraint_name || ';'
        FROM information_schema.table_constraints 
        WHERE table_name = 'roles' 
        AND constraint_name IN ('roles_name_key', 'roles_name_group_unique')
    );
EXCEPTION 
    WHEN OTHERS THEN 
        NULL;
END $$;

-- Agregamos la columna group_id a roles
ALTER TABLE roles ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id);

-- Actualizamos la restricción UNIQUE para considerar tanto el nombre como el grupo
ALTER TABLE roles
  ADD CONSTRAINT roles_name_group_unique UNIQUE (name, group_id);

-- Habilitar RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Crear política para que los usuarios puedan ver los roles de sus grupos
DROP POLICY IF EXISTS "Users can view roles in their groups" ON roles;
CREATE POLICY "Users can view roles in their groups" ON roles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = roles.group_id
      AND gm.user_id = auth.uid()
    )
  );

-- Crear política para que los usuarios principales puedan crear roles en sus grupos
DROP POLICY IF EXISTS "Principal members can manage roles" ON roles;
CREATE POLICY "Principal members can manage roles" ON roles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = roles.group_id
      AND gm.user_id = auth.uid()
      AND gm.role_in_group = 'principal'
    )
  );