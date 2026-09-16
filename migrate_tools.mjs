/**
 * Script temporário para criar as tabelas tool_clients, tool_stays, tool_quotes
 * Execute com: node migrate_tools.mjs
 * 
 * NOTA: Usa a anon key. Para DDL você precisa estar usando service_role ou executar
 * diretamente no Supabase SQL Editor.
 * 
 * Se este script falhar por permissão, cole o SQL abaixo direto no SQL Editor do Supabase:
 * https://supabase.com/dashboard/project/smolfvbunrgqsgaazbpx/sql/new
 */

const SUPABASE_URL = 'https://smolfvbunrgqsgaazbpx.supabase.co';

// Para DDL precisamos de service_role key - por favor adicione no .env.local como SUPABASE_SERVICE_ROLE_KEY
// ou cole o SQL abaixo no SQL Editor do Supabase Dashboard
const SQL = `
-- tool_clients
CREATE TABLE IF NOT EXISTS tool_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, name)
);
ALTER TABLE tool_clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tool_clients_user_policy" ON tool_clients;
CREATE POLICY "tool_clients_user_policy" ON tool_clients
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- tool_stays
CREATE TABLE IF NOT EXISTS tool_stays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name TEXT,
  driver TEXT NOT NULL,
  plate TEXT NOT NULL,
  invoice TEXT,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  location TEXT NOT NULL CHECK (location IN ('Origem', 'Destino')),
  entry_date TIMESTAMPTZ NOT NULL,
  exit_date TIMESTAMPTZ NOT NULL,
  total_hours NUMERIC NOT NULL,
  weight NUMERIC NOT NULL,
  value_per_hour NUMERIC NOT NULL,
  tolerance NUMERIC NOT NULL DEFAULT 0,
  total_value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE tool_stays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tool_stays_user_policy" ON tool_stays;
CREATE POLICY "tool_stays_user_policy" ON tool_stays
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- tool_quotes
CREATE TABLE IF NOT EXISTS tool_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name TEXT,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  distance NUMERIC NOT NULL,
  axes INTEGER NOT NULL,
  cargo_type TEXT NOT NULL,
  input_mode TEXT NOT NULL CHECK (input_mode IN ('PER_KM', 'PER_TON')),
  value_per_km NUMERIC NOT NULL DEFAULT 0,
  driver_total_value NUMERIC NOT NULL DEFAULT 0,
  toll_value NUMERIC NOT NULL DEFAULT 0,
  antt_value NUMERIC NOT NULL DEFAULT 0,
  weight NUMERIC NOT NULL DEFAULT 0,
  margin NUMERIC NOT NULL DEFAULT 0,
  driver_freight_per_ton NUMERIC NOT NULL DEFAULT 0,
  company_freight_per_ton NUMERIC NOT NULL DEFAULT 0,
  company_total_freight NUMERIC NOT NULL DEFAULT 0,
  carrier_net_profit NUMERIC NOT NULL DEFAULT 0,
  carrier_profit_margin NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE tool_quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tool_quotes_user_policy" ON tool_quotes;
CREATE POLICY "tool_quotes_user_policy" ON tool_quotes
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
`;

console.log('=== SQL para executar no Supabase SQL Editor ===');
console.log('URL: https://supabase.com/dashboard/project/smolfvbunrgqsgaazbpx/sql/new');
console.log('');
console.log(SQL);
