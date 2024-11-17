import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vrzgwnchqdxwgennshmu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyemd3bmNocWR4d2dlbm5zaG11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE1NTEzMzYsImV4cCI6MjA0NzEyNzMzNn0.U8KLDcO9sabudduU9xTFgmbwDBmgULvH0jKY9QN0eeE';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    redirectTo: 'https://nimble-alfajores-99f196.netlify.app'
  }
});