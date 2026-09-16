import React from 'react';
import type { Ticket, User, Shipment, FreightOffer, Cargo, Driver, Page, Client, Product, Vehicle } from '../types';
import NotificationBell from './NotificationBell';

interface MainHeaderProps {
  onOpenTickets: () => void;
  tickets: Ticket[];
  currentUser: User;
  shipments?: Shipment[];
  freightOffers?: FreightOffer[];
  cargos?: Cargo[];
  drivers?: Driver[];
  clients?: Client[];
  products?: Product[];
  vehicles?: Vehicle[];
  users?: User[];
  onNavigateTo?: (page: Page) => void;
  onAcceptOrderRequest?: (offer: FreightOffer) => void | Promise<void>;
  onRefuseOrderRequest?: (offer: FreightOffer, reason?: string) => void | Promise<void>;
  onSaveFreightOffer?: (offer: FreightOffer | Omit<FreightOffer, 'id' | 'createdAt'>) => Promise<void> | void;
}

const MainHeader: React.FC<MainHeaderProps> = ({ 
  onOpenTickets, 
  tickets, 
  currentUser,
  shipments = [],
  freightOffers = [],
  cargos = [],
  drivers = [],
  clients = [],
  products = [],
  vehicles = [],
  users = [],
  onNavigateTo,
  onAcceptOrderRequest,
  onRefuseOrderRequest,
  onSaveFreightOffer
}) => {
  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm z-10 border-b dark:border-gray-700">
      <div className="container mx-auto px-6 py-3">
        <div className="flex items-center justify-end">
          <NotificationBell
            user={currentUser}
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
            onNavigateTo={onNavigateTo}
            onAcceptOrderRequest={onAcceptOrderRequest}
            onRefuseOrderRequest={onRefuseOrderRequest}
            onSaveFreightOffer={onSaveFreightOffer}
          />
        </div>
      </div>
    </header>
  );
};

export default MainHeader;
