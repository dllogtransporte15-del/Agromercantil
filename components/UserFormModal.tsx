
import React, { useState, useEffect } from 'react';
import type { User, Client, Branch } from '../types';
import { UserProfile } from '../types';
import { useToast } from '../hooks/useToast';
import { autoFormatInput } from '../utils/formatters';
import { X, Copy, CheckCircle2 } from 'lucide-react';

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: User | Omit<User, 'id'>) => void;
  userToEdit: User | null;
  clients: Client[];
  branches: Branch[];
  users?: User[];
  defaultProfile?: UserProfile;
}

const UserFormModal: React.FC<UserFormModalProps> = ({ isOpen, onClose, onSave, userToEdit, clients, branches, users, defaultProfile }) => {
  const { showToast } = useToast();
  const [selectedUserToMirror, setSelectedUserToMirror] = useState<string>('');
  const getInitialState = (): Omit<User, 'id'> => ({
    name: '',
    email: '',
    phone: '',
    profile: defaultProfile || UserProfile.Comercial,
    active: true,
    password: '',
    clientId: undefined,
    branchId: undefined,
    hasCommercialCommission: defaultProfile === UserProfile.GerenteComercial || defaultProfile === UserProfile.Comercial,
    availableForDriverRequests: true,
    agencyRole: 'lider',
    agencyCommissionPercentage: 30,
    agencyLeaderId: undefined,
  });

  const [user, setUser] = useState<Omit<User, 'id' | 'password'> & { password?: string; customPermissions?: any }>(getInitialState());

  useEffect(() => {
    if (isOpen) {
        setSelectedUserToMirror('');
        if(userToEdit) {
            const { password, ...userWithoutPass } = userToEdit;
            setUser({ 
              ...userWithoutPass, 
              availableForDriverRequests: userToEdit.availableForDriverRequests !== false,
              password: '' 
            }); // Don't load existing password
        } else {
            setUser(getInitialState());
        }
    }
  }, [userToEdit, isOpen, defaultProfile]);

  const handleMirrorUser = (sourceUserId: string) => {
    setSelectedUserToMirror(sourceUserId);
    if (!sourceUserId) return;
    const sourceUser = (users || []).find(u => u.id === sourceUserId);
    if (!sourceUser) return;

    setUser(prev => ({
      ...prev,
      profile: sourceUser.profile,
      clientId: sourceUser.clientId,
      branchId: sourceUser.branchId,
      hasCommercialCommission: sourceUser.hasCommercialCommission,
      availableForDriverRequests: sourceUser.availableForDriverRequests !== false,
      agencyRole: sourceUser.agencyRole,
      agencyCommissionPercentage: sourceUser.agencyCommissionPercentage,
      agencyLeaderId: sourceUser.agencyLeaderId,
      customPermissions: sourceUser.customPermissions ? JSON.parse(JSON.stringify(sourceUser.customPermissions)) : undefined,
    }));

    showToast(`Acessos e perfil de "${sourceUser.name}" (${sourceUser.profile}) espelhados com sucesso!`, 'success');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const formattedValue = autoFormatInput(name, value);

    let updatedValue: any = formattedValue;
    if (type === 'checkbox') {
        updatedValue = (e.target as HTMLInputElement).checked;
    }
    
    setUser(prev => {
      const newState = { ...prev, [name]: updatedValue };
      if (name === 'profile' && value !== UserProfile.Cliente) {
        delete newState.clientId;
      }
      if (name === 'profile' && (value === UserProfile.GerenteComercial)) {
        newState.hasCommercialCommission = true;
      }
      return newState;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (user.profile === UserProfile.Cliente && !user.clientId) {
      showToast('Por favor, selecione um cliente para associar a este usuário.', 'warning');
      return;
    }

    if (user.profile === UserProfile.Agenciador && user.agencyRole === 'embarque' && !user.agencyLeaderId) {
      showToast('Por favor, selecione o Agenciador Líder responsável para vincular este Agenciador de Embarque.', 'warning');
      return;
    }

    const userToSave: any = { ...user };

    if (userToEdit) {
      userToSave.id = userToEdit.id;
      // If password field is empty on edit, don't change it
      if (!user.password) {
        delete userToSave.password;
      }
    } else {
      // Password is required for new users
      if (!user.password) {
        showToast('O campo de senha é obrigatório para novos usuários.', 'warning');
        return;
      }
    }

    onSave(userToSave);
  };

  if (!isOpen) return null;

  const agencyLeaders = (users || []).filter(u => 
    u.profile === UserProfile.Agenciador && 
    (u.agencyRole === 'lider' || !u.agencyRole) && 
    u.id !== userToEdit?.id
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 dark:border-gray-700 my-auto">
        <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50 flex-shrink-0">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
            {userToEdit ? 'Editar Usuário' : 'Novo Usuário'}
            {userToEdit && (
              <span className="text-xs sm:text-sm font-mono font-bold px-2.5 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded-md border border-blue-200 dark:border-blue-800">
                ID: {userToEdit.id}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
            <input name="name" value={user.name} onChange={handleChange} placeholder="Nome Completo" className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" required />
            <input name="email" value={user.email} onChange={handleChange} type="email" placeholder="Email de Acesso" className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" required />
            <input name="phone" value={user.phone || ''} onChange={handleChange} placeholder="Telefone" className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" />
            <input name="password" value={user.password} onChange={handleChange} type="password" placeholder={userToEdit ? 'Nova Senha (deixe em branco para manter)' : 'Senha'} className="p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" />
          
            {/* Campo: Espelhar Acesso de Outro Usuário */}
            <div className="p-3.5 bg-gradient-to-r from-blue-50/90 to-indigo-50/90 dark:from-blue-950/40 dark:to-indigo-950/40 rounded-xl border border-blue-200/90 dark:border-blue-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                  <Copy className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Espelhar Acesso de Outro Usuário
                </label>
                <span className="text-[10px] text-blue-700/80 dark:text-blue-300 font-medium">Opcional</span>
              </div>
              <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80">
                Selecione um usuário para clonar automaticamente seu perfil, permissões personalizadas, filial e vínculos.
              </p>
              <select
                value={selectedUserToMirror}
                onChange={(e) => handleMirrorUser(e.target.value)}
                className="p-2 w-full text-xs font-medium border border-blue-300 dark:border-blue-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-pointer shadow-xs"
              >
                <option value="">Selecione um usuário para espelhar acessos...</option>
                {(users || [])
                  .filter(u => u.id !== userToEdit?.id)
                  .map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.profile}) {u.branchId ? `• Filial: ${u.branchId}` : ''} {u.customPermissions ? '• (Permissões Personalizadas)' : ''}
                    </option>
                  ))
                }
              </select>
              {selectedUserToMirror && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Acessos espelhados de: <strong>{(users || []).find(u => u.id === selectedUserToMirror)?.name}</strong></span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Perfil de Acesso</label>
              <select name="profile" value={user.profile} onChange={handleChange} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600">
                {Object.values(UserProfile).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

          {user.profile === UserProfile.Cliente && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Associar ao Cliente</label>
              <select name="clientId" value={user.clientId || ''} onChange={handleChange} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600" required>
                <option value="" disabled>Selecione um cliente...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.nomeFantasia}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Filial Associada</label>
            <select name="branchId" value={user.branchId || ''} onChange={handleChange} className="mt-1 p-2 w-full border rounded dark:bg-gray-700 dark:border-gray-600">
              <option value="">Sem filial (Padrão)</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.city}-{b.state})</option>)}
            </select>
            <p className="text-[10px] text-gray-500 mt-1">Usuários sem filial verão dados de todas as filiais (perfil admin/diretor).</p>
          </div>

          {/* INFORMATIVO E CONFIGURAÇÃO: PERFIL AGENCIADOR (LÍDER vs EMBARQUE) */}
          {user.profile === UserProfile.Agenciador && (
            <div className="p-4 bg-purple-50/80 dark:bg-purple-950/40 rounded-xl border border-purple-200/90 dark:border-purple-800/90 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-purple-900 dark:text-purple-200 uppercase tracking-wider">
                  Configuração de Agenciamento
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/70 text-purple-800 dark:text-purple-300">
                  {user.agencyRole === 'embarque' ? 'Agenciador Embarque' : `Agenciador Líder (${user.agencyCommissionPercentage ?? 30}%)`}
                </span>
              </div>

              {/* SELEÇÃO DA CATEGORIA DE AGENCIADOR */}
              <div>
                <label className="block text-xs font-bold text-purple-900 dark:text-purple-200 mb-1.5">
                  Categoria de Agenciador:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                    (user.agencyRole || 'lider') === 'lider'
                      ? 'bg-purple-100/90 border-purple-400 text-purple-900 dark:bg-purple-900/60 dark:border-purple-600 dark:text-purple-100 font-bold shadow-xs'
                      : 'bg-white border-purple-200 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 hover:bg-purple-50/50'
                  }`}>
                    <input
                      type="radio"
                      name="agencyRole"
                      value="lider"
                      checked={(user.agencyRole || 'lider') === 'lider'}
                      onChange={() => setUser(prev => ({ 
                        ...prev, 
                        agencyRole: 'lider', 
                        agencyLeaderId: undefined 
                      }))}
                      className="mt-0.5 text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                    <div>
                      <span className="font-bold block">Agenciador Líder</span>
                      <span className="text-[10px] font-normal text-purple-800/80 dark:text-purple-300 block">
                        Responsável pela Agência. Centraliza o faturamento e comissões da equipe.
                      </span>
                    </div>
                  </label>

                  <label className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                    user.agencyRole === 'embarque'
                      ? 'bg-purple-100/90 border-purple-400 text-purple-900 dark:bg-purple-900/60 dark:border-purple-600 dark:text-purple-100 font-bold shadow-xs'
                      : 'bg-white border-purple-200 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 hover:bg-purple-50/50'
                  }`}>
                    <input
                      type="radio"
                      name="agencyRole"
                      value="embarque"
                      checked={user.agencyRole === 'embarque'}
                      onChange={() => setUser(prev => ({ 
                        ...prev, 
                        agencyRole: 'embarque',
                        agencyLeaderId: prev.agencyLeaderId || (agencyLeaders[0]?.id || '')
                      }))}
                      className="mt-0.5 text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                    <div>
                      <span className="font-bold block">Agenciador Embarque</span>
                      <span className="text-[10px] font-normal text-purple-800/80 dark:text-purple-300 block">
                        Operador de embarques. Vincula-se a um Líder e consolida na agência dele.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* SE FOR LÍDER: CONFIGURAR PORCENTAGEM DE COMISSÃO */}
              {(user.agencyRole || 'lider') === 'lider' && (
                <div className="pt-2 border-t border-purple-200/70 dark:border-purple-800/70 space-y-2">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <label className="text-xs font-bold text-purple-900 dark:text-purple-200">
                      Porcentagem de Comissão da Agência (%):
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        name="agencyCommissionPercentage"
                        value={user.agencyCommissionPercentage ?? 30}
                        onChange={(e) => setUser(prev => ({ 
                          ...prev, 
                          agencyCommissionPercentage: parseFloat(e.target.value) || 0 
                        }))}
                        placeholder="30"
                        className="p-1.5 text-xs w-20 border rounded dark:bg-gray-700 dark:border-gray-600 font-mono font-bold text-center"
                      />
                      <span className="text-xs text-purple-700 dark:text-purple-300 font-bold">%</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-purple-800 dark:text-purple-300">
                    A comissão de <strong>{user.agencyCommissionPercentage ?? 30}% sobre o Lucro Real Líquido</strong> será calculada sobre todos os embarques solicitados por este Líder e por todos os Agenciadores de Embarque vinculados à sua equipe.
                  </p>
                </div>
              )}

              {/* SE FOR EMBARQUE: SELEÇÃO OBRIGATÓRIA DO LÍDER */}
              {user.agencyRole === 'embarque' && (
                <div className="pt-2 border-t border-purple-200/70 dark:border-purple-800/70 space-y-2">
                  <div>
                    <label className="block text-xs font-bold text-purple-900 dark:text-purple-200 mb-1">
                      Agenciador Líder Responsável <span className="text-rose-500">*</span>:
                    </label>
                    {agencyLeaders.length === 0 ? (
                      <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 rounded-lg text-xs text-amber-800 dark:text-amber-200">
                        Nenhum Agenciador Líder cadastrado no sistema. Cadastre primeiro um Agenciador Líder para poder vincular agenciadores de embarque.
                      </div>
                    ) : (
                      <select
                        name="agencyLeaderId"
                        value={user.agencyLeaderId || ''}
                        onChange={handleChange}
                        className="p-2 w-full text-xs border rounded-lg dark:bg-gray-700 dark:border-gray-600 font-medium"
                        required
                      >
                        <option value="">Selecione o Agenciador Líder...</option>
                        {agencyLeaders.map(leader => {
                          const branch = branches.find(b => b.id === leader.branchId);
                          return (
                            <option key={leader.id} value={leader.id}>
                              {leader.name} {branch ? `(${branch.name} - ${branch.city}/${branch.state})` : '(Sem Filial)'} - Comissão: {leader.agencyCommissionPercentage ?? 30}%
                            </option>
                          );
                        })}
                      </select>
                    )}
                  </div>
                  <p className="text-[11px] text-purple-800 dark:text-purple-300">
                    Todo embarque solicitado por este agenciador será contabilizado automaticamente no faturamento, lucro líquido e comissão da agência do <strong>Agenciador Líder</strong> selecionado.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* COMISSÃO DO EMBARCADOR POR TONELADA */}
          {user.profile === UserProfile.Embarcador && (
            <div className="p-3 bg-amber-50/70 dark:bg-amber-950/40 rounded-xl border border-amber-200/80 dark:border-amber-800/80 space-y-2">
              <label className="block text-xs font-bold text-amber-900 dark:text-amber-200">
                Comissão do Embarcador (R$ / Tonelada):
              </label>
              <p className="text-[11px] text-amber-800 dark:text-amber-300">
                Defina o valor unitário por tonelada que será automaticamente lançado como custo e creditado ao embarcador nos embarques solicitados por este usuário.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs font-bold font-mono text-gray-500">R$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="shipperCommissionRatePerTon"
                  value={user.shipperCommissionRatePerTon ?? ''}
                  onChange={(e) => setUser(prev => ({ ...prev, shipperCommissionRatePerTon: parseFloat(e.target.value) || undefined }))}
                  placeholder="Ex: 2.00"
                  className="p-1.5 text-xs w-36 border rounded dark:bg-gray-700 dark:border-gray-600 font-mono font-bold"
                />
                <span className="text-xs text-gray-600 dark:text-gray-300 font-semibold">/ tonelada</span>
              </div>
            </div>
          )}

          {/* ATIVAR COMISSÃO COMERCIAL (GERENTE COMERCIAL) - Disponível apenas para Comercial */}
          {user.profile === UserProfile.Comercial && (
            <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 rounded-xl border border-blue-200/80 dark:border-blue-800/80 space-y-2">
              <div className="flex items-center">
                <input 
                  type="checkbox" 
                  id="hasCommercialCommission" 
                  name="hasCommercialCommission" 
                  checked={user.hasCommercialCommission || false} 
                  onChange={handleChange} 
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
                <label htmlFor="hasCommercialCommission" className="ml-2 block text-sm font-bold text-gray-900 dark:text-gray-200 cursor-pointer">
                  Ativar Comissão Comercial (Gerente Comercial)
                </label>
              </div>
              <p className="text-[11px] text-gray-600 dark:text-gray-400 pl-6">
                Personalize a base de cálculo individual deste comercial (Fixo R$, % Matriz e % Filiais):
              </p>

              {user.hasCommercialCommission && (
                <div className="space-y-3 pt-2 border-t border-blue-200/60 dark:border-blue-800/60">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Tipo de Base de Cálculo do Faturamento:
                    </label>
                    <div className="flex items-center gap-4 text-xs font-bold">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input 
                          type="radio" 
                          name="commercialCalculationMode" 
                          value="bruto" 
                          checked={(user.commercialCalculationMode || 'bruto') === 'bruto'} 
                          onChange={() => setUser(prev => ({ ...prev, commercialCalculationMode: 'bruto' }))} 
                          className="text-primary focus:ring-primary"
                        />
                        <span>Faturamento BRUTO</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input 
                          type="radio" 
                          name="commercialCalculationMode" 
                          value="liquido" 
                          checked={user.commercialCalculationMode === 'liquido'} 
                          onChange={() => setUser(prev => ({ ...prev, commercialCalculationMode: 'liquido' }))} 
                          className="text-primary focus:ring-primary"
                        />
                        <span>Faturamento LÍQUIDO (Margem)</span>
                      </label>
                    </div>
                  </div>

                  {/* MODALIDADE AGÊNCIA (REPARTIDA) */}
                  <div className="p-2.5 bg-purple-50/60 dark:bg-purple-950/40 rounded-lg border border-purple-200/70 dark:border-purple-800/70 space-y-2">
                    <div className="flex items-center">
                      <input 
                        type="checkbox" 
                        id="commercialIsAgencyMode" 
                        name="commercialIsAgencyMode" 
                        checked={user.commercialIsAgencyMode || false} 
                        onChange={(e) => setUser(prev => ({ ...prev, commercialIsAgencyMode: e.target.checked }))} 
                        className="h-3.5 w-3.5 rounded border-purple-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                      />
                      <label htmlFor="commercialIsAgencyMode" className="ml-2 block text-xs font-bold text-purple-950 dark:text-purple-200 cursor-pointer">
                        Modalidade Agência (Repartir Comissão entre Membros)
                      </label>
                    </div>
                    <p className="text-[10px] text-purple-700 dark:text-purple-300 leading-tight">
                      Quando ativado, a comissão das filiais selecionadas é dividida igualmente entre os membros comerciais da mesma agência/filiais ou conforme a porcentagem configurada abaixo.
                    </p>

                    {user.commercialIsAgencyMode && (
                      <div className="pt-2 border-t border-purple-200/60 dark:border-purple-800/60">
                        <label className="block text-[10px] font-bold text-purple-900 dark:text-purple-200 mb-1">
                          Participação Individual na Agência (%):
                        </label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            step="1" 
                            min="0" 
                            max="100" 
                            name="commercialAgencySharePercent" 
                            value={user.commercialAgencySharePercent ?? ''} 
                            onChange={(e) => setUser(prev => ({ ...prev, commercialAgencySharePercent: parseFloat(e.target.value) || undefined }))} 
                            placeholder="Automático (Divisão Igual)" 
                            className="p-1.5 text-xs w-48 border rounded dark:bg-gray-700 dark:border-gray-600 font-mono font-bold"
                          />
                          <span className="text-[10px] text-gray-500">(deixe vazio para divisão igual)</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300">Fixo (R$)</label>
                      <input 
                        type="number" 
                        step="100" 
                        name="commercialFixedSalary" 
                        value={user.commercialFixedSalary ?? 5000} 
                        onChange={(e) => setUser(prev => ({ ...prev, commercialFixedSalary: parseFloat(e.target.value) || 0 }))} 
                        className="mt-1 p-1.5 text-xs w-full border rounded dark:bg-gray-700 dark:border-gray-600 font-mono font-bold"
                        placeholder="5000"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300">% Matriz</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        name="commercialMatrizRate" 
                        value={user.commercialMatrizRate ?? 0.20} 
                        onChange={(e) => setUser(prev => ({ ...prev, commercialMatrizRate: parseFloat(e.target.value) || 0 }))} 
                        className="mt-1 p-1.5 text-xs w-full border rounded dark:bg-gray-700 dark:border-gray-600 font-mono font-bold"
                        placeholder="0.20"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300">% Filiais</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        name="commercialFiliaisRate" 
                        value={user.commercialFiliaisRate ?? 0.10} 
                        onChange={(e) => setUser(prev => ({ ...prev, commercialFiliaisRate: parseFloat(e.target.value) || 0 }))} 
                        className="mt-1 p-1.5 text-xs w-full border rounded dark:bg-gray-700 dark:border-gray-600 font-mono font-bold"
                        placeholder="0.10"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Filiais Selecionadas p/ Comissão (% Filiais):
                    </label>
                    <div className="grid grid-cols-2 gap-2 max-h-28 overflow-y-auto p-2 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 text-xs">
                      {branches.filter(b => !b.name.toLowerCase().includes('matriz')).map(b => {
                        const nonMatrizIds = branches.filter(br => !br.name.toLowerCase().includes('matriz')).map(br => br.id);
                        const selectedIds = user.commercialSelectedBranchIds || nonMatrizIds;
                        const isChecked = selectedIds.includes(b.id);

                        return (
                          <label key={b.id} className="flex items-center gap-2 cursor-pointer font-medium">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                const updated = checked 
                                  ? [...selectedIds, b.id]
                                  : selectedIds.filter(id => id !== b.id);
                                setUser(prev => ({ ...prev, commercialSelectedBranchIds: updated }));
                              }}
                              className="rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <span>{b.name} ({b.state})</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center">
              <input type="checkbox" id="active" name="active" checked={user.active} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"/>
              <label htmlFor="active" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">Usuário Ativo</label>
            </div>

            {user.profile !== UserProfile.Cliente && user.profile !== UserProfile.Motorista && (
              <div className="flex items-center p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
                <input 
                  type="checkbox" 
                  id="availableForDriverRequests" 
                  name="availableForDriverRequests" 
                  checked={user.availableForDriverRequests !== false} 
                  onChange={handleChange} 
                  className="h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="availableForDriverRequests" className="ml-2.5 block text-xs font-semibold text-emerald-900 dark:text-emerald-300 cursor-pointer">
                  Disponível para receber direcionamento de solicitações de carga no App do Motorista
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-5 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50 flex-shrink-0">
            <div>
              {userToEdit && (
                <button 
                  type="button" 
                  onClick={() => {
                    setUser(prev => ({ ...prev, password: 'agromercantil2026', requirePasswordChange: true }));
                    showToast('Senha resetada para "agromercantil2026". Atenção: A alteração só será gravada ao clicar em "SALVAR".', 'info', 6000);
                  }} 
                  className="py-2 px-3 sm:px-4 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium text-xs sm:text-sm flex items-center gap-1.5 shadow-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l3.9-3.9a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.9 3.9V3.75a.75.75 0 011.5 0v10.493z" clipRule="evenodd" />
                  </svg>
                  Resetar Senha
                </button>
              )}
            </div>
            <div className="flex space-x-3">
              <button type="button" onClick={onClose} className="py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 font-medium text-sm transition-colors">
                Cancelar
              </button>
              <button type="submit" className="py-2 px-5 bg-primary text-white rounded-lg hover:bg-primary-dark shadow-md font-medium text-sm transition-colors">
                Salvar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserFormModal;