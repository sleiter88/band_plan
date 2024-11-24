import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Event, BandMember } from '../types';
import { Calendar, Clock, Trash2, Edit2, Users, MapPin } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'react-hot-toast';
import Button from './Button';
import EventModal from './EventModal';
import { safeSupabaseRequest } from '../lib/supabaseUtils';
import { updateBandCalendar } from '../utils/calendarSync';

interface EventsListProps {
  bandId: string;
  canManageEvents: boolean;
  availableDates: Date[];
  members: BandMember[];
}

interface EventMember {
  band_member_id: string;
  user_id: string | null;
  member_name: string;
  role_in_band: string;
}

interface EventWithMembers extends Event {
  members: EventMember[];
}

export default function EventsList({
  bandId,
  canManageEvents,
  availableDates,
  members,
}: EventsListProps) {
  const [events, setEvents] = useState<EventWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, [bandId]);

  const fetchEvents = async () => {
    try {
      const eventsData = await safeSupabaseRequest(
        () =>
          supabase
            .from('events')
            .select('*')
            .eq('band_id', bandId)
            .order('date')
            .order('time'),
        'Error loading events'
      );

      if (eventsData) {
        const eventsWithMembers = await Promise.all(
          eventsData.map(async (event) => {
            const eventMembers = await safeSupabaseRequest(
              () =>
                supabase
                  .from('event_members')
                  .select('band_member_id, user_id')
                  .eq('event_id', event.id),
              'Error loading event members'
            );

            const mappedMembers: EventMember[] =
              eventMembers?.map((em) => {
                const member = members.find((m) => m.id === em.band_member_id);
                return {
                  band_member_id: em.band_member_id,
                  user_id: em.user_id,
                  member_name: member?.name || 'Unknown Member',
                  role_in_band: member?.role_in_band || 'principal',
                };
              }) || [];

            return {
              ...event,
              members: mappedMembers,
            };
          })
        );

        setEvents(eventsWithMembers);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (eventId: number) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este evento?')) {
      return;
    }

    try {
      // Primero obtenemos los miembros del evento antes de eliminarlo
      const { data: eventMembers, error: membersError } = await supabase
        .from('event_members')
        .select('band_member_id, user_id')
        .eq('event_id', eventId);

      if (membersError) throw membersError;

      // Eliminamos el evento y sus relaciones
      const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (deleteError) throw deleteError;

      // Actualizamos los calendarios de todos los miembros afectados
      if (eventMembers && eventMembers.length > 0) {
        console.log('Actualizando calendarios después de eliminar evento');
        await Promise.all(
          eventMembers.map(async (member) => {
            try {
              await updateBandCalendar(bandId, member.band_member_id);
              console.log('Calendario actualizado para miembro:', member.band_member_id);
            } catch (error) {
              console.error('Error actualizando calendario para miembro:', member.band_member_id, error);
            }
          })
        );
      }

      toast.success('Evento eliminado correctamente');
      fetchEvents(); // Recargar la lista de eventos
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Error al eliminar el evento');
    }
  };

  const handleEdit = (event: Event) => {
    setSelectedEvent(event);
    setIsEditModalOpen(true);
  };

  if (loading) {
    return <div className="text-center py-4">Cargando eventos...</div>;
  }

  const groupEventsByMonth = () => {
    const grouped = events.reduce((acc, event) => {
      const monthYear = format(parseISO(event.date), 'MMMM yyyy');
      if (!acc[monthYear]) {
        acc[monthYear] = [];
      }
      acc[monthYear].push(event);
      return acc;
    }, {} as Record<string, EventWithMembers[]>);

    return Object.entries(grouped);
  };

  const renderEventMembers = (event: EventWithMembers) => {
    const principalMembers = event.members.filter(m => m.role_in_band === 'principal');
    const substituteMembers = event.members.filter(m => m.role_in_band === 'sustituto');

    return (
      <div className="mt-1.5 space-y-1">
        {/* Miembros Principales */}
        <div className="flex flex-wrap gap-1">
          {principalMembers.map((member) => (
            <span
              key={member.band_member_id}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700"
            >
              {member.member_name}
            </span>
          ))}
        </div>

        {/* Sustitutos */}
        {substituteMembers.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-xs text-gray-500 mr-1">Sustitutos:</span>
            {substituteMembers.map((member) => (
              <span
                key={member.band_member_id}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-50 text-yellow-700"
              >
                {member.member_name}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  const truncateLocation = (location: string, maxLength: number = 15) => {
    return location.length > maxLength 
      ? `${location.slice(0, maxLength)}...` 
      : location;
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">Eventos</h2>
            {canManageEvents && (
              <Button onClick={() => setIsAddModalOpen(true)}>
                Añadir Evento
              </Button>
            )}
          </div>

          {events.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>No hay eventos programados</p>
            </div>
          ) : (
            <div className="mt-4 space-y-6">
              {groupEventsByMonth().map(([monthYear, monthEvents]) => (
                <div key={monthYear} className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                    {monthYear}
                  </h3>
                  <div className="space-y-1">
                    {monthEvents.map((event) => (
                      <div
                        key={event.id}
                        className="bg-white rounded-lg shadow-sm border border-gray-100 hover:border-gray-200 transition-colors"
                      >
                        <div className="p-3">
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-3">
                                <div className="flex-shrink-0 w-12 text-center">
                                  <div className="text-lg font-bold text-gray-900">
                                    {format(parseISO(event.date), 'd')}
                                  </div>
                                  <div className="text-xs text-gray-500 uppercase">
                                    {format(parseISO(event.date), 'EEE')}
                                  </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h3 className="text-sm font-medium text-gray-900 truncate">
                                    {event.name}
                                  </h3>
                                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                    <div className="flex items-center">
                                      <Clock className="w-3 h-3 mr-1" />
                                      {format(
                                        parseISO(`2000-01-01T${event.time}`),
                                        'h:mm a'
                                      )}
                                    </div>
                                    <div className="flex items-center">
                                      <Users className="w-3 h-3 mr-1" />
                                      {event.members.length}
                                    </div>
                                    {event.location && (
                                      <div className="flex items-center">
                                        <MapPin className="w-3 h-3 mr-1" />
                                        {truncateLocation(event.location.name)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {renderEventMembers(event)}
                              {event.notes && (
                                <p className="mt-1 text-xs text-gray-500 line-clamp-1">
                                  {event.notes}
                                </p>
                              )}
                            </div>
                            {canManageEvents && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleEdit(event)}
                                  className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                                  title="Editar evento"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(event.id)}
                                  className="p-1 text-red-400 hover:text-red-600 rounded-full hover:bg-red-50"
                                  title="Eliminar evento"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <EventModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        bandId={bandId}
        onEventSaved={() => {
          fetchEvents();
          setIsAddModalOpen(false);
        }}
        availableDates={availableDates}
        members={members}
      />

      {selectedEvent && (
        <EventModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedEvent(null);
          }}
          bandId={bandId}
          event={selectedEvent}
          onEventSaved={() => {
            fetchEvents();
            setIsEditModalOpen(false);
            setSelectedEvent(null);
          }}
          availableDates={[...availableDates, parseISO(selectedEvent.date)]}
          members={members}
        />
      )}
    </div>
  );
}
