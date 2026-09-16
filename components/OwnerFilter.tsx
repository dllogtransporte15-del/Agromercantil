
import React from 'react';
import { OwnerType } from '../types';

export interface OwnerFilters {
  id: string;
  name: string;
  cpfCnpj: string;
  phone: string;
  type: string;
}

interface OwnerFilterProps {
  filters: OwnerFilters;
  onFilterChange: (filters: OwnerFilters) => void;
}

const OwnerFilter: React.FC<OwnerFilterProps> = ({ filters, onFilterChange }) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    onFilterChange({ ...filters, [name]: value });
  };

  const clearFilters = () => {
    onFilterChange({
      id: '',
      name: '',
      cpfCnpj: '',
      phone: '',
      type: '',
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md mb-6 border dark:border-gray-700">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Text Filters */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">ID de Registro</label>
          <input 
            type="text" 
            name="id" 
            value={filters.id} 
            onChange={handleInputChange} 
            placeholder="Ex: OWN-100..." 
            className="mt-1 p-2 w-full border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Proprietário (Nome)</label>
          <input 
            type="text" 
            name="name" 
            value={filters.name} 
            onChange={handleInputChange} 
            placeholder="Filtrar por nome..." 
            className="mt-1 p-2 w-full border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">CPF/CNPJ</label>
          <input 
            type="text" 
            name="cpfCnpj" 
            value={filters.cpfCnpj} 
            onChange={handleInputChange} 
            placeholder="Filtrar por CPF ou CNPJ..." 
            className="mt-1 p-2 w-full border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Telefone</label>
          <input 
            type="text" 
            name="phone" 
            value={filters.phone} 
            onChange={handleInputChange} 
            placeholder="Filtrar por telefone..." 
            className="mt-1 p-2 w-full border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
          />
        </div>

        {/* Select Filters */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo</label>
          <select 
            name="type" 
            value={filters.type} 
            onChange={handleInputChange} 
            className="mt-1 p-2 w-full border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="">Todos</option>
            {Object.values(OwnerType).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="flex items-end lg:col-start-4">
            <button 
              onClick={clearFilters} 
              className="w-full py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 transition-colors"
            >
                Limpar Filtros
            </button>
        </div>
      </div>
    </div>
  );
};

export default OwnerFilter;
