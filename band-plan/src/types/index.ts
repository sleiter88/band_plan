export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

export interface Group {
  id: string;
  name: string;
  created_by: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string | null;
  name: string;
  role_in_group: 'principal' | 'sustituto';
  created_by: string;
}

export interface Instrument {
  id: string;
  name: string;
  created_by: string;
}

export interface GroupMemberInstrument {
  id: number;
  group_member_id: string;
  instrument_id: string;
  created_by: string;
}

export interface Event {
  id: number;
  group_id: string;
  name: string;
  date: string;
  time: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}