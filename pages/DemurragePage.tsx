

import React from 'react';
import Header from '../components/Header';
import { ClockIcon } from '../components/icons/ClockIcon';

const DemurragePage: React.FC = () => {
  return (
    <>
      <Header title="Controle de Outros" />
      <div className="flex flex-col items-center justify-center h-96 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <ClockIcon className="w-24 h-24 text-gray-300 dark:text-gray-600" />
        <h2 className="mt-6 text-2xl font-semibold text-gray-700 dark:text-gray-200">
          Módulo de Outros
        </h2>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          Esta funcionalidade está em desenvolvimento e estará disponível em breve.
        </p>
      </div>
    </>
  );
};

// FIX: Removed local declaration of ClockIcon as it is already imported and caused a conflict.

export default DemurragePage;