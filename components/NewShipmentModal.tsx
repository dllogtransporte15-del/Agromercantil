
import React, { useState, useEffect, useMemo } from 'react';
import type { Cargo, Driver, Shipment, Client, Vehicle, User } from '../types';
import { UserProfile, DailyScheduleType, VehicleSetType, VehicleBodyType } from '../types';
import { supabase } from '../supabase';
import { useToast } from '../hooks/useToast';
import { formatCpfCnpj, formatPhone } from '../utils/formatters';


interface NewShipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (shipmentData: any) => void;
  cargo: Cargo | null;
  drivers: Driver[];
  clients: Client[];
  vehicles: Vehicle[];
  currentUser: User | null;
  shipments: Shipment[];
  users: User[];
}

const NewShipmentModal: React.FC<NewShipmentModalProps> = ({ isOpen, onClose, onSave, cargo, drivers, clients, vehicles, currentUser, shipments, users }) => {
  const [driverName, setDriverName] = useState('');
  const [driverCpf, setDriverCpf] = useState('');
  const [ownerContact, setOwnerContact] = useState('');
  const [horsePlate, setHorsePlate] = useState('');
  const [trailer1Plate, setTrailer1Plate] = useState('');
  const [trailer2Plate, setTrailer2Plate] = useState('');
  const [trailer3Plate, setTrailer3Plate] = useState('');
  const [shipmentTonnage, setShipmentTonnage] = useState<number>(0);
  const [driverContact, setDriverContact] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [embarcadorId, setEmbarcadorId] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [vehicleSetType, setVehicleSetType] = useState<VehicleSetType | ''>('');
  const [vehicleBodyType, setVehicleBodyType] = useState<VehicleBodyType | ''>('');
  const [bankDetails, setBankDetails] = useState('');
  const [vehicleTag, setVehicleTag] = useState('');
  const [filesToAttach, setFilesToAttach] = useState<File[]>([]);
  const [driverReferences, setDriverReferences] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [freightType, setFreightType] = useState<'PJ' | 'PF' | null>(null);
  const { showToast } = useToast();

  const handleScanDocument = async (files: File[]) => {
    if (files.length === 0) {
        showToast('Selecione um arquivo primeiro.', 'warning');
        return;
    }
    
    setIsScanning(true);
    try {
        for (const file of files) {
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve) => {
                reader.onload = () => {
                    const base64 = (reader.result as string).split(',')[1];
                    resolve(base64);
                };
            });
            reader.readAsDataURL(file);
            const base64Image = await base64Promise;

            const { data, error } = await supabase.functions.invoke('process-document', {
                body: { image: base64Image, fileType: file.type }
            });

            if (error) throw error;

            if (data) {
                if (data.driverName) setDriverName(data.driverName);
                if (data.driverCpf) setDriverCpf(data.driverCpf);
                if (data.horsePlate) setHorsePlate(data.horsePlate.toUpperCase());
                if (data.trailerPlates && Array.isArray(data.trailerPlates)) {
                    if (data.trailerPlates[0]) setTrailer1Plate(data.trailerPlates[0].toUpperCase());
                    if (data.trailerPlates[1]) setTrailer2Plate(data.trailerPlates[1].toUpperCase());
                    if (data.trailerPlates[2]) setTrailer3Plate(data.trailerPlates[2].toUpperCase());
                }
                
                let refs = driverReferences;
                if (data.driverCnh) refs += `\nCNH: ${data.driverCnh}`;
                if (data.ownerName) refs += `\nProprietário: ${data.ownerName}`;
                if (data.ownerCpfCnpj) refs += `\nCPF/CNPJ Proprietário: ${data.ownerCpfCnpj}`;
                setDriverReferences(refs.trim());
            }
        }
        showToast('Digitalização concluída! Por favor, revise os campos preenchidos.', 'success');
    } catch (err: any) {
        console.error('Erro ao digitalizar:', err);
        showToast(`Erro na Digitalização: ${err.message || 'Ocorreu um erro ao processar o documento.'}\n\nCertifique-se de que a GEMINI_API_KEY está configurada no Supabase.`, 'error');
    } finally {
        setIsScanning(false);
    }
  };

  const embarcadores = useMemo(() => {
    return users.filter(u => u.profile === UserProfile.Embarcador);
  }, [users]);

  const prevIsOpen = React.useRef(isOpen);

  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      setDriverName('');
      setDriverCpf('');
      setOwnerContact('');
      setHorsePlate('');
      setTrailer1Plate('');
      setTrailer2Plate('');
      setTrailer3Plate('');
      setShipmentTonnage(0);
      setDriverContact('');
      setScheduledDate('');
      setScheduledTime('');
      setSelectedVehicle(null);
      setVehicleSetType('');
      setVehicleBodyType('');
      setBankDetails('');
      setVehicleTag('');
      setFilesToAttach([]);
      setDriverReferences('');
      setFreightType(cargo?.disableDriverFreightPF ? 'PJ' : null);
      setEmbarcadorId(
          currentUser?.profile === UserProfile.Embarcador
              ? currentUser.id
              : ''
      );
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, currentUser, cargo]);

    // Driver selection & Autofill logic
  const [lastAlertedDriverId, setLastAlertedDriverId] = useState<string>('');
  const [lastAutofilledDriverId, setLastAutofilledDriverId] = useState<string>('');
  const [lastAutofilledPlate, setLastAutofilledPlate] = useState<string>('');

  useEffect(() => {
    const cleanName = driverName.trim().toLowerCase();
    const cleanCpf = driverCpf.replace(/\D/g, '');

    const driverByName = cleanName ? drivers.find(d => d.name.trim().toLowerCase() === cleanName) : undefined;
    const driverByCpf = cleanCpf.length === 11 ? drivers.find(d => d.cpf.replace(/\D/g, '') === cleanCpf) : undefined;

    const selectedDriver = driverByName || driverByCpf;

    if (selectedDriver) {
        // Sync Fields
        if (driverByName && selectedDriver.cpf && selectedDriver.cpf.replace(/\D/g, '') !== cleanCpf && !driverCpf) {
            setDriverCpf(selectedDriver.cpf);
        } else if (driverByCpf && selectedDriver.name.trim().toLowerCase() !== cleanName && !driverName) {
            setDriverName(selectedDriver.name);
        }

        setDriverContact(selectedDriver.phone || '');

        // Instant Restriction Alert
        if (!selectedDriver.active && lastAlertedDriverId !== selectedDriver.id) {
            showToast(`ATENÇÃO: Este motorista encontra-se RESTRITO! Motivo: ${selectedDriver.restrictionReason || 'Sem motivo especificado'}. O sistema impedirá a criação desta ordem.`, 'error', 10000);
            setLastAlertedDriverId(selectedDriver.id);
        } else if (selectedDriver.active) {
            setLastAlertedDriverId(''); 
        }

        // History Autofill
        if (lastAutofilledDriverId !== selectedDriver.id && selectedDriver.active) {
            const selectedCleanCpf = selectedDriver.cpf ? selectedDriver.cpf.replace(/\D/g, '') : '';
            const lastShipment = shipments
                .filter(s => 
                    (s.driverCpf && s.driverCpf.replace(/\D/g, '') === selectedCleanCpf) || 
                    (s.driverName.trim().toLowerCase() === selectedDriver.name.trim().toLowerCase())
                )
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

            if (lastShipment) {
                setHorsePlate(lastShipment.horsePlate || '');
                setTrailer1Plate(lastShipment.trailer1Plate || '');
                setTrailer2Plate(lastShipment.trailer2Plate || '');
                setTrailer3Plate(lastShipment.trailer3Plate || '');
                setOwnerContact(lastShipment.ownerContact || '');
                setBankDetails(lastShipment.bankDetails || '');
                setVehicleTag(lastShipment.vehicleTag || '');
            }
            setLastAutofilledDriverId(selectedDriver.id);
        } else if (!selectedDriver.active) {
            setLastAutofilledDriverId(selectedDriver.id); // Prevent repeated alerts/lookups if restricted
        }
    } else {
        setLastAutofilledDriverId('');
        setLastAlertedDriverId('');
    }
  }, [driverName, driverCpf, drivers, shipments, lastAlertedDriverId, lastAutofilledDriverId]);
  
  useEffect(() => {
    const cleanPlate = horsePlate.trim().toLowerCase();
    const vehicle = vehicles.find(v => v.plate.trim().toLowerCase() === cleanPlate);
    setSelectedVehicle(vehicle || null);
    
    if (vehicle) {
        setVehicleSetType(vehicle.setType);
        setVehicleBodyType(vehicle.bodyType);
    } else {
        setVehicleSetType('');
        setVehicleBodyType('');
    }

    if (cleanPlate && cleanPlate.length >= 7 && lastAutofilledPlate !== cleanPlate) {
        const lastShipmentByPlate = shipments
            .filter(s => s.horsePlate && s.horsePlate.trim().toLowerCase() === cleanPlate)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

        if (lastShipmentByPlate) {
            setTrailer1Plate(lastShipmentByPlate.trailer1Plate || '');
            setTrailer2Plate(lastShipmentByPlate.trailer2Plate || '');
            setTrailer3Plate(lastShipmentByPlate.trailer3Plate || '');
        }
        setLastAutofilledPlate(cleanPlate);
    } else if (!cleanPlate) {
        setLastAutofilledPlate('');
    }
  }, [horsePlate, vehicles, shipments, lastAutofilledPlate]);


  const calculatedFreightPJ = useMemo(() => {
    if (!cargo || shipmentTonnage <= 0) return 0;
    return (cargo?.driverFreightValuePerTonPJ ?? cargo?.driverFreightValuePerTon ?? 0) * shipmentTonnage;
  }, [cargo, shipmentTonnage]);
  const calculatedFreightPF = useMemo(() => {
    if (!cargo || shipmentTonnage <= 0) return 0;
    return (cargo?.driverFreightValuePerTonPF ?? cargo?.driverFreightValuePerTon ?? 0) * shipmentTonnage;
  }, [cargo, shipmentTonnage]);
  const calculatedFreight = freightType === 'PF' ? calculatedFreightPF : calculatedFreightPJ;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cargo) return;

    // Check for Restricted Driver
    const selectedDriverObj = drivers.find(d => 
        (d.name.trim().toLowerCase() === driverName.trim().toLowerCase() && driverName.trim() !== '') || 
        (d.cpf.replace(/\D/g, '') === driverCpf.replace(/\D/g, '') && driverCpf.trim() !== '')
    );

    if (selectedDriverObj && !selectedDriverObj.active) {
        showToast(`Motorista com Restrição: ${selectedDriverObj.restrictionReason || 'Sem motivo especificado'}. Não é permitido criar ordens para este motorista.`, 'error');
        return;
    }

    if (!driverName || !horsePlate || shipmentTonnage <= 0 || !scheduledDate || !embarcadorId || !scheduledTime) {
        showToast('Por favor, preencha todos os campos obrigatórios do formulário.', 'warning');
        return;
    }

    if (!freightType) {
        showToast('Selecione o tipo de frete do motorista: PJ ou PF.', 'warning');
        return;
    }
    
    const isNewDriver = !drivers.find(d => d.name.trim().toLowerCase() === driverName.trim().toLowerCase());
    if (isNewDriver && !driverCpf) {
        showToast('Para novos motoristas, o CPF é obrigatório.', 'warning');
        return;
    }
    
    let vehicleInfo: { setType?: VehicleSetType | '', bodyType?: VehicleBodyType | '' };

    if (selectedVehicle) {
        vehicleInfo = selectedVehicle;
    } else {
        if (!vehicleSetType || !vehicleBodyType) {
            showToast('Para novos veículos, o Tipo de Veículo e Carroceria são obrigatórios.', 'warning');
            return;
        }
        vehicleInfo = { setType: vehicleSetType, bodyType: vehicleBodyType };
    }

    if (cargo?.allowedVehicleTypes && cargo.allowedVehicleTypes.length > 0 && vehicleInfo.setType && vehicleInfo.bodyType) {
        const isAllowed = cargo.allowedVehicleTypes.some(allowed => 
            allowed.setType === vehicleInfo.setType && (allowed.bodyTypes || []).includes(vehicleInfo.bodyType as VehicleBodyType)
        );
        if (!isAllowed) {
            showToast(`O tipo do veículo selecionado (${vehicleInfo.setType} - ${vehicleInfo.bodyType}) não é permitido para esta carga.`, 'error');
            return;
        }
    }

    if (cargo?.dailySchedule) {
        const scheduleRule = cargo.dailySchedule.find(rule => rule.date === scheduledDate);
        if (!scheduleRule) {
            showToast('Não é permitido criar ordens para datas sem programação lançada na carga. Verifique a Data Programada.', 'error');
            return;
        }

        if (scheduleRule.type === DailyScheduleType.Verificar) {
            showToast('Atenção: A programação para este dia exige verificação com o comercial antes de marcar.', 'warning');
        } else if (scheduleRule.type === DailyScheduleType.Fixo && scheduleRule.tonnage) {
            const alreadyScheduledTonnage = shipments
                .filter(s => s.cargoId === cargo.id && s.scheduledDate === scheduledDate)
                .reduce((sum, s) => sum + s.shipmentTonnage, 0);
            
            if (alreadyScheduledTonnage + shipmentTonnage > scheduleRule.tonnage) {
                showToast(`Erro: A tonelagem para este dia excede o limite programado de ${scheduleRule.tonnage} ton. Já existem ${alreadyScheduledTonnage} ton programadas.`, 'error');
                return;
            }
        }
    }

    // Validation: Only allow future date/time
    const now = new Date();
    const inputDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    if (inputDateTime <= now) {
        showToast('Data/Hora Inválida: A data e hora programada deve ser posterior ao momento atual.', 'warning');
        return;
    }

    // Hard Validation: Balance Check
    const availableBalance = cargo.totalVolume - cargo.scheduledVolume;
    if (shipmentTonnage > (availableBalance + 0.001)) { // Small epsilon for float comparison
        showToast(`SALDO INSUFICIENTE: Esta carga possui apenas ${availableBalance.toLocaleString('pt-BR')} ton disponíveis. Você está tentando solicitar ${shipmentTonnage.toLocaleString('pt-BR')} ton.`, 'error');
        return;
    }


    onSave({
      driverName,
      driverCpf,
      driverContact,
      ownerContact: ownerContact || undefined,
      horsePlate,
      trailer1Plate,
      trailer2Plate,
      trailer3Plate,
      shipmentTonnage,
      driverFreightValue: calculatedFreight,
      freightType: freightType,
      embarcadorId: embarcadorId,
      scheduledDate,
      scheduledTime,
      vehicleSetType: vehicleSetType || undefined,
      vehicleBodyType: vehicleBodyType || undefined,
      bankDetails: bankDetails || undefined,
      vehicleTag: vehicleTag || undefined,
      filesToAttach: filesToAttach.length > 0 ? filesToAttach : undefined,
      driverReferences: driverReferences || undefined,
      destination: cargo.destination,
      companyFreightRateSnapshot: cargo.companyFreightValuePerTon,
      driverFreightRateSnapshot: freightType === 'PJ' ? cargo.driverFreightValuePerTonPJ : cargo.driverFreightValuePerTonPF,
    });
  };

  if (!isOpen || !cargo) return null;

  const clientName = clients.find(c => c.id === cargo.clientId)?.nomeFantasia || 'Cliente não encontrado';
  const isExistingDriver = !!drivers.find(d => d.name.trim().toLowerCase() === driverName.trim().toLowerCase() && driverName.trim() !== '');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-2 text-gray-800 dark:text-white">Solicitação de Embarque</h2>
        <div className="mb-6 p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <p className="text-sm text-gray-600 dark:text-gray-400">Cliente: <span className="font-semibold text-gray-800 dark:text-gray-200">{clientName}</span></p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Rota: <span className="font-semibold text-gray-800 dark:text-gray-200">{cargo.origin} → {cargo.destination}</span></p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Saldo Disponível: <span className="font-bold text-emerald-600 dark:text-emerald-400">{(cargo.totalVolume - cargo.scheduledVolume).toLocaleString('pt-BR')} ton</span></p>
          </div>
          {cargo.allowedVehicleTypes && cargo.allowedVehicleTypes.length > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Veículos Permitidos: <span className="font-semibold text-gray-800 dark:text-gray-200">{cargo.allowedVehicleTypes.map(vt => `${vt.setType} (${vt.bodyTypes?.join('/') || ''})`).join(', ')}</span>
              </p>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Data Programada</label>
                  <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Horário Previsto</label>
                  <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" required />
                </div>
            </div>
            
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Embarcador Responsável</label>
                <select
                    value={embarcadorId}
                    onChange={(e) => setEmbarcadorId(e.target.value)}
                    className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600"
                    required
                >
                    <option value="" disabled>Selecione um responsável...</option>
                    {embarcadores.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">CPF do Motorista</label>
                <input type="text" value={driverCpf} onChange={(e) => setDriverCpf(formatCpfCnpj(e.target.value))} placeholder="Digite o CPF do motorista" className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" required />
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Contato (WhatsApp)</label>
                  <input type="text" value={driverContact} onChange={(e) => setDriverContact(formatPhone(e.target.value))} placeholder="Contato (auto-preenchido)" className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" disabled={isExistingDriver} required />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Motorista</label>
                  <input value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Digite o nome do motorista" className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" required list="driver-names" />
                  <datalist id="driver-names">{drivers.map(d => <option key={d.id} value={d.name} />)}</datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Contato do Proprietário</label>
                <input type="text" value={ownerContact} onChange={(e) => setOwnerContact(formatPhone(e.target.value))} placeholder="Telefone/WhatsApp do proprietário" className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" />
              </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Placa Cavalo</label>
                <input value={horsePlate} onChange={(e) => setHorsePlate(e.target.value.toUpperCase())} placeholder="AAA-1234" className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" required list="vehicle-plates" />
                <datalist id="vehicle-plates">{vehicles.map(v => <option key={v.id} value={v.plate} />)}</datalist>
            </div>
          
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Veículo</label>
                    <select value={vehicleSetType} onChange={(e) => setVehicleSetType(e.target.value as VehicleSetType)} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" required={!selectedVehicle} disabled={!!selectedVehicle}>
                        <option value="" disabled>Selecione...</option>
                        {Object.values(VehicleSetType).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Carroceria</label>
                    <select value={vehicleBodyType} onChange={(e) => setVehicleBodyType(e.target.value as VehicleBodyType)} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" required={!selectedVehicle} disabled={!!selectedVehicle}>
                        <option value="" disabled>Selecione...</option>
                        {Object.values(VehicleBodyType).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Placa Carreta 1</label><input type="text" value={trailer1Plate} onChange={(e) => setTrailer1Plate(e.target.value.toUpperCase())} placeholder="Obrigatório" className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" required /></div>
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Placa Carreta 2</label><input type="text" value={trailer2Plate} onChange={(e) => setTrailer2Plate(e.target.value.toUpperCase())} placeholder="Opcional" className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" /></div>
              <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Placa Carreta 3</label><input type="text" value={trailer3Plate} onChange={(e) => setTrailer3Plate(e.target.value.toUpperCase())} placeholder="Opcional" className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" /></div>
            </div>
            
            <div>
               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Dados Bancários</label>
               <textarea 
                 value={bankDetails} 
                 onChange={(e) => setBankDetails(e.target.value)} 
                 placeholder="Banco, Agência, Conta, PIX, etc." 
                 className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600 resize-y" 
                 rows={2} 
                 required
               />
            </div>
          
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Toneladas do Embarque</label>
                  <input type="number" value={shipmentTonnage || ''} onChange={(e) => setShipmentTonnage(parseFloat(e.target.value) || 0)} placeholder="Ex: 35.5" className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" step="0.01" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tag do Veículo</label>
                    <input type="text" value={vehicleTag} onChange={(e) => setVehicleTag(e.target.value)} placeholder="Obrigatório" className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" required />
                </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Freight Type Selector */}
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Tipo de Embarque <span className="text-red-500">*</span></p>
                <div className="grid grid-cols-2 gap-3">
                  {/* PJ Button */}
                  <button
                    type="button"
                    onClick={() => setFreightType('PJ')}
                    className={`relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-200 ${
                      freightType === 'PJ'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 shadow-md shadow-emerald-100 dark:shadow-none scale-[1.02]'
                        : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:border-emerald-700'
                    }`}
                  >
                    {freightType === 'PJ' && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </span>
                    )}
                    <span className={`text-xl font-black tracking-tight ${
                      freightType === 'PJ' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'
                    }`}>PJ</span>
                    <span className={`text-[10px] font-semibold mt-0.5 ${
                      freightType === 'PJ' ? 'text-emerald-500' : 'text-gray-400'
                    }`}>Pessoa Jurídica</span>
                    <span className={`text-sm font-bold mt-2 ${
                      freightType === 'PJ' ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-600 dark:text-gray-400'
                    }`}>{formatCurrency(cargo?.driverFreightValuePerTonPJ ?? cargo?.driverFreightValuePerTon ?? 0)}</span>
                    <span className="text-[9px] text-gray-400">/ton</span>
                    {freightType === 'PJ' && shipmentTonnage > 0 && (
                      <span className="mt-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full">
                        Total: {formatCurrency(calculatedFreightPJ)}
                      </span>
                    )}
                  </button>

                  {/* PF Button */}
                  <button
                    type="button"
                    disabled={!!cargo?.disableDriverFreightPF}
                    onClick={() => setFreightType('PF')}
                    className={`relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-200 ${
                      cargo?.disableDriverFreightPF
                        ? 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/30 opacity-40 cursor-not-allowed'
                        : freightType === 'PF'
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/30 shadow-md shadow-orange-100 dark:shadow-none scale-[1.02]'
                        : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-orange-300 hover:bg-orange-50/50 dark:hover:border-orange-700'
                    }`}
                  >
                    {freightType === 'PF' && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </span>
                    )}
                    <span className={`text-xl font-black tracking-tight ${
                      cargo?.disableDriverFreightPF ? 'text-gray-400 dark:text-gray-600' : (freightType === 'PF' ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400')
                    }`}>PF</span>
                    <span className={`text-[10px] font-semibold mt-0.5 ${
                      cargo?.disableDriverFreightPF ? 'text-gray-400' : (freightType === 'PF' ? 'text-orange-500' : 'text-gray-400')
                    }`}>{cargo?.disableDriverFreightPF ? 'Indisponível' : 'Pessoa Física'}</span>
                    <span className={`text-sm font-bold mt-2 ${
                      cargo?.disableDriverFreightPF ? 'text-gray-400 dark:text-gray-600' : (freightType === 'PF' ? 'text-orange-700 dark:text-orange-300' : 'text-gray-600 dark:text-gray-400')
                    }`}>{cargo?.disableDriverFreightPF ? 'N/A' : formatCurrency(cargo?.driverFreightValuePerTonPF ?? cargo?.driverFreightValuePerTon ?? 0)}</span>
                    {!cargo?.disableDriverFreightPF && <span className="text-[9px] text-gray-400">/ton</span>}
                    {freightType === 'PF' && shipmentTonnage > 0 && !cargo?.disableDriverFreightPF && (
                      <span className="mt-1.5 text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/50 px-2 py-0.5 rounded-full">
                        Total: {formatCurrency(calculatedFreightPF)}
                      </span>
                    )}
                  </button>
                </div>
                {!freightType && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 text-center font-medium">⚠ Selecione o tipo antes de solicitar</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Referências do Motorista</label>
                <textarea
                  value={driverReferences}
                  onChange={(e) => setDriverReferences(e.target.value)}
                  placeholder="Indicações, referências ou observações sobre o motorista..."
                  className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600 resize-y"
                  rows={3}
                  required
                />
              </div>
            </div>
          
            <div className="mt-8 flex justify-end space-x-4">
              <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancelar</button>
              <button type="submit" className="py-2 px-4 bg-primary text-white rounded-lg hover:bg-primary-dark">Solicitar Embarque</button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default NewShipmentModal;
