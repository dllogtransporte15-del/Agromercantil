import React, { useState } from 'react';
import { Shipment } from '../types';
import { syncAllShipmentsDocuments, SyncResult } from '../utils/batchDocSync';
import { X, RefreshCw, CheckCircle2, AlertTriangle, FileText, Sparkles, Layers, ShieldCheck } from 'lucide-react';
import { useToast } from '../hooks/useToast';

interface SyncDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipments: Shipment[];
  onBatchUpdateShipments: (updatedShipments: Shipment[]) => Promise<void> | void;
}

export const SyncDocumentsModal: React.FC<SyncDocumentsModalProps> = ({
  isOpen,
  onClose,
  shipments,
  onBatchUpdateShipments,
}) => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number; text: string }>({
    current: 0,
    total: 0,
    text: '',
  });
  const [result, setResult] = useState<SyncResult | null>(null);
  const { showToast } = useToast();

  if (!isOpen) return null;

  const eligibleShipments = shipments.filter(s => s.documents && Object.keys(s.documents).length > 0);

  const handleStartSync = async () => {
    setIsRunning(true);
    setResult(null);

    try {
      const syncResult = await syncAllShipmentsDocuments(shipments, (current, total, id, text) => {
        setProgress({ current, total, text });
      });

      setResult(syncResult);

      if (syncResult.updatedShipments.length > 0) {
        await onBatchUpdateShipments(syncResult.updatedShipments);
        showToast(`${syncResult.totalUpdated} embarque(s) sincronizados com sucesso!`, 'success');
      } else {
        showToast('Todos os embarques já estão sincronizados e com dados atualizados.', 'info');
      }
    } catch (err: any) {
      showToast(err?.message || 'Erro ao sincronizar documentos em lote.', 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-slate-900 to-indigo-950 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/20">
              <RefreshCw className={`w-5 h-5 ${isRunning ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h3 className="text-sm font-bold">Sincronização em Lote de Documentos</h3>
              <p className="text-[11px] text-indigo-200">
                Lê e sincroniza CT-e, Nota Fiscal, MDF-e e Carta Frete em todos os embarques
              </p>
            </div>
          </div>
          {!isRunning && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/10 text-gray-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="p-3.5 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800/40 text-xs space-y-1.5">
            <p className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              O que será extraído e sincronizado automaticamente:
            </p>
            <ul className="list-disc list-inside text-indigo-800 dark:text-indigo-300 space-y-1 pl-1 text-[11px]">
              <li><strong>CT-e:</strong> Número do CT-e, data/hora de emissão e prestação de frete.</li>
              <li><strong>Nota Fiscal (NF-e):</strong> Número da NF-e e valor da mercadoria averbada (base de cálculo de seguros).</li>
              <li><strong>MDF-e:</strong> Número do Manifesto e placas dos veículos.</li>
              <li><strong>Carta Frete:</strong> Adiantamento (R$ e %), Pedágio, Saldo e Chave PIX.</li>
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl border dark:border-gray-700">
              <p className="text-[10px] uppercase font-bold text-gray-500">Total de Embarques</p>
              <p className="text-xl font-mono font-black text-gray-900 dark:text-white mt-0.5">
                {shipments.length}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl border dark:border-gray-700">
              <p className="text-[10px] uppercase font-bold text-gray-500">Com Documentos Anexos</p>
              <p className="text-xl font-mono font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                {eligibleShipments.length}
              </p>
            </div>
          </div>

          {/* Barra de Progresso */}
          {isRunning && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-300">
                <span>{progress.text || 'Processando leitura de arquivos...'}</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400">{percent}%</span>
              </div>
              <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-300" 
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-500 text-center font-mono">
                {progress.current} de {progress.total} embarques analisados
              </p>
            </div>
          )}

          {/* Resultado Final */}
          {result && !isRunning && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs space-y-1">
              <p className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Sincronização Finalizada!
              </p>
              <p className="text-emerald-800 dark:text-emerald-300 text-[11px]">
                • {result.totalProcessed} embarque(s) com anexos analisados.<br />
                • <strong>{result.totalUpdated} embarque(s)</strong> atualizados e equalizados com os dados dos documentos.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900/60 border-t dark:border-gray-700 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isRunning}
            className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors disabled:opacity-50"
          >
            {result ? 'Fechar' : 'Cancelar'}
          </button>
          {!result && (
            <button
              type="button"
              onClick={handleStartSync}
              disabled={isRunning || eligibleShipments.length === 0}
              className="px-5 py-2 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
              <span>{isRunning ? 'Sincronizando...' : 'Iniciar Sincronização Agora'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
