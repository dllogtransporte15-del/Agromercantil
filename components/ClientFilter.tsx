
import React from 'react';

export interface ClientFilters {
  id: string;
  nomeFantasia: string;
  cnpj: string;
  cityState: string;
  contact: string;
}

interface ClientFilterProps {
  filters: ClientFilters;
  onFilterChange: (filters: ClientFilters) => void;
}

const ClientFilter: React.FC<ClientFilterProps> = ({ filters, onFilterChange }) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onFilterChange({ ...filters, [name]: value });
  };

  const clearFilters = () => {
    onFilterChange({
      id: '',
      nomeFantasia: '',
      cnpj: '',
      cityState: '',
      contact: '',
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
            placeholder="Ex: CLI-100..." 
            className="mt-1 p-2 w-full border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nome Fantasia</label>
          <input 
            type="text" 
            name="nomeFantasia" 
            value={filters.nomeFantasia} 
            onChange={handleInputChange} 
            placeholder="Filtrar por nome..." 
            className="mt-1 p-2 w-full border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">CNPJ</label>
          <input 
            type="text" 
            name="cnpj" 
            value={filters.cnpj} 
            onChange={handleInputChange} 
            placeholder="Filtrar por CNPJ..." 
            className="mt-1 p-2 w-full border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cidade/UF</label>
          <input 
            type="text" 
            name="cityState" 
            value={filters.cityState} 
            onChange={handleInputChange} 
            placeholder="Filtrar por cidade/UF..." 
            className="mt-1 p-2 w-full border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Contato (Tel/Email)</label>
          <input 
            type="text" 
            name="contact" 
            value={filters.contact} 
            onChange={handleInputChange} 
            placeholder="Filtrar por contato..." 
            className="mt-1 p-2 w-full border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
          />
        </div>

        <div className="flex items-end lg:col-span-5 justify-end">
            <button 
              onClick={clearFilters} 
              className="py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 transition-colors"
            >
                Limpar Filtros
            </button>
        </div>
      </div>
    </div>
  );
};

export default ClientFilter;
