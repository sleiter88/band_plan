-- Primero, eliminar todas las políticas existentes
DO $$ 
DECLARE 
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'groups'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.groups', pol.policyname);
    END LOOP;
END $$;

-- Deshabilitar RLS temporalmente
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;

-- Crear función para crear grupos
CREATE OR REPLACE FUNCTION public.create_group(
    p_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_group_id UUID;
BEGIN
    -- Insertar el nuevo grupo
    INSERT INTO public.groups (
        name,
        created_by
    ) VALUES (
        p_name,
        auth.uid()
    )
    RETURNING id INTO v_group_id;

    RETURN v_group_id;
END;
$$;

-- Crear política para ver grupos
CREATE POLICY "groups_select_policy" ON public.groups
    FOR SELECT
    TO authenticated
    USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_members.group_id = id
            AND group_members.user_id = auth.uid()
        )
    );

-- Crear política para actualizar grupos
CREATE POLICY "groups_update_policy" ON public.groups
    FOR UPDATE
    TO authenticated
    USING (created_by = auth.uid());

-- Crear política para eliminar grupos
CREATE POLICY "groups_delete_policy" ON public.groups
    FOR DELETE
    TO authenticated
    USING (created_by = auth.uid());

-- Habilitar RLS nuevamente
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY; 