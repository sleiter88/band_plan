-- Crear una tabla temporal para almacenar la relación entre roles y grupos
CREATE TEMP TABLE role_group_mapping AS
SELECT DISTINCT 
    r.id as old_role_id,
    r.name as role_name,
    gm.group_id,
    gmr.group_member_id
FROM roles r
JOIN group_member_roles gmr ON gmr.role_id = r.id
JOIN group_members gm ON gm.id = gmr.group_member_id
WHERE r.group_id IS NULL;

-- Crear nuevos roles específicos para cada grupo
WITH new_roles AS (
    INSERT INTO roles (name, group_id, created_at, updated_at)
    SELECT DISTINCT
        role_name,
        group_id,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM role_group_mapping
    RETURNING id, name, group_id
),
-- Crear un mapeo entre roles viejos y nuevos
role_updates AS (
    SELECT 
        rgm.old_role_id,
        rgm.group_member_id,
        nr.id as new_role_id
    FROM role_group_mapping rgm
    JOIN new_roles nr ON nr.name = rgm.role_name 
        AND nr.group_id = rgm.group_id
)
-- Actualizar las referencias en group_member_roles
UPDATE group_member_roles
SET role_id = ru.new_role_id
FROM role_updates ru
WHERE group_member_roles.group_member_id = ru.group_member_id
AND group_member_roles.role_id = ru.old_role_id;

-- Eliminar los roles antiguos que no tienen grupo asignado
DELETE FROM roles WHERE group_id IS NULL;

-- Verificar y mostrar estadísticas de la migración
DO $$
DECLARE
    roles_count INT;
    groups_count INT;
    member_roles_count INT;
BEGIN
    SELECT COUNT(*) INTO roles_count FROM roles;
    SELECT COUNT(DISTINCT group_id) INTO groups_count FROM roles;
    SELECT COUNT(*) INTO member_roles_count FROM group_member_roles;
    
    RAISE NOTICE 'Migración completada:';
    RAISE NOTICE '- Total de roles: %', roles_count;
    RAISE NOTICE '- Grupos con roles: %', groups_count;
    RAISE NOTICE '- Asignaciones de roles a miembros: %', member_roles_count;
END $$; 