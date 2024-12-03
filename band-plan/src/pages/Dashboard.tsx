import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Group, User } from '../types';
import Button from '../components/Button';
import { Plus, Users, Trash2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { toast } from 'react-hot-toast';
import CreateGroupModal from '../components/CreateGroupModal';
import DeleteGroupModal from '../components/DeleteGroupModal';

interface GroupWithRole extends Group {
  userRole: 'creator' | 'member' | 'none';
}

export default function Dashboard() {
  const [groups, setGroups] = useState<GroupWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchGroups();
      checkAdminStatus();
    }
  }, [user]);

  const fetchGroups = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Si es admin, obtenemos todos los grupos directamente
      if (isAdmin) {
        const { data: groupsData, error: groupsError } = await supabase
          .from('groups')
          .select('*')
          .order('created_at', { ascending: false });

        if (groupsError) throw groupsError;

        // Para admin, necesitamos saber también donde es miembro
        const { data: memberGroups, error: memberError } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('user_id', user.id);

        if (memberError) throw memberError;

        const memberGroupIds = new Set(memberGroups?.map(g => g.group_id) || []);

        const groupsWithRole = (groupsData || []).map(group => ({
          ...group,
          userRole: group.created_by === user.id 
            ? 'creator' 
            : memberGroupIds.has(group.id)
              ? 'member'
              : 'none'
        }));

        setGroups(groupsWithRole);
        return;
      }

      // Para usuarios normales, mantenemos la lógica actual
      const { data: memberGroups, error: memberError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      const memberGroupIds = new Set(memberGroups?.map(g => g.group_id) || []);

      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('*')
        .or(`created_by.eq.${user.id},id.in.(${Array.from(memberGroupIds).join(',')})`)
        .order('created_at', { ascending: false });

      if (groupsError) throw groupsError;

      const groupsWithRole = (groupsData || []).map(group => ({
        ...group,
        userRole: group.created_by === user.id 
          ? 'creator' 
          : memberGroupIds.has(group.id)
            ? 'member'
            : 'none'
      }));

      setGroups(groupsWithRole);
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast.error('Error al cargar los grupos');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const checkAdminStatus = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setIsAdmin(data?.role === 'admin');
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const handleGroupClick = (groupId: string) => {
    navigate(`/group/${groupId}`);
  };

  const handleDeleteClick = (e: React.MouseEvent, group: Group) => {
    e.stopPropagation(); // Evita que se active el onClick del contenedor
    setSelectedGroup(group);
    setIsDeleteModalOpen(true);
  };

  // Función auxiliar para agrupar los grupos por rol
  const groupedGroups = () => {
    const created = groups.filter(g => g.userRole === 'creator');
    const member = groups.filter(g => g.userRole === 'member');
    const other = isAdmin ? groups.filter(g => g.userRole === 'none') : [];
    
    return { created, member, other };
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Mis Grupos</h1>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Crear Grupo</span>
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">
          Cargando grupos...
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-8">
          <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">
            No tienes grupos disponibles. ¡Crea uno para empezar!
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Grupos creados */}
          {groupedGroups().created.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Grupos que administras
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groupedGroups().created.map((group) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    user={user}
                    isAdmin={isAdmin}
                    onDelete={handleDeleteClick}
                    onClick={() => handleGroupClick(group.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Grupos donde es miembro */}
          {groupedGroups().member.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Grupos donde participas
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groupedGroups().member.map((group) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    user={user}
                    isAdmin={isAdmin}
                    onDelete={handleDeleteClick}
                    onClick={() => handleGroupClick(group.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Otros grupos (solo para admin) */}
          {isAdmin && groupedGroups().other.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Todos los grupos
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groupedGroups().other.map((group) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    user={user}
                    isAdmin={isAdmin}
                    onDelete={handleDeleteClick}
                    onClick={() => handleGroupClick(group.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <CreateGroupModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onGroupCreated={fetchGroups}
        isAdmin={isAdmin}
      />

      {selectedGroup && (
        <DeleteGroupModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedGroup(null);
          }}
          onGroupDeleted={fetchGroups}
          group={selectedGroup}
        />
      )}
    </div>
  );
}

// Componente para la tarjeta de grupo
interface GroupCardProps {
  group: GroupWithRole;
  user: User | null;
  isAdmin: boolean;
  onDelete: (e: React.MouseEvent, group: Group) => void;
  onClick: () => void;
}

const GroupCard = ({ group, user, isAdmin, onDelete, onClick }: GroupCardProps) => {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-gray-900">{group.name}</h3>
        <div className="flex items-center gap-2">
          <Users className="w-6 h-6 text-indigo-600" />
          {(isAdmin || group.created_by === user?.id) && (
            <button
              onClick={(e) => onDelete(e, group)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-full"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-sm px-2 py-1 rounded-full ${
          group.userRole === 'creator' 
            ? 'bg-indigo-100 text-indigo-700'
            : group.userRole === 'member'
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-700'
        }`}>
          {group.userRole === 'creator' 
            ? 'Creador' 
            : group.userRole === 'member' 
              ? 'Miembro' 
              : 'Grupo'}
        </span>
      </div>
    </div>
  );
};