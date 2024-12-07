-- Añadir columna group_id a roles si no existe
ALTER TABLE roles 
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id);

-- Actualizar roles existentes para asignarles un grupo
UPDATE roles r
SET group_id = gm.group_id
FROM group_member_roles gmr
JOIN group_members gm ON gmr.group_member_id = gm.id
WHERE r.id = gmr.role_id
AND r.group_id IS NULL;

-- Eliminar roles huérfanos (que no están asociados a ningún grupo)
DELETE FROM roles
WHERE group_id IS NULL;

-- Hacer group_id NOT NULL después de la migración
ALTER TABLE roles
ALTER COLUMN group_id SET NOT NULL;

-- Añadir restricción única para nombre+grupo
ALTER TABLE roles
DROP CONSTRAINT IF EXISTS unique_role_name_per_group;
ALTER TABLE roles
ADD CONSTRAINT unique_role_name_per_group UNIQUE (name, group_id);

-- Habilitar RLS si no está habilitado
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

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
DROP POLICY IF EXISTS "Users can add roles to their groups" ON roles;
CREATE POLICY "Users can add roles to their groups" ON roles AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (
            SELECT EXISTS (
                SELECT 1 FROM group_members gm
                WHERE gm.group_id = roles.group_id
                AND gm.user_id = auth.uid()
                AND gm.role_in_group = 'principal'
            )
            OR EXISTS (
                SELECT 1 FROM users u
                WHERE u.id = auth.uid()
                AND u.role = 'admin'
            )
        )
    );

-- Política para actualizar roles
DROP POLICY IF EXISTS "Users can update roles in their groups" ON roles;
CREATE POLICY "Users can update roles in their groups" ON roles
    FOR UPDATE
    TO authenticated
    USING (
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

-- Política para eliminar roles
DROP POLICY IF EXISTS "Users can delete roles in their groups" ON roles;
CREATE POLICY "Users can delete roles in their groups" ON roles
    FOR DELETE
    TO authenticated
    USING (
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