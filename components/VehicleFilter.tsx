
import React from 'react';
import type { Owner } from '../types';
import { VehicleSetType, VehicleBodyType, DriverClassification } from '../types';

export interface VehicleFilters {
  id: string;
  plate: string;
  setType: string;
  bodyType: string;
  classification: string;
  ownerId: string;
}

interface VehicleFilterProps {
  owners: Owner[];
  filters: VehicleFilters;
  onFilterChange: (filters: VehicleFilters) => void;
}

const VehicleFilter: React.FC<VehicleFilterProps> = ({ owners, filters, onFilterChange }) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    onFilterChange({ ...filters, [name]: value });
  };

  const clearFilters = () => {
    onFilterChange({
      id: '',
      plate: '',
      setType: '',
      bodyType: '',
      classification: '',
      ownerId: '',
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md mb-6 border dark:border-gray-700">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Text Filter */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">ID de Registro</label>
          <input 
            type="text" 
            name="id" 
            value={filters.id} 
            onChange={handleInputChange} 
            placeholder="Ex: VEH-100..." 
            className="mt-1 p-2 w-full border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Placa</label>
          <input 
            type="text" 
            name="plate" 
            value={filters.plate} 
            onChange={handleInputChange} 
            placeholder="Filtrar por placa..." 
            className="mt-1 p-2 w-full border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
          />
        </div>

        {/* Select Filters */}
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Conjunto</label>
          <select 
            name="setType" 
            value={filters.setType} 
            onChange={handleInputChange} 
            className="mt-1 p-2 w-full border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="">Todos</option>
            {Object.values(VehicleSetType).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Carroceria</label>
          <select 
            name="bodyType" 
            value={filters.bodyType} 
            onChange={handleInputChange} 
            className="mt-1 p-2 w-full border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="">Todos</option>
            {Object.values(VehicleBodyType).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
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

        <div className="flex items-end lg:col-start-5">
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

export default VehicleFilter;
