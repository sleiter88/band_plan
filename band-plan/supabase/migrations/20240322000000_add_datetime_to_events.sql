ALTER TABLE public.events
ADD COLUMN datetime TIMESTAMPTZ;

-- Actualizar los registros existentes
UPDATE public.events
SET datetime = (date + time)::timestamptz; 