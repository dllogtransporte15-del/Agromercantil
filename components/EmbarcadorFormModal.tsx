import React, { useState, useEffect } from 'react';
import type { Embarcador } from '../types';
import { autoFormatInput } from '../utils/formatters';

interface EmbarcadorFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (embarcador: Embarcador | Omit<Embarcador, 'id'>) => void;
  embarcadorToEdit: Embarcador | null;
}

const EmbarcadorFormModal: React.FC<EmbarcadorFormModalProps> = ({ isOpen, onClose, onSave, embarcadorToEdit }) => {
  const [embarcador, setEmbarcador] = useState<Omit<Embarcador, 'id'>>({
    name: '',
    shipperCommissionRatePerTon: undefined,
  });

  useEffect(() => {
    if (embarcadorToEdit) {
      setEmbarcador(embarcadorToEdit);
    } else {
      setEmbarcador({
        name: '',
        shipperCommissionRatePerTon: undefined,
      });
    }
  }, [embarcadorToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'shipperCommissionRatePerTon') {
      setEmbarcador(prev => ({ ...prev, shipperCommissionRatePerTon: parseFloat(value) || undefined }));
      return;
    }
    const formattedValue = autoFormatInput(name, value);
    setEmbarcador(prev => ({ ...prev, [name]: formattedValue }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (embarcadorToEdit) {
      onSave({
        ...embarcador,
        id: embarcadorToEdit.id,
      });
    } else {
      onSave(embarcador);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-lg w-full border border-gray-100 dark:border-gray-700">
        <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">
          {embarcadorToEdit ? 'Editar Embarcador' : 'Novo Embarcador'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Nome do Embarcador
            </label>
            <input 
              name="name" 
              value={embarcador.name} 
              onChange={handleChange} 
              placeholder="Nome do Embarcador" 
              className="p-2 w-full border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm font-medium" 
              required 
            />
          </div>

          <div className="p-3 bg-amber-50/70 dark:bg-amber-950/40 rounded-xl border border-amber-200/80 dark:border-amber-800/80 space-y-1.5">
            <label className="block text-xs font-bold text-amber-900 dark:text-amber-200">
              Comissão do Embarcador (R$ / Tonelada):
            </label>
            <p className="text-[11px] text-amber-800 dark:text-amber-300">
              Valor unitário por tonelada lançado automaticamente nos embarques deste solicitante.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs font-bold font-mono text-gray-500">R$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                name="shipperCommissionRatePerTon"
                value={embarcador.shipperCommissionRatePerTon ?? ''}
                onChange={handleChange}
                placeholder="Ex: 2.00"
                className="p-1.5 text-xs w-36 border rounded-lg dark:bg-gray-700 dark:border-gray-600 font-mono font-bold"
              />
              <span className="text-xs text-gray-600 dark:text-gray-300 font-semibold">/ tonelada</span>
            </div>
          </div>

          <div className="pt-2 flex justify-end space-x-3">
            <button 
              type="button" 
              onClick={onClose} 
              className="py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-semibold dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="py-2 px-4 bg-primary hover:bg-primary-dark text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmbarcadorFormModal;
