import React, { useState, useMemo } from 'react';
import { 
  X, 
  RotateCw, 
  Truck, 
  Calendar, 
  Clock, 
  DollarSign, 
  Package, 
  Check, 
  ArrowRight, 
  MapPin, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  User, 
  Building2, 
  Info,
  Scale,
  ShieldCheck,
  CreditCard,
  Repeat
} from 'lucide-react';
import type { Shipment, Cargo, Client, Product, User as AppUser } from '../types';
import { CargoStatus, ShipmentStatus } from '../types';
import { formatBrl } from '../utils/financialCalculations';
import { calculateCargoBalance } from '../utils/cargoBalance';
import { calculateAdvanceAndBalance } from '../utils/freightCalculation';
import { findCargoById } from '../utils';

interface ReembarqueModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipment: Shipment | null;
  cargos: Cargo[];
  shipments: Shipment[];
  clients: Client[];
  products: Product[];
  currentUser: AppUser;
  onConfirmReembarque: (data: {
    selectedCargo: Cargo;
    scheduledDate: string;
    scheduledTime?: string;
    shipmentTonnage: number;
    driverFreightRate: number;
    driverFreightValue: number;
    notes?: string;
  }) => Promise<void>;
}

export const ReembarqueModal: React.FC<ReembarqueModalProps> = ({
  isOpen,
  onClose,
  shipment,
  cargos,
  shipments,
  clients,
  products,
  currentUser,
  onConfirmReembarque,
}) => {
  if (!isOpen || !shipment) return null;

  // Data de hoje e amanhã no formato YYYY-MM-DD
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  // Identificar com precisão a carga do embarque anterior (por UUID, sequenceId ou CRG-XX)
  const currentCargoResolved = useMemo(() => {
    return findCargoById(cargos, shipment?.cargoId);
  }, [cargos, shipment?.cargoId]);

  // Estados da nova programação
  const [selectedCargoId, setSelectedCargoId] = useState<string>(() => {
    return currentCargoResolved?.id || shipment.cargoId || '';
  });
  const [scheduledDate, setScheduledDate] = useState<string>(tomorrowStr);
  const [scheduledTime, setScheduledTime] = useState<string>('08:00');
  const [shipmentTonnage, setShipmentTonnage] = useState<number>(Number(shipment.shipmentTonnage) || 45);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sincroniza a seleção e dados quando o modal abre ou o embarque muda
  React.useEffect(() => {
    if (shipment) {
      const resolved = findCargoById(cargos, shipment.cargoId);
      setSelectedCargoId(resolved?.id || shipment.cargoId || '');
      setShipmentTonnage(Number(shipment.shipmentTonnage) || 45);
    }
  }, [shipment, cargos]);

  // Mapeamentos rápidos de clientes e produtos
  const clientMap = useMemo(() => {
    const map = new Map<string, string>();
    (clients || []).forEach(c => map.set(c.id, c.nomeFantasia || c.razaoSocial || (c as any).name || 'Cliente'));
    return map;
  }, [clients]);

  const productMap = useMemo(() => {
    const map = new Map<string, string>();
    (products || []).forEach(p => map.set(p.id, p.name));
    return map;
  }, [products]);

  // Filtrar cargas ativas em andamento (GARANTINDO SEMPRE a presença da carga atual, mesmo que Fechada ou Suspensa)
  const availableCargos = useMemo(() => {
    const targetId = currentCargoResolved?.id || shipment.cargoId;
    const list = (cargos || []).filter(c => {
      const isStatusOk = c.status === CargoStatus.EmAndamento || (c.status as string) === 'Em andamento';
      const isCurrentCargo = c.id === targetId || (currentCargoResolved && c.id === currentCargoResolved.id);
      return isStatusOk || isCurrentCargo;
    });

    // Se porventura a carga do embarque anterior não estiver na lista de ativas (ex: fechada/arquivada), inclui no início
    if (currentCargoResolved && !list.some(c => c.id === currentCargoResolved.id)) {
      list.unshift(currentCargoResolved);
    }
    return list;
  }, [cargos, currentCargoResolved, shipment.cargoId]);

  // Cargas filtradas pela busca
  const filteredCargos = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const currentCargoId = currentCargoResolved?.id || shipment.cargoId;
    
    // Separar a carga atual para exibir sempre em destaque no topo
    const currentCargo = availableCargos.find(c => c.id === currentCargoId || (currentCargoResolved && c.id === currentCargoResolved.id));
    const otherCargos = availableCargos.filter(c => c.id !== (currentCargo?.id || currentCargoId));

    const matchSearch = (c: Cargo) => {
      if (!term) return true;
      const clientName = clientMap.get(c.clientId) || (c as any).clientName || '';
      const prodName = productMap.get(c.productId) || (c as any).productName || '';
      const code = c.sequenceId ? `crg-${c.sequenceId}` : c.id.toLowerCase();
      const origin = `${c.origin || ''} ${(c as any).originCity || ''} ${(c as any).originState || ''}`.toLowerCase();
      const dest = `${c.destination || ''} ${(c as any).destinationCity || ''} ${(c as any).destinationState || ''}`.toLowerCase();
      const order = String((c as any).orderNumber || (c as any).numeroPedido || '').toLowerCase();

      return (
        clientName.toLowerCase().includes(term) ||
        prodName.toLowerCase().includes(term) ||
        code.includes(term) ||
        origin.includes(term) ||
        dest.includes(term) ||
        order.includes(term)
      );
    };

    const matchedOthers = otherCargos.filter(matchSearch);

    if (currentCargo && matchSearch(currentCargo)) {
      return [currentCargo, ...matchedOthers];
    }
    return matchedOthers;
  }, [availableCargos, currentCargoResolved, shipment.cargoId, searchTerm, clientMap, productMap]);

  // Carga selecionada atualmente
  const selectedCargo = useMemo(() => {
    return findCargoById(availableCargos, selectedCargoId) || 
           (currentCargoResolved && (currentCargoResolved.id === selectedCargoId || String(currentCargoResolved.sequenceId) === String(selectedCargoId)) ? currentCargoResolved : null) ||
           findCargoById(cargos, selectedCargoId) ||
           currentCargoResolved;
  }, [availableCargos, selectedCargoId, currentCargoResolved, cargos]);

  // Cálculos financeiros em tempo real
  const financialSummary = useMemo(() => {
    if (!selectedCargo) {
      return {
        driverRate: 0,
        totalFreight: 0,
        advanceVal: 0,
        balanceVal: 0,
        availableVolume: 0,
      };
    }

    const driverRate = Number(selectedCargo.driverFreightValuePerTon) || 0;
    const ton = Math.max(0, Number(shipmentTonnage) || 0);
    const totalFreight = ton * driverRate;

    const calc = calculateAdvanceAndBalance({
      driverFreightValue: totalFreight,
      driverFreightRate: driverRate,
      tonnage: ton,
      tollValue: 0,
      advancePercentage: shipment.advancePercentage ?? 70,
      driverFreightType: (shipment.driverFreightType as any) || 'PJ',
    });

    const balance = calculateCargoBalance(selectedCargo, shipments);

    return {
      driverRate,
      totalFreight,
      advanceVal: calc.advanceInAccountValue,
      balanceVal: calc.balanceToReceiveValue,
      availableVolume: balance.availableVolume,
    };
  }, [selectedCargo, shipmentTonnage, shipment.advancePercentage, shipment.driverFreightType, shipments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCargo) {
      alert('Por favor, selecione uma carga para o reembarque.');
      return;
    }

    if (shipmentTonnage <= 0) {
      alert('Informe uma tonelagem estimada válida.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirmReembarque({
        selectedCargo,
        scheduledDate,
        scheduledTime: scheduledTime.trim() || undefined,
        shipmentTonnage: Number(shipmentTonnage),
        driverFreightRate: financialSummary.driverRate,
        driverFreightValue: financialSummary.totalFreight,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      console.error('Erro ao programar reembarque:', err);
      alert(err?.message || 'Ocorreu um erro ao programar o reembarque.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full my-auto flex flex-col max-h-[92vh] overflow-hidden text-slate-800 dark:text-slate-100 transition-all"
        role="dialog"
        aria-modal="true"
      >
        {/* Header da Modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
              <RotateCw className="w-5 h-5 animate-spin-reverse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white leading-tight">
                  Programar Reembarque
                </h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  Novo Carregamento
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Programe a próxima viagem mantendo automaticamente o mesmo motorista e conjunto veicular.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo com Scroll */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Card Resumo do Motorista e Veículo (Herança de Dados) */}
          <div className="bg-gradient-to-r from-slate-50 to-slate-100/70 dark:from-slate-800/60 dark:to-slate-800/30 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Dados Herdados Automaticamente da Viagem Atual:
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                Embarque Atual: #{shipment.id} ({shipment.status})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {/* Motorista */}
              <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5 flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-400" />
                  Motorista
                </span>
                <p className="font-bold text-slate-900 dark:text-white truncate" title={shipment.driverName}>
                  {shipment.driverName}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  {shipment.driverCpf || 'Sem CPF'} • {shipment.driverContact || 'Sem fone'}
                </p>
              </div>

              {/* Conjunto Veicular */}
              <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5 flex items-center gap-1">
                  <Truck className="w-3 h-3 text-slate-400" />
                  Placas do Conjunto
                </span>
                <p className="font-black text-slate-900 dark:text-white font-mono">
                  Cavalo: {shipment.horsePlate}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                  Carretas: {[shipment.trailer1Plate, shipment.trailer2Plate, shipment.trailer3Plate].filter(Boolean).join(' / ') || 'Sem carreta vinculada'}
                </p>
              </div>

              {/* Titularidade / ANTT */}
              <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-slate-400" />
                  ANTT / Pagamento
                </span>
                <p className="font-bold text-slate-900 dark:text-white truncate">
                  {shipment.anttModality || 'ETC'} • {shipment.driverFreightType || 'PJ'}
                </p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono truncate" title={shipment.pixKey || shipment.bankDetails}>
                  {shipment.pixKey ? `PIX: ${shipment.pixKey}` : (shipment.bankDetails || 'Dados bancários preservados')}
                </p>
              </div>
            </div>

            <div className="p-2 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Atenção:</strong> O embarque atual <strong>#{shipment.id}</strong> continuará ativo até o encerramento da descarga e liquidação do saldo. O reembarque criará uma nova programação operacional já pronta em <strong>Ag. Carregamento</strong>.
              </span>
            </div>
          </div>

          {/* Configuração da Nova Viagem: Data, Hora e Toneladas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Data Prevista de Carregamento *
              </label>
              <input
                type="date"
                required
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-hidden transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Horário Previsto
              </label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-hidden transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Scale className="w-3.5 h-3.5 text-slate-400" />
                Toneladas Estimadas *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                required
                value={shipmentTonnage}
                onChange={(e) => setShipmentTonnage(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-hidden transition-all"
                placeholder="Ex: 46.50"
              />
            </div>
          </div>

          {/* Seletor de Cargas Disponíveis */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Selecione a Carga do Reembarque *</span>
                <span className="text-[10px] font-normal text-slate-400">
                  ({filteredCargos.length} disponíveis)
                </span>
              </label>
            </div>

            {/* Barra de Busca de Cargas */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por cliente, produto, cidade de origem, destino ou código CRG..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-hidden transition-all"
              />
            </div>

            {/* Lista de Cards de Cargas */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {filteredCargos.length === 0 ? (
                <div className="py-8 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                  <Package className="w-8 h-8 mx-auto mb-1 opacity-30" />
                  <p className="text-xs font-bold">Nenhuma carga encontrada</p>
                  <p className="text-[11px] text-slate-400">Tente ajustar o termo da busca.</p>
                </div>
              ) : (
                filteredCargos.map((cargo) => {
                  const isSelected = selectedCargoId === cargo.id;
                  const isCurrentCargo = cargo.id === (currentCargoResolved?.id || shipment.cargoId);
                  const clientName = clientMap.get(cargo.clientId) || (cargo as any).clientName || 'Cliente';
                  const productName = productMap.get(cargo.productId) || (cargo as any).productName || 'Produto';
                  const cargoCode = cargo.sequenceId ? `CRG-${cargo.sequenceId}` : cargo.id;
                  const balance = calculateCargoBalance(cargo, shipments);

                  return (
                    <div
                      key={cargo.id}
                      onClick={() => setSelectedCargoId(cargo.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer text-xs ${
                        isSelected
                          ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-500 shadow-sm ring-1 ring-emerald-500/50'
                          : 'bg-white dark:bg-slate-800/70 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          {/* Radio Button Customizado */}
                          <div className={`w-4 h-4 rounded-full mt-0.5 flex items-center justify-center shrink-0 border ${
                            isSelected 
                              ? 'border-emerald-600 bg-emerald-600 text-white' 
                              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'
                          }`}>
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>

                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600">
                                {cargoCode}
                              </span>
                              {isCurrentCargo && (
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  Carga Atual • Novo Ciclo
                                </span>
                              )}
                              {cargo.status !== CargoStatus.EmAndamento && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                  {cargo.status} (Reativar)
                                </span>
                              )}
                              <span className="font-bold text-slate-900 dark:text-white truncate">
                                {clientName}
                              </span>
                            </div>

                            {/* Rota e Produto */}
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 flex-wrap">
                              <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                <Package className="w-3 h-3" />
                                {productName}
                              </span>
                              <span className="text-slate-400">•</span>
                              <span className="flex items-center gap-1 text-[11px] truncate">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                {cargo.origin} <ArrowRight className="w-2.5 h-2.5 mx-0.5 text-slate-400" /> {cargo.destination}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Valores e Saldo */}
                        <div className="text-right shrink-0">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Frete Motorista
                          </span>
                          <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                            {formatBrl(cargo.driverFreightValuePerTon)}/ton
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">
                            Saldo: {balance.availableVolume.toLocaleString('pt-BR')} ton
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Resumo da Operação Selecionada */}
          {selectedCargo && (
            <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Resumo Financeiro da Nova Programação:
                </span>
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                  {shipmentTonnage.toLocaleString('pt-BR')} ton × {formatBrl(financialSummary.driverRate)}/ton
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-emerald-200/60 dark:border-emerald-800/40 text-center">
                <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Frete Total</span>
                  <strong className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                    {formatBrl(financialSummary.totalFreight)}
                  </strong>
                </div>
                <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">Adiantamento (70%)</span>
                  <strong className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400">
                    {formatBrl(financialSummary.advanceVal)}
                  </strong>
                </div>
                <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400 block">Saldo Final (30%)</span>
                  <strong className="text-xs sm:text-sm font-black text-purple-600 dark:text-purple-400">
                    {formatBrl(financialSummary.balanceVal)}
                  </strong>
                </div>
              </div>

              {/* Aviso amigável quando o saldo restante da carga for inferior à tonelagem informada */}
              {financialSummary.availableVolume < shipmentTonnage && (
                <div className="mt-2.5 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold">
                      Saldo restante na carga: {financialSummary.availableVolume.toLocaleString('pt-BR')} ton
                    </p>
                    <p className="text-[10.5px] text-amber-800 dark:text-amber-300 leading-tight">
                      {selectedCargo.status !== CargoStatus.EmAndamento
                        ? `A carga selecionada está "${selectedCargo.status}". Ao confirmar o reembarque, o lote será reativado para "Em andamento" e o saldo total será expandido em +${(shipmentTonnage - Math.max(0, financialSummary.availableVolume)).toLocaleString('pt-BR')} ton para cobrir este novo ciclo.`
                        : `Para comportar este novo ciclo de carregamento (${shipmentTonnage.toLocaleString('pt-BR')} ton), o volume total do lote será expandido automaticamente em +${(shipmentTonnage - Math.max(0, financialSummary.availableVolume)).toLocaleString('pt-BR')} ton.`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Observações da Programação (Opcional) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Observações / Instruções do Reembarque (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: Carregar logo após descarregar na fazenda..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-hidden transition-all"
            />
          </div>

          {/* Rodapé e Botões de Ação */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !selectedCargo || shipmentTonnage <= 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCw className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
              <span>
                {isSubmitting ? 'Programando...' : 'Confirmar e Programar Reembarque'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

