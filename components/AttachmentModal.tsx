import React, { useState, useEffect, useRef } from 'react';
import { Shipment, ShipmentStatus, User, UserProfile, Cargo, RiskQueryType, RISK_QUERY_COST_MAP, Product, Client, RiskQueryOption, DEFAULT_RISK_QUERY_OPTIONS, RealProfitData } from '../types';
import { isDemoUser } from '../auth';
import { PaperclipIcon, ExternalLinkIcon, MapPinIcon, LoaderIcon } from './icons';
import { fetchRouteGeometry, getRouteSuggestions, RouteSuggestion } from '../services/routing';
import { formatWeightPtBr, isCteApplicableForStatus } from '../utils';
import { extractFiscalDocNumbers, extractFiscalDocNumbersFromUrls, extractDetailedDocData, DetailedDocumentData } from '../utils/fiscalDocParser';
import { useToast } from '../hooks/useToast';
import { X, Package, Box, DollarSign, Scale, User as UserIcon, MapPin, Building, Truck, FileText, CreditCard, Eye, RefreshCw, Sparkles, Layers, ListOrdered } from 'lucide-react';
import { openDocumentInNewTab } from '../utils/documentViewer';
import { DocumentExtractedDataModal } from './DocumentExtractedDataModal';
import { CteCostAutomationPanel } from './CteCostAutomationPanel';
import { ShipmentStagesTimeline } from './ShipmentStagesTimeline';
import { calculateAdvanceAndBalance, calculateTacTaxDeductions } from '../utils/freightCalculation';
import { calculateFreightBalance } from '../utils/freightBalanceCalculator';

interface AttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    filesToAttach: { [key: string]: File[] },
    bankDetails?: string,
    loadedTonnage?: number,
    advancePercentage?: number,
    advanceValue?: number,
    tollValue?: number,
    balanceToReceiveValue?: number,
    discountValue?: number,
    isBreakageWaived?: boolean,
    netBalanceValue?: number,
    unloadedTonnage?: number,
    route?: string,
    grStatus?: 'aprovado' | 'reprovado' | 'reprovado_restrito',
    riskReleaseCode?: string,
    riskQueryType?: string,
    riskQueryCost?: number,
    realProfitData?: RealProfitData,
  }) => Promise<void>;
  shipment: Shipment;
  documentName: string;
  currentUser: User;
  cargo?: Cargo;
  canSave?: boolean;
  /** Quando false, libera fluxo simplificado (apenas documento obrigatório no AG. Seguradora). Default: true */
  requiresRiskManagement?: boolean;
  products?: Product[];
  clients?: Client[];
  users?: User[];
  riskQueryOptions?: RiskQueryOption[];
  onUpdateShipmentData?: (shipmentId: string, data: Partial<Shipment>) => Promise<void> | void;
}

declare const L: any;

const notaFiscalDocTypes = ['Nota Fiscal'];
const travelDocTypes = ['CT-e', 'MDF-e', 'Carta Frete', 'Outros'];
const allowedDocsForClient = [
  'Ticket de Carregamento',
  'Nota Fiscal',
  'CT-e',
  'Comprovante de Descarga'
];

const FileInput: React.FC<{
  label: string;
  onFileChange: (files: FileList | File[] | null) => void;
  files: File[];
  allowPaste?: boolean;
  onInspectFile?: (file: File, docType: string) => void;
}> = ({ label, onFileChange, files, allowPaste = true, onInspectFile }) => {
  const id = `file-upload-${label.replace(/\s/g, '-')}`;
  const [isDragging, setIsDragging] = useState(false);
  const [pasteSuccess, setPasteSuccess] = useState(false);

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pastedFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const ext = file.type.split('/')[1] || 'png';
          const namedFile = new File([file], `imagem_colada_${Date.now()}.${ext}`, { type: file.type });
          pastedFiles.push(namedFile);
        }
      }
    }
    if (pastedFiles.length > 0) {
      e.preventDefault();
      onFileChange(pastedFiles);
      setPasteSuccess(true);
      setTimeout(() => setPasteSuccess(false), 3000);
    }
  };

  const handleClipboardButtonClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const clipboardItems = await navigator.clipboard.read();
        const pastedFiles: File[] = [];
        for (const item of clipboardItems) {
          const imageType = item.types.find(t => t.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            const ext = imageType.split('/')[1] || 'png';
            const namedFile = new File([blob], `imagem_colada_${Date.now()}.${ext}`, { type: imageType });
            pastedFiles.push(namedFile);
          }
        }
        if (pastedFiles.length > 0) {
          onFileChange(pastedFiles);
          setPasteSuccess(true);
          setTimeout(() => setPasteSuccess(false), 3000);
          return;
        }
      }
      alert('Dica: Para colar, você também pode pressionar Ctrl+V no teclado!');
    } catch {
      alert('Pressione Ctrl+V no teclado para colar a imagem copiada.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileChange(e.dataTransfer.files);
    }
  };

  return (
    <div
      className="mb-4"
      onPaste={allowPaste ? handlePaste : undefined}
    >
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</label>
        <button
          type="button"
          onClick={handleClipboardButtonClick}
          className="inline-flex items-center gap-1 text-[11px] font-extrabold text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-all shadow-xs cursor-pointer"
          title="Colar imagem copiada da área de transferência (ou aperte Ctrl+V)"
        >
          <span>📋 Colar Imagem (Ctrl+V)</span>
        </button>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-3 transition-all ${isDragging
            ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 scale-[1.01]'
            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700/60 hover:border-indigo-400'
          }`}
      >
        <label
          htmlFor={id}
          className="flex items-center justify-between w-full text-sm text-gray-600 dark:text-gray-300 cursor-pointer"
        >
          <div className="flex items-center gap-2 truncate">
            <PaperclipIcon className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="truncate font-medium">
              {files.length > 0 ? `${files.length} arquivo(s) selecionado(s)` : `Clique para selecionar, arraste ou aperte Ctrl+V`}
            </span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/50 px-2.5 py-1 rounded-md shrink-0 ml-2 border border-indigo-100 dark:border-indigo-800">
            Procurar
          </span>
        </label>
        <input
          id={id}
          type="file"
          className="hidden"
          multiple
          onChange={(e) => onFileChange(e.target.files)}
          accept=".pdf,.png,.jpg,.jpeg,.gif,.xml"
        />
      </div>

      {pasteSuccess && (
        <p className="mt-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 animate-in fade-in">
          ✓ Imagem colada da área de transferência com sucesso!
        </p>
      )}

      {files.length > 0 && (
        <ul className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1.5">
          {files.map((file, idx) => (
            <li key={idx} className="flex items-center justify-between p-1.5 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 gap-2">
              <div className="flex items-center gap-1.5 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="truncate max-w-[220px] font-medium text-gray-700 dark:text-gray-200">{file.name}</span>
              </div>
              {onInspectFile && (
                <button
                  type="button"
                  onClick={() => onInspectFile(file, label)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 rounded border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold cursor-pointer shrink-0"
                  title="Ver todos os dados e campos lidos deste arquivo"
                >
                  <Eye className="w-3 h-3" />
                  <span>Ver Dados</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};


const AttachmentModal: React.FC<AttachmentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  shipment,
  documentName,
  currentUser,
  cargo,
  canSave = true,
  requiresRiskManagement = true,
  products = [],
  clients = [],
  users = [],
  riskQueryOptions: propRiskQueryOptions,
  onUpdateShipmentData,
}) => {
  const isDemo = isDemoUser(currentUser);
  const riskQueryOptions = React.useMemo<RiskQueryOption[]>(() => {
    if (propRiskQueryOptions && propRiskQueryOptions.length > 0) {
      return propRiskQueryOptions;
    }
    try {
      const saved = localStorage.getItem('agromercantil_risk_query_options') || localStorage.getItem('transcunha_risk_query_options');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch { }
    return DEFAULT_RISK_QUERY_OPTIONS;
  }, [propRiskQueryOptions]);

  const [singleFiles, setSingleFiles] = useState<File[]>([]);
  const [multiFiles, setMultiFiles] = useState<{ [key: string]: File[] }>({});
  const [bankDetails, setBankDetails] = useState('');
  const [loadedTonnage, setLoadedTonnage] = useState<number | ''>('');
  const [advancePercentage, setAdvancePercentage] = useState<number | ''>('');
  const [advanceValue, setAdvanceValue] = useState<number | ''>('');
  const [tollValue, setTollValue] = useState<number | ''>('');
  const [balanceToReceiveValue, setBalanceToReceiveValue] = useState<number | ''>('');
  const [discountValue, setDiscountValue] = useState<number | ''>('');
  const [isBreakageWaived, setIsBreakageWaived] = useState<boolean>(false);
  const [netBalanceValue, setNetBalanceValue] = useState<number | ''>('');
  const [unloadedTonnage, setUnloadedTonnage] = useState<number | ''>('');
  const [route, setRoute] = useState('');
  const [riskReleaseCode, setRiskReleaseCode] = useState('');
  const [riskQueryType, setRiskQueryType] = useState<string>('');
  const [grStatus, setGrStatus] = useState<'aprovado' | 'reprovado' | 'reprovado_restrito'>('aprovado');
  const [suggestions, setSuggestions] = useState<RouteSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'timeline' | 'documents'>(currentUser?.profile === UserProfile.Cliente ? 'documents' : 'timeline');
  const [selectedDocForDetails, setSelectedDocForDetails] = useState<{
    fileOrUrl: File | string;
    docType: string;
    docName: string;
  } | null>(null);

  const { showToast } = useToast();

  const handleApplyExtractedData = (extracted: DetailedDocumentData) => {
    if (extracted.financeiro?.valorPedagio !== undefined) {
      setTollValue(extracted.financeiro.valorPedagio);
    }
    if (extracted.financeiro?.valorAdiantamento !== undefined) {
      setAdvanceValue(extracted.financeiro.valorAdiantamento);
    }
    if (extracted.financeiro?.porcentagemAdiantamento !== undefined) {
      setAdvancePercentage(extracted.financeiro.porcentagemAdiantamento);
    }
    if (extracted.financeiro?.chavePix) {
      setBankDetails(prev => prev ? `${prev} | PIX: ${extracted.financeiro?.chavePix}` : (extracted.financeiro?.chavePix || ''));
    }
    if (extracted.carga?.pesoBrutoKg && shipment.status === ShipmentStatus.AguardandoCarregamento) {
      const ton = extracted.carga.pesoBrutoKg >= 1000 ? Number((extracted.carga.pesoBrutoKg / 1000).toFixed(3)) : extracted.carga.pesoBrutoKg;
      setLoadedTonnage(ton);
    }
    showToast('Dados lidos do documento aplicados no formulário!', 'success');
  };

  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const routeLayerRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setActiveTab(currentUser.profile === UserProfile.Cliente ? 'documents' : 'timeline');
      setSingleFiles([]);
      setMultiFiles({});
      setBankDetails(shipment.bankDetails || '');
      setLoadedTonnage(shipment.shipmentTonnage || '');

      const initialAdvPct = shipment.advancePercentage !== undefined ? shipment.advancePercentage : 70;
      const initialToll = shipment.tollValue || 0;
      const rate = shipment.driverFreightRateSnapshot || cargo?.driverFreightValuePerTon || 0;
      const tVal = shipment.shipmentTonnage || 0;
      const totFrete = shipment.driverFreightValue || (rate * tVal);
      const isPfInit = shipment.driverFreightType === 'PF' || shipment.anttModality === 'TAC';

      const calcInit = calculateAdvanceAndBalance({
        driverFreightValue: totFrete,
        driverFreightRate: rate,
        tonnage: tVal,
        tollValue: initialToll,
        advancePercentage: initialAdvPct,
        driverFreightType: isPfInit ? 'PF' : 'PJ',
      });

      setAdvancePercentage(initialAdvPct);
      setTollValue(shipment.tollValue !== undefined ? shipment.tollValue : '');
      setAdvanceValue(shipment.advanceValue !== undefined && shipment.advanceValue > 0 ? shipment.advanceValue : (calcInit.advanceInAccountValue > 0 ? calcInit.advanceInAccountValue : ''));
      setBalanceToReceiveValue(shipment.balanceToReceiveValue !== undefined && shipment.balanceToReceiveValue > 0 ? shipment.balanceToReceiveValue : (calcInit.balanceToReceiveValue > 0 ? calcInit.balanceToReceiveValue : ''));
      setDiscountValue(shipment.discountValue || '');
      const hasQuebra = shipment.unloadedTonnage !== undefined && shipment.shipmentTonnage !== undefined && (shipment.unloadedTonnage - shipment.shipmentTonnage) < -0.001;
      const isWaived = shipment.isBreakageWaived ?? (shipment.discountValue === 0 && hasQuebra);
      setIsBreakageWaived(Boolean(isWaived));
      setNetBalanceValue(shipment.netBalanceValue || '');
      setUnloadedTonnage(shipment.unloadedTonnage || '');

      setRoute(shipment.route || '');
      setRiskReleaseCode(shipment.riskReleaseCode || '');
      setRiskQueryType((shipment.riskQueryType as RiskQueryType) || '');
      setGrStatus('aprovado');

      // Se o pedágio ou adiantamento não estiverem preenchidos, verifica os documentos já anexados
      if ((!shipment.tollValue || shipment.tollValue === 0) && shipment.documents) {
        const urlMap: { [key: string]: string[] } = {};
        for (const [k, v] of Object.entries(shipment.documents)) {
          if (Array.isArray(v) && v.length > 0) urlMap[k] = v;
        }
        if (Object.keys(urlMap).length > 0) {
          extractFiscalDocNumbersFromUrls(urlMap).then(extracted => {
            if (extracted.tollValue !== undefined && extracted.tollValue > 0) {
              setTollValue(extracted.tollValue);
            }
            if (extracted.advanceValue !== undefined && extracted.advanceValue > 0 && !shipment.advanceValue) {
              setAdvanceValue(extracted.advanceValue);
            }
            if (extracted.advancePercentage !== undefined && extracted.advancePercentage > 0 && !shipment.advancePercentage) {
              setAdvancePercentage(extracted.advancePercentage);
            }
          }).catch(err => console.warn('[AttachmentModal] Auto extract from URLs error:', err));
        }
      }
    }
  }, [isOpen, shipment]);

  // Captura global de colagem de imagem (Ctrl+V) dentro do modal
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') && (target as HTMLInputElement).type === 'text') {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            const ext = file.type.split('/')[1] || 'png';
            const namedFile = new File([file], `comprovante_colado_${Date.now()}.${ext}`, { type: file.type });
            pastedFiles.push(namedFile);
          }
        }
      }

      if (pastedFiles.length > 0) {
        e.preventDefault();
        setSingleFiles(pastedFiles);
        showToast('Imagem colada da área de transferência com sucesso!', 'success');
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, [isOpen]);

  // AUTO-PARSING: Extração de informações do Contrato de Frete (Pedágio, Adiantamento, % Adiantamento)
  useEffect(() => {
    const autoParseFreightDoc = async () => {
      const filesToProcess: { [key: string]: File[] } = {};
      if (Object.keys(multiFiles).length > 0) {
        Object.assign(filesToProcess, multiFiles);
      }
      if (singleFiles.length > 0) {
        filesToProcess[documentName || 'Documento'] = singleFiles;
      }
      if (Object.keys(filesToProcess).length > 0) {
        try {
          const parsed = await extractFiscalDocNumbers(filesToProcess);
          let extractedAny = false;
          if (parsed.tollValue !== undefined) {
            setTollValue(parsed.tollValue);
            extractedAny = true;
          }
          if (parsed.advanceValue !== undefined) {
            setAdvanceValue(parsed.advanceValue);
            extractedAny = true;
          }
          if (parsed.advancePercentage !== undefined) {
            setAdvancePercentage(parsed.advancePercentage);
            extractedAny = true;
          }
          if (extractedAny) {
            showToast('Informações de frete extraídas do documento com sucesso!', 'success');
          }
        } catch (err) {
          console.warn('[AttachmentModal] Erro ao extrair dados do contrato:', err);
        }
      }
    };
    autoParseFreightDoc();
  }, [singleFiles, multiFiles, documentName]);

  const [isSyncingFederalTaxes, setIsSyncingFederalTaxes] = useState(false);

  const handleSyncFederalTaxes = async () => {
    setIsSyncingFederalTaxes(true);
    try {
      const filesToProcess: { [key: string]: File[] } = {};
      if (Object.keys(multiFiles).length > 0) {
        Object.assign(filesToProcess, multiFiles);
      }
      if (singleFiles.length > 0) {
        filesToProcess[documentName || 'Documento'] = singleFiles;
      }

      let parsedPis: number | undefined;
      let parsedCofins: number | undefined;
      let parsedFederalTax: number | undefined;
      let parsedNfeValue: number | undefined;
      let parsedToll: number | undefined;
      let parsedSuspensionPercent: number | undefined;

      for (const [docType, files] of Object.entries(filesToProcess)) {
        if (!Array.isArray(files)) continue;
        for (const file of files) {
          try {
            const ext = await extractDetailedDocData(file, docType);
            if (ext.financeiro?.valorPisCofinsFederal) parsedFederalTax = ext.financeiro.valorPisCofinsFederal;
            if (ext.financeiro?.valorPis) parsedPis = ext.financeiro.valorPis;
            if (ext.financeiro?.valorCofins) parsedCofins = ext.financeiro.valorCofins;
            if (ext.carga?.valorMercadoria) parsedNfeValue = ext.carga.valorMercadoria;
            if (ext.financeiro?.valorPedagio) parsedToll = ext.financeiro.valorPedagio;
          } catch {
            // ignore
          }
        }
      }

      if (shipment.documents) {
        for (const [key, val] of Object.entries(shipment.documents)) {
          const urls = Array.isArray(val) ? val : [val];
          for (const u of urls) {
            if (typeof u === 'string' && (u.startsWith('http') || u.startsWith('/'))) {
              try {
                const ext = await extractDetailedDocData(u, key);
                if (!parsedFederalTax && ext.financeiro?.valorPisCofinsFederal) parsedFederalTax = ext.financeiro.valorPisCofinsFederal;
                if (!parsedPis && ext.financeiro?.valorPis) parsedPis = ext.financeiro.valorPis;
                if (!parsedCofins && ext.financeiro?.valorCofins) parsedCofins = ext.financeiro.valorCofins;
                if (!parsedNfeValue && ext.carga?.valorMercadoria) parsedNfeValue = ext.carga.valorMercadoria;
                if (!parsedToll && ext.financeiro?.valorPedagio) parsedToll = ext.financeiro.valorPedagio;
                if (ext.suspensaoPercentual && ext.suspensaoPercentual > 0) parsedSuspensionPercent = ext.suspensaoPercentual;
              } catch {
                // ignore
              }
            }
          }
        }
      }

      const companyRate = shipment.companyFreightRateSnapshot || cargo?.companyFreightValuePerTon || 0;
      const tonnageVal = Number(loadedTonnage || shipment.shipmentTonnage || cargo?.totalVolume || 0);
      const cteGrossFreight = (companyRate * tonnageVal) > 0 ? (companyRate * tonnageVal) : (shipment.driverFreightValue || 0);

      const driverRate = shipment.driverFreightRateSnapshot || cargo?.driverFreightValuePerTon || 0;
      const driverFreight = (driverRate * tonnageVal) > 0 ? (driverRate * tonnageVal) : (shipment.driverFreightValue || 0);

      // Identificação de PF (Autônomo/TAC) vs PJ (Empresa/ETC)
      const isExplicitPj = shipment.driverFreightType === 'PJ' || 
        shipment.anttModality === 'ETC' || 
        (shipment as any)?.selectedRegime === 'PJ' || 
        (shipment as any)?.selectedRegime === 'ETC' || 
        (shipment as any)?.selectedRegime === 'Lucro Real / Presumido' || 
        (shipment as any)?.selectedRegime === 'Lucro Real' || 
        (shipment as any)?.selectedRegime === 'Lucro Presumido' || 
        (shipment as any)?.selectedRegime === 'Simples Nacional' || 
        (shipment as any)?.selectedRegime === 'MEI';

      const isShipmentPf = !isExplicitPj && (
        shipment.driverFreightType === 'PF' || 
        shipment.anttModality === 'TAC' || 
        (shipment as any)?.selectedRegime === 'PF' || 
        (shipment as any)?.selectedRegime === 'TAC'
      );
      const isSimplesNacional = Boolean(
        shipment.etcTaxRegime === 'Simples Nacional' ||
        shipment.etcTaxRegime === 'MEI' ||
        (shipment as any)?.selectedRegime === 'Simples Nacional' ||
        (shipment as any)?.selectedRegime === 'MEI' ||
        (shipment as any)?.isSimplesNacional ||
        (cargo as any)?.isSimplesNacional ||
        (shipment.documents as any)?.etc_tax_regime === 'Simples Nacional' ||
        (shipment.documents as any)?.etc_tax_regime === 'MEI' ||
        (shipment.documents as any)?.crt === '1' ||
        (shipment.documents as any)?.crt === '2'
      );

      // Regra de Frete Exportação:
      // - PF (TAC/Autônomo): 6,52834% sobre BC Serviço (Manutenção de Crédito: ICMS 12% * 54,39%)
      // - PJ (Lucro Real / Presumido / Simples Nacional / MEI): 6,5136% sobre BC Crédito (Manutenção de Crédito: ICMS 12% * 54,28%)
      const creditRate = isShipmentPf 
        ? 0.0652834 
        : 0.065136;
      const creditRateLabel = isShipmentPf 
        ? 'PF (6,52834% • Manutenção Crédito)' 
        : 'PJ (6,5136% • Manut. ICMS Exportação)';

      // Exportação (Destino Porto, Terminal Retroportuário, EADI, Armazém Alfandegado, CFOP 6353, CST 40)
      const isExportCargo = cargo?.isExport !== undefined
        ? cargo.isExport
        : ((shipment as any)?.isExport !== undefined
            ? (shipment as any).isExport
            : Boolean(
                (cargo?.observations && /export|cfop\s*6353|cst\s*40/i.test(cargo.observations)) ||
                (cargo?.destination && /(porto|terminal|retroportu[aá]rio|eadi|alfandeg|armaz[eé]m|embarque portu[aá]rio|santos|paranagu[aá]|itaqui|rio grande|barcarena|suape|vit[oó]ria)/i.test(cargo.destination)) ||
                ((shipment as any)?.observations && /export|cfop\s*6353|cst\s*40/i.test((shipment as any).observations)) ||
                ((shipment as any)?.destination && /(porto|terminal|retroportu[aá]rio|eadi|alfandeg|armaz[eé]m|embarque portu[aá]rio|santos|paranagu[aá]|itaqui|rio grande|barcarena|suape|vit[oó]ria)/i.test((shipment as any).destination)) ||
                ((shipment.documents as any)?.cfop === '6353' || (shipment.documents as any)?.cst === '40')
              ));

      if (parsedToll !== undefined && parsedToll > 0) setTollValue(parsedToll);

      const effectiveToll = parsedToll !== undefined && parsedToll > 0 ? parsedToll : Number(tollValue || shipment.tollValue || 0);
      const baseFreteEmpresa = Math.max(0, cteGrossFreight - effectiveToll);
      const baseFreteMotorista = Math.max(0, driverFreight - effectiveToll);

      // Exclusão do ICMS da base do PIS/COFINS
      const icmsPercentage = cargo?.icmsPercentage || (cargo?.hasIcms ? 7 : 0);
      const icmsRate = (cargo?.hasIcms && icmsPercentage > 0) ? (icmsPercentage / 100) : 0;
      const baseFreteEmpresaLiqIcms = Math.max(0, baseFreteEmpresa * (1 - icmsRate));
      const baseFreteMotoristaLiqIcms = Math.max(0, baseFreteMotorista * (1 - icmsRate));
      const spreadLiquidoIcms = Math.max(0, (baseFreteEmpresa - baseFreteMotorista) * (1 - icmsRate));

      const isSuspendedRoute = Boolean(
        /CEL[-_ ]?(337|338|\d+)/i.test(shipment.id || '') ||
        /CEL[-_ ]?(337|338|\d+)/i.test((shipment as any)?.cargoNumber || '')
      );

      const suspMatch = String(cargo?.observations || (shipment as any)?.observations || (shipment as any)?.cargoObservations || (shipment as any)?.cteFiscalInfo || '').match(/(?:impostos?\s+suspensos?|suspens[aã]o(?:\s+tribut[aá]ria)?)\s*:\s*(\d+(?:[.,]\d+)?)\s*%/i);
      const suspensionPercentage = isExportCargo ? 100 : (parsedSuspensionPercent || (suspMatch ? parseFloat(suspMatch[1].replace(',', '.')) : (isSuspendedRoute ? 30 : 0)));
      const tributavelRatio = isExportCargo ? 0 : Math.max(0, (100 - suspensionPercentage) / 100);

      const effectiveDebito = isExportCargo
        ? 0
        : ((parsedFederalTax && parsedFederalTax > 0)
          ? parsedFederalTax
          : ((parsedPis || parsedCofins)
            ? ((parsedPis || 0) + (parsedCofins || 0))
            : Number((baseFreteEmpresaLiqIcms * (suspensionPercentage > 0 ? tributavelRatio : 1) * 0.0925).toFixed(2))));

      // Crédito Gerado apurado sobre o Frete Tributável da Empresa (BC Serviço) em operações de exportação
      const effectiveCredit = isExportCargo
        ? Number((baseFreteEmpresa * creditRate).toFixed(2))
        : 0;

      // Passo 1, 2 & 3: Frete Líquido e Imposto Federal para Mercado Interno
      const icmsBruto = (cargo?.hasIcms && icmsPercentage > 0)
        ? Number((cteGrossFreight * (icmsPercentage / 100)).toFixed(2))
        : 0;
      const freteLiquidoIcms = Math.max(0, cteGrossFreight - icmsBruto);
      const diferencaFreteReais = Math.max(0, freteLiquidoIcms - (shipment.realProfitData?.driverFreight || shipment.driverFreightValue || baseFreteMotorista));

      // Simples Nacional: 3,40% s/ Frete Empresa Bruto | PF: 3,655% s/ Frete Líquido | PJ: 9,25% s/ Spread

      const impostoFederalSimples = Number((cteGrossFreight * 0.0340).toFixed(2));
      const impostoFederalPf = Number((freteLiquidoIcms * 0.03655).toFixed(2));
      const impostoFederalPjSpread = Number((diferencaFreteReais * 0.0925).toFixed(2));

      let impostoFederalMercadoInterno = 0;
      if (isSimplesNacional) {
        impostoFederalMercadoInterno = impostoFederalSimples;
      } else if (isShipmentPf) {
        impostoFederalMercadoInterno = impostoFederalPf;
      } else {
        impostoFederalMercadoInterno = impostoFederalPjSpread;
      }

      const effectiveFederalTax = isExportCargo
        ? 0
        : ((parsedFederalTax && parsedFederalTax > 0)
            ? parsedFederalTax
            : impostoFederalMercadoInterno);

      const federalTaxDesc = isExportCargo
        ? `(Exportação - Crédito ${creditRateLabel}: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(effectiveCredit)})`
        : isSimplesNacional
          ? '(Simples Nacional: 3,40% s/ Frete Bruto)'
          : isShipmentPf
            ? '(PF: 3,655% s/ Frete Líquido)'
            : `(PJ: 9,25% s/ Spread ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(diferencaFreteReais)})`;

      showToast(`Impostos Federais sincronizados! Imposto Federal Líquido: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(effectiveFederalTax)} ${federalTaxDesc}`, 'success');
    } catch (err: any) {
      showToast('Erro ao sincronizar impostos federais.', 'error');
    } finally {
      setIsSyncingFederalTaxes(false);
    }
  };

  // AUTO-CALCULATION:
  // Base do Frete = Total Frete Motorista - Valor pago no Tag (Pedágio)
  // Valor pago na Conta = Base do Frete * (% Adiantamento / 100)
  // Valor do Saldo Original = Base do Frete * ((100 - % Adiantamento) / 100)
  useEffect(() => {
    if (shipment.status === ShipmentStatus.AguardandoAdiantamento) {
      const driverFreightRate = shipment.driverFreightRateSnapshot || cargo?.driverFreightValuePerTon || 0;
      const loadedTonnageValue = shipment.shipmentTonnage || 0;
      const totalFreight = shipment.driverFreightValue || (driverFreightRate * loadedTonnageValue);

      const advPercent = advancePercentage !== '' && advancePercentage !== undefined ? Number(advancePercentage) : 70;
      const tagVal = Number(tollValue || 0);
      const isPf = shipment.driverFreightType === 'PF' || shipment.anttModality === 'TAC';

      const calc = calculateAdvanceAndBalance({
        driverFreightValue: totalFreight,
        driverFreightRate: driverFreightRate,
        tonnage: loadedTonnageValue,
        tollValue: tagVal,
        advancePercentage: advPercent,
        driverFreightType: isPf ? 'PF' : 'PJ',
      });

      // Atualiza Valor Pago na Conta
      if (Math.abs(calc.advanceInAccountValue - Number(advanceValue || 0)) > 0.001) {
        setAdvanceValue(calc.advanceInAccountValue > 0 ? calc.advanceInAccountValue : 0);
      }
      // Atualiza Saldo
      if (Math.abs(calc.balanceToReceiveValue - Number(balanceToReceiveValue || 0)) > 0.001) {
        setBalanceToReceiveValue(calc.balanceToReceiveValue !== undefined ? calc.balanceToReceiveValue : 0);
      }
    }
  }, [advancePercentage, tollValue, shipment.status, shipment.driverFreightRateSnapshot, shipment.shipmentTonnage, shipment.driverFreightValue, shipment.driverFreightType, shipment.anttModality, cargo?.driverFreightValuePerTon]);

  // AUTO-CALCULATION: Valor Liquido de Saldo = Valor de Saldo a Receber - Valor a Descontar
  useEffect(() => {
    if (shipment.status === ShipmentStatus.AguardandoPagamentoSaldo) {
      const balance = Number(balanceToReceiveValue || 0);
      const discount = isBreakageWaived ? 0 : Number(discountValue || 0);
      const calculatedNet = balance - discount;

      if (Math.abs(Number(calculatedNet.toFixed(2)) - Number(netBalanceValue)) > 0.001) {
        setNetBalanceValue(calculatedNet > 0 ? Number(calculatedNet.toFixed(2)) : 0);
      }
    }
  }, [balanceToReceiveValue, discountValue, isBreakageWaived, shipment.status]);

  const showRouteField = shipment.status === ShipmentStatus.AguardandoCarregamento;
  const isReadOnlyRoute = [
    ShipmentStatus.AguardandoNota,
    ShipmentStatus.AguardandoFiscal,
    ShipmentStatus.AguardandoAdiantamento,
    ShipmentStatus.AguardandoAgendamento,
    ShipmentStatus.AguardandoDescarga,
    ShipmentStatus.AguardandoPagamentoSaldo,
    ShipmentStatus.Finalizado
  ].includes(shipment.status);

  const isAtLeastFiscal = [
    ShipmentStatus.AguardandoFiscal,
    ShipmentStatus.AguardandoAdiantamento,
    ShipmentStatus.AguardandoAgendamento,
    ShipmentStatus.AguardandoDescarga,
    ShipmentStatus.AguardandoPagamentoSaldo,
    ShipmentStatus.Finalizado
  ].includes(shipment.status);

  const handleFetchSuggestions = async () => {
    if (!cargo?.originCoords || !cargo?.destinationCoords) {
      setError('Não foi possível carregar as coordenadas para sugestão.');
      return;
    }

    setIsLoadingSuggestions(true);
    setSuggestions([]);

    try {
      const results = await getRouteSuggestions(cargo.originCoords, cargo.destinationCoords);
      setSuggestions(results);
    } catch (err) {
      console.error('Error fetching suggestions:', err);
      setError('Falha ao obter sugestões. Tente informar manualmente.');
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const drawRouteOnMap = async () => {
    if (!mapRef.current || !cargo?.originCoords || !cargo?.destinationCoords) {
      console.warn('Map or coordinates missing for drawing route');
      return;
    }

    const map = mapRef.current;

    // Clear existing markers/layers to avoid duplicates
    map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });

    const origin: [number, number] = [cargo.originCoords.lat, cargo.originCoords.lng];
    const dest: [number, number] = [cargo.destinationCoords.lat, cargo.destinationCoords.lng];

    const originIcon = L.divIcon({
      html: `<div class="w-8 h-8 flex items-center justify-center bg-emerald-500 rounded-full border-2 border-white shadow-xl text-white transform -translate-y-1 transition-transform hover:scale-110">
                 <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
               </div>`,
      className: 'custom-div-icon',
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    });

    const destIcon = L.divIcon({
      html: `<div class="w-8 h-8 flex items-center justify-center bg-red-500 rounded-full border-2 border-white shadow-xl text-white transform -translate-y-1 transition-transform hover:scale-110">
                 <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
               </div>`,
      className: 'custom-div-icon',
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    });

    L.marker(origin, { icon: originIcon }).addTo(map).bindPopup(`<b>Origem:</b> ${cargo.origin}`);
    L.marker(dest, { icon: destIcon }).addTo(map).bindPopup(`<b>Destino:</b> ${cargo.destination}`);

    // Add a temporary dashed line immediately for instant feedback
    const tempLine = L.polyline([origin, dest], {
      color: '#94a3b8',
      weight: 2,
      opacity: 0.5,
      dashArray: '5, 10'
    }).addTo(map);

    // Initial fit bounds so user sees both markers
    map.fitBounds(tempLine.getBounds(), { padding: [40, 40] });

    try {
      const roadGeometry = await fetchRouteGeometry(cargo.originCoords, cargo.destinationCoords);

      // Remove temp line if it exists
      if (map.hasLayer(tempLine)) map.removeLayer(tempLine);

      if (roadGeometry && roadGeometry.coordinates.length > 0) {
        if (routeLayerRef.current) map.removeLayer(routeLayerRef.current);

        routeLayerRef.current = L.polyline(roadGeometry.coordinates, {
          color: '#2563EB',
          weight: 6,
          opacity: 0.8,
          lineJoin: 'round'
        }).addTo(map);

        map.fitBounds(routeLayerRef.current.getBounds(), { padding: [40, 40] });
      } else {
        // If OSRM fails, keep the dashed line but make it more prominent
        tempLine.setStyle({ color: '#2563EB', weight: 4, opacity: 0.6, dashArray: '10, 10' }).addTo(map);
        console.log('Falling back to straight dashed line');
      }
    } catch (err) {
      console.error('Error in drawRouteOnMap:', err);
      // Fallback already handled by keeping/restyling tempLine
    }
  };

  useEffect(() => {
    if (isOpen && (showRouteField || isReadOnlyRoute) && mapContainerRef.current && !mapRef.current) {
      const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([-15.78, -47.92], 4);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OSM'
      }).addTo(map);
      L.control.zoom({ position: 'topright' }).addTo(map);
      mapRef.current = map;

      drawRouteOnMap();

      setTimeout(() => { map.invalidateSize(); }, 350);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [isOpen, showRouteField, isReadOnlyRoute, cargo]);

  const handleTraceRoute = async () => {
    if (!cargo?.originCoords || !cargo?.destinationCoords) {
      showToast("Coordenadas de origem ou destino não disponíveis.", 'warning');
      return;
    }
    drawRouteOnMap();
  };

  const handleSave = async () => {
    if (isDemo) {
      showToast('Usuário em modo demonstração possui acesso apenas de visualização.', 'warning');
      return;
    }
    let filesToAttach: { [key: string]: File[] } = {};
    if (shipment.status === ShipmentStatus.AguardandoNota || shipment.status === ShipmentStatus.AguardandoFiscal) {
      const someFiles = Object.values(multiFiles).some(arr => Array.isArray(arr) && arr.length > 0);
      if (!someFiles) {
        setError('Anexe pelo menos um documento para avançar.');
        return;
      }
      if (shipment.status === ShipmentStatus.AguardandoNota && !shipment.bankDetails && !bankDetails) {
        setError('Dados bancários são obrigatórios.');
        return;
      }
      filesToAttach = multiFiles;
    } else {
      const existingDocs = shipment.documents?.[documentName];
      const hasExistingDoc = Array.isArray(existingDocs) && existingDocs.length > 0;
      const isRiskModal = shipment.status === ShipmentStatus.AguardandoSeguradora;
      const isReprovedGr = isRiskModal && grStatus !== 'aprovado';

      if (shipment.status === ShipmentStatus.Finalizado) {
        filesToAttach = singleFiles.length > 0 ? { [documentName || 'Comprovante de Pagamento de Saldo']: singleFiles } : {};
      } else {
        const hasExtraAttached = (multiFiles['CIOT'] && multiFiles['CIOT'].length > 0) || (multiFiles['Ciot'] && multiFiles['Ciot'].length > 0) || (multiFiles['XML do CT-e'] && multiFiles['XML do CT-e'].length > 0);
        if (!isReprovedGr && singleFiles.length === 0 && !hasExistingDoc && !hasExtraAttached) {
          setError('Selecione ao menos um arquivo para anexar.');
          return;
        }
        if (shipment.status === ShipmentStatus.AguardandoCarregamento) {
          if (!route.trim()) {
            setError('A rota do motorista é obrigatória para avançar.');
            return;
          }
          if (!loadedTonnage || Number(loadedTonnage) <= 0) {
            setError('O peso carregado é obrigatório para avançar.');
            return;
          }
          if (!window.confirm(`Confirma o peso carregado de ${loadedTonnage} ton (${formatWeightPtBr(Number(loadedTonnage))}) para este embarque?`)) {
            return;
          }
        }
        if (isRiskModal && requiresRiskManagement && grStatus === 'aprovado') {
          if (!riskReleaseCode.trim()) {
            setError('O Código de Liberação da Seguradora / Gerenciadora é obrigatório para avançar.');
            return;
          }
          if (!riskQueryType) {
            setError('A Modalidade / Tipo de Consulta Realizada é obrigatória para avançar.');
            return;
          }
        }
        filesToAttach = isReprovedGr ? {} : (singleFiles.length > 0 ? { [documentName]: singleFiles } : {});
      }

      if (multiFiles['CIOT'] && multiFiles['CIOT'].length > 0) {
        filesToAttach['CIOT'] = multiFiles['CIOT'];
      } else if (multiFiles['Ciot'] && multiFiles['Ciot'].length > 0) {
        filesToAttach['Ciot'] = multiFiles['Ciot'];
      } else if (multiFiles['XML do CT-e'] && multiFiles['XML do CT-e'].length > 0) {
        filesToAttach['XML do CT-e'] = multiFiles['XML do CT-e'];
      }
    }

    if (shipment.status === ShipmentStatus.AguardandoDescarga && (!unloadedTonnage || Number(unloadedTonnage) <= 0)) {
      showToast('O peso descarregado é obrigatório para informar a entrega.', 'warning');
      return;
    }

    if (shipment.status === ShipmentStatus.AguardandoPagamentoSaldo) {
      const hasQuebra = shipment.unloadedTonnage !== undefined && shipment.shipmentTonnage !== undefined && (shipment.unloadedTonnage - shipment.shipmentTonnage) < -0.001;
      if (hasQuebra && !isBreakageWaived && (!discountValue || Number(discountValue) <= 0)) {
        showToast('Atenção: Quebra de carga detectada. É obrigatório informar o valor do desconto ou marcar a opção de Abonar a Quebra para prosseguir.', 'warning');
        return;
      }
    }

    const matchedOption = riskQueryOptions.find(o => o.name === riskQueryType || o.name.toLowerCase().trim() === riskQueryType?.toLowerCase().trim());
    const calculatedRiskCost = matchedOption ? matchedOption.cost : (riskQueryType ? (RISK_QUERY_COST_MAP[riskQueryType] ?? RISK_QUERY_COST_MAP[riskQueryType.toLowerCase().trim()] ?? 0) : undefined);
    const isRiskModal = shipment.status === ShipmentStatus.AguardandoSeguradora;

    setError('');
    setIsSaving(true);
    try {
      await onSave({
        filesToAttach,
        bankDetails: bankDetails || undefined,
        loadedTonnage: shipment.status === ShipmentStatus.AguardandoCarregamento ? Number(loadedTonnage) : undefined,
        advancePercentage: shipment.status === ShipmentStatus.AguardandoAdiantamento ? Number(advancePercentage) : undefined,
        advanceValue: shipment.status === ShipmentStatus.AguardandoAdiantamento ? Number(advanceValue) : undefined,
        tollValue: shipment.status === ShipmentStatus.AguardandoAdiantamento ? Number(tollValue || 0) : undefined,
        balanceToReceiveValue: shipment.status === ShipmentStatus.AguardandoPagamentoSaldo ? Number(balanceToReceiveValue) : undefined,
        discountValue: shipment.status === ShipmentStatus.AguardandoPagamentoSaldo ? (isBreakageWaived ? 0 : (discountValue === '' ? undefined : Number(discountValue))) : undefined,
        isBreakageWaived: shipment.status === ShipmentStatus.AguardandoPagamentoSaldo ? isBreakageWaived : undefined,
        netBalanceValue: shipment.status === ShipmentStatus.AguardandoPagamentoSaldo ? Number(netBalanceValue) : undefined,
        unloadedTonnage: shipment.status === ShipmentStatus.AguardandoDescarga ? Number(unloadedTonnage) : undefined,
        route: route ? route : undefined,
        grStatus: isRiskModal ? grStatus : undefined,
        riskReleaseCode: (isRiskModal && grStatus === 'aprovado') ? riskReleaseCode : undefined,
        riskQueryType: isRiskModal ? (riskQueryType || undefined) : undefined,
        riskQueryCost: isRiskModal ? (calculatedRiskCost !== undefined ? calculatedRiskCost : (riskQueryType ? 6.50 : undefined)) : undefined,
      });
    } catch (err: any) {
      console.error('Error in handleSave:', err);
      setError(err?.message || 'Ocorreu um erro ao salvar o embarque. Verifique os dados e tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => { onClose(); }

  if (!isOpen) return null;

  const isClientUser = currentUser.profile === UserProfile.Cliente;

  const ignoredDocKeys = new Set([
    'pix_key',
    'cte_number',
    'payment_method',
    'risk_query_cost',
    'risk_query_type',
    'cte_emission_date',
    'risk_release_code',
    'advance_percentage',
    'toll_value',
    'advance_value',
    'balance_value',
    'balance_to_receive_value',
    'discount_value',
    'net_balance_value',
    'unloaded_tonnage',
    'loaded_tonnage',
  ]);

  const isValidDocumentEntry = (key: string, value: any): boolean => {
    if (!key || ignoredDocKeys.has(key.toLowerCase().trim())) return false;
    if (key.startsWith('_')) return false;
    if (Array.isArray(value)) {
      return value.length > 0 && value.some(v => typeof v === 'string' && v.trim() !== '' && (v.startsWith('http') || v.startsWith('/') || v.includes('.')));
    }
    if (typeof value === 'string') {
      return value.trim() !== '' && (value.startsWith('http') || value.startsWith('/') || (value.includes('.') && value.length > 4));
    }
    return false;
  };

  const rawDocEntries = Object.entries(shipment.documents || {}).filter(([key, val]) => isValidDocumentEntry(key, val));

  const documentsToShow = isClientUser
    ? rawDocEntries.filter(([docType]) => 
        allowedDocsForClient.includes(docType) && 
        docType.toLowerCase().trim() !== 'carta frete' && 
        !docType.toLowerCase().includes('carta frete')
      )
    : rawDocEntries;

  const requiresBankDetails = shipment.status === ShipmentStatus.AguardandoNota && !shipment.bankDetails;
  const creationDocuments = documentsToShow.filter(([docType]) => docType === 'Arquivos Iniciais');
  const statusDocuments = documentsToShow.filter(([docType]) => docType !== 'Arquivos Iniciais');

  const renderDocumentList = (docs: [string, any][]) => {
    const validDocs = docs.filter(([key, files]) => {
      if (!isValidDocumentEntry(key, files)) return false;
      const fileList = Array.isArray(files) ? files : (typeof files === 'string' ? [files] : []);
      return fileList.length > 0;
    });

    if (validDocs.length === 0) {
      return (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic py-1">Nenhum documento anexado nesta seção.</p>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {validDocs.map(([docType, files]) => {
          const fileList = (Array.isArray(files) ? files : (typeof files === 'string' ? [files] : [])).filter(f => typeof f === 'string' && f.trim() !== '');
          if (fileList.length === 0) return null;

          return (
            <div key={docType} className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/90 dark:border-slate-700/80 flex flex-col justify-between gap-2 shadow-2xs hover:border-indigo-300 dark:hover:border-indigo-700/60 transition-all">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                <span className="font-bold text-xs text-slate-700 dark:text-slate-200 truncate" title={docType}>
                  {docType}:
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {fileList.map((file, index) => {
                  const fileName = typeof file === 'string' ? (file.split('/').pop()?.split('?')[0] || '') : '';
                  const rawDecoded = decodeURIComponent(fileName);
                  const cleanFileName = rawDecoded.includes('_') ? rawDecoded.split('_').slice(2).join('_') || rawDecoded : (rawDecoded || `Anexo ${index + 1}`);

                  return (
                    <div
                      key={index}
                      className="inline-flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-lg border border-indigo-200/80 dark:border-indigo-800/60 shadow-2xs hover:border-indigo-300 dark:hover:border-indigo-600 transition-all w-full justify-between"
                    >
                      <button
                        type="button"
                        onClick={() => openDocumentInNewTab(file, `${docType} - ${cleanFileName}`)}
                        className="inline-flex items-center gap-1.5 px-2 py-1 text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-100 rounded text-xs font-semibold transition-colors cursor-pointer truncate min-w-0 flex-1"
                        title="Visualizar documento em nova janela (com opções de Baixar e Imprimir)"
                      >
                        <PaperclipIcon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{cleanFileName || 'Visualizar Anexo'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedDocForDetails({
                          fileOrUrl: file,
                          docType,
                          docName: cleanFileName
                        })}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-[10px] font-bold transition-all shadow-xs cursor-pointer shrink-0"
                        title="Ver todos os campos e dados extraídos deste documento"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Ver Dados</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const productName = products?.find(p => p.id === cargo?.productId)?.name || cargo?.productId || 'Não especificado';
  const clientName = clients?.find(c => c.id === cargo?.clientId)?.razaoSocial || clients?.find(c => c.id === cargo?.clientId)?.nomeFantasia || cargo?.clientId || 'Não especificado';
  const embarcadorUser = users?.find(u => u.id === shipment.embarcadorId);
  const embarcadorName = embarcadorUser?.name || shipment.embarcadorId || 'Não especificado';

  const canViewCompanyFreight = currentUser.profile !== UserProfile.Motorista && currentUser.profile !== UserProfile.Embarcador;
  const driverRate = shipment.driverFreightRateSnapshot || cargo?.driverFreightValuePerTon || (shipment.shipmentTonnage ? shipment.driverFreightValue / shipment.shipmentTonnage : 0);
  const companyRate = shipment.companyFreightRateSnapshot || cargo?.companyFreightValuePerTon || 0;
  const totalDriverFreight = shipment.driverFreightValue || (driverRate * (shipment.shipmentTonnage || 0));
  const totalCompanyFreight = shipment.realProfitData?.companyFreight !== undefined && shipment.realProfitData.companyFreight > 0
    ? shipment.realProfitData.companyFreight
    : (companyRate * (shipment.shipmentTonnage || 0));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 sm:p-8 max-w-5xl w-full max-h-[92vh] overflow-y-auto text-gray-800 dark:text-gray-200 relative border border-gray-100 dark:border-gray-700">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors z-10"
          title="Fechar"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Dashboard de Informações Otimizadas do Embarque */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-5 shadow-xl mb-6 border border-slate-700/80 relative overflow-hidden">
          {/* Cabecalho Principal */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-700/80">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-400/30 text-blue-400">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                  Gerenciar Anexos
                </h2>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="font-mono text-xs font-bold text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/50">
                    {shipment.id}
                  </span>
                  {cargo?.sequenceId && (
                    <span className="text-xs font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      Carga #{cargo.sequenceId}
                    </span>
                  )}
                  {cargo?.tmsLoteNumber && (
                    <span className="text-xs font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-700/60 flex items-center gap-1" title={`Lote TMS: ${cargo.tmsLoteNumber}`}>
                      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded bg-emerald-600 text-white font-bold text-[9px]">✓</span>
                      Lote TMS: {cargo.tmsLoteNumber}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pr-8">
              <span className="text-xs text-slate-400 font-medium">Status:</span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm">
                {shipment.status}
              </span>
            </div>
          </div>

          {/* Grid de Informacoes Chave */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 text-xs">
            {/* Produto */}
            <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/70">
              <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-1">
                <Box className="w-3.5 h-3.5 text-amber-400" /> Produto
              </div>
              <div className="font-bold text-white text-xs truncate" title={productName}>
                {productName}
              </div>
            </div>

            {/* Frete Motorista / ton */}
            {!isClientUser && (
              <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/70">
                <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between gap-1 mb-1">
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Frete Mtr / ton
                  </span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${shipment.driverFreightType === 'PF'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                    }`}>
                    {shipment.driverFreightType || 'PJ'}
                  </span>
                </div>
                <div className="font-black text-emerald-400 text-xs flex items-baseline gap-1.5">
                  <span>{formatCurrency(driverRate)}</span>
                  <span className={`text-[10px] font-bold ${shipment.driverFreightType === 'PF' ? 'text-amber-400' : 'text-indigo-300'
                    }`}>
                    ({shipment.driverFreightType || 'PJ'})
                  </span>
                </div>
              </div>
            )}

            {/* Total Frete Motorista */}
            {!isClientUser && (
              <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/70">
                <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Total Frete Mtr
                </div>
                <div className="font-black text-white text-xs">
                  {formatCurrency(totalDriverFreight)}
                </div>
              </div>
            )}

            {/* Frete Empresa / ton */}
            {canViewCompanyFreight && (
              <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/70">
                <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-1">
                  <DollarSign className="w-3.5 h-3.5 text-blue-400" /> Frete Emp / ton
                </div>
                <div className="font-bold text-blue-300 text-xs">
                  {formatCurrency(companyRate)}
                </div>
              </div>
            )}

            {/* Tonelagem */}
            <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/70">
              <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-1">
                <Scale className="w-3.5 h-3.5 text-cyan-400" /> Peso (Ton)
              </div>
              <div className="font-bold text-white text-xs">
                {shipment.shipmentTonnage ? `${shipment.shipmentTonnage} t` : 'Aguardando'}
                {shipment.unloadedTonnage ? ` (${shipment.unloadedTonnage} t desc.)` : ''}
              </div>
            </div>

            {/* Motorista & Placa */}
            <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/70 col-span-2 sm:col-span-1">
              <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-1">
                <UserIcon className="w-3.5 h-3.5 text-purple-400" /> Motorista / Placa
              </div>
              <div className="font-bold text-white text-xs truncate" title={shipment.driverName}>
                {shipment.driverName}
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                {shipment.horsePlate}
              </div>
            </div>

            {/* Rota (Origem → Destino) */}
            <div className={`bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/70 col-span-2 sm:col-span-3 ${canViewCompanyFreight ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
              <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-1">
                <MapPin className="w-3.5 h-3.5 text-rose-400" /> Rota (Origem → Destino)
              </div>
              <div className="font-medium text-white text-xs truncate" title={`${cargo?.origin || 'N/I'} → ${cargo?.destination || 'N/I'}`}>
                <span className="font-bold text-slate-200">{cargo?.origin || 'N/I'}</span>
                <span className="mx-1.5 text-slate-500">→</span>
                <span className="font-bold text-slate-200">{cargo?.destination || 'N/I'}</span>
              </div>
            </div>

            {/* Solicitante / Cliente */}
            <div className={`bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/70 col-span-2 sm:col-span-3 ${canViewCompanyFreight ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
              <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-1">
                <Building className="w-3.5 h-3.5 text-indigo-400" /> Solicitante / Cliente
              </div>
              <div className="font-bold text-white text-xs truncate" title={`Sol.: ${embarcadorName} | Cliente: ${clientName}`}>
                <span className="text-slate-300">Sol.:</span> {embarcadorName} | <span className="text-slate-300">Cli.:</span> {clientName}
              </div>
            </div>

            {/* Total Frete Empresa */}
            {canViewCompanyFreight && (
              <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/70 col-span-2 sm:col-span-3 lg:col-span-2">
                <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-1">
                  <DollarSign className="w-3.5 h-3.5 text-blue-400" /> Total Frete Emp
                </div>
                <div className="font-black text-white text-xs">
                  {formatCurrency(totalCompanyFreight)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card de Informações Financeiras & Pagamento */}
        {!isClientUser && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-gray-500 dark:text-gray-400 font-medium block mb-0.5">Forma de Pagamento:</span>
              <span className="font-bold text-gray-800 dark:text-gray-200 text-sm">
                {shipment.paymentMethod || 'PIX - E-FRETE'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400 font-medium block mb-0.5">Porcentagem de Adiantamento:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                {shipment.advancePercentage !== undefined ? shipment.advancePercentage : 70}%
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400 font-medium block mb-0.5">
                {shipment.paymentMethod === 'DEPOSITO EM CONTA' ? 'Dados Bancários:' : 'Chave Pix / Dados:'}
              </span>
              <span className="font-semibold text-gray-800 dark:text-gray-200 truncate block">
                {shipment.paymentMethod === 'DEPOSITO EM CONTA' ? (shipment.bankDetails || 'Não informados') : (shipment.pixKey || shipment.bankDetails || 'Não informada')}
              </span>
            </div>
          </div>
        )}

        {/* Linha do Tempo das Etapas do Embarque no Topo da Janela (Oculto para Cliente) */}
        {!isClientUser && (
          <div className="mb-6">
            <ShipmentStagesTimeline
              shipment={shipment}
              cargo={cargo}
              users={users}
              products={products}
              clients={clients}
              riskQueryOptions={riskQueryOptions}
              currentUser={currentUser}
              onInspectFile={(fileOrUrl, docType, docName) => setSelectedDocForDetails({ fileOrUrl, docType, docName })}
            />
          </div>
        )}

        {/* Documentos Consolidados & Painel de Automação de Custos */}
        <>
            {/* Bloco 1: Documentos Anexados (Linha Horizontal) */}
            <div className="mb-6 border rounded-xl dark:border-gray-600 overflow-hidden bg-white dark:bg-gray-800 shadow-sm">
              <div className="bg-gray-100 dark:bg-gray-700 px-4 py-3 border-b dark:border-gray-600 font-bold text-gray-800 dark:text-gray-100 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-500" />
                  Documentos Anexados
                </span>
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                  {documentsToShow.length} {documentsToShow.length === 1 ? 'categoria' : 'categorias'}
                </span>
              </div>
              <div className="p-4 space-y-4">
                {creationDocuments.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 border-b pb-1">
                      Arquivos Iniciais
                    </h4>
                    {renderDocumentList(creationDocuments)}
                  </div>
                )}
                <div>
                  <h4 className="font-semibold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 border-b pb-1">
                    Troca de Status
                  </h4>
                  {statusDocuments.length > 0 ? renderDocumentList(statusDocuments) : <p className="text-sm italic text-gray-400">Nenhum documento anexado.</p>}
                </div>
              </div>
            </div>

            {/* Bloco 2: Automatização do CT-e Custos & Margem (Embaixo) - Oculto para Embarcador, Agenciador e Cliente */}
            {currentUser?.profile !== UserProfile.Embarcador && 
             currentUser?.profile !== UserProfile.Agenciador && 
             currentUser?.profile !== UserProfile.Cliente &&
             (currentUser?.profile as string) !== 'Embarcador' && 
             (currentUser?.profile as string) !== 'Agenciador' && 
             (currentUser?.profile as string) !== 'Cliente' && (
              <div className="mb-6">
                <CteCostAutomationPanel
                  shipment={shipment}
                  cargo={cargo}
                  tollValue={tollValue}
                  loadedTonnage={loadedTonnage}
                  riskQueryType={riskQueryType}
                  riskReleaseCode={riskReleaseCode}
                  users={users}
                  clients={clients}
                  currentUser={currentUser}
                  onUpdateShipmentData={onUpdateShipmentData}
                />
              </div>
            )}

            {/* Números de Documentos Fiscais Extraídos */}
            {(shipment.cteNumber || shipment.nfeNumber || shipment.mdfeNumber) && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl">
                <p className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-2">📄 Números de Documentos Fiscais</p>
                <div className="flex flex-wrap gap-2">
                  {(shipment.cteNumber && isCteApplicableForStatus(shipment.status)) && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 dark:bg-blue-900/50 border border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200 rounded-full text-xs font-semibold">
                      <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                      CT-e nº {shipment.cteNumber} {shipment.cteEmissionDate ? `(${shipment.cteEmissionDate})` : ''}
                    </span>
                  )}
                  {shipment.nfeNumber && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 rounded-full text-xs font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                      NF-e nº {shipment.nfeNumber}
                    </span>
                  )}
                  {shipment.mdfeNumber && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-violet-100 dark:bg-violet-900/50 border border-violet-300 dark:border-violet-700 text-violet-800 dark:text-violet-200 rounded-full text-xs font-semibold">
                      <span className="w-2 h-2 rounded-full bg-violet-500 inline-block"></span>
                      MDF-e nº {shipment.mdfeNumber}
                    </span>
                  )}
                </div>
              </div>
            )}
          </>

        {!isClientUser && !isDemo ? (
          <div className="border-t dark:border-gray-700 pt-4">
            <h3 className="text-lg font-semibold mb-4 text-primary">
              {shipment.status === ShipmentStatus.Finalizado ? 'Demonstrativo Financeiro / Lucro Real da Operação' : `Próximo Passo: ${documentName}`}
            </h3>
            {shipment.status === ShipmentStatus.AguardandoNota ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  {notaFiscalDocTypes.map(docType => (
                    <FileInput
                      key={docType}
                      label={docType}
                      files={multiFiles[docType] || []}
                      onFileChange={(f) => setMultiFiles((prev: { [key: string]: File[] }) => ({ ...prev, [docType]: f ? Array.from(f) : [] }))}
                      onInspectFile={(file, type) => setSelectedDocForDetails({ fileOrUrl: file, docType: type, docName: file.name })}
                    />
                  ))}
                </div>
              </div>
            ) : shipment.status === ShipmentStatus.AguardandoFiscal ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  {travelDocTypes.map(docType => (
                    <FileInput
                      key={docType}
                      label={docType}
                      files={multiFiles[docType] || []}
                      onFileChange={(f) => setMultiFiles((prev: { [key: string]: File[] }) => ({ ...prev, [docType]: f ? Array.from(f) : [] }))}
                      onInspectFile={(file, type) => setSelectedDocForDetails({ fileOrUrl: file, docType: type, docName: file.name })}
                    />
                  ))}
                </div>
              </div>
            ) : shipment.status === ShipmentStatus.AguardandoCarregamento ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FileInput
                    label={documentName}
                    files={singleFiles}
                    onFileChange={(f) => setSingleFiles(f ? Array.from(f) : [])}
                    onInspectFile={(file, type) => setSelectedDocForDetails({ fileOrUrl: file, docType: type, docName: file.name })}
                  />
                  <div>
                    <label className="block text-sm font-medium mb-1">Toneladas Carregadas</label>
                    <input type="number" step="0.01" value={loadedTonnage} onChange={(e) => setLoadedTonnage(e.target.value === '' ? '' : Number(e.target.value))} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                  </div>
                </div>
              </div>
            ) : shipment.status === ShipmentStatus.AguardandoSeguradora ? (
              <div className="space-y-4">
                {/* Campo de Status/Resultado da Gerenciadora de Risco */}
                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Resultado da Gerenciadora de Risco (GR) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={grStatus}
                    onChange={(e) => setGrStatus(e.target.value as 'aprovado' | 'reprovado' | 'reprovado_restrito')}
                    className="p-2.5 w-full border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 font-medium"
                  >
                    <option value="aprovado">🟢 Liberado / Aprovado no GR</option>
                    <option value="reprovado">🔴 Reprovado no GR (Cancelar Embarque)</option>
                    <option value="reprovado_restrito">⛔ Reprovado no GR e Restrito (Cancelar Embarque e Restringir Motorista)</option>
                  </select>
                </div>

                {grStatus === 'aprovado' ? (
                  <>
                    <FileInput
                      label={documentName}
                      files={singleFiles}
                      onFileChange={(f) => setSingleFiles(f ? Array.from(f) : [])}
                      onInspectFile={(file, type) => setSelectedDocForDetails({ fileOrUrl: file, docType: type, docName: file.name })}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Código de Liberação da Seguradora <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={riskReleaseCode}
                          onChange={(e) => setRiskReleaseCode(e.target.value)}
                          placeholder="Ex: LIB-984721"
                          className="p-2.5 w-full border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Modalidade de Consulta Realizada <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={riskQueryType}
                          onChange={(e) => setRiskQueryType(e.target.value)}
                          className="p-2.5 w-full border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20"
                          required
                        >
                          <option value="" disabled>Selecione a modalidade de consulta...</option>
                          {riskQueryOptions
                            .filter(opt => opt.active || opt.name === riskQueryType)
                            .sort((a, b) => (a.orderIndex ?? 999) - (b.orderIndex ?? 999))
                            .map((opt, idx) => (
                              <option key={opt.id || idx} value={opt.name}>
                                {(opt.orderIndex ?? (idx + 1))} - {opt.name} (Valor: R$ {opt.cost.toFixed(2).replace('.', ',')})
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    {riskQueryType && (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">Custo Registrado de Gerenciamento de Risco:</span>
                        <span className="text-sm font-black text-emerald-950 dark:text-emerald-100 bg-white dark:bg-emerald-900 px-3 py-1 rounded-lg border border-emerald-200 dark:border-emerald-700 shadow-sm">
                          R$ {(riskQueryOptions.find(o => o.name === riskQueryType || o.name.toLowerCase().trim() === riskQueryType?.toLowerCase().trim())?.cost ?? (RISK_QUERY_COST_MAP[riskQueryType] ?? RISK_QUERY_COST_MAP[riskQueryType.toLowerCase().trim()] ?? 0)).toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className={grStatus === 'reprovado' ? "p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-200 space-y-1" : "p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-900 dark:text-red-200 space-y-1"}>
                      <div className="font-bold flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
                        {grStatus === 'reprovado' ? '⚠️ Ação ao clicar em "Salvar e Avançar":' : '⛔ Ação ao clicar em "Salvar e Avançar":'}
                      </div>
                      <p className="text-xs">
                        {grStatus === 'reprovado' ? (
                          <>Ao salvar com a opção <strong>Reprovado no GR</strong>, este embarque será automaticamente <strong>cancelado</strong> no sistema com o motivo <em>"Reprovado no GR"</em>.</>
                        ) : (
                          <>Ao salvar com a opção <strong>Reprovado no GR e Restrito</strong>, este embarque será <strong>cancelado</strong> e o motorista <strong>{shipment.driverName}</strong> terá seu cadastro alterado para o status <strong>RESTRITO</strong> (impedindo novos agendamentos).</>
                        )}
                      </p>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Modalidade de Consulta Realizada (Tarifada na GR) <span className="text-red-500">*</span>
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                        Selecione a consulta que foi executada na seguradora/gerenciadora para correta contabilização do custo de desperdício.
                      </p>
                      <select
                        value={riskQueryType}
                        onChange={(e) => setRiskQueryType(e.target.value)}
                        className="p-2.5 w-full border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 font-medium"
                      >
                        <option value="">Selecione a modalidade tarifada...</option>
                        {riskQueryOptions
                          .filter(opt => opt.active || opt.name === riskQueryType)
                          .sort((a, b) => (a.orderIndex ?? 999) - (b.orderIndex ?? 999))
                          .map((opt, idx) => (
                            <option key={opt.id || idx} value={opt.name}>
                              {(opt.orderIndex ?? (idx + 1))} - {opt.name} (Valor: R$ {opt.cost.toFixed(2).replace('.', ',')})
                            </option>
                          ))}
                      </select>
                    </div>

                    {riskQueryType && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center justify-between">
                        <span className="text-xs font-bold text-red-800 dark:text-red-300 uppercase tracking-wide">Custo de Desperdício (GR):</span>
                        <span className="text-sm font-black text-red-950 dark:text-red-100 bg-white dark:bg-red-900 px-3 py-1 rounded-lg border border-red-200 dark:border-red-700 shadow-sm">
                          R$ {(riskQueryOptions.find(o => o.name === riskQueryType || o.name.toLowerCase().trim() === riskQueryType?.toLowerCase().trim())?.cost ?? (RISK_QUERY_COST_MAP[riskQueryType] ?? RISK_QUERY_COST_MAP[riskQueryType.toLowerCase().trim()] ?? 0)).toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : shipment.status === ShipmentStatus.AguardandoAdiantamento ? (
              <div className="space-y-4">
                <FileInput
                  label={documentName}
                  files={singleFiles}
                  onFileChange={(f) => setSingleFiles(f ? Array.from(f) : [])}
                  onInspectFile={(file, type) => setSelectedDocForDetails({ fileOrUrl: file, docType: type, docName: file.name })}
                />

                {/* Financial calculation & summary box */}
                {(() => {
                  const isAgAdiantamento = shipment.status === ShipmentStatus.AguardandoAdiantamento;
                  const isPfShipment = shipment.driverFreightType === 'PF' || shipment.anttModality === 'TAC';
                  const tagNum = Number(tollValue) || 0;
                  const tacDeductions = isPfShipment ? calculateTacTaxDeductions(totalDriverFreight, tagNum) : null;
                  const baseFrete = Math.max(0, totalDriverFreight - tagNum);
                  const advPctNum = advancePercentage !== '' && advancePercentage !== undefined ? Number(advancePercentage) : 70;
                  const is100Pct = advPctNum >= 100;
                  const adiantamentoBruto = Number((baseFrete * (advPctNum / 100)).toFixed(2));
                  const totalRetencoes = tacDeductions ? Number((tacDeductions.inss + tacDeductions.sestSenat + tacDeductions.irrf).toFixed(2)) : 0;
                  const valorContaCalculado = (isPfShipment && is100Pct) ? Math.max(0, Number((adiantamentoBruto - totalRetencoes).toFixed(2))) : adiantamentoBruto;
                  const saldoOriginalContratual = is100Pct ? 0 : Number((baseFrete * ((100 - advPctNum) / 100)).toFixed(2));
                  const totalRetencoesSaldo = is100Pct ? 0 : totalRetencoes;
                  const saldoLiquidoPreDescarga = is100Pct ? 0 : (isPfShipment ? Math.max(0, Number((saldoOriginalContratual - totalRetencoesSaldo).toFixed(2))) : saldoOriginalContratual);

                  return (
                    <div className="bg-gray-50 dark:bg-gray-900/40 p-4 rounded-xl border border-gray-200 dark:border-gray-700/80 space-y-3">
                      <div className="flex items-center justify-between text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Detalhamento de Pagamento do Frete</span>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            isPfShipment
                              ? 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200 dark:border-orange-800'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          }`}>
                            {isPfShipment ? 'TAC (Pessoa Física)' : 'ETC (Pessoa Jurídica)'}
                          </span>
                        </div>
                        <span className="text-gray-500 dark:text-gray-400 font-medium normal-case">
                          Frete Total (Bruto): <strong className="text-gray-900 dark:text-white font-bold">{formatCurrency(totalDriverFreight)}</strong>
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                            Valor pago no Tag
                          </label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">R$</span>
                            <input
                              type="number"
                              value={tollValue}
                              onChange={(e) => setTollValue(e.target.value === '' ? '' : Number(e.target.value))}
                              className={`w-full pl-8 pr-2.5 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 ${!canSave ? 'bg-gray-100 dark:bg-gray-900 cursor-not-allowed text-gray-400' : 'bg-white'}`}
                              disabled={!canSave}
                              placeholder="0,00"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                            % Adiantamento
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              value={advancePercentage}
                              onChange={(e) => setAdvancePercentage(e.target.value === '' ? '' : Number(e.target.value))}
                              className={`w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 ${!canSave ? 'bg-gray-100 dark:bg-gray-900 cursor-not-allowed text-gray-400' : 'bg-white'}`}
                              disabled={!canSave}
                              placeholder="Ex: 80"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">%</span>
                          </div>
                        </div>

                        <div className={
                          isAgAdiantamento
                            ? "bg-blue-50/90 dark:bg-blue-950/40 p-2.5 rounded-xl border-2 border-blue-500 dark:border-blue-400 flex flex-col justify-between shadow-xs ring-2 ring-blue-500/20"
                            : ""
                        }>
                          <div className="flex items-center justify-between mb-1">
                            <label className={`block text-xs font-semibold ${isAgAdiantamento ? 'text-blue-900 dark:text-blue-100 font-bold uppercase tracking-tight text-[11px]' : 'text-gray-600 dark:text-gray-300'}`}>
                              Adiantamento PG
                            </label>
                            {isAgAdiantamento && (
                              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-600 text-white shadow-xs">
                                A Pagar
                              </span>
                            )}
                          </div>
                          <div className="relative">
                            <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-medium ${isAgAdiantamento ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-400'}`}>R$</span>
                            <input
                              type="number"
                              value={advanceValue}
                              onChange={(e) => setAdvanceValue(e.target.value === '' ? '' : Number(e.target.value))}
                              className={`w-full pl-8 pr-2.5 py-2 border rounded-lg text-sm ${
                                isAgAdiantamento
                                  ? 'border-blue-400 dark:border-blue-500 font-bold text-blue-950 dark:text-white bg-white dark:bg-gray-800 shadow-xs focus:ring-2 focus:ring-blue-500'
                                  : 'dark:bg-gray-700 dark:border-gray-600 bg-white'
                              } ${!canSave ? 'bg-gray-100 dark:bg-gray-900 cursor-not-allowed text-gray-400' : ''}`}
                              disabled={!canSave}
                              placeholder="0,00"
                            />
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[11px] px-0.5 text-gray-500 dark:text-gray-400 font-medium">
                            <span>Total Adiantamento:</span>
                            <span className={`font-bold ${isAgAdiantamento ? 'text-blue-700 dark:text-blue-300 font-extrabold' : 'text-blue-600 dark:text-blue-400'}`}>
                              {formatCurrency((Number(tollValue) || 0) + (Number(advanceValue) || 0))}
                            </span>
                          </div>
                        </div>

                        <div className="bg-emerald-50/80 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 flex flex-col justify-between shadow-2xs">
                          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-tight">
                            {isPfShipment ? (is100Pct ? 'Saldo Restante' : 'Saldo Restante Líquido') : 'Valor do Saldo'}
                          </span>
                          <span className={`text-base font-black mt-1 ${saldoLiquidoPreDescarga < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-900 dark:text-emerald-100'}`}>
                            {formatCurrency(saldoLiquidoPreDescarga)}
                          </span>
                          {is100Pct && (
                            <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                              100% no Adiantamento
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Memória de Cálculo TAC (Pessoa Física) */}
                      {isPfShipment && tacDeductions && (
                        <div className="pt-2 border-t border-orange-200/80 dark:border-orange-900/50 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-orange-900 dark:text-orange-200 flex items-center gap-1.5">
                              <span>📋</span> Retenções Fiscais e Previdenciárias do Autônomo (PF)
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-900" title="Base calculada sobre 20% do frete líquido de pedágio">
                              Base Fiscal (20% s/ Líq. Pedágio): <strong>{formatCurrency(tacDeductions.fiscalBase)}</strong>
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div className="p-2 bg-white dark:bg-gray-800 rounded-lg border border-orange-200 dark:border-gray-700">
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 block font-semibold">INSS Autônomo (11%)</span>
                              <span className="font-bold text-red-600 dark:text-red-400">- {formatCurrency(tacDeductions.inss)}</span>
                              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                                {is100Pct ? 'Deduz no Adiantamento' : 'Deduz no Saldo'}
                              </span>
                            </div>
                            <div className="p-2 bg-white dark:bg-gray-800 rounded-lg border border-orange-200 dark:border-gray-700">
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 block font-semibold">SEST/SENAT (2,5%)</span>
                              <span className="font-bold text-red-600 dark:text-red-400">- {formatCurrency(tacDeductions.sestSenat)}</span>
                              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                                {is100Pct ? 'Deduz no Adiantamento' : 'Deduz no Saldo'}
                              </span>
                            </div>
                            <div className="p-2 bg-white dark:bg-gray-800 rounded-lg border border-orange-200 dark:border-gray-700">
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 block font-semibold">IRRF (Prog.)</span>
                              <span className="font-bold text-red-600 dark:text-red-400">
                                {tacDeductions.irrf > 0 ? `- ${formatCurrency(tacDeductions.irrf)}` : 'Isento (R$ 0,00)'}
                              </span>
                              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                                {is100Pct ? 'Deduz no Adiantamento' : 'Deduz no Saldo'}
                              </span>
                            </div>
                            <div className="p-2 bg-white dark:bg-gray-800 rounded-lg border border-orange-200 dark:border-gray-700">
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 block font-semibold">Total Retenções</span>
                              <span className="font-black text-red-700 dark:text-red-300">- {formatCurrency(tacDeductions.totalDeductions)}</span>
                              <span className="text-[9px] text-gray-500 dark:text-gray-400 block mt-0.5">INSS + SEST + IRRF</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between text-[11px] text-gray-600 dark:text-gray-400 bg-white/60 dark:bg-gray-800/60 p-2 rounded-lg border border-gray-200 dark:border-gray-700/60">
                            {is100Pct ? (
                              <>
                                <span>Adiant. Bruto (100%): <strong>{formatCurrency(adiantamentoBruto)}</strong></span>
                                <span>Total Retenções: <strong className="text-red-600 dark:text-red-400">- {formatCurrency(tacDeductions.totalDeductions)}</strong></span>
                                <span>Valor Líquido na Conta: <strong className="text-blue-700 dark:text-blue-300">{formatCurrency(valorContaCalculado)}</strong></span>
                                <span>Saldo Restante: <strong className="text-emerald-700 dark:text-emerald-400">R$ 0,00 (Finaliza na Descarga)</strong></span>
                              </>
                            ) : (
                              <>
                                <span>Adiant. na Conta ({advPctNum}%): <strong>{formatCurrency(valorContaCalculado)}</strong></span>
                                <span>Total Retenções no Saldo: <strong className="text-red-600 dark:text-red-400">- {formatCurrency(totalRetencoesSaldo)}</strong></span>
                                <span>Saldo Original: <strong>{formatCurrency(saldoOriginalContratual)}</strong></span>
                                <span>Saldo Restante Líquido: <strong className="text-emerald-700 dark:text-emerald-400">{formatCurrency(saldoLiquidoPreDescarga)}</strong></span>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : shipment.status === ShipmentStatus.AguardandoDescarga ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FileInput
                  label={documentName}
                  files={singleFiles}
                  onFileChange={(f) => setSingleFiles(f ? Array.from(f) : [])}
                  onInspectFile={(file, type) => setSelectedDocForDetails({ fileOrUrl: file, docType: type, docName: file.name })}
                />
                <div>
                  <label className="block text-sm font-medium mb-1">Peso Descarregado (Ton)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={unloadedTonnage}
                    onChange={(e) => setUnloadedTonnage(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                    placeholder="Informe o peso conforme ticket"
                  />
                </div>
              </div>
            ) : shipment.status === ShipmentStatus.AguardandoPagamentoSaldo ? (
              <div className="space-y-6">
                {/* Resumo de Pesos para conferência */}
                {(shipment.unloadedTonnage !== undefined || shipment.shipmentTonnage !== undefined) && (
                  <div className="bg-gray-50 dark:bg-gray-900/40 p-4 rounded-xl border dark:border-gray-700 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Peso Carregado (A)</p>
                      <p className="text-sm font-mono font-bold text-gray-800 dark:text-gray-200">{shipment.shipmentTonnage?.toLocaleString('pt-BR')} ton</p>
                    </div>
                    <div className="text-center border-x dark:border-gray-700">
                      <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Peso Descarregado (B)</p>
                      <p className="text-sm font-mono font-bold text-gray-800 dark:text-gray-200">{shipment.unloadedTonnage?.toLocaleString('pt-BR') || '---'} ton</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Diferença (B - A)</p>
                      {shipment.unloadedTonnage && shipment.shipmentTonnage ? (
                        <p className={`text-sm font-mono font-bold ${(shipment.unloadedTonnage - shipment.shipmentTonnage) < -0.001 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {(shipment.unloadedTonnage - shipment.shipmentTonnage).toLocaleString('pt-BR')} ton
                        </p>
                      ) : <p className="text-sm font-mono font-bold text-gray-400">---</p>}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <FileInput
                    label={documentName}
                    files={singleFiles}
                    onFileChange={(f) => setSingleFiles(f ? Array.from(f) : [])}
                    onInspectFile={(file, type) => setSelectedDocForDetails({ fileOrUrl: file, docType: type, docName: file.name })}
                  />
                  <div>
                    <label className="block text-sm font-medium mb-1">Saldo estimado</label>
                    <input
                      type="number"
                      value={balanceToReceiveValue}
                      onChange={(e) => setBalanceToReceiveValue(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium">Valor a Descontar</label>
                      {(shipment.unloadedTonnage !== undefined && shipment.shipmentTonnage !== undefined && (shipment.unloadedTonnage - shipment.shipmentTonnage) < -0.001) && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isBreakageWaived ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'}`}>
                          {isBreakageWaived ? 'Abonado' : 'Quebra'}
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      value={isBreakageWaived ? 0 : discountValue}
                      disabled={isBreakageWaived}
                      placeholder={isBreakageWaived ? 'R$ 0,00 (Abonado)' : '0,00'}
                      onChange={(e) => setDiscountValue(e.target.value === '' ? '' : Number(e.target.value))}
                      className={`w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 ${isBreakageWaived ? 'bg-gray-100 dark:bg-gray-800/60 opacity-80 cursor-not-allowed text-emerald-600 dark:text-emerald-400 font-bold' : ((shipment.unloadedTonnage !== undefined && shipment.shipmentTonnage !== undefined && (shipment.unloadedTonnage - shipment.shipmentTonnage) < -0.001 && !discountValue) ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : '')}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Valor Líquido de Saldo</label>
                    <input
                      type="number"
                      value={netBalanceValue}
                      onChange={(e) => setNetBalanceValue(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 font-bold text-primary"
                    />
                  </div>
                </div>

                {/* Detalhamento do Ajuste de Quebra (Passos 5 e 6) */}
                {(() => {
                  const isPfShipment = shipment.driverFreightType === 'PF' || shipment.anttModality === 'TAC';
                  const pesoSaida = shipment.shipmentTonnage || 0;
                  const pesoChegada = shipment.unloadedTonnage || 0;
                  const diferencaKg = (pesoSaida > 0 && pesoChegada > 0 && pesoChegada < pesoSaida) 
                    ? (pesoSaida - pesoChegada) * 1000 
                    : 0;

                  if (diferencaKg <= 0) return null;

                  const rateSnapshot = shipment.driverFreightRateSnapshot || cargo?.driverFreightValuePerTon || 0;
                  const freteUnitarioKg = rateSnapshot > 0 ? (rateSnapshot / 1000) : (totalDriverFreight / (pesoSaida * 1000));
                  const valKgMercadoria = isPfShipment ? 0.1170 : 0.3736;
                  
                  const descMercadoria = Number((diferencaKg * valKgMercadoria).toFixed(2));
                  const descEstornoFrete = Number((diferencaKg * freteUnitarioKg).toFixed(2));
                  const totalQuebraCalculada = Number((descMercadoria + descEstornoFrete).toFixed(2));

                  return (
                    <div className="p-3 bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center justify-between font-bold text-red-900 dark:text-red-200">
                        <span>⚖️ Memória de Ajuste de Quebra / Falta na Balança de Destino</span>
                        <span className="font-mono">Quebra: {(diferencaKg / 1000).toFixed(2)} t ({diferencaKg.toFixed(0)} kg)</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="p-2 bg-white dark:bg-gray-800 rounded-lg border border-red-100 dark:border-red-900/30">
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 block font-semibold">Desconto 1: Mercadoria Faltante</span>
                          <span className="font-bold text-red-600 dark:text-red-400">- {formatCurrency(descMercadoria)}</span>
                          <span className="text-[10px] text-gray-400 block font-mono">({diferencaKg.toFixed(0)} kg × {formatCurrency(valKgMercadoria)}/kg)</span>
                        </div>
                        <div className="p-2 bg-white dark:bg-gray-800 rounded-lg border border-red-100 dark:border-red-900/30">
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 block font-semibold">Desconto 2: Estorno Frete Não Transportado</span>
                          <span className="font-bold text-red-600 dark:text-red-400">- {formatCurrency(descEstornoFrete)}</span>
                          <span className="text-[10px] text-gray-400 block font-mono">({diferencaKg.toFixed(0)} kg × {formatCurrency(freteUnitarioKg)}/kg)</span>
                        </div>
                        <div className="p-2 bg-white dark:bg-gray-800 rounded-lg border border-red-100 dark:border-red-900/30 flex flex-col justify-between">
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 block font-semibold">Total Desconto Quebra</span>
                          <div className="flex items-center justify-between">
                            <span className="font-black text-red-700 dark:text-red-300">- {formatCurrency(totalQuebraCalculada)}</span>
                            {!isBreakageWaived && (
                              <button
                                type="button"
                                onClick={() => setDiscountValue(totalQuebraCalculada)}
                                className="px-2 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-900/60 dark:hover:bg-red-900 text-red-800 dark:text-red-200 rounded text-[10px] font-bold transition-all"
                              >
                                Preencher
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Alerta de Saldo Negativo / Ressarcimento pelo Motorista */}
                {(Number(balanceToReceiveValue || 0) - Number(isBreakageWaived ? 0 : (discountValue || 0))) < 0 && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-700 rounded-xl flex items-center gap-3">
                    <span className="text-xl">⚠️</span>
                    <div>
                      <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                        Saldo Final Devedor: Valor a ser ressarcido pelo motorista à contratante
                      </p>
                      <p className="text-sm font-black text-red-600 dark:text-red-400">
                        {formatCurrency(Math.abs(Number(balanceToReceiveValue || 0) - Number(isBreakageWaived ? 0 : (discountValue || 0))))} (A Ressarcir)
                      </p>
                    </div>
                  </div>
                )}

                {/* Alerta / Ação de Quebra */}
                {shipment.unloadedTonnage !== undefined && shipment.shipmentTonnage !== undefined && (shipment.unloadedTonnage - shipment.shipmentTonnage) < -0.001 && (
                  !isBreakageWaived ? (
                    <div className="bg-red-50 dark:bg-red-900/10 border-2 border-red-200 dark:border-red-800/60 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </div>
                        <div>
                          <h5 className="text-sm font-bold text-red-800 dark:text-red-300">Quebra de Carga Detectada</h5>
                          <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                            Constatado peso descarregado menor que o peso carregado (Diferença: <strong className="font-mono">{(shipment.unloadedTonnage - shipment.shipmentTonnage).toFixed(2)} ton</strong>).<br />
                            Informe o valor do desconto referente à quebra ou <strong>abone a quebra</strong> para isentar o motorista de desconto.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsBreakageWaived(true);
                          setDiscountValue(0);
                        }}
                        className="flex-shrink-0 inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-gray-800 border-2 border-emerald-500 hover:border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg text-xs font-bold transition-all shadow-sm"
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Abonar Quebra de Carga
                      </button>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3.5 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        <span>✓ Quebra de carga abonada com sucesso (Sem desconto ao motorista).</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsBreakageWaived(false)}
                        className="text-xs text-emerald-700 dark:text-emerald-400 underline font-semibold hover:text-emerald-900"
                      >
                        Desfazer abono
                      </button>
                    </div>
                  )
                )}
              </div>
            ) : (
              <FileInput
                label={documentName}
                files={singleFiles}
                onFileChange={(f) => setSingleFiles(f ? Array.from(f) : [])}
                onInspectFile={(file, type) => setSelectedDocForDetails({ fileOrUrl: file, docType: type, docName: file.name })}
              />
            )}

            {showRouteField && (
              <div className="mt-6 border-t dark:border-gray-700 pt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Coluna Esquerda: Inputs */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <span>Rota Obrigatória</span>
                        <span className="text-[10px] text-amber-700 dark:text-amber-300 font-extrabold bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700">
                          Passo Obrigatório
                        </span>
                      </label>

                      {!isReadOnlyRoute && (
                        <button
                          type="button"
                          onClick={handleFetchSuggestions}
                          disabled={isLoadingSuggestions}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary-dark transition-colors"
                        >
                          <MapPinIcon className="w-3.5 h-3.5" />
                          {isLoadingSuggestions ? 'Sugerindo...' : 'Sugerir Rotas'}
                        </button>
                      )}
                    </div>

                    <textarea
                      rows={4}
                      value={route}
                      onChange={(e) => setRoute(e.target.value)}
                      readOnly={isReadOnlyRoute}
                      placeholder="Ex: Saindo pela BR-163 até Rondonópolis, seguindo pela BR-364..."
                      className={`w-full p-4 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary dark:bg-gray-800 transition-all font-mono text-sm min-h-[120px] shadow-sm ${isReadOnlyRoute ? 'bg-gray-50/50 dark:bg-gray-900/50 cursor-default shadow-none' : ''}`}
                    />

                    <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                      <div className={`w-2 h-2 ${isReadOnlyRoute ? 'bg-emerald-500' : 'bg-blue-600'} rounded-full`} />
                      {isReadOnlyRoute ? (
                        <span>Trajeto validado via <span className="font-bold">OSRM Engine</span></span>
                      ) : (
                        <span>Baseado na rota: <span className="font-bold text-gray-700 dark:text-gray-300">{cargo?.origin} → {cargo?.destination}</span></span>
                      )}
                    </div>

                    {/* Box de Sugestões Encontradas - Somente modo edição */}
                    {!isReadOnlyRoute && (
                      <div className="bg-blue-50/30 dark:bg-blue-900/5 rounded-2xl border border-blue-100 dark:border-blue-800/50 overflow-hidden">
                        <div className="px-4 py-2 bg-blue-50/50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-800">
                          <h4 className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest">
                            Sugestões Encontradas (Clique para usar)
                          </h4>
                        </div>
                        <div className="p-4 space-y-2">
                          {isLoadingSuggestions ? (
                            <div className="flex items-center justify-center py-4 text-blue-500">
                              <LoaderIcon className="w-5 h-5 animate-spin" />
                              <span className="ml-2 text-xs font-semibold animate-pulse">Buscando...</span>
                            </div>
                          ) : suggestions.length > 0 ? (
                            suggestions.map((s: RouteSuggestion, idx: number) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setRoute(s.formatted)}
                                className="w-full text-left p-3 bg-white dark:bg-gray-800 border border-blue-50 dark:border-blue-900 rounded-xl text-[11px] font-medium text-gray-600 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all"
                              >
                                {s.formatted}
                              </button>
                            ))
                          ) : (
                            <p className="text-center py-2 text-[11px] text-gray-400 italic">Clique em Sugerir Rotas para ver sugestões</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Coluna Direita: Mapa */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
                        Visualização do Trajeto
                      </label>
                      <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold rounded-full uppercase tracking-wider">
                        Rodovias Ativas
                      </span>
                    </div>

                    <div className="relative group flex-grow">
                      <div
                        ref={mapContainerRef}
                        className="w-full h-[320px] bg-gray-100 dark:bg-gray-900 rounded-3xl border-2 border-gray-100 dark:border-gray-800 overflow-hidden shadow-xl"
                        id="route-map-modal"
                      />

                      {!isReadOnlyRoute && (
                        <button
                          type="button"
                          onClick={handleTraceRoute}
                          className="absolute bottom-4 right-4 z-[1000] p-3 bg-primary text-white rounded-xl shadow-lg hover:bg-primary-dark transition-all transform hover:scale-105 active:scale-95"
                          title="Atualizar Mapa"
                        >
                          <MapPinIcon className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {requiresBankDetails && (
              <div className="mt-6 border-t pt-4">
                <label className="block font-semibold mb-2">Dados Bancários</label>
                <textarea value={bankDetails} onChange={(e) => setBankDetails(e.target.value)} className="w-full p-3 border rounded dark:bg-gray-700 dark:border-gray-600" rows={3} placeholder="Banco, Ag, Conta..." />
              </div>
            )}

            {error && <p className="mt-4 text-sm text-red-500 font-bold">{error}</p>}

            <div className="mt-8 flex justify-between items-center">
              <div>
                {(shipment.status === ShipmentStatus.AguardandoNota || shipment.status === ShipmentStatus.AguardandoFiscal) && (
                  <button onClick={() => window.open('https://transcunha.atua.com.br/adm/fil_ctrc_emissao.php', '_blank')} className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 flex items-center gap-2 font-bold shadow-md shadow-emerald-200 dark:shadow-none">
                    <ExternalLinkIcon className="w-4 h-4" /> Emitir Documentos
                  </button>
                )}
              </div>
              <div className="flex gap-4">
                <button onClick={onClose} className="px-6 py-2 text-gray-500 hover:text-gray-700 font-bold transition-colors">Cancelar</button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || (shipment.status === ShipmentStatus.AguardandoAdiantamento && !canSave)}
                  className={`px-8 py-2 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95 flex items-center gap-2 ${(isSaving || (shipment.status === ShipmentStatus.AguardandoAdiantamento && !canSave))
                      ? 'bg-gray-400 cursor-not-allowed shadow-none'
                      : 'bg-primary hover:bg-primary-dark shadow-primary/20'
                    }`}
                >
                  {isSaving ? (
                    <>
                      <LoaderIcon className="w-4 h-4 animate-spin" /> Salvando...
                    </>
                  ) : 'Salvar e Avançar'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-8 flex justify-end border-t dark:border-gray-700 pt-4">
            <button onClick={onClose} className="px-8 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
              Fechar
            </button>
          </div>
        )}

        {/* Modal de Detalhes da Leitura do Documento */}
        {selectedDocForDetails && (
          <DocumentExtractedDataModal
            isOpen={Boolean(selectedDocForDetails)}
            onClose={() => setSelectedDocForDetails(null)}
            fileOrUrl={selectedDocForDetails.fileOrUrl}
            docType={selectedDocForDetails.docType}
            docName={selectedDocForDetails.docName}
            driverFreightType={shipment.driverFreightType}
            onApplyData={handleApplyExtractedData}
          />
        )}
      </div>
    </div>
  );
};

export default AttachmentModal;