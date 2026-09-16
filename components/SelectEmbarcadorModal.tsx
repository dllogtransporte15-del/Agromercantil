import React, { useState } from 'react';
import { X } from 'lucide-react';
import { User, UserProfile, Cargo } from '../types';

interface SelectEmbarcadorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (embarcadorId: string) => void;
  users: User[];
  cargo?: Cargo | null;
}

const SelectEmbarcadorModal: React.FC<SelectEmbarcadorModalProps> = ({ isOpen, onClose, onConfirm, users, cargo }) => {
  const [selectedEmbarcador, setSelectedEmbarcador] = useState<string>('');

  if (!isOpen) return null;

  const embarcadores = users
    .filter(u => u.active !== false && u.profile !== UserProfile.Motorista && u.profile !== UserProfile.Cliente && u.availableForDriverRequests !== false)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const handleConfirm = () => {
    if (selectedEmbarcador) {
      onConfirm(selectedEmbarcador);
      setSelectedEmbarcador('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">Selecionar Embarcador</h2>
            {cargo && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Carga {cargo.sequenceId} - {cargo.origin} para {cargo.destination}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Escolha o embarcador para qual você deseja enviar a solicitação. 
            Se não for aceita em 5 minutos, a solicitação ficará disponível para todos.
          </p>

          <div className="space-y-3 max-h-60 overflow-y-auto">
            {embarcadores.map(emb => (
              <label
                key={emb.id}
                className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedEmbarcador === emb.id 
                    ? 'border-primary bg-primary/5 dark:bg-primary/10' 
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <input
                  type="radio"
                  name="embarcador"
                  value={emb.id}
                  checked={selectedEmbarcador === emb.id}
                  onChange={() => setSelectedEmbarcador(emb.id)}
                  className="mr-3 text-primary focus:ring-primary h-4 w-4"
                />
                <span className="font-medium text-gray-800 dark:text-gray-200">{emb.name}</span>
              </label>
            ))}
            {embarcadores.length === 0 && (
              <div className="text-center text-gray-500 py-4">
                Nenhum embarcador ativo encontrado.
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 bg-gray-50/50 dark:bg-gray-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedEmbarcador}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Solicitar Ordem
          </button>
        </div>
      </div>
    </div>
  );
};

export default SelectEmbarcadorModal;
