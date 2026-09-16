import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Cargo, Driver, Shipment, Client, Vehicle, User } from '../types';
import { UserProfile, DailyScheduleType, VehicleSetType, VehicleBodyType, DriverPaymentMethod, ShipmentStatus, AnttModality, EtcTaxRegime, FreightCalculationType } from '../types';
import { supabase } from '../supabase';
import { useToast } from '../hooks/useToast';
import { toCargo } from '../lib/db';
import { calculateAdvanceAndBalance } from '../utils/freightCalculation';
import { autoFormatInput } from '../utils/formatters';
import { AlertTriangle, CheckCircle2, X, RefreshCw, ShieldCheck, Zap, Building2, User as UserIcon, Search, Loader2 } from 'lucide-react';


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
  offer?: any;
}

const NewShipmentModal: React.FC<NewShipmentModalProps> = ({ isOpen, onClose, onSave, cargo, drivers, clients, vehicles, currentUser, shipments, users, offer }) => {
  const [activeCargo, setActiveCargo] = useState<Cargo | null>(cargo);
  const [isUpdatingCargoPermission, setIsUpdatingCargoPermission] = useState(false);
  const [isSyncingCargo, setIsSyncingCargo] = useState(false);

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
  const [paymentMethod, setPaymentMethod] = useState<DriverPaymentMethod | string>(DriverPaymentMethod.PixEFrete);
  const [pixKey, setPixKey] = useState('');
  const [bankDetails, setBankDetails] = useState('');
  const [advancePercentage, setAdvancePercentage] = useState<number>(70);
  const [vehicleTag, setVehicleTag] = useState('');
  const [filesToAttach, setFilesToAttach] = useState<File[]>([]);
  const [anttModality, setAnttModality] = useState<AnttModality | ''>('');
  const [anttOwnerIdentifier, setAnttOwnerIdentifier] = useState('');
  const [etcTaxRegime, setEtcTaxRegime] = useState<EtcTaxRegime | ''>('');
  const [driverFreightType, setDriverFreightType] = useState<'PJ' | 'PF'>('PJ');
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const [cnpjSearchResult, setCnpjSearchResult] = useState<{ razaoSocial?: string; status?: string; regimeFound?: string } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [activeShipmentsFound, setActiveShipmentsFound] = useState<Shipment[]>([]);
  const [pendingPayload, setPendingPayload] = useState<any>(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (cargo) {
      setActiveCargo(cargo);
    }
  }, [cargo]);

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
    return users
      .filter(u => u.active !== false && u.profile !== UserProfile.Motorista && u.profile !== UserProfile.Cliente)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [users]);

  const prevIsOpen = React.useRef(isOpen);

  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      // Find driver user or driver directly
      const driverUser = users.find(u => u.id === offer?.driverId);
      const cleanUserCpf = (driverUser?.email || '').replace(/\D/g, '');
      const cleanUserPhone = (driverUser?.phone || '').replace(/\D/g, '');
      
      // Locate in drivers table by: ID, CPF, Phone or Name
      const driverInDb = drivers.find(d => {
        if (offer?.driverId && d.id === offer.driverId) return true;
        if (cleanUserCpf.length === 11 && d.cpf && d.cpf.replace(/\D/g, '') === cleanUserCpf) return true;
        if (cleanUserPhone.length >= 10 && d.phone && d.phone.replace(/\D/g, '') === cleanUserPhone) return true;
        if (driverUser?.name && d.name.trim().toLowerCase() === driverUser.name.trim().toLowerCase()) return true;
        if (offer?.driverName && d.name.trim().toLowerCase() === offer.driverName.trim().toLowerCase()) return true;
        return false;
      });

      const initialDriverName = driverInDb?.name || offer?.driverName || driverUser?.name || '';
      const initialDriverCpf = driverInDb?.cpf || (cleanUserCpf.length === 11 ? driverUser?.email : '') || offer?.driverCpf || '';
      const initialDriverContact = driverInDb?.phone || offer?.driverContact || driverUser?.phone || '';

      setDriverName(initialDriverName);
      setDriverCpf(initialDriverCpf);
      setDriverContact(initialDriverContact);

      // Now search for driver's last shipment across ALL available identifiers
      const cleanTargetCpf = initialDriverCpf.replace(/\D/g, '');
      const cleanTargetName = initialDriverName.trim().toLowerCase();
      const cleanTargetPhone = initialDriverContact.replace(/\D/g, '');

      let lastShipment = shipments
        .filter(s => {
          if (cleanTargetCpf.length === 11 && s.driverCpf && s.driverCpf.replace(/\D/g, '') === cleanTargetCpf) return true;
          if (cleanTargetName && s.driverName && s.driverName.trim().toLowerCase() === cleanTargetName) return true;
          if (cleanTargetPhone.length >= 10 && s.driverContact && s.driverContact.replace(/\D/g, '') === cleanTargetPhone) return true;
          return false;
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

      // Vehicle lookup fallback from vehicles table if not found in lastShipment
      const linkedVehicle = driverInDb?.id 
        ? vehicles.find(v => v.driverId === driverInDb.id) 
        : undefined;

      const horsePlateVal = lastShipment?.horsePlate || linkedVehicle?.plate || '';
      const trailer1Val = lastShipment?.trailer1Plate || '';
      const trailer2Val = lastShipment?.trailer2Plate || '';
      const trailer3Val = lastShipment?.trailer3Plate || '';

      setHorsePlate(horsePlateVal);
      setTrailer1Plate(trailer1Val);
      setTrailer2Plate(trailer2Val);
      setTrailer3Plate(trailer3Val);

      setOwnerContact(lastShipment?.ownerContact || '');
      setShipmentTonnage(offer?.totalTonnage || (cargo ? Math.max(0, cargo.scheduledVolume - cargo.loadedVolume) : 0) || 0);
      setScheduledDate(offer?.scheduledDate || cargo?.loadingDeadline || new Date().toISOString().split('T')[0]);
      setScheduledTime(offer?.scheduledTime || '');
      setSelectedVehicle(linkedVehicle || null);
      setVehicleSetType(lastShipment?.vehicleSetType || linkedVehicle?.setType || '');
      setVehicleBodyType(lastShipment?.vehicleBodyType || linkedVehicle?.bodyType || '');
      setPaymentMethod(lastShipment?.paymentMethod || DriverPaymentMethod.PixEFrete);
      setPixKey(lastShipment?.pixKey || '');
      setBankDetails(lastShipment?.bankDetails || '');
      setAdvancePercentage(lastShipment?.advancePercentage !== undefined ? lastShipment.advancePercentage : 70);
      setVehicleTag(lastShipment?.vehicleTag || '');
      setFilesToAttach([]);

      const initialAntt = (lastShipment?.anttModality as AnttModality) || (lastShipment?.driverFreightType === 'PF' ? AnttModality.TAC : (lastShipment?.driverFreightType === 'PJ' ? AnttModality.ETC : ''));
      setAnttModality(initialAntt || '');
      setAnttOwnerIdentifier(lastShipment?.anttOwnerIdentifier || (initialAntt === AnttModality.TAC ? (initialDriverCpf || '') : ''));
      setCnpjSearchResult(null);
      setEtcTaxRegime((lastShipment?.etcTaxRegime as EtcTaxRegime) || '');
      setDriverFreightType(lastShipment?.driverFreightType || (initialAntt === AnttModality.TAC ? 'PF' : 'PJ'));

      setEmbarcadorId(currentUser?.id || '');
      setShowConfirmModal(false);
      setActiveShipmentsFound([]);
      setPendingPayload(null);
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, currentUser, offer, cargo, drivers, shipments, users, vehicles]);

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
        if (driverByName && selectedDriver.cpf && selectedDriver.cpf.replace(/\D/g, '') !== cleanCpf && !driverCpf) {
            setDriverCpf(selectedDriver.cpf);
        } else if (driverByCpf && selectedDriver.name.trim().toLowerCase() !== cleanName && !driverName) {
            setDriverName(selectedDriver.name);
        }

        if (selectedDriver.phone && !driverContact) {
            setDriverContact(selectedDriver.phone);
        }

        if (!selectedDriver.active && lastAlertedDriverId !== selectedDriver.id) {
            showToast(`ATENÇÃO: Este motorista encontra-se RESTRITO! Motivo: ${selectedDriver.restrictionReason || 'Sem motivo especificado'}. O sistema impedirá a criação desta ordem.`, 'error', 10000);
            setLastAlertedDriverId(selectedDriver.id);
        } else if (selectedDriver.active) {
            setLastAlertedDriverId(''); 
        }

        if (lastAutofilledDriverId !== selectedDriver.id && selectedDriver.active) {
            const selectedCleanCpf = selectedDriver.cpf ? selectedDriver.cpf.replace(/\D/g, '') : '';
            const lastShipment = shipments
                .filter(s => 
                    (selectedCleanCpf.length === 11 && s.driverCpf && s.driverCpf.replace(/\D/g, '') === selectedCleanCpf) || 
                    (s.driverName && s.driverName.trim().toLowerCase() === selectedDriver.name.trim().toLowerCase())
                )
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

            const linkedVehicle = vehicles.find(v => v.driverId === selectedDriver.id);

            if (lastShipment) {
                if (lastShipment.horsePlate) setHorsePlate(lastShipment.horsePlate);
                if (lastShipment.trailer1Plate) setTrailer1Plate(lastShipment.trailer1Plate);
                if (lastShipment.trailer2Plate) setTrailer2Plate(lastShipment.trailer2Plate);
                if (lastShipment.trailer3Plate) setTrailer3Plate(lastShipment.trailer3Plate);
                if (lastShipment.ownerContact) setOwnerContact(lastShipment.ownerContact);
                if (lastShipment.driverContact && !driverContact) setDriverContact(lastShipment.driverContact);
                if (lastShipment.paymentMethod) setPaymentMethod(lastShipment.paymentMethod);
                if (lastShipment.pixKey) setPixKey(lastShipment.pixKey);
                if (lastShipment.bankDetails) setBankDetails(lastShipment.bankDetails);
                if (lastShipment.advancePercentage !== undefined) setAdvancePercentage(lastShipment.advancePercentage);
                if (lastShipment.vehicleTag) setVehicleTag(lastShipment.vehicleTag);
                if (lastShipment.vehicleSetType) setVehicleSetType(lastShipment.vehicleSetType);
                if (lastShipment.vehicleBodyType) setVehicleBodyType(lastShipment.vehicleBodyType);
                if (lastShipment.anttOwnerIdentifier) {
                  setAnttOwnerIdentifier(lastShipment.anttOwnerIdentifier);
                } else if (selectedDriver.cpf) {
                  setAnttOwnerIdentifier(selectedDriver.cpf);
                }
                if (lastShipment.anttModality) {
                  setAnttModality(lastShipment.anttModality as AnttModality);
                  setDriverFreightType(lastShipment.anttModality === AnttModality.TAC ? 'PF' : 'PJ');
                } else if (lastShipment.driverFreightType) {
                  setDriverFreightType(lastShipment.driverFreightType);
                  setAnttModality(lastShipment.driverFreightType === 'PF' ? AnttModality.TAC : AnttModality.ETC);
                }
                if (lastShipment.etcTaxRegime) {
                  setEtcTaxRegime(lastShipment.etcTaxRegime as EtcTaxRegime);
                }
            } else if (linkedVehicle) {
                if (linkedVehicle.plate) setHorsePlate(linkedVehicle.plate);
                if (linkedVehicle.setType) setVehicleSetType(linkedVehicle.setType);
                if (linkedVehicle.bodyType) setVehicleBodyType(linkedVehicle.bodyType);
            }
            setLastAutofilledDriverId(selectedDriver.id);
        }
    } else {
        setLastAutofilledDriverId('');
        setLastAlertedDriverId('');
    }
  }, [driverName, driverCpf, drivers, shipments, vehicles, lastAlertedDriverId, lastAutofilledDriverId, driverContact]);

  // Automatic CNPJ Tax Regime Lookup
  const searchCnpjTaxRegime = async (cnpjInput: string) => {
    const clean = cnpjInput.replace(/\D/g, '');
    if (clean.length !== 14) {
      showToast('Digite os 14 dígitos do CNPJ para realizar a pesquisa.', 'warning');
      return;
    }
    setIsSearchingCnpj(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);
      let data: any = null;

      try {
        const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`, {
          signal: controller.signal
        });
        if (resp.ok) {
          data = await resp.json();
        }
      } catch (e) {
        console.warn('Consulta BrasilAPI falhou, tentando fallback...', e);
      }

      if (!data) {
        try {
          const respFallback = await fetch(`https://minhareceita.org/${clean}`, {
            signal: controller.signal
          });
          if (respFallback.ok) {
            data = await respFallback.json();
          }
        } catch (e) {
          console.warn('Fallback também falhou:', e);
        }
      }

      clearTimeout(timeoutId);

      if (!data) {
        throw new Error('CNPJ não localizado na base da Receita Federal.');
      }

      let detectedRegime: EtcTaxRegime = EtcTaxRegime.SimplesNacional;
      let desc = '';

      if (data.opcao_pelo_mei === true) {
        detectedRegime = EtcTaxRegime.MEI;
        desc = 'MEI (Microempreendedor Individual)';
      } else if (data.opcao_pelo_simples === true) {
        detectedRegime = EtcTaxRegime.SimplesNacional;
        desc = 'Simples Nacional';
      } else {
        detectedRegime = EtcTaxRegime.LucroPresumido;
        desc = 'Regime Normal (Lucro Presumido / Real)';
      }

      setAnttModality(AnttModality.ETC);
      setEtcTaxRegime(detectedRegime);
      setDriverFreightType('PJ');

      const companyName = data.razao_social || data.nome_fantasia || '';
      setCnpjSearchResult({
        razaoSocial: companyName,
        status: data.descricao_situacao_cadastral || data.situacao_cadastral || 'Ativa',
        regimeFound: desc
      });

      showToast(`CNPJ Identificado: ${companyName} (${desc})`, 'success');
    } catch (err: any) {
      console.warn('Erro na busca do CNPJ:', err);
      setEtcTaxRegime('');
      setCnpjSearchResult(null);
      showToast(`CNPJ não localizado na Receita Federal: ${err.message || 'Verifique o CNPJ digitado e tente novamente'}.`, 'error');
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  const handleAnttOwnerIdentifierChange = (value: string) => {
    if (anttModality === AnttModality.TAC) {
      const formatted = autoFormatInput('cpf', value);
      setAnttOwnerIdentifier(formatted);
    } else {
      const formatted = autoFormatInput('cnpj', value);
      setAnttOwnerIdentifier(formatted);
      const clean = formatted.replace(/\D/g, '');
      if (clean.length === 14 && !isSearchingCnpj) {
        searchCnpjTaxRegime(formatted);
      }
    }
  };
  
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

  const currentCargo = activeCargo || cargo;

  // Live Vehicle Compatibility Validator
  const vehicleValidationInfo = useMemo(() => {
    const setType = vehicleSetType || selectedVehicle?.setType || '';
    const bodyType = vehicleBodyType || selectedVehicle?.bodyType || '';

    if (!currentCargo?.allowedVehicleTypes || currentCargo.allowedVehicleTypes.length === 0) {
      return { hasRules: false, isAllowed: true, setType, bodyType };
    }

    if (!setType || !bodyType) {
      return { hasRules: true, isAllowed: true, setType, bodyType };
    }

    const isAllowed = currentCargo.allowedVehicleTypes.some(allowed => 
      allowed.setType === setType && allowed.bodyTypes.includes(bodyType as VehicleBodyType)
    );

    return { hasRules: true, isAllowed, setType, bodyType };
  }, [currentCargo, vehicleSetType, vehicleBodyType, selectedVehicle]);

  // Sync Cargo Data on Demand without losing form state
  const handleSyncCargo = async () => {
    const target = currentCargo;
    if (!target?.id) return;
    setIsSyncingCargo(true);
    try {
      const { data, error } = await supabase
        .from('cargos')
        .select('*')
        .eq('id', target.id)
        .single();
      if (error) throw error;
      if (data) {
        const updated = toCargo(data);
        setActiveCargo(updated);
        showToast('Dados e permissões da carga sincronizados com sucesso!', 'success');
      }
    } catch (err: any) {
      console.error('Erro ao sincronizar carga:', err);
      showToast(`Erro ao sincronizar carga: ${err.message || err}`, 'error');
    } finally {
      setIsSyncingCargo(false);
    }
  };

  // 1-Click Allow Vehicle Type on Cargo
  const handleAllowCurrentVehicleOnCargo = async () => {
    const target = currentCargo;
    if (!target) return;
    const currentSetType = vehicleSetType || selectedVehicle?.setType;
    const currentBodyType = vehicleBodyType || selectedVehicle?.bodyType;

    if (!currentSetType || !currentBodyType) {
      showToast('Selecione primeiro o Tipo de Veículo e Carroceria.', 'warning');
      return;
    }

    setIsUpdatingCargoPermission(true);
    try {
      const existingAllowed = [...(target.allowedVehicleTypes || [])];
      const existingIndex = existingAllowed.findIndex(item => item.setType === currentSetType);

      if (existingIndex >= 0) {
        const bodyTypes = [...existingAllowed[existingIndex].bodyTypes];
        if (!bodyTypes.includes(currentBodyType as VehicleBodyType)) {
          bodyTypes.push(currentBodyType as VehicleBodyType);
          existingAllowed[existingIndex] = {
            ...existingAllowed[existingIndex],
            bodyTypes
          };
        }
      } else {
        existingAllowed.push({
          setType: currentSetType as VehicleSetType,
          bodyTypes: [currentBodyType as VehicleBodyType]
        });
      }

      const { error } = await supabase
        .from('cargos')
        .update({
          allowed_vehicle_types: existingAllowed
        })
        .eq('id', target.id);

      if (error) throw error;

      const updatedCargo: Cargo = {
        ...target,
        allowedVehicleTypes: existingAllowed
      };
      setActiveCargo(updatedCargo);
      showToast(`Veículo (${currentSetType} - ${currentBodyType}) permitido nesta carga com sucesso!`, 'success');
    } catch (err: any) {
      console.error('Erro ao atualizar permissão de veículo na carga:', err);
      showToast(`Erro ao atualizar carga: ${err.message || err}`, 'error');
    } finally {
      setIsUpdatingCargoPermission(false);
    }
  };

  // Freight Rate Calculations for PJ and PF
  const leg1 = currentCargo?.freightLegs?.[0] || {
    companyFreightValuePerTon: currentCargo?.companyFreightValuePerTon || 0,
    driverFreightValuePerTon: currentCargo?.driverFreightValuePerTon || 0,
    driverFreightValuePerTonPf: currentCargo?.driverFreightValuePerTon || 0,
    disablePfFreight: false,
    hasIcms: currentCargo?.hasIcms || false,
    icmsPercentage: currentCargo?.icmsPercentage || 0,
  };

  const ratePj = leg1.driverFreightValuePerTon || currentCargo?.driverFreightValuePerTon || 0;
  const isPfDisabled = leg1.disablePfFreight || false;
  const ratePf = isPfDisabled ? 0 : (leg1.driverFreightValuePerTonPf ?? (leg1.driverFreightValuePerTon || currentCargo?.driverFreightValuePerTon || 0));

  const hasPjToll = leg1.driverFreightHasToll ?? currentCargo?.driverFreightHasToll ?? false;
  const hasPfToll = leg1.driverFreightPfHasToll ?? currentCargo?.driverFreightPfHasToll ?? false;

  const currentFreightRate = (driverFreightType === 'PF' && !isPfDisabled) ? ratePf : ratePj;
  const isFixedFreight = currentCargo?.freightCalculationType === FreightCalculationType.Fixed || leg1.freightCalculationType === FreightCalculationType.Fixed;

  const calculatedFreight = useMemo(() => {
    if (!currentCargo) return 0;
    if (isFixedFreight) {
      return currentFreightRate;
    }
    if (shipmentTonnage <= 0) return 0;
    return currentFreightRate * shipmentTonnage;
  }, [currentCargo, shipmentTonnage, currentFreightRate, isFixedFreight]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCargo) {
      showToast('Esta carga não existe mais no sistema ou foi removida. Não é possível criar o embarque.', 'error');
      return;
    }

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

    if (driverFreightType === 'PF' && isPfDisabled) {
        showToast('O frete PF (Pessoa Física) foi desabilitado nesta carga. Selecione o frete PJ (Pessoa Jurídica).', 'warning');
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

    if (currentCargo?.allowedVehicleTypes && currentCargo.allowedVehicleTypes.length > 0 && vehicleInfo.setType && vehicleInfo.bodyType) {
        const isAllowed = currentCargo.allowedVehicleTypes.some(allowed => 
            allowed.setType === vehicleInfo.setType && allowed.bodyTypes.includes(vehicleInfo.bodyType as VehicleBodyType)
        );
        if (!isAllowed) {
            showToast(`O tipo do veículo selecionado (${vehicleInfo.setType} - ${vehicleInfo.bodyType}) não é permitido para esta carga. Use o botão "Permitir Este Veículo" acima para liberar.`, 'error');
            return;
        }
    }

    if (currentCargo?.dailySchedule) {
        const scheduleRule = currentCargo.dailySchedule.find(rule => rule.date === scheduledDate);
        if (!scheduleRule) {
            showToast('Não é permitido criar ordens para datas sem programação lançada na carga. Verifique a Data Programada.', 'error');
            return;
        }

        if (scheduleRule.type === DailyScheduleType.Verificar) {
            showToast('Atenção: A programação para este dia exige verificação com o comercial antes de marcar.', 'warning');
        } else if (scheduleRule.type === DailyScheduleType.Fixo && scheduleRule.tonnage) {
            const alreadyScheduledTonnage = shipments
                .filter(s => s.cargoId === currentCargo.id && s.scheduledDate === scheduledDate)
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
    const availableBalance = currentCargo.totalVolume - currentCargo.scheduledVolume;
    if (shipmentTonnage > (availableBalance + 0.001)) {
        showToast(`SALDO INSUFICIENTE: Esta carga possui apenas ${availableBalance.toLocaleString('pt-BR')} ton disponíveis. Você está tentando solicitar ${shipmentTonnage.toLocaleString('pt-BR')} ton.`, 'error');
        return;
    }

    if (paymentMethod === DriverPaymentMethod.PixEFrete && !pixKey.trim()) {
        showToast('Para pagamento via PIX - E-FRETE, a Chave Pix é obrigatória.', 'warning');
        return;
    }

    if (paymentMethod === DriverPaymentMethod.DepositoConta && !bankDetails.trim()) {
        showToast('Para depósito em conta, os Dados Bancários são obrigatórios.', 'warning');
        return;
    }

    if (!anttModality) {
        showToast('A Modalidade da ANTT (TAC ou ETC) é obrigatória para solicitar o embarque.', 'warning');
        return;
    }

    if (!anttOwnerIdentifier.trim()) {
        showToast(`O ${anttModality === AnttModality.TAC ? 'CPF' : 'CNPJ'} do Titular da ANTT é obrigatório.`, 'warning');
        return;
    }

    const cleanAnttId = anttOwnerIdentifier.replace(/\D/g, '');
    if (anttModality === AnttModality.TAC && cleanAnttId.length !== 11) {
        showToast('CPF do Titular da ANTT inválido (deve conter 11 dígitos).', 'warning');
        return;
    }

    if (anttModality === AnttModality.ETC && cleanAnttId.length !== 14) {
        showToast('CNPJ do Titular da ANTT inválido (deve conter 14 dígitos).', 'warning');
        return;
    }

    if (anttModality === AnttModality.ETC && !etcTaxRegime) {
        showToast('Para a modalidade ETC (Pessoa Jurídica), realize a consulta do CNPJ na Receita Federal para identificar o Regime Tributário.', 'warning');
        return;
    }

    if (anttModality === AnttModality.TAC && isPfDisabled) {
        showToast('O frete PF (Pessoa Física / TAC) foi desabilitado nesta carga. Selecione a modalidade ETC (Pessoa Jurídica).', 'warning');
        return;
    }

    const calc = calculateAdvanceAndBalance({
      driverFreightValue: calculatedFreight,
      driverFreightRate: currentFreightRate,
      tonnage: shipmentTonnage,
      tollValue: 0,
      advancePercentage: advancePercentage !== undefined ? advancePercentage : 70,
      driverFreightType: anttModality === AnttModality.TAC ? 'PF' : 'PJ',
    });

    const companyFreightRate = currentCargo.companyFreightValuePerTon || 0;

    const shipmentData = {
      cargoId: currentCargo.id,
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
      driverFreightRateSnapshot: currentFreightRate,
      companyFreightRateSnapshot: companyFreightRate,
      freightCalculationType: currentCargo.freightCalculationType || leg1.freightCalculationType,
      icmsValue: currentCargo.icmsValue || leg1.icmsValue,
      driverFreightType: anttModality === AnttModality.TAC ? 'PF' : 'PJ',
      anttOwnerIdentifier: anttOwnerIdentifier.trim(),
      anttModality: anttModality,
      etcTaxRegime: anttModality === AnttModality.ETC ? (etcTaxRegime || undefined) : undefined,
      embarcadorId: embarcadorId,
      scheduledDate,
      scheduledTime,
      vehicleSetType: vehicleSetType || undefined,
      vehicleBodyType: vehicleBodyType || undefined,
      paymentMethod,
      pixKey: paymentMethod === DriverPaymentMethod.PixEFrete ? pixKey : undefined,
      bankDetails: (paymentMethod === DriverPaymentMethod.DepositoConta || bankDetails) ? bankDetails : undefined,
      advancePercentage: calc.advancePercentage,
      advanceValue: calc.advanceInAccountValue,
      tollValue: 0,
      balanceToReceiveValue: calc.balanceToReceiveValue,
      vehicleTag: vehicleTag || undefined,
      filesToAttach: filesToAttach.length > 0 ? filesToAttach : undefined,
    };

    // Check for active shipments for this driver
    const cleanCpf = driverCpf.replace(/\D/g, '');
    const cleanName = driverName.trim().toLowerCase();

    const activeShipments = (shipments || []).filter(s => {
      if (s.status === ShipmentStatus.Finalizado || s.status === ShipmentStatus.Cancelado) {
        return false;
      }
      const sCpf = s.driverCpf ? s.driverCpf.replace(/\D/g, '') : '';
      const sName = s.driverName ? s.driverName.trim().toLowerCase() : '';

      const matchesCpf = cleanCpf.length === 11 && sCpf === cleanCpf;
      const matchesName = cleanName.length > 0 && sName === cleanName;

      return matchesCpf || matchesName;
    });

    if (activeShipments.length > 0) {
      setPendingPayload(shipmentData);
      setActiveShipmentsFound(activeShipments);
      setShowConfirmModal(true);
      return;
    }

    onSave(shipmentData);
  };

  const handleConfirmSave = () => {
    if (pendingPayload) {
      onSave(pendingPayload);
      setPendingPayload(null);
      setShowConfirmModal(false);
      setActiveShipmentsFound([]);
    }
  };

  if (!isOpen) return null;

  if (!currentCargo) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1">Carga Não Encontrada</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                A carga vinculada a esta solicitação foi removida do sistema ou não está mais disponível. Não é possível criar o embarque.
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const clientName = clients.find(c => c.id === currentCargo.clientId)?.nomeFantasia || 'Cliente não encontrado';
  const isExistingDriver = !!drivers.find(d => d.name.trim().toLowerCase() === driverName.trim().toLowerCase() && driverName.trim() !== '');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 md:p-8 max-w-3xl w-full max-h-[92vh] overflow-y-auto border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Solicitação de Embarque</h2>
          <button
            type="button"
            onClick={handleSyncCargo}
            disabled={isSyncingCargo}
            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700/80 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
            title="Atualizar dados da carga direto do banco sem perder o que digitou"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCargo ? 'animate-spin text-primary' : 'text-gray-500'}`} />
            <span>{isSyncingCargo ? 'Atualizando...' : 'Atualizar Carga'}</span>
          </button>
        </div>
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <p className="text-gray-600 dark:text-gray-400">Cliente: <span className="font-bold text-gray-900 dark:text-gray-100">{clientName}</span></p>
            <p className="text-gray-600 dark:text-gray-400">Rota: <span className="font-bold text-gray-900 dark:text-gray-100">{currentCargo.origin} → {currentCargo.destination}</span></p>
            <p className="text-gray-600 dark:text-gray-400">Saldo Disponível: <span className="font-bold text-emerald-600 dark:text-emerald-400">{(currentCargo.totalVolume - currentCargo.scheduledVolume).toLocaleString('pt-BR')} ton</span></p>
          </div>
          {currentCargo.allowedVehicleTypes && currentCargo.allowedVehicleTypes.length > 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Veículos Permitidos: <span className="font-semibold text-gray-700 dark:text-gray-300">{currentCargo.allowedVehicleTypes.map(vt => `${vt.setType} (${vt.bodyTypes.join('/')})`).join(', ')}</span>
              </p>
          ) : (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-medium">
                ✓ Todos os tipos de veículos são permitidos nesta carga
              </p>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-5">
            {/* Date & Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Data Programada</label>
                  <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="p-3 w-full border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white" required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Horário Previsto</label>
                  <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="p-3 w-full border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white" required />
                </div>
            </div>
            
            {/* Embarcador */}
            <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Embarcador Responsável</label>
                <select
                    value={embarcadorId}
                    onChange={(e) => setEmbarcadorId(e.target.value)}
                    className="p-3 w-full border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                >
                    <option value="" disabled>Selecione um responsável...</option>
                    {embarcadores.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
            </div>

            {/* Driver info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">CPF do Motorista</label>
                <input type="text" value={driverCpf} onChange={(e) => setDriverCpf(e.target.value)} placeholder="Digite o CPF do motorista" className="p-3 w-full border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white" required />
              </div>
              <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Contato (WhatsApp)</label>
                  <input type="text" value={driverContact} onChange={(e) => setDriverContact(e.target.value)} placeholder="Contato (auto-preenchido)" className="p-3 w-full border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white" disabled={isExistingDriver} required />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Motorista</label>
                  <input value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Digite o nome do motorista" className="p-3 w-full border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white" required list="driver-names" />
                  <datalist id="driver-names">{drivers.map(d => <option key={d.id} value={d.name} />)}</datalist>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Contato do Proprietário</label>
                <input type="text" value={ownerContact} onChange={(e) => setOwnerContact(e.target.value)} placeholder="Telefone/WhatsApp do proprietário" className="p-3 w-full border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
            </div>

            {/* Vehicle Plates & Types */}
            <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Placa Cavalo</label>
                <input value={horsePlate} onChange={(e) => setHorsePlate(e.target.value.toUpperCase())} placeholder="AAA-1234" className="p-3 w-full border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white" required list="vehicle-plates" />
                <datalist id="vehicle-plates">{vehicles.map(v => <option key={v.id} value={v.plate} />)}</datalist>
            </div>
          
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Tipo de Veículo</label>
                    <select value={vehicleSetType} onChange={(e) => setVehicleSetType(e.target.value as VehicleSetType)} className="p-3 w-full border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white" required={!selectedVehicle} disabled={!!selectedVehicle}>
                        <option value="" disabled>Selecione...</option>
                        {Object.values(VehicleSetType).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Tipo de Carroceria</label>
                    <select value={vehicleBodyType} onChange={(e) => setVehicleBodyType(e.target.value as VehicleBodyType)} className="p-3 w-full border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white" required={!selectedVehicle} disabled={!!selectedVehicle}>
                        <option value="" disabled>Selecione...</option>
                        {Object.values(VehicleBodyType).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </div>

            {/* Live Vehicle Compatibility & 1-Click Permission Banner */}
            {vehicleValidationInfo.hasRules && (
              <div>
                {!vehicleValidationInfo.isAllowed ? (
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-amber-900 dark:text-amber-200">
                          Veículo não permitido na carga: {vehicleValidationInfo.setType} - {vehicleValidationInfo.bodyType}
                        </p>
                        <p className="text-amber-700 dark:text-amber-400 mt-0.5 text-[11px]">
                          Permitidos atualmente: {currentCargo?.allowedVehicleTypes?.map(vt => `${vt.setType} (${vt.bodyTypes.join('/')})`).join(', ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleSyncCargo}
                        disabled={isSyncingCargo}
                        className="px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 text-gray-700 dark:text-gray-200 rounded-lg font-semibold flex items-center gap-1 shadow-xs transition-all text-xs"
                        title="Verificar se outra pessoa já atualizou a carga"
                      >
                        <RefreshCw className={`w-3 h-3 ${isSyncingCargo ? 'animate-spin text-primary' : ''}`} />
                        <span>{isSyncingCargo ? 'Checando...' : 'Sincronizar'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleAllowCurrentVehicleOnCargo}
                        disabled={isUpdatingCargoPermission}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-xs transition-all text-xs"
                        title="Adiciona este tipo de veículo nas regras da carga agora sem recarregar a tela"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>{isUpdatingCargoPermission ? 'Liberando...' : 'Permitir Este Veículo'}</span>
                      </button>
                    </div>
                  </div>
                ) : (vehicleValidationInfo.setType && vehicleValidationInfo.bodyType ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-lg text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Tipo de veículo compatível com as regras desta carga</span>
                  </div>
                ) : null)}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Placa Carreta 1</label><input type="text" value={trailer1Plate} onChange={(e) => setTrailer1Plate(e.target.value.toUpperCase())} placeholder="Obrigatório" className="p-3 w-full border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white" required /></div>
              <div><label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Placa Carreta 2</label><input type="text" value={trailer2Plate} onChange={(e) => setTrailer2Plate(e.target.value.toUpperCase())} placeholder="Opcional" className="p-3 w-full border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white" /></div>
              <div><label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Placa Carreta 3</label><input type="text" value={trailer3Plate} onChange={(e) => setTrailer3Plate(e.target.value.toUpperCase())} placeholder="Opcional" className="p-3 w-full border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white" /></div>
            </div>
            
            {/* Formas de Pagamento & Adiantamento */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-4">
                <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                      FORMA DE PAGAMENTO & ADIANTAMENTO <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                        <span>Adiantamento:</span>
                        <div className="relative w-24">
                            <input 
                                type="number" 
                                value={advancePercentage} 
                                onChange={(e) => setAdvancePercentage(parseFloat(e.target.value) || 0)} 
                                className="p-1.5 pr-6 w-full text-right font-bold text-emerald-600 dark:text-emerald-400 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-emerald-500"
                                min="0"
                                max="100"
                                required
                            />
                            <span className="absolute right-2 top-1.5 text-xs font-bold text-gray-400">%</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                        type="button"
                        onClick={() => setPaymentMethod(DriverPaymentMethod.PixEFrete)}
                        className={`p-3 rounded-xl border text-center transition-all text-xs font-bold flex flex-col items-center justify-center gap-1 ${
                            paymentMethod === DriverPaymentMethod.PixEFrete
                            ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                        }`}
                    >
                        <span className="text-sm">⚡ PIX - E-FRETE</span>
                        <span className="text-[10px] font-normal text-gray-500 dark:text-gray-400">Via Chave Pix</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setPaymentMethod(DriverPaymentMethod.DepositoConta)}
                        className={`p-3 rounded-xl border text-center transition-all text-xs font-bold flex flex-col items-center justify-center gap-1 ${
                            paymentMethod === DriverPaymentMethod.DepositoConta
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                        }`}
                    >
                        <span className="text-sm">🏦 DEPÓSITO EM CONTA</span>
                        <span className="text-[10px] font-normal text-gray-500 dark:text-gray-400">Dados Bancários</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setPaymentMethod(DriverPaymentMethod.SmsCartaFrete)}
                        className={`p-3 rounded-xl border text-center transition-all text-xs font-bold flex flex-col items-center justify-center gap-1 ${
                            paymentMethod === DriverPaymentMethod.SmsCartaFrete
                            ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/20'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                        }`}
                    >
                        <span className="text-sm">📱 SMS CARTA FRETE</span>
                        <span className="text-[10px] font-normal text-gray-500 dark:text-gray-400">Carta Frete</span>
                    </button>
                </div>

                {paymentMethod === DriverPaymentMethod.PixEFrete && (
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            Chave Pix <span className="text-red-500">*</span>
                        </label>
                        <input 
                            type="text" 
                            value={pixKey} 
                            onChange={(e) => setPixKey(e.target.value)} 
                            placeholder="CPF, CNPJ, Telefone, E-mail ou Chave Aleatória" 
                            className="p-3 w-full border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            required
                        />
                    </div>
                )}

                {paymentMethod === DriverPaymentMethod.DepositoConta && (
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            Dados Bancários <span className="text-red-500">*</span>
                        </label>
                        <textarea 
                            value={bankDetails} 
                            onChange={(e) => setBankDetails(e.target.value)} 
                            placeholder="Banco, Agência, Conta Corrente/Poupança, Favorecido, CPF/CNPJ..." 
                            className="p-3 w-full border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-y text-sm" 
                            rows={2} 
                            required
                        />
                    </div>
                )}

                {paymentMethod === DriverPaymentMethod.SmsCartaFrete && (
                    <div className="p-3 bg-purple-50/50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-xl text-xs text-purple-800 dark:text-purple-300 flex items-center gap-2">
                        <span>ℹ️ Pagamento via SMS Carta Frete para o condutor.</span>
                    </div>
                )}
            </div>

            {/* Document Attachment & Scan */}
            <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Anexar Documentos</label>
                <div className="mt-1 flex items-center h-full">
                    <label className="cursor-pointer bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 py-2.5 px-4 rounded-xl inline-flex items-center transition-colors font-medium text-sm border border-gray-300 dark:border-gray-600">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                        Anexar
                        <input type="file" multiple className="hidden" onChange={(e) => {
                            if (e.target.files) {
                                setFilesToAttach(Array.from(e.target.files));
                            }
                        }} />
                    </label>
                    <span className="ml-3 text-xs text-gray-500 dark:text-gray-400">
                        {filesToAttach.length > 0 ? `${filesToAttach.length} arquivo(s) selecionado(s)` : 'Nenhum'}
                    </span>
                    {filesToAttach.length > 0 && (
                        <button
                            type="button"
                            onClick={() => handleScanDocument(filesToAttach)}
                            disabled={isScanning}
                            className={`ml-3 text-xs font-bold uppercase py-1.5 px-3 rounded-lg border transition-all ${
                                isScanning 
                                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                                : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-600 hover:text-white'
                            }`}
                        >
                            {isScanning ? 'Processando...' : 'Digitalizar com IA'}
                        </button>
                    )}
                </div>
            </div>
          
            {/* Target Layout from Screenshot: 2-Column Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3">
                
                {/* Left Column: Toneladas & Tipo de Embarque */}
                <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Toneladas do Embarque</label>
                      <input 
                        type="number" 
                        value={shipmentTonnage || ''} 
                        onChange={(e) => setShipmentTonnage(parseFloat(e.target.value) || 0)} 
                        placeholder="Ex: 35.5" 
                        className="p-3 w-full border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-600" 
                        step="0.01" 
                        required 
                      />
                    </div>

                    {/* Dashed Box for TIPO DE EMBARQUE (Somente Leitura / Definido pela ANTT) */}
                    <div className="p-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50/50 dark:bg-gray-900/30 space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                              TIPO DE EMBARQUE <span className="text-red-500">*</span>
                            </label>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-200/80 dark:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center gap-1">
                              <span>🔒</span> Definido pela ANTT
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {/* PJ Card (Read-only display) */}
                            <div
                              className={`p-4 rounded-2xl border-2 text-center transition-all duration-200 flex flex-col items-center justify-center relative select-none ${
                                driverFreightType === 'PJ' && anttModality === AnttModality.ETC
                                  ? 'border-emerald-600 bg-white dark:bg-gray-800 shadow-md ring-2 ring-emerald-500/20'
                                  : 'border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/40 opacity-40'
                              }`}
                            >
                                <span className="text-xl font-black text-gray-900 dark:text-white">PJ</span>
                                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 mt-0.5">Pessoa Jurídica</span>
                                <span className="text-base font-black text-gray-900 dark:text-white mt-2">
                                  {formatCurrency(ratePj)}{hasPjToll ? ' + Ped' : ''} <span className="text-xs font-normal text-gray-400">{isFixedFreight ? 'fixo' : '/ton'}</span>
                                </span>
                                {anttModality === AnttModality.ETC && (
                                  <span className="mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                                    ETC {etcTaxRegime ? `• ${etcTaxRegime}` : ''}
                                  </span>
                                )}
                            </div>

                            {/* PF Card (Read-only display) */}
                            <div
                              className={`p-4 rounded-2xl border-2 text-center transition-all duration-200 flex flex-col items-center justify-center relative select-none ${
                                isPfDisabled
                                  ? 'border-gray-200 bg-gray-100 dark:bg-gray-900/50 opacity-30 cursor-not-allowed'
                                  : driverFreightType === 'PF' && anttModality === AnttModality.TAC
                                  ? 'border-orange-500 bg-white dark:bg-gray-800 shadow-md ring-2 ring-orange-500/20'
                                  : 'border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/40 opacity-40'
                              }`}
                            >
                                <span className="text-xl font-black text-gray-900 dark:text-white">PF</span>
                                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 mt-0.5">Pessoa Física</span>
                                <span className="text-base font-black text-gray-900 dark:text-white mt-2">
                                  {isPfDisabled ? (
                                    <span className="text-xs text-red-500 italic">Desabilitado</span>
                                  ) : (
                                    <>{formatCurrency(ratePf)}{hasPfToll ? ' + Ped' : ''} <span className="text-xs font-normal text-gray-400">{isFixedFreight ? 'fixo' : '/ton'}</span></>
                                  )}
                                </span>
                                {anttModality === AnttModality.TAC && (
                                  <span className="mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-300">
                                    TAC • Autônomo
                                  </span>
                                )}
                            </div>
                        </div>

                        <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 text-center flex items-center justify-center gap-1 pt-0.5">
                          {anttModality === AnttModality.TAC ? (
                            <span className="text-orange-600 dark:text-orange-400">👤 Frete PF selecionado automaticamente (TAC)</span>
                          ) : anttModality === AnttModality.ETC ? (
                            <span className="text-emerald-600 dark:text-emerald-400">🏢 Frete PJ selecionado automaticamente (ETC)</span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400">⚠️ Selecione a Modalidade ANTT ao lado</span>
                          )}
                        </p>
                    </div>
                </div>

                {/* Right Column: Tag & Modalidade ANTT */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Tag do Veículo</label>
                        <input 
                          type="text" 
                          value={vehicleTag} 
                          onChange={(e) => setVehicleTag(e.target.value)} 
                          placeholder="Obrigatório" 
                          className="p-3 w-full border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-600" 
                          required 
                        />
                    </div>

                    {/* MODALIDADE DA ANTT */}
                    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50/70 dark:bg-gray-900/40 space-y-3.5 shadow-xs">
                        <div className="flex items-center justify-between">
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                              <ShieldCheck className="w-4 h-4 text-primary" />
                              <span>MODALIDADE DA ANTT <span className="text-red-500">*</span></span>
                            </label>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                              Obrigatório
                            </span>
                        </div>

                        {/* TAC vs ETC selection buttons */}
                        <div className="grid grid-cols-2 gap-3">
                            {/* TAC Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setAnttModality(AnttModality.TAC);
                                setEtcTaxRegime('');
                                setCnpjSearchResult(null);
                                if (!anttOwnerIdentifier || anttOwnerIdentifier.replace(/\D/g, '').length > 11) {
                                  setAnttOwnerIdentifier(driverCpf || '');
                                }
                                if (!isPfDisabled) {
                                  setDriverFreightType('PF');
                                } else {
                                  showToast('Atenção: Frete PF está desabilitado nesta carga.', 'warning');
                                }
                              }}
                              className={`p-3.5 rounded-xl border-2 text-left transition-all duration-200 flex flex-col justify-between ${
                                anttModality === AnttModality.TAC
                                  ? 'border-orange-500 bg-orange-50/60 dark:bg-orange-950/40 text-orange-950 dark:text-orange-100 ring-2 ring-orange-500/20 shadow-sm'
                                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                              }`}
                            >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <UserIcon className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                    <span className="font-extrabold text-base">TAC</span>
                                  </div>
                                  <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-orange-200/80 dark:bg-orange-900/70 text-orange-800 dark:text-orange-200">
                                    PF
                                  </span>
                                </div>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 leading-tight font-medium">
                                  Transportador Autônomo de Cargas (Pessoa Física)
                                </p>
                            </button>

                            {/* ETC Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setAnttModality(AnttModality.ETC);
                                setDriverFreightType('PJ');
                                if (anttOwnerIdentifier.replace(/\D/g, '').length === 11) {
                                  setAnttOwnerIdentifier('');
                                  setEtcTaxRegime('');
                                  setCnpjSearchResult(null);
                                }
                              }}
                              className={`p-3.5 rounded-xl border-2 text-left transition-all duration-200 flex flex-col justify-between ${
                                anttModality === AnttModality.ETC
                                  ? 'border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-500/20 shadow-sm'
                                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                              }`}
                            >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    <span className="font-extrabold text-base">ETC</span>
                                  </div>
                                  <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-emerald-200/80 dark:bg-emerald-900/70 text-emerald-800 dark:text-emerald-200">
                                    PJ
                                  </span>
                                </div>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 leading-tight font-medium">
                                  Empresa de Transporte Rodoviário (Pessoa Jurídica)
                                </p>
                            </button>
                        </div>

                        {/* When TAC is selected: CPF do Titular */}
                        {anttModality === AnttModality.TAC && (
                            <div className="pt-2 space-y-1.5 animate-fade-in border-t border-gray-200 dark:border-gray-700/80">
                                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                    CPF do Titular da ANTT (TAC) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={anttOwnerIdentifier}
                                    onChange={(e) => handleAnttOwnerIdentifierChange(e.target.value)}
                                    placeholder="000.000.000-00"
                                    className="p-2.5 w-full border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium focus:ring-2 focus:ring-orange-500"
                                    required
                                />
                                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                    CPF do transportador autônomo titular do RNTRC
                                </p>
                            </div>
                        )}

                        {/* When ETC is selected: CNPJ with Lookup and Regime Tributário */}
                        {anttModality === AnttModality.ETC && (
                            <div className="pt-2 space-y-3 animate-fade-in border-t border-gray-200 dark:border-gray-700/80">
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                            CNPJ da Transportadora (ETC) <span className="text-red-500">*</span>
                                        </label>
                                        {isSearchingCnpj && (
                                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                                <Loader2 className="w-3 h-3 animate-spin" /> Buscando na Receita...
                                            </span>
                                        )}
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={anttOwnerIdentifier}
                                            onChange={(e) => handleAnttOwnerIdentifierChange(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    searchCnpjTaxRegime(anttOwnerIdentifier);
                                                }
                                            }}
                                            placeholder="00.000.000/0000-00"
                                            className="p-2.5 flex-1 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium focus:ring-2 focus:ring-emerald-600"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => searchCnpjTaxRegime(anttOwnerIdentifier)}
                                            disabled={isSearchingCnpj || anttOwnerIdentifier.replace(/\D/g, '').length !== 14}
                                            className="px-3 py-2.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                                            title="Consultar CNPJ na Receita Federal para identificar o regime tributário"
                                        >
                                            {isSearchingCnpj ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                                            <span>Consultar</span>
                                        </button>
                                    </div>

                                    {cnpjSearchResult && (
                                        <div className="p-2.5 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-xs space-y-0.5 animate-fade-in">
                                            <p className="font-bold text-emerald-950 dark:text-emerald-100 truncate">
                                                🏢 {cnpjSearchResult.razaoSocial}
                                            </p>
                                            <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                                                Regime Identificado: <strong>{cnpjSearchResult.regimeFound}</strong>
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Regime Tributário (ETC) - Definido exclusivamente pela consulta */}
                                <div className="space-y-1.5 animate-fade-in">
                                    <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                        Regime Tributário (ETC) <span className="text-red-500">*</span>
                                    </label>

                                    {etcTaxRegime ? (
                                        <div className="p-3 bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700/60 rounded-xl flex items-center justify-between shadow-sm">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                                                    ✓
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-emerald-950 dark:text-emerald-100">
                                                        {etcTaxRegime}
                                                    </p>
                                                    <p className="text-[10px] text-emerald-700 dark:text-emerald-300">
                                                        Obtido automaticamente via Receita Federal
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-emerald-200/80 dark:bg-emerald-900/80 text-emerald-900 dark:text-emerald-200">
                                                Confirmado
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl flex items-start gap-2 text-amber-800 dark:text-amber-200 text-xs">
                                            <span className="text-sm shrink-0">ℹ️</span>
                                            <div>
                                                <p className="font-semibold text-[11px]">Identificação Automática Obrigatória</p>
                                                <p className="text-[10px] text-amber-700/90 dark:text-amber-300/80 mt-0.5">
                                                    Informe o CNPJ acima e clique em <strong>Consultar</strong> para obter o regime tributário oficial da empresa.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer buttons */}
            <div className="mt-8 flex justify-end space-x-4 border-t dark:border-gray-700 pt-4">
              <button 
                type="button" 
                onClick={onClose} 
                className="py-2.5 px-6 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="py-2.5 px-6 bg-[#0F5132] hover:bg-[#0B3C21] text-white font-bold rounded-xl shadow-lg shadow-emerald-950/20 transition-all active:scale-95"
              >
                Solicitar Embarque
              </button>
            </div>
        </form>
      </div>

      {/* Confirmation Modal: Driver has Active Shipment */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-amber-300 dark:border-amber-700/60 relative space-y-5 transform transition-all scale-100">
            
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-2xl flex-shrink-0">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Atenção: Motorista com Embarque Ativo
                </h3>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5">
                  Este motorista já possui viagem em andamento no sistema.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Driver & Active Shipments Details */}
            <div className="bg-amber-50/70 dark:bg-amber-950/30 rounded-xl p-4 border border-amber-200/80 dark:border-amber-800/40 space-y-3">
              <div className="text-sm text-gray-800 dark:text-gray-200 font-medium">
                <strong>Motorista:</strong> {driverName} {driverCpf ? `(CPF: ${driverCpf})` : ''}
              </div>
              
              <div className="space-y-2">
                <div className="text-xs font-semibold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                  Embarque(s) ativo(s) localizado(s):
                </div>
                <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                  {activeShipmentsFound.map((s) => (
                    <div 
                      key={s.id} 
                      className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-amber-200 dark:border-gray-700 text-xs flex items-center justify-between shadow-sm"
                    >
                      <div>
                        <span className="font-bold text-gray-900 dark:text-white">{s.id}</span>
                        {s.horsePlate && <span className="ml-2 font-mono text-gray-500 dark:text-gray-400">({s.horsePlate})</span>}
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                          Data Programada: {s.scheduledDate ? `${s.scheduledDate} ${s.scheduledTime || ''}` : 'N/A'}
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50">
                        {s.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Deseja confirmar a criação deste novo embarque mesmo assim?
            </p>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-lg shadow-amber-600/30 transition-all flex items-center gap-2 active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                Sim, Criar Embarque
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewShipmentModal;
