import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import Button from '../components/Button';
import { useAuthStore } from '../store/authStore';

interface InvitationDetails {
  groupName: string;
  role: string;
}

export default function AcceptInvitation() {
  console.log('AcceptInvitation component mounted');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);

  useEffect(() => {
    console.log('AcceptInvitation useEffect triggered', {
      token,
      user,
      groupMemberId: searchParams.get('group_member_id'),
      currentPath: window.location.pathname + window.location.search
    });

    if (!token) {
      console.log('No token found');
      toast.error('Token de invitación no válido');
      navigate('/');
      return;
    }

    const checkInvitation = async () => {
      try {
        if (!user) {
          const returnUrl = `/accept-invitation?token=${token}&group_member_id=${searchParams.get('group_member_id')}`;
          console.log('No user found, redirecting to login with return URL:', returnUrl);
          navigate('/login', { 
            state: { returnTo: returnUrl }
          });
          return;
        }

        const { data: invitationData, error: invitationError } = await supabase
          .rpc('get_invitation_details', {
            p_token: token
          });

        console.log('Invitation check result:', { invitationData, invitationError });

        if (invitationError) throw invitationError;

        if (!invitationData || invitationData.length === 0) {
          toast.error('Invitación no encontrada o ya procesada');
          navigate('/');
          return;
        }

        const invitation = invitationData[0];
        console.log('Invitation data:', invitation);

        if (user.email !== invitation.email) {
          toast.error('Esta invitación es para otro correo electrónico');
          navigate('/');
          return;
        }

        if (!searchParams.get('group_member_id')) {
          const newSearchParams = new URLSearchParams(searchParams);
          newSearchParams.set('group_member_id', invitation.group_member_id);
          navigate(`${location.pathname}?${newSearchParams.toString()}`, { replace: true });
        }

        setInvitation({
          groupName: invitation.group_name,
          role: invitation.role_in_group
        });
        setLoading(false);
      } catch (error: any) {
        console.error('Error checking invitation:', error);
        toast.error(error.message || 'Error al verificar la invitación');
        navigate('/');
      }
    };

    checkInvitation();
  }, [token, user, navigate, searchParams]);

  const handleInvitation = async (accept: boolean) => {
    try {
      setLoading(true);
      const { data: invitationData, error: invitationError } = await supabase
        .rpc('get_invitation_details', {
          p_token: token
        });

      if (invitationError) throw invitationError;
      if (!invitationData || invitationData.length === 0) {
        throw new Error('Invitación no encontrada');
      }

      const { group_member_id } = invitationData[0];
      
      const { error } = await supabase.rpc('handle_group_invitation', {
        p_group_member_id: group_member_id,
        p_accept: accept
      });

      if (error) throw error;

      toast.success(accept ? 'Invitación aceptada' : 'Invitación rechazada');
      navigate('/');
    } catch (error: any) {
      console.error('Error handling invitation:', error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando invitación...</p>
        </div>
      </div>
    );
  }

  if (!invitation) return null;

  return (
    <div className="max-w-lg mx-auto mt-16 p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-6">
          Invitación a Grupo
        </h1>

        <div className="mb-8 text-center">
          <p className="text-lg mb-2">
            Has sido invitado a unirte a <strong>{invitation.groupName}</strong>
          </p>
          <p className="text-gray-600">
            Rol: <span className="capitalize">{invitation.role}</span>
          </p>
        </div>

        <div className="flex justify-center space-x-4">
          <Button
            onClick={() => handleInvitation(true)}
            loading={loading}
            className="bg-green-500 hover:bg-green-600"
          >
            Aceptar
          </Button>
          <Button
            onClick={() => handleInvitation(false)}
            variant="secondary"
            loading={loading}
            className="bg-red-500 hover:bg-red-600 text-white"
          >
            Rechazar
          </Button>
        </div>
      </div>
    </div>
  );
} 