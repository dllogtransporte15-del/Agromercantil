
import React from 'react';
import Header from '../components/Header';
import type { Shipment, User, Cargo } from '../types';
import ExternalSalespersonReport from '../components/reports/ExternalSalespersonReport';

interface CommissionsPageProps {
  shipments: Shipment[];
  cargos: Cargo[];
  users?: User[];
}

const CommissionsPage: React.FC<CommissionsPageProps> = ({ shipments, cargos }) => {
  return (
    <>
      <Header title="Cálculo de Comissões (Vendedores Externos)" />
      <div className="mt-6">
        <ExternalSalespersonReport shipments={shipments} cargos={cargos} />
      </div>
    </>
  );
};

export default CommissionsPage;

