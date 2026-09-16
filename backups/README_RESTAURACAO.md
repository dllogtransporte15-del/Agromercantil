# Instruções de Restauração (Ponto de Restauração)

Criado em: 16/09/2026

---

## 1. Como Restaurar o Banco de Dados

### Opção A (Automática via Script Node.js):
Basta rodar no terminal:
```bash
node restore_database.mjs
```
*Isto lerá o arquivo `backups/latest_db_backup.json` e executará o `upsert` de todas as tabelas diretamente no Supabase.*

### Opção B (Executar via SQL Editor no Supabase):
Abra o painel do Supabase, vá em **SQL Editor** e execute o conteúdo do arquivo:
`backups/latest_database_dump.sql` ou `backups/db_backup_<data>/database_dump.sql`.

---

## 2. Como Restaurar o Código-Fonte

### Opção A (Via Git Branch de Backup):
```bash
git checkout backup-pre-mudanca-brusca
```
Ou para forçar a branch principal a voltar a este ponto:
```bash
git reset --hard backup-pre-mudanca-brusca
```

### Opção B (Via Git Tag):
```bash
git checkout tags/ponto-restauracao-20260916-152124
```

### Opção C (Via Arquivo ZIP):
Descompacte o arquivo de snapshot:
`backups/code_snapshot_20260916_152128.zip`
