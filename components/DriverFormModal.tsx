import React, { useState, useEffect, useMemo } from 'react';
import { History } from 'lucide-react';
import type { Driver, Owner } from '../types';
import { DriverClassification } from '../types';
import { useToast } from '../hooks/useToast';
import { autoFormatInput } from '../utils/formatters';

interface DriverFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (driver: Driver | Omit<Driver, 'id'>) => void;
  driverToEdit: Driver | null;
  owners: Owner[];
  onShowHistory?: (driver: Driver) => void;
}

const DriverFormModal: React.FC<DriverFormModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  driverToEdit, 
  owners,
  onShowHistory 
}) => {
  const { showToast } = useToast();
  const getInitialState = (): Omit<Driver, 'id'> => ({
    name: '',
    cpf: '',
    cnh: '',
    phone: '',
    classification: DriverClassification.Terceiro,
    ownerId: undefined,
    active: true,
    restrictionReason: '',
  });

  const [driver, setDriver] = useState<Omit<Driver, 'id'>>(getInitialState());

  const isOwnerRelevant = useMemo(() => {
    return driver.classification !== DriverClassification.Terceiro;
  }, [driver.classification]);

  useEffect(() => {
    if (isOpen) {
      setDriver(driverToEdit ? { ...driverToEdit } : getInitialState());
    }
  }, [driverToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const formattedValue = autoFormatInput(name, value);
    const checked = (e.target as HTMLInputElement).checked;
    
    setDriver(prev => {
      const newState = { ...prev, [name]: type === 'checkbox' ? checked : formattedValue };
      if (name === 'classification' && value === DriverClassification.Terceiro) {
        newState.ownerId = undefined;
      }
      return newState;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isOwnerRelevant && !driver.ownerId) {
      showToast('Para esta classificação, o campo Proprietário é obrigatório.', 'warning');
      return;
    }
    if (driverToEdit) {
      onSave({
        ...driver,
        id: driverToEdit.id
      });
    } else {
      onSave(driver);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
            {driverToEdit ? 'Editar Motorista' : 'Novo Motorista'}
            {driverToEdit && (
              <span className="text-sm font-mono font-bold px-3 py-1 bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800">
                ID: {driverToEdit.id}
              </span>
            )}
          </h2>
          {driverToEdit && onShowHistory && (
             <button
               type="button"
               onClick={() => onShowHistory(driverToEdit)}
               className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 rounded-lg font-bold text-sm transition-all border border-blue-100 dark:border-blue-800 shadow-sm"
             >
               <History className="w-4 h-4" />
               Ver Histórico
             </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input name="name" value={driver.name} onChange={handleChange} placeholder="Nome Completo" className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" required />
          <input name="cpf" value={driver.cpf} onChange={handleChange} placeholder="CPF" className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" required />
          <input name="cnh" value={driver.cnh} onChange={handleChange} placeholder="Nº da CNH" className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" required />
          <input name="phone" value={driver.phone} onChange={handleChange} placeholder="Telefone" className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Classificação</label>
            <select name="classification" value={driver.classification} onChange={handleChange} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600">
              {Object.values(DriverClassification).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          
          {isOwnerRelevant && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Proprietário</label>
              <select
                name="ownerId"
                value={driver.ownerId || ''}
                onChange={handleChange}
                className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600"
                required
              >
                <option value="">Selecione um proprietário</option>
                {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              {driver.classification === DriverClassification.Proprio && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Para motoristas "Próprio", selecione o cadastro de proprietário correspondente ao motorista.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center space-x-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <input
              type="checkbox"
              name="active"
              id="active"
              checked={driver.active}
              onChange={handleChange}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
            />
            <label htmlFor="active" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Motorista Ativo
            </label>
          </div>

          {!driver.active && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Motivo da Restrição</label>
              <textarea
                name="restrictionReason"
                value={driver.restrictionReason || ''}
                onChange={handleChange}
                placeholder="Informe o motivo da desativação/restrição..."
                className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600 h-24"
                required
              />
            </div>
          )}

          <div className="mt-8 flex justify-end space-x-4">
            <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 font-bold">
              Cancelar
            </button>
            <button type="submit" className="py-2 px-4 bg-primary text-white rounded-lg hover:bg-primary-dark font-bold shadow-md">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DriverFormModal;
