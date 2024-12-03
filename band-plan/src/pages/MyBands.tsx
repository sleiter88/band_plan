import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Group } from '../types';
import Button from '../components/Button';
import { Plus, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { safeSupabaseRequest } from '../lib/supabaseUtils';
import { useAuthStore } from '../store/authStore';

interface ExtendedGroup extends Group {
  is_member: boolean;
}

export default function MyBands() {
  const [bands, setBands] = useState<ExtendedGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    fetchBands();
  }, []);

  const fetchBands = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const response = await safeSupabaseRequest(
        () => supabase
          .from('groups')
          .select(`
            *,
            group_members!inner (
              user_id
            )
          `)
          .or(`created_by.eq.${user.id},group_members.user_id.eq.${user.id}`)
          .order('name'),
        'Error cargando bandas'
      );

      if (response) {
        const extendedBands: ExtendedGroup[] = response.map(band => ({
          ...band,
          is_member: band.group_members.some(member => member.user_id === user.id)
        }));
        setBands(extendedBands);
      }
    } finally {
      setLoading(false);
    }
  };

  const createBand = async () => {
    const name = prompt('Nombre de la banda:');
    if (!name) return;

    try {
      const response = await safeSupabaseRequest(
        () => supabase
          .from('groups')
          .insert([{ name }])
          .select()
          .single(),
        'Error creando banda'
      );

      if (response) {
        toast.success('Banda creada exitosamente');
        fetchBands();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Mis Bandas</h1>
        <Button onClick={createBand}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Banda
        </Button>
      </div>

      {loading ? (
        <div className="text-center">Cargando...</div>
      ) : bands.length === 0 ? (
        <div className="text-center text-gray-500">
          No tienes bandas aún. ¡Crea una!
        </div>
      ) : (
        <div className="space-y-8">
          {/* Bandas donde soy miembro */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Bandas donde soy miembro</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bands.filter(band => band.is_member).map((band) => (
                <div
                  key={band.id}
                  className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/bands/${band.id}`)}
                >
                  <div className="flex items-center space-x-3">
                    <Users className="w-8 h-8 text-indigo-500" />
                    <div>
                      <h2 className="font-semibold">{band.name}</h2>
                    </div>
                  </div>
                </div>
              ))}
              {bands.filter(band => band.is_member).length === 0 && (
                <div className="col-span-full text-center text-gray-500">
                  No eres miembro de ninguna banda
                </div>
              )}
            </div>
          </div>

          {/* Bandas que he creado */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Bandas que he creado</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bands.filter(band => band.created_by === user?.id).map((band) => (
                <div
                  key={band.id}
                  className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/bands/${band.id}`)}
                >
                  <div className="flex items-center space-x-3">
                    <Users className="w-8 h-8 text-indigo-500" />
                    <div>
                      <h2 className="font-semibold">{band.name}</h2>
                      {!band.is_member && (
                        <span className="text-sm text-gray-500">(No eres miembro)</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {bands.filter(band => band.created_by === user?.id).length === 0 && (
                <div className="col-span-full text-center text-gray-500">
                  No has creado ninguna banda
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 