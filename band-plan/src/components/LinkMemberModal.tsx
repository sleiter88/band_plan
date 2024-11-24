import React from 'react';
import { X } from 'lucide-react';
import Button from './Button';
import { GroupMember } from '../types';

interface LinkMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: GroupMember[];
  onLink: (memberId: string) => void;
}

export default function LinkMemberModal({
  isOpen,
  onClose,
  members,
  onLink
}: LinkMemberModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">Link to Existing Member</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-600 mb-4">
            Select an unlinked member to link your account to:
          </p>

          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium">{member.name}</h3>
                    <p className="text-sm text-gray-500 capitalize">
                      {member.role_in_group}
                    </p>
                  </div>
                  <Button
                    onClick={() => onLink(member.id)}
                    variant="secondary"
                    className="text-sm"
                  >
                    Link
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              variant="secondary"
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}