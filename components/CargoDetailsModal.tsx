
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

const FreightLegDetail: React.FC<{ leg: FreightLeg; index: number }> = ({ leg, index }) => {
    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    const pj = leg.driverFreightValuePerTonPJ ?? leg.driverFreightValuePerTon;
    const pf = leg.driverFreightValuePerTonPF ?? leg.driverFreightValuePerTon;
    return (
        <div className="p-4 border rounded-md dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-gray-600 dark:text-gray-300">Perna {index + 1}</h4>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${leg.hasIcms ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' : 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200'}`}>
                    ICMS: {leg.hasIcms ? `Sim (${leg.icmsPercentage}%)` : 'Não'}
                </span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                    <p className="text-xs text-gray-500">Frete Empresa</p>
                    <p className="font-medium text-gray-800 dark:text-gray-200">{fmt(leg.companyFreightValuePerTon)}</p>
                </div>
                <div>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">Frete Motor. PJ</p>
                    <p className="font-medium text-emerald-700 dark:text-emerald-300">{fmt(pj)}</p>
                </div>
                {!leg.disableDriverFreightPF ? (
                    <div>
                        <p className="text-xs text-orange-600 dark:text-orange-400">Frete Motor. PF</p>
                        <p className="font-medium text-orange-700 dark:text-orange-300">{fmt(pf)}</p>
                    </div>
                ) : (
                    <div>
                        <p className="text-xs text-gray-400">Frete Motor. PF</p>
                        <p className="font-medium text-gray-400">Desabilitado</p>
                    </div>
                )}
            </div>
        </div>
    );
};


const CargoDetailsModal: React.FC<CargoDetailsModalProps> = ({ isOpen, onClose, cargo, client, product, commercialUser }) => {
  if (!isOpen || !cargo) return null;

  const scheduledButNotLoaded = Math.max(0, cargo.scheduledVolume - cargo.loadedVolume);
  
  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const formatDate = (dateString: string) => new Date(dateString).toLocaleString('pt-BR');

  const freightLegsToDisplay = (cargo.destinations && cargo.destinations.length > 0 && cargo.destinations[0].freightLegs?.length > 0)
    ? cargo.destinations[0].freightLegs
    : (cargo.freightLegs && cargo.freightLegs.length > 0)
      ? cargo.freightLegs
      : [{
          companyFreightValuePerTon: cargo.companyFreightValuePerTon,
          driverFreightValuePerTon: cargo.driverFreightValuePerTon,
          hasIcms: cargo.hasIcms,
          icmsPercentage: cargo.icmsPercentage,
        }];
      
  const { totalCompanyFreight, totalDriverFreightPJ, totalDriverFreightPF, netMarginPercentagePJ, netMarginPercentagePF, marginPJ, marginPF } = useMemo(() => {
    const activeLegs = freightLegsToDisplay;

    const totalCompanyFreight = activeLegs.reduce((sum, leg) => sum + leg.companyFreightValuePerTon, 0);
    const totalDriverFreightPJ = activeLegs.reduce((sum, leg) => sum + (leg.driverFreightValuePerTonPJ ?? leg.driverFreightValuePerTon), 0);
    const totalDriverFreightPF = activeLegs.reduce((sum, leg) => sum + (leg.driverFreightValuePerTonPF ?? leg.driverFreightValuePerTon), 0);
    
    const totalNetCompanyValue = activeLegs.reduce((sum, leg) => {
        const icmsRate = leg.hasIcms ? leg.icmsPercentage / 100 : 0;
        const netValue = leg.companyFreightValuePerTon * (1 - icmsRate);
        return sum + netValue;
    }, 0);

    const calcMargin = (driverFreight: number) => {
        const profit = totalNetCompanyValue - driverFreight;
        return (totalNetCompanyValue > 0) ? (profit / totalNetCompanyValue) * 100 : 0;
    };
    
    const marginPJ = calcMargin(totalDriverFreightPJ);
    const marginPF = calcMargin(totalDriverFreightPF);
    const formatMargin = (m: number) => isNaN(m) || !isFinite(m) ? '0,00%' : `${m.toFixed(2).replace('.', ',')}%`;

    return { totalCompanyFreight, totalDriverFreightPJ, totalDriverFreightPF, netMarginPercentagePJ: formatMargin(marginPJ), netMarginPercentagePF: formatMargin(marginPF), marginPJ, marginPF };
  }, [freightLegsToDisplay]);

  const isPFDisabled = useMemo(() => {
    return freightLegsToDisplay.some(leg => leg.disableDriverFreightPF);
  }, [freightLegsToDisplay]);

  const getMarginColorClass = (m: number) => {
    if (isNaN(m) || !isFinite(m)) return 'text-gray-600 dark:text-gray-400 bg-gray-200 dark:bg-gray-700';
    if (m < 5) return 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/50';
    if (m < 6) return 'text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/50';
    if (m < 7) return 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50';
    return 'text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/50';
  };


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
                {cargo.originMapLink && <DetailItem label="Link Mapa (Origem)"><a href={cargo.originMapLink} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 underline truncate">Abrir link</a></DetailItem>}
                <div className="col-span-1 md:col-span-2 mt-2">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Destinos</p>
                    <div className="space-y-2">
                        {cargo.destinations?.map((dest, idx) => (
                            <div key={dest.id || idx} className="flex flex-col sm:flex-row gap-2 text-sm text-gray-800 dark:text-gray-200">
                                <span className="font-medium">- {dest.city}</span>
                                {dest.location && <span className="text-gray-500">({dest.location})</span>}
                                {dest.tmsBatchNumber && <span className="text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">| Lote TMS: {dest.tmsBatchNumber}</span>}
                                {dest.mapLink && <a href={dest.mapLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline ml-2">Mapa</a>}
                            </div>
                        )) || (
                            <div className="flex flex-col sm:flex-row gap-2 text-sm text-gray-800 dark:text-gray-200">
                                <span className="font-medium">- {cargo.destination}</span>
                                {cargo.tmsBatchNumber && <span className="text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">| Lote TMS: {cargo.tmsBatchNumber}</span>}
                                {cargo.destinationMapLink && <a href={cargo.destinationMapLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline ml-2">Mapa</a>}
                            </div>
                        )}
                    </div>
                </div>
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
                {(cargo.destinations || []).map((dest, destIdx) => (
                    <div key={dest.id || destIdx} className="mb-6">
                        <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2">Destino: {dest.city}</h4>
                        <div className="space-y-3">
                            {dest.freightLegs?.map((leg, index) => (
                                <FreightLegDetail key={index} leg={leg} index={index} />
                            ))}
                        </div>
                    </div>
                ))}
                {(!cargo.destinations || cargo.destinations.length === 0) && (
                    <div className="space-y-3">
                        {freightLegsToDisplay.map((leg, index) => (
                            <FreightLegDetail key={index} leg={leg} index={index} />
                        ))}
                    </div>
                )}
                 <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Frete Empresa (1º Destino)</label>
                        <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{formatCurrency(totalCompanyFreight)}</p>
                    </div>
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-md border border-emerald-200 dark:border-emerald-800 flex flex-col justify-between">
                        <label className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Frete PJ / Margem PJ (1º Destino)</label>
                        <div className="flex items-center justify-between mt-1">
                            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(totalDriverFreightPJ)}</p>
                            <span className={`text-xs font-bold px-2 py-1 rounded ${getMarginColorClass(marginPJ)}`}>{netMarginPercentagePJ}</span>
                        </div>
                    </div>
                    {!isPFDisabled ? (
                        <div className="p-3 bg-orange-50 dark:bg-orange-900/30 rounded-md border border-orange-200 dark:border-orange-800 flex flex-col justify-between">
                            <label className="text-xs font-medium text-orange-600 dark:text-orange-400">Frete PF / Margem PF (1º Destino)</label>
                            <div className="flex items-center justify-between mt-1">
                                <p className="text-lg font-bold text-orange-700 dark:text-orange-300">{formatCurrency(totalDriverFreightPF)}</p>
                                <span className={`text-xs font-bold px-2 py-1 rounded ${getMarginColorClass(marginPF)}`}>{netMarginPercentagePF}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 opacity-60 flex flex-col justify-between">
                            <label className="text-xs font-medium text-gray-500">Frete PF / Margem PF (1º Destino)</label>
                            <div className="flex items-center justify-between mt-1">
                                <p className="text-lg font-bold text-gray-400">Desabilitado</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t dark:border-gray-700 pt-4">
                <DetailItem label="Exige Agendamento" value={cargo.requiresScheduling ? 'Sim' : 'Não'} />
                <DetailItem label="Precisa de Rastreador" value={cargo.requiresTracker ? 'Sim' : 'Não'} />
                <DetailItem label="Tipo de Carga" value={cargo.type} />
                <DetailItem label="Status da Carga" value={cargo.status} />
                <DetailItem label="Prazo de Carregamento" value={cargo.loadingDeadline ? new Date(cargo.loadingDeadline).toLocaleDateString('pt-BR') : 'N/A'} />
                <DetailItem label="Comercial Responsável" value={commercialUser?.name} />
                <DetailItem label="Data de Criação" value={formatDate(cargo.createdAt)} />
            </div>

            {cargo.requiresScheduling && cargo.externalOrder && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t dark:border-gray-700 pt-4">
                    <DetailItem label="Link do Sistema Externo">
                        {cargo.externalOrder.link ? (
                            <a href={cargo.externalOrder.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
                                {cargo.externalOrder.link}
                            </a>
                        ) : 'N/A'}
                    </DetailItem>
                    <DetailItem label="Usuário" value={cargo.externalOrder.user || 'N/A'} />
                    <DetailItem label="Senha" value={cargo.externalOrder.password || 'N/A'} />
                </div>
            )}

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

            {cargo.requiresScheduling && (
                <div className="border-t dark:border-gray-700 pt-4">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Ordem Externa / Agendamento</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <DetailItem label="Link do Sistema Externo">
                            {cargo.externalOrder?.link ? (
                                <a href={cargo.externalOrder.link.startsWith('http') ? cargo.externalOrder.link : `https://${cargo.externalOrder.link}`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all">
                                    {cargo.externalOrder.link}
                                </a>
                            ) : (
                                <span className="text-sm text-gray-800 dark:text-gray-200">N/A</span>
                            )}
                        </DetailItem>
                        <DetailItem label="Usuário" value={cargo.externalOrder?.user || 'N/A'} />
                        <DetailItem label="Senha" value={cargo.externalOrder?.password || 'N/A'} />
                    </div>
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
