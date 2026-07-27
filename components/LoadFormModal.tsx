
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
import { formatCityState } from '../utils/formatters';
import DatePicker, { DateObject } from "react-multi-date-picker";

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
    destinations: [{
      id: Math.random().toString(36).substr(2, 9),
      city: '',
      location: '',
      mapLink: '',
      freightLegs: [
        { companyFreightValuePerTon: 0, driverFreightValuePerTon: 0, driverFreightValuePerTonPJ: 0, driverFreightValuePerTonPF: 0, hasIcms: false, icmsPercentage: 0 },
        { companyFreightValuePerTon: 0, driverFreightValuePerTon: 0, driverFreightValuePerTonPJ: 0, driverFreightValuePerTonPF: 0, hasIcms: false, icmsPercentage: 0 }
      ]
    }],
    totalVolume: 0,
    scheduledVolume: 0,
    loadedVolume: 0,
    companyFreightValuePerTon: 0,
    driverFreightValuePerTon: 0,
    hasIcms: false,
    icmsPercentage: 0,
    requiresScheduling: false,
    requiresTracker: false,
    type: CargoType.Spot,
    status: CargoStatus.EmAndamento,
    loadingStartDate: '',
    loadingDeadline: '',
    allowedVehicleTypes: DEFAULT_ALLOWED_VEHICLE_TYPES,
    freightLegs: [
      { companyFreightValuePerTon: 0, driverFreightValuePerTon: 0, driverFreightValuePerTonPJ: 0, driverFreightValuePerTonPF: 0, hasIcms: false, icmsPercentage: 0 },
      { companyFreightValuePerTon: 0, driverFreightValuePerTon: 0, driverFreightValuePerTonPJ: 0, driverFreightValuePerTonPF: 0, hasIcms: false, icmsPercentage: 0 }
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
  
  const [newScheduleDates, setNewScheduleDates] = useState<DateObject[]>([]);
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
            let initialDestinations = editableLoad.destinations;
            if (!initialDestinations || initialDestinations.length === 0) {
                const legs = editableLoad.freightLegs && editableLoad.freightLegs.length > 0
                    ? editableLoad.freightLegs.map(leg => ({
                        ...leg,
                        driverFreightValuePerTonPJ: leg.driverFreightValuePerTonPJ ?? leg.driverFreightValuePerTon,
                        driverFreightValuePerTonPF: leg.driverFreightValuePerTonPF ?? leg.driverFreightValuePerTon,
                        disableDriverFreightPF: leg.disableDriverFreightPF || false,
                      }))
                    : [{ companyFreightValuePerTon: editableLoad.companyFreightValuePerTon, driverFreightValuePerTon: editableLoad.driverFreightValuePerTon, driverFreightValuePerTonPJ: editableLoad.driverFreightValuePerTonPJ ?? editableLoad.driverFreightValuePerTon, driverFreightValuePerTonPF: editableLoad.driverFreightValuePerTonPF ?? editableLoad.driverFreightValuePerTon, hasIcms: editableLoad.hasIcms, icmsPercentage: editableLoad.icmsPercentage, disableDriverFreightPF: editableLoad.disableDriverFreightPF || false }];
                while (legs.length < 2) {
                    legs.push({ companyFreightValuePerTon: 0, driverFreightValuePerTon: 0, driverFreightValuePerTonPJ: 0, driverFreightValuePerTonPF: 0, hasIcms: false, icmsPercentage: 0, disableDriverFreightPF: false });
                }
                initialDestinations = [{
                    id: Math.random().toString(36).substr(2, 9),
                    city: editableLoad.destination || '',
                    location: editableLoad.destinationLocation || '',
                    mapLink: editableLoad.destinationMapLink || '',
                    freightLegs: legs
                }];
            } else {
                initialDestinations = initialDestinations.map(d => {
                    const legs = d.freightLegs && d.freightLegs.length > 0 ? d.freightLegs.map(leg => ({
                        ...leg,
                        driverFreightValuePerTonPJ: leg.driverFreightValuePerTonPJ ?? leg.driverFreightValuePerTon,
                        driverFreightValuePerTonPF: leg.driverFreightValuePerTonPF ?? leg.driverFreightValuePerTon,
                        disableDriverFreightPF: leg.disableDriverFreightPF || false,
                    })) : [{ companyFreightValuePerTon: 0, driverFreightValuePerTon: 0, driverFreightValuePerTonPJ: 0, driverFreightValuePerTonPF: 0, hasIcms: false, icmsPercentage: 0, disableDriverFreightPF: false }];
                    while (legs.length < 2) {
                        legs.push({ companyFreightValuePerTon: 0, driverFreightValuePerTon: 0, driverFreightValuePerTonPJ: 0, driverFreightValuePerTonPF: 0, hasIcms: false, icmsPercentage: 0, disableDriverFreightPF: false });
                    }
                    return { ...d, freightLegs: legs };
                });
            }
            
            setLoad({ 
                ...editableLoad, 
                destinations: initialDestinations,
                dailySchedule: editableLoad.dailySchedule || [],
                observations: editableLoad.observations || '',
                attachments: editableLoad.attachments || [],
                allowedVehicleTypes: editableLoad.allowedVehicleTypes || [],
                salespersonName: editableLoad.salespersonName || '',
                salespersonCommissionPerTon: editableLoad.salespersonCommissionPerTon || 0,
                originLocation: editableLoad.originLocation || '',
                branchId: editableLoad.branchId,
            });
            setHasMultiLeg(initialDestinations[0].freightLegs.length > 1 && initialDestinations[0].freightLegs[1].companyFreightValuePerTon > 0);
            setShowSalesperson(!!editableLoad.salespersonName);
        } else {
            const { scheduledVolume, loadedVolume, ...initialState } = getInitialState();
            let baseState = { ...initialState };
            
            if (loads && loads.length > 0) {
                const lastLoad = loads.reduce((prev, current) => (prev.sequenceId > current.sequenceId) ? prev : current);
                baseState = {
                    ...baseState,
                    clientId: lastLoad.clientId,
                    productId: lastLoad.productId,
                    origin: lastLoad.origin,
                    originLocation: lastLoad.originLocation,
                    originMapLink: lastLoad.originMapLink,
                    destination: lastLoad.destination,
                    destinationLocation: lastLoad.destinationLocation,
                    destinationMapLink: lastLoad.destinationMapLink,
                    destinations: lastLoad.destinations ? JSON.parse(JSON.stringify(lastLoad.destinations)) : baseState.destinations,
                    totalVolume: lastLoad.totalVolume,
                    companyFreightValuePerTon: lastLoad.companyFreightValuePerTon,
                    driverFreightValuePerTon: lastLoad.driverFreightValuePerTon,
                    driverFreightValuePerTonPJ: lastLoad.driverFreightValuePerTonPJ,
                    driverFreightValuePerTonPF: lastLoad.driverFreightValuePerTonPF,
                    hasIcms: lastLoad.hasIcms,
                    icmsPercentage: lastLoad.icmsPercentage,
                    requiresScheduling: lastLoad.requiresScheduling,
                    requiresTracker: lastLoad.requiresTracker || false,
                    type: lastLoad.type,
                    allowedVehicleTypes: lastLoad.allowedVehicleTypes ? JSON.parse(JSON.stringify(lastLoad.allowedVehicleTypes)) : baseState.allowedVehicleTypes,
                    freightLegs: lastLoad.freightLegs ? JSON.parse(JSON.stringify(lastLoad.freightLegs)) : baseState.freightLegs,
                    salespersonName: lastLoad.salespersonName,
                    salespersonCommissionPerTon: lastLoad.salespersonCommissionPerTon,
                    branchId: lastLoad.branchId || currentUser.branchId,
                    externalOrder: lastLoad.externalOrder ? JSON.parse(JSON.stringify(lastLoad.externalOrder)) : baseState.externalOrder,
                };
            }
            
            setLoad({ ...baseState, createdById: currentUser.id });
            
            if (baseState.destinations && baseState.destinations[0]?.freightLegs) {
                 setHasMultiLeg(baseState.destinations[0].freightLegs.length > 1 && baseState.destinations[0].freightLegs[1].companyFreightValuePerTon > 0);
            } else {
                 setHasMultiLeg(false);
            }
            setShowSalesperson(!!baseState.salespersonName);
        }
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, initialStep, currentUser]);
  
  const calculateDestinationTotals = (destination: any) => {
    const legs = destination?.freightLegs || [];
    const activeLegs = hasMultiLeg ? legs.slice(0, 2) : legs.slice(0, 1);

    const totalCompanyFreight = activeLegs.reduce((sum: number, leg: any) => sum + (leg.companyFreightValuePerTon || 0), 0);
    const totalDriverFreightPJ = activeLegs.reduce((sum: number, leg: any) => sum + (leg.driverFreightValuePerTonPJ ?? leg.driverFreightValuePerTon ?? 0), 0);
    const totalDriverFreightPF = activeLegs.reduce((sum: number, leg: any) => sum + (leg.driverFreightValuePerTonPF ?? leg.driverFreightValuePerTon ?? 0), 0);
    
    const totalNetCompanyValue = activeLegs.reduce((sum: number, leg: any) => {
        const icmsRate = leg.hasIcms ? (leg.icmsPercentage || 0) / 100 : 0;
        const netValue = (leg.companyFreightValuePerTon || 0) * (1 - icmsRate);
        return sum + netValue;
    }, 0);

    const commission = load.salespersonCommissionPerTon || 0;

    const calcMargin = (driverFreight: number) => {
        const profit = totalNetCompanyValue - driverFreight - commission;
        return (totalNetCompanyValue > 0) ? (profit / totalNetCompanyValue) * 100 : 0;
    };

    const marginPJ = calcMargin(totalDriverFreightPJ);
    const marginPF = calcMargin(totalDriverFreightPF);
    const formatMargin = (m: number) => isNaN(m) || !isFinite(m) ? '0,00%' : `${m.toFixed(2).replace('.', ',')}%`;

    return { totalCompanyFreight, totalDriverFreightPJ, totalDriverFreightPF, netMarginPercentagePJ: formatMargin(marginPJ), netMarginPercentagePF: formatMargin(marginPF), marginPJ, marginPF };
  };

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

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      if (name === 'origin') {
          setLoad(prev => ({ ...prev, [name]: formatCityState(value) }));
      }
  };

  const handleDestinationChange = (destIndex: number, field: string, value: string) => {
      setLoad(prev => {
          const newDests = [...(prev.destinations || [])];
          let finalValue: any = value;
          if (field === 'targetTonnage') {
              finalValue = parseFloat(value) || undefined;
          }
          newDests[destIndex] = { ...newDests[destIndex], [field]: finalValue };
          return { ...prev, destinations: newDests };
      });
  };

  const handleDestinationBlur = (destIndex: number, field: string, value: string) => {
      if (field === 'city') {
          setLoad(prev => {
              const newDests = [...(prev.destinations || [])];
              newDests[destIndex] = { ...newDests[destIndex], [field]: formatCityState(value) };
              return { ...prev, destinations: newDests };
          });
      }
  };

  const handleAddDestination = () => {
      setLoad(prev => ({
          ...prev,
          destinations: [
              ...(prev.destinations || []),
              {
                  id: Math.random().toString(36).substr(2, 9),
                  city: '',
                  location: '',
                  mapLink: '',
                  targetTonnage: undefined,
                  freightLegs: [
                      { companyFreightValuePerTon: 0, driverFreightValuePerTon: 0, driverFreightValuePerTonPJ: 0, driverFreightValuePerTonPF: 0, hasIcms: false, icmsPercentage: 0 },
                      { companyFreightValuePerTon: 0, driverFreightValuePerTon: 0, driverFreightValuePerTonPJ: 0, driverFreightValuePerTonPF: 0, hasIcms: false, icmsPercentage: 0 }
                  ]
              }
          ]
      }));
  };

  const handleRemoveDestination = (destIndex: number) => {
      setLoad(prev => ({
          ...prev,
          destinations: (prev.destinations || []).filter((_, i) => i !== destIndex)
      }));
  };

  const handleLegChange = (destIndex: number, legIndex: number, field: keyof FreightLeg, value: string | number | boolean) => {
    setLoad(prev => {
        const newDests = [...(prev.destinations || [])];
        const destToUpdate = { ...newDests[destIndex] };
        const newLegs = [...destToUpdate.freightLegs];
        const legToUpdate = { ...newLegs[legIndex] };
        
        let finalValue = value;
        if (field === 'companyFreightValuePerTon' || field === 'driverFreightValuePerTon' || field === 'driverFreightValuePerTonPJ' || field === 'driverFreightValuePerTonPF' || field === 'icmsPercentage') {
            finalValue = parseFloat(value as string) || 0;
        }

        (legToUpdate as any)[field] = finalValue;
        
        if (field === 'hasIcms' && value === false) {
            legToUpdate.icmsPercentage = 0;
        }
        
        newLegs[legIndex] = legToUpdate;
        destToUpdate.freightLegs = newLegs;
        newDests[destIndex] = destToUpdate;
        return { ...prev, destinations: newDests };
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

    const normalizedDestinations = (load.destinations || []).map(dest => {
        const activeLegs = hasMultiLeg ? dest.freightLegs.slice(0, 2) : dest.freightLegs.slice(0, 1);
        return {
            ...dest,
            freightLegs: activeLegs.map(leg => ({
                ...leg,
                driverFreightValuePerTonPJ: leg.driverFreightValuePerTonPJ ?? leg.driverFreightValuePerTon,
                driverFreightValuePerTonPF: leg.driverFreightValuePerTonPF ?? leg.driverFreightValuePerTon,
                disableDriverFreightPF: leg.disableDriverFreightPF || false,
            }))
        };
    });

    const firstDest = normalizedDestinations[0] || { city: '', location: '', mapLink: '', freightLegs: [] };
    const firstDestLegs = firstDest.freightLegs;
    const totalCompanyFreightCalc = firstDestLegs.reduce((sum, leg) => sum + leg.companyFreightValuePerTon, 0);
    const totalDriverFreightPJCalc = firstDestLegs.reduce((sum, leg) => sum + (leg.driverFreightValuePerTonPJ ?? leg.driverFreightValuePerTon), 0);
    const totalDriverFreightPFCalc = firstDestLegs.reduce((sum, leg) => sum + (leg.driverFreightValuePerTonPF ?? leg.driverFreightValuePerTon), 0);
    const isPFDisabled = firstDestLegs.some(leg => leg.disableDriverFreightPF);

    // Geocode origin and FIRST destination
    const [originCoords, destinationCoords] = await Promise.all([
        geocodeCity(load.origin),
        geocodeCity(firstDest.city)
    ]);

    // Auto-merge unadded vehicle types before saving
    let finalAllowedVehicleTypes = load.allowedVehicleTypes || [];
    if (currentBodyTypes.length > 0) {
        const existingIndex = finalAllowedVehicleTypes.findIndex(avt => avt.setType === currentSetType);
        if (existingIndex !== -1) {
            const updatedTypes = [...finalAllowedVehicleTypes];
            const existingEntry = updatedTypes[existingIndex];
            const newBodyTypes = [...new Set([...(existingEntry.bodyTypes || []), ...currentBodyTypes])];
            updatedTypes[existingIndex] = { ...existingEntry, bodyTypes: newBodyTypes };
            finalAllowedVehicleTypes = updatedTypes;
        } else {
            finalAllowedVehicleTypes = [...finalAllowedVehicleTypes, { setType: currentSetType, bodyTypes: currentBodyTypes }];
        }
    }

    const finalLoadData = {
        ...load,
        destinations: normalizedDestinations,
        destination: firstDest.city,
        destinationLocation: firstDest.location,
        destinationMapLink: firstDest.mapLink,
        companyFreightValuePerTon: totalCompanyFreightCalc,
        driverFreightValuePerTon: totalDriverFreightPJCalc, // legado: usa PJ como padrão
        driverFreightValuePerTonPJ: totalDriverFreightPJCalc,
        driverFreightValuePerTonPF: totalDriverFreightPFCalc,
        freightLegs: firstDestLegs,
        hasIcms: firstDestLegs[0]?.hasIcms || false,
        icmsPercentage: firstDestLegs[0]?.icmsPercentage || 0,
        originCoords: originCoords || undefined,
        destinationCoords: destinationCoords || undefined,
        allowedVehicleTypes: finalAllowedVehicleTypes,
        disableDriverFreightPF: isPFDisabled,
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
    if (!newScheduleDates || newScheduleDates.length === 0) {
        showToast('Por favor, selecione pelo menos uma data.', 'warning');
        return;
    }
    
    const datesStrings = newScheduleDates.map(d => `${d.year}-${String(d.month.number).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`);
    const alreadyScheduled = datesStrings.filter(d => (load.dailySchedule || []).some(e => e.date === d));
    
    if (alreadyScheduled.length > 0) {
        const formattedDates = alreadyScheduled.map(d => new Date(d + 'T12:00:00Z').toLocaleDateString('pt-BR'));
        showToast(`As seguintes datas já estão na programação: ${formattedDates.join(', ')}. Remova-as primeiro.`, 'warning');
        return;
    }

    if (!newScheduleTonnage || newScheduleTonnage <= 0) {
        showToast('A tonelagem estimada por dia deve ser maior que zero.', 'warning');
        return;
    }

    const newEntries: DailyScheduleEntry[] = datesStrings.map(dateStr => ({
        date: dateStr,
        type: newScheduleType,
        tonnage: newScheduleTonnage,
    }));

    setLoad(prev => ({
        ...prev,
        dailySchedule: [...(prev.dailySchedule || []), ...newEntries].sort((a,b) => a.date.localeCompare(b.date)),
    }));
    
    setNewScheduleDates([]);
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

  const leg1 = load.freightLegs?.[0] || { companyFreightValuePerTon: 0, driverFreightValuePerTon: 0, driverFreightValuePerTonPJ: 0, driverFreightValuePerTonPF: 0, hasIcms: false, icmsPercentage: 0 };
  const leg2 = load.freightLegs?.[1] || { companyFreightValuePerTon: 0, driverFreightValuePerTon: 0, driverFreightValuePerTonPJ: 0, driverFreightValuePerTonPF: 0, hasIcms: false, icmsPercentage: 0 };

  const getMarginColorClass = (m: number) => {
    if (isNaN(m) || !isFinite(m)) return 'text-gray-600 dark:text-gray-400 bg-gray-200 dark:bg-gray-700';
    if (m < 5) return 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/50';
    if (m < 6) return 'text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/50';
    if (m < 7) return 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50';
    return 'text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/50';
  };

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
                        <input name="origin" value={load.origin} onChange={handleChange} onBlur={handleBlur} placeholder="Cidade de Origem" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 mb-2" required list="cities-list" />
                        <input name="originLocation" value={load.originLocation ?? ''} onChange={handleChange} placeholder="Nome do Local (Ex: Fazenda...)" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 mb-2" />
                        <input name="originMapLink" value={load.originMapLink ?? ''} onChange={handleChange} placeholder="Link do Google Maps (Origem)" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                    
                    <div className="space-y-4 col-span-1 md:col-span-2">
                        <div className="flex items-center gap-2 mb-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Destino (Cidade e Local)</label>
                            <button 
                                type="button" 
                                onClick={handleAddDestination} 
                                className="flex items-center justify-center p-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-800/50 transition-colors"
                                title="Adicionar Destino"
                            >
                                <PlusIcon className="h-4 w-4" />
                            </button>
                        </div>
                        {(load.destinations || []).map((dest, idx) => (
                            <div key={dest.id} className="p-4 border rounded dark:border-gray-600 bg-gray-50 dark:bg-gray-900/30 relative">
                                {idx > 0 && (
                                    <button type="button" onClick={() => handleRemoveDestination(idx)} className="absolute top-2 right-2 text-red-500 hover:text-red-700">
                                        <XIcon className="h-4 w-4" />
                                    </button>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                                    <input value={dest.city} onChange={(e) => handleDestinationChange(idx, 'city', e.target.value)} onBlur={(e) => handleDestinationBlur(idx, 'city', e.target.value)} placeholder="Cidade de Destino" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required list="cities-list" />
                                    <input value={dest.location ?? ''} onChange={(e) => handleDestinationChange(idx, 'location', e.target.value)} placeholder="Nome do Local (Ex: Porto...)" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                                    <input value={dest.mapLink ?? ''} onChange={(e) => handleDestinationChange(idx, 'mapLink', e.target.value)} placeholder="Link do Google Maps" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                                    <input type="number" step="0.1" value={dest.targetTonnage ?? ''} onChange={(e) => handleDestinationChange(idx, 'targetTonnage', e.target.value)} placeholder="Saldo Entrega (ton)" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                                </div>
                            </div>
                        ))}
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
                            <input name="totalVolume" value={load.totalVolume || ''} onChange={handleChange} type="number" placeholder="Ex: 5000" className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" step="0.01"/>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Volume total contratado para a carga.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Data de Início do Carregamento</label>
                            <input name="loadingStartDate" value={load.loadingStartDate || ''} onChange={handleChange} type="date" className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600"/>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Prazo de Carregamento</label>
                            <input name="loadingDeadline" value={load.loadingDeadline || ''} onChange={handleChange} type="date" className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600"/>
                          </div>
                        </div>
                    </div>
                    <div className="col-span-1 md:col-span-2 flex items-center space-x-6 pt-4">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          name="requiresScheduling" 
                          checked={load.requiresScheduling || false} 
                          onChange={handleChange} 
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" 
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Exige Agendamento</span>
                      </label>
                      
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          name="requiresTracker" 
                          checked={load.requiresTracker || false} 
                          onChange={handleChange} 
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" 
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Precisa de Rastreador</span>
                      </label>
                    </div>
                 </div>
            </div>
          )}
          {step === 2 && (
             <div className="space-y-6">
                 <div>
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Adicionar Nova Programação</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-md dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 items-end">
                       <div className="flex flex-col">
                         <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Datas</label>
                         <DatePicker
                           multiple
                           value={newScheduleDates}
                           onChange={setNewScheduleDates}
                           format="DD/MM/YYYY"
                           placeholder="Selecione as datas..."
                           containerClassName="w-full mt-1"
                           inputClass="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                         />
                       </div>
                       <div>
                         <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Demanda</label>
                         <select value={newScheduleType} onChange={(e) => setNewScheduleType(e.target.value as DailyScheduleType)} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600">
                           {Object.values(DailyScheduleType).map(type => <option key={type} value={type}>{type}</option>)}
                         </select>
                       </div>
                       <div>
                            <input type="number" value={newScheduleTonnage || ''} onChange={(e) => setNewScheduleTonnage(parseFloat(e.target.value) || undefined)} placeholder="Toneladas" className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" step="0.01"/>
                       </div>
                       <div className="md:col-span-3">
                         <button type="button" onClick={handleAddSchedule} className="w-full py-2 bg-primary text-white rounded-lg hover:bg-primary-dark">Adicionar à Timeline</button>
                       </div>
                    </div>
                 </div>
                 
                 <div className="border-t dark:border-gray-600 pt-4 mt-4">
                     <label className="flex items-center space-x-2 cursor-pointer w-fit">
                         <input type="checkbox" name="requiresScheduling" checked={load.requiresScheduling} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                         <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Exige Agendamento</span>
                     </label>
                     {load.requiresScheduling && (
                         <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                             <div>
                                 <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Link do Sistema Externo</label>
                                 <input
                                     value={load.externalOrder?.link || ''}
                                     onChange={(e) => setLoad(prev => ({ ...prev, externalOrder: { ...prev.externalOrder!, link: e.target.value } }))}
                                     className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
                                     placeholder="https://..."
                                 />
                             </div>
                             <div>
                                 <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Usuário</label>
                                 <input
                                     value={load.externalOrder?.user || ''}
                                     onChange={(e) => setLoad(prev => ({ ...prev, externalOrder: { ...prev.externalOrder!, user: e.target.value } }))}
                                     className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
                                     placeholder="Login do sistema"
                                 />
                             </div>
                             <div>
                                 <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Senha</label>
                                 <input
                                     value={load.externalOrder?.password || ''}
                                     onChange={(e) => setLoad(prev => ({ ...prev, externalOrder: { ...prev.externalOrder!, password: e.target.value } }))}
                                     className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
                                     placeholder="Senha"
                                 />
                             </div>
                         </div>
                     )}
                 </div>

                 <div className="border-t dark:border-gray-600 pt-4 mt-4">
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Timeline de Programação</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {(load.dailySchedule || []).length > 0 ? (
                            (load.dailySchedule || []).map(entry => (
                                <div key={entry.date} className="flex justify-between items-center p-2 border rounded-md dark:border-gray-600">
                                    <div>
                                        <p className="font-semibold text-gray-800 dark:text-gray-200">{new Date(entry.date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">{entry.type} ({entry.tonnage} ton)</p>
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
                    {/* Loop through destinations */}
                    {(load.destinations || []).map((dest, destIdx) => {
                        const leg1 = dest.freightLegs?.[0] || { companyFreightValuePerTon: 0, driverFreightValuePerTon: 0, driverFreightValuePerTonPJ: 0, driverFreightValuePerTonPF: 0, hasIcms: false, icmsPercentage: 0 };
                        const leg2 = dest.freightLegs?.[1] || { companyFreightValuePerTon: 0, driverFreightValuePerTon: 0, driverFreightValuePerTonPJ: 0, driverFreightValuePerTonPF: 0, hasIcms: false, icmsPercentage: 0 };
                        return (
                            <div key={dest.id} className="mt-6 border-t dark:border-gray-700 pt-4">
                                <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2">Destino: {dest.city || `Destino ${destIdx + 1}`}</h4>
                                {/* Leg 1 */}
                                <div className="p-4 border rounded-md dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-semibold text-gray-600 dark:text-gray-300">Perna 1</h4>
                                        <label className="flex items-center space-x-2 cursor-pointer">
                                            <input type="checkbox" checked={leg1.hasIcms} onChange={(e) => handleLegChange(destIdx, 0, 'hasIcms', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">Incide ICMS</span>
                                        </label>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Frete Empresa (R$/ton)</label>
                                                <input value={leg1.companyFreightValuePerTon || ''} onChange={(e) => handleLegChange(destIdx, 0, 'companyFreightValuePerTon', e.target.value)} type="number" placeholder="0,00" className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" step="0.01"/>
                                            </div>
                                            {leg1.hasIcms && (
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">ICMS (%)</label>
                                                    <input value={leg1.icmsPercentage || ''} onChange={(e) => handleLegChange(destIdx, 0, 'icmsPercentage', e.target.value)} type="number" placeholder="%" className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" step="0.01"/>
                                                </div>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                             <div>
                                                 <label className="block text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">Frete Motorista PJ (R$/ton)</label>
                                                 <input value={(leg1.driverFreightValuePerTonPJ !== undefined ? leg1.driverFreightValuePerTonPJ : '') || ''} onChange={(e) => handleLegChange(destIdx, 0, 'driverFreightValuePerTonPJ', e.target.value)} type="number" placeholder="0,00" className="p-2 w-full border border-emerald-200 dark:border-emerald-800 rounded dark:bg-gray-700" step="0.01"/>
                                             </div>
                                             <div>
                                                 <div className="flex justify-between items-center mb-1">
                                                     <label className={`block text-xs font-medium ${leg1.disableDriverFreightPF ? 'text-gray-400 line-through' : 'text-orange-600 dark:text-orange-400'}`}>
                                                         Frete Motorista PF (R$/ton)
                                                     </label>
                                                     <label className="flex items-center space-x-1 cursor-pointer">
                                                         <input 
                                                             type="checkbox" 
                                                             checked={!!leg1.disableDriverFreightPF} 
                                                             onChange={(e) => {
                                                                 handleLegChange(destIdx, 0, 'disableDriverFreightPF', e.target.checked);
                                                                 if (e.target.checked) {
                                                                     handleLegChange(destIdx, 0, 'driverFreightValuePerTonPF', 0);
                                                                 }
                                                             }} 
                                                             className="h-3.5 w-3.5 rounded border-gray-300 text-orange-600 focus:ring-orange-500" 
                                                         />
                                                         <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Desabilitar</span>
                                                     </label>
                                                 </div>
                                                 <input 
                                                     value={leg1.disableDriverFreightPF ? 'N/A' : (leg1.driverFreightValuePerTonPF !== undefined ? leg1.driverFreightValuePerTonPF : '') || ''} 
                                                     onChange={(e) => handleLegChange(destIdx, 0, 'driverFreightValuePerTonPF', e.target.value)} 
                                                     type={leg1.disableDriverFreightPF ? 'text' : 'number'} 
                                                     disabled={!!leg1.disableDriverFreightPF}
                                                     placeholder="0,00" 
                                                     className={`p-2 w-full border rounded dark:bg-gray-700 ${leg1.disableDriverFreightPF ? 'bg-gray-100 border-gray-200 text-gray-400 dark:bg-gray-800 dark:border-gray-700 cursor-not-allowed' : 'border-orange-200 dark:border-orange-800'}`} 
                                                     step="0.01"
                                                 />
                                             </div>
                                         </div>
                                     </div>
                                 </div>
                                 {/* Leg 2 */}
                                 {hasMultiLeg && (
                                     <div className="mt-4 p-4 border rounded-md dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                                         <div className="flex justify-between items-center mb-3"><h4 className="font-semibold text-gray-600 dark:text-gray-300">Perna 2</h4>
                                             <label className="flex items-center space-x-2 cursor-pointer">
                                                 <input type="checkbox" checked={leg2.hasIcms} onChange={(e) => handleLegChange(destIdx, 1, 'hasIcms', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                                                 <span className="text-sm text-gray-700 dark:text-gray-300">Incide ICMS</span>
                                             </label>
                                         </div>
                                         <div className="space-y-3">
                                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                 <div>
                                                     <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Frete Empresa (R$/ton)</label>
                                                     <input value={leg2.companyFreightValuePerTon || ''} onChange={(e) => handleLegChange(destIdx, 1, 'companyFreightValuePerTon', e.target.value)} type="number" placeholder="0,00" className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" step="0.01"/>
                                                 </div>
                                                 {leg2.hasIcms && (
                                                     <div>
                                                         <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">ICMS (%)</label>
                                                         <input value={leg2.icmsPercentage || ''} onChange={(e) => handleLegChange(destIdx, 1, 'icmsPercentage', e.target.value)} type="number" placeholder="%" className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" step="0.01"/>
                                                     </div>
                                                 )}
                                             </div>
                                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                 <div>
                                                     <label className="block text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">Frete Motorista PJ (R$/ton)</label>
                                                     <input value={(leg2.driverFreightValuePerTonPJ !== undefined ? leg2.driverFreightValuePerTonPJ : '') || ''} onChange={(e) => handleLegChange(destIdx, 1, 'driverFreightValuePerTonPJ', e.target.value)} type="number" placeholder="0,00" className="p-2 w-full border border-emerald-200 dark:border-emerald-800 rounded dark:bg-gray-700" step="0.01"/>
                                                 </div>
                                                 <div>
                                                     <div className="flex justify-between items-center mb-1">
                                                         <label className={`block text-xs font-medium ${leg2.disableDriverFreightPF ? 'text-gray-400 line-through' : 'text-orange-600 dark:text-orange-400'}`}>
                                                             Frete Motorista PF (R$/ton)
                                                         </label>
                                                         <label className="flex items-center space-x-1 cursor-pointer">
                                                             <input 
                                                                 type="checkbox" 
                                                                 checked={!!leg2.disableDriverFreightPF} 
                                                                 onChange={(e) => {
                                                                     handleLegChange(destIdx, 1, 'disableDriverFreightPF', e.target.checked);
                                                                     if (e.target.checked) {
                                                                         handleLegChange(destIdx, 1, 'driverFreightValuePerTonPF', 0);
                                                                     }
                                                                 }} 
                                                                 className="h-3.5 w-3.5 rounded border-gray-300 text-orange-600 focus:ring-orange-500" 
                                                             />
                                                             <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Desabilitar</span>
                                                         </label>
                                                     </div>
                                                     <input 
                                                         value={leg2.disableDriverFreightPF ? 'N/A' : (leg2.driverFreightValuePerTonPF !== undefined ? leg2.driverFreightValuePerTonPF : '') || ''} 
                                                         onChange={(e) => handleLegChange(destIdx, 1, 'driverFreightValuePerTonPF', e.target.value)} 
                                                         type={leg2.disableDriverFreightPF ? 'text' : 'number'} 
                                                         disabled={!!leg2.disableDriverFreightPF}
                                                         placeholder="0,00" 
                                                         className={`p-2 w-full border rounded dark:bg-gray-700 ${leg2.disableDriverFreightPF ? 'bg-gray-100 border-gray-200 text-gray-400 dark:bg-gray-800 dark:border-gray-700 cursor-not-allowed' : 'border-orange-200 dark:border-orange-800'}`} 
                                                         step="0.01"
                                                     />
                                                 </div>
                                             </div>
                                         </div>
                                     </div>
                                 )}
                        {/* Totals */}
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Frete Empresa (Total)</label>
                                <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{calculateDestinationTotals(dest).totalCompanyFreight.toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}</p>
                            </div>
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-md border border-emerald-200 dark:border-emerald-800">
                                <label className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Frete PJ / Margem PJ</label>
                                <div className="flex items-center justify-between">
                                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{calculateDestinationTotals(dest).totalDriverFreightPJ.toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}</p>
                                    <span
                                      className={`text-xs font-bold px-2 py-1 rounded ${getMarginColorClass(calculateDestinationTotals(dest).marginPJ)}`}
                                      title={(load.salespersonCommissionPerTon || 0) > 0 ? `Margem já deduz comissão de R$ ${(load.salespersonCommissionPerTon || 0).toFixed(2)}/ton` : 'Margem PJ'}
                                    >{calculateDestinationTotals(dest).netMarginPercentagePJ}</span>
                                </div>
                            </div>
                            {!(dest.freightLegs?.some((leg: any) => leg.disableDriverFreightPF)) ? (
                                <div className="p-3 bg-orange-50 dark:bg-orange-900/30 rounded-md border border-orange-200 dark:border-orange-800">
                                    <label className="text-xs font-medium text-orange-600 dark:text-orange-400">Frete PF / Margem PF</label>
                                    <div className="flex items-center justify-between">
                                        <p className="text-lg font-bold text-orange-700 dark:text-orange-300">{calculateDestinationTotals(dest).totalDriverFreightPF.toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}</p>
                                        <span
                                          className={`text-xs font-bold px-2 py-1 rounded ${getMarginColorClass(calculateDestinationTotals(dest).marginPF)}`}
                                          title={(load.salespersonCommissionPerTon || 0) > 0 ? `Margem já deduz comissão de R$ ${(load.salespersonCommissionPerTon || 0).toFixed(2)}/ton` : 'Margem PF'}
                                        >{calculateDestinationTotals(dest).netMarginPercentagePF}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 opacity-60 flex flex-col justify-between">
                                    <label className="text-xs font-medium text-gray-500">Frete PF / Margem PF</label>
                                    <div className="flex items-center justify-between mt-1">
                                        <p className="text-lg font-bold text-gray-400">Desabilitado</p>
                                    </div>
                                </div>
                            )}
                            {(load.salespersonCommissionPerTon || 0) > 0 && (
                                <div className="md:col-span-3 flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-md">
                                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400">Com. Vendedor Externo:</span>
                                    <span className="text-xs font-bold text-purple-700 dark:text-purple-300">- {(load.salespersonCommissionPerTon || 0).toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}/ton</span>
                                    <span className="text-[10px] text-purple-500 dark:text-purple-400 ml-1">(deduzida das margens acima)</span>
                                </div>
                            )}
                        </div>
                            </div>
                        );
                    })}
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
                            <p className="mt-2 text-xs text-purple-600 dark:text-purple-400 font-medium italic bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded px-2 py-1">
                                ⚠️ A comissão é deduzida diretamente das margens de lucro (PJ e PF) e tratada como custo do frete.
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
