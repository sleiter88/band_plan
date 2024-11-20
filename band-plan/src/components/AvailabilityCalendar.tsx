import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { safeSupabaseRequest } from '../lib/supabaseUtils';
import { useAuthStore } from '../store/authStore';
import { DayPicker } from 'react-day-picker';
import { format, isSameDay } from 'date-fns';
import { toast } from 'react-hot-toast';
import { Calendar, Loader2, ChevronDown, Music, Download } from 'lucide-react';
import 'react-day-picker/dist/style.css';
import { BandMember } from '../types';
import { useParams } from 'react-router-dom';
import { es } from 'date-fns/locale';

interface MemberAvailability {
  userId: string;
  memberName: string;
  dates: Date[];
  instruments: { id: string; name: string; }[];
  roleInBand: 'principal' | 'sustituto';
}

interface MemberEvent {
  event_id: number;
  date: string;
  user_id: string;
  name: string;
  band_id: string;
}

interface AvailabilityCalendarProps {
  members: BandMember[];
  onAvailableDatesChange?: (dates: Date[]) => void;
}

export default function AvailabilityCalendar({ 
  members,
  onAvailableDatesChange 
}: AvailabilityCalendarProps) {
  const { id: bandId } = useParams<{ id: string }>();
  const [availabilities, setAvailabilities] = useState<MemberAvailability[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [bandAvailableDates, setBandAvailableDates] = useState<Date[]>([]);
  const [memberEvents, setMemberEvents] = useState<MemberEvent[]>([]);
  const [bandEvents, setBandEvents] = useState<MemberEvent[]>([]);
  const [memberExternalEvents, setMemberExternalEvents] = useState<{ user_id: string; date: string; }[]>([]);
  const [bandNotAvailableDates, setBandNotAvailableDates] = useState<Date[]>([]);
  const { user } = useAuthStore();

useEffect(() => {
  if (user) {
    checkAdminStatus();
    fetchAllAvailabilities();
    fetchBandEvents();
    fetchMemberEvents(); // Agrega esta línea
    fetchMemberExternalEvents();
  }
}, [user, bandId]);

  useEffect(() => {
    calculateBandAvailability();
  }, [availabilities, memberEvents, bandEvents, memberExternalEvents]);

  useEffect(() => {
    if (onAvailableDatesChange) {
      onAvailableDatesChange(bandAvailableDates);
    }
  }, [bandAvailableDates, onAvailableDatesChange]);

  const checkAdminStatus = async () => {
    const userData = await safeSupabaseRequest(
      () => supabase
        .from('users')
        .select('role')
        .eq('id', user?.id)
        .single(),
      'Error checking admin status'
    );

    if (userData) {
      setIsAdmin(userData.role === 'admin');
    }
  };

  const fetchMemberEvents = async () => {
    const eventsData = await safeSupabaseRequest(
      () => supabase
        .from('events')
        .select(`
          id,
          date,
          name,
          band_id,
          event_members (
            user_id
          )
        `),
      'Error al obtener los eventos'
    );
  
    if (eventsData) {
      const formattedEvents: MemberEvent[] = [];
      eventsData.forEach(event => {
        event.event_members?.forEach(member => {
          formattedEvents.push({
            event_id: event.id,
            date: event.date,
            user_id: member.user_id,
            name: event.name,
            band_id: event.band_id
          });
        });
      });
      setMemberEvents(formattedEvents);
    }
  };
  

  const fetchBandEvents = async () => {
    const eventsData = await safeSupabaseRequest(
      () => supabase
        .from('events')
        .select(`
          id,
          date,
          name,
          band_id
        `)
        .eq('band_id', bandId),
      'Error fetching band events'
    );

    if (eventsData) {
      const formattedEvents: MemberEvent[] = eventsData.map(event => ({
        event_id: event.id,
        date: event.date,
        user_id: '', // Este campo ya no es necesario para mostrar eventos
        name: event.name,
        band_id: event.band_id
      }));
      setBandEvents(formattedEvents);
    }
  };

  const fetchMemberExternalEvents = async () => {
    const eventsData = await safeSupabaseRequest(
      () => supabase
        .from('events')
        .select(`
          date,
          band_id,
          event_members (
            user_id
          )
        `)
        .neq('band_id', bandId),
      'Error fetching member external events'
    );

    if (eventsData) {
      const externalEvents: { user_id: string; date: string; }[] = [];
      eventsData.forEach(event => {
        event.event_members?.forEach(member => {
          externalEvents.push({
            user_id: member.user_id,
            date: event.date,
          });
        });
      });
      setMemberExternalEvents(externalEvents);
    }
  };

  const fetchAllAvailabilities = async () => {
    if (!bandId) return;
    
    setLoading(true);
    try {
      const bandMemberIds = members.filter(m => m.user_id).map(m => m.user_id);

      const availabilityData = await safeSupabaseRequest(
        () => supabase
          .from('member_availability')
          .select('user_id, date')
          .in('user_id', bandMemberIds)
          .order('date'),
        'Error fetching availabilities'
      );

      if (availabilityData) {
        const memberAvailabilities = new Map<string, Date[]>();
        availabilityData.forEach(item => {
          const dates = memberAvailabilities.get(item.user_id) || [];
          dates.push(new Date(item.date));
          memberAvailabilities.set(item.user_id, dates);
        });

        const availArray: MemberAvailability[] = Array.from(memberAvailabilities.entries())
          .map(([userId, dates]) => {
            const member = members.find(m => m.user_id === userId);
            return {
              userId,
              memberName: member?.name || 'Unknown Member',
              dates,
              instruments: member?.instruments || [],
              roleInBand: member?.role_in_band || 'principal'
            };
          });

        setAvailabilities(availArray);
      }
    } finally {
      setLoading(false);
    }
  };

  const isMemberAvailableOnDate = (member: BandMember, date: Date) => {
    // Check if member has any events on this date
    const hasEventOnDate = memberEvents.some(event => 
      event.user_id === member.user_id && 
      isSameDay(new Date(event.date), date)
    );

    if (hasEventOnDate) {
      return false;
    }

    // Check member's availability
    const memberAvailability = availabilities.find(a => 
      a.userId === member.user_id
    );

    return memberAvailability?.dates.some(d => 
      isSameDay(d, date)
    ) ?? false;
  };

  const getEventsForDate = (date: Date) => {
    return bandEvents.filter(event => 
      isSameDay(new Date(event.date), date)
    );
  };

  const calculateBandAvailability = () => {
    // Obtenemos todas las fechas relevantes
    const allDatesSet = new Set<string>();
    
    // Fechas de disponibilidad de los miembros
    availabilities.forEach(member => {
      member.dates.forEach(date => {
        allDatesSet.add(format(date, 'yyyy-MM-dd'));
      });
    });

    // Fechas de eventos externos de los miembros
    memberExternalEvents.forEach(event => {
      allDatesSet.add(format(new Date(event.date), 'yyyy-MM-dd'));
    });

    const allDates = Array.from(allDatesSet).map(dateStr => new Date(dateStr));

    // Miembros principales y sustitutos
    const principalMembers = members.filter(m => m.role_in_band === 'principal');
    const substitutes = members.filter(m => m.role_in_band === 'sustituto');

    const availableDates: Date[] = [];
    const notAvailableDates: Date[] = [];

    allDates.forEach(date => {
      const dateStr = format(date, 'yyyy-MM-dd');

      // Miembros principales no disponibles
      const unavailablePrincipals = principalMembers.filter(principal => {
        const isAvailable = availabilities
          .find(a => a.userId === principal.user_id)
          ?.dates.some(d => isSameDay(d, date)) ?? false;

        const hasExternalEvent = memberExternalEvents.some(event =>
          event.user_id === principal.user_id &&
          isSameDay(new Date(event.date), date)
        );

        return !isAvailable || hasExternalEvent;
      });

      if (unavailablePrincipals.length === 0) {
        // Todos los principales están disponibles
        availableDates.push(date);
      } else {
        // Verificamos si los sustitutos pueden cubrir a los principales no disponibles
        const canBeSubstituted = unavailablePrincipals.every(principal => {
          const requiredInstruments = principal.instruments.map(i => i.id);

          // Sustitutos disponibles en esta fecha
          const availableSubstitutes = substitutes.filter(sub => {
            const isAvailable = availabilities
              .find(a => a.userId === sub.user_id)
              ?.dates.some(d => isSameDay(d, date)) ?? false;

            const hasExternalEvent = memberExternalEvents.some(event =>
              event.user_id === sub.user_id &&
              isSameDay(new Date(event.date), date)
            );

            return isAvailable && !hasExternalEvent;
          });

          // Verificamos si algún sustituto puede cubrir los instrumentos necesarios
          return availableSubstitutes.some(sub => {
            const subInstruments = sub.instruments.map(i => i.id);
            return requiredInstruments.every(instrId => subInstruments.includes(instrId));
          });
        });

        if (canBeSubstituted) {
          // Los sustitutos pueden cubrir a los principales no disponibles
          availableDates.push(date);
        } else {
          // No hay sustitutos disponibles para cubrir a los principales
          notAvailableDates.push(date);
        }
      }
    });

    setBandAvailableDates(availableDates);
    setBandNotAvailableDates(notAvailableDates);
  };

  const canManageOtherMembers = () => {
    const currentMember = members.find(m => m.user_id === user?.id);
    return isAdmin || currentMember?.role_in_band === 'principal';
  };

  const handleDayClick = async (day: Date) => {
    if (!user) return;

    const currentMember = members.find(m => m.user_id === user.id);
    const canManage = isAdmin || 
      currentMember?.role_in_band === 'principal' || 
      user.id === (selectedMemberId || user.id);

    if (!canManage) {
      toast.error('No tienes permisos para gestionar esta disponibilidad');
      return;
    }

    const userId = selectedMemberId || user.id;

    const hasEventOnDate = memberEvents.some(event => 
      event.user_id === userId &&
      isSameDay(new Date(event.date), day)
    );

    if (hasEventOnDate) {
      toast.error('No puedes cambiar tu disponibilidad en fechas con eventos programados');
      return;
    }
    
    setSaving(true);
    try {
      const currentMember = members.find(m => m.user_id === userId);
      if (!currentMember) {
        toast.error('Miembro no encontrado');
        return;
      }
  
      const isSelected = availabilities
        .find(a => a.userId === currentMember.user_id)
        ?.dates.some(d => isSameDay(d, day));
  
      const dateStr = format(day, 'yyyy-MM-dd');
  
      if (isSelected) {
        await safeSupabaseRequest(
          () => supabase
            .from('member_availability')
            .delete()
            .eq('user_id', currentMember.user_id)
            .eq('date', dateStr),
          'Error al actualizar la disponibilidad'
        );

        // Actualizar el estado local sin hacer fetch
        setAvailabilities(prev => prev.map(avail => {
          if (avail.userId === currentMember.user_id) {
            return {
              ...avail,
              dates: avail.dates.filter(d => !isSameDay(d, day))
            };
          }
          return avail;
        }));
      } else {
        await safeSupabaseRequest(
          () => supabase
            .from('member_availability')
            .insert([{ user_id: currentMember.user_id, date: dateStr }]),
          'Error al actualizar la disponibilidad'
        );

        // Actualizar el estado local sin hacer fetch
        setAvailabilities(prev => prev.map(avail => {
          if (avail.userId === currentMember.user_id) {
            return {
              ...avail,
              dates: [...avail.dates, day]
            };
          }
          return avail;
        }));
      }
    } finally {
      setSaving(false);
    }
  };

  const getAvailableMembersForDay = (date: Date) => {
    return members.filter(member => 
      isMemberAvailableOnDate(member, date)
    );
  };

  function getMembersForDay(date: Date) {
    return members.filter(member => {
      const isAvailable = availabilities
        .find(a => a.userId === member.user_id)
        ?.dates.some(d => isSameDay(d, date)) ?? false;

      const hasEvent = bandEvents.some(event => 
        event.user_id === member.user_id && 
        isSameDay(new Date(event.date), date)
      );

      return isAvailable || hasEvent;
    });
  }

  const DayContent = ({ date }: { date: Date }) => {
    const membersForDay = getMembersForDay(date);
    const isCurrentUserInvolved = membersForDay.some(
      m => m.user_id === (selectedMemberId || user?.id)
    );
    const otherMembersCount = membersForDay.filter(
      m => m.user_id !== (selectedMemberId || user?.id)
    ).length;
    const isBandAvailable = bandAvailableDates.some(d => isSameDay(d, date));
    const isBandNotAvailable = bandNotAvailableDates.some(d => isSameDay(d, date));
    const events = getEventsForDate(date);
    const hasEvent = events.length > 0;

    return (
      <div
        className={`day-content ${isBandAvailable ? 'band-available' : ''} ${
          isBandNotAvailable ? 'band-not-available' : ''
        } ${hasEvent ? 'has-event' : ''}`}
      >
        <span>{date.getDate()}</span>
        {(isCurrentUserInvolved || otherMembersCount > 0 || hasEvent) && (
          <>
            <div className="availability-dots">
              {isCurrentUserInvolved && (
                <div className="availability-dot you" />
              )}
              {[...Array(Math.min(otherMembersCount, 3))].map((_, i) => (
                <div key={i} className="availability-dot others" />
              ))}
            </div>
            <div className="day-tooltip">
              <div className="text-sm font-medium text-gray-900 mb-2">
                {format(date, 'MMMM d, yyyy')}
                <div className="flex flex-wrap gap-1 mt-1">
                  {isBandAvailable && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                      Banda Disponible
                    </span>
                  )}
                  {hasEvent && (
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                      {events.length > 1 ? `${events[0].name} y ${events.length - 1} más` : events[0].name}
                    </span>
                  )}
                </div>
              </div>
              {membersForDay.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700">Miembros:</p>
                  {membersForDay.map((member) => {
                    const isAvailable = availabilities
                      .find(a => a.userId === member.user_id)
                      ?.dates.some(d => isSameDay(d, date)) ?? false;

                    const hasExternalEvent = memberExternalEvents.some(event => 
                      event.user_id === member.user_id && 
                      isSameDay(new Date(event.date), date)
                    );

                    return (
                      <div
                        key={member.id}
                        className={`tooltip-member ${
                          member.user_id === (selectedMemberId || user?.id) ? 'you' : 'other'
                        }`}
                      >
                        <div className="flex flex-col">
                          <div className="flex items-center justify-between w-full">
                            <span className="font-medium">{member.name}</span>
                            <div className="flex items-center gap-2">
                              {member.role_in_band === 'sustituto' && (
                                <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full">
                                  Sustituto
                                </span>
                              )}
                              {isAvailable && !hasExternalEvent && (
                                <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full">
                                  Disponible
                                </span>
                              )}
                              {hasExternalEvent && (
                                <span className="text-xs bg-red-100 text-red-800 px-1.5 py-0.5 rounded-full">
                                  Con Evento
                                </span>
                              )}
                              {member.user_id === (selectedMemberId || user?.id) && (
                                <span className="text-xs bg-indigo-200 px-1.5 py-0.5 rounded-full">
                                  Tú
                                </span>
                              )}
                            </div>
                          </div>
                          {member.instruments.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {member.instruments.map((instrument, idx) => (
                                <span
                                  key={`${member.id}-${instrument.id}-${idx}`}
                                  className="inline-flex items-center text-xs text-gray-600"
                                >
                                  <Music className="w-3 h-3 mr-1" />
                                  {instrument.name}
                                  {idx < member.instruments.length - 1 && ", "}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  const downloadAvailabilityDates = () => {
    // Filtrar fechas disponibles sin eventos
    const availableDatesWithoutEvents = bandAvailableDates
      .filter(date => getEventsForDate(date).length === 0)
      .sort((a, b) => a.getTime() - b.getTime());

    // Agrupar fechas por mes
    const datesByMonth = availableDatesWithoutEvents.reduce((acc, date) => {
      const monthKey = format(date, 'MMMM yyyy', { locale: es });
      if (!acc[monthKey]) {
        acc[monthKey] = {
          withPrincipals: [],
          withSubstitutes: []
        };
      }

      const membersForDay = getMembersForDay(date);
      const unavailablePrincipals = members
        .filter(m => m.role_in_band === 'principal')
        .filter(principal => !membersForDay.some(m => m.user_id === principal.user_id));

      if (unavailablePrincipals.length === 0) {
        acc[monthKey].withPrincipals.push(date);
      } else {
        acc[monthKey].withSubstitutes.push(date);
      }

      return acc;
    }, {} as Record<string, { withPrincipals: Date[], withSubstitutes: Date[] }>);

    // Generar el contenido del archivo
    let content = "FECHAS DISPONIBLES DE LA BANDA\n\n";

    if (Object.keys(datesByMonth).length === 0) {
      content += "No hay fechas disponibles sin eventos programados.\n";
    } else {
      Object.entries(datesByMonth).forEach(([month, dates]) => {
        content += `${month.toUpperCase()}\n`;
        
        if (dates.withPrincipals.length > 0) {
          content += "Fechas con miembros principales:\n";
          content += dates.withPrincipals
            .map(date => `${format(date, 'd(EEE)', { locale: es })}`)
            .join(', ');
          content += "\n\n";
        }

        if (dates.withSubstitutes.length > 0) {
          content += "Fechas con sustitutos:\n";
          content += dates.withSubstitutes
            .map(date => `${format(date, 'd(EEE)', { locale: es })}`)
            .join(', ');
          content += "\n\n";
        }
        
        content += "\n";
      });
    }

    // Crear y descargar el archivo
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `disponibilidad_banda_${format(new Date(), 'dd-MM-yyyy')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {(isAdmin || canManageOtherMembers()) && members.length > 0 && (
        <div>
          <label htmlFor="member-select" className="block text-sm font-medium text-gray-700 mb-2">
            Gestionando disponibilidad para:
          </label>
          <div className="relative w-full max-w-xs">
            <select
              id="member-select"
              value={selectedMemberId || user?.id || ''}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md shadow-sm"
            >
              {members.map((member) => (
                <option key={member.id} value={member.user_id}>
                  {member.name} {member.user_id === user?.id ? '(Tú)' : ''}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
              <ChevronDown className="h-4 w-4" />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-center relative bg-white rounded-lg shadow-sm p-4">
        {saving && (
          <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10 rounded-lg">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          </div>
        )}
        <DayPicker
          mode="single"
          selected={selectedDay}
          onSelect={setSelectedDay}
          onDayClick={handleDayClick}
          fromDate={new Date()}
          components={{
            DayContent
          }}
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        <h3 className="font-medium text-gray-900 mb-3">Legend:</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="flex items-center space-x-3 p-2 rounded-lg bg-gray-50">
            <div className="w-4 h-4 rounded-full bg-indigo-600"></div>
            <span className="text-sm text-gray-600">Your availability</span>
          </div>
          <div className="flex items-center space-x-3 p-2 rounded-lg bg-gray-50">
            <div className="w-4 h-4 rounded-full bg-indigo-200"></div>
            <span className="text-sm text-gray-600">Other members</span>
          </div>
          <div className="flex items-center space-x-3 p-2 rounded-lg bg-gray-50">
            <div className="w-4 h-4 rounded-full bg-green-500"></div>
            <span className="text-sm text-gray-600">Band available</span>
          </div>
          <div className="flex items-center space-x-3 p-2 rounded-lg bg-gray-50">
            <div className="w-4 h-4 rounded-full bg-red-500"></div>
            <span className="text-sm text-gray-600">Event scheduled</span>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <button
          onClick={downloadAvailabilityDates}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Download className="w-4 h-4 mr-2" />
          Descargar Fechas Disponibles
        </button>
      </div>
    </div>
  );
}