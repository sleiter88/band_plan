ALTER TABLE group_members
ADD COLUMN invitation_token UUID,
ADD COLUMN status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive'));

-- Añadir índice para búsquedas rápidas por token
CREATE INDEX idx_group_members_invitation_token ON group_members(invitation_token); 