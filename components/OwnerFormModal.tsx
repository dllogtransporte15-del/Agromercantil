import React, { useState, useEffect } from 'react';
import type { Owner } from '../types';
import { OwnerType } from '../types';
import { autoFormatInput } from '../utils/formatters';

interface OwnerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (owner: Owner | Omit<Owner, 'id'>) => void;
  ownerToEdit: Owner | null;
}

const OwnerFormModal: React.FC<OwnerFormModalProps> = ({ isOpen, onClose, onSave, ownerToEdit }) => {
  const [owner, setOwner] = useState<Omit<Owner, 'id'>>({
    name: '',
    cpfCnpj: '',
    phone: '',
    type: OwnerType.PessoaFisica,
    bankDetails: '',
  });

  useEffect(() => {
    if (ownerToEdit) {
      setOwner(ownerToEdit);
    } else {
      setOwner({
        name: '',
        cpfCnpj: '',
        phone: '',
        type: OwnerType.PessoaFisica,
        bankDetails: '',
      });
    }
  }, [ownerToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const formattedValue = autoFormatInput(name, value);
    setOwner(prev => ({ ...prev, [name]: formattedValue }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ownerToEdit) {
      onSave({
        ...owner,
        id: ownerToEdit.id,
      });
    } else {
      onSave(owner);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
            {ownerToEdit ? 'Editar Proprietário' : 'Novo Proprietário'}
            {ownerToEdit && (
              <span className="text-sm font-mono font-bold px-3 py-1 bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800">
                ID: {ownerToEdit.id}
              </span>
            )}
          </h2>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-6">
            <input name="name" value={owner.name} onChange={handleChange} placeholder="Nome / Razão Social" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required />
            <input name="cpfCnpj" value={owner.cpfCnpj} onChange={handleChange} placeholder="CPF / CNPJ" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required />
            <input name="phone" value={owner.phone} onChange={handleChange} placeholder="Telefone" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
            <select name="type" value={owner.type} onChange={handleChange} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
              {Object.values(OwnerType).map(type => <option key={type} value={type}>{type}</option>)}
            </select>
            <textarea name="bankDetails" value={owner.bankDetails} onChange={handleChange} placeholder="Dados Bancários" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" rows={3}></textarea>
          </div>
          <div className="mt-8 flex justify-end space-x-4">
            <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">
              Cancelar
            </button>
            <button type="submit" className="py-2 px-4 bg-primary text-white rounded-lg hover:bg-primary-dark">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OwnerFormModal;
