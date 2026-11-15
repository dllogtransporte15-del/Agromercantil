-- =====================================================================
-- MIGRAÇÃO TRANSCUNHA LOGÍSTICA - CANAL DE COMUNICAÇÃO WHATSAPP
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA: whatsapp_instances (Instâncias & Conexões)
CREATE TABLE IF NOT EXISTS public.whatsapp_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    instance_key VARCHAR(100) UNIQUE NOT NULL,
    phone_number VARCHAR(30),
    status VARCHAR(30) DEFAULT 'disconnected' 
        CHECK (status IN ('disconnected', 'connecting', 'qrcode', 'connected', 'banned')),
    qr_code_base64 TEXT,
    battery_level INTEGER DEFAULT 100,
    is_plugged BOOLEAN DEFAULT false,
    api_token VARCHAR(255) NOT NULL,
    webhook_url TEXT,
    last_connected_at TIMESTAMPTZ,
    last_disconnected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABELA: whatsapp_templates (Modelos de Mensagens e Réguas)
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(120) NOT NULL,
    trigger_event VARCHAR(80) NOT NULL,
    description TEXT,
    body_text TEXT NOT NULL,
    available_tags JSONB DEFAULT '[]'::jsonb,
    attachment_type VARCHAR(40) DEFAULT 'none' 
        CHECK (attachment_type IN ('none', 'fixed_file', 'dynamic_cte', 'dynamic_contract', 'dynamic_voucher', 'custom_url')),
    fixed_attachment_url TEXT,
    default_filename VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA: whatsapp_messages_queue (Fila de Envios & Mensagens)
CREATE TABLE IF NOT EXISTS public.whatsapp_messages_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
    template_id UUID REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
    shipment_id UUID,
    recipient_phone VARCHAR(30) NOT NULL,
    recipient_name VARCHAR(150),
    message_type VARCHAR(30) DEFAULT 'text' 
        CHECK (message_type IN ('text', 'image', 'document', 'audio', 'video')),
    rendered_body TEXT NOT NULL,
    media_url TEXT,
    media_filename VARCHAR(255),
    media_caption TEXT,
    status VARCHAR(30) DEFAULT 'pending' 
        CHECK (status IN ('pending', 'processing', 'sent', 'delivered', 'read', 'failed', 'cancelled')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    external_message_id VARCHAR(120),
    idempotency_key VARCHAR(150) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABELA: whatsapp_message_logs (Auditoria de Eventos e ACKs)
CREATE TABLE IF NOT EXISTS public.whatsapp_message_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    queue_id UUID REFERENCES public.whatsapp_messages_queue(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_wa_queue_status_sched ON public.whatsapp_messages_queue(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_wa_queue_phone ON public.whatsapp_messages_queue(recipient_phone);
CREATE INDEX IF NOT EXISTS idx_wa_queue_shipment ON public.whatsapp_messages_queue(shipment_id);

-- RLS
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_message_logs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "wa_instances_all" ON public.whatsapp_instances;
    CREATE POLICY "wa_instances_all" ON public.whatsapp_instances FOR ALL TO authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "wa_templates_all" ON public.whatsapp_templates;
    CREATE POLICY "wa_templates_all" ON public.whatsapp_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "wa_queue_all" ON public.whatsapp_messages_queue;
    CREATE POLICY "wa_queue_all" ON public.whatsapp_messages_queue FOR ALL TO authenticated USING (true) WITH CHECK (true);
END $$;

-- SEEDS INICIAIS DE TEMPLATES PADRÕES DA TRANSCUNHA
INSERT INTO public.whatsapp_templates (name, trigger_event, description, body_text, available_tags, attachment_type, is_active)
VALUES
(
    'Aviso de Oferta / Nova Carga',
    'shipment.created',
    'Mensagem enviada a motoristas cadastrados quando uma nova oportunidade de frete na rota é aberta.',
    '🚛 *Transcunha Logística - Oportunidade de Carga*\n\nOlá, *{{motorista_nome}}*! Temos uma nova carga disponível para você:\n\n📍 *Origem:* {{origem}}\n🎯 *Destino:* {{destino}}\n📦 *Mercadoria:* {{mercadoria}}\n⚖️ *Peso:* {{peso}}\n💰 *Valor do Frete:* R$ {{valor_frete}}\n\nInteressado? Responda a esta mensagem ou acesse nosso app para confirmar!',
    '[{"tag": "{{motorista_nome}}", "label": "Nome do Motorista", "example": "Carlos Silva", "description": "Primeiro nome ou nome completo do motorista"}, {"tag": "{{origem}}", "label": "Origem", "example": "Santos - SP", "description": "Cidade e UF de coleta"}, {"tag": "{{destino}}", "label": "Destino", "example": "Curitiba - PR", "description": "Cidade e UF de entrega"}, {"tag": "{{mercadoria}}", "label": "Mercadoria", "example": "Soja a Granel", "description": "Tipo do produto transportado"}, {"tag": "{{peso}}", "label": "Peso / Volume", "example": "32.000 kg", "description": "Peso total da carga"}, {"tag": "{{valor_frete}}", "label": "Valor do Frete", "example": "6.800,00", "description": "Valor líquido do frete"}]'::jsonb,
    'none',
    true
),
(
    'Ordem de Carregamento & Documentos',
    'shipment.loading_order',
    'Disparo automático ao emitir a Ordem de Carregamento com o PDF anexo para o motorista.',
    '📋 *Ordem de Carregamento Transcunha*\n\nOlá, *{{motorista_nome}}*! Segue em anexo a sua Ordem de Carregamento referente ao embarque *#{{numero_carga}}*.\n\n📍 *Local de Coleta:* {{local_coleta}}\n📅 *Data Programada:* {{data_coleta}}\n📞 *Contato no Local:* {{contato_coleta}}\n\nPor favor, apresente este documento na portaria ao chegar.',
    '[{"tag": "{{motorista_nome}}", "label": "Nome do Motorista", "example": "Carlos Silva", "description": "Nome do motorista"}, {"tag": "{{numero_carga}}", "label": "Nº Carga / Embarque", "example": "TC-8492", "description": "Identificador da carga"}, {"tag": "{{local_coleta}}", "label": "Ponto de Coleta", "example": "Terminal Graneleiro Armazém 4", "description": "Endereço ou empresa de carregamento"}, {"tag": "{{data_coleta}}", "label": "Data da Coleta", "example": "20/09/2026", "description": "Data prevista"}, {"tag": "{{contato_coleta}}", "label": "Contato Coleta", "example": "(11) 98888-7777 - Sr. Marcos", "description": "Responsável na expedição"}]'::jsonb,
    'dynamic_contract',
    true
),
(
    'Comprovante de Adiantamento de Frete',
    'shipment.advance_paid',
    'Notificação com comprovante PIX/Transferência após a liberação do adiantamento.',
    '✅ *Adiantamento Pago com Sucesso!*\n\nOlá, *{{motorista_nome}}*! O adiantamento do seu frete referente ao embarque *#{{numero_carga}}* foi creditado em sua conta.\n\n💵 *Valor Pago:* R$ {{valor_adiantamento}}\n🏦 *Banco/Chave:* {{dados_bancarios}}\n📄 O comprovante bancário segue em anexo.\n\nBoa viagem e dirija com segurança!',
    '[{"tag": "{{motorista_nome}}", "label": "Nome do Motorista", "example": "Carlos Silva", "description": "Nome do motorista"}, {"tag": "{{numero_carga}}", "label": "Nº Embarque", "example": "TC-8492", "description": "Código do embarque"}, {"tag": "{{valor_adiantamento}}", "label": "Valor Adiantamento", "example": "3.500,00", "description": "Valor líquido adiantado"}, {"tag": "{{dados_bancarios}}", "label": "Dados Bancários", "example": "PIX (CPF 123.456.789-00)", "description": "Conta ou chave utilizada"}]'::jsonb,
    'dynamic_voucher',
    true
),
(
    'Emissão de CT-e e DACTE em PDF',
    'shipment.cte_emitted',
    'Envio do CT-e autorizado diretamente para o motorista e embarcador.',
    '📄 *CT-e Autorizado - Transcunha Logística*\n\nInformamos que o Conhecimento de Transporte Eletrônico (*CT-e nº {{numero_cte}}*) foi autorizado pela SEFAZ.\n\n🚛 *Placa:* {{placa_veiculo}}\n📦 *Carga:* {{numero_carga}}\n📄 O DACTE em formato PDF está anexado nesta mensagem para fiscalização rodoviária.',
    '[{"tag": "{{numero_cte}}", "label": "Nº do CT-e", "example": "10492", "description": "Número fiscal do CT-e"}, {"tag": "{{placa_veiculo}}", "label": "Placa do Veículo", "example": "BRA2E19", "description": "Placa do cavalo mecânico"}, {"tag": "{{numero_carga}}", "label": "Nº Embarque", "example": "TC-8492", "description": "Código da carga"}]'::jsonb,
    'dynamic_cte',
    true
),
(
    'Comprovante de Quitação do Saldo',
    'shipment.balance_paid',
    'Notificação de finalização do frete com envio do comprovante de quitação do saldo.',
    '🎉 *Frete Concluído - Saldo Quitado*\n\nOlá, *{{motorista_nome}}*! O saldo final do seu frete (*Embarque #{{numero_carga}}*) foi creditado com sucesso.\n\n💰 *Valor do Saldo:* R$ {{valor_saldo}}\n📄 O comprovante de transferência segue em anexo.\n\nA equipe Transcunha agradece pela parceria em mais uma viagem!',
    '[{"tag": "{{motorista_nome}}", "label": "Nome do Motorista", "example": "Carlos Silva", "description": "Nome do motorista"}, {"tag": "{{numero_carga}}", "label": "Nº Embarque", "example": "TC-8492", "description": "Código da carga"}, {"tag": "{{valor_saldo}}", "label": "Valor do Saldo", "example": "1.850,00", "description": "Valor líquido do saldo final"}]'::jsonb,
    'dynamic_voucher',
    true
)
ON CONFLICT DO NOTHING;
