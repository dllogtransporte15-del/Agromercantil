
import React, { useState, useEffect, useMemo } from 'react';
import type { Shipment, User } from '../types';
import { UserProfile } from '../types';
import { useToast } from '../hooks/useToast';

interface TransferShipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newEmbarcadorId: string) => void;
  shipment: Shipment | null;
  users: User[];
}

const TransferShipmentModal: React.FC<TransferShipmentModalProps> = ({ isOpen, onClose, onSave, shipment, users }) => {
  const { showToast } = useToast();
  const [selectedEmbarcadorId, setSelectedEmbarcadorId] = useState('');

  const embarcadores = useMemo(() => {
    return users
      .filter(u => u.active !== false && u.profile !== UserProfile.Motorista && u.profile !== UserProfile.Cliente)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [users]);

  useEffect(() => {
    if (isOpen && shipment) {
      setSelectedEmbarcadorId(shipment.embarcadorId || '');
    }
  }, [isOpen, shipment]);

  const handleSave = () => {
    if (!selectedEmbarcadorId) {
      showToast('Por favor, selecione um embarcador.', 'warning');
      return;
    }
    onSave(selectedEmbarcadorId);
  };

  if (!isOpen || !shipment) return null;

  const currentEmbarcadorName = users.find(u => u.id === shipment.embarcadorId)?.name || 'Não atribuído';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-lg w-full">
        <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Transferir Embarque</h2>
        <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">Embarque ID: <b>{shipment.id}</b></p>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">Embarcador Atual: <b>{currentEmbarcadorName}</b></p>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="embarcador-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Novo Embarcador Responsável
            </label>
            <select
              id="embarcador-select"
              value={selectedEmbarcadorId}
              onChange={(e) => setSelectedEmbarcadorId(e.target.value)}
              className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600"
              required
            >
              <option value="" disabled>Selecione um novo responsável...</option>
              {embarcadores.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        </div>
        
        <div className="mt-8 flex justify-end space-x-4">
          <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">
            Cancelar
          </button>
          <button type="button" onClick={handleSave} className="py-2 px-4 bg-primary text-white rounded-lg hover:bg-primary-dark">
            Transferir
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransferShipmentModal;
