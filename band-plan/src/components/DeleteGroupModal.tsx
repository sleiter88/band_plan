import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import Button from './Button';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

interface DeleteGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupDeleted: () => void;
  group: {
    id: string;
    name: string;
  };
}

const DeleteGroupModal = ({
  isOpen,
  onClose,
  onGroupDeleted,
  group,
}: DeleteGroupModalProps) => {
  const [confirmationName, setConfirmationName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmationName !== group.name) {
      toast.error('El nombre del grupo no coincide');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', group.id);

      if (error) throw error;

      toast.success('Grupo eliminado exitosamente');
      onGroupDeleted();
      onClose();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al eliminar el grupo');
    } finally {
      setLoading(false);
      setConfirmationName('');
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="fixed inset-0 z-10 overflow-y-auto"
    >
      <div className="flex min-h-screen items-center justify-center">
        <div className="fixed inset-0 bg-black opacity-30" />

        <div className="relative bg-white rounded-lg w-full max-w-md p-6 mx-4">
          <div className="absolute right-4 top-4">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <Dialog.Title className="text-xl font-semibold text-red-600 mb-4">
            Eliminar Grupo
          </Dialog.Title>

          <div className="mb-4">
            <p className="text-gray-700 mb-4">
              Esta acción no se puede deshacer. Para confirmar, escribe el nombre del grupo:
              <span className="font-semibold"> {group.name}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <input
                type="text"
                value={confirmationName}
                onChange={(e) => setConfirmationName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                placeholder="Escribe el nombre del grupo"
                required
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                loading={loading}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
                disabled={confirmationName !== group.name}
              >
                Eliminar Grupo
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Dialog>
  );
};

export default DeleteGroupModal; 