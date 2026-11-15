import React, { useState, useEffect } from 'react';
import type { Shipment } from '../types';
import { useToast } from '../hooks/useToast';

interface EditScheduledDateTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { scheduledDate: string, scheduledTime: string }) => void;
  shipment: Shipment;
}

const EditScheduledDateTimeModal: React.FC<EditScheduledDateTimeModalProps> = ({ 
  isOpen, onClose, onSave, shipment 
}) => {
  const { showToast } = useToast();
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  useEffect(() => {
    if (shipment && isOpen) {
      setScheduledDate(shipment.scheduledDate);
      setScheduledTime(shipment.scheduledTime || '');
    }
  }, [shipment, isOpen]);

  const handleSave = () => {
    if (!scheduledDate) {
      showToast('A data programada é obrigatória.', 'warning');
      return;
    }
    onSave({ scheduledDate, scheduledTime });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 md:p-8 max-w-md w-full transform transition-all">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Alterar Agendamento</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          Embarque: <span className="font-mono font-bold text-primary">{shipment.id}</span>
        </p>
        
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Nova Data Programada
            </label>
            <input
              type="date"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Novo Horário Previsto
            </label>
            <input
              type="time"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
            />
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-100 dark:border-amber-800/50 mt-4">
            <div className="flex gap-3">
              <div className="text-amber-500 mt-0.5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed font-medium">
                Esta alteração será registrada no histórico do embarque e servirá para controle de agendamento na coleta/descarga.
              </p>
            </div>
          </div>
        </div>
        
        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all active:scale-95"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-3 px-4 bg-primary text-white font-bold rounded-lg hover:bg-primary-dark shadow-lg shadow-primary/25 transition-all active:scale-95"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditScheduledDateTimeModal;
