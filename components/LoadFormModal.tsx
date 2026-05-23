
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Cargo, Client, Product, User, FreightLeg, DailyScheduleEntry, Branch } from '../types';
import { CargoStatus, CargoType, UserProfile, VehicleSetType, VehicleBodyType, DailyScheduleType } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { XIcon } from './icons/XIcon';
import { PaperclipIcon } from './icons/PaperclipIcon';
import { UserPlusIcon } from './icons/UserPlusIcon';
import { BRAZILIAN_CITIES } from '../brazilianCities';
import { geocodeCity } from '../utils/geocoding';
import { useToast } from '../hooks/useToast';

interface LoadFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (load: Cargo | Omit<Cargo, 'id' | 'history' | 'createdAt' | 'createdById'>) => void;
  loadToEdit: Cargo | null;
  clients: Client[];
  products: Product[];
  currentUser: User;
  users: User[];
  loads: Cargo[];
  branches: Branch[];
  initialStep?: number;
}

const STEPS = ['Informações da Carga', 'Programação Diária', 'Valores e Regras'];

const DEFAULT_ALLOWED_VEHICLE_TYPES = Object.values(VehicleSetType).map(setType => ({
    setType,
    bodyTypes: Object.values(VehicleBodyType)
}));

const LoadFormModal: React.FC<LoadFormModalProps> = ({ isOpen, onClose, onSave, loadToEdit, clients, products, currentUser, users, loads, branches, initialStep = 1 }) => {
  const getInitialState = (): Omit<Cargo, 'id' | 'history' | 'createdAt' | 'createdById'> => {
    const newSequenceId = loads.length > 0 ? Math.max(...loads.map(c => c.sequenceId)) + 1 : 101;
    return ({
    sequenceId: newSequenceId,
    clientId: clients[0]?.id || '',
    productId: products[0]?.id || '',
    origin: '',
    originLocation: '',
    originMapLink: '',
    destination: '',
    destinationLocation: '',
    destinationMapLink: '',
    totalVolume: 0,
    scheduledVolume: 0,
    loadedVolume: 0,
    companyFreightValuePerTon: 0,
    driverFreightValuePerTon: 0,
    hasIcms: false,
    icmsPercentage: 0,
    requiresScheduling: false,
    type: CargoType.Spot,
    status: CargoStatus.EmAndamento,
    loadingDeadline: '',
    allowedVehicleTypes: DEFAULT_ALLOWED_VEHICLE_TYPES,
    freightLegs: [
      { companyFreightValuePerTon: 0, driverFreightValuePerTon: 0, hasIcms: false, icmsPercentage: 0 },
      { companyFreightValuePerTon: 0, driverFreightValuePerTon: 0, hasIcms: false, icmsPercentage: 0 }
    ],
    dailySchedule: [],
    observations: '',
    attachments: [],
    salespersonCommissionPerTon: 0,
    branchId: currentUser.branchId,
  })};
  
  const [step, setStep] = useState(initialStep);
  const [load, setLoad] = useState<Omit<Cargo, 'id' | 'history' | 'createdAt' | 'createdById' | 'scheduledVolume' | 'loadedVolume'> & { createdById?: string }>(getInitialState());
  const [hasMultiLeg, setHasMultiLeg] = useState(false);
  const [showSalesperson, setShowSalesperson] = useState(false);
  
  const [newScheduleDate, setNewScheduleDate] = useState('');
  const [newScheduleType, setNewScheduleType] = useState<DailyScheduleType>(DailyScheduleType.Livre);
  const [newScheduleTonnage, setNewScheduleTonnage] = useState<number | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State for the new allowed vehicle types UI
  const [currentSetType, setCurrentSetType] = useState<VehicleSetType>(VehicleSetType.LSSimples);
  const [currentBodyTypes, setCurrentBodyTypes] = useState<VehicleBodyType[]>([]);
  const { showToast } = useToast();

  const commercialUsers = useMemo(() => {
    return users.filter(u => u.profile === UserProfile.Comercial);
  }, [users]);

  const prevIsOpen = useRef(isOpen);

  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
        setStep(initialStep);
        if (loadToEdit) {
            const { history, createdAt, id, scheduledVolume, loadedVolume, ...editableLoad } = loadToEdit;
            const legs = editableLoad.freightLegs && editableLoad.freightLegs.length > 0
                ? [...editableLoad.freightLegs]
                : [{ companyFreightValuePerTon: editableLoad.companyFreightValuePerTon, driverFreightValuePerTon: editableLoad.driverFreightValuePerTon, hasIcms: editableLoad.hasIcms, icmsPercentage: editableLoad.icmsPercentage }];
            
            while (legs.length < 2) {
                legs.push({ companyFreightValuePerTon: 0, driverFreightValuePerTon: 0, hasIcms: false, icmsPercentage: 0 });
            }
            
            setLoad({ 
                ...editableLoad, 
                freightLegs: legs, 
                dailySchedule: editableLoad.dailySchedule || [],
                observations: editableLoad.observations || '',
                attachments: editableLoad.attachments || [],
                allowedVehicleTypes: editableLoad.allowedVehicleTypes || [],
                salespersonName: editableLoad.salespersonName || '',
                salespersonCommissionPerTon: editableLoad.salespersonCommissionPerTon || 0,
                originLocation: editableLoad.originLocation || '',
                destinationLocation: editableLoad.destinationLocation || '',
                branchId: editableLoad.branchId,
            });
            setHasMultiLeg(editableLoad.freightLegs ? editableLoad.freightLegs.length > 1 : false);
            setShowSalesperson(!!editableLoad.salespersonName);
        } else {
            const { scheduledVolume, loadedVolume, ...initialState } = getInitialState();
            setLoad({ ...initialState, createdById: currentUser.id });
            setHasMultiLeg(false);
            setShowSalesperson(false);
        }
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, initialStep, currentUser]);
  
  const { totalCompanyFreight, totalDriverFreight, netMarginPercentage } = useMemo(() => {
    const legs = load.freightLegs || [];
    const activeLegs = hasMultiLeg ? legs.slice(0, 2) : legs.slice(0, 1);

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
  }, [load.freightLegs, hasMultiLeg]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
        const checked = (e.target as HTMLInputElement).checked;
        setLoad(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
        setLoad(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    }
    else {
        setLoad(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleLegChange = (index: number, field: keyof FreightLeg, value: string | number | boolean) => {
    setLoad(prev => {
        const newLegs = [...(prev.freightLegs || [])];
        const legToUpdate = { ...newLegs[index] };
        
        let finalValue = value;
        if (field === 'companyFreightValuePerTon' || field === 'driverFreightValuePerTon' || field === 'icmsPercentage') {
            finalValue = parseFloat(value as string) || 0;
        }

        (legToUpdate as any)[field] = finalValue;
        
        if (field === 'hasIcms' && value === false) {
            legToUpdate.icmsPercentage = 0;
        }
        
        newLegs[index] = legToUpdate;
        return { ...prev, freightLegs: newLegs };
    });
  };
  
  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files) {
          const newFileNames = Array.from(files).map((file: File) => file.name);
          setLoad(prev => ({
              ...prev,
              attachments: [...(prev.attachments || []), ...newFileNames.filter(name => !(prev.attachments || []).includes(name))]
          }));
      }
      e.target.value = '';
  };

  const handleRemoveAttachment = (fileName: string) => {
      setLoad(prev => ({
          ...prev,
          attachments: (prev.attachments || []).filter(name => name !== fileName)
      }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const activeLegs = hasMultiLeg ? (load.freightLegs || []).slice(0, 2) : (load.freightLegs || []).slice(0, 1);

    // Geocode origin and destination
    const [originCoords, destinationCoords] = await Promise.all([
        geocodeCity(load.origin),
        geocodeCity(load.destination)
    ]);

    const finalLoadData = {
        ...load,
        companyFreightValuePerTon: totalCompanyFreight,
        driverFreightValuePerTon: totalDriverFreight,
        freightLegs: activeLegs,
        hasIcms: activeLegs[0]?.hasIcms || false,
        icmsPercentage: activeLegs[0]?.icmsPercentage || 0,
        originCoords: originCoords || undefined,
        destinationCoords: destinationCoords || undefined,
    };

    if (loadToEdit) {
      onSave({
        ...loadToEdit, 
        ...finalLoadData,
        scheduledVolume: loadToEdit.scheduledVolume,
        loadedVolume: loadToEdit.loadedVolume,
      });
    } else {
      onSave({
        ...finalLoadData,
        scheduledVolume: 0,
        loadedVolume: 0,
      });
    }
  };
  
  const handleAddSchedule = () => {
    if (!newScheduleDate) {
        showToast('Por favor, selecione uma data.', 'warning');
        return;
    }
    if ((load.dailySchedule || []).some(e => e.date === newScheduleDate)) {
        showToast('Já existe uma programação para esta data. Remova a antiga primeiro.', 'warning');
        return;
    }
    if (newScheduleType === DailyScheduleType.Fixo && (!newScheduleTonnage || newScheduleTonnage <= 0)) {
        showToast('Para Demanda Fixa, a tonelagem deve ser maior que zero.', 'warning');
        return;
    }

    const newEntry: DailyScheduleEntry = {
        date: newScheduleDate,
        type: newScheduleType,
        tonnage: newScheduleType === DailyScheduleType.Fixo ? newScheduleTonnage : undefined,
    };

    setLoad(prev => ({
        ...prev,
        dailySchedule: [...(prev.dailySchedule || []), newEntry].sort((a,b) => a.date.localeCompare(b.date)),
    }));
    
    setNewScheduleDate('');
    setNewScheduleType(DailyScheduleType.Livre);
    setNewScheduleTonnage(undefined);
  };

  const handleRemoveSchedule = (dateToRemove: string) => {
      setLoad(prev => ({
          ...prev,
          dailySchedule: (prev.dailySchedule || []).filter(e => e.date !== dateToRemove),
      }));
  };

  const handleToggleBodyType = (bt: VehicleBodyType) => {
    setCurrentBodyTypes(prev => 
        prev.includes(bt) ? prev.filter(p => p !== bt) : [...prev, bt]
    );
  };
  
  const handleAddAllowedType = () => {
    if (currentBodyTypes.length === 0) {
        showToast("Selecione ao menos um tipo de carroceria.", 'warning');
        return;
    }
    setLoad(prev => {
        const allowedTypes = prev.allowedVehicleTypes || [];
        const existingIndex = allowedTypes.findIndex(avt => avt.setType === currentSetType);
        
        if (existingIndex !== -1) {
            // Update existing entry by merging body types
            const updatedTypes = [...allowedTypes];
            const existingEntry = updatedTypes[existingIndex];
            const newBodyTypes = [...new Set([...(existingEntry.bodyTypes || []), ...currentBodyTypes])];
            updatedTypes[existingIndex] = { ...existingEntry, bodyTypes: newBodyTypes };
            return { ...prev, allowedVehicleTypes: updatedTypes };
        } else {
            // Add new entry
            return {
                ...prev,
                allowedVehicleTypes: [
                    ...(prev.allowedVehicleTypes || []),
                    { setType: currentSetType, bodyTypes: currentBodyTypes }
                ]
            };
        }
    });
    setCurrentBodyTypes([]);
  };

  const handleRemoveAllowedType = (setTypeToRemove: VehicleSetType) => {
      setLoad(prev => ({
          ...prev,
          allowedVehicleTypes: prev.allowedVehicleTypes?.filter(avt => avt.setType !== setTypeToRemove)
      }));
  };


  const nextStep = () => setStep(s => Math.min(s + 1, STEPS.length));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  if (!isOpen) return null;

  const leg1 = load.freightLegs?.[0] || { companyFreightValuePerTon: 0, driverFreightValuePerTon: 0, hasIcms: false, icmsPercentage: 0 };
  const leg2 = load.freightLegs?.[1] || { companyFreightValuePerTon: 0, driverFreightValuePerTon: 0, hasIcms: false, icmsPercentage: 0 };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-4xl w-full max-h-[90vh] flex flex-col">
        <h2 className="text-2xl font-bold mb-2 text-gray-800 dark:text-white">{loadToEdit ? 'Editar Carga' : 'Nova Carga'}</h2>

        {/* Stepper */}
        <div className="mb-6 flex items-center justify-center border-b dark:border-gray-700 pb-4">
            {STEPS.map((s, i) => (
                <React.Fragment key={s}>
                    <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${i + 1 <= step ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                            {i + 1}
                        </div>
                        <span className={`ml-3 text-sm font-medium ${i + 1 <= step ? 'text-gray-800 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{s}</span>
                    </div>
                    {i < STEPS.length - 1 && <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700 mx-4"></div>}
                </React.Fragment>
            ))}
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-6 pr-2">
          {step === 1 && (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cliente Tomador</label>
                    <select name="clientId" value={load.clientId} onChange={handleChange} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" required>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.nomeFantasia}</option>)}
                    </select>
                    </div>

                    
                    <div className="space-y-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Origem (Cidade e Local)</label>
                        <input name="origin" value={load.origin} onChange={handleChange} placeholder="Cidade de Origem" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 mb-2" required list="cities-list" />
                        <input name="originLocation" value={load.originLocation ?? ''} onChange={handleChange} placeholder="Nome do Local (Ex: Fazenda...)" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 mb-2" />
                        <input name="originMapLink" value={load.originMapLink ?? ''} onChange={handleChange} placeholder="Link do Google Maps (Origem)" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                    
                    <div className="space-y-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Destino (Cidade e Local)</label>
                        <input name="destination" value={load.destination} onChange={handleChange} placeholder="Cidade de Destino" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 mb-2" required list="cities-list" />
                        <input name="destinationLocation" value={load.destinationLocation ?? ''} onChange={handleChange} placeholder="Nome do Local (Ex: Porto...)" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 mb-2" />
                        <input name="destinationMapLink" value={load.destinationMapLink ?? ''} onChange={handleChange} placeholder="Link do Google Maps (Destino)" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                    </div>

                    <datalist id="cities-list">
                        {BRAZILIAN_CITIES.map(city => <option key={city} value={city} />)}
                    </datalist>
                </div>

                <div className="border-t dark:border-gray-600 pt-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Observações</label>
                        <textarea
                            name="observations"
                            value={load.observations || ''}
                            onChange={handleChange}
                            placeholder="Adicione qualquer observação relevante sobre a carga..."
                            className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600"
                            rows={3}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Anexos</label>
                        <div className="mt-1">
                            <input
                                type="file"
                                multiple
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <button
                                type="button"
                                onClick={handleAttachmentClick}
                                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                            >
                                <PaperclipIcon className="w-4 h-4" />
                                Anexar Arquivos
                            </button>
                        </div>
                        {(load.attachments && load.attachments.length > 0) && (
                            <ul className="mt-2 space-y-1">
                                {load.attachments.map((fileName, index) => (
                                    <li key={index} className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/50 p-2 rounded-md">
                                        <span>{fileName}</span>
                                        <button type="button" onClick={() => handleRemoveAttachment(fileName)} className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400">
                                            <XIcon className="w-4 h-4" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                 <div className="border-t dark:border-gray-600 pt-4">
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Detalhes do Volume e Prazo</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Volume Total (ton)</label>
                            <input name="totalVolume" value={load.totalVolume} onChange={handleChange} type="number" placeholder="Ex: 5000" className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" step="0.01"/>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Volume total contratado para a carga.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Prazo de Carregamento</label>
                            <input name="loadingDeadline" value={load.loadingDeadline || ''} onChange={handleChange} type="date" className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600"/>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Prazo final para o carregamento do lote.</p>
                        </div>
                    </div>
                 </div>
            </div>
          )}
          {step === 2 && (
             <div className="space-y-6">
                 <div>
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Adicionar Nova Programação</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-md dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 items-end">
                       <div>
                         <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Data</label>
                         <input type="date" value={newScheduleDate} onChange={(e) => setNewScheduleDate(e.target.value)} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600"/>
                       </div>
                       <div>
                         <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Demanda</label>
                         <select value={newScheduleType} onChange={(e) => setNewScheduleType(e.target.value as DailyScheduleType)} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600">
                           {Object.values(DailyScheduleType).map(type => <option key={type} value={type}>{type}</option>)}
                         </select>
                       </div>
                       <div>
                         {newScheduleType === DailyScheduleType.Fixo && (
                            <input type="number" value={newScheduleTonnage || ''} onChange={(e) => setNewScheduleTonnage(parseFloat(e.target.value) || undefined)} placeholder="Toneladas" className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" step="0.01"/>
                         )}
                       </div>
                       <div className="md:col-span-3">
                         <button type="button" onClick={handleAddSchedule} className="w-full py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">Adicionar à Timeline</button>
                       </div>
                    </div>
                 </div>
                 
                 <div>
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Timeline de Programação</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {(load.dailySchedule || []).length > 0 ? (
                            (load.dailySchedule || []).map(entry => (
                                <div key={entry.date} className="flex justify-between items-center p-2 border rounded-md dark:border-gray-600">
                                    <div>
                                        <p className="font-semibold text-gray-800 dark:text-gray-200">{new Date(entry.date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">{entry.type} {entry.type === DailyScheduleType.Fixo ? `(${entry.tonnage} ton)` : ''}</p>
                                    </div>
                                    <button type="button" onClick={() => handleRemoveSchedule(entry.date)} className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400"><XIcon className="w-5 h-5"/></button>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">Nenhuma programação diária definida.</p>
                        )}
                    </div>
                 </div>
             </div>
          )}
          {step === 3 && (
            <div className="space-y-6">
                <div className="border-t dark:border-gray-600 pt-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Valores de Frete (por Tonelada)</h3>
                        <button type="button" onClick={() => setHasMultiLeg(prev => !prev)} className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark dark:text-blue-400 dark:hover:text-blue-300">
                            {hasMultiLeg ? (<><XIcon className="h-4 w-4" /><span>Remover Perna</span></>) : (<><PlusIcon className="h-4 w-4" /><span>Adicionar Perna</span></>)}
                        </button>
                    </div>
                    {/* Leg 1 */}
                    <div className="p-4 border rounded-md dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-semibold text-gray-600 dark:text-gray-300">Perna 1</h4>
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input type="checkbox" checked={leg1.hasIcms} onChange={(e) => handleLegChange(0, 'hasIcms', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">Incide ICMS</span>
                            </label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <input value={leg1.companyFreightValuePerTon} onChange={(e) => handleLegChange(0, 'companyFreightValuePerTon', e.target.value)} type="number" placeholder="Frete Empresa" className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" step="0.01"/>
                            {leg1.hasIcms && <input value={leg1.icmsPercentage} onChange={(e) => handleLegChange(0, 'icmsPercentage', e.target.value)} type="number" placeholder="ICMS (%)" className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" step="0.01"/>}
                            <input value={leg1.driverFreightValuePerTon} onChange={(e) => handleLegChange(0, 'driverFreightValuePerTon', e.target.value)} type="number" placeholder="Frete Motorista" className={`p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600 ${leg1.hasIcms ? '' : 'md:col-start-3'}`} step="0.01"/>
                        </div>
                    </div>
                    {/* Leg 2 */}
                    {hasMultiLeg && (
                        <div className="mt-4 p-4 border rounded-md dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                            <div className="flex justify-between items-center mb-3"><h4 className="font-semibold text-gray-600 dark:text-gray-300">Perna 2</h4>
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input type="checkbox" checked={leg2.hasIcms} onChange={(e) => handleLegChange(1, 'hasIcms', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                                    <span className="text-sm text-gray-700 dark:text-gray-300">Incide ICMS</span>
                                </label>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <input value={leg2.companyFreightValuePerTon} onChange={(e) => handleLegChange(1, 'companyFreightValuePerTon', e.target.value)} type="number" placeholder="Frete Empresa" className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" step="0.01"/>
                                {leg2.hasIcms && <input value={leg2.icmsPercentage} onChange={(e) => handleLegChange(1, 'icmsPercentage', e.target.value)} type="number" placeholder="ICMS (%)" className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" step="0.01"/>}
                                <input value={leg2.driverFreightValuePerTon} onChange={(e) => handleLegChange(1, 'driverFreightValuePerTon', e.target.value)} type="number" placeholder="Frete Motorista" className={`p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600 ${leg2.hasIcms ? '' : 'md:col-start-3'}`} step="0.01"/>
                            </div>
                        </div>
                    )}
                    {/* Totals */}
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-md"><label className="text-xs font-medium text-gray-500 dark:text-gray-400">Frete Empresa (Final)</label><p className="text-lg font-bold text-gray-800 dark:text-gray-200">{totalCompanyFreight.toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}</p></div>
                        <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-md"><label className="text-xs font-medium text-gray-500 dark:text-gray-400">Frete Motorista (Final)</label><p className="text-lg font-bold text-gray-800 dark:text-gray-200">{totalDriverFreight.toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}</p></div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/50 rounded-md border border-blue-200 dark:border-blue-800"><label className="text-xs font-medium text-blue-500 dark:text-blue-400">Margem Líquida (%)</label><p className="text-lg font-bold text-primary dark:text-blue-300">{netMarginPercentage}</p></div>
                    </div>
                </div>

                {/* Vendedor Externo Section */}
                <div className="border-t dark:border-gray-600 pt-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Comissão de Vendedor Externo</h3>
                        {!showSalesperson && (
                            <button 
                                type="button" 
                                onClick={() => setShowSalesperson(true)}
                                className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark dark:text-blue-400"
                            >
                                <UserPlusIcon className="h-4 w-4" />
                                <span>Adicionar Vendedor</span>
                            </button>
                        )}
                    </div>

                    {showSalesperson && (
                        <div className="p-4 border rounded-md dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="font-semibold text-gray-600 dark:text-gray-300">Dados do Vendedor</h4>
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setShowSalesperson(false);
                                        setLoad(prev => ({ ...prev, salespersonName: '', salespersonCommissionPerTon: 0 }));
                                    }}
                                    className="text-xs text-red-500 hover:text-red-700"
                                >
                                    Remover
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nome do Vendedor</label>
                                    <input 
                                        name="salespersonName" 
                                        value={load.salespersonName || ''} 
                                        onChange={handleChange} 
                                        placeholder="Ex: João da Silva" 
                                        className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Comissão (R$/Ton)</label>
                                    <input 
                                        name="salespersonCommissionPerTon" 
                                        value={load.salespersonCommissionPerTon || ''} 
                                        onChange={handleChange} 
                                        type="number" 
                                        placeholder="Ex: 2,00" 
                                        className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" 
                                        step="0.01"
                                    />
                                </div>
                            </div>
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">
                                * A comissão será calculada automaticamente com base na tonelagem carregada nos embarques desta carga.
                            </p>
                        </div>
                    )}
                </div>
                 <div className="border-t dark:border-gray-600 pt-4">
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Tipos de Veículos Permitidos</h3>
                    {/* New UI for allowed vehicle types */}
                    <div className="p-4 border rounded-md dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Conjunto</label>
                                <select value={currentSetType} onChange={(e) => setCurrentSetType(e.target.value as VehicleSetType)} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600">
                                    {Object.values(VehicleSetType).map(st => <option key={st} value={st}>{st}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Carrocerias</label>
                                <div className="flex gap-4 mt-2">
                                    {Object.values(VehicleBodyType).map(bt => (
                                        <label key={bt} className="flex items-center space-x-2 cursor-pointer">
                                            <input type="checkbox" checked={currentBodyTypes.includes(bt)} onChange={() => handleToggleBodyType(bt)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"/>
                                            <span className="text-sm text-gray-700 dark:text-gray-300">{bt}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <button type="button" onClick={handleAddAllowedType} className="w-full py-2 bg-primary-dark text-white rounded-lg hover:bg-primary">Adicionar Regra</button>
                    </div>
                    {/* Display added types */}
                    {(load.allowedVehicleTypes && load.allowedVehicleTypes.length > 0) && (
                        <div className="mt-4 space-y-2">
                            {load.allowedVehicleTypes.map(avt => (
                                <div key={avt.setType} className="flex justify-between items-center p-2 bg-blue-100/50 dark:bg-blue-900/20 rounded-md">
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                        <span className="font-bold">{avt.setType}:</span> {avt.bodyTypes?.join(', ') || ''}
                                    </p>
                                    <button type="button" onClick={() => handleRemoveAllowedType(avt.setType)} className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400"><XIcon className="w-4 h-4"/></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {currentUser.profile === UserProfile.Admin && (
                    <div className="border-t dark:border-gray-600 pt-4">
                        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Administração</h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Comercial Responsável</label>
                            <select name="createdById" value={load.createdById} onChange={handleChange} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600">{commercialUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
                        </div>
                    </div>
                )}
                <div className="border-t dark:border-gray-600 pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Produto</label>
                        <select name="productId" value={load.productId} onChange={handleChange} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" required>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status da Carga</label>
                        <select name="status" value={load.status} onChange={handleChange} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600">{Object.values(CargoStatus).map(s => <option key={s} value={s}>{s}</option>)}</select>
                    </div>
                    <div className="col-span-1 md:col-span-2 flex items-center space-x-6"><label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" name="requiresScheduling" checked={load.requiresScheduling} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" /><span className="text-sm text-gray-700 dark:text-gray-300">Exige Agendamento</span></label></div>
                </div>
            </div>
          )}
        </form>

        <div className="mt-8 flex justify-between items-center border-t dark:border-gray-700 pt-4">
            <div>
                {step > 1 && <button type="button" onClick={prevStep} className="py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Anterior</button>}
            </div>
            <div className="flex items-center space-x-4">
                <button type="button" onClick={onClose} className="py-2 px-4 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">Cancelar</button>
                {step < STEPS.length && <button type="button" onClick={nextStep} className="py-2 px-4 bg-primary text-white rounded-lg hover:bg-primary-dark">Próximo</button>}
                {step === STEPS.length && <button type="submit" onClick={handleSubmit} className="py-2 px-4 bg-primary text-white rounded-lg hover:bg-primary-dark">Salvar Carga</button>}
            </div>
        </div>
      </div>
    </div>
  );
};

export default LoadFormModal;
