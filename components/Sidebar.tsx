
import React, { useState, useEffect } from 'react';
import type { Page, User, ProfilePermissions } from '../types';
import { UserProfile } from '../types';
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
import { ShieldCheck } from 'lucide-react';


interface SidebarProps {
  user: User;
  onLogout: () => void;
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  profilePermissions: ProfilePermissions;
  companyLogo: string | null;
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
      { id: 'shipment-history', label: 'Histórico', icon: HistoryIcon },
      { id: 'operational-loads', label: 'Cargas', icon: ChartIcon },
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
    ]
  },
  { id: 'reports', label: 'Relatórios', icon: ChartIcon },
  {
    id: 'settings',
    label: 'Configurações',
    icon: UsersIcon,
    children: [
      { id: 'users-register', label: 'Gerenciar Usuários', icon: UserPlusIcon },
      { id: 'appearance', label: 'Aparência', icon: ImageIcon },
    ]
  }
];

const Sidebar: React.FC<SidebarProps> = ({ user, onLogout, currentPage, setCurrentPage, profilePermissions, companyLogo }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  
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

  const getParentId = (page: Page): string | null => {
      for (const item of navItems) {
        if (item.children?.some(child => child.id === page || child.children?.some(c => c.id === page))) {
            return item.id;
        }
    }
    return null;
  };

  const [openMenu, setOpenMenu] = useState<string | null>(getParentId(currentPage));

  useEffect(() => {
    const parentId = getParentId(currentPage);
    if (parentId && !isCollapsed) {
      setOpenMenu(parentId);
    }
  }, [currentPage, isCollapsed]);
  
  const handleMenuClick = (id: string) => {
    setOpenMenu(openMenu === id ? null : id);
  };

  const NavLink: React.FC<{
    id: Page;
    label: string;
    icon: React.ElementType;
    isSubItem?: boolean;
  }> = ({ id, label, icon: Icon, isSubItem = false }) => {
    const isActive = currentPage === id;
    const marginLeft = isSubItem && !isCollapsed ? 'ml-4' : '';

    return (
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          setCurrentPage(id);
        }}
        title={isCollapsed ? label : undefined}
        className={`flex items-center px-4 py-2 mt-1 text-gray-600 dark:text-gray-400 transition-colors duration-300 transform rounded-lg ${marginLeft} ${
          isActive
            ? 'bg-blue-200 dark:bg-blue-900 text-gray-700 dark:text-gray-200'
            : 'hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'
        } ${isCollapsed ? 'justify-center' : ''}`}
      >
        <Icon className="w-5 h-5" />
        <span className={`mx-4 font-medium ${isCollapsed ? 'hidden' : ''}`}>{label}</span>
      </a>
    );
  };

  const ChevronDownIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  );

  return (
    <div 
        className={`relative flex flex-col h-screen py-8 bg-white dark:bg-gray-800 border-r dark:border-gray-700 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20 px-2' : 'w-64 px-4'}`}
        onMouseEnter={() => setIsCollapsed(false)}
        onMouseLeave={() => setIsCollapsed(true)}
    >
      <div className="h-20 flex items-center justify-center">
        {companyLogo ? (
            <img src={companyLogo} alt="Logo da Empresa" className={`transition-all duration-300 mx-auto object-contain ${isCollapsed ? 'h-12 max-w-[60px]' : 'h-16 max-w-[190px]'}`} />
        ) : (
            <h2 className="text-3xl font-semibold text-center text-primary dark:text-white">
            {isCollapsed ? 'Agromercantil' : 'Agromercantil Logística'}
            </h2>
        )}
      </div>
      <div className="flex flex-col justify-between flex-1 mt-6">
        <nav>
          {filteredNavItems.map((item) => {
            if (item.children) {
              const isParentActive = getParentId(currentPage) === item.id;
              const isOpen = openMenu === item.id;
              return (
                <div key={item.id}>
                  <button
                    onClick={() => !isCollapsed && handleMenuClick(item.id)}
                    title={isCollapsed ? item.label : undefined}
                    className={`flex items-center w-full px-4 py-2 mt-2 text-gray-600 dark:text-gray-400 transition-colors duration-300 transform rounded-lg ${
                      isParentActive && !isOpen && !isCollapsed
                        ? 'bg-blue-200 dark:bg-blue-900 text-gray-700 dark:text-gray-200'
                        : 'hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'
                    } ${isCollapsed ? 'justify-center' : 'justify-between'}`}
                  >
                    <div className="flex items-center">
                      <item.icon className="w-5 h-5" />
                      <span className={`mx-4 font-medium ${isCollapsed ? 'hidden' : ''}`}>{item.label}</span>
                    </div>
                    {!isCollapsed && <ChevronDownIcon className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />}
                  </button>
                  {!isCollapsed && isOpen && (
                    <div className="pt-1">
                      {item.children.map((child) => (
                          <NavLink
                            key={child.id}
                            id={child.id as Page}
                            label={child.label}
                            icon={child.icon}
                            isSubItem={true}
                          />
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <NavLink
                key={item.id}
                id={item.id as Page}
                label={item.label}
                icon={item.icon}
              />
            );
          })}
        </nav>
      </div>

      <div className="absolute bottom-0 left-0 w-full border-t dark:border-gray-700 px-4 py-2">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-full bg-blue-200 text-primary flex items-center justify-center font-bold">
            {user.name.charAt(0)}
          </div>
          <div className={`flex-1 ml-3 ${isCollapsed ? 'hidden' : ''}`}>
            <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{user.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.profile}</p>
          </div>
          <button onClick={onLogout} title="Sair" className={`ml-2 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 ${isCollapsed ? '' : ''}`}>
             <LogOutIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
