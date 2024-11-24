import { supabase } from '../lib/supabase';

export async function updateBandCalendar(bandId: string, memberId: string) {
  try {
    const { data: calendarData, error: calendarError } = await supabase
      .rpc('get_band_calendar', {
        p_band_id: bandId,
        p_member_id: memberId
      });

    if (calendarError) throw calendarError;
    if (!calendarData) throw new Error('No se pudo generar el calendario');

    const finalCalendarData = calendarData.endsWith('\r\n') 
      ? calendarData 
      : calendarData + '\r\n';

    const fileName = 'calendar.ics';

    const calendarBlob = new Blob([finalCalendarData], { 
      type: 'text/calendar;charset=utf-8' 
    });
    
    const calendarFile = new File([calendarBlob], fileName, { 
      type: 'text/calendar;charset=utf-8'
    });

    const { error: uploadError } = await supabase
      .storage
      .from('calendars')
      .upload(`${bandId}/${memberId}/${fileName}`, calendarFile, {
        cacheControl: '0',
        upsert: true,
        contentType: 'text/calendar;charset=utf-8'
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase
      .storage
      .from('calendars')
      .getPublicUrl(`${bandId}/${memberId}/${fileName}`);

    const urlWithCache = `${publicUrl}?v=${Date.now()}`;

    const { error: updateError } = await supabase
      .from('band_members')
      .update({ 
        calendar_url: urlWithCache,
        calendar_updated_at: new Date().toISOString()
      })
      .eq('id', memberId);

    if (updateError) throw updateError;

  } catch (error) {
    console.error('Error updating calendar:', error);
    throw error;
  }
} 