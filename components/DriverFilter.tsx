
import React from 'react';
import type { Owner } from '../types';
import { DriverClassification } from '../types';
import { formatCpfCnpj, formatPhone } from '../utils/formatters';

export interface DriverFilters {
  name: string;
  cpf: string;
  cnh: string;
  phone: string;
  classification: string;
  ownerId: string;
  status: 'all' | 'active' | 'restricted';
}

interface DriverFilterProps {
  owners: Owner[];
  filters: DriverFilters;
  onFilterChange: (filters: DriverFilters) => void;
}

const DriverFilter: React.FC<DriverFilterProps> = ({ owners, filters, onFilterChange }) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;
    if (name === 'cpf') {
      formattedValue = formatCpfCnpj(value);
    } else if (name === 'phone') {
      formattedValue = formatPhone(value);
    }
    onFilterChange({ ...filters, [name]: formattedValue });
  };

  const clearFilters = () => {
    onFilterChange({
      name: '',
      cpf: '',
      cnh: '',
      phone: '',
      classification: '',
      ownerId: '',
      status: 'all',
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md mb-6 border dark:border-gray-700">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Text Filters */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nome</label>
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
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">CPF</label>
          <input 
            type="text" 
            name="cpf" 
            value={filters.cpf} 
            onChange={handleInputChange} 
            placeholder="Filtrar por CPF..." 
            className="mt-1 p-2 w-full border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">CNH</label>
          <input 
            type="text" 
            name="cnh" 
            value={filters.cnh} 
            onChange={handleInputChange} 
            placeholder="Filtrar por CNH..." 
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
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Classificação</label>
          <select 
            name="classification" 
            value={filters.classification} 
            onChange={handleInputChange} 
            className="mt-1 p-2 w-full border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="">Todos</option>
            {Object.values(DriverClassification).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Proprietário</label>
          <select 
            name="ownerId" 
            value={filters.ownerId} 
            onChange={handleInputChange} 
            className="mt-1 p-2 w-full border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="">Todos</option>
            {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
          <select 
            name="status" 
            value={filters.status} 
            onChange={handleInputChange} 
            className="mt-1 p-2 w-full border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="all">Todos</option>
            <option value="active">Ativo</option>
            <option value="restricted">Restrito</option>
          </select>
        </div>

        <div className="flex items-end">
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

export default DriverFilter;
