
import React, { useState, useEffect } from 'react';
import type { Cargo, DailyScheduleEntry } from '../types';
import { DailyScheduleType } from '../types';
import { useToast } from '../hooks/useToast';

interface ChangeDailyScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: DailyScheduleEntry | null) => void;
  cargo: Cargo | null;
  date: string | null;
}

const ChangeDailyScheduleModal: React.FC<ChangeDailyScheduleModalProps> = ({ isOpen, onClose, onSave, cargo, date }) => {
  const { showToast } = useToast();
  const [scheduleType, setScheduleType] = useState<DailyScheduleType>(DailyScheduleType.Livre);
  const [tonnage, setTonnage] = useState<number | undefined>(undefined);
  const [existingEntry, setExistingEntry] = useState<DailyScheduleEntry | null>(null);
  
  useEffect(() => {
    if (isOpen && cargo && date) {
      const entry = cargo.dailySchedule?.find(e => e.date === date) || null;
      setExistingEntry(entry);
      setScheduleType(entry?.type || DailyScheduleType.Livre);
      setTonnage(entry?.tonnage);
    } else {
        setExistingEntry(null);
        setScheduleType(DailyScheduleType.Livre);
        setTonnage(undefined);
    }
  }, [isOpen, cargo, date]);

  const handleSave = () => {
    if (!date) return;
    if (scheduleType === DailyScheduleType.Fixo && (!tonnage || tonnage <= 0)) {
        showToast('Para Demanda Fixa, a tonelagem deve ser maior que zero.', 'warning');
        return;
    }

    onSave({
        date,
        type: scheduleType,
        tonnage: scheduleType === DailyScheduleType.Fixo ? tonnage : undefined,
    });
  };

  const handleRemove = () => {
    if (window.confirm('Tem certeza que deseja remover a programação para este dia?')) {
        onSave(null);
    }
  };

  if (!isOpen || !date) return null;
  
  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('pt-BR');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-lg w-full">
        <h2 className="text-xl font-bold mb-2 text-gray-800 dark:text-white">Alterar Programação do Dia</h2>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">Data: <span className="font-semibold">{formattedDate}</span></p>

        <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status da Demanda</label>
            <div className="space-y-2">
                {Object.values(DailyScheduleType).map(type => (
                    <label key={type} className="flex items-center p-3 border rounded-lg dark:border-gray-600 has-[:checked]:bg-blue-50 dark:has-[:checked]:bg-blue-900/50 has-[:checked]:border-primary dark:has-[:checked]:border-blue-500 cursor-pointer">
                        <input
                            type="radio"
                            name="scheduleType"
                            value={type}
                            checked={scheduleType === type}
                            onChange={() => setScheduleType(type)}
                            className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                        />
                        <span className="ml-3 block text-sm font-medium text-gray-800 dark:text-gray-200">{type}</span>
                    </label>
                ))}
            </div>

            {scheduleType === DailyScheduleType.Fixo && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-4">
                        Limite de Toneladas
                    </label>
                    <input
                        type="number"
                        value={tonnage || ''}
                        onChange={(e) => setTonnage(parseFloat(e.target.value) || undefined)}
                        placeholder="Ex: 120"
                        className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600"
                        required
                        step="0.01"
                    />
                </div>
            )}
        </div>

        <div className="mt-8 flex justify-between items-center">
          <div>
            {existingEntry && (
                <button type="button" onClick={handleRemove} className="py-2 px-4 bg-black text-white rounded-lg text-sm hover:bg-gray-800">
                    Remover Programação
                </button>
            )}
          </div>
          <div className="flex space-x-4">
            <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">
              Cancelar
            </button>
            <button type="button" onClick={handleSave} className="py-2 px-4 bg-primary text-white rounded-lg hover:bg-primary-dark">
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChangeDailyScheduleModal;
