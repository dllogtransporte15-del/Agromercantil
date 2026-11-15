import React, { useState, useMemo } from 'react';
import { 
  X, 
  FilePlus2, 
  Truck, 
  Calendar, 
  Clock, 
  DollarSign, 
  Package, 
  Check, 
  ArrowRight, 
  MapPin, 
  AlertCircle, 
  CheckCircle2, 
  User, 
  Building2, 
  Info,
  Scale,
  CreditCard,
  UploadCloud,
  FileText,
  Copy,
  Loader2,
  Trash2,
  Eye,
  EyeOff,
  ShieldCheck,
  TrendingUp,
  HelpCircle,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import type { Shipment, Cargo, Client, User as AppUser, RealProfitData } from '../types';
import { ShipmentStatus } from '../types';
import { formatBrl } from '../utils/financialCalculations';
import { findCargoById, formatWeightPtBr } from '../utils';
import { extractFiscalDocNumbers, extractDetailedDocData } from '../utils/fiscalDocParser';
import { calculateShipmentExpenses } from '../utils/operationalExpensesCalculator';
import { uploadShipmentAttachment } from '../lib/db';
import { useToast } from '../hooks/useToast';
import { openDocumentInNewTab } from '../utils/documentViewer';

export interface ComplementarDeductions {
  impostoFederal: number;
  icms: number;
  toll: number; // 0
  ciot: number; // 0
  inssPatronal: number;
  insuranceAcidente: number;
  insuranceRoubo: number;
  insuranceRcv: number; // 0
  custoFixo: number;
  comissaoComercial: number;
  salespersonCommission: number;
  financialCostValue: number;
  agencyCommission: number;
  shipperCommission: number;
  riskCost: number; // 0
  totalDeductions: number;
  netMargin: number;
  profitMarginPercent: number;
}

export interface ComplementarShipmentPayload {
  cteNumber: string;
  companyFreightValue: number;
  driverFreightValue: number;
  originType: string;
  tonnage?: number;
  notes?: string;
  paymentDate?: string;
  cteFileUrl?: string;
  receiptFileUrl?: string;
  nfFileUrl?: string;
  nfNumber?: string;
  nfKey?: string;
  nfValue?: number;
  advancePercentage?: number;
  isFederalTaxManual?: boolean;
  manualFederalTaxValue?: number;
  deductions?: ComplementarDeductions;
}

interface ComplementarShipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipment: Shipment | null;
  cargos: Cargo[];
  clients: Client[];
  currentUser: AppUser;
  onConfirmComplementar: (data: ComplementarShipmentPayload) => Promise<void>;
}

const ORIGIN_TYPE_OPTIONS = [
  'Excedente de Peso / Tonelagem (Diferença de Balança)',
  'Diferença / Ajuste de Tarifa Contratual',
  'Complemento de Frete Empresa / Tomador',
  'Complemento de Estadia / Diária',
  'Complemento Fiscal / Emissão Complementar de CT-e',
  'Outro Complemento Operacional'
];

export const ComplementarShipmentModal: React.FC<ComplementarShipmentModalProps> = ({
  isOpen,
  onClose,
  shipment,
  cargos,
  clients,
  currentUser,
  onConfirmComplementar,
}) => {
  const { showToast } = useToast();

  if (!isOpen || !shipment) return null;

  // Localiza a carga original para obter rotas, cliente e informações de destino
  const relatedCargo = useMemo(() => {
    return findCargoById(cargos, shipment?.cargoId);
  }, [cargos, shipment?.cargoId]);

  const relatedClient = useMemo(() => {
    return clients.find(c => c.id === relatedCargo?.clientId);
  }, [clients, relatedCargo?.clientId]);

  // Estados dos Arquivos
  const [cteFile, setCteFile] = useState<File | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [nfFile, setNfFile] = useState<File | null>(null);

  // Estados do Formulário
  const [cteNumber, setCteNumber] = useState<string>('');
  const [cteKey, setCteKey] = useState<string>('');
  const [nfNumber, setNfNumber] = useState<string>('');
  const [nfKey, setNfKey] = useState<string>('');
  const [nfValue, setNfValue] = useState<string>('');
  const [companyFreight, setCompanyFreight] = useState<string>('');
  const [driverFreight, setDriverFreight] = useState<string>('');
  const [originType, setOriginType] = useState<string>(ORIGIN_TYPE_OPTIONS[0]);
  const [customOriginType, setCustomOriginType] = useState<string>('');
  const [tonnage, setTonnage] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Edição Manual de Imposto Federal
  const [isFederalTaxManual, setIsFederalTaxManual] = useState<boolean>(false);
  const [customFederalTax, setCustomFederalTax] = useState<string>('');

  // Porcentagem de Adiantamento (0% pula direto para descarga; 100% pula saldo)
  const [advancePercentage, setAdvancePercentage] = useState<number>(() => {
    return (shipment?.advancePercentage !== undefined && shipment.advancePercentage !== null) ? Number(shipment.advancePercentage) : 0;
  });

  // Visualização das Deduções
  const [showDeductions, setShowDeductions] = useState<boolean>(true);

  // Estados de Operação / Loading
  const [isExtractingCte, setIsExtractingCte] = useState<boolean>(false);
  const [isExtractingNf, setIsExtractingNf] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Valores numéricos do formulário
  const companyValNum = parseFloat(companyFreight.replace(/\./g, '').replace(',', '.')) || 0;
  const driverValNum = parseFloat(driverFreight.replace(/\./g, '').replace(',', '.')) || 0;
  const tonnageNum = parseFloat(tonnage.replace(/\./g, '').replace(',', '.')) || undefined;
  const nfValNum = parseFloat(nfValue.replace(/\./g, '').replace(',', '.')) || undefined;

  // Sincronização em tempo real das deduções operacionais do complementar com o embarque original
  // Regra Estrita: Pedágio e CIOT NUNCA são descontados no complementar (toll=0, ciot=0).
  // Todo o resto é descontado proporcionalmente conforme parâmetros da carga e embarque pai.
  const liveExpenses = useMemo(() => {
    if (!shipment) return null;

    const parsedManualTax = parseFloat(customFederalTax.replace(/\./g, '').replace(',', '.'));
    const dummyShipment: Shipment = {
      ...shipment,
      id: `${shipment.id}-COMP`,
      isComplementar: true,
      driverFreightValue: driverValNum,
      shipmentTonnage: tonnageNum || 0,
      loadedTonnage: tonnageNum || 0,
      unloadedTonnage: tonnageNum || 0,
      tollValue: 0,
      ciot: '0',
      ciotNumber: undefined,
      nfeValue: nfValNum,
      nfeNumber: nfNumber.trim() || undefined,
      federalTax: (isFederalTaxManual && !isNaN(parsedManualTax)) ? parsedManualTax : undefined,
      isFederalTaxManual: isFederalTaxManual,
      realProfitData: {
        freightDifference: Math.max(0, companyValNum - driverValNum),
        freightDifferenceMarginPercent: companyValNum > 0 ? ((companyValNum - driverValNum) / companyValNum) * 100 : 0,
        totalExpenses: 0,
        netProfit: companyValNum - driverValNum,
        profitMarginPercent: companyValNum > 0 ? ((companyValNum - driverValNum) / companyValNum) * 100 : 0,
        expenseItems: [],
        ...(shipment.realProfitData || {}),
        companyFreight: companyValNum,
        driverFreight: driverValNum,
        toll: 0,
        ciot: 0,
        federalTax: (isFederalTaxManual && !isNaN(parsedManualTax)) ? parsedManualTax : undefined,
        isFederalTaxManual: isFederalTaxManual,
      } as RealProfitData
    };

    return calculateShipmentExpenses(dummyShipment, relatedCargo);
  }, [shipment, relatedCargo, companyValNum, driverValNum, tonnageNum, nfValNum, nfNumber, isFederalTaxManual, customFederalTax]);

  // Handler de seleção e extração do CT-e Complementar
  const handleCteFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCteFile(file);
    setIsExtractingCte(true);
    setErrorMsg('');

    try {
      const [extracted, detailed] = await Promise.all([
        extractFiscalDocNumbers({ 'CT-e': [file] }),
        extractDetailedDocData(file, 'CT-e').catch(() => null)
      ]);
      if (extracted.cteNumber) {
        setCteNumber(extracted.cteNumber);
        showToast(`CT-e nº ${extracted.cteNumber} extraído com sucesso!`, 'success');
      } else if (detailed && detailed.docNumber) {
        setCteNumber(detailed.docNumber);
        showToast(`CT-e nº ${detailed.docNumber} extraído com sucesso!`, 'success');
      } else {
        const fileNameNum = file.name.match(/(?:cte|ct-e)?[_\-\s]*(\d{3,8})/i);
        if (fileNameNum && fileNameNum[1]) {
          setCteNumber(fileNameNum[1]);
        }
      }

      if (detailed && detailed.accessKey) {
        setCteKey(detailed.accessKey);
      }

      const serviceValue = extracted.cteTotalServiceValue || extracted.totalFreightValue || (detailed && detailed.financeiro && (detailed.financeiro.valorTotalServico || detailed.financeiro.valorTotalFrete));
      if (serviceValue && serviceValue > 0 && !companyFreight) {
        setCompanyFreight(serviceValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      }
    } catch (err: any) {
      console.warn('Não foi possível extrair dados automáticos do CT-e complementar:', err);
    } finally {
      setIsExtractingCte(false);
    }
  };

  // Handler de seleção e extração da Nota Fiscal
  const handleNfFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setNfFile(file);
    setIsExtractingNf(true);
    setErrorMsg('');

    try {
      const [extracted, detailed] = await Promise.all([
        extractFiscalDocNumbers({ 'Nota Fiscal': [file] }),
        extractDetailedDocData(file, 'Nota Fiscal').catch(() => null)
      ]);

      const discoveredNf = detailed?.docNumber || (extracted as any)?.nfeNumber;
      if (discoveredNf) {
        setNfNumber(discoveredNf);
        showToast(`Nota Fiscal nº ${discoveredNf} identificada!`, 'success');
      } else {
        const fileNameNum = file.name.match(/(?:nf|nfe|danfe)?[_\-\s]*(\d{3,8})/i);
        if (fileNameNum && fileNameNum[1]) {
          setNfNumber(fileNameNum[1]);
        }
      }

      if (detailed && detailed.accessKey) {
        setNfKey(detailed.accessKey);
      }

      const val = detailed?.financeiro?.valorTotalNfe || (extracted as any)?.nfeValue;
      if (val && val > 0 && !nfValue) {
        setNfValue(val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      }
    } catch (err: any) {
      console.warn('Não foi possível extrair dados automáticos da Nota Fiscal:', err);
    } finally {
      setIsExtractingNf(false);
    }
  };

  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFile(file);
      setErrorMsg('');
    }
  };

  const copyPixKey = () => {
    if (!shipment.pixKey) return;
    navigator.clipboard.writeText(shipment.pixKey);
    showToast('Chave PIX copiada para a área de transferência!', 'success');
  };

  // Submissão do Formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!cteFile) {
      setErrorMsg('Anexe obrigatoriamente o arquivo (PDF ou XML) do CT-e Complementar.');
      return;
    }

    const cleanCteNum = cteNumber.trim();
    if (!cleanCteNum) {
      setErrorMsg('Informe o número do CT-e Complementar.');
      return;
    }

    if (companyValNum <= 0) {
      setErrorMsg('Informe um Valor Empresa Complementar maior que zero.');
      return;
    }

    if (driverValNum <= 0) {
      setErrorMsg('Informe um Valor Motorista Complementar maior que zero.');
      return;
    }

    if (!receiptFile) {
      setErrorMsg('Anexe obrigatoriamente o Comprovante de Pagamento do motorista.');
      return;
    }

    const finalOrigin = originType === 'Outro Complemento Operacional' && customOriginType.trim()
      ? customOriginType.trim()
      : originType;

    if (!finalOrigin) {
      setErrorMsg('Informe o tipo de origem / motivo do embarque complementar.');
      return;
    }

    setIsSaving(true);
    try {
      // 1. Upload seguro do CT-e Complementar
      const cteFileUrl = await uploadShipmentAttachment(shipment.id, 'CT-e Complementar', cteFile);

      // 2. Upload seguro do Comprovante de Pagamento
      const receiptFileUrl = await uploadShipmentAttachment(shipment.id, 'Comprovante_Pagamento_Complementar', receiptFile);

      // 3. Upload seguro da Nota Fiscal (se fornecida)
      let nfFileUrl: string | undefined = undefined;
      if (nfFile) {
        nfFileUrl = await uploadShipmentAttachment(shipment.id, 'Nota Fiscal', nfFile);
      }

      // 4. Estrutura consolidada de deduções proporcionais sincronizadas
      const deductions: ComplementarDeductions = {
        impostoFederal: liveExpenses?.impostoFederal || 0,
        icms: liveExpenses?.icms || 0,
        toll: 0,
        ciot: 0,
        inssPatronal: liveExpenses?.inssPatronal || 0,
        insuranceAcidente: liveExpenses?.insuranceAcidente || 0,
        insuranceRoubo: liveExpenses?.insuranceRoubo || 0,
        insuranceRcv: 0,
        custoFixo: liveExpenses?.custoFixo || 0,
        comissaoComercial: liveExpenses?.comissaoComercial || 0,
        salespersonCommission: liveExpenses?.salespersonCommission || 0,
        financialCostValue: liveExpenses?.financialCostValue || 0,
        agencyCommission: liveExpenses?.agencyCommission || 0,
        shipperCommission: liveExpenses?.shipperCommission || 0,
        riskCost: 0,
        totalDeductions: liveExpenses?.totalExpenses || 0,
        netMargin: liveExpenses?.netProfit !== undefined ? liveExpenses.netProfit : Number((companyValNum - driverValNum).toFixed(2)),
        profitMarginPercent: liveExpenses?.profitMarginPercent || 0,
      };

      // 5. Confirmar a criação do novo embarque complementar
      const parsedManualTax = parseFloat(customFederalTax.replace(/\./g, '').replace(',', '.'));
      await onConfirmComplementar({
        cteNumber: cleanCteNum,
        companyFreightValue: companyValNum,
        driverFreightValue: driverValNum,
        originType: finalOrigin,
        tonnage: tonnageNum,
        notes: notes.trim() || undefined,
        paymentDate: paymentDate || new Date().toISOString().split('T')[0],
        cteFileUrl,
        receiptFileUrl,
        nfFileUrl,
        nfNumber: nfNumber.trim() || undefined,
        nfKey: nfKey.trim() || undefined,
        nfValue: nfValNum,
        advancePercentage: Number(advancePercentage) || 0,
        isFederalTaxManual,
        manualFederalTaxValue: (isFederalTaxManual && !isNaN(parsedManualTax)) ? parsedManualTax : undefined,
        deductions: {
          ...deductions,
          impostoFederal: (isFederalTaxManual && !isNaN(parsedManualTax)) ? parsedManualTax : deductions.impostoFederal,
        },
      });

      onClose();
    } catch (err: any) {
      console.error('Erro ao gerar embarque complementar:', err);
      setErrorMsg(err?.message || 'Ocorreu um erro ao gerar o embarque complementar. Verifique os dados e tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-4xl max-h-[92vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-purple-50 via-amber-50/50 to-white dark:from-purple-950/30 dark:via-gray-900 dark:to-gray-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-600 text-white rounded-xl shadow-md shadow-purple-500/20">
              <FilePlus2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">
                  Lançar Embarque Complementar
                </h3>
                <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                  Status: Aguardando Fiscal
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Complemento de valor/CT-e vinculado ao Embarque #{shipment.id} • Carga {relatedCargo?.sequenceId ? `CRG-${relatedCargo.sequenceId}` : shipment.cargoId}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Card Resumo do Embarque Original */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700/80 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Package className="w-4 h-4 text-primary" /> Embarque Original de Referência #{shipment.id}
              </span>
              <span className="text-[11px] font-semibold text-gray-500 normal-case">
                Cliente: <strong className="text-gray-800 dark:text-gray-200">{relatedClient?.nomeFantasia || relatedClient?.razaoSocial || 'Cliente da Carga'}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200/80 dark:border-gray-700">
                <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Motorista / Cavalo</span>
                <p className="font-bold text-gray-900 dark:text-white truncate">{shipment.driverName}</p>
                <p className="text-[11px] text-gray-500 font-mono">Placa: {shipment.horsePlate}</p>
              </div>

              <div className="p-2.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200/80 dark:border-gray-700">
                <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Origem / Destino (Carga)</span>
                <p className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                  {relatedCargo?.origin || 'Origem não informada'}
                </p>
                <p className="text-[11px] text-primary dark:text-amber-400 font-bold truncate flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" /> {relatedCargo?.destination || 'Destino não informado'}
                </p>
              </div>

              <div className="p-2.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200/80 dark:border-gray-700">
                <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Frete & Peso Originais</span>
                <p className="font-bold text-gray-900 dark:text-white">
                  {formatBrl(shipment.driverFreightValue)}
                </p>
                <p className="text-[11px] text-gray-500 font-mono">
                  Peso: {shipment.shipmentTonnage ? `${shipment.shipmentTonnage} ton` : 'Não informado'}
                </p>
              </div>
            </div>

            {/* PIX do Motorista */}
            {shipment.pixKey && (
              <div className="p-2 bg-purple-50/80 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <CreditCard className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                  <span className="text-purple-900 dark:text-purple-200 truncate">
                    Chave PIX Cadastrada: <strong className="font-mono">{shipment.pixKey}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={copyPixKey}
                  className="px-2 py-0.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-[11px] font-bold flex items-center gap-1 transition-colors shrink-0"
                >
                  <Copy className="w-3 h-3" /> Copiar PIX
                </button>
              </div>
            )}
          </div>

          {/* Seção 1: Anexo e Dados do CT-e Complementar */}
          <div className="p-5 bg-white dark:bg-gray-800/80 rounded-xl border-2 border-purple-200 dark:border-purple-900/60 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600" /> 1. CT-e Complementar (Obrigatório)
              </span>
              <span className="text-[11px] text-gray-400">PDF ou XML</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Upload Box do CT-e */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Arquivo do CT-e Complementar *
                </label>
                {!cteFile ? (
                  <label className="border-2 border-dashed border-purple-300 dark:border-purple-800 hover:border-purple-500 dark:hover:border-purple-600 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors bg-purple-50/30 dark:bg-purple-950/10">
                    <UploadCloud className="w-7 h-7 text-purple-500 mb-1" />
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200">Selecionar PDF ou XML do CT-e</span>
                    <span className="text-[10px] text-gray-400 mt-0.5">Leitura automática de número e valores</span>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept=".pdf,.xml" 
                      onChange={handleCteFileChange} 
                    />
                  </label>
                ) : (
                  <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-5 h-5 text-purple-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-purple-950 dark:text-purple-200 truncate">{cteFile.name}</p>
                        <span className="text-[10px] text-purple-700 dark:text-purple-400">
                          {(cteFile.size / 1024).toFixed(1)} KB • CT-e Complementar
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCteFile(null);
                        setCteNumber('');
                        setCteKey('');
                      }}
                      className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                      title="Remover arquivo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {isExtractingCte && (
                  <p className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-1.5 mt-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Extraindo dados do documento...
                  </p>
                )}
              </div>

              {/* Número do CT-e */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Número do CT-e Complementar *
                  </label>
                  <input
                    type="text"
                    value={cteNumber}
                    onChange={(e) => setCteNumber(e.target.value)}
                    placeholder="Ex: 12345 ou CTE-12345"
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-bold font-mono dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-purple-500"
                    required
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">Identificação fiscal do documento complementar</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Chave de Acesso (Opcional)
                  </label>
                  <input
                    type="text"
                    value={cteKey}
                    onChange={(e) => setCteKey(e.target.value)}
                    placeholder="Chave de 44 dígitos (se houver)"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-xl text-xs font-mono dark:bg-gray-700 dark:text-gray-200"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Seção 2: Anexo e Dados da Nota Fiscal (NF-e) */}
          <div className="p-5 bg-white dark:bg-gray-800/80 rounded-xl border border-amber-200 dark:border-amber-900/60 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-600" /> 2. Anexo da Nota Fiscal (NF-e)
              </span>
              <span className="text-[11px] text-gray-400">PDF ou XML (Opcional)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Upload Box da Nota Fiscal */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Arquivo da Nota Fiscal (DANFE)
                </label>
                {!nfFile ? (
                  <label className="border-2 border-dashed border-amber-300 dark:border-amber-800 hover:border-amber-500 dark:hover:border-amber-600 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors bg-amber-50/30 dark:bg-amber-950/10">
                    <UploadCloud className="w-7 h-7 text-amber-500 mb-1" />
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200">Selecionar PDF ou XML da Nota Fiscal</span>
                    <span className="text-[10px] text-gray-400 mt-0.5">Leitura automática de número, chave e valor</span>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept=".pdf,.xml" 
                      onChange={handleNfFileChange} 
                    />
                  </label>
                ) : (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-5 h-5 text-amber-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-amber-950 dark:text-amber-200 truncate">{nfFile.name}</p>
                        <span className="text-[10px] text-amber-700 dark:text-amber-400">
                          {(nfFile.size / 1024).toFixed(1)} KB • Nota Fiscal
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setNfFile(null);
                        setNfNumber('');
                        setNfKey('');
                        setNfValue('');
                      }}
                      className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                      title="Remover arquivo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {isExtractingNf && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5 mt-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Extraindo dados da Nota Fiscal...
                  </p>
                )}
              </div>

              {/* Campos da Nota Fiscal */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Número da Nota Fiscal
                    </label>
                    <input
                      type="text"
                      value={nfNumber}
                      onChange={(e) => setNfNumber(e.target.value)}
                      placeholder="Ex: 10452"
                      className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-bold font-mono dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Valor da Mercadoria / NF (R$)
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">R$</span>
                      <input
                        type="text"
                        value={nfValue}
                        onChange={(e) => setNfValue(e.target.value)}
                        placeholder="0,00"
                        className="w-full pl-8 pr-2.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-bold font-mono dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Chave de Acesso da NF-e (Opcional)
                  </label>
                  <input
                    type="text"
                    value={nfKey}
                    onChange={(e) => setNfKey(e.target.value)}
                    placeholder="Chave de 44 dígitos da NF-e"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-xl text-xs font-mono dark:bg-gray-700 dark:text-gray-200"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Seção 3: Valores Financeiros e Origem */}
          <div className="p-5 bg-white dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" /> 3. Valores Complementares & Motivo
              </span>
              <span className="text-[11px] text-gray-400">Receita da Empresa e Repasse ao Motorista</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {/* Valor Empresa Complementar */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Valor Empresa Complementar (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">R$</span>
                  <input
                    type="text"
                    value={companyFreight}
                    onChange={(e) => setCompanyFreight(e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-8 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-bold font-mono text-emerald-700 dark:text-emerald-400 dark:bg-gray-700 focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <span className="text-[10px] text-gray-400 mt-0.5 block">Valor faturado da empresa tomadora</span>
              </div>

              {/* Valor Motorista Complementar */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Valor Motorista Complementar (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">R$</span>
                  <input
                    type="text"
                    value={driverFreight}
                    onChange={(e) => setDriverFreight(e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-8 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-bold font-mono text-purple-700 dark:text-purple-400 dark:bg-gray-700 focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
                <span className="text-[10px] text-gray-400 mt-0.5 block">Valor efetivamente pago ao motorista</span>
              </div>

              {/* Toneladas Excedentes / Complementares */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                  <span>Peso Excedente (Ton)</span>
                  <span className="text-[10px] text-gray-400 font-normal">Opcional</span>
                </label>
                <input
                  type="text"
                  value={tonnage}
                  onChange={(e) => setTonnage(e.target.value)}
                  placeholder="Ex: 10.00"
                  className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-mono dark:bg-gray-700 dark:text-white"
                />
                <span className="text-[10px] text-gray-400 mt-0.5 block">Ex: 10 ton excedentes de 40 para 50 ton</span>
              </div>
            </div>

            {/* Tipo de Origem / Motivo do Complemento */}
            <div className="space-y-2 pt-1">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                Tipo de Origem / Motivo do Complemento *
              </label>
              <select
                value={originType}
                onChange={(e) => setOriginType(e.target.value)}
                className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-xs font-bold dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-purple-500"
              >
                {ORIGIN_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>

              {originType === 'Outro Complemento Operacional' && (
                <input
                  type="text"
                  value={customOriginType}
                  onChange={(e) => setCustomOriginType(e.target.value)}
                  placeholder="Especifique o motivo do complemento..."
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-xl text-xs dark:bg-gray-700 dark:text-white"
                  required
                />
              )}
            </div>
          </div>

          {/* Seção 4: Composição das Deduções & Custos (Sincronizado com o Embarque Original) */}
          <div className="p-5 bg-white dark:bg-gray-800/80 rounded-xl border-2 border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-purple-600" />
                  Composição das Deduções
                </span>
                <button
                  type="button"
                  onClick={() => setShowDeductions(!showDeductions)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200/80 dark:border-amber-800/80 rounded-md transition-colors cursor-pointer capitalize shadow-2xs"
                >
                  {showDeductions ? (
                    <>
                      <EyeOff className="w-3 h-3" />
                      <span>Ocultar</span>
                      <ChevronUp className="w-2.5 h-2.5" />
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3" />
                      <span>Exibir</span>
                      <ChevronDown className="w-2.5 h-2.5" />
                    </>
                  )}
                </button>
              </div>
              <span className="text-[11px] font-normal text-slate-400 lowercase">
                total descontos: <strong className="font-mono text-rose-600 dark:text-rose-400 font-bold">{formatBrl(liveExpenses ? liveExpenses.totalDeducoesComFrete : 0)}</strong>
              </span>
            </div>

            {showDeductions && liveExpenses && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 pt-1">
                {/* Imposto Federal (com Edição Manual Liberada) */}
                <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200 truncate flex items-center gap-1">
                      <span>Imposto Federal</span>
                      {isFederalTaxManual && (
                        <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Manual</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isFederalTaxManual) {
                          setIsFederalTaxManual(true);
                          setCustomFederalTax(liveExpenses.impostoFederal > 0 ? liveExpenses.impostoFederal.toFixed(2).replace('.', ',') : '');
                        } else {
                          setIsFederalTaxManual(false);
                          setCustomFederalTax('');
                        }
                      }}
                      className="text-[9px] font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                    >
                      {isFederalTaxManual ? 'Auto' : 'Editar'}
                    </button>
                  </div>
                  {isFederalTaxManual ? (
                    <div className="mt-1 flex items-center gap-1">
                      <span className="text-[10px] text-slate-400 font-mono">R$</span>
                      <input
                        type="text"
                        value={customFederalTax}
                        onChange={(e) => setCustomFederalTax(e.target.value)}
                        placeholder="0,00"
                        className="w-full px-1.5 py-0.5 text-xs font-bold font-mono text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-950 border border-purple-400 rounded outline-none"
                      />
                    </div>
                  ) : (
                    <div className={`text-xs font-bold font-mono ${liveExpenses.impostoFederal > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                      {liveExpenses.impostoFederal > 0 ? `- ${formatBrl(liveExpenses.impostoFederal)}` : 'R$ 0,00'}
                    </div>
                  )}
                </div>

                {/* ICMS Destacado */}
                <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200 truncate">ICMS Destacado</span>
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 shrink-0">
                      {liveExpenses.icms > 0 ? `${liveExpenses.icmsPercentage}% CT-e` : 'Isento'}
                    </span>
                  </div>
                  <div className={`text-xs font-bold font-mono ${liveExpenses.icms > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                    {liveExpenses.icms > 0 ? `- ${formatBrl(liveExpenses.icms)}` : 'R$ 0,00'}
                  </div>
                </div>

                {/* Vale-Pedágio (NÃO DESCONTA NO COMPLEMENTAR) */}
                <div className="p-2.5 bg-slate-50/50 dark:bg-slate-900/40 rounded-lg border border-dashed border-amber-200 dark:border-amber-900/40 flex flex-col justify-between opacity-80">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 truncate">Vale-Pedágio</span>
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 shrink-0">
                      Não desconta
                    </span>
                  </div>
                  <div className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    R$ 0,00
                  </div>
                  <span className="text-[8px] text-amber-700 dark:text-amber-400 mt-0.5">Sem desconto no complementar</span>
                </div>

                {/* Consulta GR */}
                <div className="p-2.5 bg-slate-50/50 dark:bg-slate-900/40 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 flex flex-col justify-between opacity-80">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 truncate">Consulta GR</span>
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 shrink-0">
                      Isento
                    </span>
                  </div>
                  <div className="text-xs font-bold font-mono text-slate-400">
                    R$ 0,00
                  </div>
                  <span className="text-[8px] text-slate-400 mt-0.5">Cobrado no embarque original</span>
                </div>

                {/* Seguro RCV */}
                <div className="p-2.5 bg-slate-50/50 dark:bg-slate-900/40 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 flex flex-col justify-between opacity-80">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 truncate">Seguro RCV</span>
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 shrink-0">
                      Isento
                    </span>
                  </div>
                  <div className="text-xs font-bold font-mono text-slate-400">
                    R$ 0,00
                  </div>
                  <span className="text-[8px] text-slate-400 mt-0.5">Cobrado no embarque original</span>
                </div>

                {/* Acidente + Roubo */}
                <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200 truncate">Acidente + Roubo</span>
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 shrink-0">
                      {liveExpenses.insuranceAcidente + liveExpenses.insuranceRoubo > 0 ? '0,025% NF' : 'R$ 0,00'}
                    </span>
                  </div>
                  <div className={`text-xs font-bold font-mono ${liveExpenses.insuranceAcidente + liveExpenses.insuranceRoubo > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                    {liveExpenses.insuranceAcidente + liveExpenses.insuranceRoubo > 0 ? `- ${formatBrl(liveExpenses.insuranceAcidente + liveExpenses.insuranceRoubo)}` : 'R$ 0,00'}
                  </div>
                  {liveExpenses.insuranceBaseValue > 0 && (
                    <span className="text-[8px] text-slate-400 truncate mt-0.5">Base: {formatBrl(liveExpenses.insuranceBaseValue)}</span>
                  )}
                </div>

                {/* CIOT (NÃO DESCONTA NO COMPLEMENTAR) */}
                <div className="p-2.5 bg-slate-50/50 dark:bg-slate-900/40 rounded-lg border border-dashed border-amber-200 dark:border-amber-900/40 flex flex-col justify-between opacity-80">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 truncate">CIOT</span>
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 shrink-0">
                      Não desconta
                    </span>
                  </div>
                  <div className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    R$ 0,00
                  </div>
                  <span className="text-[8px] text-amber-700 dark:text-amber-400 mt-0.5">Sem desconto no complementar</span>
                </div>

                {/* Custo Fixo */}
                <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200 truncate">Custo Fixo</span>
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300 shrink-0">
                      0,35%
                    </span>
                  </div>
                  <div className={`text-xs font-bold font-mono ${liveExpenses.custoFixo > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                    {liveExpenses.custoFixo > 0 ? `- ${formatBrl(liveExpenses.custoFixo)}` : 'R$ 0,00'}
                  </div>
                </div>

                {/* INSS Patronal / CPRB */}
                <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200 truncate">INSS Patronal / CPRB</span>
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300 shrink-0">
                      {liveExpenses.inssPatronal > 0 ? '4% (PF)' : 'Isento (PJ)'}
                    </span>
                  </div>
                  <div className={`text-xs font-bold font-mono ${liveExpenses.inssPatronal > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                    {liveExpenses.inssPatronal > 0 ? `- ${formatBrl(liveExpenses.inssPatronal)}` : 'R$ 0,00'}
                  </div>
                </div>

                {/* Comissão Vendedor */}
                <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200 truncate">Comissão Vendedor</span>
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 shrink-0">
                      {relatedCargo?.salespersonCommissionPerTon ? `R$ ${relatedCargo.salespersonCommissionPerTon}/t` : 'Isento'}
                    </span>
                  </div>
                  <div className={`text-xs font-bold font-mono ${liveExpenses.salespersonCommission > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                    {liveExpenses.salespersonCommission > 0 ? `- ${formatBrl(liveExpenses.salespersonCommission)}` : 'R$ 0,00'}
                  </div>
                </div>

                {/* Custo Financeiro */}
                <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200 truncate">Custo Financeiro</span>
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300 shrink-0">
                      {liveExpenses.financialCostValue > 0 ? `${liveExpenses.financialCostEffectiveRate.toFixed(2)}%` : 'Isento'}
                    </span>
                  </div>
                  <div className={`text-xs font-bold font-mono ${liveExpenses.financialCostValue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                    {liveExpenses.financialCostValue > 0 ? `- ${formatBrl(liveExpenses.financialCostValue)}` : 'R$ 0,00'}
                  </div>
                </div>

                {/* Frete Motorista */}
                <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200 truncate">Frete Motorista</span>
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 shrink-0">
                      {tonnageNum && tonnageNum > 0 ? `R$ ${(driverValNum / tonnageNum).toFixed(2)}/t` : 'Integral'}
                    </span>
                  </div>
                  <div className="text-xs font-bold font-mono text-rose-600 dark:text-rose-400">
                    - {formatBrl(driverValNum)}
                  </div>
                </div>

                {/* Comissão Comercial */}
                <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200 truncate">Comissão Comercial</span>
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300 shrink-0">
                      0,20%
                    </span>
                  </div>
                  <div className={`text-xs font-bold font-mono ${liveExpenses.comissaoComercial > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                    {liveExpenses.comissaoComercial > 0 ? `- ${formatBrl(liveExpenses.comissaoComercial)}` : 'R$ 0,00'}
                  </div>
                </div>

                {/* Comissão Agência */}
                <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200 truncate">Comissão Agência</span>
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 shrink-0">
                      {liveExpenses.agencyCommission > 0 ? `${shipment.agencyCommissionPercentage || 30}% Ativo` : 'Isento'}
                    </span>
                  </div>
                  <div className={`text-xs font-bold font-mono ${liveExpenses.agencyCommission > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                    {liveExpenses.agencyCommission > 0 ? `- ${formatBrl(liveExpenses.agencyCommission)}` : 'R$ 0,00'}
                  </div>
                </div>

                {/* Comissão Embarcador */}
                <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200 truncate">Comissão Embarcador</span>
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300 shrink-0">
                      {liveExpenses.shipperCommission > 0 ? 'Ativo' : 'Isento'}
                    </span>
                  </div>
                  <div className={`text-xs font-bold font-mono ${liveExpenses.shipperCommission > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                    {liveExpenses.shipperCommission > 0 ? `- ${formatBrl(liveExpenses.shipperCommission)}` : 'R$ 0,00'}
                  </div>
                </div>
              </div>
            )}

            {/* Resumo do Fechamento Real do Complemento */}
            {liveExpenses && (
              <div className="p-3 bg-slate-50 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs mt-2">
                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Frete Empresa</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      + {formatBrl(companyValNum)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Total Deduções</span>
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
                      - {formatBrl(liveExpenses.totalDeducoesComFrete)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Lucro Líquido Real</span>
                    <span className={`font-mono font-black text-sm ${liveExpenses.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {formatBrl(liveExpenses.netProfit)}
                    </span>
                  </div>
                  <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
                    liveExpenses.profitMarginPercent >= 7
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : liveExpenses.profitMarginPercent >= 5
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        : liveExpenses.profitMarginPercent >= 0
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                  }`}>
                    {liveExpenses.profitMarginPercent.toFixed(1)}% Margem
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Seção 5: Comprovante de Pagamento do Motorista */}
          <div className="p-5 bg-white dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 5. Comprovante de Pagamento do Motorista (Obrigatório)
              </span>
              <span className="text-[11px] text-gray-400">PDF ou Imagem (PIX / Transferência)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Arquivo do Comprovante de Pagamento *
                </label>
                {!receiptFile ? (
                  <label className="border-2 border-dashed border-emerald-300 dark:border-emerald-800 hover:border-emerald-500 dark:hover:border-emerald-600 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors bg-emerald-50/30 dark:bg-emerald-950/10">
                    <UploadCloud className="w-7 h-7 text-emerald-500 mb-1" />
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200">Selecionar Comprovante de Pagamento</span>
                    <span className="text-[10px] text-gray-400 mt-0.5">PIX ou Transferência Bancária</span>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept=".pdf,.png,.jpg,.jpeg,.webp" 
                      onChange={handleReceiptFileChange} 
                    />
                  </label>
                ) : (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-emerald-950 dark:text-emerald-200 truncate">{receiptFile.name}</p>
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
                          {(receiptFile.size / 1024).toFixed(1)} KB • Comprovante de Quitação
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReceiptFile(null)}
                      className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                      title="Remover arquivo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Data do Pagamento Efetivado *
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-bold dark:bg-gray-700 dark:text-white"
                    required
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">Data em que o valor complementar foi pago</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Observações Internas (Opcional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ex: Complemento referente a pesagem de 10 toneladas excedentes no descarregamento..."
                    rows={2}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-xl text-xs dark:bg-gray-700 dark:text-gray-200 resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer Informativo */}
          <div className="p-3 bg-purple-50/80 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800 text-[11px] text-purple-900 dark:text-purple-200 flex items-start gap-2">
            <Info className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Como funciona o Embarque Complementar?</p>
              <p className="text-purple-800/90 dark:text-purple-300/90 mt-0.5 leading-relaxed">
                Um novo embarque vinculado à mesma carga será gerado e marcado imediatamente como <strong>Finalizado</strong>, registrando os valores da receita complementar, documentos fiscais (CT-e e Nota Fiscal), deduções operacionais proporcionais (com pedágio e CIOT isentos) e o pagamento ao motorista com os respectivos comprovantes anexados. O embarque original #<strong>{shipment.id}</strong> permanecerá inalterado e receberá um apontamento em seu histórico.
              </p>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-5 py-2 text-sm font-bold text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || !cteFile || !receiptFile || !cteNumber.trim() || companyValNum <= 0 || driverValNum <= 0}
            className={`px-6 py-2.5 rounded-xl text-sm font-black text-white shadow-lg flex items-center gap-2 transition-all active:scale-95 ${
              isSaving || !cteFile || !receiptFile || !cteNumber.trim() || companyValNum <= 0 || driverValNum <= 0
                ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed shadow-none'
                : 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/25'
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Gerando Embarque Complementar...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" /> Gerar Embarque Complementar (Ag. Fiscal)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
