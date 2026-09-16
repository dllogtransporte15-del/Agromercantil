
import React from 'react';
import type { Driver, Owner } from '../types';
import { DriverClassification } from '../types';
import MultiSelectDropdown from './MultiSelectDropdown';

export interface DriverFilters {
  id: string;
  name: string;
  cpf: string;
  cnh: string;
  phone: string;
  ddd: string[];
  classification: string[];
  ownerNames: string[];
  status: string[];
}

interface DriverFilterProps {
  drivers: Driver[];
  owners: Owner[];
  filters: DriverFilters;
  onFilterChange: (filters: DriverFilters) => void;
}

const DriverFilter: React.FC<DriverFilterProps> = ({ drivers, owners, filters, onFilterChange }) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    onFilterChange({ ...filters, [name]: value });
  };

  const clearFilters = () => {
    onFilterChange({
      id: '',
      name: '',
      cpf: '',
      cnh: '',
      phone: '',
      ddd: [],
      classification: [],
      ownerNames: [],
      status: [],
    });
  };

  const dddOptions = React.useMemo(() => {
    const ddds = drivers
      .map(d => d.phone.replace(/\D/g, '').substring(0, 2))
      .filter(ddd => ddd.length === 2);
    return Array.from(new Set(ddds)).sort();
  }, [drivers]);

  const ownerNameOptions = React.useMemo(() => {
    return owners.map(o => o.name).sort();
  }, [owners]);

  const classificationOptions = Object.values(DriverClassification);
  const statusOptions = ['Ativo', 'Restrito'];

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
            placeholder="Ex: DRV-100..." 
            className="mt-1 p-2 w-full border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
          />
        </div>
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
          <MultiSelectDropdown
            label="DDD"
            options={dddOptions}
            selectedValues={filters.ddd}
            onChange={(vals) => onFilterChange({ ...filters, ddd: vals })}
            placeholder="Todos"
          />
        </div>
        <div>
          <MultiSelectDropdown
            label="Classificação"
            options={classificationOptions}
            selectedValues={filters.classification}
            onChange={(vals) => onFilterChange({ ...filters, classification: vals })}
            placeholder="Todas"
          />
        </div>
        <div>
          <MultiSelectDropdown
            label="Proprietário"
            options={ownerNameOptions}
            selectedValues={filters.ownerNames}
            onChange={(vals) => onFilterChange({ ...filters, ownerNames: vals })}
            placeholder="Todos"
          />
        </div>
        <div>
          <MultiSelectDropdown
            label="Status"
            options={statusOptions}
            selectedValues={filters.status}
            onChange={(vals) => onFilterChange({ ...filters, status: vals })}
            placeholder="Todos"
          />
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
