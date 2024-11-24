-- Primero, vamos a eliminar todos los triggers existentes en group_members
DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    FOR trigger_record IN 
        SELECT tgname 
        FROM pg_trigger 
        WHERE tgrelid = 'public.group_members'::regclass
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || trigger_record.tgname || ' ON public.group_members';
    END LOOP;
END
$$;

-- Ahora recreamos el trigger correcto
CREATE OR REPLACE FUNCTION public.group_members_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Usar group_id en lugar de band_id
    IF TG_OP = 'UPDATE' AND NEW.group_id != OLD.group_id THEN
        RAISE EXCEPTION 'No se puede cambiar el grupo de un miembro';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER group_members_trigger
    BEFORE INSERT OR UPDATE ON public.group_members
    FOR EACH ROW
    EXECUTE FUNCTION public.group_members_trigger(); 