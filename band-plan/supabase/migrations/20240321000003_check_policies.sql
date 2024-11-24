-- Listar todas las políticas para verificar referencias a 'band'
SELECT * FROM pg_policies WHERE schemaname = 'public';

-- Listar todos los triggers para verificar referencias a 'band'
SELECT * FROM pg_trigger WHERE tgrelid IN (
  SELECT oid FROM pg_class 
  WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
);