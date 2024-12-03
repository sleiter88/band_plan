-- Primero, eliminar TODAS las políticas y triggers existentes
DROP POLICY IF EXISTS "Users can create groups" ON public.groups;
DROP POLICY IF EXISTS "Users can view their groups" ON public.groups;
DROP POLICY IF EXISTS "Users can update their created groups" ON public.groups;
DROP POLICY IF EXISTS "Users can delete their created groups" ON public.groups;
DROP POLICY IF EXISTS "Enable insert for admin users only on groups" ON public.groups;
DROP POLICY IF EXISTS "Enable read access for groups" ON public.groups;
DROP POLICY IF EXISTS "enable_all_for_admin_groups" ON public.groups;
DROP POLICY IF EXISTS "enable_select_for_members" ON public.groups;
DROP POLICY IF EXISTS "allow_create_groups" ON public.groups;
DROP POLICY IF EXISTS "allow_view_groups" ON public.groups;
DROP POLICY IF EXISTS "allow_update_own_groups" ON public.groups;
DROP POLICY IF EXISTS "allow_delete_own_groups" ON public.groups;
DROP POLICY IF EXISTS "groups_policy" ON public.groups;
DROP POLICY IF EXISTS "groups_insert_policy" ON public.groups;
DROP POLICY IF EXISTS "groups_select_policy" ON public.groups;
DROP POLICY IF EXISTS "groups_update_policy" ON public.groups;
DROP POLICY IF EXISTS "groups_delete_policy" ON public.groups;
DROP POLICY IF EXISTS "enable_insert" ON public.groups;
DROP POLICY IF EXISTS "enable_select" ON public.groups;
DROP POLICY IF EXISTS "enable_update" ON public.groups;
DROP POLICY IF EXISTS "enable_delete" ON public.groups;

-- Eliminar todas las políticas de forma dinámica
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

DROP TRIGGER IF EXISTS tr_set_groups_created_by ON public.groups;
DROP FUNCTION IF EXISTS public.set_groups_created_by();
DROP FUNCTION IF EXISTS public.create_group(p_name TEXT);

-- Deshabilitar y volver a habilitar RLS
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Crear función para establecer created_by
CREATE OR REPLACE FUNCTION public.set_groups_created_by()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger para establecer created_by automáticamente
CREATE TRIGGER tr_set_groups_created_by
  BEFORE INSERT ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.set_groups_created_by();

-- Crear una única política simple para cada operación
CREATE POLICY "groups_insert_policy" ON public.groups FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "groups_select_policy" ON public.groups FOR SELECT USING (true);
CREATE POLICY "groups_update_policy" ON public.groups FOR UPDATE USING (created_by = auth.uid());
CREATE POLICY "groups_delete_policy" ON public.groups FOR DELETE USING (created_by = auth.uid()); 