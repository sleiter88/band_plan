-- Añadir columna group_id a roles si no existe
ALTER TABLE roles 
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id);

-- Actualizar roles existentes para asignarles un grupo
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT DISTINCT r.id as role_id, gmr.group_member_id, gm.group_id
             FROM roles r
             JOIN group_member_roles gmr ON r.id = gmr.role_id
             JOIN group_members gm ON gmr.group_member_id = gm.id
    LOOP
        UPDATE roles
        SET group_id = r.group_id
        WHERE id = r.role_id;
    END LOOP;
END $$;

-- Hacer group_id NOT NULL después de la migración
ALTER TABLE roles
ALTER COLUMN group_id SET NOT NULL;

-- Añadir restricción única para nombre+grupo
ALTER TABLE roles
ADD CONSTRAINT unique_role_name_per_group UNIQUE (name, group_id);

-- Actualizar la política de roles
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

-- Política para insertar roles
CREATE POLICY "Users can add roles to their groups" ON roles
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM group_members gm
            WHERE gm.group_id = roles.group_id
            AND gm.user_id = auth.uid()
            AND gm.role_in_group = 'principal'
        )
        OR
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
    ); 