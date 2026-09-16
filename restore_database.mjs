import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env manual
function loadEnv() {
  const envPath = path.resolve('.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim();
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ekwirxblsnmflsamkgnx.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrd2lyeGJsc25tZmxzYW1rZ254Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MDY4MjgsImV4cCI6MjA5NTA4MjgyOH0.Q97uNFSpThMcVpUMp9T_jTSWu4UGX_0OEoB4LaC4AfM';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function restoreDatabase(backupFile = './backups/latest_db_backup.json') {
  const targetPath = path.resolve(backupFile);
  if (!fs.existsSync(targetPath)) {
    console.error(`[ERRO] Arquivo de backup não encontrado em: ${targetPath}`);
    process.exit(1);
  }

  console.log(`[RESTORE] Lendo backup de: ${targetPath}`);
  const backup = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
  const data = backup.data || {};

  // Ordem de inserção para respeitar integridade
  const tableOrder = [
    'branches',
    'app_users',
    'profile_permissions',
    'app_settings',
    'products',
    'clients',
    'owners',
    'drivers',
    'vehicles',
    'cargos',
    'shipments',
    'tickets',
    'tool_clients',
    'tool_stays',
    'tool_quotes'
  ];

  for (const table of tableOrder) {
    const rows = data[table];
    if (rows && rows.length > 0) {
      console.log(`[RESTORE] Restaurando ${rows.length} registros na tabela '${table}'...`);
      // Inserir em lotes de 100
      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await supabase.from(table).upsert(batch);
        if (error) {
          console.warn(`[RESTORE AVISO] Erro ao inserir lote na tabela '${table}':`, error.message);
        }
      }
      console.log(`[RESTORE OK] Tabela '${table}' processada.`);
    }
  }

  console.log('\n[RESTORE SUCESSO] Processo de restauração concluído!');
}

const target = process.argv[2] || './backups/latest_db_backup.json';
restoreDatabase(target).catch(err => {
  console.error('[ERRO CRÍTICO NO RESTORE]:', err);
  process.exit(1);
});
