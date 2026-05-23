
import React, { useMemo } from 'react';
import type { Cargo, Client, Product, User, FreightLeg } from '../types';
import VolumeBar from './VolumeBar';
import { PaperclipIcon } from './icons/PaperclipIcon';

interface CargoDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cargo: Cargo | null;
  client: Client | undefined;
  product: Product | undefined;
  commercialUser: User | undefined;
}

const DetailItem: React.FC<{ label: string; value?: string | number | null; children?: React.ReactNode }> = ({ label, value, children }) => (
    <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        {children || <p className="text-sm text-gray-800 dark:text-gray-200">{value ?? 'N/A'}</p>}
    </div>
);

const FreightLegDetail: React.FC<{ leg: FreightLeg; index: number }> = ({ leg, index }) => (
    <div className="p-4 border rounded-md dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex justify-between items-center mb-3">
            <h4 className="font-semibold text-gray-600 dark:text-gray-300">Perna {index + 1}</h4>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${leg.hasIcms ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' : 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200'}`}>
                ICMS: {leg.hasIcms ? `Sim (${leg.icmsPercentage}%)` : 'Não'}
            </span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
                <p className="text-xs text-gray-500">Frete Empresa</p>
                <p className="font-medium text-gray-800 dark:text-gray-200">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(leg.companyFreightValuePerTon)}</p>
            </div>
            <div>
                <p className="text-xs text-gray-500">Frete Motorista</p>
                <p className="font-medium text-gray-800 dark:text-gray-200">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(leg.driverFreightValuePerTon)}</p>
            </div>
        </div>
    </div>
);


const CargoDetailsModal: React.FC<CargoDetailsModalProps> = ({ isOpen, onClose, cargo, client, product, commercialUser }) => {
  if (!isOpen || !cargo) return null;

  const scheduledButNotLoaded = Math.max(0, cargo.scheduledVolume - cargo.loadedVolume);
  
  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const formatDate = (dateString: string) => new Date(dateString).toLocaleString('pt-BR');

  const freightLegsToDisplay = (cargo.freightLegs && cargo.freightLegs.length > 0)
    ? cargo.freightLegs
    : [{
        companyFreightValuePerTon: cargo.companyFreightValuePerTon,
        driverFreightValuePerTon: cargo.driverFreightValuePerTon,
        hasIcms: cargo.hasIcms,
        icmsPercentage: cargo.icmsPercentage,
      }];
      
  const { totalCompanyFreight, totalDriverFreight, netMarginPercentage } = useMemo(() => {
    const activeLegs = freightLegsToDisplay;

    const totalCompanyFreight = activeLegs.reduce((sum, leg) => sum + leg.companyFreightValuePerTon, 0);
    const totalDriverFreight = activeLegs.reduce((sum, leg) => sum + leg.driverFreightValuePerTon, 0);
    
    const totalNetCompanyValue = activeLegs.reduce((sum, leg) => {
        const icmsRate = leg.hasIcms ? leg.icmsPercentage / 100 : 0;
        const netValue = leg.companyFreightValuePerTon * (1 - icmsRate);
        return sum + netValue;
    }, 0);

    const netProfit = totalNetCompanyValue - totalDriverFreight;
    const margin = (totalNetCompanyValue > 0) ? (netProfit / totalNetCompanyValue) * 100 : 0;
    
    const netMarginPercentage = isNaN(margin) || !isFinite(margin)
        ? '0,00%'
        : `${margin.toFixed(2).replace('.', ',')}%`;

    return { totalCompanyFreight, totalDriverFreight, netMarginPercentage };
  }, [freightLegsToDisplay]);


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-start mb-4">
            <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Detalhes da Carga: {cargo.sequenceId}</h2>
                <p className="text-xs text-gray-400 font-mono">{cargo.id}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">&times;</button>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <DetailItem label="Cliente" value={client?.nomeFantasia} />
                <DetailItem label="Produto" value={product?.name} />
                <DetailItem label="Origem" value={cargo.origin} />
                <DetailItem label="Destino" value={cargo.destination} />
                {cargo.originMapLink && <DetailItem label="Link Mapa (Origem)"><a href={cargo.originMapLink} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 underline truncate">Abrir link</a></DetailItem>}
                {cargo.destinationMapLink && <DetailItem label="Link Mapa (Destino)"><a href={cargo.destinationMapLink} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 underline truncate">Abrir link</a></DetailItem>}
            </div>

            <div className="border-t dark:border-gray-700 pt-4">
                 <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Balanço de Volume (ton)</h3>
                 <VolumeBar
                    loaded={cargo.loadedVolume}
                    scheduled={scheduledButNotLoaded}
                    total={cargo.totalVolume}
                />
                <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                    <div className="p-2 bg-green-100/50 dark:bg-green-900/20 rounded">
                        <p className="text-xs text-green-700 dark:text-green-300">Carregado</p>
                        <p className="font-bold text-green-800 dark:text-green-200">{cargo.loadedVolume.toLocaleString('pt-BR')}</p>
                    </div>
                     <div className="p-2 bg-orange-100/50 dark:bg-orange-900/20 rounded">
                        <p className="text-xs text-orange-700 dark:text-orange-300">Agendado</p>
                        <p className="font-bold text-orange-800 dark:text-orange-200">{scheduledButNotLoaded.toLocaleString('pt-BR')}</p>
                    </div>
                     <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded">
                        <p className="text-xs text-gray-500">Total</p>
                        <p className="font-bold text-gray-800 dark:text-gray-200">{cargo.totalVolume.toLocaleString('pt-BR')}</p>
                    </div>
                </div>
            </div>

            <div className="border-t dark:border-gray-700 pt-4">
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Valores de Frete (por Tonelada)</h3>
                <div className="space-y-3">
                    {freightLegsToDisplay.map((leg, index) => (
                        <FreightLegDetail key={index} leg={leg} index={index} />
                    ))}
                </div>
                 <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Frete Empresa (Final)</label>
                        <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{formatCurrency(totalCompanyFreight)}</p>
                    </div>
                    <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Frete Motorista (Final)</label>
                        <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{formatCurrency(totalDriverFreight)}</p>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/50 rounded-md border border-blue-200 dark:border-blue-800">
                        <label className="text-xs font-medium text-blue-500 dark:text-blue-400">Margem Líquida (%)</label>
                        <p className="text-lg font-bold text-primary dark:text-blue-300">{netMarginPercentage}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t dark:border-gray-700 pt-4">
                <DetailItem label="Exige Agendamento" value={cargo.requiresScheduling ? 'Sim' : 'Não'} />
                <DetailItem label="Tipo de Carga" value={cargo.type} />
                <DetailItem label="Status da Carga" value={cargo.status} />
                <DetailItem label="Prazo de Carregamento" value={cargo.loadingDeadline ? new Date(cargo.loadingDeadline).toLocaleDateString('pt-BR') : 'N/A'} />
                <DetailItem label="Comercial Responsável" value={commercialUser?.name} />
                <DetailItem label="Data de Criação" value={formatDate(cargo.createdAt)} />
            </div>

            {cargo.observations && (
                <div className="border-t dark:border-gray-700 pt-4">
                    <DetailItem label="Observações">
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md">{cargo.observations}</p>
                    </DetailItem>
                </div>
            )}

            {cargo.attachments && cargo.attachments.length > 0 && (
                <div className="border-t dark:border-gray-700 pt-4">
                    <DetailItem label="Anexos">
                        <ul className="mt-1 space-y-2">
                            {cargo.attachments.map((fileName, index) => (
                                <li key={index}>
                                    <a href="#" onClick={(e) => e.preventDefault()} className="flex items-center text-sm text-blue-600 dark:text-blue-400 hover:underline">
                                        <PaperclipIcon className="w-4 h-4 mr-2" />
                                        {fileName}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </DetailItem>
                </div>
            )}

            {cargo.allowedVehicleTypes && cargo.allowedVehicleTypes.length > 0 && (
                <div className="border-t dark:border-gray-700 pt-4">
                    <DetailItem label="Tipos de Veículos Permitidos">
                        <div className="flex flex-wrap gap-2 mt-1">
                            {cargo.allowedVehicleTypes.map((vt, idx) => (
                                <span key={idx} className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                                    {vt.setType} ({vt.bodyTypes?.join('/') || ''})
                                </span>
                            ))}
                        </div>
                    </DetailItem>
                </div>
            )}




        </div>
        
        <div className="mt-6 flex justify-end border-t dark:border-gray-700 pt-4">
          <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default CargoDetailsModal;
