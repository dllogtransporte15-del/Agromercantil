import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import type { Shipment, User } from '../types';

interface EditPriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { newTotal: number, newRate?: number, newCompanyRate?: number }) => void;
  shipment: Shipment;
  currentUser: User;
}

const EditPriceModal: React.FC<EditPriceModalProps> = ({ isOpen, onClose, onSave, shipment, currentUser }) => {
  const [totalPrice, setTotalPrice] = useState(0);
  const [pricePerTon, setPricePerTon] = useState(0);
  const [companyPricePerTon, setCompanyPricePerTon] = useState(0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  useEffect(() => {
    if (shipment && isOpen) {
      const total = shipment.driverFreightValue;
      const perTon = shipment.driverFreightRateSnapshot || (shipment.shipmentTonnage > 0 ? total / shipment.shipmentTonnage : 0);
      const companyRate = shipment.companyFreightRateSnapshot || 0;
      setTotalPrice(total);
      setPricePerTon(perTon);
      setCompanyPricePerTon(companyRate);
    }
  }, [shipment, isOpen]);

  const handleTotalPriceChange = (newTotal: number) => {
    setTotalPrice(newTotal);
    if (shipment && shipment.shipmentTonnage > 0) {
      setPricePerTon(newTotal / shipment.shipmentTonnage);
    }
  };

  const handlePricePerTonChange = (newPerTon: number) => {
    setPricePerTon(newPerTon);
    if (shipment) {
      setTotalPrice(newPerTon * shipment.shipmentTonnage);
    }
  };

  const handleSave = () => {
    onSave({ 
      newTotal: totalPrice, 
      newRate: pricePerTon, 
      newCompanyRate: canEditCompanyPrice ? companyPricePerTon : undefined 
    });
  };

  const canEditCompanyPrice = [UserProfile.Admin, UserProfile.Diretor].includes(currentUser.profile as UserProfile);

  if (!isOpen) return null;

  const currentBalance = totalPrice - (shipment.advanceValue || 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 md:p-8 max-w-lg w-full">
        <h2 className="text-2xl font-bold mb-2 text-gray-800 dark:text-white">Alterar Preço do Frete</h2>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">Embarque: <span className="font-mono font-medium text-primary">{shipment.id}</span></p>
        
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="price-per-ton" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Frete Motorista (por Ton)
                  </label>
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">R$</span>
                    </div>
                    <input
                      type="number"
                      name="price-per-ton"
                      id="price-per-ton"
                      className="focus:ring-primary focus:border-primary block w-full pl-8 pr-4 py-2 sm:text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="0,00"
                      value={pricePerTon || ''}
                      onChange={(e) => handlePricePerTonChange(Number(e.target.value))}
                      step="0.01"
                      disabled={!shipment || shipment.shipmentTonnage <= 0}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="total-price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Total Motorista
                  </label>
                  <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">R$</span>
                    </div>
                    <input
                      type="number"
                      name="total-price"
                      id="total-price"
                      className="focus:ring-primary focus:border-primary block w-full pl-8 pr-4 py-2 sm:text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="0,00"
                      value={totalPrice || ''}
                      onChange={(e) => handleTotalPriceChange(Number(e.target.value))}
                      step="0.01"
                    />
                  </div>
                </div>
            </div>

            {canEditCompanyPrice && (
              <div className="pt-4 border-t dark:border-gray-700">
                <label htmlFor="company-price-per-ton" className="block text-sm font-bold text-primary dark:text-blue-400 mb-2 uppercase tracking-tight">
                  Preço Frete Empresa (por Ton)
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm font-bold">R$</span>
                  </div>
                  <input
                    type="number"
                    name="company-price-per-ton"
                    id="company-price-per-ton"
                    className="focus:ring-primary focus:border-primary block w-full pl-10 pr-4 py-2.5 sm:text-sm border-2 border-primary/20 rounded-md dark:bg-gray-700 dark:border-primary/30 dark:text-white font-bold text-lg"
                    placeholder="0,00"
                    value={companyPricePerTon || ''}
                    onChange={(e) => setCompanyPricePerTon(Number(e.target.value))}
                    step="0.01"
                  />
                </div>
                <p className="mt-1 text-[10px] text-gray-500 uppercase font-semibold">Alterar o valor que a empresa recebe por tonelada neste embarque.</p>
              </div>
            )}

            <div className="bg-gray-50 dark:bg-gray-900/40 p-3 rounded-md border border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                    <span className="text-primary dark:text-blue-400">INFO:</span> Alterar um valor recalculará o outro automaticamente com base na tonelagem carregada ({(Number(shipment.shipmentTonnage) || 0).toLocaleString('pt-BR')} ton).
                </p>
            </div>

            {/* Cálculo do Saldo */}
            <div className="mt-8 p-4 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-800/50">
                <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-600 dark:text-gray-400">Novo Total do Frete:</span>
                        <span className="font-semibold text-gray-800 dark:text-white">{formatCurrency(totalPrice)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-600 dark:text-gray-400">Adiantamento já pago:</span>
                        <span className="font-semibold text-red-600 dark:text-red-400">(- {formatCurrency(shipment.advanceValue || 0)})</span>
                    </div>
                    <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800/50 flex justify-between items-center">
                        <span className="text-sm font-bold text-emerald-800 dark:text-emerald-400">Novo Saldo a Pagar:</span>
                        <span className="text-lg font-black text-emerald-700 dark:text-emerald-400">{formatCurrency(currentBalance)}</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div className="mt-8 flex flex-col-reverse sm:flex-row justify-end gap-3">
          <button type="button" onClick={onClose} className="py-2.5 px-6 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-all">
            Cancelar
          </button>
          <button type="button" onClick={handleSave} className="py-2.5 px-6 bg-primary text-white font-bold rounded-lg hover:bg-primary-dark shadow-md shadow-primary/20 transition-all">
            Salvar Alteração
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditPriceModal;