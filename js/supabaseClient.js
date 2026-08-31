
const SUPABASE_URL = 'https://gcjqacfbgxiqvqykwtbb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjanFhY2ZiZ3hpcXZxeWt3dGJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyMTUxNDcsImV4cCI6MjEwMzc5MTE0N30.A0zhWbZCBV6fRUT_usLR3e6lPrScjS77Wt57vo9oVrg';

// E-mail do usuário administrador cadastrado no Supabase Auth.
// Veja o passo a passo no README-SUPABASE.md para criar esse usuário.
const NDJ_ADMIN_EMAIL = 'admin@ndj3d.com.br';

const ndjSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
