import React, { useState } from 'react';
import { Shipment, ShipmentStatus, User, UserProfile, Cargo, Product, Client, RiskQueryOption } from '../types';
import { 
  CheckCircle2, Clock, AlertCircle, XCircle, FileText, Eye, 
  ExternalLink, User as UserIcon, Calendar, ShieldCheck, Scale, 
  DollarSign, Truck, MapPin, Building, CreditCard, ChevronDown, 
  ChevronUp, Check, Info, ArrowRight, Sparkles, AlertTriangle, FileCheck,
  MessageCircle, Send
} from 'lucide-react';
import { openDocumentInNewTab, isActualDocumentUrl, isDocumentMetadataKey } from '../utils/documentViewer';
import { findProductForCargo, checkRequiresRiskManagement } from '../utils';
import { isShipment100PercentAdvance, isShipment0PercentAdvance } from '../utils/freightCalculation';
import { useToast } from '../hooks/useToast';
import { 
  dispatchShipmentWhatsAppTrigger, 
  ShipmentWhatsAppTriggerType, 
  SHIPMENT_TRIGGER_TEMPLATES 
} from '../services/shipmentWhatsAppAutomation';
import { formatDisplayPhone } from '../services/whatsappService';

const STAGE_TRIGGER_MAP: Partial<Record<ShipmentStatus, ShipmentWhatsAppTriggerType>> = {
  [ShipmentStatus.PreCadastro]: 'risk_pending',
  [ShipmentStatus.AguardandoSeguradora]: 'risk_pending',
  [ShipmentStatus.AguardandoCarregamento]: 'risk_approved',
  [ShipmentStatus.AguardandoFiscal]: 'fiscal_emitted',
  [ShipmentStatus.AguardandoAdiantamento]: 'advance_paid',
  [ShipmentStatus.AguardandoAgendamento]: 'in_transit',
  [ShipmentStatus.AguardandoDescarga]: 'awaiting_discharge',
  [ShipmentStatus.Finalizado]: 'balance_paid',
};

interface ShipmentStagesTimelineProps {
  shipment: Shipment;
  cargo?: Cargo;
  users?: User[];
  products?: Product[];
  clients?: Client[];
  riskQueryOptions?: RiskQueryOption[];
  currentUser?: User | null;
  onInspectFile?: (fileOrUrl: string | File, docType: string, docName: string) => void;
}

export interface StageDefinition {
  status: ShipmentStatus;
  title: string;
  shortTitle: string;
  stepNumber: number;
  icon: React.ReactNode;
  description: string;
  associatedDocTypes: string[];
}

export const STAGES_DEFINITIONS: StageDefinition[] = [
  {
    status: ShipmentStatus.PreCadastro,
    title: 'Triagem / Pré-Cadastro',
    shortTitle: 'Triagem / Pré-Cadastro',
    stepNumber: 1,
    icon: <Truck className="w-4 h-4" />,
    description: 'Cadastro e checagem inicial de documentação, motorista, placas e previsão de carga.',
    associatedDocTypes: ['Arquivos Iniciais', 'Comprovante de Cadastro'],
  },
  {
    status: ShipmentStatus.AguardandoSeguradora,
    title: 'Análise de Risco (PGR)',
    shortTitle: 'Análise de Risco (PGR)',
    stepNumber: 2,
    icon: <ShieldCheck className="w-4 h-4" />,
    description: 'Consulta/liberação na gerenciadora de risco e seguradora.',
    associatedDocTypes: ['Comprovação da Liberação da Seguradora', 'Consulta de Risco', 'Liberação GR'],
  },
  {
    status: ShipmentStatus.AguardandoCarregamento,
    title: 'Aguardando Check-in / Carga',
    shortTitle: 'Aguardando Check-in / Carga',
    stepNumber: 3,
    icon: <Scale className="w-4 h-4" />,
    description: 'Veículo apto aguardando autorização de pátio, pesagem na origem e anexação de ticket.',
    associatedDocTypes: ['Ticket de Carregamento', 'Ticket de Pesagem'],
  },
  {
    status: ShipmentStatus.AguardandoNota,
    title: 'Emissão Fiscal (CT-e / NF-e)',
    shortTitle: 'Emissão Fiscal (CT-e / NF-e)',
    stepNumber: 4,
    icon: <FileText className="w-4 h-4" />,
    description: 'Faturamento e vinculação fiscal pelo embarcador/cliente.',
    associatedDocTypes: ['Nota Fiscal (NF-e)', 'NF-e', 'NFe'],
  },
  {
    status: ShipmentStatus.AguardandoFiscal,
    title: 'Emissão Fiscal (CT-e & MDF-e)',
    shortTitle: 'Emissão Fiscal (CT-e & MDF-e)',
    stepNumber: 5,
    icon: <FileText className="w-4 h-4" />,
    description: 'Emissão dos documentos fiscais de transporte (CT-e, MDF-e, CIOT e Contrato de Frete).',
    associatedDocTypes: ['Documentos de Viagem (CT-e, MDF-e, Contrato)', 'CT-e', 'MDF-e', 'Contrato de Transporte', 'CIOT', 'Carta Frete'],
  },
  {
    status: ShipmentStatus.AguardandoAdiantamento,
    title: 'Liberação de Adiantamento',
    shortTitle: 'Liberação de Adiantamento',
    stepNumber: 6,
    icon: <CreditCard className="w-4 h-4" />,
    description: 'Validação do adiantamento financeiro (conta bancária/PIX) e crédito do Vale-Pedágio (Tag).',
    associatedDocTypes: ['Comprovante de Adiantamento'],
  },
  {
    status: ShipmentStatus.AguardandoAgendamento,
    title: 'Agendamento de Descarga (Slot)',
    shortTitle: 'Agendamento de Descarga (Slot)',
    stepNumber: 7,
    icon: <Calendar className="w-4 h-4" />,
    description: 'Marcação da janela de descarregamento ou troca de NF-e no destinatário.',
    associatedDocTypes: ['Comprovante de Agendamento', 'Agendamento ou Troca de NF-e'],
  },
  {
    status: ShipmentStatus.AguardandoDescarga,
    title: 'Em Trânsito / Aguardando Descarga',
    shortTitle: 'Em Trânsito / Aguardando Descarga',
    stepNumber: 8,
    icon: <Scale className="w-4 h-4" />,
    description: 'Veículo em rota ou fila de descarga, pesagem final e apuração de quebra ou sobra.',
    associatedDocTypes: ['Comprovante de Descarga'],
  },
  {
    status: ShipmentStatus.ValidacaoTicket,
    title: 'Valid. de Ticket',
    shortTitle: 'Valid. Ticket',
    stepNumber: 9,
    icon: <FileCheck className="w-4 h-4" />,
    description: 'Conferência do ticket de balança anexado e validação do peso descarregado.',
    associatedDocTypes: ['Comprovante de Descarga', 'Ticket de Balança', 'Ticket de Descarga', 'Validação de Ticket e Peso', 'Valid. de Ticket'],
  },
  {
    status: ShipmentStatus.AguardandoPagamentoSaldo,
    title: 'Liquidação de Saldo',
    shortTitle: 'Liquidação de Saldo',
    stepNumber: 10,
    icon: <DollarSign className="w-4 h-4" />,
    description: 'Prestação de contas, apuração do saldo líquido e quitação final.',
    associatedDocTypes: ['Comprovante de Pagamento de Saldo'],
  },
  {
    status: ShipmentStatus.Finalizado,
    title: 'Operação Concluída',
    shortTitle: 'Operação Concluída',
    stepNumber: 11,
    icon: <CheckCircle2 className="w-4 h-4" />,
    description: 'Ciclo finalizado com apuração do lucro real e conciliação de custos.',
    associatedDocTypes: [],
  },
];

const ORDERED_STATUS_KEYS = [
  ShipmentStatus.PreCadastro,
  ShipmentStatus.AguardandoSeguradora,
  ShipmentStatus.AguardandoCarregamento,
  ShipmentStatus.AguardandoNota,
  ShipmentStatus.AguardandoFiscal,
  ShipmentStatus.AguardandoAdiantamento,
  ShipmentStatus.AguardandoAgendamento,
  ShipmentStatus.AguardandoDescarga,
  ShipmentStatus.ValidacaoTicket,
  ShipmentStatus.AguardandoPagamentoSaldo,
  ShipmentStatus.Finalizado,
];

export const ShipmentStagesTimeline: React.FC<ShipmentStagesTimelineProps> = ({
  shipment,
  cargo,
  users = [],
  products = [],
  clients = [],
  riskQueryOptions = [],
  currentUser,
  onInspectFile,
}) => {
  const isClientUser = currentUser?.profile === UserProfile.Cliente || (currentUser?.profile as string) === 'Cliente';

  const visibleStageDefinitions = React.useMemo(() => {
    const is0PctAdv = isShipment0PercentAdvance(shipment);
    const is100PctAdv = isShipment100PercentAdvance(shipment);
    
    const omitSaldo = isClientUser || (is100PctAdv && shipment.status !== ShipmentStatus.AguardandoPagamentoSaldo);
    const omitAdiantamento = is0PctAdv && shipment.status !== ShipmentStatus.AguardandoAdiantamento;

    const product = findProductForCargo(products, cargo);
    const doesNotRequireGr = !checkRequiresRiskManagement(cargo, product);
    const omitSeguradora = doesNotRequireGr && shipment.status !== ShipmentStatus.AguardandoSeguradora;

    const omitAgendamento = !cargo?.requiresScheduling && shipment.status !== ShipmentStatus.AguardandoAgendamento;

    let list = STAGES_DEFINITIONS;
    if (omitSeguradora) {
      list = list.filter(s => s.status !== ShipmentStatus.AguardandoSeguradora);
    }
    if (omitSaldo) {
      list = list.filter(s => s.status !== ShipmentStatus.AguardandoPagamentoSaldo);
    }
    if (omitAdiantamento) {
      list = list.filter(s => s.status !== ShipmentStatus.AguardandoAdiantamento);
    }
    if (omitAgendamento) {
      list = list.filter(s => s.status !== ShipmentStatus.AguardandoAgendamento);
    }

    return list.map((s, idx) => ({
      ...s,
      stepNumber: idx + 1,
      description: s.status === ShipmentStatus.Finalizado 
        ? 'Embarque finalizado e entrega concluída com sucesso.' 
        : (s.status === ShipmentStatus.AguardandoFiscal && isClientUser
            ? 'Emissão do CT-e, MDF-e e documentos fiscais da viagem.'
            : s.description),
      associatedDocTypes: isClientUser 
        ? s.associatedDocTypes.filter(d => !d.toLowerCase().includes('carta frete'))
        : s.associatedDocTypes
    }));
  }, [isClientUser, shipment.advancePercentage, shipment.balanceToReceiveValue, shipment.advanceValue, shipment.driverFreightValue, shipment.status, products, cargo]);

  // Inicializa a aba ativa com o status atual do embarque
  const initialActiveStage = React.useMemo(() => {
    const found = visibleStageDefinitions.find(s => s.status === shipment.status);
    return found ? found.status : (visibleStageDefinitions[0]?.status || ShipmentStatus.PreCadastro);
  }, [shipment.status, visibleStageDefinitions]);

  const [activeStageTab, setActiveStageTab] = useState<ShipmentStatus>(initialActiveStage);
  const [viewMode, setViewMode] = useState<'tabs' | 'list'>('tabs');
  const [expandedStage, setExpandedStage] = useState<ShipmentStatus | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'completed' | 'active'>('all');
  const [isSendingWa, setIsSendingWa] = useState<ShipmentStatus | null>(null);
  const { showToast } = useToast();

  const handleSendStageWhatsApp = async (stageStatus: ShipmentStatus) => {
    const triggerType = STAGE_TRIGGER_MAP[stageStatus];
    if (!triggerType) return;
    setIsSendingWa(stageStatus);
    try {
      const res = await dispatchShipmentWhatsAppTrigger(triggerType, {
        shipment,
        cargo,
        client: clients.find(c => c.id === cargo?.clientId),
        user: currentUser,
        targetStatus: stageStatus
      });
      if (res.success) {
        showToast(res.message || `WhatsApp enviado para ${shipment.driverName}!`, 'success');
      } else {
        showToast(res.error || 'Não foi possível enviar WhatsApp.', 'warning');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao enviar WhatsApp.', 'error');
    } finally {
      setIsSendingWa(null);
    }
  };

  // Atualiza a aba ativa caso o status do embarque mude externamente
  React.useEffect(() => {
    if (visibleStageDefinitions.some(s => s.status === shipment.status)) {
      setActiveStageTab(shipment.status);
    }
  }, [shipment.status, visibleStageDefinitions]);

  const formatCurrency = (val?: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const formatDate = (isoString?: string) => {
    if (!isoString) return '---';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const getUserName = (userId?: string) => {
    if (!userId) return null;
    const found = users.find(u => u.id === userId);
    return found ? `${found.name} (${found.profile})` : userId;
  };

  // Determina o índice do status atual no fluxo canônico
  const isCanceled = shipment.status === ShipmentStatus.Cancelado;
  const currentStatusIndex = ORDERED_STATUS_KEYS.indexOf(shipment.status);

  // Mapeia histórico de status por chave de status
  const historyMap = React.useMemo(() => {
    const map: { [key: string]: { timestamp: string; userId: string; durationText?: string } } = {};
    const statusHist = shipment.statusHistory || [];
    
    // Se o shipment foi criado e não tem histórico de pré-cadastro explícito, usa createdAt
    if (shipment.createdAt) {
      map[ShipmentStatus.PreCadastro] = {
        timestamp: shipment.createdAt,
        userId: shipment.createdById || '',
      };
    }

    for (let i = 0; i < statusHist.length; i++) {
      const entry = statusHist[i];
      let durationText = '';
      if (i < statusHist.length - 1) {
        const nextEntry = statusHist[i + 1];
        const t1 = new Date(entry.timestamp).getTime();
        const t2 = new Date(nextEntry.timestamp).getTime();
        if (t2 > t1) {
          const diffMs = t2 - t1;
          const diffHrs = diffMs / (1000 * 60 * 60);
          if (diffHrs < 1) {
            durationText = `${Math.round(diffMs / (1000 * 60))} min`;
          } else if (diffHrs < 24) {
            durationText = `${diffHrs.toFixed(1)} h`;
          } else {
            durationText = `${(diffHrs / 24).toFixed(1)} dias`;
          }
        }
      }
      map[entry.status] = {
        timestamp: entry.timestamp,
        userId: entry.userId,
        durationText,
      };
    }
    return map;
  }, [shipment.statusHistory, shipment.createdAt, shipment.createdById]);

  // Documentos organizados por etapa
  const documentsByStage = React.useMemo(() => {
    const map: { [key: string]: { docType: string; url: string; fileName: string }[] } = {};
    const docsObj = shipment.documents || {};

    Object.entries(docsObj).forEach(([docType, val]) => {
      if (isDocumentMetadataKey(docType)) return;
      if (isClientUser && docType.toLowerCase().includes('carta frete')) return;

      const rawUrls = (Array.isArray(val) ? val : (typeof val === 'string' ? [val] : []));
      // Filtra estritamente para manter apenas arquivos e URLs navegáveis reais
      const urls = rawUrls.filter(u => isActualDocumentUrl(u));
      if (urls.length === 0) return;

      // Encontra a etapa correspondente
      const targetStage = visibleStageDefinitions.find(stage => 
        stage.associatedDocTypes.some(t => t.toLowerCase() === docType.toLowerCase())
      ) || visibleStageDefinitions[4] || visibleStageDefinitions[0];

      if (!map[targetStage.status]) {
        map[targetStage.status] = [];
      }

      urls.forEach(url => {
        const rawFileName = typeof url === 'string' ? (url.split('/').pop()?.split('?')[0] || '') : '';
        const decoded = decodeURIComponent(rawFileName);
        const cleanName = decoded.includes('_') ? decoded.split('_').slice(2).join('_') || decoded : (decoded || `${docType}`);
        map[targetStage.status].push({
          docType,
          url,
          fileName: cleanName,
        });
      });
    });

    return map;
  }, [shipment.documents, isClientUser, visibleStageDefinitions]);

  const totalStagesCount = visibleStageDefinitions.length;

  // Contagem de etapas concluídas
  const completedStagesCount = React.useMemo(() => {
    if (shipment.status === ShipmentStatus.Finalizado) return totalStagesCount;
    if (isCanceled) return 0;
    const activeIdx = visibleStageDefinitions.findIndex(s => s.status === shipment.status);
    return activeIdx !== -1 ? activeIdx : Math.max(0, currentStatusIndex);
  }, [shipment.status, isCanceled, currentStatusIndex, totalStagesCount, visibleStageDefinitions]);

  const completionPercentage = Math.round((completedStagesCount / totalStagesCount) * 100);

  const getStageState = (stageStatus: ShipmentStatus, stageIndex: number) => {
    if (isCanceled) {
      if (shipment.status === stageStatus) return 'canceled';
      return historyMap[stageStatus] ? 'completed' : 'pending';
    }
    if (shipment.status === ShipmentStatus.Finalizado) {
      return 'completed';
    }
    if (shipment.status === stageStatus) {
      return 'active';
    }
    if (currentStatusIndex !== -1 && stageIndex < currentStatusIndex) {
      return 'completed';
    }
    if (historyMap[stageStatus]) {
      return 'completed';
    }
    return 'pending';
  };

  const filteredStages = visibleStageDefinitions.filter((stage, index) => {
    const state = getStageState(stage.status, index);
    if (filterMode === 'completed') return state === 'completed';
    if (filterMode === 'active') return state === 'active' || state === 'pending';
    return true;
  });

  // Identifica o índice da aba atual para navegação Anterior/Próxima
  const currentActiveTabIndex = visibleStageDefinitions.findIndex(s => s.status === activeStageTab);
  const selectedStageData = visibleStageDefinitions[currentActiveTabIndex >= 0 ? currentActiveTabIndex : 0];

  const handlePrevStage = () => {
    if (currentActiveTabIndex > 0) {
      setActiveStageTab(visibleStageDefinitions[currentActiveTabIndex - 1].status);
    }
  };

  const handleNextStage = () => {
    if (currentActiveTabIndex < visibleStageDefinitions.length - 1) {
      setActiveStageTab(visibleStageDefinitions[currentActiveTabIndex + 1].status);
    }
  };

  return (
    <div className="space-y-4">
      {/* Barra de Progresso e Visão Geral do Fluxo */}
      <div className="bg-slate-900/95 text-white p-4 rounded-2xl border border-slate-700/80 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Linha do Tempo das Etapas do Embarque
                <span className="text-[11px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                  {completedStagesCount} de {totalStagesCount} etapas concluídas
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Histórico detalhado de ações, horários, responsáveis e dados registrados em cada status.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Seletor de Modo de Visualização */}
            <div className="flex items-center bg-slate-800 p-0.5 rounded-xl border border-slate-700 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setViewMode('tabs')}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'tabs'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Visualização otimizada por abas individuais"
              >
                Abas (Otimizado)
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Visualizar todas as etapas em lista completa"
              >
                Ver Todas
              </button>
            </div>

            <div className="flex items-center gap-2 pl-2 border-l border-slate-700/80">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Progresso</span>
                <span className={`text-sm font-black ${completionPercentage === 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {completionPercentage}%
                </span>
              </div>
              <div className="w-16 bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    completionPercentage === 100
                      ? 'bg-emerald-500'
                      : 'bg-gradient-to-r from-amber-500 to-amber-500'
                  }`}
                  style={{ width: `${Math.max(5, completionPercentage)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stepper / Abas Horizontais Interativas */}
        <div className={`grid grid-cols-2 sm:grid-cols-5 ${visibleStageDefinitions.length === 10 ? 'lg:grid-cols-10' : 'lg:grid-cols-9'} gap-1.5 pt-2 border-t border-slate-800`}>
          {visibleStageDefinitions.map((stage, idx) => {
            const state = getStageState(stage.status, idx);
            const isTabActive = activeStageTab === stage.status;
            const isExpanded = expandedStage === stage.status;

            return (
              <button
                key={stage.status}
                type="button"
                onClick={() => {
                  setActiveStageTab(stage.status);
                  if (viewMode === 'list') {
                    setExpandedStage(isExpanded ? null : stage.status);
                  }
                }}
                className={`flex flex-col items-center text-center p-2 rounded-xl transition-all cursor-pointer border relative ${
                  viewMode === 'tabs' && isTabActive
                    ? 'bg-amber-950/80 border-amber-400 text-white ring-2 ring-amber-400/80 shadow-lg shadow-amber-950'
                    : state === 'completed'
                    ? 'bg-emerald-950/40 border-emerald-500/40 hover:bg-emerald-900/50 text-emerald-300'
                    : state === 'active'
                    ? 'bg-amber-900/60 border-amber-400 hover:bg-amber-800/80 text-amber-200 ring-1 ring-amber-400/30'
                    : state === 'canceled'
                    ? 'bg-red-950/40 border-red-500/40 hover:bg-red-900/50 text-red-300'
                    : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 text-slate-400'
                }`}
                title={`Clique para alternar para a etapa: ${stage.title}`}
              >
                <div className="flex items-center gap-1 mb-1">
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                    state === 'completed'
                      ? 'bg-emerald-500 text-slate-950'
                      : state === 'active'
                      ? 'bg-amber-400 text-slate-950 animate-pulse'
                      : state === 'canceled'
                      ? 'bg-red-500 text-white'
                      : 'bg-slate-700 text-slate-300'
                  }`}>
                    {state === 'completed' ? '✓' : stage.stepNumber}
                  </span>
                </div>
                <span className="text-[10px] font-bold truncate max-w-[85px] leading-tight">
                  {stage.shortTitle}
                </span>
                <span className="text-[9px] font-medium opacity-70 mt-0.5 truncate max-w-[85px]">
                  {state === 'completed' ? 'Concluído' : state === 'active' ? 'Em Aberto' : state === 'canceled' ? 'Cancelado' : 'Pendente'}
                </span>

                {/* Marcador triangular indicando a aba ativa */}
                {viewMode === 'tabs' && isTabActive && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-amber-500 rotate-45 rounded-2xs" />
                )}
              </button>
            );
          })}
        </div>

        {/* Barra de Controles e Legenda */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-800 text-xs">
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span> Concluído
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 ml-2"></span> Atual
            <span className="inline-block w-2 h-2 rounded-full bg-slate-500 ml-2"></span> Pendente
          </div>

          {viewMode === 'tabs' ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevStage}
                disabled={currentActiveTabIndex <= 0}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span>← Etapa Anterior</span>
              </button>
              <span className="text-[11px] font-mono font-bold text-amber-300">
                {currentActiveTabIndex + 1} de {visibleStageDefinitions.length}
              </span>
              <button
                type="button"
                onClick={handleNextStage}
                disabled={currentActiveTabIndex >= visibleStageDefinitions.length - 1}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-xs transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span>Próxima Etapa →</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  filterMode === 'all'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Todas as Etapas
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('completed')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  filterMode === 'completed'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Concluídas ({completedStagesCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('active')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  filterMode === 'active'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Ativa / Pendentes ({visibleStageDefinitions.length - completedStagesCount})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Conteúdo das Etapas: Modo Abas (Única) vs Modo Lista (Todas) */}
      <div className="space-y-3">
        {(viewMode === 'tabs' ? [selectedStageData].filter(Boolean) : filteredStages).map((stage, index) => {
          const originalIdx = visibleStageDefinitions.findIndex(s => s.status === stage.status);
          const state = getStageState(stage.status, originalIdx >= 0 ? originalIdx : index);
          const isExpanded = viewMode === 'tabs' || expandedStage === stage.status || (expandedStage === null && (state === 'active' || state === 'completed'));
          const historyEntry = historyMap[stage.status];
          const docs = documentsByStage[stage.status] || [];
          const stageUserName = historyEntry?.userId ? getUserName(historyEntry.userId) : (stage.status === ShipmentStatus.PreCadastro && shipment.createdById ? getUserName(shipment.createdById) : null);

          return (
            <div
              key={stage.status}
              className={`border rounded-2xl transition-all overflow-hidden ${
                state === 'completed'
                  ? 'bg-white dark:bg-gray-800/90 border-emerald-200 dark:border-emerald-800/60 shadow-xs'
                  : state === 'active'
                  ? 'bg-amber-50/40 dark:bg-slate-800/90 border-amber-300 dark:border-amber-600 shadow-md ring-1 ring-amber-400/30'
                  : state === 'canceled'
                  ? 'bg-red-50/30 dark:bg-gray-800/90 border-red-300 dark:border-red-800/60'
                  : 'bg-gray-50/70 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700/60 opacity-85'
              }`}
            >
              {/* Header do Card da Etapa */}
              <div
                onClick={() => setExpandedStage(isExpanded ? (expandedStage === stage.status ? '__none__' as any : null) : stage.status)}
                className={`p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-2.5 cursor-pointer hover:bg-gray-100/60 dark:hover:bg-gray-700/40 transition-colors ${
                  state === 'active' ? 'bg-amber-100/40 dark:bg-amber-950/20' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-xs ${
                    state === 'completed'
                      ? 'bg-emerald-500 text-white'
                      : state === 'active'
                      ? 'bg-amber-600 text-white ring-2 ring-amber-400/40'
                      : state === 'canceled'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }`}>
                    {state === 'completed' ? <Check className="w-4 h-4 stroke-[3]" /> : stage.stepNumber}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-1.5">
                        {stage.title}
                      </h4>
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                        state === 'completed'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                          : state === 'active'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-700 animate-pulse'
                          : state === 'canceled'
                          ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-300 dark:border-red-800'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600'
                      }`}>
                        {state === 'completed' ? '✓ Concluído' : state === 'active' ? '⏳ Em Andamento' : state === 'canceled' ? '⛔ Cancelado' : '○ Pendente'}
                      </span>

                      {docs.length > 0 && (
                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                          📎 {docs.length} {docs.length === 1 ? 'anexo' : 'anexos'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {stage.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {historyEntry?.timestamp && (
                    <div className="text-right hidden sm:block">
                      <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 block">Concluído em</span>
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                        {formatDate(historyEntry.timestamp)}
                      </span>
                    </div>
                  )}

                  <div className="p-1 rounded-lg bg-gray-100 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {/* Detalhes Expandidos da Etapa */}
              {isExpanded && (
                <div className="p-4 border-t border-gray-100 dark:border-gray-700/80 bg-white/60 dark:bg-gray-800/60 space-y-4">
                  {/* Informações de Execução e Responsável */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200/80 dark:border-gray-700/60 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                        <UserIcon className="w-3.5 h-3.5 text-amber-500" />
                        <span className="font-semibold">Responsável:</span>
                        <strong className="text-gray-900 dark:text-white">
                          {stageUserName || 'Sistema Automático / Pendente'}
                        </strong>
                      </div>

                      {historyEntry?.durationText && (
                        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 ml-2">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          <span>Tempo nesta etapa: <strong>{historyEntry.durationText}</strong></span>
                        </div>
                      )}
                    </div>

                    {historyEntry?.timestamp && (
                      <div className="text-gray-500 dark:text-gray-400 text-[11px] font-medium">
                        Data/Hora: <strong className="text-gray-800 dark:text-gray-200">{formatDate(historyEntry.timestamp)}</strong>
                      </div>
                    )}
                  </div>

                  {/* Detalhes Específicos por Tipo de Etapa */}
                  {stage.status === ShipmentStatus.PreCadastro && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                      <div className="p-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border dark:border-gray-700">
                        <span className="text-[10px] font-bold text-gray-500 uppercase block mb-0.5">Motorista</span>
                        <span className="font-bold text-gray-900 dark:text-white truncate block">{shipment.driverName}</span>
                        {shipment.driverCpf && <span className="text-[10px] text-gray-400 block font-mono">CPF: {shipment.driverCpf}</span>}
                      </div>
                      <div className="p-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border dark:border-gray-700">
                        <span className="text-[10px] font-bold text-gray-500 uppercase block mb-0.5">Placas do Conjunto</span>
                        <span className="font-mono font-bold text-gray-900 dark:text-white block">{shipment.horsePlate}</span>
                        <span className="text-[10px] text-gray-400 block truncate">
                          {[shipment.trailer1Plate, shipment.trailer2Plate, shipment.trailer3Plate].filter(Boolean).join(' | ') || 'Sem carretas'}
                        </span>
                      </div>
                      <div className="p-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border dark:border-gray-700">
                        <span className="text-[10px] font-bold text-gray-500 uppercase block mb-0.5">Peso Estimado</span>
                        <span className="font-bold text-gray-900 dark:text-white block">{shipment.shipmentTonnage || 0} ton</span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">Previsto no Contrato</span>
                      </div>
                      <div className="p-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border dark:border-gray-700">
                        <span className="text-[10px] font-bold text-gray-500 uppercase block mb-0.5">Tipo de Frete</span>
                        <span className="font-extrabold text-amber-600 dark:text-amber-400 block">{shipment.driverFreightType || 'PJ'}</span>
                        <span className="text-[10px] text-gray-400 block truncate">{shipment.paymentMethod || 'PIX - E-FRETE'}</span>
                      </div>
                    </div>
                  )}

                  {stage.status === ShipmentStatus.AguardandoSeguradora && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className="p-2.5 bg-amber-50/50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase block mb-0.5">Código de Liberação GR</span>
                        <span className="font-mono font-black text-sm text-amber-950 dark:text-amber-100 block">
                          {shipment.riskReleaseCode || 'Não informado / Pendente'}
                        </span>
                      </div>
                      <div className="p-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border dark:border-gray-700">
                        <span className="text-[10px] font-bold text-gray-500 uppercase block mb-0.5">Modalidade de Consulta</span>
                        <span className="font-bold text-gray-900 dark:text-white block">
                          {shipment.riskQueryType || 'Consulta Padrão'}
                        </span>
                      </div>
                      {!isClientUser && (
                        <div className="p-2.5 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800">
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase block mb-0.5">Custo Registrado da GR</span>
                          <span className="font-black text-sm text-emerald-900 dark:text-emerald-100 block">
                            {formatCurrency(shipment.riskQueryCost !== undefined ? shipment.riskQueryCost : 6.50)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {stage.status === ShipmentStatus.AguardandoCarregamento && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className="p-2.5 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800">
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase block mb-0.5">Peso Carregado (Balança)</span>
                        <span className="font-mono font-black text-sm text-emerald-900 dark:text-emerald-100 block">
                          {shipment.loadedTonnage || shipment.shipmentTonnage || '---'} ton
                        </span>
                      </div>
                      <div className="p-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border dark:border-gray-700 col-span-2">
                        <span className="text-[10px] font-bold text-gray-500 uppercase block mb-0.5">Rota / Trajeto Validado</span>
                        <span className="font-medium text-gray-800 dark:text-gray-200 block truncate" title={shipment.route || `${cargo?.origin} → ${cargo?.destination}`}>
                          {shipment.route || `${cargo?.origin || 'Origem'} → ${cargo?.destination || 'Destino'}`}
                        </span>
                      </div>
                    </div>
                  )}

                  {stage.status === ShipmentStatus.AguardandoNota && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className="p-2.5 bg-amber-50/50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase block mb-0.5">Número da NF-e</span>
                        <span className="font-mono font-bold text-sm text-amber-950 dark:text-amber-100 block">
                          {shipment.nfeNumber ? `NF-e nº ${shipment.nfeNumber}` : 'Documento anexado'}
                        </span>
                      </div>
                      <div className="p-2.5 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800">
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase block mb-0.5">Valor da Mercadoria / NF</span>
                        <span className="font-black text-sm text-emerald-900 dark:text-emerald-100 block">
                          {shipment.nfeValue ? formatCurrency(shipment.nfeValue) : (shipment.realProfitData?.invoiceValue ? formatCurrency(shipment.realProfitData.invoiceValue) : 'Averbada')}
                        </span>
                      </div>
                      {!isClientUser && (
                        <div className="p-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border dark:border-gray-700">
                          <span className="text-[10px] font-bold text-gray-500 uppercase block mb-0.5">Chave PIX / Dados Pagamento</span>
                          <span className="font-mono font-medium text-gray-800 dark:text-gray-200 block truncate" title={shipment.pixKey || shipment.bankDetails || '---'}>
                            {shipment.pixKey || shipment.bankDetails || 'PIX - E-FRETE'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {stage.status === ShipmentStatus.AguardandoFiscal && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className="p-2.5 bg-amber-50/50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase block mb-0.5">CT-e Emitido</span>
                        <span className="font-mono font-bold text-sm text-amber-950 dark:text-amber-100 block">
                          {shipment.cteNumber ? `CT-e nº ${shipment.cteNumber}` : 'CT-e Emitido'}
                        </span>
                        {shipment.cteEmissionDate && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-semibold mt-0.5">
                            Emissão: {shipment.cteEmissionDate}
                          </span>
                        )}
                      </div>
                      <div className="p-2.5 bg-violet-50/50 dark:bg-violet-950/30 rounded-xl border border-violet-200 dark:border-violet-800">
                        <span className="text-[10px] font-bold text-violet-700 dark:text-violet-300 uppercase block mb-0.5">MDF-e</span>
                        <span className="font-mono font-bold text-sm text-violet-950 dark:text-violet-100 block">
                          {shipment.mdfeNumber ? `MDF-e nº ${shipment.mdfeNumber}` : 'Emitido'}
                        </span>
                      </div>
                      <div className="p-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border dark:border-gray-700">
                        <span className="text-[10px] font-bold text-gray-500 uppercase block mb-0.5">Documentos da Viagem</span>
                        <span className="font-bold text-gray-800 dark:text-gray-200 block">
                          {isClientUser ? 'Documentos Fiscais Emitidos' : 'Carta Frete & Contrato Anexados'}
                        </span>
                      </div>
                    </div>
                  )}

                  {stage.status === ShipmentStatus.AguardandoAdiantamento && (
                    isClientUser ? (
                      <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs flex items-center justify-between">
                        <div>
                          <span className="font-bold text-emerald-900 dark:text-emerald-100 block">Viagem Liberada</span>
                          <span className="text-[11px] text-emerald-700 dark:text-emerald-300">Veículo em trânsito com liberação operacional confirmada.</span>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg font-bold text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          Liberado ✓
                        </span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                        <div className="p-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border dark:border-gray-700">
                          <span className="text-[10px] font-bold text-gray-500 uppercase block mb-0.5">% Adiantamento</span>
                          <span className="font-black text-sm text-emerald-600 dark:text-emerald-400 block">
                            {shipment.advancePercentage !== undefined ? shipment.advancePercentage : 80}%
                          </span>
                        </div>
                        <div className="p-2.5 bg-amber-50/50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
                          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase block mb-0.5">Adiantamento em Conta</span>
                          <span className="font-black text-sm text-amber-950 dark:text-amber-100 block">
                            {formatCurrency(shipment.advanceValue)}
                          </span>
                        </div>
                        <div className="p-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border dark:border-gray-700">
                          <span className="text-[10px] font-bold text-gray-500 uppercase block mb-0.5">Vale-Pedágio (Tag)</span>
                          <span className="font-black text-sm text-gray-900 dark:text-white block">
                            {formatCurrency(shipment.tollValue)}
                          </span>
                        </div>
                        <div className="p-2.5 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800">
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase block mb-0.5">Total Liberado na Saída</span>
                          <span className="font-black text-sm text-emerald-900 dark:text-emerald-100 block">
                            {formatCurrency((Number(shipment.advanceValue) || 0) + (Number(shipment.tollValue) || 0))}
                          </span>
                        </div>
                      </div>
                    )
                  )}

                  {stage.status === ShipmentStatus.AguardandoAgendamento && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border dark:border-gray-700 text-xs flex items-center justify-between">
                      <div>
                        <span className="font-bold text-gray-800 dark:text-gray-200 block">Janela de Agendamento Confirmada</span>
                        <span className="text-[11px] text-gray-500">Agendamento registrado para descarga no destino.</span>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg font-bold text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        Confirmado
                      </span>
                    </div>
                  )}

                  {stage.status === ShipmentStatus.AguardandoDescarga && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className="p-2.5 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800">
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase block mb-0.5">Peso Descarregado (Destino)</span>
                        <span className="font-mono font-black text-sm text-emerald-900 dark:text-emerald-100 block">
                          {shipment.unloadedTonnage ? `${shipment.unloadedTonnage} ton` : '---'}
                        </span>
                      </div>
                      <div className="p-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border dark:border-gray-700">
                        <span className="text-[10px] font-bold text-gray-500 uppercase block mb-0.5">Peso Carregado (Origem)</span>
                        <span className="font-mono font-bold text-sm text-gray-900 dark:text-white block">
                          {shipment.shipmentTonnage || '---'} ton
                        </span>
                      </div>
                      <div className="p-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border dark:border-gray-700">
                        <span className="text-[10px] font-bold text-gray-500 uppercase block mb-0.5">Diferença de Balança (Quebra/Sobra)</span>
                        {shipment.unloadedTonnage && shipment.shipmentTonnage ? (
                          <span className={`font-mono font-black text-sm block ${
                            (shipment.unloadedTonnage - shipment.shipmentTonnage) < -0.001
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {(shipment.unloadedTonnage - shipment.shipmentTonnage).toFixed(3)} ton ({((shipment.unloadedTonnage - shipment.shipmentTonnage) * 1000).toFixed(0)} kg)
                          </span>
                        ) : (
                          <span className="font-mono text-gray-400 block">---</span>
                        )}
                      </div>
                    </div>
                  )}

                  {stage.status === ShipmentStatus.ValidacaoTicket && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className="p-2.5 bg-amber-50/50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase block mb-0.5">Peso Descarregado / Balança</span>
                        <span className="font-mono font-black text-sm text-amber-900 dark:text-amber-100 block">
                          {shipment.unloadedTonnage ? `${shipment.unloadedTonnage} ton` : 'Aguardando validação'}
                        </span>
                      </div>
                      <div className="p-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border dark:border-gray-700">
                        <span className="text-[10px] font-bold text-gray-500 uppercase block mb-0.5">Peso Carregado (Origem)</span>
                        <span className="font-mono font-bold text-sm text-gray-900 dark:text-white block">
                          {shipment.shipmentTonnage || '---'} ton
                        </span>
                      </div>
                      <div className="p-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border dark:border-gray-700">
                        <span className="text-[10px] font-bold text-gray-500 uppercase block mb-0.5">Diferença de Balança (Quebra/Sobra)</span>
                        {shipment.unloadedTonnage && shipment.shipmentTonnage ? (
                          <span className={`font-mono font-black text-sm block ${
                            (shipment.unloadedTonnage - shipment.shipmentTonnage) < -0.001
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {(shipment.unloadedTonnage - shipment.shipmentTonnage).toFixed(3)} ton ({((shipment.unloadedTonnage - shipment.shipmentTonnage) * 1000).toFixed(0)} kg)
                          </span>
                        ) : (
                          <span className="font-mono text-gray-400 block">---</span>
                        )}
                      </div>
                    </div>
                  )}

                  {!isClientUser && stage.status === ShipmentStatus.AguardandoPagamentoSaldo && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                      <div className="p-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border dark:border-gray-700">
                        <span className="text-[10px] font-bold text-gray-500 uppercase block mb-0.5">Saldo Bruto</span>
                        <span className="font-bold text-sm text-gray-900 dark:text-white block">
                          {formatCurrency(shipment.balanceToReceiveValue)}
                        </span>
                      </div>
                      <div className="p-2.5 bg-red-50/40 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900/50">
                        <span className="text-[10px] font-bold text-red-700 dark:text-red-300 uppercase block mb-0.5">Desconto de Quebra</span>
                        <span className="font-bold text-sm text-red-600 dark:text-red-400 block">
                          {shipment.isBreakageWaived ? 'R$ 0,00 (Abonado)' : (shipment.discountValue ? `- ${formatCurrency(shipment.discountValue)}` : 'R$ 0,00')}
                        </span>
                      </div>
                      <div className="p-2.5 bg-emerald-50/60 dark:bg-emerald-950/40 rounded-xl border border-emerald-300 dark:border-emerald-800 col-span-2">
                        <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase block mb-0.5">Saldo Líquido Quitado</span>
                        <span className="font-black text-base text-emerald-900 dark:text-emerald-100 block">
                          {formatCurrency(shipment.netBalanceValue || shipment.balanceToReceiveValue)}
                        </span>
                      </div>
                    </div>
                  )}

                  {stage.status === ShipmentStatus.Finalizado && (
                    <div className={`grid gap-2.5 text-xs ${isClientUser ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
                      {isClientUser ? (
                        <>
                          <div className="p-2.5 bg-amber-50/50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
                            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase block mb-0.5">Valor Total do Frete</span>
                            <span className="font-black text-sm text-amber-950 dark:text-amber-100 block">
                              {formatCurrency(shipment.realProfitData?.companyFreight || (cargo?.companyFreightValuePerTon ? cargo.companyFreightValuePerTon * (shipment.shipmentTonnage || 0) : 0))}
                            </span>
                          </div>
                          <div className="p-2.5 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase block mb-0.5">Status da Entrega</span>
                              <span className="font-black text-sm text-emerald-950 dark:text-emerald-100 block">Concluída com Sucesso</span>
                            </div>
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                              Finalizado ✓
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="p-2.5 bg-amber-50/50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
                            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase block mb-0.5">Faturamento Empresa</span>
                            <span className="font-black text-sm text-amber-950 dark:text-amber-100 block">
                              {formatCurrency(shipment.realProfitData?.companyFreight || (cargo?.companyFreightValuePerTon ? cargo.companyFreightValuePerTon * (shipment.shipmentTonnage || 0) : 0))}
                            </span>
                          </div>
                          <div className="p-2.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border dark:border-gray-700">
                            <span className="text-[10px] font-bold text-gray-500 uppercase block mb-0.5">Custo Motorista</span>
                            <span className="font-black text-sm text-gray-900 dark:text-white block">
                              {formatCurrency(shipment.driverFreightValue)}
                            </span>
                          </div>
                          <div className="p-2.5 bg-emerald-50/60 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
                            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase block mb-0.5">Lucro Líquido Real</span>
                            <span className="font-black text-sm text-emerald-900 dark:text-emerald-100 block">
                              {formatCurrency(shipment.realProfitData?.netProfit)}
                            </span>
                          </div>
                          <div className="p-2.5 bg-emerald-50/60 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
                            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase block mb-0.5">Margem de Lucro</span>
                            <span className="font-black text-sm text-emerald-900 dark:text-emerald-100 block">
                              {shipment.realProfitData?.profitMarginPercent !== undefined ? `${shipment.realProfitData.profitMarginPercent.toFixed(1)}%` : '---'}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Documentos Anexados nesta Etapa */}
                  {docs.length > 0 && (
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-700/60">
                      <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 block mb-2">
                        📄 Documentos e Comprovantes Vinculados a esta Etapa:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {docs.map((doc, dIdx) => (
                          <div
                            key={dIdx}
                            className="p-2 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 shadow-2xs"
                          >
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                              <div className="truncate">
                                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 block truncate">
                                  {doc.docType}
                                </span>
                                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate block" title={doc.fileName}>
                                  {doc.fileName}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => openDocumentInNewTab(doc.url, `${doc.docType} - ${doc.fileName}`)}
                                className="p-1.5 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-amber-600 dark:text-amber-400 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-bold transition-all shadow-2xs"
                                title="Abrir documento em nova aba"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>

                              {onInspectFile && (
                                <button
                                  type="button"
                                  onClick={() => onInspectFile(doc.url, doc.docType, doc.fileName)}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[10px] font-bold transition-all shadow-2xs"
                                  title="Ver dados e campos extraídos pelo OCR"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Dados</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bloco Operacional de Notificação WhatsApp */}
                  {STAGE_TRIGGER_MAP[stage.status] && (
                    <div className="pt-3 border-t border-gray-100 dark:border-gray-700/60 flex flex-wrap items-center justify-between gap-3 p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/80 dark:border-emerald-800/40">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-emerald-600 text-white shadow-xs">
                          <MessageCircle className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-emerald-950 dark:text-emerald-100">
                              WhatsApp Automático: {SHIPMENT_TRIGGER_TEMPLATES[STAGE_TRIGGER_MAP[stage.status]!].name}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                              Disparo Automático
                            </span>
                          </div>
                          <span className="text-[11px] text-gray-600 dark:text-gray-300 block">
                            Motorista: <strong>{shipment.driverName}</strong> • {shipment.driverContact ? formatDisplayPhone(shipment.driverContact) : 'Telefone não cadastrado'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isSendingWa === stage.status || !shipment.driverContact}
                        onClick={() => handleSendStageWhatsApp(stage.status)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        title="Reenviar manualmente a mensagem oficial desta etapa para o WhatsApp do motorista"
                      >
                        {isSendingWa === stage.status ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Enviando...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Reenviar WhatsApp</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ShipmentStagesTimeline;
