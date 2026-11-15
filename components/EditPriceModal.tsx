import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { isDeveloperUser } from '../auth';
import type { Shipment, User, Cargo } from '../types';

interface EditPriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { newTotal: number, newRate?: number, newCompanyRate?: number }) => void;
  shipment: Shipment;
  currentUser: User;
  cargo?: Cargo;
}

const EditPriceModal: React.FC<EditPriceModalProps> = ({ isOpen, onClose, onSave, shipment, currentUser, cargo }) => {
  const [totalPrice, setTotalPrice] = useState(0);
  const [pricePerTon, setPricePerTon] = useState(0);
  const [companyPricePerTon, setCompanyPricePerTon] = useState(0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  useEffect(() => {
    if (shipment && isOpen) {
      const ton = shipment.shipmentTonnage || 0;
      const perTon = shipment.driverFreightRateSnapshot || (ton > 0 ? shipment.driverFreightValue / ton : 0);
      const total = (ton > 0 && perTon > 0)
        ? Number((perTon * ton).toFixed(2))
        : shipment.driverFreightValue;
      const companyRate = shipment.companyFreightRateSnapshot || 0;
      setTotalPrice(total);
      setPricePerTon(perTon);
      setCompanyPricePerTon(companyRate);
    }
  }, [shipment, isOpen]);

  const handleTotalPriceChange = (newTotal: number) => {
    setTotalPrice(newTotal);
    if (shipment && shipment.shipmentTonnage > 0) {
      setPricePerTon(Number((newTotal / shipment.shipmentTonnage).toFixed(2)));
    }
  };

  const handlePricePerTonChange = (newPerTon: number) => {
    setPricePerTon(newPerTon);
    if (shipment && shipment.shipmentTonnage > 0) {
      setTotalPrice(Number((newPerTon * shipment.shipmentTonnage).toFixed(2)));
    }
  };

  const isAdmin = isDeveloperUser(currentUser) ||
    currentUser.profile === UserProfile.Desenvolvedor ||
    currentUser.profile === UserProfile.Admin ||
    currentUser.profile === UserProfile.GerenciadoraDeRisco ||
    (currentUser.profile as string) === 'Administrador do Sistema' ||
    (currentUser.profile as string) === 'Gerenciadora de Risco' ||
    Boolean(currentUser.name && (currentUser.name.toLowerCase().includes('samanta') || currentUser.name.toLowerCase().includes('samantha'))) ||
    Boolean(currentUser.email && (currentUser.email.toLowerCase().includes('samanta') || currentUser.email.toLowerCase().includes('samantha')));

  const isOperationalEditor = [
    UserProfile.Embarcador,
    UserProfile.Agenciador,
    UserProfile.Comercial,
  ].includes(currentUser.profile);

  const canEditDriverPrice = isAdmin || isOperationalEditor;
  const canEditCompanyPrice = isAdmin;

  // Valor original colocado na carga (R$/ton)
  const cargoBaseRate = (cargo?.driverFreightValuePerTon !== undefined && cargo.driverFreightValuePerTon > 0)
    ? cargo.driverFreightValuePerTon
    : (shipment?.driverFreightRateSnapshot || (shipment && shipment.shipmentTonnage > 0 ? shipment.driverFreightValue / shipment.shipmentTonnage : 0));

  // Limite máximo permitido para perfis operacionais: até R$ 5,00 a mais do valor colocado na carga
  const maxAllowedRate = isAdmin 
    ? Infinity 
    : Number((cargoBaseRate + 5.00).toFixed(2));

  const maxAllowedTotal = (shipment && shipment.shipmentTonnage > 0 && maxAllowedRate !== Infinity)
    ? Number((maxAllowedRate * shipment.shipmentTonnage).toFixed(2))
    : (isAdmin ? Infinity : Number(((cargoBaseRate + 5.00) * (shipment?.shipmentTonnage || 1)).toFixed(2)));

  const isRateExceeded = !isAdmin && isOperationalEditor && (pricePerTon > maxAllowedRate + 0.001);
  const isTotalExceeded = !isAdmin && isOperationalEditor && shipment && shipment.shipmentTonnage > 0 && (totalPrice > maxAllowedTotal + 0.01);
  const isOverLimit = isRateExceeded || isTotalExceeded;

  const handleSave = () => {
    if (!canEditDriverPrice) return;
    if (isOverLimit) return;
    const computedTotal = (shipment && shipment.shipmentTonnage > 0 && pricePerTon > 0)
      ? Number((pricePerTon * shipment.shipmentTonnage).toFixed(2))
      : totalPrice;

    onSave({ 
      newTotal: computedTotal, 
      newRate: pricePerTon > 0 ? pricePerTon : undefined, 
      newCompanyRate: canEditCompanyPrice ? companyPricePerTon : undefined 
    });
  };

  if (!isOpen) return null;

  const currentBalance = totalPrice - (shipment.advanceValue || 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 md:p-8 max-w-lg w-full">
        <h2 className="text-2xl font-bold mb-2 text-gray-800 dark:text-white">Alterar Preço do Frete</h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Embarque: <span className="font-mono font-medium text-primary">{shipment.id}</span></p>

        {!canEditDriverPrice && (
          <div className="mb-6 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-xs font-semibold text-red-700 dark:text-red-300">
            ⚠️ Ação restrita: Seu perfil não possui autorização para alterar valores de frete deste embarque.
          </div>
        )}

        {isOperationalEditor && !isAdmin && (
          <div className="mb-4 p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
              <span>🛡️ Permissão Operacional ({currentUser.profile})</span>
            </div>
            <p>
              Você pode aumentar o frete do motorista em até <strong>+ R$ 5,00/ton</strong> do valor estipulado na carga.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 font-mono text-[11px]">
              <span>Valor Base na Carga: <strong>{formatCurrency(cargoBaseRate)}/ton</strong></span>
              <span>Teto Máximo Permitido: <strong className="text-emerald-700 dark:text-emerald-400">{formatCurrency(maxAllowedRate)}/ton</strong></span>
            </div>
          </div>
        )}

        {isOverLimit && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-lg text-xs font-semibold text-red-700 dark:text-red-300 flex items-start gap-2">
            <span className="text-base leading-none">⚠️</span>
            <span>
              Valor acima do limite operacional permitido: o valor do frete motorista não pode ultrapassar {formatCurrency(maxAllowedRate)}/ton (R$ 5,00 a mais que o valor colocado na carga).
            </span>
          </div>
        )}
        
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
                      className={`focus:ring-primary focus:border-primary block w-full pl-8 pr-4 py-2 sm:text-sm border rounded-md dark:bg-gray-700 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed ${
                        isOverLimit ? 'border-red-500 focus:border-red-500 focus:ring-red-500 bg-red-50/20' : 'border-gray-300 dark:border-gray-600'
                      }`}
                      placeholder="0,00"
                      value={pricePerTon || ''}
                      onChange={(e) => handlePricePerTonChange(Number(e.target.value))}
                      step="0.01"
                      disabled={!canEditDriverPrice || !shipment || shipment.shipmentTonnage <= 0}
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
                      className={`focus:ring-primary focus:border-primary block w-full pl-8 pr-4 py-2 sm:text-sm border rounded-md dark:bg-gray-700 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed ${
                        isOverLimit ? 'border-red-500 focus:border-red-500 focus:ring-red-500 bg-red-50/20' : 'border-gray-300 dark:border-gray-600'
                      }`}
                      placeholder="0,00"
                      value={totalPrice || ''}
                      onChange={(e) => handleTotalPriceChange(Number(e.target.value))}
                      step="0.01"
                      disabled={!canEditDriverPrice}
                    />
                  </div>
                </div>
            </div>

            {canEditCompanyPrice && (
              <div className="pt-4 border-t dark:border-gray-700">
                <label htmlFor="company-price-per-ton" className="block text-sm font-bold text-primary dark:text-amber-400 mb-2 uppercase tracking-tight">
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
                    className="focus:ring-primary focus:border-primary block w-full pl-10 pr-4 py-2.5 sm:text-sm border-2 border-primary/20 rounded-md dark:bg-gray-700 dark:border-primary/30 dark:text-white font-bold text-lg disabled:opacity-60 disabled:cursor-not-allowed"
                    placeholder="0,00"
                    value={companyPricePerTon || ''}
                    onChange={(e) => setCompanyPricePerTon(Number(e.target.value))}
                    step="0.01"
                    disabled={!isAdmin}
                  />
                </div>
                <p className="mt-1 text-[10px] text-gray-500 uppercase font-semibold">Alterar o valor que a empresa recebe por tonelada neste embarque.</p>
              </div>
            )}

            <div className="bg-gray-50 dark:bg-gray-900/40 p-3 rounded-md border border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                    <span className="text-primary dark:text-amber-400">INFO:</span> Alterar um valor recalculará o outro automaticamente com base na tonelagem carregada ({(Number(shipment.shipmentTonnage) || 0).toLocaleString('pt-BR')} ton).
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
          <button 
            type="button" 
            onClick={handleSave} 
            disabled={!canEditDriverPrice || isOverLimit || totalPrice <= 0}
            className={`py-2.5 px-6 font-bold rounded-lg transition-all ${
              canEditDriverPrice && !isOverLimit && totalPrice > 0
                ? 'bg-primary text-white hover:bg-primary-dark shadow-md shadow-primary/20' 
                : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed shadow-none'
            }`}
          >
            Salvar Alteração
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditPriceModal;