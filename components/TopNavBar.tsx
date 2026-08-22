
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Page, User, ProfilePermissions, Ticket } from '../types';
import { UserProfile, TicketStatus } from '../types';
import { can } from '../auth';
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
import { BellIcon } from './icons/BellIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { ArchiveIcon } from './icons/ArchiveIcon';
import { ToolIcon } from './icons/ToolIcon';
import { CalculatorIcon } from './icons/CalculatorIcon';
import { InfoIcon } from './icons/InfoIcon';
import { Menu as MenuIcon, X as XIcon, Activity } from 'lucide-react';

interface TopNavBarProps {
  user: User;
  onLogout: () => void;
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  profilePermissions: ProfilePermissions;
  companyLogo: string | null;
  onOpenTickets: () => void;
  tickets: Ticket[];
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
    label: 'Gestão Operacional',
    icon: TruckIcon,
    children: [
      { id: 'shipments', label: 'Embarques', icon: PackageIcon },
      { id: 'shipment-history', label: 'Histórico de Embarques', icon: HistoryIcon },
      { id: 'load-history', label: 'Histórico de Cargas', icon: ArchiveIcon },
      { id: 'operational-loads', label: 'Painel de Cargas Ativas', icon: ChartIcon },
      { id: 'operational-map', label: 'Monitoramento Logístico', icon: MapIcon },
    ],
  },
  {
    id: 'cadastro',
    label: 'Cadastros Gerais',
    icon: FolderIcon,
    children: [
        { id: 'clients', label: 'Clientes & Tomadores', icon: ClientsIcon },
        { id: 'owners', label: 'Frotistas & Proprietários', icon: UsersIcon },
        { id: 'drivers', label: 'Motoristas & Condutores', icon: DriverIcon },
        { id: 'vehicles', label: 'Frotas & Veículos', icon: TruckIcon },
        { id: 'loads', label: 'Ordens de Carga', icon: PackageIcon },
        { id: 'products', label: 'Produtos', icon: PackageIcon },
    ]
  },
  { id: 'reports', label: 'Relatórios', icon: ChartIcon },
  {
    id: 'ferramentas',
    label: 'Módulos & Utilitários',
    icon: ToolIcon,
    children: [
      { id: 'layover-calculator', label: 'Cálculo de Estadias', icon: CalculatorIcon },
      { id: 'freight-quote', label: 'Precificação & Cotações', icon: MapIcon },
      { id: 'tools-history', label: 'Histórico de Cotações', icon: HistoryIcon },
    ]
  },
  {
    id: 'settings',
    label: 'Administração & Governança',
    icon: UsersIcon,
    children: [
      { id: 'users-register', label: 'Gestão de Acessos & Usuários', icon: UserPlusIcon },
      { id: 'branches', label: 'Unidades Operacionais / Filiais', icon: FolderIcon },
      { id: 'appearance', label: 'Identidade Visual & Customização', icon: ImageIcon },
      { id: 'system-monitor', label: 'Saúde do Sistema & Auditoria', icon: Activity },
    ]
  }
];

const TopNavBar: React.FC<TopNavBarProps> = ({ user, onLogout, currentPage, setCurrentPage, profilePermissions, companyLogo, onOpenTickets, tickets }) => {
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
      // Check if click was outside the desktop dropdowns
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        // AND not inside the mobile menu
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
    <header className="bg-white/90 backdrop-blur-md dark:bg-gray-900/90 shadow-premium sticky top-0 z-40 border-b border-gray-100 dark:border-gray-800 transition-all duration-300">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo e Nome da Empresa */}
          <div className="flex items-center flex-shrink-0 mr-4">
            <a href="#" onClick={(e) => { e.preventDefault(); handlePageSelect('dashboard')}} className="flex items-center">
                {companyLogo ? (
                    <img src={companyLogo} alt="Logo" className="h-8 md:h-9 w-auto object-contain max-w-[150px] md:max-w-none" />
                ) : (
                    <h1 className="text-lg md:text-xl font-black text-primary dark:text-white tracking-tighter uppercase">
                      RODO<span className="text-accent">CHAGAS</span>
                    </h1>
                )}
            </a>
          </div>

          {/* Navegação Principal */}
          <nav className="hidden lg:flex items-center space-x-1">
            {filteredNavItems.map((item) => {
                const isActive = currentPage === item.id || isParentOfCurrentPage(item);
                if(item.children) {
                    return (
                        <div className="relative" key={item.id} ref={item.id === openDropdown ? dropdownRef : null}>
                            <button
                                onClick={() => handleDropdownToggle(item.id)}
                                className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                                    isActive ? 'text-primary dark:text-blue-400 bg-primary/10 dark:bg-primary/20 shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                            >
                                <span>{item.label}</span>
                                <ChevronDownIcon className={`w-4 h-4 ml-1 transition-transform ${openDropdown === item.id ? 'rotate-180' : ''}`} />
                            </button>
                            {openDropdown === item.id && (
                                <div className="absolute mt-2 w-56 origin-top-left bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 py-1">
                                    {item.children.map(child => {
                                      if (child.children) {
                                        return (
                                          <div key={child.id} className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider border-t border-gray-100 dark:border-gray-700 mt-1 first:mt-0 first:border-0">
                                            {child.label}
                                            <div className="mt-1 normal-case font-normal text-sm">
                                              {child.children.map(grandChild => (
                                                <a key={grandChild.id} href="#" onClick={(e) => { e.preventDefault(); handlePageSelect(grandChild.id as Page); }}
                                                   className={`flex items-center gap-3 px-2 py-1.5 rounded-md ${currentPage === grandChild.id ? 'text-primary dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'} hover:bg-gray-100 dark:hover:bg-gray-700`}
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
                                           className={`flex items-center gap-3 px-4 py-2 text-sm ${currentPage === child.id ? 'text-primary dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'} hover:bg-gray-100 dark:hover:bg-gray-700`}
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
                       className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                           isActive ? 'text-primary dark:text-blue-400 bg-primary/10 dark:bg-primary/20 shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                       }`}
                    >{item.label}</a>
                )
            })}
          </nav>

          {/* Ícones e Menu do Usuário */}
          <div className="flex items-center space-x-4">
             <div className="relative">
                <button
                onClick={onOpenTickets}
                className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
                aria-label="Abrir chamados"
                >
                    <BellIcon className="w-6 h-6" />
                </button>
                {myOpenTicketsCount > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                    {myOpenTicketsCount}
                </span>
                )}
            </div>

            <div className="relative" ref={openDropdown === 'user' ? dropdownRef : null}>
              <button onClick={() => handleDropdownToggle('user')} className="flex items-center space-x-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
                <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center font-bold shadow-md">
                  {user.name.charAt(0)}
                </div>
                <div className="hidden lg:block text-left">
                    <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{user.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.profile}</p>
                </div>
                 <ChevronDownIcon className={`hidden lg:block w-4 h-4 text-gray-500 transition-transform ${openDropdown === 'user' ? 'rotate-180' : ''}`} />
              </button>
              {openDropdown === 'user' && (
                <div className="absolute mt-2 w-48 right-0 origin-top-right bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 py-1">
                    <button onClick={onLogout} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                        <LogOutIcon className="w-4 h-4" />
                        Sair
                    </button>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="lg:hidden flex items-center ml-2">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
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
