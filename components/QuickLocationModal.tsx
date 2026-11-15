import React, { useState, useEffect } from 'react';
import type { ExpedidorRecebedor } from '../types';
import { saveExpedidorRecebedor } from '../utils/locationStorage';
import { MapPin, X, Building2, User, Phone, MessageSquare, Check, ShieldCheck, Link2 } from 'lucide-react';

interface QuickLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (location: ExpedidorRecebedor) => void;
  initialName?: string;
  initialCity?: string;
  initialMapLink?: string;
  existingLocation?: ExpedidorRecebedor | null;
}

export const QuickLocationModal: React.FC<QuickLocationModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  initialName = '',
  initialCity = '',
  initialMapLink = '',
  existingLocation = null
}) => {
  const [name, setName] = useState('');
  const [documentType, setDocumentType] = useState<'CNPJ' | 'CPF'>('CNPJ');
  const [documentNumber, setDocumentNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [isWhatsapp, setIsWhatsapp] = useState(true);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [mapLink, setMapLink] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Máscaras de CPF, CNPJ e Telefone
  const formatDocument = (val: string, type: 'CNPJ' | 'CPF'): string => {
    const digits = val.replace(/\D/g, '');
    if (type === 'CPF') {
      return digits
        .slice(0, 11)
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
      return digits
        .slice(0, 14)
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    }
  };

  const formatPhone = (val: string): string => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 10) {
      return digits
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d{1,4})$/, '$1-$2');
    }
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
  };

  useEffect(() => {
    if (isOpen) {
      if (existingLocation) {
        setName(existingLocation.name || '');
        setDocumentType(existingLocation.documentType || 'CNPJ');
        setDocumentNumber(existingLocation.documentNumber || '');
        setPhone(existingLocation.phone || '');
        setIsWhatsapp(existingLocation.isWhatsapp !== undefined ? existingLocation.isWhatsapp : true);
        setCity(existingLocation.city || '');
        setState(existingLocation.state || '');
        setMapLink(existingLocation.mapLink || '');
        setNotes(existingLocation.notes || '');
      } else {
        setName(initialName || '');
        setDocumentType('CNPJ');
        setDocumentNumber('');
        setPhone('');
        setIsWhatsapp(true);
        setCity(initialCity || '');
        setState('');
        setMapLink(initialMapLink || '');
        setNotes('');
      }
      setErrorMsg('');
    }
  }, [isOpen, initialName, initialCity, initialMapLink, existingLocation]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('O Nome do Local é obrigatório.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const recordData: Partial<ExpedidorRecebedor> & { name: string } = {
        id: existingLocation?.id,
        name: name.trim(),
        documentType,
        documentNumber: documentNumber.trim(),
        phone: phone.trim(),
        isWhatsapp,
        classification: 'Ambos', // REGRA: Sempre fixo como "Ambos"
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        mapLink: mapLink.trim() || undefined,
        notes: notes.trim() || undefined,
        createdAt: existingLocation?.createdAt
      };

      const updatedList = await saveExpedidorRecebedor(recordData);
      const saved = updatedList.find(i => i.name.toLowerCase().trim() === name.toLowerCase().trim()) || {
        ...recordData,
        id: existingLocation?.id || `LOC-${Date.now()}`,
        classification: 'Ambos',
        createdAt: new Date().toISOString()
      } as ExpedidorRecebedor;

      onSaved(saved);
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar local:', err);
      setErrorMsg(err?.message || 'Falha ao salvar local.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Alto Contraste Garantido */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                {existingLocation ? 'Editar Expedidor/Recebedor' : 'Cadastrar Expedidor/Recebedor'}
              </h3>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
                Ponto de Origem ou Destino da Carga (Fazenda, Galpão, Porto)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 bg-white dark:bg-slate-900">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-xs font-bold">
              {errorMsg}
            </div>
          )}

          {/* Nome do Local */}
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide mb-1.5">
              Nome do Local <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Arko Sacramento, Fazenda Boa Esperança, Galpão Central..."
              className="w-full py-2.5 px-3 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:ring-2 focus:ring-amber-600 focus:border-amber-600 outline-none shadow-2xs"
              autoFocus
            />
          </div>

          {/* Documento Fiscal do Local */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                Documento Fiscal do Local
              </label>
              <div className="inline-flex p-0.5 bg-slate-200 dark:bg-slate-700 rounded-lg text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setDocumentType('CNPJ');
                    setDocumentNumber('');
                  }}
                  className={`px-3 py-1 rounded-md transition-all ${
                    documentType === 'CNPJ'
                      ? 'bg-amber-600 text-white shadow-xs font-bold'
                      : 'text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white font-semibold'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 inline mr-1" /> CNPJ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDocumentType('CPF');
                    setDocumentNumber('');
                  }}
                  className={`px-3 py-1 rounded-md transition-all ${
                    documentType === 'CPF'
                      ? 'bg-amber-600 text-white shadow-xs font-bold'
                      : 'text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white font-semibold'
                  }`}
                >
                  <User className="w-3.5 h-3.5 inline mr-1" /> CPF
                </button>
              </div>
            </div>
            <input
              type="text"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(formatDocument(e.target.value, documentType))}
              placeholder={documentType === 'CNPJ' ? '00.000.000/0000-00' : '000.000.000-00'}
              className="w-full py-2 px-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:ring-2 focus:ring-amber-600 outline-none"
            />
          </div>

          {/* Telefone de Contato e WhatsApp */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                Telefone de Contato
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isWhatsapp}
                  onChange={(e) => setIsWhatsapp(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                />
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" /> É WhatsApp?
                </span>
              </label>
            </div>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(00) 00000-0000"
              className="w-full py-2 px-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:ring-2 focus:ring-amber-600 outline-none"
            />
            <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              * Nota: O telefone fica registrado no sistema para contato, mas não é exposto na Ordem de Carregamento impressa.
            </p>
          </div>

          {/* Cidade e UF */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide mb-1">
                Cidade (Opcional)
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ex: Sacramento, SP"
                className="w-full py-2 px-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:ring-2 focus:ring-amber-600 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide mb-1">
                UF
              </label>
              <input
                type="text"
                maxLength={2}
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase())}
                placeholder="Ex: MG"
                className="w-full py-2 px-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:ring-2 focus:ring-amber-600 uppercase outline-none text-center"
              />
            </div>
          </div>

          {/* Link Google Maps */}
          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide mb-1 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              Link do Google Maps (Opcional)
            </label>
            <input
              type="text"
              value={mapLink}
              onChange={(e) => setMapLink(e.target.value)}
              placeholder="https://maps.app.goo.gl/..."
              className="w-full py-2 px-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs font-mono font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:ring-2 focus:ring-amber-600 outline-none"
            />
          </div>

          {/* Classificação Fixa */}
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

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:scale-95 rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {isSubmitting ? 'Salvando...' : 'Salvar e Selecionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
