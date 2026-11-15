import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Check, Trash2, X, Sparkles, Tag, Clock } from 'lucide-react';
import type { Shipment } from '../types';
import { ShipmentStatus } from '../types';

interface StatusPendingModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipment: Shipment | null;
  onSave: (shipmentId: string, pendingObservation: string) => Promise<void> | void;
}

const STATUS_SUGGESTIONS: Partial<Record<ShipmentStatus, string[]>> = {
  [ShipmentStatus.PreCadastro]: [
    'Aguardando dados do motorista',
    'Aguardando foto da CNH',
    'Pendente consulta ANTT',
    'Aguardando confirmação de placas',
  ],
  [ShipmentStatus.AguardandoSeguradora]: [
    'Aguardando facial',
    'Pendente consulta CNH',
    'Aguardando liberação de perfil',
    'Aguardando retorno do GR',
    'Pendente cadastro proprietário',
    'Pendente validação Buonnyp/Pamcard',
  ],
  [ShipmentStatus.AguardandoCarregamento]: [
    'Fila do pátio',
    'Aguardando ordem de coleta',
    'Aguardando liberação de pátio',
    'Veículo em manutenção',
    'Aguardando chegar no carregamento',
    'Carregamento previsto p/ tarde',
  ],
  [ShipmentStatus.AguardandoNota]: [
    'Aguardando emissão NF-e',
    'Pendente conferência de peso',
    'Nota fiscal divergente',
    'Aguardando liberação de balança',
    'Aguardando conferência do cliente',
  ],
  [ShipmentStatus.AguardandoFiscal]: [
    'Pendente emissão CT-e',
    'Aguardando MDF-e',
    'SEFAZ em contingência',
    'Aguardando validação fiscal',
    'Aguardando averbação',
  ],
  [ShipmentStatus.AguardandoAdiantamento]: [
    'Aguardando comprovante PIX',
    'Conta bancária divergente',
    'Aguardando aprovação de adiantamento',
    'Pendente recarga tag pedágio',
    'Aguardando liberação financeira',
  ],
  [ShipmentStatus.AguardandoAgendamento]: [
    'Aguardando janela de descarga',
    'Pendente troca de NF-e',
    'Agendamento rejeitado pelo cliente',
    'Tentando reagendamento de data',
  ],
  [ShipmentStatus.AguardandoDescarga]: [
    'Fila de descarga',
    'Aguardando descarregar',
    'Pátio do cliente lotado',
    'Classificação de produto pendente',
    'Veículo em trânsito p/ destino',
  ],
  [ShipmentStatus.ValidacaoTicket]: [
    'Aguardando envio do ticket',
    'Divergência de peso no ticket',
    'Ticket ilegível / foto cortada',
    'Pendente conferência de quebra',
  ],
  [ShipmentStatus.AguardandoPagamentoSaldo]: [
    'Aguardando comprovante de saldo',
    'Pendente conferência de descontos',
    'Aguardando aprovação diretoria',
    'Conta bancária com inconsistência',
  ],
};

const GENERAL_SUGGESTIONS = [
  'Aguardando retorno',
  'Pendente documentação',
  'Aguardando liberação',
  'Contato com motorista pendente',
  'Em análise operacional',
];

export const StatusPendingModal: React.FC<StatusPendingModalProps> = ({
  isOpen,
  onClose,
  shipment,
  onSave,
}) => {
  const [observation, setObservation] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && shipment) {
      setObservation(shipment.statusPendingObservation || '');
      setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.select();
      }, 50);
    } else {
      setObservation('');
    }
  }, [isOpen, shipment]);

  if (!isOpen || !shipment) return null;

  const statusSuggestions = STATUS_SUGGESTIONS[shipment.status] || GENERAL_SUGGESTIONS;

  const handleSelectSuggestion = (suggestion: string) => {
    if (!observation.trim()) {
      setObservation(suggestion);
    } else if (!observation.includes(suggestion)) {
      setObservation(`${observation.trim()}, ${suggestion}`);
    }
    textareaRef.current?.focus();
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSave(shipment.id, observation.trim());
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSave(shipment.id, '');
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-amber-50/70 dark:bg-amber-950/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>Pendência do Status</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-800/60 text-amber-900 dark:text-amber-200">
                  {shipment.status}
                </span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Placa: <strong className="text-gray-700 dark:text-gray-200">{shipment.horsePlate}</strong> • Motorista: <strong className="text-gray-700 dark:text-gray-200">{shipment.driverName}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
              Descrição da Pendência ou Bloqueio
            </label>
            <textarea
              ref={textareaRef}
              rows={3}
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Ex: Aguardando facial, pendente consulta CNH, fila do pátio..."
              className="w-full p-3 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700/80 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all shadow-inner outline-none"
            />
            <div className="flex justify-between items-center mt-1 text-[11px] text-gray-400">
              <span>Dica: Use Ctrl + Enter para salvar rapidamente.</span>
              <span>{observation.length} caracteres</span>
            </div>
          </div>

          {/* Sugestões Rápidas */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Sugestões rápidas para {shipment.status}:</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
              {statusSuggestions.map((sug, idx) => {
                const isSelected = observation.includes(sug);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSuggestion(sug)}
                    className={`text-xs px-2.5 py-1 rounded-md border transition-all text-left flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-amber-100 dark:bg-amber-900/60 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-semibold shadow-xs'
                        : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:border-amber-300 hover:text-amber-800'
                    }`}
                  >
                    <Tag className="w-2.5 h-2.5 opacity-60 shrink-0" />
                    <span>{sug}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
          <div>
            {shipment.statusPendingObservation && (
              <button
                type="button"
                onClick={handleClear}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-900/40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar Pendência</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'Salvando...' : 'Salvar Pendência'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusPendingModal;

