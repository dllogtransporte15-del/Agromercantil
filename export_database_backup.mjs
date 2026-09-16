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

const TABLES = [
  'clients',
  'owners',
  'drivers',
  'vehicles',
  'products',
  'cargos',
  'shipments',
  'app_users',
  'tickets',
  'branches',
  'shipment_locks',
  'profile_permissions',
  'app_settings',
  'shipment_attachments',
  'tool_clients',
  'tool_stays',
  'tool_quotes'
];

async function runBackup() {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const dateFormatted = now.toLocaleDateString('pt-BR').replace(/\//g, '-');
  const backupDir = path.resolve(`./backups/db_backup_${timestamp}`);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log(`[BACKUP] Iniciando backup do banco de dados Supabase...`);
  console.log(`[BACKUP] Diretório: ${backupDir}`);
  console.log(`[BACKUP] Supabase URL: ${SUPABASE_URL}`);

  const fullData = {};
  const summary = {};

  for (const table of TABLES) {
    try {
      console.log(`[BACKUP] Baixando dados da tabela '${table}'...`);
      let allRows = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .range(from, from + pageSize - 1);

        if (error) {
          console.warn(`[BACKUP AVISO] Tabela '${table}': ${error.message} (Código: ${error.code})`);
          summary[table] = { status: 'error', error: error.message };
          hasMore = false;
          break;
        }

        if (data && data.length > 0) {
          allRows = allRows.concat(data);
          from += pageSize;
          if (data.length < pageSize) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      if (summary[table]?.status !== 'error') {
        fullData[table] = allRows;
        summary[table] = { status: 'ok', rowCount: allRows.length };
        fs.writeFileSync(
          path.join(backupDir, `${table}.json`),
          JSON.stringify(allRows, null, 2),
          'utf-8'
        );
        console.log(`[BACKUP OK] '${table}': ${allRows.length} registros salvos.`);
      }
    } catch (err) {
      console.error(`[BACKUP ERRO] Falha ao processar tabela '${table}':`, err.message);
      summary[table] = { status: 'exception', error: err.message };
    }
  }

  // Gerar inserts SQL para facilitar caso precise executar direto no SQL editor do Supabase
  let sqlDump = `-- BACKUP SUPABASE AGROMERCANTIL\n-- Gerado em: ${now.toISOString()}\n\n`;
  for (const [table, rows] of Object.entries(fullData)) {
    if (rows && rows.length > 0) {
      sqlDump += `-- Tabela: ${table} (${rows.length} registros)\n`;
      for (const row of rows) {
        const keys = Object.keys(row);
        const cols = keys.map(k => `"${k}"`).join(', ');
        const values = keys.map(k => {
          const val = row[k];
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'number' || typeof val === 'boolean') return val;
          if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
          return `'${String(val).replace(/'/g, "''")}'`;
        }).join(', ');
        sqlDump += `INSERT INTO "${table}" (${cols}) VALUES (${values}) ON CONFLICT DO NOTHING;\n`;
      }
      sqlDump += '\n';
    }
  }

  fs.writeFileSync(path.join(backupDir, 'database_dump.sql'), sqlDump, 'utf-8');

  // Salvar backup consolidado
  const masterBackup = {
    timestamp: now.toISOString(),
    supabaseUrl: SUPABASE_URL,
    summary,
    data: fullData
  };

  fs.writeFileSync(
    path.join(backupDir, 'full_database_backup.json'),
    JSON.stringify(masterBackup, null, 2),
    'utf-8'
  );

  // Também salvar cópia no diretório raiz de backups para fácil acesso
  fs.writeFileSync(
    path.resolve('./backups/latest_db_backup.json'),
    JSON.stringify(masterBackup, null, 2),
    'utf-8'
  );
  fs.writeFileSync(
    path.resolve('./backups/latest_database_dump.sql'),
    sqlDump,
    'utf-8'
  );

  console.log('\n=============================================');
  console.log('RESUMO DO BACKUP DO BANCO DE DADOS:');
  console.table(summary);
  console.log(`Backup salvo com sucesso em: ${backupDir}`);
  console.log('=============================================\n');
}

runBackup().catch(err => {
  console.error('[ERRO CRÍTICO NO BACKUP]:', err);
  process.exit(1);
});
