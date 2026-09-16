
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { can } from '../auth';
import NotificationBell from './NotificationBell';
import { DashboardIcon } from './icons/DashboardIcon';
import { ClientsIcon } from './icons/ClientsIcon';
import { TruckIcon } from './icons/TruckIcon';
import { DriverIcon } from './icons/DriverIcon';
import { PackageIcon } from './icons/PackageIcon';
import { DollarSignIcon } from './icons/DollarSignIcon';
import { ChartIcon } from './icons/ChartIcon';
import { UsersIcon } from './icons/UsersIcon';
import { FolderIcon } from './icons/FolderIcon';
import { UserPlusIcon } from './icons/UserPlusIcon';
import { LogOutIcon } from './icons/LogOutIcon';
import { MapIcon } from './icons/MapIcon';
import { ImageIcon } from './icons/ImageIcon';
import { HistoryIcon } from './icons/HistoryIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { ArchiveIcon } from './icons/ArchiveIcon';
import { ToolIcon } from './icons/ToolIcon';
import { CalculatorIcon } from './icons/CalculatorIcon';
import { InfoIcon } from './icons/InfoIcon';
import { Menu as MenuIcon, X as XIcon, Activity, ShieldCheck, Sun, Moon, Sparkles } from 'lucide-react';
import DriverLocationTracker from './DriverLocationTracker';

import type { User, Page, ProfilePermissions, Ticket, Shipment, FreightOffer, Cargo, Driver, Client, Product, Vehicle } from '../types';
import { UserProfile, TicketStatus } from '../types';

interface TopNavBarProps {
  user: User;
  onLogout: () => void;
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  profilePermissions: ProfilePermissions;
  companyLogo: string | null;
  onOpenTickets: () => void;
  tickets: Ticket[];
  shipments?: Shipment[];
  freightOffers?: FreightOffer[];
  cargos?: Cargo[];
  drivers?: Driver[];
  clients?: Client[];
  products?: Product[];
  vehicles?: Vehicle[];
  users?: User[];
  themeMode?: 'dark' | 'light';
  onThemeModeChange?: (mode: 'dark' | 'light') => void;
  onAcceptOrderRequest?: (offer: FreightOffer) => void | Promise<void>;
  onRefuseOrderRequest?: (offer: FreightOffer, reason?: string) => void | Promise<void>;
  onSaveFreightOffer?: (offer: FreightOffer | Omit<FreightOffer, 'id' | 'createdAt'>) => Promise<void> | void;
  onOpenUpdates?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
  {
    id: 'operational',
    label: 'Operacional',
    icon: TruckIcon,
    children: [
      { id: 'shipments', label: 'Embarques', icon: PackageIcon },
      { id: 'shipment-history', label: 'Histórico Embarques', icon: HistoryIcon },
      { id: 'load-history', label: 'Histórico Cargas', icon: ArchiveIcon },
      { id: 'operational-loads', label: 'Cargas em Andamento', icon: ChartIcon },
      { id: 'operational-map', label: 'Mapa Operacional', icon: MapIcon },
      { id: 'risk-management', label: 'Gerenciadora de Risco', icon: ShieldCheck },
    ],
  },
  {
    id: 'cadastro',
    label: 'Cadastro',
    icon: FolderIcon,
    children: [
        { id: 'clients', label: 'Clientes', icon: ClientsIcon },
        { id: 'owners', label: 'Proprietários', icon: UsersIcon },
        { id: 'drivers', label: 'Motoristas', icon: DriverIcon },
        { id: 'vehicles', label: 'Veículos', icon: TruckIcon },
        { id: 'loads', label: 'Cargas', icon: PackageIcon },
        { id: 'products', label: 'Produtos', icon: PackageIcon },
        { id: 'risk-query-types', label: 'Tipos de Consulta GR', icon: ShieldCheck },
    ]
  },
  { id: 'reports', label: 'Relatórios', icon: ChartIcon },
  {
    id: 'ferramentas',
    label: 'Ferramentas',
    icon: ToolIcon,
    children: [
      { id: 'layover-calculator', label: 'Cálculo de Estadias', icon: CalculatorIcon },
      { id: 'freight-quote', label: 'Cotação de Frete', icon: MapIcon },
      { id: 'tools-history', label: 'Histórico', icon: HistoryIcon },
      { id: 'freight-offers-history', label: 'Histórico de Ofertas', icon: HistoryIcon },
    ]
  },
  {
    id: 'settings',
    label: 'Configurações',
    icon: UsersIcon,
    children: [
      { id: 'users-register', label: 'Gerenciar Usuários', icon: UserPlusIcon },
      { id: 'branches', label: 'Filiais', icon: FolderIcon },
      { id: 'appearance', label: 'Aparência', icon: ImageIcon },
      { id: 'system-monitor', label: 'Monitoramento', icon: Activity },
    ]
  }
];

const TopNavBar: React.FC<TopNavBarProps> = ({ 
  user, 
  onLogout, 
  currentPage, 
  setCurrentPage, 
  profilePermissions, 
  companyLogo, 
  onOpenTickets, 
  tickets, 
  shipments, 
  freightOffers, 
  cargos, 
  drivers,
  clients,
  products,
  vehicles,
  users,
  themeMode = 'dark',
  onThemeModeChange,
  onAcceptOrderRequest,
  onRefuseOrderRequest,
  onSaveFreightOffer,
  onOpenUpdates
}) => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const myOpenTicketsCount = useMemo(() => {
    return tickets.filter(
      t => t.assignedToId === user.id &&
           t.status !== TicketStatus.Resolvido &&
           t.status !== TicketStatus.Fechado
    ).length;
  }, [tickets, user]);

  const filteredNavItems = React.useMemo(() => {
    const filterItems = (items: NavItem[]): NavItem[] => {
      return items.reduce((acc: NavItem[], item) => {
        if (user.profile === UserProfile.Motorista) {
          if (item.id === 'operational') {
            const allowedChildren = item.children?.filter(c => c.id === 'operational-loads' || c.id === 'shipment-history') || [];
            if (allowedChildren.length > 0) {
              acc.push({ ...item, children: allowedChildren });
            }
          }
          return acc;
        }

        if (user.profile === UserProfile.Cliente && item.id === 'cadastro') {
          return acc;
        }
        
        if (item.children) {
          const visibleChildren = filterItems(item.children);
          if (visibleChildren.length > 0) {
            acc.push({ ...item, children: visibleChildren });
          }
        } 
        else {
          if (can('read', user, item.id as Page, profilePermissions)) {
            acc.push(item);
          }
        }
        return acc;
      }, []);
    };
    return filterItems(navItems);
  }, [user, profilePermissions]);

  const handleDropdownToggle = (id: string) => {
    setOpenDropdown(openDropdown === id ? null : id);
  };
  
  const handlePageSelect = (page: Page) => {
      setCurrentPage(page);
      setOpenDropdown(null);
      setIsMobileMenuOpen(false);
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (!mobileMenuRef.current || !mobileMenuRef.current.contains(event.target as Node)) {
          setOpenDropdown(null);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isParentOfCurrentPage = (item: NavItem): boolean => {
      if (!item.children) return false;
      return item.children.some(child => {
        if (child.id === currentPage) return true;
        if (child.children) return isParentOfCurrentPage(child);
        return false;
      });
  }

  return (
    <header className="bg-white/95 dark:bg-[#0b1328]/90 shadow-lg shadow-blue-950/20 backdrop-blur-xl sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-700/60 relative">
      {/* Top Border Glow (Same as Login Card) */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sky-400 to-transparent opacity-80 pointer-events-none" />

      <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-5 lg:px-6">
        <div className="flex items-center justify-between h-16 sm:h-18 lg:h-20 gap-4">
          
          {/* Logo e Nome da Empresa + Status Online (Lado Esquerdo) */}
          <div className="flex items-center gap-2.5 lg:gap-3 shrink-0">
            <a href="#" onClick={(e) => { e.preventDefault(); handlePageSelect('dashboard')}} className="flex items-center py-1">
                {companyLogo ? (
                    <img src={companyLogo} alt="Logo" className="h-9 sm:h-11 md:h-12 w-auto object-contain max-w-[140px] sm:max-w-[180px] transition-all filter drop-shadow-[0_2px_10px_rgba(11,102,228,0.3)]" />
                ) : (
                    <h1 className="text-lg md:text-xl xl:text-2xl font-black text-primary dark:text-white tracking-tighter uppercase whitespace-nowrap">
                      TRANS<span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">CUNHA</span>
                    </h1>
                )}
            </a>

            {/* Badge Status Online */}
            <div className="hidden 2xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/60 shadow-inner backdrop-blur-md shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 tracking-wider uppercase">Online</span>
            </div>
          </div>

          {/* Navegação Principal (Centralizada) */}
          <nav className="hidden lg:flex items-center justify-center space-x-1 xl:space-x-2 flex-1 min-w-0 px-2">
            {filteredNavItems.map((item) => {
                const isActive = currentPage === item.id || isParentOfCurrentPage(item);
                if(item.children) {
                    return (
                        <div className="relative" key={item.id} ref={item.id === openDropdown ? dropdownRef : null}>
                            <button
                                onClick={() => handleDropdownToggle(item.id)}
                                className={`flex items-center px-3 xl:px-4 py-2 text-xs xl:text-sm font-bold rounded-xl transition-all duration-200 whitespace-nowrap cursor-pointer ${
                                    isActive 
                                      ? 'bg-gradient-to-r from-blue-600 via-primary to-blue-700 text-white shadow-md shadow-blue-900/40 scale-[1.02]' 
                                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
                                }`}
                            >
                                <span>{item.label}</span>
                                <ChevronDownIcon className={`w-3.5 h-3.5 xl:w-4 xl:h-4 ml-1 transition-transform ${openDropdown === item.id ? 'rotate-180' : ''}`} />
                            </button>
                            {openDropdown === item.id && (
                                <div className="absolute mt-2 w-60 origin-top-left bg-white/95 dark:bg-[#0b1328]/95 border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-2xl py-1.5 z-50">
                                    {item.children.map(child => {
                                      if (child.children) {
                                        return (
                                          <div key={child.id} className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-t border-slate-100 dark:border-slate-800 mt-1 first:mt-0 first:border-0">
                                            {child.label}
                                            <div className="mt-1 normal-case font-normal text-sm space-y-0.5">
                                              {child.children.map(grandChild => (
                                                <a key={grandChild.id} href="#" onClick={(e) => { e.preventDefault(); handlePageSelect(grandChild.id as Page); }}
                                                   className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${currentPage === grandChild.id ? 'text-white bg-blue-600 shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'}`}
                                                >
                                                   <grandChild.icon className="w-4 h-4" />
                                                   {grandChild.label}
                                                </a>
                                              ))}
                                            </div>
                                          </div>
                                        )
                                      }
                                      return (
                                        <a key={child.id} href="#" onClick={(e) => { e.preventDefault(); handlePageSelect(child.id as Page); }}
                                           className={`flex items-center gap-3 px-3.5 py-2 mx-1 rounded-xl text-sm font-medium transition-all ${currentPage === child.id ? 'text-white bg-blue-600 shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'}`}
                                        >
                                           <child.icon className="w-4 h-4" />
                                           {child.label}
                                        </a>
                                      )
                                    })}
                                </div>
                            )}
                        </div>
                    )
                }
                return (
                    <a href="#" key={item.id} onClick={(e) => { e.preventDefault(); handlePageSelect(item.id as Page); }}
                       className={`px-3 xl:px-4 py-2 text-xs xl:text-sm font-bold rounded-xl transition-all duration-200 whitespace-nowrap cursor-pointer ${
                           isActive 
                             ? 'bg-gradient-to-r from-blue-600 via-primary to-blue-700 text-white shadow-md shadow-blue-900/40 scale-[1.02]' 
                             : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
                       }`}
                    >{item.label}</a>
                )
            })}
          </nav>

          {/* Ícones, Seletor de Fundo e Menu do Usuário (Lado Direito) */}
          <div className="flex items-center justify-end gap-2 xl:gap-3 shrink-0">
             {user.profile === UserProfile.Motorista && (
                <DriverLocationTracker user={user} />
             )}
             
             {/* Seletor de Fundo: Escuro / Claro */}
             <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-700/70 shadow-inner shrink-0">
               <button
                 type="button"
                 title="Ativar Fundo Claro"
                 onClick={() => onThemeModeChange && onThemeModeChange('light')}
                 className={`p-1.5 xl:px-2 xl:py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                   themeMode === 'light'
                     ? 'bg-white text-blue-600 shadow-sm'
                     : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                 }`}
               >
                 <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                 <span className="hidden 2xl:inline text-[11px]">Claro</span>
               </button>
               <button
                 type="button"
                 title="Ativar Fundo Escuro"
                 onClick={() => onThemeModeChange && onThemeModeChange('dark')}
                 className={`p-1.5 xl:px-2 xl:py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                   themeMode === 'dark'
                     ? 'bg-gradient-to-r from-blue-600 to-sky-600 text-white shadow-md shadow-blue-900/40'
                     : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                 }`}
               >
                 <Moon className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                 <span className="hidden 2xl:inline text-[11px]">Escuro</span>
               </button>
             </div>

              {/* Botão de Novidades / Atualizações do Sistema */}
              <button
                type="button"
                onClick={onOpenUpdates}
                title="Novidades e Atualizações do Sistema"
                className="p-1.5 xl:px-2.5 xl:py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse shrink-0" />
                <span className="hidden 2xl:inline text-[11px]">Novidades</span>
              </button>

              <div className="shrink-0">
                <NotificationBell
                  user={user}
                  shipments={shipments}
                  freightOffers={freightOffers}
                  cargos={cargos}
                  drivers={drivers}
                  clients={clients}
                  products={products}
                  vehicles={vehicles}
                  users={users}
                  tickets={tickets}
                  onOpenTickets={onOpenTickets}
                  onNavigateTo={(page) => setCurrentPage(page)}
                  onAcceptOrderRequest={onAcceptOrderRequest}
                  onRefuseOrderRequest={onRefuseOrderRequest}
                  onSaveFreightOffer={onSaveFreightOffer}
                />
              </div>

            <div className="relative shrink-0" ref={openDropdown === 'user' ? dropdownRef : null}>
              <button onClick={() => handleDropdownToggle('user')} className="flex items-center gap-1.5 xl:gap-2 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all shrink-0 cursor-pointer">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-sky-400 text-white flex items-center justify-center font-bold shadow-md text-xs shrink-0">
                  {user.name.charAt(0)}
                </div>
                <div className="hidden lg:block text-left min-w-0">
                    <p className="text-xs xl:text-sm font-semibold text-slate-800 dark:text-white truncate max-w-[85px] xl:max-w-[130px] leading-tight">{user.name}</p>
                    <p className="text-[10px] xl:text-xs text-slate-500 dark:text-slate-400 truncate max-w-[85px] xl:max-w-[130px] leading-tight">{user.profile}</p>
                </div>
                 <ChevronDownIcon className={`hidden lg:block w-3.5 h-3.5 xl:w-4 xl:h-4 text-slate-500 shrink-0 transition-transform ${openDropdown === 'user' ? 'rotate-180' : ''}`} />
              </button>
              {openDropdown === 'user' && (
                <div className="absolute mt-2 w-52 right-0 origin-top-right bg-white/95 dark:bg-[#0b1328]/95 border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-2xl py-1.5 z-50">
                    <button 
                      onClick={() => {
                        handleDropdownToggle('user');
                        onOpenUpdates && onOpenUpdates();
                      }} 
                      className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all cursor-pointer"
                    >
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <span>Novidades da Versão</span>
                    </button>
                    <div className="h-px bg-slate-200 dark:bg-slate-700/60 my-1"></div>
                    <button onClick={onLogout} className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all cursor-pointer">
                        <LogOutIcon className="w-4 h-4 text-red-400" />
                        <span>Sair do Sistema</span>
                    </button>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="lg:hidden flex items-center ml-1">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 focus:outline-none transition-all"
              >
                <span className="sr-only">Abrir menu</span>
                {isMobileMenuOpen ? (
                  <XIcon className="block leading-none w-6 h-6" aria-hidden="true" />
                ) : (
                  <MenuIcon className="block leading-none w-6 h-6" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div 
          ref={mobileMenuRef}
          className="lg:hidden border-t dark:border-gray-700 bg-white dark:bg-gray-800 absolute left-0 right-0 top-full shadow-2xl max-h-[calc(100vh-4rem)] overflow-y-auto z-50 transition-all duration-300"
        >
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
             {filteredNavItems.map((item) => {
                const isActive = currentPage === item.id || isParentOfCurrentPage(item);
                if (item.children) {
                   return (
                      <div key={item.id} className="space-y-1">
                         <button
                            onClick={() => handleDropdownToggle(item.id)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-base font-medium ${
                                isActive ? 'text-primary dark:text-blue-400 bg-blue-50 dark:bg-blue-900/50' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                         >
                            <div className="flex items-center">
                               <item.icon className="w-5 h-5 mr-3" />
                               {item.label}
                            </div>
                            <ChevronDownIcon className={`w-4 h-4 transition-transform ${openDropdown === item.id ? 'rotate-180' : ''}`} />
                         </button>
                         {openDropdown === item.id && (
                            <div className="pl-8 space-y-1 pb-2">
                               {item.children.map(child => {
                                  if (child.children) {
                                      return (
                                          <div key={child.id} className="pt-2">
                                              <div className="px-3 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{child.label}</div>
                                              <div className="space-y-1">
                                                {child.children.map(grandchild => (
                                                    <a key={grandchild.id} href="#" onClick={(e) => { e.preventDefault(); handlePageSelect(grandchild.id as Page); }}
                                                       className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${currentPage === grandchild.id ? 'text-primary dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                                    >
                                                        <grandchild.icon className="w-4 h-4 mr-3" />
                                                        {grandchild.label}
                                                    </a>
                                                ))}
                                              </div>
                                          </div>
                                      )
                                  }
                                  return (
                                      <a key={child.id} href="#" onClick={(e) => { e.preventDefault(); handlePageSelect(child.id as Page); }}
                                         className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${currentPage === child.id ? 'text-primary dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                      >
                                          <child.icon className="w-4 h-4 mr-3" />
                                          {child.label}
                                      </a>
                                  )
                               })}
                            </div>
                         )}
                      </div>
                   )
                }
                return (
                    <a key={item.id} href="#" onClick={(e) => { e.preventDefault(); handlePageSelect(item.id as Page); }}
                       className={`flex items-center px-3 py-2 rounded-md text-base font-medium ${
                           isActive ? 'text-primary dark:text-blue-400 bg-blue-50 dark:bg-blue-900/50' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                       }`}
                    >
                        <item.icon className="w-5 h-5 mr-3" />
                        {item.label}
                    </a>
                )
             })}
          </div>
          <div className="pt-4 pb-3 border-t border-gray-200 dark:border-gray-700">
             <div className="flex items-center px-5 space-x-3">
                <div className="w-10 h-10 rounded-full bg-blue-200 text-primary flex items-center justify-center font-bold text-lg">
                   {user.name.charAt(0)}
                </div>
                <div>
                   <div className="text-base font-medium leading-none text-gray-800 dark:text-white">{user.name}</div>
                   <div className="text-sm font-medium leading-none text-gray-500 dark:text-gray-400 mt-1">{user.profile}</div>
                </div>
             </div>
             <div className="mt-3 px-2 space-y-1">
                <button
                   onClick={onLogout}
                   className="w-full flex items-center px-3 py-2 rounded-md text-base font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                   <LogOutIcon className="w-5 h-5 mr-3" />
                   Sair
                </button>
             </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default TopNavBar;
