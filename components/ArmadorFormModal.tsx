
import React, { useState, useEffect } from 'react';
import type { Embarcador } from '../types';
import { autoFormatInput } from '../utils/formatters';

interface ArmadorFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (armador: Embarcador | Omit<Embarcador, 'id'>) => void;
  armadorToEdit: Embarcador | null;
}

const ArmadorFormModal: React.FC<ArmadorFormModalProps> = ({ isOpen, onClose, onSave, armadorToEdit }) => {
  const [armador, setArmador] = useState<Omit<Embarcador, 'id'>>({
    name: '',
  });

  useEffect(() => {
    if (armadorToEdit) {
      setArmador(armadorToEdit);
    } else {
      setArmador({
        name: '',
      });
    }
  }, [armadorToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const formattedValue = autoFormatInput(name, value);
    setArmador(prev => ({ ...prev, [name]: formattedValue }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (armadorToEdit) {
      onSave({
        ...armador,
        id: armadorToEdit.id,
      });
    } else {
      onSave(armador);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">{armadorToEdit ? 'Editar Armador' : 'Novo Armador'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-6">
            <input name="name" value={armador.name} onChange={handleChange} placeholder="Nome" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required />
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

export default ArmadorFormModal;