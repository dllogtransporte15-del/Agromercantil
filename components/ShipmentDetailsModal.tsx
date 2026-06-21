import React, { useState } from 'react';
import type { Shipment, Cargo, User, Client, Product, Vehicle } from '../types';
import { UserProfile, ShipmentStatus, VehicleSetType, VehicleBodyType } from '../types';
import { generateLoadingOrderPDF } from '../utils/pdfGenerator';
import { FileTextIcon, Trash2 } from 'lucide-react';
import { getToolStaysByShipment, StayRecord } from '../services/api/toolsApi';
import { getShipmentAttachmentUrl } from '../services/api/db';
import { formatCpfCnpj, formatPhone } from '../utils/formatters';


interface ShipmentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipment: Shipment | null;
  cargo: Cargo | undefined;
  currentUser?: User | null;
  onUpdatePrice?: (shipmentId: string, data: { newTotal: number, newRate?: number, newCompanyRate?: number }) => void;
  onUpdateShipmentData?: (shipmentId: string, data: Partial<Shipment>) => void;
  onAddAttachments?: (shipmentId: string, files: File[]) => Promise<void>;
  onDeleteAttachment?: (shipmentId: string, url: string) => Promise<void>;
  clients: Client[];
  products: Product[];
  vehicles: Vehicle[];
  users: User[];
  companyLogo?: string | null;
}


const DetailItem: React.FC<{ label: string; value?: string | number | null; children?: React.ReactNode }> = ({ label, value, children }) => (
    <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        {children || <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{value ?? 'N/A'}</p>}
    </div>
);

const ShipmentDetailsModal: React.FC<ShipmentDetailsModalProps> = ({ 
  isOpen, onClose, shipment, cargo, currentUser, onUpdatePrice, onUpdateShipmentData, onAddAttachments, onDeleteAttachment, clients, products, vehicles, users, companyLogo 
}) => {

  const [isEditing, setIsEditing] = useState(false);
  const [editRate, setEditRate] = useState<number>(0);
  const [editCompanyRate, setEditCompanyRate] = useState<number>(0);
  const [isEditingData, setIsEditingData] = useState(false);
  const [editedData, setEditedData] = useState<Partial<Shipment>>({});
  const [filesToAttach, setFilesToAttach] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [shipmentStays, setShipmentStays] = useState<StayRecord[]>([]);

  React.useEffect(() => {
    if (isOpen && shipment) {
      getToolStaysByShipment(shipment.id).then(setShipmentStays);
    } else {
      setShipmentStays([]);
    }
  }, [isOpen, shipment]);

  if (!isOpen || !shipment) return null;

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const formatDate = (dateString: string) => new Date(dateString).toLocaleString('pt-BR');

  const isFinalized = shipment.status === ShipmentStatus.Finalizado;
  const isAdmin = currentUser?.profile === UserProfile.Admin;
  const canEdit = !!onUpdatePrice && (
    (isFinalized ? isAdmin : currentUser?.profile !== UserProfile.Embarcador)
  );

  const handleStartEdit = () => {
    setEditRate(shipment.driverFreightRateSnapshot || (shipment.driverFreightValue / (shipment.shipmentTonnage || 1)));
    setEditCompanyRate(shipment.companyFreightRateSnapshot || cargo?.companyFreightValuePerTon || 0);
    setIsEditing(true);
  };

  const mainVehicle = vehicles.find(v => v.plate === shipment.horsePlate);
  const embarcador = users.find(u => u.id === shipment.embarcadorId);
  const product = products.find(p => p.id === cargo?.productId);

  const handleSave = () => {
    if (onUpdatePrice) {
      const newTotal = editRate * shipment.shipmentTonnage;
      onUpdatePrice(shipment.id, {
        newTotal,
        newRate: editRate,
        newCompanyRate: editCompanyRate
      });
      setIsEditing(false);
    }
  };

  const handleStartEditData = () => {
    setEditedData({
      driverName: shipment.driverName,
      driverCpf: shipment.driverCpf,
      driverContact: shipment.driverContact,
      horsePlate: shipment.horsePlate,
      trailer1Plate: shipment.trailer1Plate,
      trailer2Plate: shipment.trailer2Plate,
      trailer3Plate: shipment.trailer3Plate,
      vehicleTag: shipment.vehicleTag,
      vehicleSetType: shipment.vehicleSetType || mainVehicle?.setType,
      vehicleBodyType: shipment.vehicleBodyType || mainVehicle?.bodyType,
      shipmentTonnage: shipment.shipmentTonnage,
      bankDetails: shipment.bankDetails,
      driverReferences: shipment.driverReferences,
      ownerContact: shipment.ownerContact,
      anttOwnerIdentifier: shipment.anttOwnerIdentifier,
    });
    setIsEditingData(true);
  };

  const handleSaveData = () => {
    if (onUpdateShipmentData) {
      onUpdateShipmentData(shipment.id, editedData);
      setIsEditingData(false);
    }
  };

  const handleConfirmAttachments = async () => {
    if (!onAddAttachments || filesToAttach.length === 0) return;
    setIsUploading(true);
    try {
      await onAddAttachments(shipment.id, filesToAttach);
      setFilesToAttach([]);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-start mb-4 border-b pb-4 dark:border-gray-700">
            <div>
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Detalhes do Embarque</h2>
                    {shipment && ![ShipmentStatus.AguardandoSeguradora, ShipmentStatus.PreCadastro, ShipmentStatus.Cancelado].includes(shipment.status) && (
                        <button
                            onClick={() => cargo && generateLoadingOrderPDF(shipment, cargo, clients, products, vehicles, companyLogo)}
                            title="Gerar Ordem de Carregamento (PDF)"
                            className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800/50"
                        >
                            <FileTextIcon size={18} />
                        </button>
                    )}
                </div>
                <p className="text-sm font-mono text-primary dark:text-blue-400 mt-1">{shipment.id}</p>
            </div>

            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">&times;</button>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            
            {/* Rota e Origem/Destino */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50/50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/50">
                <DetailItem label="Origem da Carga" value={cargo?.origin} />
                <DetailItem label="Destino da Carga" value={cargo?.destination} />
                <DetailItem label="Produto" value={product?.name} />
                <DetailItem label="Carga Vinculada" value={cargo?.sequenceId ? `#${cargo.sequenceId}` : cargo?.id} />
                <DetailItem label="Status Atual" value={shipment.status} />
                <DetailItem label="Comercial (Embarcador)" value={embarcador?.name || 'N/A'} />
                {shipment.status === 'Cancelado' && shipment.cancellationReason && (
                    <div className="md:col-span-2 mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-md">
                        <p className="text-xs font-medium text-red-800 dark:text-red-400">Motivo do Cancelamento</p>
                        <p className="text-sm font-semibold text-red-900 dark:text-red-200 mt-1">{shipment.cancellationReason}</p>
                    </div>
                )}
            </div>

            {/* Informações do Motorista e Veículo */}
            <div className="border-t dark:border-gray-700 pt-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Motorista e Veículo</h3>
                    {!isEditingData ? (
                        <button 
                            onClick={handleStartEditData}
                            className="text-xs font-semibold text-primary hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                        >
                            <span>Editar Dados</span>
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button 
                                onClick={handleSaveData}
                                className="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded hover:bg-green-700 transition"
                            >
                                Salvar
                            </button>
                            <button 
                                onClick={() => setIsEditingData(false)}
                                className="px-3 py-1 bg-gray-500 text-white text-xs font-bold rounded hover:bg-gray-600 transition"
                            >
                                Cancelar
                            </button>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {isEditingData ? (
                        <>
                            <div>
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Motorista</label>
                                <input 
                                    type="text"
                                    className="w-full mt-1 p-1.5 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={editedData.driverName || ''}
                                    onChange={e => setEditedData({...editedData, driverName: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">CPF</label>
                                <input 
                                    type="text"
                                    className="w-full mt-1 p-1.5 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={editedData.driverCpf || ''}
                                    onChange={e => setEditedData({...editedData, driverCpf: formatCpfCnpj(e.target.value)})}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Contato</label>
                                <input 
                                    type="text"
                                    className="w-full mt-1 p-1.5 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={editedData.driverContact || ''}
                                    onChange={e => setEditedData({...editedData, driverContact: formatPhone(e.target.value)})}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Placa Cavalo</label>
                                <input 
                                    type="text"
                                    className="w-full mt-1 p-1.5 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={editedData.horsePlate || ''}
                                    onChange={e => setEditedData({...editedData, horsePlate: e.target.value.toUpperCase()})}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Placa Carreta 1</label>
                                <input 
                                    type="text"
                                    className="w-full mt-1 p-1.5 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={editedData.trailer1Plate || ''}
                                    onChange={e => setEditedData({...editedData, trailer1Plate: e.target.value.toUpperCase()})}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Placa Carreta 2</label>
                                <input 
                                    type="text"
                                    className="w-full mt-1 p-1.5 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={editedData.trailer2Plate || ''}
                                    onChange={e => setEditedData({...editedData, trailer2Plate: e.target.value.toUpperCase()})}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Placa Carreta 3</label>
                                <input 
                                    type="text"
                                    className="w-full mt-1 p-1.5 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={editedData.trailer3Plate || ''}
                                    onChange={e => setEditedData({...editedData, trailer3Plate: e.target.value.toUpperCase()})}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Tag do Veículo</label>
                                <input 
                                    type="text"
                                    className="w-full mt-1 p-1.5 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={editedData.vehicleTag || ''}
                                    onChange={e => setEditedData({...editedData, vehicleTag: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Tipo de Veículo</label>
                                <select 
                                    className="w-full mt-1 p-1.5 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={editedData.vehicleSetType || ''}
                                    onChange={e => setEditedData({...editedData, vehicleSetType: e.target.value as VehicleSetType})}
                                >
                                    <option value="" disabled>Selecione...</option>
                                    {Object.values(VehicleSetType).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Carroceria</label>
                                <select 
                                    className="w-full mt-1 p-1.5 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={editedData.vehicleBodyType || ''}
                                    onChange={e => setEditedData({...editedData, vehicleBodyType: e.target.value as VehicleBodyType})}
                                >
                                    <option value="" disabled>Selecione...</option>
                                    {Object.values(VehicleBodyType).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        </>
                    ) : (
                        <>
                            <DetailItem label="Motorista" value={shipment.driverName} />
                            <DetailItem label="Documento (CPF)" value={shipment.driverCpf ? formatCpfCnpj(shipment.driverCpf) : ''} />
                            <DetailItem label="Contato" value={shipment.driverContact ? formatPhone(shipment.driverContact) : ''} />
                            
                            <div className="md:col-span-2 lg:col-span-3 h-px bg-gray-100 dark:bg-gray-700 my-2" />
                            
                            <DetailItem label="Placa do Cavalo" value={shipment.horsePlate} />
                            <DetailItem label="Placa Carreta 1" value={shipment.trailer1Plate} />
                            <DetailItem label="Placa Carreta 2" value={shipment.trailer2Plate || 'N/A'} />
                            <DetailItem label="Placa Carreta 3" value={shipment.trailer3Plate || 'N/A'} />
                            <DetailItem label="Tag do Veículo" value={shipment.vehicleTag || 'N/A'} />
                            <DetailItem label="Tipo de Veículo" value={shipment.vehicleSetType || mainVehicle?.setType || 'N/A'} />
                            <DetailItem label="Carroceria" value={shipment.vehicleBodyType || mainVehicle?.bodyType || 'N/A'} />
                        </>
                    )}
                </div>
            </div>

            {/* Frete e Financeiro */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t dark:border-gray-700 pt-4">
                <div className="md:col-span-2 flex justify-between items-center mb-2">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Informações Financeiras</h3>
                    {canEdit && !isEditing && (
                        <button 
                            onClick={handleStartEdit}
                            className="text-xs font-bold text-primary dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                            Editar Valores
                        </button>
                    )}
                </div>

                {isEditing ? (
                    <>
                        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border dark:border-gray-600 md:col-span-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Taxa Motorista (R$ / Ton)</label>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        value={editRate}
                                        onChange={(e) => setEditRate(Number(e.target.value))}
                                        className="w-full p-2 text-sm border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Frete Empresa (R$ / Ton)</label>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        value={editCompanyRate}
                                        onChange={(e) => setEditCompanyRate(Number(e.target.value))}
                                        className="w-full p-2 text-sm border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t dark:border-gray-600 mt-2">
                                <div className="text-sm">
                                    <span className="text-gray-500">Novo Total: </span>
                                    <span className="font-bold text-green-600 dark:text-green-400">{formatCurrency(editRate * shipment.shipmentTonnage)}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded">Cancelar</button>
                                    <button onClick={handleSave} className="px-3 py-1.5 text-xs font-bold bg-primary text-white rounded hover:bg-primary/90 shadow-sm">Salvar Alterações</button>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <DetailItem label="Valor Frete Motorista">
                            <p className="text-lg font-bold text-green-700 dark:text-green-400">
                                {isEditingData 
                                    ? formatCurrency((editedData.shipmentTonnage || 0) * (shipment.driverFreightRateSnapshot || (shipment.driverFreightValue / (shipment.shipmentTonnage || 1))))
                                    : formatCurrency(shipment.driverFreightValue)
                                }
                            </p>
                            <span className="text-[10px] text-gray-500 font-normal">
                                ({formatCurrency(shipment.driverFreightRateSnapshot || (shipment.driverFreightValue / (shipment.shipmentTonnage || 1)))} /ton)
                            </span>
                        </DetailItem>
                        <DetailItem label="Tonelagem">
                            {isEditingData ? (
                                <input 
                                    type="number"
                                    step="0.01"
                                    className="w-full mt-1 p-1.5 text-sm font-semibold border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={editedData.shipmentTonnage || 0}
                                    onChange={e => setEditedData({...editedData, shipmentTonnage: Number(e.target.value)})}
                                />
                            ) : (
                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                    {shipment.shipmentTonnage.toLocaleString('pt-BR')} ton
                                </p>
                            )}
                        </DetailItem>
                        
                        {currentUser?.profile !== UserProfile.Embarcador && (
                            <DetailItem label="Frete Empresa (Foto)">
                                <p className="text-sm font-bold text-primary dark:text-blue-400">
                                    {formatCurrency(shipment.companyFreightRateSnapshot || cargo?.companyFreightValuePerTon || 0)} /ton
                                </p>
                            </DetailItem>
                        )}
                        
                        {shipmentStays.length > 0 && currentUser?.profile !== UserProfile.Embarcador && (
                            <div className="md:col-span-2 mt-2 pt-2 border-t dark:border-gray-700">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Resumo de Estadias</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded border border-green-100 dark:border-green-800/50">
                                        <p className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase">Receita (Aprovado)</p>
                                        <p className="text-sm font-bold text-green-700 dark:text-green-300">
                                            {formatCurrency(shipmentStays.reduce((acc, stay) => acc + (stay.approvedValue || 0), 0))}
                                        </p>
                                    </div>
                                    <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-100 dark:border-red-800/50">
                                        <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase">Custo (Pago Motorista)</p>
                                        <p className="text-sm font-bold text-red-700 dark:text-red-300">
                                            {formatCurrency(shipmentStays.reduce((acc, stay) => acc + (stay.driverPaidValue || 0), 0))}
                                        </p>
                                    </div>
                                    <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-100 dark:border-blue-800/50">
                                        <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">Lucro Adicional</p>
                                        <p className={`text-sm font-bold ${
                                            (shipmentStays.reduce((acc, stay) => acc + (stay.approvedValue || 0), 0) - shipmentStays.reduce((acc, stay) => acc + (stay.driverPaidValue || 0), 0)) >= 0 
                                            ? 'text-blue-700 dark:text-blue-300' 
                                            : 'text-red-600 dark:text-red-400'
                                        }`}>
                                            {formatCurrency(shipmentStays.reduce((acc, stay) => acc + (stay.approvedValue || 0), 0) - shipmentStays.reduce((acc, stay) => acc + (stay.driverPaidValue || 0), 0))}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-3 space-y-2">
                                    {shipmentStays.map((stay, idx) => (
                                        <div key={stay.id} className="flex flex-col gap-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded border border-gray-100 dark:border-gray-700">
                                            <div className="flex justify-between items-center text-xs">
                                                <div>
                                                    <span className="font-bold text-gray-700 dark:text-gray-300">Estadia #{idx + 1}</span>
                                                    <span className="text-gray-400 ml-2">{new Date(stay.date).toLocaleDateString('pt-BR')}</span>
                                                </div>
                                                <div className="flex gap-4">
                                                    <div className="text-center">
                                                        <div className="text-[9px] uppercase text-gray-400 font-bold">Solicitado</div>
                                                        <div className="font-medium text-gray-600 dark:text-gray-300">{formatCurrency(stay.totalValue)}</div>
                                                    </div>
                                                    <div className="text-center">
                                                        <div className="text-[9px] uppercase text-green-500 font-bold">Aprovado</div>
                                                        <div className="font-medium text-green-600 dark:text-green-400">{formatCurrency(stay.approvedValue || 0)}</div>
                                                    </div>
                                                    <div className="text-center">
                                                        <div className="text-[9px] uppercase text-red-500 font-bold">Pago (Mot.)</div>
                                                        <div className="font-medium text-red-600 dark:text-red-400">{formatCurrency(stay.driverPaidValue || 0)}</div>
                                                    </div>
                                                </div>
                                            </div>
                                            {(stay.cteUrl || stay.paymentProofUrl) && (
                                                <div className="flex gap-4 pt-2 mt-1 border-t border-gray-200 dark:border-gray-700/50">
                                                    {stay.cteUrl && (
                                                        <a href={getShipmentAttachmentUrl(stay.cteUrl)} target="_blank" rel="noopener noreferrer" className="text-[10px] flex items-center font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 hover:underline">
                                                            <FileTextIcon className="w-3 h-3 mr-1" /> CTe Complementar
                                                        </a>
                                                    )}
                                                    {stay.paymentProofUrl && (
                                                        <a href={getShipmentAttachmentUrl(stay.paymentProofUrl)} target="_blank" rel="noopener noreferrer" className="text-[10px] flex items-center font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 hover:underline">
                                                            <FileTextIcon className="w-3 h-3 mr-1" /> Comprovante de Pagamento
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {currentUser?.profile !== UserProfile.Embarcador && (
                            <div className="md:col-span-2 mt-2 pt-2 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
                                <DetailItem label="Lucro Operacional do Embarque (Margem + Estadias)">
                                    <p className="text-lg font-bold text-primary dark:text-blue-400">
                                        {formatCurrency(
                                            ((shipment.companyFreightRateSnapshot || cargo?.companyFreightValuePerTon || 0) * shipment.shipmentTonnage) 
                                            - shipment.driverFreightValue 
                                            + (shipmentStays.reduce((acc, stay) => acc + (stay.approvedValue || 0), 0) - shipmentStays.reduce((acc, stay) => acc + (stay.driverPaidValue || 0), 0))
                                        )}
                                    </p>
                                </DetailItem>
                            </div>
                        )}

                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <DetailItem label="Dados Bancários">
                                {isEditingData ? (
                                    <textarea 
                                        className="w-full mt-1 p-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white min-h-[80px]"
                                        value={editedData.bankDetails || ''}
                                        onChange={e => setEditedData({...editedData, bankDetails: e.target.value})}
                                        placeholder="Informe os dados bancários..."
                                    />
                                ) : (
                                    <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-md border dark:border-gray-700">
                                        <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                                            {shipment.bankDetails || <span className="text-gray-400 italic">Não informados</span>}
                                        </p>
                                    </div>
                                )}
                            </DetailItem>
                            <DetailItem label="Referências do Motorista">
                                {isEditingData ? (
                                    <textarea 
                                        className="w-full mt-1 p-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white min-h-[80px]"
                                        value={editedData.driverReferences || ''}
                                        onChange={e => setEditedData({...editedData, driverReferences: e.target.value})}
                                        placeholder="Informe as referências..."
                                    />
                                ) : (
                                    <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-md border dark:border-gray-700">
                                        <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                                            {shipment.driverReferences || <span className="text-gray-400 italic">Não informadas</span>}
                                        </p>
                                    </div>
                                )}
                            </DetailItem>
                        </div>
                        
                        <div className="md:col-span-2">
                            <DetailItem label="Contato do Proprietário">
                                {isEditingData ? (
                                    <input 
                                        type="text"
                                        className="w-full mt-1 p-1.5 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        value={editedData.ownerContact || ''}
                                        onChange={e => setEditedData({...editedData, ownerContact: formatPhone(e.target.value)})}
                                        placeholder="Telefone do proprietário..."
                                    />
                                ) : (
                                    <div className="mt-1 p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-md border border-blue-100 dark:border-blue-800/30">
                                        {shipment.ownerContact ? (
                                            <a 
                                                href={`https://wa.me/${shipment.ownerContact.replace(/\D/g, '')}`} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="text-sm font-semibold text-primary dark:text-blue-400 hover:text-accent dark:hover:text-accent transition-colors flex items-center gap-2 group"
                                                title="Abrir no WhatsApp"
                                            >
                                                {shipment.ownerContact}
                                                <svg className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                                                </svg>
                                            </a>
                                        ) : (
                                            <p className="text-sm text-gray-400 italic font-normal">Não informado</p>
                                        )}
                                    </div>
                                )}
                            </DetailItem>
                        </div>
                        
                        <div className="md:col-span-2">
                            <DetailItem label="Titular da ANTT (CPF/CNPJ)">
                                {isEditingData ? (
                                    <input 
                                        type="text"
                                        className="w-full mt-1 p-1.5 text-sm font-mono border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        value={editedData.anttOwnerIdentifier || ''}
                                        onChange={e => setEditedData({...editedData, anttOwnerIdentifier: e.target.value})}
                                        placeholder="CPF ou CNPJ do titular..."
                                    />
                                ) : (
                                    <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-md border dark:border-gray-700">
                                        <p className="text-sm font-mono text-gray-800 dark:text-gray-200">
                                            {shipment.anttOwnerIdentifier ? formatCpfCnpj(shipment.anttOwnerIdentifier) : <span className="text-gray-400 italic font-sans">Não preenchido no cadastro</span>}
                                        </p>
                                    </div>
                                )}
                            </DetailItem>
                        </div>

                        {shipment.documents && Object.keys(shipment.documents).length > 0 && (
                            <div className="md:col-span-2 mt-4">
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Arquivos do Embarque</h3>
                                <div className="space-y-4">
                                    {Object.entries(shipment.documents).map(([category, urls]) => (
                                        <div key={category}>
                                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">{category}</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {urls.map((url, idx) => {
                                                    // Attempt to extract a cleaner filename from the path
                                                    const urlParts = url.split('/');
                                                    const rawFileName = decodeURIComponent(urlParts[urlParts.length - 1]);
                                                    const fileName = rawFileName.includes('_') ? rawFileName.split('_').slice(2).join('_') : `Anexo ${idx + 1}`;
                                                    
                                                    return (
                                                        <div key={idx} className="flex items-center gap-1 group">
                                                            <a 
                                                                href={url} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="flex-1 flex items-center p-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-md text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                                                            >
                                                                <FileTextIcon size={14} className="mr-2 flex-shrink-0" />
                                                                <span className="truncate">{fileName}</span>
                                                            </a>
                                                            {onDeleteAttachment && (currentUser?.profile === UserProfile.Admin || currentUser?.profile === UserProfile.Diretor || currentUser?.profile === UserProfile.Coordenador) && (
                                                                <button
                                                                    onClick={() => {
                                                                        if (confirm(`Tem certeza que deseja excluir o anexo "${fileName}"?`)) {
                                                                            onDeleteAttachment(shipment.id, url);
                                                                        }
                                                                    }}
                                                                    className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-md transition-colors"
                                                                    title="Excluir Anexo"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {onAddAttachments && (
                            <div className="md:col-span-2 mt-6 pt-6 border-t dark:border-gray-700">
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Anexar Novos Documentos</h3>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                    <div className="flex items-center">
                                        <label className="cursor-pointer bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-2 px-4 rounded-lg inline-flex items-center transition-colors border border-gray-200 dark:border-gray-600 shadow-sm">
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                                            <span className="text-sm font-medium">Selecionar Arquivos</span>
                                            <input type="file" multiple className="hidden" onChange={(e) => {
                                                if (e.target.files) {
                                                    setFilesToAttach(Array.from(e.target.files));
                                                }
                                            }} />
                                        </label>
                                        <span className="ml-3 text-xs text-gray-500 dark:text-gray-400 font-medium">
                                            {filesToAttach.length > 0 ? `${filesToAttach.length} selecionado(s)` : 'Nenhum arquivo'}
                                        </span>
                                    </div>

                                    {filesToAttach.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={handleConfirmAttachments}
                                            disabled={isUploading}
                                            className={`py-2 px-4 rounded-lg text-sm font-bold transition-all shadow-sm flex items-center ${
                                                isUploading 
                                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                                                : 'bg-green-600 text-white hover:bg-green-700'
                                            }`}
                                        >
                                            {isUploading ? (
                                                <>
                                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                    Enviando...
                                                </>
                                            ) : (
                                                'Confirmar e Enviar'
                                            )}
                                        </button>
                                    )}
                                </div>
                                {filesToAttach.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                        {filesToAttach.map((f, i) => (
                                            <div key={i} className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                                <div className="w-1 h-1 bg-gray-400 rounded-full" />
                                                {f.name}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Timestamps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t dark:border-gray-700 pt-4 opacity-75">
                <DetailItem label="Criado em" value={formatDate(shipment.createdAt)} />
                <DetailItem label="Data Programada" value={shipment.scheduledDate ? formatDate(`${shipment.scheduledDate}T${shipment.scheduledTime || '00:00'}`) : null} />
            </div>
            
        </div>
        
        <div className="mt-6 flex justify-end border-t dark:border-gray-700 pt-4">
          <button type="button" onClick={onClose} className="py-2 px-6 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 transition-colors">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShipmentDetailsModal;
