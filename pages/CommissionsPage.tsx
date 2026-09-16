
import React, { useState } from 'react';
import Header from '../components/Header';
import type { Shipment, User, Cargo, Client } from '../types';
import { BriefcaseIcon } from '../components/icons/BriefcaseIcon';
import { ShipIcon } from '../components/icons/ShipIcon';
import SalespersonReport from '../components/reports/SalespersonReport';
import SupervisorReport from '../components/reports/SupervisorReport';
import ShipperReport from '../components/reports/ShipperReport';
import ExternalSalespersonReport from '../components/reports/ExternalSalespersonReport';
import { UsersIcon } from '../components/icons/UsersIcon';
import { StayRecord } from '../utils/toolStorage';

interface CommissionsPageProps {
  shipments: Shipment[];
  cargos: Cargo[];
  users: User[];
  stays?: StayRecord[];
  clients: Client[];
}

type ActiveTab = 'comercial' | 'embarcador' | 'vendedor-externo';

const CommissionsPage: React.FC<CommissionsPageProps> = ({ shipments, cargos, users, stays = [], clients }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('comercial');

  const renderContent = () => {
    switch(activeTab) {
      case 'comercial':
        return <SupervisorReport shipments={shipments} cargos={cargos} users={users} stays={stays} />;
      case 'embarcador':
        return <ShipperReport shipments={shipments} cargos={cargos} clients={clients} users={users} currentUser={null} />;
      case 'vendedor-externo':
        return <ExternalSalespersonReport shipments={shipments} cargos={cargos} clients={clients} />;
      default:
        return null;
    }
  };
  
  const navItems = [
      { id: 'comercial', label: 'Supervisor', icon: BriefcaseIcon },
      { id: 'embarcador', label: 'Embarcadores', icon: ShipIcon },
      { id: 'vendedor-externo', label: 'Vendedor Externo', icon: UsersIcon },
  ];

  return (
    <>
      <Header title="Cálculo de Comissões" />
      <div className="flex flex-col gap-8">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
             {navItems.map(item => (
                 <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as ActiveTab)}
                    className={`whitespace-nowrap flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                        activeTab === item.id
                        ? 'border-primary text-primary dark:border-blue-400 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500'
                    }`}
                    >
                    <item.icon className="w-5 h-5 mr-2" />
                    {item.label}
                 </button>
             ))}
          </nav>
        </div>
        <main className="flex-1">
          {renderContent()}
        </main>
      </div>
    </>
  );
};

export default CommissionsPage;
