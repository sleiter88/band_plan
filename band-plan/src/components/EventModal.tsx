import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Event, BandMember } from '../types';
import Button from './Button';
import Input from './Input';
import { X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { format, isSameDay } from 'date-fns';
import { es as esLocale } from 'date-fns/locale';
import { useAuthStore } from '../store/authStore';
import EventMemberSelector from './EventMemberSelector';
import { safeSupabaseRequest } from '../lib/supabaseUtils';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter an event name');
      return;
    }

    if (!date) {
      toast.error('Please select a date');
      return;
    }

    const missingInstruments = validateMemberSelection();
    if (missingInstruments.size > 0) {
      toast.error(`Missing instruments: ${Array.from(missingInstruments).join(', ')}`);
      return;
    }

    if (!user) {
      toast.error('You must be logged in to create events');
      return;
    }

    setLoading(true);
    try {
      const selectedMemberData = selectedMembers
        .filter(m => m.selected)
        .map(m => ({
          memberId: m.memberId,
          userId: m.userId
        }));

      if (event) {
        try {
          // Actualizar detalles del evento
          await safeSupabaseRequest(
            () => supabase
              .from('events')
              .update({
                name: name.trim(),
                time,
                notes: notes.trim() || null
              })
              .eq('id', event.id),
            'Error al actualizar el evento'
          );

          // Eliminar miembros existentes
          await safeSupabaseRequest(
            () => supabase
              .from('event_members')
              .delete()
              .eq('event_id', event.id),
            'Error al actualizar los miembros del evento'
          );

          // Agregar nuevos miembros
          await safeSupabaseRequest(
            () => supabase
              .from('event_members')
              .insert(
                selectedMemberData.map(member => ({
                  event_id: event.id,
                  band_member_id: member.memberId,
                  user_id: member.userId,
                  created_by: user.id
                }))
              ),
            'Error al agregar los miembros del evento'
          );

          toast.success('¡Evento actualizado correctamente!');
          onEventSaved();
          onClose();
          resetForm();
        } catch (error) {
          console.error('Error al guardar el evento:', error);
        }
      } else {
        // Create new event
        const eventData = await safeSupabaseRequest(
          () => supabase
            .from('events')
            .insert([{
              band_id: bandId,
              name: name.trim(),
              date,
              time,
              notes: notes.trim() || null,
              created_by: user.id
            }])
            .select()
            .single(),
          'Error creating event'
        );

        if (eventData) {
          await safeSupabaseRequest(
            () => supabase
              .from('event_members')
              .insert(
                selectedMemberData.map(member => ({
                  event_id: eventData.id,
                  band_member_id: member.memberId,
                  user_id: member.userId,
                  created_by: user.id
                }))
              ),
            'Error adding event members'
          );

          toast.success('Event created successfully!');
        }
      }

      onEventSaved();
      onClose();
      resetForm();
    } catch (error) {
      console.error('Error saving event:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDate('');
    setTime('');
    setNotes('');
    setSelectedMembers([]);
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
                {availableDates.map((availableDate, index) => {
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