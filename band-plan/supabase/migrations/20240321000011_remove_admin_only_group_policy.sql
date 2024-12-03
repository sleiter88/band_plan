-- Eliminar la política que restringe la creación de grupos solo a administradores
DROP POLICY IF EXISTS "Enable insert for admin users only on groups" ON public.groups; 