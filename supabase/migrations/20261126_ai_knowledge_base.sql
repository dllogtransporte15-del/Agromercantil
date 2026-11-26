-- Migration: 20261126_ai_knowledge_base.sql
-- Descrição: Base de Conhecimento e Configurações do Assessor IA (DLLOG Transportes)

CREATE TABLE IF NOT EXISTS public.ai_knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Geral',
    content TEXT NOT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by TEXT,
    created_by_name TEXT,
    updated_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_active ON public.ai_knowledge_base (is_active);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_category ON public.ai_knowledge_base (category);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_updated_at ON public.ai_knowledge_base (updated_at DESC);

ALTER TABLE public.ai_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura de ai_knowledge_base"
    ON public.ai_knowledge_base FOR SELECT
    USING (true);

CREATE POLICY "Permitir inserção em ai_knowledge_base"
    ON public.ai_knowledge_base FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Permitir atualização em ai_knowledge_base"
    ON public.ai_knowledge_base FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Permitir exclusão em ai_knowledge_base"
    ON public.ai_knowledge_base FOR DELETE
    USING (true);

CREATE TABLE IF NOT EXISTS public.ai_agent_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    agent_name TEXT NOT NULL DEFAULT 'Assessor IA DLLOG',
    system_instructions TEXT NOT NULL DEFAULT 'Você é o Assessor IA oficial da DLLOG Transportes. Converse de forma natural, acolhedora, direta e objetiva em português — como um colega experiente e parceiro de trabalho, sem linguagem robótica ou rodeios. Priorize sempre os fatos cadastrados na Base de Conhecimento da empresa.',
    include_live_context BOOLEAN NOT NULL DEFAULT true,
    updated_by_name TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_agent_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura de ai_agent_settings"
    ON public.ai_agent_settings FOR SELECT
    USING (true);

CREATE POLICY "Permitir inserção em ai_agent_settings"
    ON public.ai_agent_settings FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Permitir atualização em ai_agent_settings"
    ON public.ai_agent_settings FOR UPDATE
    USING (true)
    WITH CHECK (true);

INSERT INTO public.ai_agent_settings (id, agent_name, system_instructions, include_live_context)
VALUES (
    'default',
    'Assessor IA DLLOG',
    'Você é o Assessor IA oficial da DLLOG Transportes. Converse de forma natural, acolhedora, direta e objetiva em português — como um colega experiente e parceiro de trabalho, sem linguagem robótica ou rodeios. Priorize sempre os fatos cadastrados na Base de Conhecimento da empresa.',
    true
)
ON CONFLICT (id) DO NOTHING;
