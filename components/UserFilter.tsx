import React from 'react';
import type { Branch, User } from '../types';
import { UserProfile } from '../types';
import { filterVisibleProfiles } from '../auth';

export interface UserFilters {
  id: string;
  name: string;
  profile: string;
  status: string;
  branchId?: string;
}

interface UserFilterProps {
  filters: UserFilters;
  onFilterChange: (filters: UserFilters) => void;
  availableProfiles?: UserProfile[];
  branches?: Branch[];
  currentUser?: User | null;
}

const UserFilter: React.FC<UserFilterProps> = ({ filters, onFilterChange, availableProfiles, branches, currentUser }) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    onFilterChange({ ...filters, [name]: value });
  };

  const clearFilters = () => {
    onFilterChange({
      id: '',
      name: '',
      profile: '',
      status: '',
      branchId: '',
    });
  };

  const isFiltered = filters.id !== '' || filters.name !== '' || filters.profile !== '' || filters.status !== '' || (filters.branchId !== '' && filters.branchId !== undefined);
  const baseProfiles = availableProfiles && availableProfiles.length > 0 ? availableProfiles : Object.values(UserProfile);
  const profilesToRender = filterVisibleProfiles(baseProfiles, currentUser);
  const hasBranches = Boolean(branches && branches.length > 0);

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md mb-6 border border-gray-200 dark:border-gray-700">
      <div className={`grid grid-cols-1 md:grid-cols-2 ${hasBranches ? 'lg:grid-cols-6' : 'lg:grid-cols-5'} gap-4 items-end`}>
        {/* ID Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ID</label>
          <input 
            type="text" 
            name="id" 
            value={filters.id} 
            onChange={handleInputChange} 
            placeholder="Ex: USR-100..." 
            className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none" 
          />
        </div>

        {/* Nome Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome</label>
          <input 
            type="text" 
            name="name" 
            value={filters.name} 
            onChange={handleInputChange} 
            placeholder="Filtrar por nome..." 
            className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none" 
          />
        </div>

        {/* Perfil Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Perfil</label>
          <select 
            name="profile" 
            value={filters.profile} 
            onChange={handleInputChange} 
            className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          >
            <option value="">Todos</option>
            {profilesToRender.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
          <select 
            name="status" 
            value={filters.status} 
            onChange={handleInputChange} 
            className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          >
            <option value="">Todos</option>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </div>

        {/* Filial Filter */}
        {hasBranches && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Filial</label>
            <select 
              name="branchId" 
              value={filters.branchId || ''} 
              onChange={handleInputChange} 
              className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none cursor-pointer"
            >
              <option value="">Todas</option>
              <option value="none">Sem Filial (Geral)</option>
              {branches?.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Clear Filters Button */}
        <div>
          <button 
            onClick={clearFilters} 
            disabled={!isFiltered}
            className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              isFiltered 
                ? 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600' 
                : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600 cursor-not-allowed border border-gray-200 dark:border-gray-700'
            }`}
          >
            Limpar Filtros
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserFilter;
