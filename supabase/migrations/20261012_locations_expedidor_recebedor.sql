-- Migration: 20261012_locations_expedidor_recebedor.sql
-- Descrição: Criação da tabela de locais (Expedidor/Recebedor) com CNPJ/CPF, Telefone, WhatsApp e Classificação

CREATE TABLE IF NOT EXISTS public.locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    document_type TEXT CHECK (document_type IN ('CNPJ', 'CPF')),
    document_number TEXT,
    phone TEXT,
    is_whatsapp BOOLEAN DEFAULT FALSE,
    classification TEXT NOT NULL DEFAULT 'Ambos' CHECK (classification = 'Ambos'),
    city TEXT,
    state TEXT,
    map_link TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para busca ágil
CREATE INDEX IF NOT EXISTS idx_locations_name ON public.locations (name);
CREATE INDEX IF NOT EXISTS idx_locations_document ON public.locations (document_number);
CREATE INDEX IF NOT EXISTS idx_locations_city ON public.locations (city);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para usuários autenticados e anônimos (sistema operacional interno)
CREATE POLICY "Permitir leitura de locais" 
    ON public.locations FOR SELECT 
    USING (true);

CREATE POLICY "Permitir inserção de locais" 
    ON public.locations FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Permitir atualização de locais" 
    ON public.locations FOR UPDATE 
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Permitir exclusão de locais" 
    ON public.locations FOR DELETE 
    USING (true);
