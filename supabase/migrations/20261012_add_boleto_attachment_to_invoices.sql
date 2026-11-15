-- ====================================================================
-- MÓDULO FINANCEIRO: ANEXO DE BOLETO BANCÁRIO PARA PAGAMENTO
-- Adiciona suporte ao armazenamento de comprovante/arquivo de boleto
-- vinculado aos lançamentos de Notas Fiscais e Despesas.
-- ====================================================================

ALTER TABLE public.financial_invoices
ADD COLUMN IF NOT EXISTS boleto_file_url TEXT,
ADD COLUMN IF NOT EXISTS boleto_file_name TEXT,
ADD COLUMN IF NOT EXISTS boleto_file_type TEXT,
ADD COLUMN IF NOT EXISTS boleto_file_size BIGINT;
