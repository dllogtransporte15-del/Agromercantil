-- ====================================================================
-- MÓDULO FINANCEIRO: LANÇAMENTO E GESTÃO DE NOTAS FISCAIS
-- Migração para suporte a Notas Fiscais, Centros de Custo, Naturezas/Modalidades
-- e Vinculação de Responsáveis / Usuários Internos.
-- ====================================================================

-- 1. Tabela: Modalidades / Tipos de Custo
CREATE TABLE IF NOT EXISTS public.financial_cost_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    nature TEXT NOT NULL CHECK (nature IN ('servico', 'produto', 'bem', 'outros')),
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabela: Centros de Custo
CREATE TABLE IF NOT EXISTS public.financial_cost_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT,
    name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela: Notas Fiscais e Despesas Financeiras
CREATE TABLE IF NOT EXISTS public.financial_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL,
    series TEXT,
    access_key TEXT,
    supplier_name TEXT NOT NULL,
    supplier_cnpj_cpf TEXT,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    payment_date DATE,
    status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Pago', 'Atrasado', 'Cancelado')),
    payment_method TEXT,
    payment_details TEXT,
    cost_nature TEXT NOT NULL CHECK (cost_nature IN ('servico', 'produto', 'bem', 'outros')),
    cost_type_id UUID REFERENCES public.financial_cost_types(id) ON DELETE SET NULL,
    cost_type_name TEXT,
    cost_center_id UUID REFERENCES public.financial_cost_centers(id) ON DELETE SET NULL,
    cost_center_name TEXT,
    responsible_user_id TEXT NOT NULL,
    responsible_user_name TEXT NOT NULL,
    responsible_user_profile TEXT,
    description TEXT NOT NULL,
    notes TEXT,
    file_url TEXT,
    file_name TEXT,
    file_type TEXT,
    file_size BIGINT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para otimização de consultas e relatórios
CREATE INDEX IF NOT EXISTS idx_financial_invoices_responsible_user ON public.financial_invoices(responsible_user_id);
CREATE INDEX IF NOT EXISTS idx_financial_invoices_cost_center ON public.financial_invoices(cost_center_id);
CREATE INDEX IF NOT EXISTS idx_financial_invoices_cost_type ON public.financial_invoices(cost_type_id);
CREATE INDEX IF NOT EXISTS idx_financial_invoices_dates ON public.financial_invoices(issue_date, due_date);
CREATE INDEX IF NOT EXISTS idx_financial_invoices_status ON public.financial_invoices(status);
CREATE INDEX IF NOT EXISTS idx_financial_invoices_number ON public.financial_invoices(invoice_number);

-- Políticas RLS
ALTER TABLE public.financial_cost_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_invoices ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Permitir leitura para todos os usuários" ON public.financial_cost_types;
    CREATE POLICY "Permitir leitura para todos os usuários" ON public.financial_cost_types FOR ALL USING (true);

    DROP POLICY IF EXISTS "Permitir leitura para todos os usuários" ON public.financial_cost_centers;
    CREATE POLICY "Permitir leitura para todos os usuários" ON public.financial_cost_centers FOR ALL USING (true);

    DROP POLICY IF EXISTS "Permitir leitura para todos os usuários" ON public.financial_invoices;
    CREATE POLICY "Permitir leitura para todos os usuários" ON public.financial_invoices FOR ALL USING (true);
END $$;

-- 4. Inserção de Centros de Custo Padrão
INSERT INTO public.financial_cost_centers (code, name, description, is_default)
VALUES 
    ('CC-001', 'Operacional', 'Custos diretos de transporte, pátio e logística', true),
    ('CC-002', 'Administrativo', 'Despesas administrativas e gerais da matriz', true),
    ('CC-003', 'Frota & Equipamentos', 'Manutenção preventiva/corretiva e suprimentos da frota', true),
    ('CC-004', 'Comercial & Vendas', 'Custos de agenciamento, prospecção e vendas', true),
    ('CC-005', 'TI & Sistemas', 'Sistemas TMS, licenças, servidores e infraestrutura', true),
    ('CC-006', 'Diretoria & Gestão', 'Custos estratégicos e gestão executiva', true)
ON CONFLICT DO NOTHING;

-- 5. Inserção de Modalidades / Tipos de Custo Padrão
INSERT INTO public.financial_cost_types (name, nature, description, is_default)
VALUES 
    ('Manutenção Mecânica e Peças', 'servico', 'Serviços mecânicos, elétricos e borracharia', true),
    ('Serviços de Tecnologia / TMS', 'servico', 'Assinaturas de software, ERP e rastreamento', true),
    ('Honorários Jurídicos e Contábeis', 'servico', 'Consultoria fiscal, contábil e advocatícia', true),
    ('Pedágio e Tags Eletrônicas', 'servico', 'Recargas e faturamento Sem Parar/Veloe', true),
    ('Seguros e Rastreamento / GR', 'servico', 'Gerenciamento de risco e apólices de transporte', true),
    ('Combustíveis e Lubrificantes', 'produto', 'Abastecimento de diesel, arla e óleos', true),
    ('Pneus e Câmaras de Ar', 'produto', 'Aquisição de pneumáticos e recapagens', true),
    ('Materiais de Escritório e Limpeza', 'produto', 'Insumos do dia a dia administrativo', true),
    ('Veículos e Implementos', 'bem', 'Aquisição e amortização de caminhões e carretas', true),
    ('Equipamentos de Informática', 'bem', 'Computadores, monitores, servidores e roteadores', true),
    ('Móveis e Utensílios', 'bem', 'Mobiliário de escritório e estações de trabalho', true),
    ('Tarifas e Despesas Bancárias', 'outros', 'Taxas de boletos, transferências e custódia', true)
ON CONFLICT DO NOTHING;
