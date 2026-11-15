import React, { useState, useMemo } from 'react';
import Header from '../components/Header';
import type { ExpedidorRecebedor, User, ProfilePermissions } from '../types';
import { can } from '../auth';
import { isDemoUser } from '../auth';
import { 
  MapPin, Plus, Search, Edit2, Trash2, Building2, Phone, 
  MessageSquare, ExternalLink, ShieldCheck, CheckCircle2, X, Check
} from 'lucide-react';

interface LocationsPageProps {
  locations: ExpedidorRecebedor[];
  onSaveLocation: (location: ExpedidorRecebedor | Omit<ExpedidorRecebedor, 'id' | 'createdAt'>) => Promise<void> | void;
  onDeleteLocation: (id: string) => Promise<void> | void;
  currentUser: User | null;
  profilePermissions: ProfilePermissions;
}

export default function LocationsPage({
  locations = [],
  onSaveLocation,
  onDeleteLocation,
  currentUser,
  profilePermissions
}: LocationsPageProps) {
  const isDemo = isDemoUser(currentUser);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<ExpedidorRecebedor | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [documentType, setDocumentType] = useState<'CNPJ' | 'CPF'>('CNPJ');
  const [documentNumber, setDocumentNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [isWhatsapp, setIsWhatsapp] = useState(true);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [mapLink, setMapLink] = useState('');
  const [notes, setNotes] = useState('');

  const canCreate = !isDemo && can('create', currentUser, 'locations', profilePermissions);
  const canUpdate = !isDemo && can('update', currentUser, 'locations', profilePermissions);
  const canDelete = !isDemo && can('delete', currentUser, 'locations', profilePermissions);

  const openNewModal = () => {
    setEditingLocation(null);
    setName('');
    setDocumentType('CNPJ');
    setDocumentNumber('');
    setPhone('');
    setIsWhatsapp(true);
    setCity('');
    setState('');
    setMapLink('');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (loc: ExpedidorRecebedor) => {
    setEditingLocation(loc);
    setName(loc.name);
    setDocumentType(loc.documentType || 'CNPJ');
    setDocumentNumber(loc.documentNumber || '');
    setPhone(loc.phone || '');
    setIsWhatsapp(loc.isWhatsapp ?? true);
    setCity(loc.city || '');
    setState(loc.state || '');
    setMapLink(loc.mapLink || '');
    setNotes(loc.notes || '');
    setIsModalOpen(true);
  };

  const formatDocument = (value: string, type: 'CNPJ' | 'CPF') => {
    const digits = value.replace(/\D/g, '');
    if (type === 'CPF') {
      return digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
        .substring(0, 14);
    }
    return digits
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
      .substring(0, 18);
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 10) {
      return digits
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d{1,4})$/, '$1-$2')
        .substring(0, 14);
    }
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d{1,4})$/, '$1-$2')
      .substring(0, 15);
  };

  const handleDocumentChange = (val: string) => {
    setDocumentNumber(formatDocument(val, documentType));
  };

  const handlePhoneChange = (val: string) => {
    setPhone(formatPhone(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Informe o Nome do Local.');
      return;
    }

    const payload = {
      name: name.trim(),
      documentType,
      documentNumber: documentNumber.trim(),
      phone: phone.trim(),
      isWhatsapp,
      classification: 'Ambos' as const, // SEMPRE "Ambos" (Expedidor/Recebedor)
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      mapLink: mapLink.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    if (editingLocation) {
      await onSaveLocation({ ...editingLocation, ...payload });
    } else {
      await onSaveLocation(payload);
    }

    setIsModalOpen(false);
  };

  const handleDelete = async (id: string, locName: string) => {
    if (isDemo) {
      alert('Usuário em modo demonstração possui apenas visualização.');
      return;
    }
    if (confirm(`Deseja realmente excluir o cadastro de "${locName}"?`)) {
      await onDeleteLocation(id);
    }
  };

  // Filtragem com busca rápida
  const filteredLocations = useMemo(() => {
    if (!searchTerm.trim()) return locations;
    const term = searchTerm.toLowerCase().trim();
    return locations.filter(loc => 
      loc.name.toLowerCase().includes(term) ||
      (loc.documentNumber && loc.documentNumber.includes(term)) ||
      (loc.phone && loc.phone.includes(term)) ||
      (loc.city && loc.city.toLowerCase().includes(term))
    );
  }, [locations, searchTerm]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 pb-16">
      <Header title="Cadastro de Expedidor/Recebedor" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* Banner Informativo & Ações */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Locais de Carga & Descarga (Expedidor / Recebedor)
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                Gerencie galpões, fazendas, portos e empresas vinculados aos pontos de origem e destino das cargas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {canCreate && (
              <button
                type="button"
                onClick={openNewModal}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Expedidor/Recebedor</span>
              </button>
            )}
          </div>
        </div>

        {/* Barra de Filtro e Totalizadores */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl border border-slate-200 dark:border-gray-700 shadow-xs">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por Nome do Local, CNPJ/CPF, Telefone ou Cidade..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-gray-700/60 border border-slate-200 dark:border-gray-600 rounded-lg text-xs outline-none focus:border-emerald-500 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-gray-300">
            <span className="px-2.5 py-1 bg-slate-100 dark:bg-gray-700 rounded-md">
              Total: <strong>{filteredLocations.length}</strong> locais
            </span>
            <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-md border border-emerald-200 dark:border-emerald-800">
              Classificação: <strong>Ambos (Expedidor/Recebedor)</strong>
            </span>
          </div>
        </div>

        {/* Tabela de Locais */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-gray-900/60 border-b border-slate-200 dark:border-gray-700 text-slate-500 dark:text-gray-400 uppercase font-black tracking-wider text-[10px]">
                  <th className="py-3 px-4">Nome do Local</th>
                  <th className="py-3 px-4">CNPJ / CPF</th>
                  <th className="py-3 px-4">Telefone / Contato</th>
                  <th className="py-3 px-4">Classificação</th>
                  <th className="py-3 px-4">Cidade / Localização</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
                {filteredLocations.length > 0 ? (
                  filteredLocations.map((loc) => (
                    <tr 
                      key={loc.id} 
                      className="hover:bg-slate-50/70 dark:hover:bg-gray-700/30 transition-colors"
                    >
                      {/* Nome do Local */}
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>{loc.name}</span>
                        </div>
                      </td>

                      {/* CNPJ / CPF */}
                      <td className="py-3 px-4 font-mono font-medium text-slate-700 dark:text-gray-300">
                        {loc.documentNumber ? (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-gray-700 border border-slate-200 dark:border-gray-600">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">{loc.documentType}:</span>
                            <span>{loc.documentNumber}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Não informado</span>
                        )}
                      </td>

                      {/* Telefone */}
                      <td className="py-3 px-4">
                        {loc.phone ? (
                          <div className="flex items-center gap-1.5 font-mono">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{loc.phone}</span>
                            {loc.isWhatsapp && (
                              <span 
                                title="Número com WhatsApp ativo"
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold"
                              >
                                <MessageSquare className="w-2.5 h-2.5" />
                                <span>WhatsApp</span>
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Não informado</span>
                        )}
                      </td>

                      {/* Classificação */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold text-[10px]">
                          <ShieldCheck className="w-3 h-3" />
                          Ambos (Expedidor/Recebedor)
                        </span>
                      </td>

                      {/* Cidade / Localização */}
                      <td className="py-3 px-4 text-slate-600 dark:text-gray-300">
                        <div className="flex items-center gap-2">
                          <span>{loc.city ? `${loc.city}${loc.state ? ` - ${loc.state}` : ''}` : '---'}</span>
                          {loc.mapLink && (
                            <a
                              href={loc.mapLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-600 hover:text-emerald-700 inline-flex items-center"
                              title="Abrir no Google Maps"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {canUpdate && (
                            <button
                              type="button"
                              onClick={() => openEditModal(loc)}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                              title="Editar Expedidor/Recebedor"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDelete(loc.id, loc.name)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      Nenhum local de Expedidor/Recebedor cadastrado{searchTerm ? ' para o filtro atual' : ''}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {/* Modal de Criação / Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
            
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-sm shrink-0">
                  <MapPin className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                    {editingLocation ? 'Editar Expedidor/Recebedor' : 'Novo Expedidor/Recebedor'}
                  </h3>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
                    Ponto de Origem/Destino de Cargas (Fazenda, Galpão, Porto, etc.)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 bg-white dark:bg-slate-900">
              
              {/* Nome do Local */}
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide mb-1.5">
                  Nome do Local <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Fazenda Boa Esperança, Galpão Central, Porto de Santos..."
                  className="w-full py-2.5 px-3 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:ring-2 focus:ring-amber-600 focus:border-amber-600 outline-none shadow-2xs"
                />
              </div>

              {/* Documento: CNPJ ou CPF */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-100 uppercase mb-1">
                      Tipo Doc.
                    </label>
                    <select
                      value={documentType}
                      onChange={(e) => {
                        const newType = e.target.value as 'CNPJ' | 'CPF';
                        setDocumentType(newType);
                        setDocumentNumber(formatDocument(documentNumber, newType));
                      }}
                      className="w-full px-2.5 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-600"
                    >
                      <option value="CNPJ">CNPJ</option>
                      <option value="CPF">CPF</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-100 uppercase mb-1">
                      Número do {documentType}
                    </label>
                    <input
                      type="text"
                      value={documentNumber}
                      onChange={(e) => handleDocumentChange(e.target.value)}
                      placeholder={documentType === 'CNPJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-mono font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-amber-600"
                    />
                  </div>
                </div>
              </div>

              {/* Telefone e WhatsApp */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-100 uppercase mb-1 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      Telefone
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="(00) 00000-0000"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-mono font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-amber-600"
                    />
                  </div>

                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 select-none">
                      <input
                        type="checkbox"
                        checked={isWhatsapp}
                        onChange={(e) => setIsWhatsapp(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                      />
                      <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                        <MessageSquare className="w-3.5 h-3.5" /> É WhatsApp?
                      </span>
                    </label>
                  </div>
                </div>
                <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  * Registrado internamente para contato. Não é exibido na Ordem de Carregamento impressa.
                </p>
              </div>

              {/* Classificação do Local (Sempre Ambos) */}
              <div className="p-3 bg-amber-50/90 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                    Classificação do Local
                  </div>
                  <div className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1 mt-0.5">
                    <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Ambos (Expedidor / Recebedor)
                  </div>
                </div>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-950 dark:text-amber-100 font-bold">
                  Fixo Padrão
                </span>
              </div>

              {/* Cidade e Link Maps */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide mb-1">
                    Cidade / UF (Opcional)
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ex: Rondonópolis, MT"
                    className="w-full py-2 px-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:ring-2 focus:ring-amber-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide mb-1">
                    Link Google Maps (Opcional)
                  </label>
                  <input
                    type="url"
                    value={mapLink}
                    onChange={(e) => setMapLink(e.target.value)}
                    placeholder="https://maps.google.com/..."
                    className="w-full py-2 px-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs font-mono font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:ring-2 focus:ring-amber-600 outline-none"
                  />
                </div>
              </div>

              {/* Botões */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  {editingLocation ? 'Salvar Alterações' : 'Cadastrar Local'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
