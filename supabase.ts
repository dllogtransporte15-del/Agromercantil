import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string | undefined;

console.log('[AGROMERCANTIL] Supabase URL:', SUPABASE_URL);
console.log('[AGROMERCANTIL] Supabase Key exists:', !!SUPABASE_KEY);

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    '[AGROMERCANTIL] Variáveis de ambiente do Supabase não encontradas!\n' +
    'Configure as seguintes variáveis no seu painel ou arquivo .env:\n' +
    '  • VITE_SUPABASE_URL\n' +
    '  • VITE_SUPABASE_PUBLISHABLE_KEY (recomendado) ou VITE_SUPABASE_ANON_KEY'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
