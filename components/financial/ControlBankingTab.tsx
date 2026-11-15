import React, { useState } from 'react';
import type { BankAccount } from '../../types';
import { Landmark, Plus, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, DollarSign, Wallet } from 'lucide-react';

interface ControlBankingTabProps {
  accounts: BankAccount[];
  onAddAccount: (acc: Omit<BankAccount, 'id' | 'createdAt'>) => void;
  onUpdateAccountBalance: (id: string, newBalance: number) => void;
}

export const ControlBankingTab: React.FC<ControlBankingTabProps> = ({
  accounts,
  onAddAccount,
  onUpdateAccountBalance,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [newBalanceInput, setNewBalanceInput] = useState('');

  // Form State
  const [bankName, setBankName] = useState('');
  const [agency, setAgency] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState<'corrente' | 'poupanca' | 'aplicacao'>('corrente');
  const [initialBalance, setInitialBalance] = useState('');
  const [pixKey, setPixKey] = useState('');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const totalCurrentBalance = accounts.reduce((s, a) => s + (a.active ? a.currentBalance : 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName || !agency || !accountNumber) return;

    onAddAccount({
      bankName,
      agency,
      accountNumber,
      accountType,
      initialBalance: parseFloat(initialBalance) || 0,
      currentBalance: parseFloat(initialBalance) || 0,
      active: true,
      pixKey: pixKey || undefined,
    });

    setBankName('');
    setAgency('');
    setAccountNumber('');
    setInitialBalance('');
    setPixKey('');
    setIsModalOpen(false);
  };

  const handleSaveBalanceAdjustment = () => {
    if (!editingAccount) return;
    const val = parseFloat(newBalanceInput);
    if (!isNaN(val)) {
      onUpdateAccountBalance(editingAccount.id, val);
    }
    setEditingAccount(null);
    setNewBalanceInput('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-2xl">
            <Landmark className="w-7 h-7" />
          </div>
          <div>
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">
              Controladoria Bancária
            </span>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
              Conferência de Contas e Saldos
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Controle dos saldos bancários, conferência de extrato e conciliação de tesouraria.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-xs text-slate-400 font-semibold block">Saldo Consolidado em Contas</span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalCurrentBalance)}
            </span>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold shadow-md shadow-amber-600/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Nova Conta
          </button>
        </div>
      </div>

      {/* Account Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {accounts.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 shadow-sm">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Landmark className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Nenhuma conta bancária cadastrada ou ativa
            </h4>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-6">
              Todos os saldos fictícios foram removidos. O saldo consolidado em contas é de R$ 0,00. Cadastre uma nova conta ou vincule sua conciliação bancária OFX para acompanhar os saldos reais.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold shadow-md shadow-amber-600/20 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Cadastrar Conta Bancária
            </button>
          </div>
        ) : (
          accounts.map((acc) => (
            <div 
              key={acc.id}
              className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow relative space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                    {acc.accountType === 'corrente' ? 'Conta Corrente' : acc.accountType === 'aplicacao' ? 'Aplicação Financeira' : 'Poupança'}
                  </span>
                  <h4 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{acc.bankName}</h4>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  acc.active ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-slate-100 text-slate-500'
                }`}>
                  {acc.active ? 'Ativa' : 'Inativa'}
                </span>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-2xl">
                <div className="flex justify-between">
                  <span>Agência:</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{acc.agency}</span>
                </div>
                <div className="flex justify-between">
                  <span>Conta:</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{acc.accountNumber}</span>
                </div>
                {acc.pixKey && (
                  <div className="flex justify-between">
                    <span>Chave PIX:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{acc.pixKey}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block font-semibold">Saldo Atual</span>
                  <span className={`text-xl font-extrabold ${acc.currentBalance >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600'}`}>
                    {formatCurrency(acc.currentBalance)}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setEditingAccount(acc);
                    setNewBalanceInput(acc.currentBalance.toString());
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold"
                >
                  Ajustar Saldo
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Nova Conta */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Adicionar Conta Bancária</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nome do Banco / Instituição</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Banco do Brasil, Itaú, Bradesco..."
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Agência</label>
                  <input
                    type="text"
                    required
                    placeholder="0000"
                    value={agency}
                    onChange={(e) => setAgency(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Conta Corrente</label>
                  <input
                    type="text"
                    required
                    placeholder="00000-0"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Tipo de Conta</label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
                  >
                    <option value="corrente">Conta Corrente</option>
                    <option value="aplicacao">Aplicação</option>
                    <option value="poupanca">Poupança</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Saldo Inicial (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Chave PIX (Opcional)</label>
                <input
                  type="text"
                  placeholder="CNPJ, E-mail ou Telefone"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold"
                >
                  Salvar Conta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ajuste de Saldo */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Conferência de Saldo</h3>
            <p className="text-xs text-slate-500 mb-4">{editingAccount.bankName} - Ag: {editingAccount.agency} / Cc: {editingAccount.accountNumber}</p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Novo Saldo Real Conferido (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newBalanceInput}
                  onChange={(e) => setNewBalanceInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-300 text-slate-700 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveBalanceAdjustment}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold"
              >
                Atualizar Saldo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
