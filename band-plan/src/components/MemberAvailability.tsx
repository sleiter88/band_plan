import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import Button from './Button';
import { X, Calendar } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { DayPicker } from 'react-day-picker';
import { format, isSameDay } from 'date-fns';
import 'react-day-picker/dist/style.css';

interface Availability {
  id: number;
  date: string;
}

interface MemberAvailabilityProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  userId: string | null;
}

export default function MemberAvailability({
  isOpen,
  onClose,
  memberId,
  memberName,
  userId
}: MemberAvailabilityProps) {
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();
  const [selectedDays, setSelectedDays] = useState<Date[]>([]);

  useEffect(() => {
    if (isOpen && userId) {
      fetchAvailabilities();
    }
  }, [isOpen, userId]);

  useEffect(() => {
    if (availabilities.length > 0) {
      const days = availabilities.map(a => new Date(a.date));
      setSelectedDays(days);
    } else {
      setSelectedDays([]);
    }
  }, [availabilities]);

  const fetchAvailabilities = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('member_availability')
        .select('id, date')
        .eq('user_id', userId)
        .order('date');

      if (error) throw error;
      setAvailabilities(data || []);
    } catch (error: any) {
      console.error('Error fetching availabilities:', error);
      toast.error('Failed to load availabilities');
    }
  };

  const handleDayClick = async (day: Date) => {
    if (!user?.id === userId) return;

    const isSelected = selectedDays.some(selectedDay => 
      isSameDay(selectedDay, day)
    );

    if (isSelected) {
      await handleRemoveDate(day);
    } else {
      await handleAddDate(day);
    }
  };

  const handleAddDate = async (day: Date) => {
    if (!user || !userId) return;

    setLoading(true);
    try {
      const dateStr = format(day, 'yyyy-MM-dd');
      const { error } = await supabase
        .from('member_availability')
        .insert([
          {
            user_id: userId,
            date: dateStr
          }
        ]);

      if (error) throw error;
      await fetchAvailabilities();
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('This date is already added');
      } else {
        toast.error('Failed to add date');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveDate = async (day: Date) => {
    try {
      const availability = availabilities.find(a => 
        isSameDay(new Date(a.date), day)
      );
      
      if (!availability) return;

      const { error } = await supabase
        .from('member_availability')
        .delete()
        .eq('id', availability.id);

      if (error) throw error;
      await fetchAvailabilities();
    } catch (error: any) {
      toast.error('Failed to remove date');
    }
  };

  if (!isOpen) return null;

  const canManageAvailability = user?.id === userId;
  const footer = selectedDays.length > 0 && (
    <p className="text-sm text-gray-600 mt-4">
      {selectedDays.length} {selectedDays.length === 1 ? 'date' : 'dates'} selected
    </p>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">
            {memberName}'s Availability
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              Cargando disponibilidad...
            </div>
          ) : (
            <DayPicker
              mode="multiple"
              selected={selectedDays}
              onDayClick={canManageAvailability ? handleDayClick : undefined}
              footer={footer}
              fromDate={new Date()}
              modifiersClassNames={{
                selected: 'bg-indigo-600 text-white hover:bg-indigo-700',
              }}
              disabled={!canManageAvailability}
            />
          )}
        </div>
      </div>
    </div>
  );
}