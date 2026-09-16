import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Building2, MapPin } from 'lucide-react';
import type { Branch, User, ProfilePermissions } from '../types';
import { UserProfile } from '../types';
import BranchFormModal from '../components/BranchFormModal';

interface BranchesPageProps {
  branches: Branch[];
  onSaveBranch: (branch: Branch | Omit<Branch, 'id' | 'createdAt'>) => void;
  onDeleteBranch: (branchId: string) => void;
  currentUser: User | null;
  profilePermissions: ProfilePermissions;
}

const BranchesPage: React.FC<BranchesPageProps> = ({ 
  branches, 
  onSaveBranch, 
  onDeleteBranch, 
  currentUser, 
  profilePermissions 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [branchToEdit, setBranchToEdit] = useState<Branch | null>(null);

  const canManage = currentUser?.profile === UserProfile.Admin;

  const handleEdit = (branch: Branch) => {
    setBranchToEdit(branch);
    setIsModalOpen(true);
  };

  const handleNew = () => {
    setBranchToEdit(null);
    setIsModalOpen(true);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            <Building2 className="w-8 h-8 text-primary" />
            Gestão de Filiais
          </h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Cadastre e gerencie as unidades da empresa para controle de resultados.
          </p>
        </div>
        {canManage && (
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 group"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
            Nova Filial
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {branches.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-gray-50 dark:bg-gray-800/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
            <div className="bg-white dark:bg-gray-800 w-16 h-16 rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nenhuma filial cadastrada</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">
              As filiais são essenciais para segmentar dados e relatórios. Comece cadastrando a primeira.
            </p>
          </div>
        ) : (
          branches.map((branch) => (
            <div 
              key={branch.id} 
              className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="bg-primary/10 dark:bg-primary/20 p-3 rounded-xl group-hover:scale-110 transition-transform duration-300">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                {canManage && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(branch)}
                      className="p-2 text-gray-400 hover:text-primary dark:hover:text-primary-light transition-colors hover:bg-primary/5 rounded-lg"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteBranch(branch.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 group-hover:text-primary transition-colors">
                  {branch.name}
                </h3>
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  {branch.city} - {branch.state}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-700 flex justify-between items-center text-[10px] text-gray-400 uppercase tracking-widest font-semibold">
                  <span>ID: {branch.id}</span>
                  <span>Criada em: {new Date(branch.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <BranchFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={onSaveBranch}
        branchToEdit={branchToEdit}
      />
    </div>
  );
};

export default BranchesPage;
