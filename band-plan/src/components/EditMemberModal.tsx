import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Button from './Button';
import Input from './Input';
import { X, Music } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { BandMember, Instrument } from '../types';
import { useAuthStore } from '../store/authStore';

interface EditMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: BandMember & { instruments: { id: string; name: string; }[] };
  instruments: Instrument[];
  onMemberUpdated: () => void;
  userRole: 'admin' | 'user' | null;
}

export default function EditMemberModal({
  isOpen,
  onClose,
  member,
  instruments: availableInstruments,
  onMemberUpdated,
  userRole
}: EditMemberModalProps) {
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState(member.role_in_band);
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    if (member) {
      setName(member.name);
      setRole(member.role_in_band);
      setSelectedInstruments(member.instruments.map(i => i.id));
    }
  }, [member]);

  if (!isOpen || !user) return null;

  const canEdit = userRole === 'admin' || member.user_id === user.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      toast.error('You do not have permission to edit this member');
      return;
    }

    if (!name.trim()) {
      toast.error('Please enter a member name');
      return;
    }

    if (selectedInstruments.length === 0) {
      toast.error('Please select at least one instrument');
      return;
    }

    setLoading(true);

    try {
      // Update member details
      const { error: updateError } = await supabase
        .from('band_members')
        .update({
          name: name.trim(),
          role_in_band: role
        })
        .eq('id', member.id);

      if (updateError) throw updateError;

      // Remove all existing instrument associations
      const { error: deleteError } = await supabase
        .from('band_member_instruments')
        .delete()
        .eq('band_member_id', member.id);

      if (deleteError) throw deleteError;

      // Add new instrument associations
      const { error: insertError } = await supabase
        .from('band_member_instruments')
        .insert(
          selectedInstruments.map(instrumentId => ({
            band_member_id: member.id,
            instrument_id: instrumentId,
            created_by: user.id
          }))
        );

      if (insertError) throw insertError;

      toast.success('Member updated successfully!');
      onMemberUpdated();
      onClose();
    } catch (error: any) {
      console.error('Error updating member:', error);
      toast.error(error.message || 'Failed to update member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">Edit Member</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Enter member name"
            disabled={!canEdit}
          />

          {userRole === 'admin' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'principal' | 'sustituto')}
                className="w-full border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                disabled={!canEdit}
              >
                <option value="principal">Principal</option>
                <option value="sustituto">Sustituto</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Instruments
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
              {availableInstruments.map((instrument) => (
                <label key={instrument.id} className="flex items-center space-x-2 hover:bg-gray-50 p-1 rounded">
                  <input
                    type="checkbox"
                    checked={selectedInstruments.includes(instrument.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedInstruments([...selectedInstruments, instrument.id]);
                      } else {
                        setSelectedInstruments(selectedInstruments.filter(id => id !== instrument.id));
                      }
                    }}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    disabled={!canEdit}
                  />
                  <span className="flex items-center">
                    <Music className="w-3 h-3 mr-1" />
                    {instrument.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
            >
              Cancel
            </Button>
            {canEdit && (
              <Button
                type="submit"
                loading={loading}
              >
                Save Changes
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}