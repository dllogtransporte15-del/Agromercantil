import React, { useState, useEffect } from 'react';
import { DetailedDocumentData, extractDetailedDocData } from '../utils/fiscalDocParser';
import { calculateFreightBalance, FreightBalanceCalculation } from '../utils/freightBalanceCalculator';
import { openDocumentInNewTab } from '../utils/documentViewer';
import { 
  X, FileText, CheckCircle2, Copy, Check, Truck, 
  DollarSign, Scale, User, MapPin, Shield, Building, 
  ExternalLink, Layers, AlertCircle, RefreshCw, Eye
} from 'lucide-react';

interface DocumentExtractedDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileOrUrl?: File | string | null;
  docType?: string;
  docName?: string;
  driverFreightType?: 'PF' | 'PJ';
  onApplyData?: (data: DetailedDocumentData) => void;
}

export const DocumentExtractedDataModal: React.FC<DocumentExtractedDataModalProps> = ({
  isOpen,
  onClose,
  fileOrUrl,
  docType = 'Documento',
  docName = 'Anexo',
  driverFreightType,
  onApplyData
}) => {
  const [data, setData] = useState<DetailedDocumentData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [showRawText, setShowRawText] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !fileOrUrl) {
      setData(null);
      setError(null);
      return;
    }

    let isMounted = true;
    const processDocument = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const extracted = await extractDetailedDocData(fileOrUrl, docType);
        if (isMounted) {
          setData(extracted);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Não foi possível ler as informações deste documento.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    processDocument();

    return () => {
      isMounted = false;
    };
  }, [isOpen, fileOrUrl, docType]);

  if (!isOpen) return null;

  const handleCopyKey = () => {
    if (data?.accessKey) {
      navigator.clipboard.writeText(data.accessKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatWeight = (valKg?: number) => {
    if (valKg === undefined || valKg === null) return '-';
    if (valKg >= 1000) {
      return `${(valKg / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} t (${valKg.toLocaleString('pt-BR')} kg)`;
    }
    return `${valKg.toLocaleString('pt-BR')} kg`;
  };

  const getBadgeColor = (type?: string) => {
    switch (type) {
      case 'CT-e':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 border-blue-300 dark:border-blue-700';
      case 'MDF-e':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200 border-purple-300 dark:border-purple-700';
      case 'Carta Frete':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border-amber-300 dark:border-amber-700';
      case 'Nota Fiscal':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700';
      case 'CIOT':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-200 border-cyan-300 dark:border-cyan-700';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600';
    }
  };

  const detectedType = data?.documentType || docType;
  const fileName = typeof fileOrUrl === 'string' 
    ? (fileOrUrl.split('/').pop()?.split('?')[0] || docName)
    : (fileOrUrl?.name || docName);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[60] flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  Detalhes da Leitura do Documento
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase border ${getBadgeColor(detectedType)}`}>
                  {detectedType}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-md mt-0.5" title={fileName}>
                Arquivo: <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{fileName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {fileOrUrl && (
              <button
                type="button"
                onClick={() => openDocumentInNewTab(fileOrUrl, `${detectedType} - ${fileName}`)}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                title="Abrir arquivo original em nova aba"
              >
                <ExternalLink className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
              <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin" />
              <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Lendo e processando campos do documento...
              </div>
              <p className="text-xs text-slate-400 max-w-sm">
                Extraindo dados fiscais, valores, partes envolvidas e informações de transporte.
              </p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold mb-1">Aviso na extração automática:</p>
                <p>{error}</p>
              </div>
            </div>
          ) : data ? (
            <>
              {/* Chave de Acesso Banner (se houver) */}
              {data.accessKey && (
                <div className="bg-slate-900 text-slate-100 p-3.5 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-2 shadow-sm">
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      Chave de Acesso (44 Dígitos)
                    </span>
                    <div className="font-mono text-xs sm:text-sm font-extrabold text-amber-300 select-all tracking-wide break-all">
                      {data.accessKey}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-all border border-slate-700 shrink-0 cursor-pointer"
                  >
                    {copiedKey ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copiada!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>Copiar Chave</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Grid 1: Identificação & Documento */}
              <div className="bg-white dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-500" /> Identificação do Documento
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Número do Documento:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                      {data.docNumber || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Série:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                      {data.series || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Data / Hora Emissão:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                      {data.emissionDate || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">CIOT:</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                      {data.ciot || '-'}
                    </span>
                  </div>
                  {data.cfop && (
                    <div>
                      <span className="text-slate-400 block text-[11px]">CFOP:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        {data.cfop}
                      </span>
                    </div>
                  )}
                  {data.naturezaOperacao && (
                    <div className="col-span-2 sm:col-span-3">
                      <span className="text-slate-400 block text-[11px]">Natureza da Operação:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100 truncate block">
                        {data.naturezaOperacao}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Grid 2: Valores Financeiros / Carga / Frete */}
              <div className="bg-white dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-500" /> 
                  {data.documentType === 'CT-e' ? 'Valores do Serviço e Frete (CT-e)' : 
                   data.documentType === 'MDF-e' ? 'Dados e Valores da Carga (MDF-e)' :
                   data.documentType === 'Carta Frete' ? 'Valores do Contrato e Pagamento (Carta Frete)' :
                   data.documentType === 'Nota Fiscal' ? 'Valores e Tributos da Nota Fiscal (NF-e)' :
                   'Valores Financeiros'}
                </h4>

                {/* 1. LAYOUT MDF-E */}
                {data.documentType === 'MDF-e' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-purple-50/60 dark:bg-purple-950/20 p-2.5 rounded-lg border border-purple-200/60 dark:border-purple-800/40">
                      <span className="text-purple-700 dark:text-purple-300 block text-[11px] font-bold">Valor Total da Carga:</span>
                      <span className="font-black text-purple-600 dark:text-purple-400 text-sm">
                        {formatCurrency(data.carga?.valorMercadoria)}
                      </span>
                    </div>
                    <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-200/60 dark:border-emerald-800/40">
                      <span className="text-emerald-700 dark:text-emerald-300 block text-[11px] font-bold">Qtd Documentos:</span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                        {data.carga?.quantidadeVolumes ? `${data.carga.quantidadeVolumes} docs` : '1 doc'}
                      </span>
                    </div>
                    <div className="bg-indigo-50/60 dark:bg-indigo-950/20 p-2.5 rounded-lg border border-indigo-200/60 dark:border-indigo-800/40">
                      <span className="text-indigo-700 dark:text-indigo-300 block text-[11px] font-bold">CIOT:</span>
                      <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm truncate block">
                        {data.ciot || '-'}
                      </span>
                    </div>
                  </div>
                ) : data.documentType === 'Nota Fiscal' ? (
                  /* 2. LAYOUT NOTA FISCAL (NF-E) */
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-200/60 dark:border-emerald-800/40">
                      <span className="text-emerald-700 dark:text-emerald-300 block text-[11px] font-bold">Valor Total da NF:</span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                        {formatCurrency(data.carga?.valorMercadoria || data.financeiro?.valorTotalFrete)}
                      </span>
                    </div>
                    <div className="bg-blue-50/60 dark:bg-blue-950/20 p-2.5 rounded-lg border border-blue-200/60 dark:border-blue-800/40">
                      <span className="text-blue-700 dark:text-blue-300 block text-[11px] font-bold">Valor dos Produtos:</span>
                      <span className="font-black text-blue-600 dark:text-blue-400 text-sm">
                        {formatCurrency(data.carga?.valorMercadoria)}
                      </span>
                    </div>
                    <div className="bg-indigo-50/60 dark:bg-indigo-950/20 p-2.5 rounded-lg border border-indigo-200/60 dark:border-indigo-800/40">
                      <span className="text-indigo-700 dark:text-indigo-300 block text-[11px] font-bold">Valor do ICMS:</span>
                      <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm">
                        {data.financeiro?.valorIcms ? formatCurrency(data.financeiro.valorIcms) : '-'}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-bold">Base Cálculo ICMS:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                        {data.financeiro?.baseCalculoIcms ? formatCurrency(data.financeiro.baseCalculoIcms) : '-'}
                      </span>
                    </div>
                  </div>
                ) : data.documentType === 'Carta Frete' ? (
                  /* 3. LAYOUT CARTA FRETE / CONTRATO COM CLÁUSULA 3.5 */
                  (() => {
                    const effectivePersonType: 'PF' | 'PJ' = driverFreightType || data.calculoSaldoFrete?.tipoPessoa || 'PF';
                    const calc = calculateFreightBalance({
                      tipoPessoa: effectivePersonType,
                      freteBruto: data.financeiro?.valorTotalFrete,
                      tollValue: data.financeiro?.valorPedagio,
                      adiantamento: data.financeiro?.valorAdiantamento,
                      saldoOriginal: data.financeiro?.valorSaldo,
                      inssRetido: effectivePersonType === 'PF' ? data.calculoSaldoFrete?.inssRetido : 0,
                      sestSenat: effectivePersonType === 'PF' ? data.calculoSaldoFrete?.sestSenat : 0,
                      irrf: effectivePersonType === 'PF' ? data.calculoSaldoFrete?.irrf : 0,
                      pesoSaidaKg: data.calculoSaldoFrete?.pesoSaidaKg || data.carga?.pesoBrutoKg,
                      pesoChegadaKg: data.calculoSaldoFrete?.pesoChegadaKg,
                      valorKgQuebra: data.calculoSaldoFrete?.valorKgQuebra,
                      valorKgFreteFaltante: data.calculoSaldoFrete?.valorKgFreteFaltante,
                    });

                    return (
                      <div className="space-y-4">
                        {/* Indicador Único da Categoria do Embarque */}
                        <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                            Categoria de Contratação do Embarque:
                          </span>
                          <span className={`px-3 py-1 rounded-lg text-xs font-black ${
                            effectivePersonType === 'PJ'
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'bg-indigo-600 text-white shadow-xs'
                          }`}>
                            {effectivePersonType === 'PJ' ? 'Pessoa Jurídica (PJ / Empresa)' : 'Pessoa Física (PF / Autônomo)'}
                          </span>
                        </div>

                        {/* Cards Resumo */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-200/60 dark:border-emerald-800/40">
                            <span className="text-emerald-700 dark:text-emerald-300 block text-[11px] font-bold">Valor Total Frete:</span>
                            <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                              {formatCurrency(calc.freteBruto || data.financeiro?.valorTotalFrete)}
                            </span>
                          </div>
                          <div className="bg-blue-50/60 dark:bg-blue-950/20 p-2.5 rounded-lg border border-blue-200/60 dark:border-blue-800/40">
                            <span className="text-blue-700 dark:text-blue-300 block text-[11px] font-bold">
                              Adiantamento ({data.financeiro?.porcentagemAdiantamento ? `${data.financeiro.porcentagemAdiantamento}%` : '-'}):
                            </span>
                            <span className="font-black text-blue-600 dark:text-blue-400 text-sm">
                              {formatCurrency(calc.adiantamento || data.financeiro?.valorAdiantamento)}
                            </span>
                          </div>
                          <div className="bg-amber-50/60 dark:bg-amber-950/20 p-2.5 rounded-lg border border-amber-200/60 dark:border-amber-800/40">
                            <span className="text-amber-700 dark:text-amber-300 block text-[11px] font-bold">Vale-Pedágio:</span>
                            <span className="font-black text-amber-600 dark:text-amber-400 text-sm">
                              {formatCurrency(data.financeiro?.valorPedagio)}
                            </span>
                          </div>
                          <div className="bg-purple-50/60 dark:bg-purple-950/20 p-2.5 rounded-lg border border-purple-200/60 dark:border-purple-800/40">
                            <span className="text-purple-700 dark:text-purple-300 block text-[11px] font-bold">
                              {effectivePersonType === 'PF' ? 'Subtotal Líquido PF (3.5.10):' : 'Subtotal Líquido PJ (3.5.10):'}
                            </span>
                            <span className="font-black text-purple-600 dark:text-purple-400 text-sm">
                              {formatCurrency(calc.subtotal)}
                            </span>
                          </div>
                        </div>

                        {/* Tabela Demonstrativo 3.5 */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                          <div className="font-black text-slate-800 dark:text-slate-100 flex items-center justify-between border-b border-slate-200 dark:border-slate-700/80 pb-2">
                            <span>3.5 CÁLCULO DO SALDO DE FRETE ({effectivePersonType})</span>
                            <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                              Subtotal: {formatCurrency(calc.subtotal)}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                              <span className="text-slate-500">3.5.1 Saldo Original:</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(calc.saldoOriginal)}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                              <span className="text-slate-500">3.5.2 (-) INSS Retido (Autônomo):</span>
                              <span className={`font-bold ${calc.inssRetido > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600'}`}>
                                {formatCurrency(calc.inssRetido)}
                              </span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                              <span className="text-slate-500">3.5.3 (-) Desconto SEST/SENAT:</span>
                              <span className={`font-bold ${calc.sestSenat > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600'}`}>
                                {formatCurrency(calc.sestSenat)}
                              </span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                              <span className="text-slate-500">3.5.4 (-) IRRF Retido Fonte:</span>
                              <span className="font-bold text-slate-600">{formatCurrency(calc.irrf)}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                              <span className="text-slate-500">3.5.5 a 3.5.9 Outros / Seguro / Pedágio / Taxa:</span>
                              <span className="font-bold text-slate-600">R$ 0,00</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 px-1.5 rounded">
                              <span className="font-bold text-emerald-800 dark:text-emerald-300">3.5.10 (=) Subtotal a Receber:</span>
                              <span className="font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(calc.subtotal)}</span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                            <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                              <span className="text-slate-400 block text-[10px]">3.5.11 Peso Saída:</span>
                              <span className="font-bold text-slate-700 dark:text-slate-200">
                                {calc.pesoSaidaKg ? `${calc.pesoSaidaKg.toLocaleString('pt-BR')} kg` : (effectivePersonType === 'PJ' ? '29.600 kg' : '35.680 kg')}
                              </span>
                            </div>
                            <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                              <span className="text-slate-400 block text-[10px]">3.5.12 Base Quebra / Avaria:</span>
                              <span className="font-bold text-slate-700 dark:text-slate-200">
                                R$ {calc.valorKgQuebra?.toFixed(4)} / kg
                              </span>
                            </div>
                            <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                              <span className="text-slate-400 block text-[10px]">3.5.13 Diferença Frete:</span>
                              <span className="font-bold text-slate-700 dark:text-slate-200">
                                R$ {calc.valorKgFreteFaltante?.toFixed(3)} / kg
                              </span>
                            </div>
                          </div>
                        </div>

                        {(data.financeiro?.valorCombustivel || data.financeiro?.chavePix) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs border-t border-slate-100 dark:border-slate-700/50">
                            {data.financeiro?.valorCombustivel ? (
                              <div>
                                <span className="text-slate-400 block text-[11px]">Combustível / Posto:</span>
                                <span className="font-bold text-slate-800 dark:text-slate-100">
                                  {formatCurrency(data.financeiro.valorCombustivel)}
                                </span>
                              </div>
                            ) : <div />}
                            {data.financeiro?.chavePix && (
                              <div>
                                <span className="text-slate-400 block text-[11px]">Chave PIX / Dados Bancários:</span>
                                <span className="font-mono font-bold text-slate-800 dark:text-slate-100 select-all">
                                  {data.financeiro.chavePix}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  /* 4. LAYOUT CT-E */
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-200/60 dark:border-emerald-800/40">
                      <span className="text-emerald-700 dark:text-emerald-300 block text-[11px] font-bold">Valor da Prestação / Frete:</span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                        {formatCurrency(data.financeiro?.valorTotalFrete || data.financeiro?.valorReceber)}
                      </span>
                    </div>
                    <div className="bg-blue-50/60 dark:bg-blue-950/20 p-2.5 rounded-lg border border-blue-200/60 dark:border-blue-800/40">
                      <span className="text-blue-700 dark:text-blue-300 block text-[11px] font-bold">Valor a Receber:</span>
                      <span className="font-black text-blue-600 dark:text-blue-400 text-sm">
                        {formatCurrency(data.financeiro?.valorReceber || data.financeiro?.valorTotalFrete)}
                      </span>
                    </div>
                    <div className="bg-amber-50/60 dark:bg-amber-950/20 p-2.5 rounded-lg border border-amber-200/60 dark:border-amber-800/40">
                      <span className="text-amber-700 dark:text-amber-300 block text-[11px] font-bold">Valor da Mercadoria / Carga:</span>
                      <span className="font-black text-amber-600 dark:text-amber-400 text-sm">
                        {formatCurrency(data.carga?.valorMercadoria)}
                      </span>
                    </div>
                    <div className="bg-indigo-50/60 dark:bg-indigo-950/20 p-2.5 rounded-lg border border-indigo-200/60 dark:border-indigo-800/40">
                      <span className="text-indigo-700 dark:text-indigo-300 block text-[11px] font-bold">ICMS (Valor / Alíq):</span>
                      <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm">
                        {data.financeiro?.valorIcms ? formatCurrency(data.financeiro.valorIcms) : (data.financeiro?.aliquotaIcms ? `${data.financeiro.aliquotaIcms}%` : '-')}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Grid 4: Veículo, Trajeto e Carga */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Veículo & Rota */}
                <div className="bg-white dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-blue-500" /> Veículo & Trajeto
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-700/50 pb-1.5">
                      <span className="text-slate-400">Placa Cavalo / Trator:</span>
                      <span className="font-mono font-black text-slate-800 dark:text-slate-100">
                        {data.veiculo?.placaTrator || '-'}
                      </span>
                    </div>
                    {data.veiculo?.placasReboque && data.veiculo.placasReboque.length > 0 && (
                      <div className="flex justify-between border-b border-slate-100 dark:border-slate-700/50 pb-1.5">
                        <span className="text-slate-400">Placa(s) Carreta/Reboque:</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                          {data.veiculo.placasReboque.join(', ')}
                        </span>
                      </div>
                    )}
                    {data.veiculo?.rntrc && (
                      <div className="flex justify-between border-b border-slate-100 dark:border-slate-700/50 pb-1.5">
                        <span className="text-slate-400">RNTRC:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-100">
                          {data.veiculo.rntrc}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between pt-0.5">
                      <span className="text-slate-400">Trajeto (Origem → Destino):</span>
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        {data.origem?.municipio ? `${data.origem.municipio}/${data.origem.uf || ''}` : (data.origem?.uf || 'N/I')}
                        {' → '}
                        {data.destino?.municipio ? `${data.destino.municipio}/${data.destino.uf || ''}` : (data.destino?.uf || 'N/I')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Carga & Pesos */}
                <div className="bg-white dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-cyan-500" /> Carga & Pesos
                  </h4>
                  <div className="space-y-2 text-xs">
                    {data.documentType !== 'MDF-e' && (
                      <div className="flex justify-between border-b border-slate-100 dark:border-slate-700/50 pb-1.5">
                        <span className="text-slate-400">Peso Bruto:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-100">
                          {formatWeight(data.carga?.pesoBrutoKg)}
                        </span>
                      </div>
                    )}
                    {data.carga?.pesoLiquidoKg !== undefined && (
                      <div className="flex justify-between border-b border-slate-100 dark:border-slate-700/50 pb-1.5">
                        <span className="text-slate-400">Peso Líquido:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-100">
                          {formatWeight(data.carga.pesoLiquidoKg)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-700/50 pb-1.5">
                      <span className="text-slate-400">Valor da Carga / Mercadoria:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(data.carga?.valorMercadoria)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-0.5">
                      <span className="text-slate-400">Produto / Volumes:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-100 truncate max-w-[200px]">
                        {data.carga?.produtoPredominante || (data.carga?.quantidadeVolumes ? `${data.carga.quantidadeVolumes} vol` : '-')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seguro & Averbação (se houver) */}
              {data.seguro && (data.seguro.nomeSeguradora || data.seguro.numeroApolice || data.seguro.numeroAverbacao) && (
                <div className="bg-white dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-rose-500" /> Seguro & Averbação
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Seguradora:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-100">{data.seguro.nomeSeguradora || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Nº Apólice:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{data.seguro.numeroApolice || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Nº Averbação:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{data.seguro.numeroAverbacao || '-'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Documentos Vinculados (se houver) */}
              {data.documentosVinculados && data.documentosVinculados.length > 0 && (
                <div className="bg-white dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-500" /> Documentos Vinculados ({data.documentosVinculados.length})
                  </h4>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {data.documentosVinculados.map((doc, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-900/50 text-xs font-mono">
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{doc.tipo}</span>
                        <span className="truncate text-slate-600 dark:text-slate-300 max-w-md">{doc.chaveAcesso || doc.numero}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Botão para visualizar texto bruto (auditoria) */}
              {data.rawText && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRawText(!showRawText)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{showRawText ? 'Ocultar texto bruto extraído' : 'Ver texto bruto extraído (Auditoria)'}</span>
                  </button>
                  {showRawText && (
                    <pre className="mt-2 p-3 bg-slate-950 text-slate-300 rounded-xl text-[11px] font-mono whitespace-pre-wrap max-h-60 overflow-y-auto border border-slate-800">
                      {data.rawText}
                    </pre>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">
              Nenhum dado encontrado para exibição.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Processado pelo Leitor Fiscal TMS</span>
          </div>

          <div className="flex items-center gap-2">
            {onApplyData && data && (
              <button
                type="button"
                onClick={() => {
                  onApplyData(data);
                  onClose();
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                Aplicar Dados no Embarque
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
