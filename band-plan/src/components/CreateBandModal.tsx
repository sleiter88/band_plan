import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import Button from './Button';
import Input from './Input';
import { X } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface CreateBandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBandCreated: () => void;
  isAdmin: boolean;
}

export default function CreateBandModal({ isOpen, onClose, onBandCreated, isAdmin }: CreateBandModalProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin) {
      toast.error('Only administrators can create bands');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('bands')
        .insert([
          {
            name,
            created_by: user.id
          }
        ]);

      if (error) throw error;

      toast.success('Band created successfully!');
      onBandCreated();
      onClose();
      setName('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create band');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">Create New Band</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="Band Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Enter band name"
          />

          <div className="flex justify-end space-x-3">
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
            >
              Create Band
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}