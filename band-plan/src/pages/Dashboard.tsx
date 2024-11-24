import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { Group } from '../types';
import Button from '../components/Button';
import { Plus, Users } from 'lucide-react';
import CreateGroupModal from '../components/CreateGroupModal';

export default function Dashboard() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchGroups();
    if (user) {
      checkAdminRole();
    }
  }, [user]);

  const checkAdminRole = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      setIsAdmin(data.role === 'admin');
    } catch (error) {
      console.error('Error checking admin role:', error);
    }
  };

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*');

      if (error) throw error;
      setGroups(data || []);
    } catch (error: any) {
      console.error('Error fetching groups:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGroupClick = (groupId: number) => {
    navigate(`/group/${groupId}`);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Groups</h1>
        {isAdmin && (
          <Button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Create Group</span>
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center">Loading groups...</div>
      ) : groups.length === 0 ? (
        <div className="text-center text-gray-500">
          No groups available. {isAdmin ? 'Create one to get started!' : 'Please wait for an admin to create one.'}
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
                Click to manage group members and instruments
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