export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

export interface Band {
  id: string;
  name: string;
  created_by: string;
}

export interface BandMember {
  id: string;
  band_id: string;
  user_id: string | null;
  name: string;
  role_in_band: 'principal' | 'sustituto';
  created_by: string;
}

export interface Instrument {
  id: string;
  name: string;
  created_by: string;
}

export interface BandMemberInstrument {
  id: number;
  band_member_id: string;
  instrument_id: string;
  created_by: string;
}

export interface Event {
  id: number;
  band_id: string;
  name: string;
  date: string;
  time: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}