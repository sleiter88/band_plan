-- Eliminar TODAS las políticas existentes de la tabla groups
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

-- Deshabilitar y volver a habilitar RLS
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Política para INSERT - Cualquier usuario autenticado puede crear grupos
CREATE POLICY groups_insert_policy ON public.groups
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Política para SELECT - Ver grupos propios o donde es miembro
CREATE POLICY groups_select_policy ON public.groups
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

-- Política para UPDATE - Solo el creador puede actualizar
CREATE POLICY groups_update_policy ON public.groups
    FOR UPDATE
    TO authenticated
    USING (created_by = auth.uid());

-- Política para DELETE - Solo el creador puede eliminar
CREATE POLICY groups_delete_policy ON public.groups
    FOR DELETE
    TO authenticated
    USING (created_by = auth.uid()); 