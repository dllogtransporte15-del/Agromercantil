import React, { useState, useRef } from 'react';
import { Shipment, User, CancelledCteRecord } from '../types';
import { uploadShipmentAttachment, upsertShipment } from '../lib/db';
import { extractFiscalDocNumbers } from '../utils/fiscalDocParser';
import { useToast } from '../hooks/useToast';
import { 
  X, 
  AlertTriangle, 
  Upload, 
  FileText, 
  ArrowRight, 
  RotateCcw, 
  CheckCircle2, 
  Loader2, 
  Info,
  ShieldAlert
} from 'lucide-react';

interface CancelAndSubstituteCteModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipment: Shipment;
  currentCteNumber: string;
  currentFileUrl?: string;
  currentFileName?: string;
  currentUser: User;
  onSuccess: (updatedShipment: Shipment) => void;
  onUpdateShipmentData?: (shipmentId: string, data: Partial<Shipment>, options?: { silent?: boolean }) => Promise<void> | void;
}

const COMMON_REASONS = [
  'Cancelamento e reemissão fiscal na SEFAZ',
  'Substituição por erro de dados / Valores divergentes',
  'Troca ou divergência de Tomador do Frete',
  'Alteração de placa ou veículo do transporte',
  'Redespacho fiscal / Reemissão por recusa',
  'Outro motivo (especificar)'
];

export const CancelAndSubstituteCteModal: React.FC<CancelAndSubstituteCteModalProps> = ({
  isOpen,
  onClose,
  shipment,
  currentCteNumber,
  currentFileUrl,
  currentFileName,
  currentUser,
  onSuccess,
  onUpdateShipmentData,
}) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [newCteNumber, setNewCteNumber] = useState('');
  const [reasonCategory, setReasonCategory] = useState(COMMON_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Extrai apenas os números do CT-e original a ser cancelado
  const cleanOriginalNumber = String(currentCteNumber || '').split('/').pop()?.trim() || String(currentCteNumber || '').trim();

  // Tratamento do upload do novo arquivo
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const normName = file.name.trim().toLowerCase();
    const cleanNormName = normName.replace(/[^a-z0-9]/g, '');

    // 1. Checa se é o mesmo arquivo do CT-e cancelado
    if (currentFileName && (currentFileName.trim().toLowerCase() === normName || (cleanNormName.length > 5 && cleanNormName === currentFileName.toLowerCase().replace(/[^a-z0-9]/g, '')))) {
      setErrorMessage(`⛔ Arquivo Duplicado: O arquivo "${file.name}" é o mesmo documento do CT-e que está sendo cancelado. Você deve anexar o novo CT-e substituto emitido.`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 2. Checa se o arquivo já foi anexado no embarque
    if (shipment.documents) {
      for (const [cat, val] of Object.entries(shipment.documents)) {
        const list = Array.isArray(val) ? val : (typeof val === 'string' ? [val] : []);
        for (const item of list) {
          if (typeof item === 'string') {
            const rawFileName = decodeURIComponent(item.split('/').pop()?.split('?')[0] || '').trim().toLowerCase();
            const cleanFileName = rawFileName.includes('_')
              ? rawFileName.split('_').slice(2).join('_') || rawFileName
              : rawFileName;

            if (rawFileName === normName || cleanFileName === normName || rawFileName.endsWith(normName) ||
                (cleanNormName.length > 5 && (rawFileName.replace(/[^a-z0-9]/g, '').includes(cleanNormName) || cleanFileName.replace(/[^a-z0-9]/g, '') === cleanNormName))) {
              setErrorMessage(`⛔ Arquivo Duplicado: O documento "${file.name}" já foi anexado neste embarque no campo "${cat}". Não é permitido duplicar anexos.`);
              setSelectedFile(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
              return;
            }
          }
        }
      }
    }

    setSelectedFile(file);
    setErrorMessage(null);
    setIsExtracting(true);

    try {
      // 1. Tenta extrair número via extractFiscalDocNumbers passando o arquivo
      const extracted = await extractFiscalDocNumbers({ 'CT-e': [file] });
      if (extracted.cteNumber && extracted.cteNumber !== cleanOriginalNumber) {
        setNewCteNumber(extracted.cteNumber);
      } else {
        // Tenta regex direta no nome do arquivo
        const nameMatch = file.name.match(/(?:cte|dacte)[^0-9]*([0-9]{3,10})/i);
        if (nameMatch && nameMatch[1] && nameMatch[1] !== cleanOriginalNumber) {
          setNewCteNumber(nameMatch[1]);
        }
      }

      // 2. Se for arquivo XML, lê o conteúdo para pegar a tag <nCT> com precisão máxima
      if (file.name.toLowerCase().endsWith('.xml')) {
        const text = await file.text();
        const nCtMatch = text.match(/<nCT>([0-9]+)<\/nCT>/i);
        if (nCtMatch && nCtMatch[1]) {
          setNewCteNumber(nCtMatch[1]);
        }
      }
    } catch (err) {
      console.warn('[CancelAndSubstituteCte] Falha na extração preliminar:', err);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const pseudoEvent = {
        target: { files: [file] }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileChange(pseudoEvent);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Preview da exibição resultante (ex: "2211/2233")
  const existingCancelledList: CancelledCteRecord[] = Array.isArray(shipment.documents?.cancelled_ctes)
    ? shipment.documents.cancelled_ctes
    : [];

  const existingNumbers = existingCancelledList
    .map(c => c.cteNumber)
    .filter(Boolean);

  // Se o CT-e atual ainda não estava em cancelled_ctes, inclui ele na lista
  const chainBeforeNew = existingNumbers.includes(cleanOriginalNumber)
    ? existingNumbers
    : [...existingNumbers, cleanOriginalNumber];

  const trimmedNewNumber = newCteNumber.trim();
  const previewChain = trimmedNewNumber
    ? [...chainBeforeNew, trimmedNewNumber].join('/')
    : `${chainBeforeNew.join('/')} / [...]`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      setErrorMessage('O upload do novo CT-e em substituição é obrigatório.');
      return;
    }

    if (!trimmedNewNumber) {
      setErrorMessage('Informe o número do novo CT-e substituto.');
      return;
    }

    if (trimmedNewNumber === cleanOriginalNumber) {
      setErrorMessage('O número do novo CT-e deve ser diferente do CT-e que está sendo cancelado.');
      return;
    }

    const finalReason = reasonCategory === 'Outro motivo (especificar)'
      ? (customReason.trim() || 'Substituição fiscal de CT-e')
      : (customReason.trim() ? `${reasonCategory} - ${customReason.trim()}` : reasonCategory);

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. Upload do novo arquivo de CT-e para o storage
      const uploadedUrl = await uploadShipmentAttachment(shipment.id, 'CT-e', selectedFile);

      // 2. Registro do CT-e cancelado
      const newCancelledRecord: CancelledCteRecord = {
        cteNumber: cleanOriginalNumber,
        fileUrl: currentFileUrl,
        fileName: currentFileName || (currentFileUrl ? currentFileUrl.split('/').pop()?.split('?')[0] : `CT-e ${cleanOriginalNumber}`),
        cancelledAt: new Date().toISOString(),
        cancelledBy: currentUser.name || currentUser.email || 'Usuário',
        reason: finalReason,
        substituteCteNumber: trimmedNewNumber,
        substituteFileUrl: uploadedUrl
      };

      const updatedCancelledCtes = [...existingCancelledList, newCancelledRecord];

      // 3. Monta a cadeia completa de numeração (ex: "2211/2233")
      const finalChainNumbers = [
        ...updatedCancelledCtes.map(c => c.cteNumber).filter(Boolean),
        trimmedNewNumber
      ];
      // Remove duplicatas consecutivas caso existam
      const finalFullCteNumber = Array.from(new Set(finalChainNumbers)).join('/');

      // 4. Atualiza a lista de anexos de CT-e (preserva os anteriores e adiciona o novo)
      const currentCteFilesRaw = shipment.documents?.['CT-e'];
      const currentFileList: string[] = Array.isArray(currentCteFilesRaw)
        ? currentCteFilesRaw
        : (typeof currentCteFilesRaw === 'string' ? [currentCteFilesRaw] : []);

      const updatedCteFiles = Array.from(new Set([...currentFileList, uploadedUrl]));

      // 5. Atualiza documentos do embarque
      const updatedDocs = {
        ...(shipment.documents || {}),
        'CT-e': updatedCteFiles,
        cte_number: finalFullCteNumber,
        active_cte_number: trimmedNewNumber,
        active_cte_url: uploadedUrl,
        cancelled_ctes: updatedCancelledCtes,
      };

      // 6. Adiciona entrada de auditoria no histórico
      const historyLogEntry = {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        action: 'CTE_CANCELADO_SUBSTITUIDO',
        description: `CT-e nº ${cleanOriginalNumber} cancelado e substituído pelo CT-e nº ${trimmedNewNumber}. Motivo: ${finalReason}`,
        timestamp: new Date().toISOString(),
        userId: currentUser.id || 'system',
        userName: currentUser.name || 'Usuário'
      };

      const updatedHistory = [...(shipment.history || []), historyLogEntry];

      const updatedShipment: Shipment = {
        ...shipment,
        cteNumber: finalFullCteNumber,
        documents: updatedDocs,
        history: updatedHistory
      };

      // 7. Persistência no banco via upsertShipment
      await upsertShipment(updatedShipment);

      // 8. Se houver prop de atualização no componente pai, aciona
      if (onUpdateShipmentData) {
        await onUpdateShipmentData(shipment.id, {
          cteNumber: finalFullCteNumber,
          documents: updatedDocs,
          history: updatedHistory
        });
      }

      showToast(`✓ CT-e ${cleanOriginalNumber} cancelado e substituído com sucesso pelo CT-e ${trimmedNewNumber}!`, 'success');
      onSuccess(updatedShipment);
      onClose();
    } catch (err: any) {
      console.error('[CancelAndSubstituteCteModal] Erro ao substituir CT-e:', err);
      setErrorMessage(err?.message || 'Falha ao salvar a substituição do CT-e. Verifique a conexão e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden text-slate-800 dark:text-slate-100 flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                Cancelar CT-e & Adicionar Substituto
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                O CT-e cancelado permanecerá registrado com marcação especial e histórico
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Card do CT-e Atual Sendo Cancelado */}
          <div className="p-4 rounded-xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" /> CT-e a ser Cancelado
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                Ficará gravado como CANCELADO
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-lg font-black font-mono text-slate-900 dark:text-white line-through decoration-rose-500 decoration-2">
                  CT-e nº {cleanOriginalNumber || 'Não informado'}
                </div>
                {currentFileName && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-sm mt-0.5">
                    Arquivo: {currentFileName}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Upload do Novo CT-e (Obrigatório) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              Novo CT-e Substituto (PDF ou XML) <span className="text-rose-500">*</span>
            </label>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className={`p-4 border-2 border-dashed rounded-xl cursor-pointer text-center transition-all ${
                selectedFile
                  ? 'border-emerald-500/60 bg-emerald-500/5 dark:bg-emerald-950/20'
                  : 'border-slate-300 dark:border-slate-700 hover:border-amber-500/60 hover:bg-slate-50 dark:hover:bg-slate-800/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.xml,application/pdf,text/xml,application/xml"
                onChange={handleFileChange}
                className="hidden"
              />
              {selectedFile ? (
                <div className="flex items-center justify-between gap-3 text-left">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {(selectedFile.size / 1024).toFixed(1)} KB • Clique para trocar
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 shrink-0 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Selecionado
                  </span>
                </div>
              ) : (
                <div className="py-2">
                  <Upload className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-500 mb-1.5" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Arraste o arquivo do novo CT-e aqui ou <span className="text-amber-600 dark:text-amber-400 underline">clique para selecionar</span>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Formatos aceitos: PDF ou XML (DACTE)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Número do Novo CT-e */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Número do Novo CT-e Substituto <span className="text-rose-500">*</span>
              </label>
              {isExtracting && (
                <span className="text-[10px] font-semibold text-amber-500 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Lendo arquivo...
                </span>
              )}
            </div>
            <input
              type="text"
              value={newCteNumber}
              onChange={e => setNewCteNumber(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Ex: 2233"
              className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              required
            />
          </div>

          {/* Motivo do Cancelamento / Substituição */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              Motivo do Cancelamento / Substituição
            </label>
            <select
              value={reasonCategory}
              onChange={e => setReasonCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 mb-2 cursor-pointer"
            >
              {COMMON_REASONS.map(reason => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>

            <textarea
              value={customReason}
              onChange={e => setCustomReason(e.target.value)}
              placeholder="Detalhes adicionais ou justificativa para a auditoria fiscal (opcional)..."
              rows={2}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
            />
          </div>

          {/* Preview da Exibição nos Fronts */}
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-amber-500" /> Como aparecerá em todos os fronts do sistema:
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[11px] font-mono font-bold line-through">
                {cleanOriginalNumber}
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <div className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-mono font-bold">
                {trimmedNewNumber || 'Novo CT-e'}
              </div>
              <span className="text-xs text-slate-400 mx-1">=</span>
              <div className="px-3 py-1 rounded-lg bg-amber-600 text-white font-mono font-black text-xs shadow-xs">
                {previewChain}
              </div>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            Cancelar Operação
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedFile || !trimmedNewNumber}
            className="px-4 py-2 text-xs font-black text-white bg-amber-600 hover:bg-amber-500 active:scale-95 rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Registrando Substituição...</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                <span>Confirmar & Substituir CT-e</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
