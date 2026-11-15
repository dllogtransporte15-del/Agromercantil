import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Trash2, 
  Receipt, 
  Check, 
  Loader2,
  Calendar,
  DollarSign,
  Briefcase,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { openDocumentInNewTab } from '../../utils/documentViewer';
import { uploadInvoiceAttachmentToStorage } from '../../services/financialInvoiceService';
import { formatBrl } from '../../utils/financialCalculations';
import type { PayrollSettlementItem } from './AccountsPayableTab';

interface PayrollDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settlement: PayrollSettlementItem | null;
  onSave: (docKey: string, data: {
    invoiceNumber?: string;
    invoiceIssueDate?: string;
    invoiceFileUrl?: string;
    invoiceFileName?: string;
    receiptFileUrl?: string;
    receiptFileName?: string;
    paymentDate?: string;
    paymentAuthCode?: string;
    markAsPaid?: boolean;
    notes?: string;
  }) => Promise<void>;
}

export const PayrollDocsModal: React.FC<PayrollDocsModalProps> = ({
  isOpen,
  onClose,
  settlement,
  onSave
}) => {
  if (!isOpen || !settlement) return null;

  const isPjOrLeader = settlement.regime === 'PJ' || settlement.regime === 'Gestor AG';
  const isClt = settlement.regime === 'CLT';

  // Estados dos campos
  const [invoiceNumber, setInvoiceNumber] = useState(settlement.invoiceNumber || '');
  const [invoiceIssueDate, setInvoiceIssueDate] = useState(settlement.invoiceIssueDate || new Date().toISOString().split('T')[0]);
  const [invoiceFileUrl, setInvoiceFileUrl] = useState(settlement.invoiceFileUrl || '');
  const [invoiceFileName, setInvoiceFileName] = useState(settlement.invoiceFileName || '');
  const [newInvoiceFile, setNewInvoiceFile] = useState<File | null>(null);

  const [receiptFileUrl, setReceiptFileUrl] = useState(settlement.receiptFileUrl || '');
  const [receiptFileName, setReceiptFileName] = useState(settlement.receiptFileName || '');
  const [newReceiptFile, setNewReceiptFile] = useState<File | null>(null);
  const [paymentDate, setPaymentDate] = useState(settlement.paymentDate || new Date().toISOString().split('T')[0]);
  const [paymentAuthCode, setPaymentAuthCode] = useState(settlement.paymentAuthCode || '');

  const [markAsPaid, setMarkAsPaid] = useState(settlement.balancePending <= 0);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Refs de arquivo
  const invoiceInputRef = useRef<HTMLInputElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  // Sincronizar ao abrir
  useEffect(() => {
    if (settlement) {
      setInvoiceNumber(settlement.invoiceNumber || '');
      setInvoiceIssueDate(settlement.invoiceIssueDate || new Date().toISOString().split('T')[0]);
      setInvoiceFileUrl(settlement.invoiceFileUrl || '');
      setInvoiceFileName(settlement.invoiceFileName || '');
      setNewInvoiceFile(null);

      setReceiptFileUrl(settlement.receiptFileUrl || '');
      setReceiptFileName(settlement.receiptFileName || '');
      setNewReceiptFile(null);
      setPaymentDate(settlement.paymentDate || new Date().toISOString().split('T')[0]);
      setPaymentAuthCode(settlement.paymentAuthCode || '');

      setMarkAsPaid(settlement.balancePending <= 0);
      setNotes('');
    }
  }, [settlement]);

  // Checagem de documentos presentes
  const hasInvoice = Boolean(newInvoiceFile || invoiceFileUrl);
  const hasReceipt = Boolean(newReceiptFile || receiptFileUrl);

  const missingDocsList: string[] = [];
  if (isPjOrLeader) {
    if (!hasInvoice) missingDocsList.push('Nota Fiscal (NF)');
    if (!hasReceipt) missingDocsList.push('Comprovante de Pagamento');
  } else {
    // CLT
    if (!hasReceipt) missingDocsList.push('Comprovante de Pagamento');
  }

  const willBeCompleted = missingDocsList.length === 0 && (markAsPaid || settlement.balancePending <= 0);

  // Handlers de Arquivo NF
  const handleInvoiceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewInvoiceFile(file);
      setInvoiceFileName(file.name);
    }
  };

  // Handlers de Arquivo Comprovante
  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewReceiptFile(file);
      setReceiptFileName(file.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const docKey = `${settlement.userId}_${settlement.monthKey}`;
      let finalInvoiceUrl = invoiceFileUrl;
      let finalInvoiceName = invoiceFileName;

      if (newInvoiceFile) {
        finalInvoiceUrl = await uploadInvoiceAttachmentToStorage(
          newInvoiceFile,
          `payroll_nf_${settlement.userId}_${settlement.monthKey}`,
          'nf',
          newInvoiceFile.name,
          newInvoiceFile.type
        );
        finalInvoiceName = newInvoiceFile.name;
      }

      let finalReceiptUrl = receiptFileUrl;
      let finalReceiptName = receiptFileName;

      if (newReceiptFile) {
        finalReceiptUrl = await uploadInvoiceAttachmentToStorage(
          newReceiptFile,
          `payroll_rec_${settlement.userId}_${settlement.monthKey}`,
          'boleto',
          newReceiptFile.name,
          newReceiptFile.type
        );
        finalReceiptName = newReceiptFile.name;
      }

      await onSave(docKey, {
        invoiceNumber: invoiceNumber.trim() || undefined,
        invoiceIssueDate: invoiceIssueDate || undefined,
        invoiceFileUrl: finalInvoiceUrl || undefined,
        invoiceFileName: finalInvoiceName || undefined,
        receiptFileUrl: finalReceiptUrl || undefined,
        receiptFileName: finalReceiptName || undefined,
        paymentDate: paymentDate || undefined,
        paymentAuthCode: paymentAuthCode.trim() || undefined,
        markAsPaid,
        notes: notes.trim() || undefined,
      });

      onClose();
    } catch (err) {
      console.error('Erro ao salvar documentos da folha:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Cabeçalho do Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Lançar Documentos de Pagamento
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {settlement.user.name} • <span className="font-semibold">{settlement.monthLabel}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Formulário */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Banner de Contexto e Regras do Perfil */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border ${
                  settlement.regime === 'Gestor AG'
                    ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-700'
                    : settlement.regime === 'PJ'
                    ? 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-700'
                    : 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-700'
                }`}>
                  Regime: {settlement.regime}
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-600 dark:text-slate-300 font-medium">
                  {settlement.profileLabel}
                </span>
              </div>

              {settlement.isPreviousMonth && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                  <AlertTriangle className="w-3 h-3" />
                  Mês Anterior Pendente ({settlement.monthLabel})
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Bruto / Base</span>
                <strong className="text-slate-800 dark:text-slate-200">{formatBrl(settlement.grossTotal)}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Líquido Devido</span>
                <strong className="text-purple-600 dark:text-purple-400">{formatBrl(settlement.netDue)}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Já Quitado</span>
                <strong className="text-emerald-600 dark:text-emerald-400">{formatBrl(settlement.totalPaid)}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Saldo em Aberto</span>
                <strong className={settlement.balancePending > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}>
                  {formatBrl(settlement.balancePending)}
                </strong>
              </div>
            </div>

            {/* Aviso de Regra do Perfil */}
            <div className="p-2.5 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-300/60 dark:border-amber-700/60 text-amber-900 dark:text-amber-200 text-[11px] flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong>Regra de Documentação ({settlement.regime}): </strong>
                {isPjOrLeader ? (
                  <span>Para colaboradores <strong>PJ</strong> ou <strong>Agenciador Líder (Gestor AG)</strong>, é obrigatório anexar a <strong>Nota Fiscal</strong> E o <strong>Comprovante de Pagamento</strong>. Após anexar ambos e liquidar, a conta sairá da tela inicial e irá para o histórico de <strong>"Pagamento Feito"</strong>.</span>
                ) : (
                  <span>Para colaboradores <strong>CLT</strong>, é obrigatório anexar o <strong>Comprovante de Pagamento</strong> (ou holerite assinado). Após anexar e liquidar, a conta sairá da tela inicial e irá para o histórico de <strong>"Pagamento Feito"</strong>.</span>
                )}
              </div>
            </div>
          </div>

          {/* SEÇÃO 1: NOTA FISCAL (Exibida para PJ e Gestor AG) */}
          {isPjOrLeader && (
            <div className="p-4 rounded-2xl border-2 border-dashed border-purple-200 dark:border-purple-800/80 bg-purple-50/30 dark:bg-purple-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-900 dark:text-purple-300">
                  <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    1. Nota Fiscal do Prestador / Agenciador *
                  </h4>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  hasInvoice 
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                }`}>
                  {hasInvoice ? 'NF Anexada ✓' : 'Pendente NF ⚠️'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Número da Nota Fiscal
                  </label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="Ex: NF-e 2026/045"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Data de Emissão da NF
                  </label>
                  <input
                    type="date"
                    value={invoiceIssueDate}
                    onChange={(e) => setInvoiceIssueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Upload do Arquivo da NF */}
              <div>
                <input
                  type="file"
                  ref={invoiceInputRef}
                  onChange={handleInvoiceFileChange}
                  accept=".pdf,image/*"
                  className="hidden"
                />

                {(newInvoiceFile || invoiceFileUrl) ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 text-xs">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileText className="w-4 h-4 text-purple-600 shrink-0" />
                      <div className="truncate">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                          {newInvoiceFile ? newInvoiceFile.name : invoiceFileName || 'Nota_Fiscal.pdf'}
                        </span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          {newInvoiceFile ? 'Novo arquivo selecionado para upload' : 'Arquivo já salvo no servidor'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {invoiceFileUrl && !newInvoiceFile && (
                        <button
                          type="button"
                          onClick={() => openDocumentInNewTab(invoiceFileUrl, invoiceFileName || 'Nota Fiscal')}
                          className="p-1.5 rounded-lg text-purple-700 hover:bg-purple-100 dark:text-purple-300 dark:hover:bg-purple-900/50 cursor-pointer"
                          title="Abrir arquivo da Nota Fiscal em nova aba"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => invoiceInputRef.current?.click()}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                      >
                        Trocar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewInvoiceFile(null);
                          setInvoiceFileUrl('');
                          setInvoiceFileName('');
                        }}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                        title="Remover anexo da Nota Fiscal"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => invoiceInputRef.current?.click()}
                    className="w-full p-4 rounded-xl border-2 border-dashed border-purple-300 dark:border-purple-700 hover:bg-purple-100/50 dark:hover:bg-purple-900/30 transition-all flex flex-col items-center justify-center gap-1.5 text-purple-700 dark:text-purple-300 cursor-pointer"
                  >
                    <Upload className="w-5 h-5" />
                    <span className="text-xs font-bold">Clique para anexar a Nota Fiscal (PDF ou Foto)</span>
                    <span className="text-[10px] text-slate-400">Suporta arquivos PDF, PNG, JPG</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* SEÇÃO 2: COMPROVANTE DE PAGAMENTO (Para todos os regimes) */}
          <div className="p-4 rounded-2xl border-2 border-dashed border-amber-200 dark:border-amber-800/80 bg-amber-50/30 dark:bg-amber-950/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300">
                <Receipt className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  {isPjOrLeader ? '2. Comprovante de Pagamento / Transferência *' : '1. Comprovante de Pagamento / Holerite *'}
                </h4>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                hasReceipt 
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
              }`}>
                {hasReceipt ? 'Comprovante Anexado ✓' : 'Pendente Comprovante ⚠️'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Data Efetiva do Pagamento
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Autenticação / ID Transação / PIX (Opcional)
                </label>
                <input
                  type="text"
                  value={paymentAuthCode}
                  onChange={(e) => setPaymentAuthCode(e.target.value)}
                  placeholder="Ex: E18236120261025..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Upload do Arquivo de Comprovante */}
            <div>
              <input
                type="file"
                ref={receiptInputRef}
                onChange={handleReceiptFileChange}
                accept=".pdf,image/*"
                className="hidden"
              />

              {(newReceiptFile || receiptFileUrl) ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 text-xs">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Receipt className="w-4 h-4 text-amber-600 shrink-0" />
                    <div className="truncate">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                        {newReceiptFile ? newReceiptFile.name : receiptFileName || 'Comprovante_Pagamento.pdf'}
                      </span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        {newReceiptFile ? 'Novo comprovante selecionado' : 'Comprovante salvo no servidor'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {receiptFileUrl && !newReceiptFile && (
                      <button
                        type="button"
                        onClick={() => openDocumentInNewTab(receiptFileUrl, receiptFileName || 'Comprovante de Pagamento')}
                        className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/50 cursor-pointer"
                        title="Abrir comprovante em nova aba"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => receiptInputRef.current?.click()}
                      className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                    >
                      Trocar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewReceiptFile(null);
                        setReceiptFileUrl('');
                        setReceiptFileName('');
                      }}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                      title="Remover comprovante"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => receiptInputRef.current?.click()}
                  className="w-full p-4 rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-700 hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-all flex flex-col items-center justify-center gap-1.5 text-amber-700 dark:text-amber-300 cursor-pointer"
                >
                  <Upload className="w-5 h-5" />
                  <span className="text-xs font-bold">Clique para anexar o Comprovante de Pagamento (PDF ou Foto)</span>
                  <span className="text-[10px] text-slate-400">Comprovante bancário, recibo de PIX ou holerite assinado</span>
                </button>
              )}
            </div>
          </div>

          {/* SEÇÃO 3: STATUS DE LIQUIDAÇÃO */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="markAsPaidCheckbox"
                checked={markAsPaid}
                onChange={(e) => setMarkAsPaid(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
              />
              <label htmlFor="markAsPaidCheckbox" className="font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                Confirmar Pagamento 100% Liquidado
              </label>
            </div>
            <span className="text-[10px] text-slate-400">
              {markAsPaid ? 'Saldo zerado / quitado' : `Saldo restante: ${formatBrl(settlement.balancePending)}`}
            </span>
          </div>

          {/* Validador Dinâmico no Rodapé */}
          <div className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 ${
            willBeCompleted
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
          }`}>
            {willBeCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-bold">
                {willBeCompleted ? 'Pronto para concluir este acerto!' : 'Documentação Pendente'}
              </p>
              <p className="text-[11px] mt-0.5 opacity-90">
                {willBeCompleted ? (
                  <span>Todos os documentos obrigatórios para o regime <strong>{settlement.regime}</strong> foram fornecidos e o pagamento está confirmado. Ao salvar, <strong>esta conta sairá da tela inicial e irá para o histórico de "Pagamento Feito"</strong>.</span>
                ) : (
                  <span>Ainda falta anexar: <strong>{missingDocsList.join(' e ') || 'Quitação do pagamento'}</strong>. O registro será salvo, mas <strong>permanecerá na tela inicial</strong> até a conclusão completa.</span>
                )}
              </p>
            </div>
          </div>
        </form>

        {/* Rodapé do Modal */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50/70 dark:bg-slate-900/60 shrink-0">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/25 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Enviando documentos...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Salvar Documentos</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
