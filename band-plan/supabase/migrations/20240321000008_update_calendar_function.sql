CREATE OR REPLACE FUNCTION public.get_group_calendar(
  p_group_id UUID,
  p_member_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calendar_text TEXT;
  event_record RECORD;
  group_name TEXT;
BEGIN
  -- Obtener el nombre del grupo
  SELECT name INTO group_name
  FROM groups
  WHERE id = p_group_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Grupo no encontrado';
  END IF;

  -- Validar que el miembro pertenece al grupo
  IF NOT EXISTS (
    SELECT 1 
    FROM group_members 
    WHERE id = p_member_id 
    AND group_id = p_group_id
  ) THEN
    RAISE EXCEPTION 'Member does not belong to this group';
  END IF;

  -- Iniciar el calendario con los headers necesarios y el nombre del grupo
  calendar_text := 'BEGIN:VCALENDAR' || chr(13) || chr(10) ||
                  'VERSION:2.0' || chr(13) || chr(10) ||
                  'PRODID:-//Band Manager//ES' || chr(13) || chr(10) ||
                  'X-WR-CALNAME:' || group_name || chr(13) || chr(10) ||
                  'NAME:' || group_name || chr(13) || chr(10);

  -- El resto de la función permanece igual...
  FOR event_record IN 
    SELECT 
      e.name as event_name,
      e.date as event_date,
      e.time as event_time,
      COALESCE(e.notes, '') as event_notes,
      COALESCE(e.location->>'name', '') as location_name
    FROM events e
    JOIN event_members em ON em.event_id = e.id
    WHERE em.group_member_id = p_member_id
    AND e.group_id = p_group_id
    ORDER BY e.date, e.time
  LOOP
    calendar_text := calendar_text ||
      'BEGIN:VEVENT' || chr(13) || chr(10) ||
      'UID:' || event_record.event_date || '-' || p_member_id || '@bandmanager.app' || chr(13) || chr(10) ||
      'DTSTAMP:' || to_char(NOW() AT TIME ZONE 'UTC', 'YYYYMMDD"T"HH24MISS"Z"') || chr(13) || chr(10) ||
      'DTSTART:' || to_char(event_record.event_date + event_record.event_time, 'YYYYMMDD"T"HH24MISS') || chr(13) || chr(10) ||
      'SUMMARY:' || event_record.event_name || chr(13) || chr(10);

    IF event_record.location_name != '' THEN
      calendar_text := calendar_text ||
        'LOCATION:' || event_record.location_name || chr(13) || chr(10);
    END IF;

    IF event_record.event_notes != '' THEN
      calendar_text := calendar_text ||
        'DESCRIPTION:' || event_record.event_notes || chr(13) || chr(10);
    END IF;

    calendar_text := calendar_text ||
      'END:VEVENT' || chr(13) || chr(10);
  END LOOP;

  calendar_text := calendar_text || 'END:VCALENDAR' || chr(13) || chr(10);

  RETURN calendar_text;
END;
$$; 