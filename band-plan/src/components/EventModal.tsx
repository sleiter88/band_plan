import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Event, BandMember } from '../types';
import Button from './Button';
import Input from './Input';
import { X, MapPin, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { format, isSameDay } from 'date-fns';
import { es as esLocale } from 'date-fns/locale';
import { useAuthStore } from '../store/authStore';
import EventMemberSelector from './EventMemberSelector';
import { safeSupabaseRequest } from '../lib/supabaseUtils';
import { debounce } from 'lodash';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  bandId: string;
  selectedDate?: Date;
  event?: Event;
  onEventSaved: () => void;
  availableDates: Date[];
  members: BandMember[];
}

interface EventMember {
  memberId: string;
  userId: string | null;
  selected: boolean;
  isAvailable: boolean;
}

interface Location {
  display_name: string;
  lat: string;
  lon: string;
}

interface LocationData {
  name: string;
  coordinates: {
    latitude: string;
    longitude: string;
  };
}

// Añadir esta variable fuera del componente
let currentSearchController: AbortController | null = null;

export default function EventModal({
  isOpen,
  onClose,
  bandId,
  selectedDate,
  event,
  onEventSaved,
  availableDates,
  members
}: EventModalProps) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<EventMember[]>([]);
  const [validationError, setValidationError] = useState(false);
  const { user } = useAuthStore();
  const [location, setLocation] = useState('');
  const [locationResults, setLocationResults] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    if (event) {
      setName(event.name);
      setDate(event.date);
      setTime(event.time);
      setNotes(event.notes || '');
      loadEventMembers();
    } else if (selectedDate) {
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      setDate(formattedDate);
      setTime('20:00');
      loadAvailableMembers(formattedDate);
    }
  }, [event, selectedDate]);

  useEffect(() => {
    const fetchEvents = async () => {
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('band_id', bandId);
      
      setEvents(data || []);
    };

    if (isOpen) {
      fetchEvents();
    }
  }, [isOpen, bandId]);

  const loadEventMembers = async () => {
    if (!event) return;

    try {
      // Obtener miembros actuales del evento
      const eventMembers = await safeSupabaseRequest(
        () => supabase
          .from('event_members')
          .select('band_member_id, user_id')
          .eq('event_id', event.id),
        'Error loading event members'
      );

      // Obtener disponibilidades para la fecha del evento
      const availabilityData = await safeSupabaseRequest(
        () => supabase
          .from('member_availability')
          .select('user_id')
          .eq('date', event.date),
        'Error loading member availability'
      );

      // Obtener eventos externos para la fecha
      const externalEventsData = await safeSupabaseRequest(
        () => supabase
          .from('events')
          .select(`
            date,
            event_members (
              user_id
            )
          `)
          .neq('band_id', bandId)
          .eq('date', event.date),
        'Error loading external events'
      );

      if (eventMembers) {
        const availableUserIds = new Set(availabilityData?.map(a => a.user_id) || []);
        const busyMembers = new Set<string>();
        
        externalEventsData?.forEach(event => {
          event.event_members?.forEach(member => {
            busyMembers.add(member.user_id);
          });
        });

        const selectedMemberIds = new Set(eventMembers.map(em => em.band_member_id));

        // Crear lista de miembros con su disponibilidad y estado de selección
        const membersList = members.map(member => ({
          memberId: member.id,
          userId: member.user_id,
          selected: selectedMemberIds.has(member.id),
          isAvailable: selectedMemberIds.has(member.id) || (
            member.user_id ? (
              availableUserIds.has(member.user_id) && !busyMembers.has(member.user_id)
            ) : true
          )
        }));

        setSelectedMembers(membersList);
      }
    } catch (error) {
      console.error('Error loading event members:', error);
    }
  };

  const loadAvailableMembers = async (selectedDate: string, preSelectedMemberIds?: string[]) => {
    try {
      // Fetch external events for all members
      const externalEventsData = await safeSupabaseRequest(
        () => supabase
          .from('events')
          .select(`
            date,
            event_members (
              user_id
            )
          `)
          .neq('band_id', bandId)
          .eq('date', selectedDate),
        'Error loading external events'
      );

      const busyMembers = new Set<string>();
      externalEventsData?.forEach(event => {
        event.event_members?.forEach(member => {
          busyMembers.add(member.user_id);
        });
      });

      // Fetch availability for the selected date
      const availabilityData = await safeSupabaseRequest(
        () => supabase
          .from('member_availability')
          .select('user_id')
          .eq('date', selectedDate),
        'Error loading member availability'
      );

      const availableUserIds = new Set(availabilityData?.map(a => a.user_id) || []);

      // Create the list of members with their availability status
      const membersList = members.map(member => {
        const isAvailable = member.user_id ? (
          availableUserIds.has(member.user_id) && !busyMembers.has(member.user_id)
        ) : true;

        return {
          memberId: member.id,
          userId: member.user_id,
          // Only select if it's a preselected member OR (it's a principal member AND is available)
          selected: preSelectedMemberIds ? 
            preSelectedMemberIds.includes(member.id) : 
            (member.role_in_band === 'principal' && isAvailable),
          isAvailable
        };
      });

      setSelectedMembers(membersList);
    } catch (error) {
      console.error('Error loading available members:', error);
    }
  };

  const getAvailableMembersForDate = (selectedDate: string) => {
    const dateObj = new Date(selectedDate);
    return members.filter(member => 
      availableDates.some(d => isSameDay(d, dateObj))
    );
  };

  useEffect(() => {
    validateMemberSelection();
  }, [selectedMembers]);

  const validateMemberSelection = () => {
    const principalMembers = members.filter(m => m.role_in_band === 'principal');
    const selectedMemberIds = selectedMembers.filter(m => m.selected).map(m => m.memberId);
    
    const missingInstruments = new Set<string>();
    
    principalMembers.forEach(principal => {
      if (!selectedMemberIds.includes(principal.id)) {
        principal.instruments.forEach(instrument => {
          const isCovered = selectedMembers
            .filter(m => m.selected)
            .some(m => {
              const member = members.find(mem => mem.id === m.memberId);
              return member?.instruments.some(i => i.id === instrument.id);
            });
          
          if (!isCovered) {
            missingInstruments.add(instrument.name);
          }
        });
      }
    });

    setValidationError(missingInstruments.size > 0);
    return missingInstruments;
  };

  const handleMemberSelectionChange = (memberId: string, selected: boolean) => {
    setSelectedMembers(prev => prev.map(m => 
      m.memberId === memberId ? { ...m, selected } : m
    ));
  };

  const searchLocations = async (query: string) => {
    if (!query.trim()) {
      setLocationResults([]);
      return;
    }

    if (currentSearchController) {
      currentSearchController.abort();
    }

    currentSearchController = new AbortController();
    
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` + 
        `format=json` +
        `&q=${encodeURIComponent(query)}` +
        `&countrycodes=es` + // Limitar a España
        `&bounded=1` +
        `&viewbox=-9.38,43.45,3.35,36.00` + // Bounding box de España
        `&limit=5`,
        { signal: currentSearchController.signal }
      );
      const data = await response.json();
      
      // Ordenar resultados priorizando lugares en España
      const sortedData = data.sort((a: Location, b: Location) => {
        // Priorizar resultados que contengan "Madrid" o "España"
        const aIsLocal = (a.display_name.toLowerCase().includes('madrid') || 
                         a.display_name.toLowerCase().includes('españa'));
        const bIsLocal = (b.display_name.toLowerCase().includes('madrid') || 
                         b.display_name.toLowerCase().includes('españa'));
        
        if (aIsLocal && !bIsLocal) return -1;
        if (!aIsLocal && bIsLocal) return 1;
        return 0;
      });

      setLocationResults(sortedData);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error searching locations:', error);
        toast.error('Error al buscar ubicaciones');
      }
    } finally {
      setIsSearching(false);
      currentSearchController = null;
    }
  };

  // Limpiar el controlador cuando el componente se desmonte
  useEffect(() => {
    return () => {
      if (currentSearchController) {
        currentSearchController.abort();
      }
    };
  }, []);

  const debouncedSearch = React.useCallback(
    debounce((query: string) => {
      searchLocations(query);
    }, 300), // Reducido a 300ms para una respuesta más rápida
    []
  );

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocation(value);
    setLocationResults([]); // Limpiar resultados anteriores inmediatamente
    
    if (!value.trim()) {
      setLocationResults([]);
      return;
    }
    
    debouncedSearch(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !date) {
      toast.error('Por favor completa los campos requeridos');
      return;
    }

    try {
      const locationData = selectedLocation ? {
        name: selectedLocation.display_name,
        coordinates: {
          latitude: selectedLocation.lat,
          longitude: selectedLocation.lon
        }
      } : null;

      const eventData = {
        band_id: bandId,
        name: name.trim(),
        date,
        time,
        notes: notes.trim() || null,
        created_by: user.id,
        location: locationData,
      };

      let result;
      
      if (event) {
        // Actualizar evento existente
        result = await supabase
          .from('events')
          .update(eventData)
          .eq('id', event.id)
          .select();
      } else {
        // Crear nuevo evento
        result = await supabase
          .from('events')
          .insert([eventData])
          .select();
      }

      const { data, error } = result;

      if (error) {
        throw error;
      }

      onClose();
      toast.success(event ? 'Evento actualizado exitosamente' : 'Evento creado exitosamente');
      if (onEventSaved) onEventSaved();
    } catch (error) {
      console.error('Error saving event:', error);
      toast.error(event ? 'Error al actualizar el evento' : 'Error al crear el evento');
    }
  };

  const resetForm = () => {
    setName('');
    setDate('');
    setTime('');
    setNotes('');
    setSelectedMembers([]);
  };

  const sortAndFilterDates = (dates: Date[]) => {
    // Convertir las fechas disponibles a strings para comparación más fácil
    const availableDatesSet = new Set(availableDates.map(d => format(d, 'yyyy-MM-dd')));
    
    // Obtener las fechas que ya tienen eventos
    const existingEventDates = new Set(
      events.map(event => format(new Date(event.date), 'yyyy-MM-dd'))
    );
    
    return dates
      // Filtramos solo las fechas que están en availableDatesSet Y NO tienen eventos
      .filter(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return availableDatesSet.has(dateStr) && !existingEventDates.has(dateStr);
      })
      // Ordenamos las fechas de manera ascendente
      .sort((a, b) => a.getTime() - b.getTime());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex justify-between items-center p-4 border-b z-10">
          <h2 className="text-xl font-semibold">
            {event ? 'Edit Event' : 'Create Event'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Event Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Enter event name"
            />
            <Input
              label="Time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
            />
          </div>

          {!event && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Event Date
              </label>
              <select
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  loadAvailableMembers(e.target.value);
                }}
                className="w-full border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 p-2"
              >
                <option value="" disabled>Select a date</option>
                {sortAndFilterDates(availableDates).map((availableDate, index) => {
                  const formattedDate = format(availableDate, 'yyyy-MM-dd');
                  return (
                    <option key={index} value={formattedDate}>
                      {format(availableDate, 'EEEE, d MMMM yyyy', { locale: esLocale })}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {event && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <span className="text-sm text-gray-600">
                Event date: {format(new Date(event.date), 'EEEE, d MMMM yyyy', { locale: esLocale })}
              </span>
            </div>
          )}

          {date && (
            <EventMemberSelector
              members={members}
              selectedMembers={selectedMembers}
              onMemberSelectionChange={handleMemberSelectionChange}
              validationError={validationError}
            />
          )}

          <div className="relative space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Ubicación
            </label>
            
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MapPin className="h-5 w-5 text-gray-400" />
              </div>
              
              <Input
                value={location}
                onChange={handleLocationChange}
                className="pl-10 pr-10"
                placeholder="Buscar ubicación..."
              />
              
              {location && (
                <button
                  type="button"
                  onClick={() => {
                    setLocation('');
                    setSelectedLocation(null);
                    setLocationResults([]);
                  }}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>

            {isSearching && (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            {locationResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                {locationResults.map((result, index) => (
                  <button
                    key={index}
                    type="button"
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors duration-150 flex items-start gap-3 border-b border-gray-100 last:border-0"
                    onClick={() => {
                      setSelectedLocation(result);
                      setLocation(result.display_name);
                      setLocationResults([]);
                    }}
                  >
                    <MapPin className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="block text-sm font-medium text-gray-900">
                        {result.display_name.split(',')[0]}
                      </span>
                      <span className="block text-xs text-gray-500 mt-0.5">
                        {result.display_name.split(',').slice(1).join(',').trim()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedLocation && (
              <div className="mt-3 p-4 bg-primary/5 rounded-lg border border-primary/10">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="block text-sm font-medium text-gray-900">
                      Ubicación seleccionada
                    </span>
                    <span className="block text-sm text-gray-500 mt-1">
                      {selectedLocation.display_name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLocation(null);
                      setLocation('');
                    }}
                    className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              rows={2}
              placeholder="Add additional notes..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={loading}
              disabled={!date || validationError}
            >
              {event ? 'Save Changes' : 'Create Event'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}