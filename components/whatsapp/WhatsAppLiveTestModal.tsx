import React, { useState } from 'react';
import { 
  X, 
  Send, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Smartphone,
  Paperclip
} from 'lucide-react';
import type { WhatsAppTemplate } from '../../types/whatsapp';
import { 
  enqueueWhatsAppMessage, 
  interpolateTemplate, 
  sanitizePhoneNumber,
  formatDisplayPhone 
} from '../../services/whatsappService';

interface WhatsAppLiveTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  template?: WhatsAppTemplate | null;
  onSuccess: () => void;
}

export const WhatsAppLiveTestModal: React.FC<WhatsAppLiveTestModalProps> = ({
  isOpen,
  onClose,
  template,
  onSuccess
}) => {
  const [phone, setPhone] = useState('');
  const [recipientName, setRecipientName] = useState('Motorista Teste');
  const [customBody, setCustomBody] = useState(template?.body_text || '');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSendTest = async () => {
    if (!phone.trim()) {
      setError('Por favor, informe o número de telefone de destino com DDD.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const rendered = interpolateTemplate(customBody || template?.body_text || '', {
        motorista_nome: recipientName,
        origem: 'Santos - SP',
        destino: 'Curitiba - PR',
        mercadoria: 'Soja em Grãos',
        peso: '32.000 kg',
        valor_frete: '6.800,00',
        numero_carga: 'TC-9999',
        local_coleta: 'Terminal Graneleiro 01',
        data_coleta: '20/09/2026',
        contato_coleta: '(11) 98888-7777',
        valor_adiantamento: '3.500,00',
        dados_bancarios: 'PIX (Chave Telefone)',
        numero_cte: '9901',
        placa_veiculo: 'ABC1D23',
        valor_saldo: '1.800,00'
      });

      await enqueueWhatsAppMessage({
        recipientPhone: sanitizePhoneNumber(phone),
        recipientName: recipientName,
        templateId: template?.id,
        renderedBody: rendered,
        messageType: template?.attachment_type !== 'none' ? 'document' : 'text',
        mediaFilename: template?.default_filename || 'Comprovante_DLLOG_Transportes.pdf',
        mediaUrl: template?.attachment_type !== 'none' ? 'https://transcunha.log/docs/exemplo_teste.pdf' : undefined
      });

      setSuccess(true);
      onSuccess();
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Erro ao agendar envio de teste.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div 
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="p-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 border border-white/20">
              <Smartphone className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="font-black text-base leading-tight">Homologação de Disparo</h3>
              <p className="text-xs text-emerald-100/80 mt-0.5">Envio de teste imediato via WhatsApp</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Disparo de teste enfileirado e processado com sucesso!</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                Telefone de Destino (com DDD)
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex: 11 98421-9900"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                Nome para Interpolação
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
              Texto da Mensagem a Ser Enviada
            </label>
            <textarea
              rows={4}
              value={customBody}
              onChange={(e) => setCustomBody(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {template?.attachment_type !== 'none' && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <Paperclip className="w-4 h-4 text-emerald-500" />
              <span>Será anexado o arquivo simulado: <strong>{template?.default_filename || 'documento.pdf'}</strong></span>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSendTest}
            disabled={loading || success}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md flex items-center gap-2 cursor-pointer transition-all"
          >
            <Send className="w-4 h-4" />
            <span>{loading ? 'Disparando...' : 'Enviar Mensagem de Teste'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
