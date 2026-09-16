import React, { useState, useMemo } from 'react';
import Header from '../components/Header';
import type { Shipment, User, Cargo, Client, Branch, Driver, Vehicle, Product } from '../types';
import { UserProfile, ShipmentStatus } from '../types';
import { BriefcaseIcon } from '../components/icons/BriefcaseIcon';
import { ShipIcon } from '../components/icons/ShipIcon';
import { UsersIcon } from '../components/icons/UsersIcon';
import { ClockIcon } from '../components/icons/ClockIcon';
import { Filter, X, Calendar, DollarSign, Package, CheckCircle, Building2, TrendingUp, Receipt, Layers } from 'lucide-react';
import SalespersonReport from '../components/reports/SalespersonReport';
import SupervisorReport from '../components/reports/SupervisorReport';
import ShipperReport from '../components/reports/ShipperReport';
import ClientReport from '../components/reports/ClientReport';
import OperationalTimingReport from '../components/reports/OperationalTimingReport';
import ExternalSalespersonReport from '../components/reports/ExternalSalespersonReport';
import BranchReport from '../components/reports/BranchReport';
import StayFinancialReport from '../components/reports/StayFinancialReport';
import DemandForecastReport from '../components/reports/DemandForecastReport';
import RealProfitReport from '../components/reports/RealProfitReport';
import OthersReport from '../components/reports/OthersReport';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import { getAllToolStays, getToolStays, StayRecord } from '../utils/toolStorage';
import { getShipmentCte, getShipmentEffectiveDate, getStayEffectiveDate, isCteApplicableForStatus, isStayForShipment, parseDateToYmd } from '../utils';
import { calculateShipmentExpenses } from '../utils/operationalExpensesCalculator';

interface ReportsPageProps {
  shipments: Shipment[];
  embarcadores: User[];
  cargos: Cargo[];
  users: User[];
  currentUser: User | null;
  clients: Client[];
  branches: Branch[];
  stays?: StayRecord[];
  drivers?: Driver[];
  vehicles?: Vehicle[];
  products?: Product[];
  companyLogo?: string | null;
  onSaveUser?: (userData: User | Omit<User, 'id'>) => void;
  onUpdateAttachment?: (shipmentId: string, data: any) => Promise<void>;
  onBatchUpdateShipments?: (updatedShipments: Shipment[]) => Promise<void> | void;
  onUpdateShipmentData?: (shipmentId: string, data: Partial<Shipment>) => Promise<void>;
}

type ActiveReport = 'comercial' | 'embarcadores' | 'clientes' | 'vendedores' | 'tempo-operacao' | 'filiais' | 'estadias' | 'previsao-demandas' | 'lucro-real' | 'outros';

const ReportsPage: React.FC<ReportsPageProps> = ({ shipments, embarcadores, cargos, users, currentUser, clients, branches, stays = [], drivers = [], vehicles = [], products = [], companyLogo, onSaveUser, onUpdateAttachment, onBatchUpdateShipments, onUpdateShipmentData }) => {
  const [activeReport, setActiveReport] = useState<ActiveReport>('comercial');
  const [loadingStays, setLoadingStays] = useState(false);
  
  // Date range defaults to current month
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  });
  
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterClient, setFilterClient] = useState<string[]>([]);
  const [filterClientCnpj, setFilterClientCnpj] = useState<string[]>([]);
  const [filterExport, setFilterExport] = useState<string[]>([]);
  const [filterDriverRegime, setFilterDriverRegime] = useState<string[]>([]);
  const [filterOrigin, setFilterOrigin] = useState<string[]>([]);
  const [filterDest, setFilterDest] = useState<string[]>([]);
  const [filterBranch, setFilterBranch] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const cargoMap = useMemo(() => new Map(cargos.map(c => [c.id, c])), [cargos]);
  const shipmentMap = useMemo(() => new Map(shipments.map(s => [s.id, s])), [shipments]);
  
  const statusOptions = Object.values(ShipmentStatus);
  const exportOptions = ['Exportação', 'Mercado Interno'];
  const driverRegimeOptions = ['PF', 'PJ Simples', 'PJ Real/Presumido'];
  const clientOptions = Array.from(new Set(cargos.map(c => clients.find(cl => cl.id === c.clientId)?.nomeFantasia || 'N/A'))).filter(Boolean).sort();
  
  const cnpjOptions = useMemo(() => {
    const options = new Set<string>();
    cargos.forEach(c => {
      const cl = clients.find(item => item.id === c.clientId);
      if (!cl) return;
      const cnpj = c.clientCnpj || cl.cnpj;
      if (!cnpj) return;
      const cleanCnpj = cnpj.replace(/\D/g, '');
      const cleanMain = cl.cnpj.replace(/\D/g, '');
      let label = `${cl.nomeFantasia || cl.razaoSocial} - Matriz (${cl.cnpj})`;
      if (cleanCnpj !== cleanMain && cl.secondaryCnpjs) {
        const branch = cl.secondaryCnpjs.find(b => b.cnpj.replace(/\D/g, '') === cleanCnpj || b.id === c.clientBranchId);
        if (branch) {
          label = `${cl.nomeFantasia || cl.razaoSocial} - ${branch.nomeFantasia || branch.city || 'Filial'} (${branch.cnpj})`;
        }
      }
      options.add(label);
    });
    return Array.from(options).sort();
  }, [cargos, clients]);

  const originOptions = Array.from(new Set(cargos.map(c => c.origin))).filter(Boolean).sort();
  const destOptions = Array.from(new Set(cargos.map(c => c.destination))).filter(Boolean).sort();
  const branchOptions = branches.map(b => b.name).sort();

  const getShipmentDriverRegime = (s: Shipment): 'PF' | 'PJ Simples' | 'PJ Real/Presumido' => {
    const isPf = s.driverFreightType === 'PF' || s.anttModality === 'TAC';
    if (isPf) return 'PF';
    const isSimples = Boolean(
      s.etcTaxRegime === 'Simples Nacional' ||
      s.etcTaxRegime === 'MEI' ||
      (s as any)?.isSimplesNacional ||
      (s.documents as any)?.etc_tax_regime === 'Simples Nacional' ||
      (s.documents as any)?.etc_tax_regime === 'MEI' ||
      (s.documents as any)?.crt === '1' ||
      (s.documents as any)?.crt === '2'
    );
    if (isSimples) return 'PJ Simples';
    return 'PJ Real/Presumido';
  };

  const getShipmentIsExport = (s: Shipment, cargo?: Cargo): boolean => {
    return Boolean(
      cargo?.isExport ||
      (s as any)?.isExport ||
      (cargo?.observations && /export/i.test(cargo.observations)) ||
      (cargo?.destination && /(porto|terminal|embarque portu[aá]rio|santos|paranagu[aá]|itaqui|rio grande|barcarena|suape|vit[oó]ria)/i.test(cargo.destination)) ||
      ((s as any)?.observations && /export/i.test((s as any).observations)) ||
      ((s as any)?.destination && /(porto|terminal|embarque portu[aá]rio|santos|paranagu[aá]|itaqui|rio grande|barcarena|suape|vit[oó]ria)/i.test((s as any).destination))
    );
  };

  const getEffectiveDate = (s: Shipment) => {
    return getShipmentEffectiveDate(s) || s.scheduledDate;
  };

  const userBranchMap = useMemo(() => new Map(users.map(u => [u.id, u.branchId])), [users]);

  const filteredShipments = useMemo(() => {
    return shipments.filter(s => {
       // Filter by effective date (the moment CT-e was emitted or it was loaded/became effective)
       const effDate = getEffectiveDate(s);
       if (!effDate) return false; // Not effective yet

       if (effDate < startDate || effDate > endDate) return false;

       if (filterStatus.length > 0 && !filterStatus.includes(s.status)) return false;

       const cargo = cargoMap.get(s.cargoId);

       if (filterExport.length > 0) {
         const isExp = getShipmentIsExport(s, cargo);
         const expLabel = isExp ? 'Exportação' : 'Mercado Interno';
         if (!filterExport.includes(expLabel)) return false;
       }

       if (filterDriverRegime.length > 0) {
         const regimeLabel = getShipmentDriverRegime(s);
         if (!filterDriverRegime.includes(regimeLabel)) return false;
       }

       if (filterClient.length > 0) {
           if (!cargo) return false;
           const clientName = clients.find(cl => cl.id === cargo.clientId)?.nomeFantasia || 'N/A';
           if (!filterClient.includes(clientName)) return false;
       }

       if (filterClientCnpj.length > 0) {
         if (!cargo) return false;
         const cl = clients.find(item => item.id === cargo.clientId);
         const cnpj = cargo.clientCnpj || cl?.cnpj;
         const cleanCnpj = cnpj?.replace(/\D/g, '') || '';
         const cleanMain = cl?.cnpj?.replace(/\D/g, '') || '';
         let label = `${cl?.nomeFantasia || cl?.razaoSocial} - Matriz (${cl?.cnpj})`;
         if (cleanCnpj !== cleanMain && cl?.secondaryCnpjs) {
           const branch = cl.secondaryCnpjs.find(b => b.cnpj.replace(/\D/g, '') === cleanCnpj || b.id === cargo.clientBranchId);
           if (branch) {
             label = `${cl.nomeFantasia || cl.razaoSocial} - ${branch.nomeFantasia || branch.city || 'Filial'} (${branch.cnpj})`;
           }
         }
         if (!filterClientCnpj.includes(label)) return false;
       }

       if (filterOrigin.length > 0) {
         if (!cargo || !filterOrigin.includes(cargo.origin)) return false;
       }
       if (filterDest.length > 0) {
         if (!cargo || !filterDest.includes(cargo.destination)) return false;
       }

       if (filterBranch.length > 0) {
         const effectiveBranchId = s.branchId || 
                                   userBranchMap.get(s.embarcadorId) || 
                                   userBranchMap.get(s.createdById) || 
                                   cargo?.branchId || 
                                   (cargo ? userBranchMap.get(cargo.createdById) : undefined);
         const branchName = branches.find(b => b.id === effectiveBranchId)?.name || 'Matriz';
         if (!filterBranch.includes(branchName)) return false;
       }

       return true;
    });
  }, [shipments, startDate, endDate, filterStatus, filterExport, filterDriverRegime, filterClient, filterClientCnpj, filterOrigin, filterDest, filterBranch, cargoMap, clients, branches, userBranchMap]);

  const filteredStays = useMemo(() => {
    return stays.filter(s => {
      const stayDate = getStayEffectiveDate(s, shipments);
      if (!stayDate) return false;
      return stayDate >= startDate && stayDate <= endDate;
    });
  }, [stays, shipments, startDate, endDate]);

  const filteredStats = useMemo(() => {
    let totalProgramado = 0;
    let totalEfetivado = 0;

    const programmedStatuses = [
      ShipmentStatus.AguardandoSeguradora,
      ShipmentStatus.PreCadastro,
      ShipmentStatus.AguardandoCarregamento
    ];

    shipments.forEach(s => {
      // Total Programado: Based on requested statuses and date range
      const isProgrammedStatus = programmedStatuses.includes(s.status);
      if (isProgrammedStatus && s.scheduledDate >= startDate && s.scheduledDate <= endDate) {
        totalProgramado += s.shipmentTonnage || 0;
      }

      // Total Efetivado: Based STRICTLY on having CT-e WITHIN FILTER RANGE
      const cteVal = getShipmentCte(s);
      const hasCte = isCteApplicableForStatus(s.status) && cteVal !== '-' && cteVal.trim() !== '';
      if (hasCte && s.status !== ShipmentStatus.Cancelado) {
        const effDateStr = getShipmentEffectiveDate(s);
        if (effDateStr && effDateStr >= startDate && effDateStr <= endDate) {
          totalEfetivado += s.loadedTonnage || s.shipmentTonnage || 0;
        }
      }
    });

    return { totalProgramado, totalEfetivado };
  }, [shipments, startDate, endDate]);

  const kpis = useMemo(() => {
    let grossBilled = 0;
    let effectiveGrossBilled = 0;
    let profitMargin = 0; 
    let totalProfitMargin = 0; 

    const profitMarginStatuses = [
        ShipmentStatus.AguardandoSeguradora,
        ShipmentStatus.PreCadastro,
        ShipmentStatus.AguardandoCarregamento,
        ShipmentStatus.AguardandoNota,
        ShipmentStatus.AguardandoFiscal,
        ShipmentStatus.AguardandoAdiantamento,
        ShipmentStatus.AguardandoAgendamento,
        ShipmentStatus.AguardandoDescarga,
        ShipmentStatus.AguardandoPagamentoSaldo,
        ShipmentStatus.Finalizado
    ];

    const totalProfitMarginStatuses = [
        ShipmentStatus.AguardandoNota,
        ShipmentStatus.AguardandoFiscal,
        ShipmentStatus.AguardandoAdiantamento,
        ShipmentStatus.AguardandoAgendamento,
        ShipmentStatus.AguardandoDescarga,
        ShipmentStatus.AguardandoPagamentoSaldo,
        ShipmentStatus.Finalizado
    ];

    filteredShipments.forEach(s => {
       const cargo = cargoMap.get(s.cargoId);
       const cteVal = getShipmentCte(s);
       const hasCte = isCteApplicableForStatus(s.status) && cteVal !== '-' && cteVal.trim() !== '' && s.status !== ShipmentStatus.Cancelado;

       if (profitMarginStatuses.includes(s.status)) {
           const expenses = calculateShipmentExpenses(s, cargo);
           
           const shipmentStays = stays.filter(stay => isStayForShipment(stay, s));
           const demurrageRevenue = shipmentStays.reduce((sum, stay) => sum + (stay.approvedValue || 0), 0);
           const demurrageProfit = shipmentStays.reduce((sum, stay) => sum + ((stay.approvedValue || 0) - (stay.driverPaidValue || 0)), 0);
               
           const profit = expenses.netProfit + demurrageProfit;
           const revenue = expenses.companyFreight + demurrageRevenue;
           
           // Faturamento Bruto: soma apenas os embarques que possuem CT-e emitido
           if (hasCte) {
             grossBilled += revenue;
           }
           
           profitMargin += profit;

           if (totalProfitMarginStatuses.includes(s.status) || hasCte) {
               totalProfitMargin += profit;
               effectiveGrossBilled += revenue;
           }
       }
    });

    const percentageMargin = grossBilled > 0 ? (profitMargin / grossBilled) * 100 : 0;
    const effectivePercentageMargin = effectiveGrossBilled > 0 ? (totalProfitMargin / effectiveGrossBilled) * 100 : 0;

    return { 
        grossBilled, 
        profitMargin, 
        totalProfitMargin, 
        percentageMargin,
        effectivePercentageMargin,
        count: filteredShipments.length 
    };
  }, [filteredShipments, cargoMap, stays]);

  const canViewCommercialReport = useMemo(() => {
    if (!currentUser) return false;
    return [
      UserProfile.Comercial, 
      UserProfile.GerenteComercial, 
      UserProfile.Admin, 
      UserProfile.Supervisor, 
      UserProfile.Diretor, 
      UserProfile.Agenciador
    ].includes(currentUser.profile);
  }, [currentUser]);

  const renderReport = () => {
    switch(activeReport) {
      case 'comercial':
        return <SupervisorReport shipments={filteredShipments} cargos={cargos} users={users} branches={branches} stays={stays} onSaveUser={onSaveUser as any} currentUser={currentUser} />;
      case 'embarcadores':
        return <ShipperReport shipments={filteredShipments} cargos={cargos} clients={clients} users={users} currentUser={currentUser} companyLogo={companyLogo} />;
      case 'clientes':
        return <ClientReport shipments={filteredShipments} cargos={cargos} clients={clients} stays={stays} companyLogo={companyLogo} currentUser={currentUser} />;
      case 'vendedores':
        return <ExternalSalespersonReport shipments={filteredShipments} cargos={cargos} clients={clients} />;
      case 'tempo-operacao':
        return <OperationalTimingReport shipments={filteredShipments} />;
      case 'filiais':
        return <BranchReport shipments={filteredShipments} cargos={cargos} branches={branches} users={users} stays={stays} />;
      case 'estadias':
        if (loadingStays) {
          return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              <p className="text-gray-500 font-medium animate-pulse">Carregando dados financeiros das estadias...</p>
            </div>
          );
        }
        return <StayFinancialReport stays={filteredStays} shipments={shipments} />;
      case 'previsao-demandas':
        return <DemandForecastReport cargos={cargos} clients={clients} shipments={shipments} companyLogo={companyLogo} />;
      case 'lucro-real':
        if (isCliente) return null;
        return (
          <RealProfitReport
            shipments={shipments}
            cargos={cargos}
            clients={clients}
            users={users}
            currentUser={currentUser}
            drivers={drivers}
            vehicles={vehicles}
            branches={branches}
            stays={stays}
            companyLogo={companyLogo}
            startDate={startDate}
            endDate={endDate}
            onUpdateAttachment={onUpdateAttachment}
            onBatchUpdateShipments={onBatchUpdateShipments}
            onUpdateShipmentData={onUpdateShipmentData}
          />
        );
      case 'outros':
        return (
          <OthersReport
            shipments={shipments}
            cargos={cargos}
            clients={clients}
            users={users}
            currentUser={currentUser}
            branches={branches}
            stays={stays}
            companyLogo={companyLogo}
            startDate={startDate}
            endDate={endDate}
          />
        );
      default:
        return null;
    }
  };
  
  const isEmbarcador = currentUser?.profile === UserProfile.Embarcador;
  const isCliente = currentUser?.profile === UserProfile.Cliente;

  const navItems = [
      ...(canViewCommercialReport ? [{ id: 'comercial', label: 'Relatório Comercial', icon: BriefcaseIcon }] : []),
      ...(!isCliente ? [
        { id: 'lucro-real', label: 'Lucro Real da Operação', icon: Receipt },
        { id: 'embarcadores', label: 'Embarcadores', icon: ShipIcon }
      ] : []),
      ...(!isEmbarcador ? [
        { id: 'clientes', label: isCliente ? 'Histórico & Desempenho por CNPJ' : 'Clientes', icon: UsersIcon },
        ...(!isCliente ? [{ id: 'vendedores', label: 'Vendedores', icon: UsersIcon }] : []),
      ] : []),
      { id: 'tempo-operacao', label: 'Tempo de Operação', icon: ClockIcon },
      ...(!isCliente ? [
        { id: 'filiais', label: 'Filiais', icon: Building2 },
        { id: 'estadias', label: 'Financeiro Estadias', icon: DollarSign },
        { id: 'previsao-demandas', label: 'Previsão de Demandas', icon: TrendingUp },
        { id: 'outros', label: 'Outros', icon: Layers },
      ] : []),
  ];

  /* Ensure initial tab is permissible */
  useState(() => {
    if (isCliente) {
      setActiveReport('clientes');
    } else if (!canViewCommercialReport && activeReport === 'comercial') {
      setActiveReport('embarcadores');
    }
  });

  const activeFiltersCount = (filterStatus.length > 0 ? 1 : 0) + 
    (filterExport.length > 0 ? 1 : 0) + 
    (filterDriverRegime.length > 0 ? 1 : 0) + 
    (filterClient.length > 0 ? 1 : 0) + 
    (filterClientCnpj.length > 0 ? 1 : 0) + 
    (filterOrigin.length > 0 ? 1 : 0) + 
    (filterDest.length > 0 ? 1 : 0) + 
    (filterBranch.length > 0 ? 1 : 0);

  const clearFilters = () => {
      setFilterStatus([]);
      setFilterExport([]);
      setFilterDriverRegime([]);
      setFilterClient([]);
      setFilterClientCnpj([]);
      setFilterOrigin([]);
      setFilterDest([]);
      setFilterBranch([]);
  };

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <>
      <Header title="Relatórios" />
      {/* TOP REPORT NAVIGATION TABS (Substituindo o campo do topo pela navegação) */}
      <div className="bg-white dark:bg-gray-800/90 rounded-2xl mb-6 border border-gray-200/80 dark:border-gray-700/80 shadow-sm p-3 space-y-3 relative z-20">
        {/* Abas Horizontais dos Relatórios */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveReport(item.id as ActiveReport)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer ${
                activeReport === item.id
                  ? 'bg-gradient-to-r from-primary to-primary-dark text-white shadow-md shadow-primary/20 scale-[1.02]'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/70 hover:text-gray-900 dark:hover:text-white border border-transparent'
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Barra de Filtros para os Relatórios que utilizam filtros globais */}
        {activeReport !== 'lucro-real' && activeReport !== 'outros' && (
          <div className="pt-2.5 border-t border-gray-100 dark:border-gray-700/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-900/80 px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-inner text-xs">
                <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400 ml-1" />
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-1 bg-transparent border-none text-xs focus:ring-0 outline-none font-semibold text-gray-800 dark:text-gray-100" title="Data Inicial" />
                <span className="text-gray-400 dark:text-gray-500 font-medium">até</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-1 bg-transparent border-none text-xs focus:ring-0 outline-none font-semibold text-gray-800 dark:text-gray-100" title="Data Final" />
              </div>
              <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all duration-200 shadow-xs text-xs font-bold cursor-pointer ${showFilters || activeFiltersCount > 0 ? 'bg-primary text-white shadow-md' : 'bg-gray-50 dark:bg-gray-700/60 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:bg-gray-100'}`}
              >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filtros Avançados {activeFiltersCount > 0 && <span className="ml-1 bg-white/20 px-1.5 py-0.2 rounded-full text-[10px]">{activeFiltersCount}</span>}</span>
              </button>
            </div>
          </div>
        )}

        {showFilters && activeReport !== 'lucro-real' && activeReport !== 'outros' && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700/80 bg-gray-50/50 dark:bg-gray-900/40 rounded-xl animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
                    <MultiSelectDropdown label="Status do Embarque" options={statusOptions} selectedValues={filterStatus} onChange={setFilterStatus} placeholder="Todos..." />
                    <MultiSelectDropdown label="Destinação Carga" options={exportOptions} selectedValues={filterExport} onChange={setFilterExport} placeholder="Todas..." />
                    <MultiSelectDropdown label="Regime Tributário" options={driverRegimeOptions} selectedValues={filterDriverRegime} onChange={setFilterDriverRegime} placeholder="Todos..." />
                    {!isCliente && (
                      <MultiSelectDropdown label="Cliente (Empresa)" options={clientOptions} selectedValues={filterClient} onChange={setFilterClient} placeholder="Todos..." />
                    )}
                    <MultiSelectDropdown label="CNPJ / Filial" options={cnpjOptions} selectedValues={filterClientCnpj} onChange={setFilterClientCnpj} placeholder="Todos os CNPJs..." />
                    <MultiSelectDropdown label="Origem" options={originOptions} selectedValues={filterOrigin} onChange={setFilterOrigin} placeholder="Todas..." />
                    <MultiSelectDropdown label="Destino" options={destOptions} selectedValues={filterDest} onChange={setFilterDest} placeholder="Todos..." />
                    {!isCliente && (
                      <MultiSelectDropdown label="Filial Agromercantil" options={branchOptions} selectedValues={filterBranch} onChange={setFilterBranch} placeholder="Todas..." />
                    )}
                </div>
                {activeFiltersCount > 0 && (
                    <div className="mt-3 flex justify-end">
                        <button onClick={clearFilters} className="text-xs flex items-center gap-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg transition-colors font-semibold cursor-pointer">
                            <X className="w-3.5 h-3.5" /> Limpar Filtros
                        </button>
                    </div>
                )}
            </div>
        )}
      </div>

      {/* GLOBAL KPIs SECTION (para relatórios gerais) */}
      {activeReport !== 'lucro-real' && activeReport !== 'outros' && (
        isCliente ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
             <div className="p-3.5 bg-white dark:bg-gray-800/90 rounded-xl border border-gray-200/80 dark:border-gray-700/80 flex items-center gap-3 hover:scale-[1.02] transition-transform duration-300 shadow-sm">
                 <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 flex flex-shrink-0 items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50"><ShipIcon className="w-5 h-5" /></div>
                 <div className="min-w-0 flex-1">
                    <p className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider truncate mb-0.5">Embarques Totais</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white tracking-tight truncate">{kpis.count}</p>
                 </div>
             </div>
             <div className="p-3.5 bg-white dark:bg-gray-800/90 rounded-xl border border-gray-200/80 dark:border-gray-700/80 flex items-center gap-3 hover:scale-[1.02] transition-transform duration-300 shadow-sm">
                 <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700/60 flex flex-shrink-0 items-center justify-center text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600/50"><Package className="w-5 h-5" /></div>
                 <div className="min-w-0 flex-1">
                    <p className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider truncate mb-0.5" title="Total Programado">Total Programado</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white tracking-tight truncate" title={`${filteredStats.totalProgramado.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ton`}>
                       {filteredStats.totalProgramado.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} <span className="text-[10px] font-medium text-gray-400">ton</span>
                    </p>
                 </div>
             </div>
             <div className="p-3.5 bg-white dark:bg-gray-800/90 rounded-xl border border-gray-200/80 dark:border-gray-700/80 flex items-center gap-3 hover:scale-[1.02] transition-transform duration-300 shadow-sm">
                 <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex flex-shrink-0 items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50"><CheckCircle className="w-5 h-5" /></div>
                 <div className="min-w-0 flex-1">
                    <p className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider truncate mb-0.5" title="Total Efetivado">Total Efetivado</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white tracking-tight truncate" title={`${filteredStats.totalEfetivado.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ton`}>
                       {filteredStats.totalEfetivado.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} <span className="text-[10px] font-medium text-gray-400">ton</span>
                    </p>
                 </div>
             </div>
             <div className="p-3.5 bg-white dark:bg-gray-800/90 rounded-xl border border-gray-200/80 dark:border-gray-700/80 flex items-center gap-3 hover:scale-[1.02] transition-transform duration-300 shadow-sm">
                 <div className="w-9 h-9 rounded-lg bg-green-50 dark:bg-green-950/60 flex flex-shrink-0 items-center justify-center text-green-600 dark:text-green-400 border border-green-100 dark:border-green-800/50"><DollarSign className="w-5 h-5" /></div>
                 <div className="min-w-0 flex-1">
                    <p className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider truncate mb-0.5" title="Total em Frete">Total em Frete</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white tracking-tight truncate" title={formatCurrency(kpis.grossBilled)}>
                       R$ {(kpis.grossBilled / 1000).toFixed(1)}k
                    </p>
                 </div>
             </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
             <div className="p-3.5 bg-white dark:bg-gray-800/90 rounded-xl border border-gray-200/80 dark:border-gray-700/80 flex items-center gap-3 hover:scale-[1.02] transition-transform duration-300 shadow-sm">
                 <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 flex flex-shrink-0 items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50"><ShipIcon className="w-5 h-5" /></div>
                 <div className="min-w-0 flex-1">
                    <p className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider truncate mb-0.5">Embarques</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white tracking-tight truncate">{kpis.count}</p>
                 </div>
             </div>
             <div className="p-3.5 bg-white dark:bg-gray-800/90 rounded-xl border border-gray-200/80 dark:border-gray-700/80 flex items-center gap-3 hover:scale-[1.02] transition-transform duration-300 shadow-sm">
                 <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700/60 flex flex-shrink-0 items-center justify-center text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600/50"><Package className="w-5 h-5" /></div>
                 <div className="min-w-0 flex-1">
                    <p className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider truncate mb-0.5" title="Total Programado">Total Prog.</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white tracking-tight truncate" title={`${filteredStats.totalProgramado.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ton`}>
                       {filteredStats.totalProgramado.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} <span className="text-[10px] font-medium text-gray-400">ton</span>
                    </p>
                 </div>
             </div>
             <div className="p-3.5 bg-white dark:bg-gray-800/90 rounded-xl border border-gray-200/80 dark:border-gray-700/80 flex items-center gap-3 hover:scale-[1.02] transition-transform duration-300 shadow-sm">
                 <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex flex-shrink-0 items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50"><CheckCircle className="w-5 h-5" /></div>
                 <div className="min-w-0 flex-1">
                    <p className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider truncate mb-0.5" title="Total Efetivado">Total Efetiv.</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white tracking-tight truncate" title={`${filteredStats.totalEfetivado.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ton`}>
                       {filteredStats.totalEfetivado.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} <span className="text-[10px] font-medium text-gray-400">ton</span>
                    </p>
                 </div>
             </div>
             <div className="p-3.5 bg-white dark:bg-gray-800/90 rounded-xl border border-gray-200/80 dark:border-gray-700/80 flex items-center gap-3 hover:scale-[1.02] transition-transform duration-300 shadow-sm">
                 <div className="w-9 h-9 rounded-lg bg-green-50 dark:bg-green-950/60 flex flex-shrink-0 items-center justify-center text-green-600 dark:text-green-400 border border-green-100 dark:border-green-800/50"><DollarSign className="w-5 h-5" /></div>
                 <div className="min-w-0 flex-1">
                    <p className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider truncate mb-0.5" title="Faturamento Bruto">Fat. Bruto</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white tracking-tight truncate" title={formatCurrency(kpis.grossBilled)}>
                       R$ {(kpis.grossBilled / 1000).toFixed(1)}k
                    </p>
                 </div>
             </div>

             <div className="p-3.5 bg-white dark:bg-gray-800/90 rounded-xl border border-gray-200/80 dark:border-gray-700/80 flex items-center gap-3 hover:scale-[1.02] transition-transform duration-300 shadow-sm">
                 <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-950/60 flex flex-shrink-0 items-center justify-center text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-800/50"><DollarSign className="w-5 h-5" /></div>
                 <div className="min-w-0 flex-1">
                    <p className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider truncate mb-0.5" title="Lucro Estimado">Lucro Est.</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white tracking-tight truncate" title={formatCurrency(kpis.profitMargin)}>
                       R$ {(kpis.profitMargin / 1000).toFixed(1)}k
                    </p>
                 </div>
             </div>

             <div className="p-3.5 bg-white dark:bg-gray-800/90 rounded-xl border border-gray-200/80 dark:border-gray-700/80 flex items-center gap-3 hover:scale-[1.02] transition-transform duration-300 shadow-sm">
                 <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex flex-shrink-0 items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50"><DollarSign className="w-5 h-5" /></div>
                 <div className="min-w-0 flex-1">
                    <p className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider truncate mb-0.5" title="Lucro Efetivado">Lucro Efe.</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white tracking-tight truncate" title={formatCurrency(kpis.totalProfitMargin)}>
                       R$ {(kpis.totalProfitMargin / 1000).toFixed(1)}k
                    </p>
                 </div>
             </div>

             <div className="p-3.5 bg-white dark:bg-gray-800/90 rounded-xl border border-gray-200/80 dark:border-gray-700/80 flex items-center gap-3 hover:scale-[1.02] transition-transform duration-300 shadow-sm">
                 <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-950/60 flex flex-shrink-0 items-center justify-center text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-800/50"><TrendingUp className="w-5 h-5" /></div>
                 <div className="min-w-0 flex-1">
                    <p className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider truncate mb-0.5" title="Margem de Lucro Total">Margem</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white tracking-tight truncate" title={`${kpis.percentageMargin.toFixed(2)}% (Efetivado: ${kpis.effectivePercentageMargin.toFixed(2)}%)`}>
                       {kpis.percentageMargin.toFixed(1)}%
                    </p>
                 </div>
             </div>
          </div>
        )
      )}

      {/* MAIN CONTENT FULL WIDTH */}
      <main className="w-full pb-16">
        {renderReport()}
      </main>
    </>
  );
};

export default ReportsPage;