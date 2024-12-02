import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Group } from '../types';
import Button from '../components/Button';
import { Plus, Users } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { toast } from 'react-hot-toast';
import { safeSupabaseRequest } from '../lib/supabaseUtils';
import CreateGroupModal from '../components/CreateGroupModal';

export default function Dashboard() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      checkAdminRole();
      fetchGroups();
    }
  }, [user]);

  const checkAdminRole = async () => {
    if (!user) return;

    try {
      const response = await safeSupabaseRequest(
        () => supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single(),
        'Error verificando rol de administrador'
      );

      if (response && 'role' in response) {
        setIsAdmin(response.role === 'admin');
      }
    } catch (error) {
      console.error('Error checking admin role:', error);
      toast.error('Error al verificar permisos de administrador');
    }
  };

  const fetchGroups = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      let query;
      
      if (isAdmin) {
        // Si es admin, obtener todos los grupos
        query = supabase
          .from('groups')
          .select('*')
          .order('created_at', { ascending: false });
      } else {
        // Si no es admin, obtener solo los grupos donde es miembro
        const { data: memberGroups } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('user_id', user.id);

        if (!memberGroups) {
          setGroups([]);
          return;
        }

        const groupIds = memberGroups.map(mg => mg.group_id);
        
        if (groupIds.length === 0) {
          setGroups([]);
          return;
        }

        query = supabase
          .from('groups')
          .select('*')
          .in('id', groupIds)
          .order('created_at', { ascending: false });
      }

      const response = await safeSupabaseRequest(
        () => query,
        'Error cargando grupos'
      );

      if (response) {
        setGroups(Array.isArray(response) ? response : []);
      } else {
        setGroups([]);
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast.error('Error al cargar los grupos');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGroupClick = (groupId: string) => {
    navigate(`/group/${groupId}`);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Mis Grupos</h1>
        {isAdmin && (
          <Button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Crear Grupo</span>
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">
          Cargando grupos...
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-8">
          <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">
            {isAdmin 
              ? 'No hay grupos disponibles. ¡Crea uno para empezar!' 
              : 'No perteneces a ningún grupo. Espera a que un administrador te añada a uno.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <div
              key={group.id}
              onClick={() => handleGroupClick(group.id)}
              className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">{group.name}</h3>
                <Users className="w-6 h-6 text-indigo-600" />
              </div>
              <p className="text-sm text-gray-500">
                Haz clic para gestionar miembros e instrumentos
              </p>
            </div>
          ))}
        </div>
      )}

      <CreateGroupModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onGroupCreated={fetchGroups}
        isAdmin={isAdmin}
      />
    </div>
  );
}