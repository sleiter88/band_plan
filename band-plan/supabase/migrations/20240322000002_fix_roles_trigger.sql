-- Eliminar el trigger y la función existentes
DROP TRIGGER IF EXISTS set_updated_at ON roles;
DROP FUNCTION IF EXISTS set_updated_at CASCADE;

-- Crear la función correcta para el trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        NEW.updated_at = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear el nuevo trigger
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at(); 