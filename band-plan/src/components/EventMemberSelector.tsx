import React from 'react';
import { Music, AlertCircle } from 'lucide-react';
import { BandMember } from '../types';

interface EventMemberSelectorProps {
  members: BandMember[];
  selectedMembers: {
    memberId: string;
    userId: string | null;
    selected: boolean;
    isAvailable: boolean;
  }[];
  onMemberSelectionChange: (memberId: string, selected: boolean) => void;
  validationError: boolean;
}

export default function EventMemberSelector({
  members,
  selectedMembers,
  onMemberSelectionChange,
  validationError
}: EventMemberSelectorProps) {
  // Group members by role
  const principalMembers = selectedMembers.filter(m => {
    const member = members.find(bm => bm.id === m.memberId);
    return member?.role_in_band === 'principal';
  });

  const substituteMembers = selectedMembers.filter(m => {
    const member = members.find(bm => bm.id === m.memberId);
    return member?.role_in_band === 'sustituto';
  });

  const renderMemberGroup = (groupMembers: typeof selectedMembers, title: string) => (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-700">{title}</h4>
      {groupMembers.map((member) => {
        const bandMember = members.find(m => m.id === member.memberId);
        if (!bandMember) return null;

        return (
          <div
            key={member.memberId}
            className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
              member.isAvailable 
                ? 'bg-gray-50 hover:bg-gray-100' 
                : 'bg-red-50'
            }`}
          >
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={member.selected}
                onChange={(e) => onMemberSelectionChange(member.memberId, e.target.checked)}
                className={`rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 ${
                  !member.isAvailable && !member.selected ? 'opacity-50' : ''
                }`}
                disabled={!member.isAvailable && !member.selected}
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{bandMember.name}</span>
                  {!member.isAvailable && (
                    <span className="inline-flex items-center text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      No disponible
                    </span>
                  )}
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <Music className="w-3 h-3 mr-1" />
                  {bandMember.instruments.map(i => i.name).join(', ')}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium leading-6 text-gray-900">Miembros</h3>
      
      <div className="space-y-6">
        {renderMemberGroup(principalMembers, "Miembros Principales")}
        {substituteMembers.length > 0 && renderMemberGroup(substituteMembers, "Sustitutos")}
      </div>

      {validationError && (
        <div className="mt-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg flex items-start">
          <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
          <p>
            Por favor, asegúrate de que todos los instrumentos estén cubiertos por los miembros seleccionados.
            Si un miembro principal no está disponible, debes seleccionar un sustituto que cubra sus instrumentos.
          </p>
        </div>
      )}
    </div>
  );
}