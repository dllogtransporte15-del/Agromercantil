import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  Camera,
  Layers,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  Trash2,
  Copy,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  Truck,
  MapPin,
  Package,
  Calendar,
  Percent,
  RefreshCw,
  ExternalLink,
  ClipboardPaste,
  ShieldCheck,
  Check
} from 'lucide-react';
import {
  Cargo,
  CargoStatus,
  CargoType,
  Client,
  DailyScheduleType,
  Product,
  VehicleBodyType,
  VehicleSetType
} from '../types';
import { BRAZILIAN_CITIES } from '../brazilianCities';
import {
  ParsedBulkCargo,
  calculateFinancials,
  getDefaultAllowedVehicles,
  generateDailySchedule,
  normalizeCity,
  parseWhatsAppTextBlock,
  processComigoDocumentOcr,
  validateBulkCargo
} from '../utils/bulkCargoParser';
import { enhanceDocumentImage, EnhancedImageResult } from '../utils/imageEnhancer';
import { DocumentAttachmentCard, ImageLightboxModal } from './ImageLightboxModal';
import FormattedObservations from './FormattedObservations';

interface BulkCargoImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  products: Product[];
  currentUserId: string;
  onBulkSave: (cargos: Omit<Cargo, 'id'>[]) => Promise<void>;
}

export const BulkCargoImportModal: React.FC<BulkCargoImportModalProps> = ({
  isOpen,
  onClose,
  clients,
  products,
  currentUserId,
  onBulkSave
}) => {
  // Wizard step: 1 (Client & Strategy), 2 (Data Input), 3 (Review & Edit)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1: Client & Strategy
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [strategyTab, setStrategyTab] = useState<'text' | 'image'>('text');

  // Step 2: Input states
  const [whatsAppText, setWhatsAppText] = useState<string>('');
  const [uploadedImages, setUploadedImages] = useState<{ id: string; file: File; dataUrl: string; name: string }[]>([]);
  const [isProcessingInput, setIsProcessingInput] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<string>('');

  // Step 3: Parsed cargos list
  const [parsedCargos, setParsedCargos] = useState<ParsedBulkCargo[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Gemini API Key (optional override if user wants to use customized key)
  const [geminiApiKey, setGeminiApiKey] = useState<string>(
    (import.meta as any).env?.VITE_GEMINI_API_KEY || localStorage.getItem('gemini_api_key') || ''
  );

  // Temporary state for adding allowed vehicle to a card
  const [newVehicleSets, setNewVehicleSets] = useState<{ [tempId: string]: { setType: VehicleSetType; bodyTypes: VehicleBodyType[] } }>({});

  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Reset modal state when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      if (clients.length > 0 && !selectedClientId) {
        setSelectedClientId(clients[0].id);
      }
      setWhatsAppText('');
      setUploadedImages([]);
      setParsedCargos([]);
      setIsProcessingInput(false);
      setIsSaving(false);
    }
  }, [isOpen, clients]);

  // Auto-detect strategy based on client
  useEffect(() => {
    if (!selectedClientId) return;
    const client = clients.find((c) => c.id === selectedClientId);
    if (!client) return;

    const name = (client.razaoSocial || client.nomeFantasia || '').toLowerCase();
    if (name.includes('comigo')) {
      setStrategyTab('image');
    } else if (name.includes('milh')) {
      setStrategyTab('text');
    }
  }, [selectedClientId, clients]);

  // Native Clipboard paste listener (Ctrl + V for screenshots/images)
  useEffect(() => {
    if (!isOpen || currentStep !== 2 || strategyTab !== 'image') return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            try {
              setIsProcessingInput(true);
              setProcessingProgress('Aprimorando captura de tela colada...');
              const enhanced = await enhanceDocumentImage(blob, `screenshot_colado_${Date.now()}.jpg`);
              setUploadedImages((prev) => [
                ...prev,
                {
                  id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  file: enhanced.file,
                  dataUrl: enhanced.dataUrl,
                  name: `Captura Colada ${prev.length + 1}.jpg`
                }
              ]);
            } catch (err) {
              console.error('Erro ao aprimorar imagem colada:', err);
            } finally {
              setIsProcessingInput(false);
              setProcessingProgress('');
            }
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, currentStep, strategyTab]);

  if (!isOpen) return null;

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  // Handle Drag & Drop / File selection
  const handleFilesAdded = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsProcessingInput(true);
    setProcessingProgress(`Aprimorando ${files.length} documento(s) em Canvas...`);

    try {
      const newImgs: { id: string; file: File; dataUrl: string; name: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|webp)$/i)) {
          setProcessingProgress(`Otimizando contraste e nitidez (${i + 1}/${files.length}): ${file.name}`);
          const enhanced = await enhanceDocumentImage(file, file.name);
          newImgs.push({
            id: `img_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
            file: enhanced.file,
            dataUrl: enhanced.dataUrl,
            name: file.name
          });
        }
      }
      setUploadedImages((prev) => [...prev, ...newImgs]);
    } catch (err) {
      console.error('Erro ao aprimorar imagens:', err);
      alert('Ocorreu um erro ao processar uma das imagens selecionadas.');
    } finally {
      setIsProcessingInput(false);
      setProcessingProgress('');
    }
  };

  // Process WhatsApp text block
  const handleProcessText = () => {
    if (!whatsAppText.trim()) {
      alert('Por favor, cole as mensagens do WhatsApp antes de continuar.');
      return;
    }

    setIsProcessingInput(true);
    try {
      const parsed = parseWhatsAppTextBlock(whatsAppText, selectedClient, products);
      if (parsed.length === 0) {
        alert('Não foi possível identificar nenhuma carga no texto informado.');
        return;
      }
      setParsedCargos(parsed);
      setCurrentStep(3);
    } catch (err) {
      console.error('Erro ao processar texto do WhatsApp:', err);
      alert('Ocorreu um erro ao interpretar o texto do WhatsApp.');
    } finally {
      setIsProcessingInput(false);
    }
  };

  // Process Images with OCR / Gemini
  const handleProcessImages = async () => {
    if (uploadedImages.length === 0) {
      alert('Por favor, adicione ao menos uma imagem ou roteiro para processar.');
      return;
    }

    setIsProcessingInput(true);
    const parsedList: ParsedBulkCargo[] = [];

    try {
      for (let i = 0; i < uploadedImages.length; i++) {
        const img = uploadedImages[i];
        setProcessingProgress(`Executando OCR e IA no documento (${i + 1}/${uploadedImages.length}): ${img.name}`);
        const parsed = await processComigoDocumentOcr(
          img.dataUrl,
          selectedClient,
          products,
          geminiApiKey
        );
        parsedList.push(parsed);
      }

      setParsedCargos(parsedList);
      setCurrentStep(3);
    } catch (err) {
      console.error('Erro no processamento de OCR:', err);
      alert('Ocorreu um erro durante o processamento de OCR dos documentos.');
    } finally {
      setIsProcessingInput(false);
      setProcessingProgress('');
    }
  };

  // Step 3 Actions: update cargo field
  const updateCargoField = (tempId: string, updates: Partial<ParsedBulkCargo>) => {
    setParsedCargos((prev) =>
      prev.map((c) => {
        if (c.tempId !== tempId) return c;
        const updated = { ...c, ...updates };

        // Recalcula financeiro se mudou frete ou ICMS
        if (
          updates.companyFreightValuePerTon !== undefined ||
          updates.hasIcms !== undefined ||
          updates.icmsPercentage !== undefined
        ) {
          const fin = calculateFinancials(
            updated.companyFreightValuePerTon,
            updated.hasIcms,
            updated.icmsPercentage
          );
          updated.driverFreightValuePerTon = fin.driverFreightPj;
          updated.driverFreightValuePerTonPf = fin.driverFreightPf;
        }

        // Revalida
        const val = validateBulkCargo(updated);
        updated.status = val.status;
        updated.validationErrors = val.validationErrors;
        updated.validationWarnings = val.validationWarnings;

        return updated;
      })
    );
  };

  // Duplicate a card
  const handleDuplicateCargo = (cargo: ParsedBulkCargo) => {
    const copy: ParsedBulkCargo = {
      ...cargo,
      tempId: `TEMP-COPY-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    };
    setParsedCargos((prev) => [...prev, copy]);
  };

  // Remove a card
  const handleRemoveCargo = (tempId: string) => {
    setParsedCargos((prev) => prev.filter((c) => c.tempId !== tempId));
  };

  // Add a blank new cargo card
  const handleAddBlankCargo = () => {
    const defaultProduct = products[0];
    const fin = calculateFinancials(150, false, 0);
    const newBlank: ParsedBulkCargo = {
      tempId: `TEMP-MANUAL-${Date.now()}`,
      clientId: selectedClientId || clients[0]?.id || '',
      productId: defaultProduct?.id || '',
      origin: '',
      originLocation: '',
      destination: '',
      destinationLocation: '',
      totalVolume: 40,
      companyFreightValuePerTon: 150,
      hasIcms: false,
      icmsPercentage: 0,
      driverFreightValuePerTon: fin.driverFreightPj,
      driverFreightValuePerTonPf: fin.driverFreightPf,
      allowedVehicleTypes: getDefaultAllowedVehicles(),
      observations: '',
      status: 'error',
      validationErrors: ['Origem e Destino obrigatórios'],
      validationWarnings: []
    };
    const val = validateBulkCargo(newBlank);
    newBlank.status = val.status;
    newBlank.validationErrors = val.validationErrors;
    newBlank.validationWarnings = val.validationWarnings;

    setParsedCargos((prev) => [...prev, newBlank]);
  };

  // Vehicle sets management for individual card
  const handleAddVehicleSet = (tempId: string, setType: VehicleSetType, bodyTypes: VehicleBodyType[]) => {
    const cargo = parsedCargos.find((c) => c.tempId === tempId);
    if (!cargo) return;

    if (bodyTypes.length === 0) {
      alert('Selecione ao menos um tipo de carroceria (ex: Graneleiro ou Basculante).');
      return;
    }

    const currentSets = cargo.allowedVehicleTypes || [];
    const filtered = currentSets.filter((s) => s.setType !== setType);
    const updated = [...filtered, { setType, bodyTypes }];

    updateCargoField(tempId, { allowedVehicleTypes: updated });
  };

  const handleRemoveVehicleSet = (tempId: string, setType: VehicleSetType) => {
    const cargo = parsedCargos.find((c) => c.tempId === tempId);
    if (!cargo) return;
    const updated = (cargo.allowedVehicleTypes || []).filter((s) => s.setType !== setType);
    updateCargoField(tempId, { allowedVehicleTypes: updated });
  };

  const handleApplyStandardVehicles = (tempId: string) => {
    updateCargoField(tempId, { allowedVehicleTypes: getDefaultAllowedVehicles() });
  };

  // Confirm and Save All Valid Cargos
  const handleConfirmSaveAll = async () => {
    const validCargos = parsedCargos.filter((c) => c.status !== 'error');

    if (validCargos.length === 0) {
      alert('Não há cargas válidas para salvar. Corrija os erros destacados em vermelho.');
      return;
    }

    if (validCargos.length < parsedCargos.length) {
      const proceed = window.confirm(
        `Atenção: Existem ${parsedCargos.length - validCargos.length} carga(s) com erros que NÃO serão salvas.\n\nDeseja continuar e salvar as ${validCargos.length} carga(s) válidas?`
      );
      if (!proceed) return;
    }

    setIsSaving(true);

    try {
      // Converte cada ParsedBulkCargo em um objeto Cargo para persistência no banco
      const cargosToInsert: Omit<Cargo, 'id'>[] = validCargos.map((p) => {
        // Regra de corte das 16h para programação diária
        const dailySchedule = generateDailySchedule(p.totalVolume || 40);
        const parentClient = clients.find(cl => cl.id === p.clientId);

        return {
          sequenceId: 0, // Será recalculado atomicamente no salvamento
          clientId: p.clientId,
          productId: p.productId,
          origin: p.origin,
          originLocation: p.originLocation || '',
          originMapLink: p.originMapLink || '',
          destination: p.destination,
          destinationLocation: p.destinationLocation || '',
          destinationMapLink: p.destinationMapLink || '',
          totalVolume: p.totalVolume || 40,
          scheduledVolume: 0,
          loadedVolume: 0,
          companyFreightValuePerTon: p.companyFreightValuePerTon,
          companyFreightHasToll: false,
          driverFreightValuePerTon: p.driverFreightValuePerTon,
          driverFreightHasToll: false,
          hasIcms: p.hasIcms,
          icmsPercentage: p.icmsPercentage,
          requiresScheduling: false,
          type: CargoType.Spot,
          status: CargoStatus.EmAndamento,
          salespersonName: parentClient?.salespersonName || '',
          salespersonCommissionPerTon: parentClient?.salespersonCommissionPerTon || 0,
          createdAt: new Date().toISOString(),
          createdById: currentUserId,
          history: [
            {
              id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              userId: currentUserId,
              timestamp: new Date().toISOString(),
              description: `Carga criada via Importação em Lote (${strategyTab === 'image' ? 'OCR/Imagem' : 'WhatsApp'}).`
            }
          ],
          allowedVehicleTypes: p.allowedVehicleTypes,
          freightLegs: [
            {
              companyFreightValuePerTon: p.companyFreightValuePerTon,
              driverFreightValuePerTon: p.driverFreightValuePerTon,
              driverFreightValuePerTonPf: p.driverFreightValuePerTonPf,
              hasIcms: p.hasIcms,
              icmsPercentage: p.icmsPercentage
            }
          ],
          dailySchedule,
          observations: p.observations || '',
          attachments: p.attachments || []
        };
      });

      await onBulkSave(cargosToInsert);
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar lote de cargas:', err);
      alert(`Erro ao salvar cargas: ${err?.message || 'Falha na comunicação com o banco de dados.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const validCount = parsedCargos.filter((c) => c.status !== 'error').length;
  const errorCount = parsedCargos.filter((c) => c.status === 'error').length;
  const warningCount = parsedCargos.filter((c) => c.status === 'warning').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl shadow-inner">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Importação em Lote de Cargas Multimodal
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                  OCR & WhatsApp
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Assistente inteligente com regras customizadas por cliente, cálculo de ICMS e agendamento automático.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-full transition-all"
            title="Fechar Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP PROGRESS BAR */}
        <div className="bg-slate-100 dark:bg-slate-800/60 px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-6 text-xs font-semibold">
            <button
              onClick={() => setCurrentStep(1)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all ${
                currentStep === 1
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">1</span>
              <span>1. Cliente & Estratégia</span>
            </button>

            <ArrowRight className="w-4 h-4 text-slate-400" />

            <button
              onClick={() => {
                if (selectedClientId) setCurrentStep(2);
              }}
              disabled={!selectedClientId}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all ${
                currentStep === 2
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">2</span>
              <span>2. Entrada de Dados</span>
            </button>

            <ArrowRight className="w-4 h-4 text-slate-400" />

            <button
              onClick={() => {
                if (parsedCargos.length > 0) setCurrentStep(3);
              }}
              disabled={parsedCargos.length === 0}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all ${
                currentStep === 3
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">3</span>
              <span>3. Revisão & Criação ({parsedCargos.length})</span>
            </button>
          </div>

          {currentStep === 3 && (
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {validCount} Válidas
              </span>
              {errorCount > 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 font-bold border border-red-300 dark:border-red-800 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> {errorCount} com Erro
                </span>
              )}
            </div>
          )}
        </div>

        {/* MODAL BODY CONTENT */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ======================================================== */}
          {/* PASSO 1: SELEÇÃO DO CLIENTE E ESTRATÉGIA                 */}
          {/* ======================================================== */}
          {currentStep === 1 && (
            <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl">
                <h3 className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-2 text-sm">
                  <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Detecção Automática de Modelo por Cliente
                </h3>
                <p className="text-xs text-emerald-800 dark:text-emerald-300/90 mt-1">
                  Selecione o cliente pagador. O sistema ativará automaticamente as regras customizadas (Ex: <strong>COMIGO</strong> ativa o modo Imagem/OCR com Roteiro em Rio Verde; <strong>Milhão Ingredients</strong> ativa o modo Texto WhatsApp com margens automáticas).
                </p>
              </div>

              {/* Cliente Selector */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                  Selecione o Cliente <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 text-sm shadow-sm"
                >
                  <option value="" disabled>Selecione um cliente cadastrado...</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.razaoSocial || client.nomeFantasia} (CNPJ: {client.cnpj})
                    </option>
                  ))}
                </select>
              </div>

              {/* Strategy Selector Tabs */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                  Estratégia de Entrada de Dados
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div
                    onClick={() => setStrategyTab('image')}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${
                      strategyTab === 'image'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-md ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className={`p-3 rounded-xl ${strategyTab === 'image' ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                      <Camera className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">📷 Anexo de Imagem / OCR</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Para digitalizações de roteiros COMIGO, autorizações de carregamento, fotos e capturas com Ctrl+V.
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => setStrategyTab('text')}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${
                      strategyTab === 'text'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-md ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className={`p-3 rounded-xl ${strategyTab === 'text' ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">📝 Texto (WhatsApp)</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Para blocos de texto e mensagens de grupos com emojis (Ex: Milhão Ingredients, fretes spot em texto).
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  disabled={!selectedClientId}
                  onClick={() => setCurrentStep(2)}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
                >
                  Avançar para Entrada de Dados <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* PASSO 2: ENTRADA DE DADOS (IMAGEM OU TEXTO)              */}
          {/* ======================================================== */}
          {currentStep === 2 && (
            <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
              {/* Tab Header Selector */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStrategyTab('image')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                      strategyTab === 'image'
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Camera className="w-4 h-4" /> 📷 Modo Imagem / OCR ({uploadedImages.length})
                  </button>
                  <button
                    onClick={() => setStrategyTab('text')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                      strategyTab === 'text'
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <FileText className="w-4 h-4" /> 📝 Modo Texto (WhatsApp)
                  </button>
                </div>

                <div className="text-xs text-slate-500">
                  Cliente: <strong>{selectedClient?.razaoSocial || selectedClient?.nomeFantasia}</strong>
                </div>
              </div>

              {/* TAB CONTENT: MODO IMAGEM */}
              {strategyTab === 'image' && (
                <div className="space-y-4">
                  {/* Drag and drop zone */}
                  <div
                    ref={dropZoneRef}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleFilesAdded(e.dataTransfer.files);
                    }}
                    className="border-2 border-dashed border-emerald-400/80 dark:border-emerald-600/60 rounded-2xl p-8 text-center bg-emerald-50/30 dark:bg-emerald-950/10 hover:bg-emerald-50/60 transition-all cursor-pointer relative group"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.multiple = true;
                      input.accept = 'image/*,.pdf';
                      input.onchange = (e: any) => handleFilesAdded(e.target.files);
                      input.click();
                    }}
                  >
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Upload className="w-7 h-7" />
                    </div>
                    <h3 className="font-bold text-slate-800 dark:text-white text-base">
                      Arraste ou Selecione Roteiros e Fotos de Cargas
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Suporte a múltiplas imagens (JPG, PNG, WEBP) e captura direta com <strong className="text-emerald-600 dark:text-emerald-400">Ctrl + V</strong>.
                    </p>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold mt-2">
                      ✨ Aprimoramento automático em Canvas: Auto-Contraste, Equalização de Histograma e Nitidez integrados.
                    </p>
                  </div>

                  {/* Uploaded images gallery */}
                  {uploadedImages.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                        <span>Documentos Prontos para OCR ({uploadedImages.length})</span>
                        <button
                          type="button"
                          onClick={() => setUploadedImages([])}
                          className="text-red-500 hover:underline"
                        >
                          Limpar Todas
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {uploadedImages.map((img, idx) => (
                          <div
                            key={img.id}
                            className="p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center gap-3 relative group"
                          >
                            <img
                              src={img.dataUrl}
                              alt={img.name}
                              className="w-12 h-12 object-cover rounded-lg border border-slate-300 dark:border-slate-600 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{img.name}</p>
                              <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold">
                                ✓ Canvas Aprimorado
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setUploadedImages((prev) => prev.filter((item) => item.id !== img.id));
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                              title="Remover Imagem"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Processing Status Banner */}
                  {isProcessingInput && (
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center gap-3">
                      <RefreshCw className="w-5 h-5 text-emerald-600 dark:text-emerald-400 animate-spin" />
                      <div>
                        <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Processando Inteligência de Imagem / OCR...</p>
                        <p className="text-xs text-emerald-700 dark:text-emerald-300">{processingProgress || 'Aguarde um momento.'}</p>
                      </div>
                    </div>
                  )}

                  {/* Submit OCR Button */}
                  <div className="pt-4 flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="px-4 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs flex items-center gap-1.5"
                    >
                      <ArrowLeft className="w-4 h-4" /> Voltar
                    </button>
                    <button
                      type="button"
                      disabled={uploadedImages.length === 0 || isProcessingInput}
                      onClick={handleProcessImages}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                    >
                      <Sparkles className="w-4 h-4" />
                      {isProcessingInput ? 'Processando Documentos...' : `Processar ${uploadedImages.length} Imagem(ns) com OCR ➔`}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB CONTENT: MODO TEXTO WHATSAPP */}
              {strategyTab === 'text' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Cole o bloco de mensagens do WhatsApp (com emojis e rotas):
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setWhatsAppText(
                            `📍 GOIANIRA-GO (MILHÃO) X DESCALVADO-SP (ROYAL CANIN) 🏁\n💰 VALOR: R$ 230 A TON\n🧾 PRODUTO: MILHO\n📌 LOCALIZAÇÃO: https://maps.app.goo.gl/example1\n⚖️ PESO: 50 TON\n🚨 09 EIXOS LIBERADO\n\n📍 PEROLANDIA-GO (MILHÃO) X UBERLANDIA-MG (CARGILL) 🏁\n💰 VALOR: R$ 180 A TON\n🧾 PRODUTO: MILHO\n📌 LOCALIZAÇÃO: https://maps.app.goo.gl/example2\n🤑 DESCARGA RÁPIDA`
                          );
                        }}
                        className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        📋 Inserir Exemplo Milhão
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => setWhatsAppText('')}
                        className="text-[11px] text-red-500 hover:underline"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={12}
                    value={whatsAppText}
                    onChange={(e) => setWhatsAppText(e.target.value)}
                    placeholder="Cole aqui o texto do WhatsApp com as cargas..."
                    className="w-full p-4 font-mono text-xs border border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 shadow-inner"
                  />

                  <div className="pt-4 flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="px-4 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs flex items-center gap-1.5"
                    >
                      <ArrowLeft className="w-4 h-4" /> Voltar
                    </button>
                    <button
                      type="button"
                      disabled={!whatsAppText.trim() || isProcessingInput}
                      onClick={handleProcessText}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                    >
                      <Sparkles className="w-4 h-4" />
                      Interpretar Mensagens e Gerar Cargas ➔
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* PASSO 3: REVISÃO EM LOTE, EDIÇÃO E CRIAÇÃO               */}
          {/* ======================================================== */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-fadeIn">
              {/* Batch Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Cargas Identificadas:
                  </span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    {parsedCargos.length} Carga(s)
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-bold border border-emerald-300 dark:border-emerald-800">
                    {validCount} Prontas
                  </span>
                  {errorCount > 0 && (
                    <span className="px-2 py-0.5 rounded-lg bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 text-xs font-bold border border-red-300 dark:border-red-800">
                      {errorCount} com Erro
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddBlankCargo}
                    className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl hover:bg-slate-50 flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-500" /> Adicionar Carga Manual
                  </button>
                </div>
              </div>

              {/* List of Cargo Cards */}
              <div className="space-y-5">
                {parsedCargos.map((cargo, index) => {
                  const fin = calculateFinancials(
                    cargo.companyFreightValuePerTon,
                    cargo.hasIcms,
                    cargo.icmsPercentage
                  );

                  return (
                    <div
                      key={cargo.tempId}
                      className={`p-5 rounded-2xl border-2 transition-all bg-white dark:bg-slate-800/90 shadow-sm ${
                        cargo.status === 'error'
                          ? 'border-red-400/80 dark:border-red-600/80'
                          : cargo.status === 'warning'
                          ? 'border-amber-400/80 dark:border-amber-600/80'
                          : 'border-slate-200 dark:border-slate-700 hover:border-emerald-500/50'
                      }`}
                    >
                      {/* CARD HEADER */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-xl bg-slate-900 dark:bg-slate-700 text-white flex items-center justify-center text-xs font-black">
                            #{index + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                {cargo.origin || 'Origem não informada'} ➔ {cargo.destination || 'Destino não informado'}
                              </h4>
                              {cargo.status === 'ready' && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Pronta
                                </span>
                              )}
                              {cargo.status === 'warning' && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> Ajuste Necessário
                                </span>
                              )}
                              {cargo.status === 'error' && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 flex items-center gap-1">
                                  <XCircle className="w-3 h-3" /> Erro nos Dados
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDuplicateCargo(cargo)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-xs"
                            title="Duplicar Carga"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveCargo(cargo.tempId)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg text-xs"
                            title="Remover Carga"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* VALIDATION ERRORS BANNER */}
                      {cargo.validationErrors.length > 0 && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-red-800 dark:text-red-300 text-xs space-y-1">
                          <strong className="font-bold flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Corrija os seguintes campos para liberar a gravação:
                          </strong>
                          <ul className="list-disc list-inside space-y-0.5 pl-1">
                            {cargo.validationErrors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* CARD GRID FORM */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                        {/* Cliente */}
                        <div>
                          <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Cliente</label>
                          <select
                            value={cargo.clientId}
                            onChange={(e) => updateCargoField(cargo.tempId, { clientId: e.target.value })}
                            className="w-full p-2 border rounded-lg bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 font-medium"
                          >
                            {clients.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.razaoSocial || c.nomeFantasia}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Produto */}
                        <div>
                          <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Produto</label>
                          <select
                            value={cargo.productId}
                            onChange={(e) => updateCargoField(cargo.tempId, { productId: e.target.value })}
                            className="w-full p-2 border rounded-lg bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 font-medium"
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.unit})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Origem */}
                        <div>
                          <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                            Origem (Cidade, UF)
                          </label>
                          <input
                            type="text"
                            list={`cities-list-${cargo.tempId}`}
                            value={cargo.origin}
                            onChange={(e) => updateCargoField(cargo.tempId, { origin: e.target.value })}
                            placeholder="Ex: Rio Verde, GO"
                            className="w-full p-2 border rounded-lg bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 font-medium"
                          />
                          <datalist id={`cities-list-${cargo.tempId}`}>
                            {BRAZILIAN_CITIES.slice(0, 100).map((c) => (
                              <option key={c} value={c} />
                            ))}
                          </datalist>
                        </div>

                        {/* Destino */}
                        <div>
                          <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                            Destino (Cidade, UF)
                          </label>
                          <input
                            type="text"
                            list={`cities-list-dest-${cargo.tempId}`}
                            value={cargo.destination}
                            onChange={(e) => updateCargoField(cargo.tempId, { destination: e.target.value })}
                            placeholder="Ex: Descalvado, SP"
                            className="w-full p-2 border rounded-lg bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 font-medium"
                          />
                          <datalist id={`cities-list-dest-${cargo.tempId}`}>
                            {BRAZILIAN_CITIES.slice(0, 100).map((c) => (
                              <option key={c} value={c} />
                            ))}
                          </datalist>
                        </div>

                        {/* Local de Origem */}
                        <div>
                          <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                            Local / Coleta (Origem)
                          </label>
                          <input
                            type="text"
                            value={cargo.originLocation || ''}
                            onChange={(e) => updateCargoField(cargo.tempId, { originLocation: e.target.value })}
                            placeholder="Ex: MILHÃO ou COMIGO - Rio Verde"
                            className="w-full p-2 border rounded-lg bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-xs"
                          />
                        </div>

                        {/* Local de Destino / Fazenda */}
                        <div>
                          <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                            Local / Fazenda (Destino)
                          </label>
                          <input
                            type="text"
                            value={cargo.destinationLocation || ''}
                            onChange={(e) => updateCargoField(cargo.tempId, { destinationLocation: e.target.value })}
                            placeholder="Ex: ROYAL CANIN ou Fazenda Santa Maria"
                            className="w-full p-2 border rounded-lg bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-xs"
                          />
                        </div>

                        {/* Volume Total */}
                        <div>
                          <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                            Volume Total (Ton)
                          </label>
                          <input
                            type="number"
                            value={cargo.totalVolume}
                            onChange={(e) =>
                              updateCargoField(cargo.tempId, { totalVolume: parseFloat(e.target.value) || 0 })
                            }
                            className="w-full p-2 border rounded-lg bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 font-bold text-slate-800 dark:text-white"
                          />
                        </div>

                        {/* Link Google Maps Origem */}
                        <div>
                          <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1 flex items-center justify-between">
                            <span>Link Maps (Origem)</span>
                            {cargo.originMapLink && (
                              <a
                                href={cargo.originMapLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:underline flex items-center gap-0.5 text-[10px]"
                              >
                                Testar <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </label>
                          <input
                            type="text"
                            value={cargo.originMapLink || ''}
                            onChange={(e) => updateCargoField(cargo.tempId, { originMapLink: e.target.value })}
                            placeholder="https://maps.app.goo.gl/..."
                            className="w-full p-2 border rounded-lg bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-xs font-mono"
                          />
                        </div>
                      </div>

                      {/* MOTOR FINANCEIRO COM ABATIMENTO DE ICMS E MARGENS */}
                      <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                          <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase tracking-wide">
                            <DollarSign className="w-4 h-4 text-emerald-500" />
                            Motor Financeiro & Margens (-8% PJ / -12% PF)
                          </h5>

                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                              <input
                                type="checkbox"
                                checked={cargo.hasIcms}
                                onChange={(e) =>
                                  updateCargoField(cargo.tempId, {
                                    hasIcms: e.target.checked,
                                    icmsPercentage: e.target.checked && cargo.icmsPercentage === 0 ? 12 : cargo.icmsPercentage
                                  })
                                }
                                className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                              />
                              Tem ICMS?
                            </label>

                            {cargo.hasIcms && (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  value={cargo.icmsPercentage}
                                  onChange={(e) =>
                                    updateCargoField(cargo.tempId, {
                                      icmsPercentage: parseFloat(e.target.value) || 0
                                    })
                                  }
                                  className="w-16 p-1 text-center font-bold text-xs border rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
                                />
                                <span className="text-xs font-bold text-slate-500">%</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                              Frete Empresa (R$/ton)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={cargo.companyFreightValuePerTon}
                              onChange={(e) =>
                                updateCargoField(cargo.tempId, {
                                  companyFreightValuePerTon: parseFloat(e.target.value) || 0
                                })
                              }
                              className="w-full p-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 font-bold text-slate-900 dark:text-white"
                            />
                          </div>

                          {/* Real-time calculated badges */}
                          <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60">
                            <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 block">
                              Frete Empresa (Bruto)
                            </span>
                            <span className="text-sm font-black text-blue-900 dark:text-blue-200">
                              R$ {cargo.companyFreightValuePerTon.toFixed(2).replace('.', ',')}
                              <span className="text-[10px] font-normal text-blue-600 ml-1">[Base]</span>
                            </span>
                          </div>

                          <div className={`p-2.5 rounded-lg border ${
                            cargo.hasIcms
                              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60'
                              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                          }`}>
                            <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 block">
                              Base Líquida {cargo.hasIcms ? `(-${cargo.icmsPercentage}% ICMS)` : '(Sem ICMS)'}
                            </span>
                            <span className="text-sm font-black text-slate-900 dark:text-slate-100">
                              R$ {fin.netBase.toFixed(2).replace('.', ',')}
                              {cargo.hasIcms && (
                                <span className="text-[10px] font-normal text-red-500 ml-1">
                                  [-R$ {fin.icmsDeduction.toFixed(2).replace('.', ',')}]
                                </span>
                              )}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                            <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block">
                              Motorista PJ (-8% pós-ICMS)
                            </span>
                            <span className="text-sm font-black text-emerald-900 dark:text-emerald-200">
                              R$ {fin.driverFreightPj.toFixed(2).replace('.', ',')}
                            </span>
                            <span className="text-[10px] text-purple-600 dark:text-purple-300 block font-medium">
                              PF (-12%): R$ {fin.driverFreightPf.toFixed(2).replace('.', ',')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* SELETOR DE CONJUNTOS E CARROCERIAS (VEÍCULOS PERMITIDOS) */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5 text-blue-500" />
                            Tipos de Veículos Permitidos:
                          </label>
                          <button
                            type="button"
                            onClick={() => handleApplyStandardVehicles(cargo.tempId)}
                            className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                          >
                            ⚡ Adicionar Padrão (LS, 4º Eixo, Bitrem)
                          </button>
                        </div>

                        {/* Removable tags list */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {(cargo.allowedVehicleTypes || []).map((vt, vIdx) => (
                            <span
                              key={vIdx}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                            >
                              🚛 {vt.setType}: {vt.bodyTypes.join('/')}
                              <button
                                type="button"
                                onClick={() => handleRemoveVehicleSet(cargo.tempId, vt.setType)}
                                className="text-blue-400 hover:text-red-500 ml-1 text-xs"
                                title="Remover conjunto"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          {(!cargo.allowedVehicleTypes || cargo.allowedVehicleTypes.length === 0) && (
                            <span className="text-xs text-amber-600 dark:text-amber-400 italic">
                              ⚠️ Nenhum conjunto permitido adicionado.
                            </span>
                          )}
                        </div>

                        {/* Add vehicle set form row */}
                        <div className="flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-900/40 p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                          <select
                            id={`select-set-${cargo.tempId}`}
                            defaultValue={VehicleSetType.LSSimples}
                            className="p-1.5 border rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 font-medium"
                          >
                            {Object.values(VehicleSetType).map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>

                          <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            <input
                              type="checkbox"
                              id={`cb-gran-${cargo.tempId}`}
                              defaultChecked
                              className="rounded text-blue-600"
                            />
                            Graneleiro
                          </label>

                          <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            <input
                              type="checkbox"
                              id={`cb-basc-${cargo.tempId}`}
                              defaultChecked
                              className="rounded text-blue-600"
                            />
                            Basculante
                          </label>

                          <button
                            type="button"
                            onClick={() => {
                              const selEl = document.getElementById(`select-set-${cargo.tempId}`) as HTMLSelectElement;
                              const granEl = document.getElementById(`cb-gran-${cargo.tempId}`) as HTMLInputElement;
                              const bascEl = document.getElementById(`cb-basc-${cargo.tempId}`) as HTMLInputElement;

                              const bodyTypes: VehicleBodyType[] = [];
                              if (granEl?.checked) bodyTypes.push(VehicleBodyType.Graneleiro);
                              if (bascEl?.checked) bodyTypes.push(VehicleBodyType.Basculante);

                              if (selEl?.value) {
                                handleAddVehicleSet(cargo.tempId, selEl.value as VehicleSetType, bodyTypes);
                              }
                            }}
                            className="px-2.5 py-1 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white font-bold rounded-lg text-[11px] flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Adicionar
                          </button>
                        </div>
                      </div>

                      {/* OBSERVAÇÕES & ANEXOS */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Observações Editor & Clickable Link Preview */}
                        <div className="md:col-span-2 space-y-2">
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                            Observações e Detalhes do Roteiro (Links clicáveis automaticamente):
                          </label>
                          <textarea
                            rows={3}
                            value={cargo.observations || ''}
                            onChange={(e) => updateCargoField(cargo.tempId, { observations: e.target.value })}
                            placeholder="Informações adicionais, contatos, fazendas e roteiro..."
                            className="w-full p-2.5 border rounded-xl bg-slate-50 dark:bg-slate-900/60 border-slate-300 dark:border-slate-700 text-xs font-mono"
                          />
                          {cargo.observations && (
                            <div className="p-2.5 bg-slate-100 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
                              <span className="font-bold text-[10px] uppercase text-slate-500 block mb-1">Pré-visualização de Links:</span>
                              <FormattedObservations text={cargo.observations} />
                            </div>
                          )}
                        </div>

                        {/* Anexo Digitalizado com Visualizador Lightbox */}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                            Anexo / Roteiro Digitalizado:
                          </label>
                          {cargo.attachments && cargo.attachments.length > 0 ? (
                            <div className="space-y-2">
                              {cargo.attachments.map((att, attIdx) => (
                                <DocumentAttachmentCard
                                  key={attIdx}
                                  attachment={att}
                                  index={attIdx}
                                  label="Roteiro Digitalizado"
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="p-4 border border-dashed rounded-xl text-center text-xs text-slate-400">
                              Nenhum anexo fotográfico vinculado.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* FOOTER ACTIONS */}
              <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-5 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <ArrowLeft className="w-4 h-4" /> Voltar para Entrada
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 text-slate-600 dark:text-slate-400 font-semibold text-xs hover:underline"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    disabled={validCount === 0 || isSaving}
                    onClick={handleConfirmSaveAll}
                    className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm flex items-center gap-2 shadow-xl shadow-emerald-600/30 active:scale-95 transition-all"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Gravando {validCount} Cargas no Banco...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Confirmar e Criar {validCount} Carga(s) no Sistema ➔
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkCargoImportModal;
