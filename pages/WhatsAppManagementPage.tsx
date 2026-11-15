import React from 'react';
import type { User } from '../types';
import { WhatsAppDashboard } from '../components/whatsapp/WhatsAppDashboard';

interface WhatsAppManagementPageProps {
  currentUser?: User | null;
}

export const WhatsAppManagementPage: React.FC<WhatsAppManagementPageProps> = ({ currentUser }) => {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <WhatsAppDashboard currentUser={currentUser} />
    </div>
  );
};

export default WhatsAppManagementPage;
