import React, { useState, useEffect, useMemo } from 'react';
import type { Owner, Vehicle, Driver, Shipment } from '../types';
import { OwnerType } from '../types';
import { autoFormatInput } from '../utils/formatters';
import { 
  Building2, 
  User, 
  CreditCard, 
  Truck, 
  Phone, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  X,
  Layers,
  Calendar,
  Sparkles
} from 'lucide-react';

interface OwnerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (owner: Owner | Omit<Owner, 'id'>) => void;
  ownerToEdit: Owner | null;
  vehicles?: Vehicle[];
  drivers?: Driver[];
  shipments?: Shipment[];
}

interface VehicleCompositionSet {
  key: string;
  setType: string;
  bodyType: string;
  driverName: string;
  driverCpf?: string;
  horsePlate: string;
  trailer1Plate?: string;
  trailer2Plate?: string;
  trailer3Plate?: string;
  lastShipmentId?: string;
  lastShipmentDate?: string;
  shipmentCount: number;
}

const OwnerFormModal: React.FC<OwnerFormModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  ownerToEdit,
  vehicles = [],
  drivers = [],
  shipments = []
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'payment' | 'vehicles' | 'drivers'>('info');

  const [owner, setOwner] = useState<Omit<Owner, 'id'>>({
    name: '',
    cpfCnpj: '',
    phone: '',
    type: OwnerType.PessoaFisica,
    bankDetails: '',
  });

  // Campos estruturados de pagamento / banco
  const [bankPixKey, setBankPixKey] = useState('');
  const [bankPixType, setBankPixType] = useState('CPF/CNPJ');
  const [bankName, setBankName] = useState('');
  const [bankAgency, setBankAgency] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [bankExtraNotes, setBankExtraNotes] = useState('');

  useEffect(() => {
    if (ownerToEdit) {
      setOwner(ownerToEdit);
      
      // Parse ou inicializa dados bancários
      const details = ownerToEdit.bankDetails || '';
      setBankExtraNotes(details);

      const pixMatch = details.match(/PIX:\s*([^\n,|]+)/i) || details.match(/PIX\s*\(([^)]+)\):\s*([^\n,|]+)/i);
      if (pixMatch) {
        if (pixMatch.length >= 3) {
          setBankPixType(pixMatch[1].trim());
          setBankPixKey(pixMatch[2].trim());
        } else {
          setBankPixKey(pixMatch[1].trim());
        }
      }

      const bancoMatch = details.match(/Banco:\s*([^\n,|]+)/i);
      if (bancoMatch) setBankName(bancoMatch[1].trim());

      const agMatch = details.match(/Ag[eê]ncia:\s*([^\n,|]+)/i);
      if (agMatch) setBankAgency(agMatch[1].trim());

      const contaMatch = details.match(/Conta:\s*([^\n,|]+)/i);
      if (contaMatch) setBankAccount(contaMatch[1].trim());

      const titularMatch = details.match(/(?:Favorecido|Titular):\s*([^\n,|]+)/i);
      if (titularMatch) setBankAccountHolder(titularMatch[1].trim());

    } else {
      setOwner({
        name: '',
        cpfCnpj: '',
        phone: '',
        type: OwnerType.PessoaFisica,
        bankDetails: '',
      });
      setBankPixKey('');
      setBankPixType('CPF/CNPJ');
      setBankName('');
      setBankAgency('');
      setBankAccount('');
      setBankAccountHolder('');
      setBankExtraNotes('');
    }
    setActiveTab('info');
  }, [ownerToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const formattedValue = autoFormatInput(name, value);
    setOwner(prev => ({ ...prev, [name]: formattedValue }));
  };

  const buildBankDetailsString = () => {
    const parts: string[] = [];
    if (bankPixKey.trim()) {
      parts.push(`PIX (${bankPixType}): ${bankPixKey.trim()}`);
    }
    if (bankName.trim()) {
      parts.push(`Banco: ${bankName.trim()}`);
    }
    if (bankAgency.trim()) {
      parts.push(`Agência: ${bankAgency.trim()}`);
    }
    if (bankAccount.trim()) {
      parts.push(`Conta: ${bankAccount.trim()}`);
    }
    if (bankAccountHolder.trim()) {
      parts.push(`Favorecido: ${bankAccountHolder.trim()}`);
    }
    if (bankExtraNotes.trim() && !parts.some(p => bankExtraNotes.includes(p))) {
      parts.push(`Obs: ${bankExtraNotes.trim()}`);
    }
    return parts.join(' | ') || bankExtraNotes.trim();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalBankDetails = buildBankDetailsString() || owner.bankDetails || '';
    
    if (ownerToEdit) {
      onSave({
        ...owner,
        bankDetails: finalBankDetails,
        id: ownerToEdit.id,
      });
    } else {
      onSave({
        ...owner,
        bankDetails: finalBankDetails,
      });
    }
  };

  const currentOwnerId = ownerToEdit?.id || '';
  const cleanOwnerDoc = ownerToEdit?.cpfCnpj ? ownerToEdit.cpfCnpj.replace(/\D/g, '') : '';

  // 1. Veículos vinculados diretamente por ownerId
  const linkedVehicles = useMemo(() => {
    if (!currentOwnerId) return [];
    return (vehicles || []).filter(v => v.ownerId === currentOwnerId);
  }, [vehicles, currentOwnerId]);

  // 2. Embarques associados a este proprietário (por documento ANTT ou por placa vinculada)
  const ownerShipments = useMemo(() => {
    if (!ownerToEdit) return [];
    return (shipments || []).filter(s => {
      const cleanAntt = s.anttOwnerIdentifier ? s.anttOwnerIdentifier.replace(/\D/g, '') : '';
      const docMatch = cleanOwnerDoc && cleanAntt && cleanAntt === cleanOwnerDoc;
      const plateMatch = linkedVehicles.some(v => v.plate === s.horsePlate);
      return docMatch || plateMatch;
    });
  }, [shipments, ownerToEdit, cleanOwnerDoc, linkedVehicles]);

  // 3. Conjuntos de Veículos organizados conforme os embarques
  const vehicleSets = useMemo(() => {
    const setMap = new Map<string, VehicleCompositionSet>();

    ownerShipments.forEach(s => {
      const horse = (s.horsePlate || '').trim().toUpperCase();
      if (!horse) return;
      const t1 = (s.trailer1Plate || '').trim().toUpperCase();
      const t2 = (s.trailer2Plate || '').trim().toUpperCase();
      const t3 = (s.trailer3Plate || '').trim().toUpperCase();

      const key = `${horse}_${t1}_${t2}_${t3}`;
      const existing = setMap.get(key);

      const shipDate = s.scheduledDate || s.createdAt || '';

      if (existing) {
        existing.shipmentCount += 1;
        if (shipDate && (!existing.lastShipmentDate || shipDate > existing.lastShipmentDate)) {
          existing.lastShipmentDate = shipDate;
          existing.lastShipmentId = s.id;
          if (s.driverName) existing.driverName = s.driverName;
          if (s.driverCpf) existing.driverCpf = s.driverCpf;
          if (s.vehicleSetType) existing.setType = s.vehicleSetType;
          if (s.vehicleBodyType) existing.bodyType = s.vehicleBodyType;
        }
      } else {
        setMap.set(key, {
          key,
          setType: s.vehicleSetType || 'Cavalo Mecânico',
          bodyType: s.vehicleBodyType || 'Graneleiro',
          driverName: s.driverName || 'Não informado',
          driverCpf: s.driverCpf,
          horsePlate: horse,
          trailer1Plate: t1 || undefined,
          trailer2Plate: t2 || undefined,
          trailer3Plate: t3 || undefined,
          lastShipmentId: s.id,
          lastShipmentDate: shipDate,
          shipmentCount: 1,
        });
      }
    });

    return Array.from(setMap.values());
  }, [ownerShipments]);

  // Placas já incluídas nos conjuntos estruturados
  const platesInSets = useMemo(() => {
    const plates = new Set<string>();
    vehicleSets.forEach(set => {
      if (set.horsePlate) plates.add(set.horsePlate);
      if (set.trailer1Plate) plates.add(set.trailer1Plate);
      if (set.trailer2Plate) plates.add(set.trailer2Plate);
      if (set.trailer3Plate) plates.add(set.trailer3Plate);
    });
    return plates;
  }, [vehicleSets]);

  // Veículos vinculados avulsos (que não apareceram nos conjuntos de embarque)
  const standaloneVehicles = useMemo(() => {
    return linkedVehicles.filter(v => !platesInSets.has(v.plate.trim().toUpperCase()));
  }, [linkedVehicles, platesInSets]);

  // Motoristas vinculados
  const linkedDrivers = useMemo(() => {
    if (!ownerToEdit) return [];
    const directDrivers = (drivers || []).filter(d => d.ownerId === currentOwnerId);
    
    // Adiciona motoristas que constam nos conjuntos de embarque deste proprietário
    const driverNamesFromSets = new Set(vehicleSets.map(s => s.driverName.toLowerCase().trim()));
    const additionalDrivers = (drivers || []).filter(d => 
      !directDrivers.some(dd => dd.id === d.id) &&
      (
        (d.cpf && vehicleSets.some(s => s.driverCpf && s.driverCpf.replace(/\D/g, '') === d.cpf.replace(/\D/g, ''))) ||
        driverNamesFromSets.has(d.name.toLowerCase().trim())
      )
    );

    return [...directDrivers, ...additionalDrivers];
  }, [drivers, currentOwnerId, ownerToEdit, vehicleSets]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-gray-100 dark:border-gray-700">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {ownerToEdit ? 'Cadastro do Proprietário' : 'Novo Proprietário'}
                </h2>
                {ownerToEdit?.id && (
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
                    ID: {ownerToEdit.id}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {ownerToEdit ? 'Gerencie dados cadastrais, dados para recebimento de frete e conjuntos de veículos' : 'Preencha as informações do titular / proprietário'}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-700 px-6 bg-white dark:bg-gray-800 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'info'
                ? 'border-amber-600 text-amber-600 dark:text-amber-400 dark:border-amber-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Dados Gerais</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payment')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'payment'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Dados para Pagamento (Frete)</span>
          </button>

          {ownerToEdit && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('vehicles')}
                className={`flex items-center gap-2 py-3 px-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'vehicles'
                    ? 'border-amber-600 text-amber-600 dark:text-amber-400 dark:border-amber-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <Truck className="w-4 h-4" />
                <span>Veículos Vinculados</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                  {vehicleSets.length + standaloneVehicles.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('drivers')}
                className={`flex items-center gap-2 py-3 px-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'drivers'
                    ? 'border-amber-600 text-amber-600 dark:text-amber-400 dark:border-amber-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Motoristas Vinculados</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                  {linkedDrivers.length}
                </span>
              </button>
            </>
          )}
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* TAB 1: DADOS GERAIS */}
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {ownerToEdit?.id && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">
                      Código de Identificação (ID do Proprietário)
                    </label>
                    <input 
                      type="text" 
                      value={ownerToEdit.id} 
                      disabled 
                      className="w-full p-2.5 bg-gray-100 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-mono font-bold text-gray-700 dark:text-gray-300 cursor-not-allowed"
                    />
                  </div>
                )}

                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Tipo / Modalidade ANTT *
                  </label>
                  <select 
                    name="type" 
                    value={owner.type} 
                    onChange={handleChange} 
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                    required
                  >
                    <option value={OwnerType.PessoaFisica}>Pessoa Física (TAC - Autônomo)</option>
                    <option value={OwnerType.PessoaJuridica}>Pessoa Jurídica (ETC / Empresa)</option>
                  </select>
                </div>

                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    {owner.type === OwnerType.PessoaJuridica ? 'CNPJ do Proprietário *' : 'CPF do Proprietário *'}
                  </label>
                  <input 
                    name="cpfCnpj" 
                    value={owner.cpfCnpj} 
                    onChange={handleChange} 
                    placeholder={owner.type === OwnerType.PessoaJuridica ? '00.000.000/0000-00' : '000.000.000-00'} 
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm font-mono font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500" 
                    required 
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Nome Completo / Razão Social *
                  </label>
                  <input 
                    name="name" 
                    value={owner.name} 
                    onChange={handleChange} 
                    placeholder="Ex: João da Silva / Transportes Silva LTDA" 
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500" 
                    required 
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Telefone / WhatsApp de Contato
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <input 
                      name="phone" 
                      value={owner.phone} 
                      onChange={handleChange} 
                      placeholder="(00) 00000-0000" 
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500" 
                    />
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: DADOS PARA PAGAMENTO (RECEBIMENTO DO FRETE) */}
          {activeTab === 'payment' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-xl flex items-start gap-2.5">
                <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-900 dark:text-emerald-200">
                  <span className="font-bold">Dados para Recebimento de Frete:</span> Estes dados bancários e chave PIX são utilizados pelo financeiro para realizar os pagamentos de adiantamentos e liquidação de fretes para este titular.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Tipo de Chave PIX
                  </label>
                  <select
                    value={bankPixType}
                    onChange={(e) => setBankPixType(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-xs font-medium text-gray-900 dark:text-white"
                  >
                    <option value="CPF/CNPJ">CPF / CNPJ</option>
                    <option value="Celular/WhatsApp">Celular / WhatsApp</option>
                    <option value="E-mail">E-mail</option>
                    <option value="Chave Aleatória">Chave Aleatória (EVP)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Chave PIX
                  </label>
                  <input
                    type="text"
                    value={bankPixKey}
                    onChange={(e) => setBankPixKey(e.target.value)}
                    placeholder="Informe a chave PIX"
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-xs font-mono font-medium text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Banco / Instituição Financeira
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Ex: Banco do Brasil, Itaú, Nubank, Bradesco..."
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-xs font-medium text-gray-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Agência
                    </label>
                    <input
                      type="text"
                      value={bankAgency}
                      onChange={(e) => setBankAgency(e.target.value)}
                      placeholder="0000"
                      className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-xs font-mono text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Conta Corrente / Poupança
                    </label>
                    <input
                      type="text"
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      placeholder="00000-0"
                      className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-xs font-mono text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Nome do Titular / Favorecido da Conta
                  </label>
                  <input
                    type="text"
                    value={bankAccountHolder}
                    onChange={(e) => setBankAccountHolder(e.target.value)}
                    placeholder="Nome completo do titular da conta bancária"
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-xs font-medium text-gray-900 dark:text-white"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Instruções ou Dados Complementares de Pagamento
                  </label>
                  <textarea 
                    name="bankDetails" 
                    value={bankExtraNotes} 
                    onChange={(e) => setBankExtraNotes(e.target.value)} 
                    placeholder="Outras instruções para o financeiro realizar os pagamentos de frete..." 
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white" 
                    rows={2}
                  />
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: VEÍCULOS VINCULADOS (ORGANIZADOS POR CONJUNTO DE EMBARQUE) */}
          {activeTab === 'vehicles' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-700">
                <div>
                  <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-amber-500" />
                    <span>Conjuntos e Veículos do Proprietário ({vehicleSets.length + standaloneVehicles.length})</span>
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Composições organizadas conforme os embarques solicitados (Cavalo + Carretas + Motorista)
                  </p>
                </div>
              </div>

              {vehicleSets.length === 0 && standaloneVehicles.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 dark:bg-gray-700/40 rounded-2xl border border-dashed border-gray-200 dark:border-gray-600">
                  <Truck className="w-10 h-10 text-gray-400 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-bold text-gray-600 dark:text-gray-300">
                    Nenhum veículo vinculado a este proprietário até o momento.
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 max-w-md mx-auto">
                    Ao solicitar novos embarques informando a modalidade e o documento deste titular, os conjuntos de placas (Cavalo e Carretas) serão vinculados e organizados aqui automaticamente.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {/* Lista de Conjuntos de Embarque */}
                  {vehicleSets.map((set, index) => (
                    <div 
                      key={set.key} 
                      className="p-4 bg-gray-50/90 dark:bg-gray-700/50 rounded-2xl border border-gray-200/80 dark:border-gray-600/80 shadow-sm space-y-3"
                    >
                      {/* Cabeçalho do Conjunto */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-gray-200/60 dark:border-gray-600/60">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                            🚛 {set.setType || 'Conjunto'}
                          </span>
                          {set.bodyType && (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-200/70 dark:bg-gray-600 text-gray-700 dark:text-gray-200">
                              {set.bodyType}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                          <span className="font-semibold text-gray-700 dark:text-gray-300">
                            {set.shipmentCount} {set.shipmentCount === 1 ? 'embarque realizado' : 'embarques realizados'}
                          </span>
                          {set.lastShipmentDate && (
                            <span className="flex items-center gap-1 text-[10px] bg-white dark:bg-gray-800 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                              <Calendar className="w-3 h-3 text-gray-400" />
                              {new Date(set.lastShipmentDate).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Motorista do Conjunto */}
                      <div className="flex items-center gap-2 text-xs text-gray-800 dark:text-gray-200">
                        <User className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="font-bold">Motorista:</span>
                        <span>{set.driverName}</span>
                        {set.driverCpf && (
                          <span className="text-gray-400 font-mono text-[11px]">
                            (CPF: {set.driverCpf})
                          </span>
                        )}
                      </div>

                      {/* Grade das Placas do Conjunto */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        
                        {/* CAVALO */}
                        <div className="p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs">
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                            Cavalo
                          </div>
                          <div className="text-sm font-mono font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5 text-amber-500" />
                            <span>{set.horsePlate}</span>
                          </div>
                        </div>

                        {/* CARRETA 1 */}
                        {set.trailer1Plate ? (
                          <div className="p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs">
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                              Carreta 1
                            </div>
                            <div className="text-sm font-mono font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                              <span className="text-xs">🚚</span>
                              <span>{set.trailer1Plate}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-xl bg-gray-50/50 dark:bg-gray-800/40 border border-dashed border-gray-200 dark:border-gray-700">
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                              Carreta 1
                            </div>
                            <div className="text-xs text-gray-400 italic">Não informada</div>
                          </div>
                        )}

                        {/* CARRETA 2 */}
                        {set.trailer2Plate ? (
                          <div className="p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs">
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                              Carreta 2
                            </div>
                            <div className="text-sm font-mono font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                              <span className="text-xs">🚚</span>
                              <span>{set.trailer2Plate}</span>
                            </div>
                          </div>
                        ) : null}

                        {/* CARRETA 3 */}
                        {set.trailer3Plate ? (
                          <div className="p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xs">
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                              Carreta 3
                            </div>
                            <div className="text-sm font-mono font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                              <span className="text-xs">🚚</span>
                              <span>{set.trailer3Plate}</span>
                            </div>
                          </div>
                        ) : null}

                      </div>
                    </div>
                  ))}

                  {/* Veículos Avulsos */}
                  {standaloneVehicles.length > 0 && (
                    <div className="pt-2">
                      <div className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-2">
                        Outros Veículos Vinculados Cadastrados ({standaloneVehicles.length})
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {standaloneVehicles.map(v => (
                          <div key={v.id} className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                <Truck className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <div className="text-xs font-mono font-bold text-gray-900 dark:text-white">
                                  {v.plate}
                                </div>
                                <div className="text-[10px] text-gray-400">
                                  {v.setType || 'Veículo'} {v.bodyType ? `• ${v.bodyType}` : ''}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          )}

          {/* TAB 4: MOTORISTAS VINCULADOS */}
          {activeTab === 'drivers' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Motoristas Associados a este Proprietário ({linkedDrivers.length})
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  Motoristas que operam ou já operaram veículos deste titular
                </span>
              </div>

              {linkedDrivers.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 dark:bg-gray-700/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-600">
                  <User className="w-8 h-8 text-gray-400 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Nenhum motorista vinculado diretamente a este proprietário.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {linkedDrivers.map(d => (
                    <div key={d.id} className="p-3.5 bg-gray-50 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-900 dark:text-white">
                            {d.name}
                          </div>
                          <div className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
                            {d.cpf ? `CPF: ${d.cpf}` : 'Sem CPF'} {d.phone ? `• 📞 ${d.phone}` : ''}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose} 
              className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 rounded-xl text-xs font-bold transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="py-2.5 px-5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Salvar Proprietário</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default OwnerFormModal;
