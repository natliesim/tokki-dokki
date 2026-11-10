// Connection details for the shared high score board (Supabase).
// Both values are meant to be public: the key is Supabase's "publishable"
// (anon) key, and the database's own rules decide what it may do.
// Never put the secret / service_role key here.
// Leave them empty to turn the board off.
const url = '';
const key = '';

export const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || url;
export const SUPABASE_KEY = import.meta.env?.VITE_SUPABASE_KEY || key;
