CREATE OR REPLACE FUNCTION public.get_group_calendar(
  group_id UUID,
  member_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calendar_text TEXT;
  event_record RECORD;
BEGIN
  -- Iniciar el calendario con los headers necesarios
  calendar_text := 'BEGIN:VCALENDAR' || chr(13) || chr(10) ||
                  'VERSION:2.0' || chr(13) || chr(10) ||
                  'PRODID:-//Band Manager//ES' || chr(13) || chr(10);

  -- Obtener todos los eventos donde el miembro está participando
  FOR event_record IN 
    SELECT 
      e.name as event_name,
      e.date as event_date,
      e.time as event_time,
      COALESCE(e.notes, '') as event_notes,
      COALESCE(e.location->>'name', '') as location_name
    FROM events e
    JOIN event_members em ON em.event_id = e.id
    WHERE em.group_member_id = member_id
    AND e.group_id = group_id
    ORDER BY e.date, e.time
  LOOP
    -- Añadir cada evento al calendario
    calendar_text := calendar_text ||
      'BEGIN:VEVENT' || chr(13) || chr(10) ||
      'UID:' || event_record.event_date || '-' || member_id || '@bandmanager.app' || chr(13) || chr(10) ||
      'DTSTAMP:' || to_char(NOW() AT TIME ZONE 'UTC', 'YYYYMMDD"T"HH24MISS"Z"') || chr(13) || chr(10) ||
      'DTSTART:' || to_char(event_record.event_date + event_record.event_time, 'YYYYMMDD"T"HH24MISS') || chr(13) || chr(10) ||
      'SUMMARY:' || event_record.event_name || chr(13) || chr(10);

    -- Añadir ubicación si existe
    IF event_record.location_name != '' THEN
      calendar_text := calendar_text ||
        'LOCATION:' || event_record.location_name || chr(13) || chr(10);
    END IF;

    -- Añadir descripción si existe
    IF event_record.event_notes != '' THEN
      calendar_text := calendar_text ||
        'DESCRIPTION:' || event_record.event_notes || chr(13) || chr(10);
    END IF;

    calendar_text := calendar_text ||
      'END:VEVENT' || chr(13) || chr(10);
  END LOOP;

  -- Cerrar el calendario
  calendar_text := calendar_text || 'END:VCALENDAR' || chr(13) || chr(10);

  RETURN calendar_text;
END;
$$;

-- Dar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.get_group_calendar(UUID, UUID) TO authenticated;