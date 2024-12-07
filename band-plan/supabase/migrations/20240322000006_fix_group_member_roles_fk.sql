-- Primero eliminamos la restricción existente
ALTER TABLE group_member_roles 
    DROP CONSTRAINT group_member_roles_group_member_id_fkey;

-- Luego la recreamos con CASCADE
ALTER TABLE group_member_roles 
    ADD CONSTRAINT group_member_roles_group_member_id_fkey 
    FOREIGN KEY (group_member_id) 
    REFERENCES group_members(id) 
    ON DELETE CASCADE; 