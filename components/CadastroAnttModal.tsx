import React, { useState, useEffect } from 'react';
import type { Shipment } from '../types';
import { useToast } from '../hooks/useToast';

interface CadastroAnttModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { anttOwnerIdentifier: string; bankDetails?: string }) => void;
  shipment: Shipment;
}

const CadastroAnttModal: React.FC<CadastroAnttModalProps> = ({ isOpen, onClose, onSave, shipment }) => {
  const { showToast } = useToast();
  const [anttOwnerIdentifier, setAnttOwnerIdentifier] = useState('');
  const [bankDetails, setBankDetails] = useState('');

  useEffect(() => {
    if (isOpen && shipment) {
      setAnttOwnerIdentifier(shipment.anttOwnerIdentifier || '');
      setBankDetails(shipment.bankDetails || '');
    }
  }, [isOpen, shipment]);

  const handleSave = () => {
    if (!anttOwnerIdentifier) {
      showToast('O CPF/CNPJ do titular da ANTT é obrigatório.', 'warning');
      return;
    }
    onSave({ anttOwnerIdentifier, bankDetails });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-lg w-full">
        <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Cadastro de Titular ANTT</h2>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">Embarque ID: {shipment.id}</p>
        
        <div className="space-y-4">
            <div>
              <label htmlFor="antt-identifier" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                CPF/CNPJ do Titular da ANTT <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="antt-identifier"
                value={anttOwnerIdentifier}
                onChange={(e) => setAnttOwnerIdentifier(e.target.value)}
                className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600"
                placeholder="00.000.000/0000-00 ou 000.000.000-00"
                required
              />
            </div>
            <div>
              <label htmlFor="bank-details" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Dados Bancários (Opcional)
              </label>
              <textarea
                id="bank-details"
                value={bankDetails}
                onChange={(e) => setBankDetails(e.target.value)}
                placeholder="Banco: 001, Ag: 1234, C/C: 56789-0&#10;Titular: Nome, CPF/CNPJ: ..."
                className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600"
                rows={4}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Os dados bancários devem ser compatíveis com o titular da ANTT ou com o motorista.
              </p>
            </div>
        </div>
        
        <div className="mt-8 flex justify-end space-x-4">
          <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">
            Cancelar
          </button>
          <button type="button" onClick={handleSave} className="py-2 px-4 bg-primary text-white rounded-lg hover:bg-primary-dark">
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};

export default CadastroAnttModal;