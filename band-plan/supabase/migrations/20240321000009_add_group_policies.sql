-- Habilitar RLS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Users can create groups" ON public.groups;
DROP POLICY IF EXISTS "Users can view their groups" ON public.groups;
DROP POLICY IF EXISTS "Users can update their created groups" ON public.groups;
DROP POLICY IF EXISTS "Users can delete their created groups" ON public.groups;

-- Función para establecer automáticamente el created_by
CREATE OR REPLACE FUNCTION public.set_groups_created_by()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para establecer created_by automáticamente
DROP TRIGGER IF EXISTS tr_set_groups_created_by ON public.groups;
CREATE TRIGGER tr_set_groups_created_by
  BEFORE INSERT ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.set_groups_created_by();

-- Política para permitir a los usuarios crear grupos
CREATE POLICY "Users can create groups"
  ON public.groups
  FOR INSERT
  WITH CHECK (true);

-- Política para que los usuarios puedan ver grupos donde son miembros o que han creado
CREATE POLICY "Users can view their groups"
  ON public.groups
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
    )
    OR
    created_by = auth.uid()
  );

-- Política para que los usuarios puedan actualizar grupos que crearon
CREATE POLICY "Users can update their created groups"
  ON public.groups
  FOR UPDATE
  USING (created_by = auth.uid());

-- Política para que los usuarios puedan eliminar grupos que crearon
CREATE POLICY "Users can delete their created groups"
  ON public.groups
  FOR DELETE
  USING (created_by = auth.uid()); 