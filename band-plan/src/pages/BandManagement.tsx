import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Band, BandMember, Instrument } from '../types';
import Button from '../components/Button';
import { Plus, Music, User, Edit2, Calendar, Loader2, Trash2 } from 'lucide-react';
import AddMemberModal from '../components/AddMemberModal';
import EditMemberModal from '../components/EditMemberModal';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import AvailabilityCalendar from '../components/AvailabilityCalendar';
import EventsList from '../components/EventsList';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import { safeSupabaseRequest } from '../lib/supabaseUtils';
import CalendarInstructionsModal from '../components/CalendarInstructionsModal';

interface ExtendedBandMember extends BandMember {
  instruments: {
    name: string;
    id: string;
  }[];
}

export default function BandManagement() {
  const { id } = useParams<{ id: string }>();
  const [band, setBand] = useState<Band | null>(null);
  const [members, setMembers] = useState<ExtendedBandMember[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<ExtendedBandMember | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<ExtendedBandMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [canAddMembers, setCanAddMembers] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null);
  const [isPrincipalMember, setIsPrincipalMember] = useState(false);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const { user } = useAuthStore();
  const [isUserMember, setIsUserMember] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [calendarUrl, setCalendarUrl] = useState('');

  useEffect(() => {
    if (id) {
      fetchBandData();
    }
  }, [id, user]);

  useEffect(() => {
    if (id && user) {
      checkPermissions();
    }
  }, [id, user, members]);

  const checkPermissions = async () => {
    if (!user) return;

    try {
      const userData = await safeSupabaseRequest(
        () => supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single(),
        'Error checking permissions'
      );

      if (userData) {
        setUserRole(userData.role);
        setCanAddMembers(userData.role === 'admin');
      }

      const userMember = members.find(m => m.user_id === user.id);
      setIsUserMember(!!userMember);
      setIsPrincipalMember(userMember?.role_in_band === 'principal' || false);
      
      if (userMember?.role_in_band === 'principal') {
        setCanAddMembers(true);
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  };

  const fetchBandData = async () => {
    try {
      const bandData = await safeSupabaseRequest(
        () => supabase
          .from('bands')
          .select('*')
          .eq('id', id)
          .single(),
        'Error loading band'
      );

      if (bandData) {
        setBand(bandData);
      }

      const membersData = await safeSupabaseRequest(
        () => supabase
          .from('band_members')
          .select(`
            *,
            band_member_instruments!left (
              instrument:instruments!inner (
                id,
                name
              )
            )
          `)
          .eq('band_id', id)
          .order('role_in_band', { ascending: false })
          .order('name'),
        'Error loading members'
      );

      if (membersData) {
        const transformedMembers: ExtendedBandMember[] = membersData.map(member => ({
          ...member,
          instruments: (member.band_member_instruments || [])
            .filter(bmi => bmi?.instrument)
            .map(bmi => ({
              id: bmi.instrument.id,
              name: bmi.instrument.name
            }))
        }));

        setMembers(transformedMembers);
      }

      const instrumentsData = await safeSupabaseRequest(
        () => supabase
          .from('instruments')
          .select('*')
          .order('name'),
        'Error loading instruments'
      );

      if (instrumentsData) {
        setInstruments(instrumentsData);
      }
    } catch (error) {
      console.error('Error fetching band data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkMember = async (memberId: string) => {
    if (!user || !id) return;

    try {
      await safeSupabaseRequest(
        () => supabase.rpc('link_band_member', {
          p_member_id: memberId,
          p_user_id: user.id,
          p_band_id: id
        }),
        'Error linking member'
      );

      toast.success("¡Te has vinculado correctamente!");
      await fetchBandData();
      await checkPermissions();
    } catch (error) {
      console.error('Error linking member:', error);
    }
  };

  const handleEditMember = (member: ExtendedBandMember) => {
    setSelectedMember(member);
    setIsEditModalOpen(true);
  };

  const handleDeleteMember = (member: ExtendedBandMember) => {
    setMemberToDelete(member);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteMember = async () => {
    if (!memberToDelete) return;

    try {
      await safeSupabaseRequest(
        () => supabase
          .from('band_members')
          .delete()
          .eq('id', memberToDelete.id),
        'Error deleting member'
      );

      toast.success('Miembro eliminado correctamente');
      setIsDeleteModalOpen(false);
      setMemberToDelete(null);
      fetchBandData();
    } catch (error) {
      console.error('Error deleting member:', error);
    }
  };

  // Group members by role
  const principalMembers = members.filter(m => m.role_in_band === 'principal');
  const substituteMembers = members.filter(m => m.role_in_band === 'sustituto');

  const renderMemberGroup = (groupMembers: ExtendedBandMember[], title: string) => (
    <div>
      <div className="bg-gray-50 px-3 py-2">
        <h3 className="text-sm font-medium text-gray-700">{title}</h3>
      </div>
      <div className="divide-y">
        {groupMembers.map((member) => (
          <div key={member.id} className="p-3 hover:bg-gray-50">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-gray-900">
                    {member.name}
                  </h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    member.role_in_band === 'principal'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {member.role_in_band === 'principal' ? 'Principal' : 'Sustituto'}
                  </span>
                  {!member.user_id && (
                    <span className="text-xs text-gray-500">(Sin vincular)</span>
                  )}
                </div>
                {member.instruments.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {member.instruments.map((instrument, idx) => (
                      <span
                        key={`${member.id}-${instrument.id}-${idx}`}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                      >
                        <Music className="w-3 h-3 mr-1" />
                        {instrument.name}
                      </span>
                    ))}
                  </div>
                )}
                {member.user_id === user?.id && (
                  <div className="mt-2 flex items-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={member.sync_calendar}
                        onChange={async () => {
                          try {
                            await safeSupabaseRequest(
                              () => supabase
                                .from('band_members')
                                .update({ sync_calendar: !member.sync_calendar })
                                .eq('id', member.id),
                              'Error actualizando preferencias de calendario'
                            );
                            toast.success('Preferencias de calendario actualizadas');
                            fetchBandData();
                          } catch (error) {
                            console.error('Error:', error);
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      <span className="ml-3 text-sm font-medium text-gray-700">
                        Sincronizar eventos al calendario
                      </span>
                    </label>
                  </div>
                )}
                {member.user_id === user?.id && member.sync_calendar && (
                  <button
                    onClick={() => getCalendarSubscriptionUrl(member.id)}
                    className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 flex items-center"
                  >
                    <Calendar className="w-4 h-4 mr-1" />
                    Obtener enlace de suscripción al calendario
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 ml-4">
                {(userRole === 'admin' || member.user_id === user?.id) && (
                  <button
                    onClick={() => handleEditMember(member)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                    title="Editar miembro"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
                {(userRole === 'admin' || isPrincipalMember) && (
                  <button
                    onClick={() => handleDeleteMember(member)}
                    className="p-1 text-red-400 hover:text-red-600 rounded-full hover:bg-red-50"
                    title="Eliminar miembro"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            {!member.user_id && !isUserMember && (
              <Button
                onClick={() => handleLinkMember(member.id)}
                variant="secondary"
                className="w-full mt-2 text-sm py-1"
              >
                <User className="w-3 h-3 mr-1" />
                Soy este miembro
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const getCalendarSubscriptionUrl = async (memberId: string) => {
    try {
      // Primero generamos el calendario
      const { data: calendarData, error: calendarError } = await supabase
        .rpc('get_band_calendar', {
          p_band_id: band?.id,
          p_member_id: memberId
        });

      if (calendarError) throw calendarError;
      if (!calendarData) throw new Error('No se pudo generar el calendario');

      // Convertimos el texto del calendario a un archivo Blob
      const calendarBlob = new Blob([calendarData], { type: 'text/calendar' });
      const calendarFile = new File([calendarBlob], 'calendar.ics', { type: 'text/calendar' });

      // Subimos el archivo a Supabase Storage
      const { error: uploadError } = await supabase
        .storage
        .from('calendars')
        .upload(`${band?.id}/${memberId}/calendar.ics`, calendarFile, {
          cacheControl: '0',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      // Obtenemos la URL pública
      const { data: { publicUrl } } = await supabase
        .storage
        .from('calendars')
        .getPublicUrl(`${band?.id}/${memberId}/calendar.ics`);

      if (publicUrl) {
        setCalendarUrl(publicUrl);
        setIsCalendarModalOpen(true);
      } else {
        throw new Error('No se pudo generar el enlace público');
      }
    } catch (error) {
      console.error('Error:', error);
      if (error.message === 'new row violates row-level security policy') {
        toast.error('Error de permisos al generar el calendario. Por favor, contacta con el administrador.');
      } else {
        toast.error('Error al generar el enlace del calendario');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!band) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold text-gray-900">Banda no encontrada</h2>
        <p className="text-gray-500 mt-2">La banda que buscas no existe o no tienes acceso a ella.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{band.name}</h1>
          <p className="text-gray-500 mt-1">Gestiona miembros y disponibilidad</p>
        </div>
        {(canAddMembers || isPrincipalMember) && (!isUserMember || userRole === 'admin' || isPrincipalMember) && (
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>{userRole === 'admin' || isPrincipalMember ? 'Añadir Miembro' : 'Unirse a la Banda'}</span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Members List */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Miembros de la Banda</h2>
          </div>
          {members.length === 0 ? (
            <div className="text-center py-8">
              <User className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">
                No hay miembros aún. {canAddMembers ? '¡Haz clic en "Unirse a la Banda" para ser el primer miembro!' : 'Espera a que alguien se una a la banda.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {principalMembers.length > 0 && renderMemberGroup(principalMembers, 'Miembros Principales')}
              {substituteMembers.length > 0 && renderMemberGroup(substituteMembers, 'Miembros Sustitutos')}
            </div>
          )}
        </div>

        {/* Availability Calendar */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Disponibilidad</h2>
          </div>
          <div className="p-4">
            <AvailabilityCalendar 
              members={members} 
              onAvailableDatesChange={setAvailableDates}
            />
          </div>
        </div>
      </div>

      {/* Events List */}
      {band && (
        <div className="mt-6 bg-white rounded-lg shadow-md">
          <EventsList
            bandId={band.id}
            canManageEvents={userRole === 'admin' || isPrincipalMember}
            availableDates={availableDates}
            members={members}
          />
        </div>
      )}

      {/* Modals */}
      {band && (canAddMembers || isPrincipalMember) && (!isUserMember || userRole === 'admin' || isPrincipalMember) && (
        <AddMemberModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          bandId={band.id}
          instruments={instruments}
          onMemberAdded={fetchBandData}
          isEmptyBand={members.length === 0}
          userRole={userRole}
        />
      )}

      {selectedMember && (
        <EditMemberModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedMember(null);
          }}
          member={selectedMember}
          instruments={instruments}
          onMemberUpdated={fetchBandData}
          userRole={userRole}
        />
      )}

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setMemberToDelete(null);
        }}
        onConfirm={confirmDeleteMember}
        title="Eliminar Miembro"
        message={`¿Estás seguro de que quieres eliminar a ${memberToDelete?.name}? Esta acción no se puede deshacer.`}
      />

      <CalendarInstructionsModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        calendarUrl={calendarUrl}
      />
    </div>
  );
}