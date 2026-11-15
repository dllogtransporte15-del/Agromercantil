-- Migration: 20261021_rdo_nacional.sql
-- Descrição: Tabela para controle e histórico das solicitações e pareceres de análise cadastral do RDO Nacional (MRB Soluções)

CREATE TABLE IF NOT EXISTS public.rdo_requests (
    id UUID PRIMARY KEY,
    codigo INTEGER,
    shipment_id TEXT,
    driver_id TEXT,
    cpf TEXT NOT NULL,
    nome TEXT NOT NULL,
    nome_da_mae TEXT,
    data_nascimento DATE,
    documento_proprietario TEXT,
    nome_proprietario TEXT,
    placa_cavalo TEXT,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'consta_informacao', 'erro')),
    parecer INTEGER CHECK (parecer IN (0, 1)),
    observacao TEXT,
    cnh_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    concluded_at TIMESTAMPTZ,
    created_by TEXT,
    created_by_name TEXT,
    raw_response JSONB,
    raw_webhook_payload JSONB
);

-- Índices para busca ágil
CREATE INDEX IF NOT EXISTS idx_rdo_requests_cpf ON public.rdo_requests (cpf);
CREATE INDEX IF NOT EXISTS idx_rdo_requests_shipment_id ON public.rdo_requests (shipment_id);
CREATE INDEX IF NOT EXISTS idx_rdo_requests_driver_id ON public.rdo_requests (driver_id);
CREATE INDEX IF NOT EXISTS idx_rdo_requests_status ON public.rdo_requests (status);
CREATE INDEX IF NOT EXISTS idx_rdo_requests_created_at ON public.rdo_requests (created_at DESC);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.rdo_requests ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Permitir leitura de rdo_requests" 
    ON public.rdo_requests FOR SELECT 
    USING (true);

CREATE POLICY "Permitir inserção de rdo_requests" 
    ON public.rdo_requests FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Permitir atualização de rdo_requests" 
    ON public.rdo_requests FOR UPDATE 
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Permitir exclusão de rdo_requests" 
    ON public.rdo_requests FOR DELETE 
    USING (true);
