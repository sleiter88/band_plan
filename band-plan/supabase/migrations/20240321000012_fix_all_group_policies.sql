-- Eliminar TODAS las políticas existentes de la tabla groups
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

-- Deshabilitar y volver a habilitar RLS para limpiar cualquier política residual
ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Crear política única para permitir a cualquier usuario autenticado realizar todas las operaciones
CREATE POLICY "groups_policy" ON public.groups
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  CASE
    WHEN current_setting('role') = 'rls_none' THEN true
    WHEN current_setting('request.method') = 'GET' THEN 
      created_by = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM public.group_members 
        WHERE group_members.group_id = id 
        AND group_members.user_id = auth.uid()
      )
    WHEN current_setting('request.method') = 'POST' THEN true
    WHEN current_setting('request.method') IN ('PUT', 'PATCH', 'DELETE') THEN created_by = auth.uid()
    ELSE false
  END
); 