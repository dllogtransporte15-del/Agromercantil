import React, { useState, useRef } from 'react';
import { 
  FileText, 
  Sparkles, 
  Save, 
  Plus, 
  Trash2, 
  Paperclip, 
  CheckCheck, 
  Smartphone, 
  Send,
  HelpCircle,
  Tag,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';
import type { WhatsAppTemplate, WhatsAppTriggerEvent, WhatsAppAttachmentType } from '../../types/whatsapp';
import { interpolateTemplate } from '../../services/whatsappService';

interface WhatsAppTemplateEditorProps {
  templates: WhatsAppTemplate[];
  onSaveTemplate: (template: WhatsAppTemplate) => Promise<void>;
  onDeleteTemplate: (templateId: string) => Promise<void>;
  onOpenTestModal: (template: WhatsAppTemplate) => void;
}

const TRIGGER_LABELS: Record<WhatsAppTriggerEvent, string> = {
  'shipment.created': 'Aviso de Oferta / Nova Carga',
  'shipment.assigned': 'Motorista Vinculado à Carga',
  'shipment.risk_pending': 'Gatilho 1 - Aguardando Cadastro e Seguradora',
  'shipment.risk_approved': 'Gatilho 2 - Aguardando Carregamento (Liberado)',
  'shipment.fiscal_emitted': 'Gatilho 3 - Saída do Fiscal & Docs de Viagem',
  'shipment.loading_order': 'Emissão da Ordem de Carregamento',
  'shipment.advance_paid': 'Gatilho 4 - Pagamento de Adiantamento',
  'shipment.in_transit': 'Gatilho 5A - Agendamento / Troca de NF-e',
  'shipment.awaiting_discharge': 'Gatilho 5B - Aguardando Descarga & Canhoto',
  'shipment.cte_emitted': 'Emissão do CT-e & DACTE Autorizado',
  'shipment.delivered': 'Carga Descarregada / Comprovante Entregue',
  'shipment.balance_paid': 'Gatilho 6 - Quitação de Saldo & Finalização',
  'risk.reproved': 'Aviso de Reprovação no GR',
  'custom.manual': 'Mensagem Avulsa / Personalizada'
};

const ATTACHMENT_LABELS: Record<WhatsAppAttachmentType, string> = {
  'none': 'Sem anexo (apenas texto)',
  'dynamic_contract': 'Ordem de Carregamento / Contrato em PDF (Dinâmico)',
  'dynamic_voucher': 'Comprovante Bancário de PIX/TED (Dinâmico)',
  'dynamic_cte': 'DACTE / CT-e em PDF (Dinâmico)',
  'fixed_file': 'Arquivo Fixo (Manual / Tabela)',
  'custom_url': 'URL Personalizada de Documento'
};

const SAMPLE_TAG_VALUES: Record<string, string> = {
  'motorista_nome': 'Carlos Eduardo Silva',
  'origem': 'Santos - SP',
  'destino': 'Curitiba - PR',
  'mercadoria': 'Soja em Grãos',
  'peso': '32.500 kg',
  'valor_frete': '6.850,00',
  'numero_carga': 'TC-8492',
  'local_coleta': 'Terminal Graneleiro Armazém 4',
  'data_coleta': '20/09/2026',
  'contato_coleta': '(11) 98888-7777 - Sr. Marcos',
  'valor_adiantamento': '3.500,00',
  'dados_bancarios': 'PIX (CPF 123.456.789-00)',
  'numero_cte': '10492',
  'placa_veiculo': 'BRA2E19',
  'valor_saldo': '1.850,00'
};

export const WhatsAppTemplateEditor: React.FC<WhatsAppTemplateEditorProps> = ({
  templates,
  onSaveTemplate,
  onDeleteTemplate,
  onOpenTestModal
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || '');
  const [currentTemplate, setCurrentTemplate] = useState<WhatsAppTemplate>(templates[0] || {
    id: `tpl_${Date.now()}`,
    name: 'Novo Modelo',
    trigger_event: 'shipment.created',
    body_text: 'Olá {{motorista_nome}}, sua carga #{{numero_carga}} foi confirmada!',
    available_tags: [],
    attachment_type: 'none',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSelectTemplate = (tpl: WhatsAppTemplate) => {
    setSelectedTemplateId(tpl.id);
    setCurrentTemplate(tpl);
    setSavedSuccess(false);
  };

  const handleCreateNew = () => {
    const newTpl: WhatsAppTemplate = {
      id: `tpl_${Date.now()}`,
      name: 'Novo Modelo de Mensagem',
      trigger_event: 'shipment.created',
      description: 'Descrição do momento em que esta mensagem será disparada.',
      body_text: 'Olá, *{{motorista_nome}}*! Informamos que...',
      available_tags: [
        { tag: '{{motorista_nome}}', label: 'Nome do Motorista', example: 'Carlos Silva', description: 'Nome do motorista' },
        { tag: '{{numero_carga}}', label: 'Nº da Carga', example: 'TC-8492', description: 'Código da carga' }
      ],
      attachment_type: 'none',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setCurrentTemplate(newTpl);
    setSelectedTemplateId(newTpl.id);
  };

  const handleInsertTag = (tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setCurrentTemplate(prev => ({ ...prev, body_text: prev.body_text + ' ' + tag }));
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = currentTemplate.body_text;
    const before = text.substring(0, start);
    const after = text.substring(end);

    const updatedText = before + tag + after;
    setCurrentTemplate(prev => ({ ...prev, body_text: updatedText }));

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveTemplate(currentTemplate);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Deseja excluir o template "${currentTemplate.name}"?`)) return;
    await onDeleteTemplate(currentTemplate.id);
    if (templates.length > 1) {
      const remaining = templates.filter(t => t.id !== currentTemplate.id);
      handleSelectTemplate(remaining[0]);
    } else {
      handleCreateNew();
    }
  };

  // Preview com simulação de interpolação
  const simulatedBody = interpolateTemplate(currentTemplate.body_text, SAMPLE_TAG_VALUES);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* COLUNA ESQUERDA: LISTA DE TEMPLATES */}
      <div className="lg:col-span-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Réguas de Disparo ({templates.length})
          </h3>
          <button
            type="button"
            onClick={handleCreateNew}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1 shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Modelo</span>
          </button>
        </div>

        <div className="space-y-2.5 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
          {templates.map(tpl => {
            const isSelected = tpl.id === selectedTemplateId;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleSelectTemplate(tpl)}
                className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                  isSelected
                    ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/40 ring-2 ring-amber-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                    {tpl.name}
                  </span>
                  {tpl.is_active ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                  )}
                </div>
                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  {TRIGGER_LABELS[tpl.trigger_event] || tpl.trigger_event}
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                  {tpl.body_text.replace(/\n/g, ' ')}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* COLUNA DO MEIO: FORMULÁRIO DE EDIÇÃO */}
      <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-500" />
            <h4 className="font-black text-base text-slate-900 dark:text-white">
              Configurador do Modelo
            </h4>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDelete}
              className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
              title="Excluir Template"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1.5 shadow-md shadow-amber-900/20 cursor-pointer"
            >
              {savedSuccess ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
              <span>{savedSuccess ? 'Salvo!' : 'Salvar Alterações'}</span>
            </button>
          </div>
        </div>

        {/* NOME E GATILHO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
              Nome do Modelo
            </label>
            <input
              type="text"
              value={currentTemplate.name}
              onChange={(e) => setCurrentTemplate({ ...currentTemplate, name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
              Evento / Gatilho de Disparo
            </label>
            <select
              value={currentTemplate.trigger_event}
              onChange={(e) => setCurrentTemplate({ ...currentTemplate, trigger_event: e.target.value as WhatsAppTriggerEvent })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-amber-500"
            >
              {Object.entries(TRIGGER_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* CORPO DA MENSAGEM */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400">
              Corpo do Texto (WhatsApp)
            </label>
            <span className="text-[10px] text-slate-500">
              Suporta *negrito*, _itálico_ e ~tachado~
            </span>
          </div>

          <textarea
            ref={textareaRef}
            rows={7}
            value={currentTemplate.body_text}
            onChange={(e) => setCurrentTemplate({ ...currentTemplate, body_text: e.target.value })}
            className="w-full p-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-amber-500 leading-relaxed"
            placeholder="Digite o texto da mensagem..."
          />
        </div>

        {/* CHIPS DE TAGS DINÂMICAS */}
        <div className="space-y-2">
          <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400">
            Inserir Variáveis Rápidas (Clique para adicionar):
          </label>
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
            {Object.keys(SAMPLE_TAG_VALUES).map((tagKey) => {
              const fullTag = `{{${tagKey}}}`;
              return (
                <button
                  key={tagKey}
                  type="button"
                  onClick={() => handleInsertTag(fullTag)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-all cursor-pointer"
                >
                  +{fullTag}
                </button>
              );
            })}
          </div>
        </div>

        {/* TIPO DE ANEXO */}
        <div>
          <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
            Anexo Automático Associado
          </label>
          <div className="flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-slate-500 shrink-0" />
            <select
              value={currentTemplate.attachment_type}
              onChange={(e) => setCurrentTemplate({ ...currentTemplate, attachment_type: e.target.value as WhatsAppAttachmentType })}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-amber-500"
            >
              {Object.entries(ATTACHMENT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* STATUS ATIVO / INATIVO */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={currentTemplate.is_active}
              onChange={(e) => setCurrentTemplate({ ...currentTemplate, is_active: e.target.checked })}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
            />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Régua Ativa para Disparos Automáticos
            </span>
          </label>

          <button
            type="button"
            onClick={() => onOpenTestModal(currentTemplate)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Testar Disparo Agora</span>
          </button>
        </div>
      </div>

      {/* COLUNA DIREITA: SIMULADOR VISUAL DE SMARTPHONE (WHATSAPP PREVIEW) */}
      <div className="lg:col-span-3 space-y-4">
        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
          <Smartphone className="w-4 h-4 text-emerald-500" />
          Pré-visualização do Chat
        </h3>

        {/* MOCKUP DO WHATSAPP */}
        <div className="bg-[#0b141a] rounded-3xl border-4 border-slate-800 overflow-hidden shadow-2xl flex flex-col h-[520px]">
          {/* HEADER DO CHAT */}
          <div className="bg-[#1f2c34] px-4 py-3 flex items-center gap-3 border-b border-slate-800">
            <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
              TC
            </div>
            <div>
              <p className="text-xs font-bold text-slate-100 leading-tight">DLLOG Transportes</p>
              <p className="text-[10px] text-emerald-400 font-semibold">Conta Comercial Oficial</p>
            </div>
          </div>

          {/* ÁREA DE CONVERSA COM FUNDO DO WHATSAPP */}
          <div className="p-4 flex-1 overflow-y-auto space-y-3 bg-[#0c1317] flex flex-col justify-end">
            {/* BALÃO DE MENSAGEM */}
            <div className="max-w-[90%] self-end bg-[#005c4b] text-white rounded-2xl rounded-tr-xs p-3.5 shadow-md space-y-2 relative">
              {/* ANEXO EM DESTAQUE SE HOUVER */}
              {currentTemplate.attachment_type !== 'none' && (
                <div className="p-2.5 rounded-xl bg-[#025143] border border-emerald-400/20 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-300 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[11px] font-bold text-white truncate">
                      {currentTemplate.default_filename || 'Documento_DLLOG_Transportes.pdf'}
                    </p>
                    <p className="text-[9px] text-emerald-300">Documento em anexo • PDF</p>
                  </div>
                </div>
              )}

              {/* TEXTO FORMATADO COM SIMULAÇÃO */}
              <p className="text-xs leading-relaxed whitespace-pre-wrap font-sans">
                {simulatedBody}
              </p>

              <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-200/80 pt-1">
                <span>14:32</span>
                <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
