import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  Cpu,
  Users,
  Zap,
  BarChart3,
  CheckCircle2,
  ArrowRight,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  TrendingUp,
  Settings2,
  Handshake,
  Info,
  Server,
  Layout,
  X,
  Send,
  User,
  LogIn,
  Menu
} from 'lucide-react';

// Fix for default marker icon in Leaflet + React
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export interface InstitutionalWebsitePageProps {
  companyLogo?: string | null;
  isLoggedIn?: boolean;
  onGoToSystem?: () => void;
  onOpenPresentation?: () => void;
}

const HUBS: Array<{
  name: string;
  coords: [number, number];
  description: string;
  stats: string;
}> = [
  {
    name: 'Sorriso - MT',
    coords: [-12.5509, -55.7222],
    description: 'Capital Nacional do Agronegócio. Principal polo de produção de soja e milho.',
    stats: 'Top 1 VBP Nacional'
  },
  {
    name: 'Rio Verde - GO',
    coords: [-17.7941, -50.9208],
    description: 'Centro de excelência em grãos e avicultura com tecnologia de ponta.',
    stats: 'Polo Logístico Central'
  },
  {
    name: 'Barreiras - BA',
    coords: [-12.1524, -44.9961],
    description: 'Coração da região Matopiba. Expansão agrícola de alta produtividade.',
    stats: 'Fronteira Agrícola'
  },
  {
    name: 'Cascavel - PR',
    coords: [-24.9555, -53.4552],
    description: 'Polo tecnológico da Região Sul. Referência em cooperativas e exportação.',
    stats: 'Eixo Mercosul'
  },
  {
    name: 'Dourados - MS',
    coords: [-22.2235, -54.8125],
    description: 'Polo integrador de agricultura e pecuária no Centro-Oeste.',
    stats: 'Integração Lavoura-Pecuária'
  },
  {
    name: 'Uberlândia - MG',
    coords: [-18.9113, -48.2622],
    description: 'Hub logístico estratégico conectando o Sudeste ao Centro-Oeste.',
    stats: 'Centro de Distribuição'
  }
];

const PARTNERS = [
  { name: 'Rodo Chagas', logo: '/partners/rodo-chagas.png' },
  { name: 'TransCunha', logo: '/partners/transcunha.png' },
  { name: 'Sementes', logo: '/partners/sementes.png' },
  { name: 'G3 Agro', logo: '/partners/g3-agro.png' },
  { name: 'Novo Parceiro 1', logo: '/partners/extra_1.png' },
  { name: 'Grao Expresso', logo: '/partners/extra_2.png' },
  { name: 'Pif Paf', logo: '/partners/extra_3.png' },
  { name: 'Avivar', logo: '/partners/extra_4.png' },
];

const SCROLL_PARTNERS = [
  ...PARTNERS,
  ...PARTNERS,
  ...PARTNERS,
  ...PARTNERS,
  ...PARTNERS,
  ...PARTNERS,
];

interface LogoProps {
  logoSrc?: string;
}

const SiteLogo: React.FC<LogoProps> = ({ logoSrc }) => (
  <img
    src={logoSrc || '/logo.png'}
    alt="DLLOG Logo"
    className="h-[44px] w-auto object-contain transition-transform duration-300 group-hover:scale-[1.02]"
  />
);

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    whatsapp: '',
    email: ''
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const message = `Olá! Meu nome é ${formData.name}. 
Desejo conhecer o sistema DLLOG e desenvolver um para minha operação.
Contato:
WhatsApp: ${formData.whatsapp}
Email: ${formData.email}`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/5564993058754?text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank');
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-brand-secondary/80 backdrop-blur-sm z-[100] transition-all animate-fadeIn"
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-[101] p-6">
        <div className="bg-white rounded-3xl shadow-2xl border border-brand-primary/20 overflow-hidden relative">
          {/* Header Gradient */}
          <div className="bg-gold-gradient h-2 w-full" />

          <div className="p-8">
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-6 right-6 text-brand-secondary/30 hover:text-brand-secondary transition-colors cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Logo/Icon */}
            <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center text-brand-primary mb-6">
              <Zap className="w-8 h-8" />
            </div>

            <h3 className="text-2xl font-extrabold text-brand-secondary mb-2 tracking-tight">
              Vamos impulsionar sua operação
            </h3>
            <p className="text-brand-secondary/60 text-sm mb-8 leading-relaxed">
              Preencha os dados abaixo e nosso especialista entrará em contato em minutos.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-brand-secondary/40 uppercase tracking-widest ml-1">
                  Nome Completo
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-brand-primary group-focus-within:text-brand-primary transition-colors" />
                  </div>
                  <input
                    required
                    type="text"
                    placeholder="Como podemos te chamar?"
                    className="block w-full pl-11 pr-4 py-4 bg-brand-neutral border border-brand-border rounded-xl text-sm text-brand-secondary placeholder:text-brand-secondary/30 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-brand-secondary/40 uppercase tracking-widest ml-1">
                  WhatsApp
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Phone className="h-4 w-4 text-brand-primary group-focus-within:text-brand-primary transition-colors" />
                  </div>
                  <input
                    required
                    type="tel"
                    placeholder="(00) 00000-0000"
                    className="block w-full pl-11 pr-4 py-4 bg-brand-neutral border border-brand-border rounded-xl text-sm text-brand-secondary placeholder:text-brand-secondary/30 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-brand-secondary/40 uppercase tracking-widest ml-1">
                  E-mail Corporativo
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-brand-primary group-focus-within:text-brand-primary transition-colors" />
                  </div>
                  <input
                    required
                    type="email"
                    placeholder="seu@email.com.br"
                    className="block w-full pl-11 pr-4 py-4 bg-brand-neutral border border-brand-border rounded-xl text-sm text-brand-secondary placeholder:text-brand-secondary/30 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-5 bg-gold-gradient text-brand-secondary rounded-xl font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:brightness-110 transition-all shadow-xl shadow-brand-primary/20 border border-brand-primary/20 mt-8 cursor-pointer"
              >
                Enviar Solicitação
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

const HUB_ROUTES: Array<[number, number][]> = [
  [HUBS[0].coords, HUBS[1].coords], // Sorriso -> Rio Verde
  [HUBS[1].coords, HUBS[5].coords], // Rio Verde -> Uberlândia
  [HUBS[1].coords, HUBS[2].coords], // Rio Verde -> Barreiras
  [HUBS[1].coords, HUBS[4].coords], // Rio Verde -> Dourados
  [HUBS[4].coords, HUBS[3].coords], // Dourados -> Cascavel
  [HUBS[5].coords, HUBS[3].coords], // Uberlândia -> Cascavel
];

const createHubPinIcon = (isActive: boolean) =>
  L.divIcon({
    className: 'dllog-custom-hub-pin',
    html: `
      <div style="position:relative;display:flex;align-items:center;justify-content:center;width:${isActive ? 38 : 30}px;height:${isActive ? 38 : 30}px;">
        <span style="position:absolute;inset:0;border-radius:9999px;background:${isActive ? 'rgba(176,125,60,0.35)' : 'rgba(176,125,60,0.22)'};animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></span>
        <span style="position:relative;width:${isActive ? 22 : 16}px;height:${isActive ? 22 : 16}px;border-radius:9999px;background:${isActive ? '#B07D3C' : '#1C1917'};border:3px solid ${isActive ? '#FFFFFF' : '#D9A55B'};box-shadow:0 4px 12px rgba(0,0,0,0.35);"></span>
      </div>
    `,
    iconSize: [isActive ? 38 : 30, isActive ? 38 : 30],
    iconAnchor: [isActive ? 19 : 15, isActive ? 19 : 15],
    popupAnchor: [0, -14],
  });

const MapFocusController: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 0.9 });
  }, [center, zoom, map]);
  return null;
};

const SYSTEM_DEMO_TABS = [
  { id: 'embarques', label: 'Embarques' },
  { id: 'cargas', label: 'Cargas' },
  { id: 'mapa', label: 'Mapa' },
] as const;

type SystemDemoTabId = (typeof SYSTEM_DEMO_TABS)[number]['id'];

const DEMO_MAP_CARGOS: Array<{ code: string; coords: [number, number] }> = [
  { code: '#501', coords: [-16.82, -49.25] },
  { code: '#502', coords: [-18.17, -47.94] },
  { code: '#503', coords: [-18.92, -48.27] },
];

const createDemoMapPinIcon = (code: string) =>
  L.divIcon({
    className: 'dllog-demo-map-pin',
    html: `<div style="background:#1D4ED8;color:#FFFFFF;border:2px solid #FFFFFF;border-radius:9999px;padding:2px 7px;font-size:9px;font-weight:800;box-shadow:0 4px 10px rgba(0,0,0,0.35);white-space:nowrap;">${code}</div>`,
    iconSize: [42, 22],
    iconAnchor: [21, 11],
  });

const InteractiveSystemDemoWindow: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SystemDemoTabId>('embarques');
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const timer = window.setInterval(() => {
      setActiveTab((prev) => {
        const idx = SYSTEM_DEMO_TABS.findIndex((t) => t.id === prev);
        return SYSTEM_DEMO_TABS[(idx + 1) % SYSTEM_DEMO_TABS.length].id;
      });
    }, 6000);
    return () => window.clearInterval(timer);
  }, [isPaused]);

  return (
    <div
      className="relative rounded-2xl border overflow-hidden shadow-2xl flex flex-col h-[535px] select-none"
      style={{ backgroundColor: '#0B1120', borderColor: '#1E293B', color: '#F1F5F9' }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* ── Barra Superior do Sistema (Sem Sobreposição e com Logo Censurada) ── */}
      <div
        className="px-3.5 py-2.5 flex items-center justify-between border-b gap-2 shrink-0"
        style={{ backgroundColor: '#0F172A', borderColor: '#1E293B' }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex gap-1.5 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500/85" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400/85" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/85" />
          </div>

          <div className="h-4 w-px bg-slate-700/80 mx-0.5 shrink-0" />

          {/* Área da Logo Censurada (Cliente Confidencial) */}
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg border shrink-0"
            style={{ backgroundColor: '#131C31', borderColor: '#24324D' }}
            title="Logo do operador censurada para demonstração"
          >
            <div className="w-3.5 h-3.5 rounded bg-slate-500/70 blur-[2.5px]" />
            <div className="flex flex-col gap-0.5">
              <div className="w-9 h-1.5 rounded bg-slate-400/70 blur-[2px]" />
              <div className="w-6 h-1 rounded bg-sky-400/65 blur-[2px]" />
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
          </div>

          {/* Abas da Demonstração (Compactas e sem sobreposição) */}
          <div className="flex items-center gap-1 min-w-0 overflow-x-auto no-scrollbar ml-1">
            {SYSTEM_DEMO_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsPaused(true);
                  }}
                  style={
                    isActive
                      ? { backgroundColor: '#2563EB', color: '#FFFFFF', boxShadow: '0 4px 12px rgba(37,99,235,0.35)' }
                      : { color: '#94A3B8' }
                  }
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer hover:text-white shrink-0"
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Usuário Demo à Direita */}
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          <div
            className="px-2 py-1 rounded-lg border flex items-center gap-1.5"
            style={{ backgroundColor: '#131C31', borderColor: '#24324D' }}
          >
            <span
              className="w-4 h-4 rounded-md text-[9px] font-black flex items-center justify-center text-white"
              style={{ backgroundColor: '#2563EB' }}
            >
              S
            </span>
            <span className="text-[9px] font-bold text-slate-200 whitespace-nowrap">Suporte</span>
          </div>
        </div>
      </div>

      {/* ── Conteúdo Dinâmico das 3 Telas ── */}
      <div
        className="flex-1 overflow-hidden p-3 sm:p-4 flex flex-col gap-2.5"
        style={{
          backgroundColor: '#0B1120',
          backgroundImage:
            'linear-gradient(to right, rgba(59,130,246,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(59,130,246,0.05) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      >
        {activeTab === 'embarques' && (
          <div className="flex-1 flex flex-col gap-2.5 overflow-hidden animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-white">Embarques</h4>
                <div className="w-7 h-0.5 rounded-full mt-0.5" style={{ backgroundColor: '#F59E0B' }} />
              </div>
              <span className="text-[9px] font-bold text-slate-400">10 embarques listados</span>
            </div>

            {/* Pipeline de Status fiel ao original */}
            <div
              className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1.5 px-2 rounded-xl border shrink-0"
              style={{ backgroundColor: '#11192C', borderColor: '#1E293B' }}
            >
              {[
                { label: 'Pendente', count: 0, active: false },
                { label: 'Pré-cadastro', count: 0, active: false },
                { label: 'Ag. Carregamento', count: 10, active: true },
                { label: 'Ag. Nota', count: 3, active: false },
                { label: 'Ag. Descarga', count: 4, active: false },
                { label: 'Todos', count: 17, active: false },
              ].map((st) => (
                <div
                  key={st.label}
                  style={
                    st.active
                      ? { backgroundColor: '#2563EB', color: '#FFFFFF' }
                      : { color: '#94A3B8' }
                  }
                  className="px-2 py-1 rounded-lg text-[9px] font-bold whitespace-nowrap flex items-center gap-1 shrink-0"
                >
                  <span>{st.label}</span>
                  <span style={{ opacity: st.active ? 0.95 : 0.6 }}>{st.count}</span>
                </div>
              ))}
            </div>

            {/* Barra de Filtros */}
            <div className="flex items-center justify-between shrink-0">
              <div
                className="px-2.5 py-1 rounded-lg border text-[9px] font-semibold text-slate-300"
                style={{ backgroundColor: '#11192C', borderColor: '#1E293B' }}
              >
                Filtros Avançados
              </div>
              <span className="text-[8px] text-slate-400">Mostrando página 1</span>
            </div>

            {/* Tabela de Embarques */}
            <div
              className="flex-1 rounded-xl border overflow-hidden flex flex-col min-h-0"
              style={{ backgroundColor: '#0F172A', borderColor: '#1E293B' }}
            >
              <div
                className="grid grid-cols-12 gap-2 px-3 py-2 text-[9px] font-bold text-slate-400 border-b shrink-0"
                style={{ backgroundColor: '#131C31', borderColor: '#1E293B' }}
              >
                <span className="col-span-2">Embarque</span>
                <span className="col-span-3">Motorista / Veículo</span>
                <span className="col-span-3">Origem / Destino</span>
                <span className="col-span-2">Frete / Ton</span>
                <span className="col-span-2 text-right">Status Atual</span>
              </div>
              <div className="divide-y divide-slate-800/80 overflow-y-auto flex-1">
                {[
                  {
                    id: 'DEM-1001',
                    carga: 'Carga: 501',
                    driver: 'CARLOS ALBERTO S.',
                    plate: 'AAA0X01 • Bitrem 7e',
                    origin: 'Rio Verde, GO',
                    dest: 'Uberlândia, MG',
                    margin: '8,7%',
                    mtr: 'R$ 102,00',
                    emp: 'R$ 113,00',
                    hora: 'Previsto: 16:00',
                  },
                  {
                    id: 'DEM-1002',
                    carga: 'Carga: 502',
                    driver: 'MARCOS VINICIUS R.',
                    plate: 'BBB0X02 • Bitrem 7e',
                    origin: 'Sorriso, MT',
                    dest: 'Rondonópolis, MT',
                    margin: '9,1%',
                    mtr: 'R$ 300,00',
                    emp: 'R$ 330,00',
                    hora: 'Previsto: 10:30',
                  },
                  {
                    id: 'DEM-1003',
                    carga: 'Carga: 503',
                    driver: 'RAFAEL MENDES P.',
                    plate: 'CCC0X03 • LS Trucada',
                    origin: 'Catalão, GO',
                    dest: 'Santos, SP',
                    margin: '11,1%',
                    mtr: 'R$ 120,00',
                    emp: 'R$ 135,00',
                    hora: 'Previsto: 12:00',
                  },
                  {
                    id: 'DEM-1004',
                    carga: 'Carga: 504',
                    driver: 'RODRIGO FERREIRA L.',
                    plate: 'DDD0X04 • Rodotrem 9e',
                    origin: 'Dourados, MS',
                    dest: 'Paranaguá, PR',
                    margin: '7,5%',
                    mtr: 'R$ 185,00',
                    emp: 'R$ 200,00',
                    hora: 'Previsto: 14:30',
                  },
                ].map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-12 gap-2 px-3 py-2 items-center hover:bg-slate-800/40 transition-colors text-[10px]"
                  >
                    <div className="col-span-2 min-w-0">
                      <p className="font-bold text-sky-400 truncate">{row.id}</p>
                      <p className="text-[8px] text-slate-400 truncate">{row.carga}</p>
                    </div>
                    <div className="col-span-3 min-w-0">
                      <p className="font-bold text-slate-100 truncate text-[9px]">{row.driver}</p>
                      <p className="text-[8px] text-slate-400 truncate">{row.plate}</p>
                    </div>
                    <div className="col-span-3 min-w-0">
                      <p className="font-semibold text-slate-200 truncate text-[9px]">{row.origin}</p>
                      <p className="text-[8px] text-slate-400 truncate">→ {row.dest}</p>
                    </div>
                    <div className="col-span-2 min-w-0">
                      <p className="font-bold text-white text-[9px] truncate">MTR: {row.mtr}</p>
                      <p className="text-[8px] text-sky-400 font-semibold truncate">EMP: {row.emp}</p>
                    </div>
                    <div className="col-span-2 text-right flex flex-col items-end gap-0.5">
                      <span className="text-[7px] text-amber-400 font-semibold">{row.hora}</span>
                      <span
                        className="inline-block px-1.5 py-0.5 rounded text-white text-[8px] font-bold whitespace-nowrap"
                        style={{ backgroundColor: '#10B981' }}
                      >
                        Marcar Chegada
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cargas' && (
          <div className="flex-1 flex flex-col gap-2.5 overflow-hidden animate-in fade-in duration-300">
            <div className="flex items-center justify-between gap-2 shrink-0">
              <div>
                <h4 className="text-sm font-black text-white">Oportunidades de Carga</h4>
                <div className="w-7 h-0.5 rounded-full mt-0.5" style={{ backgroundColor: '#F59E0B' }} />
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="px-2 py-1 rounded-lg text-white text-[9px] font-bold"
                  style={{ backgroundColor: '#10B981' }}
                >
                  Divulgar Cargas
                </span>
                <span
                  className="px-2 py-1 rounded-lg text-white text-[9px] font-bold hidden sm:inline"
                  style={{ backgroundColor: '#2563EB' }}
                >
                  Prompt Fretebras
                </span>
              </div>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto pr-0.5 min-h-0">
              {[
                {
                  code: '#501',
                  client: 'Agropecuária Horizonte',
                  product: 'Calcário',
                  origin: 'Catalão, GO',
                  dest: 'Uberaba, MG',
                  disp: '120 TON',
                  pct: 59,
                  rate: 'R$ 120,00/t',
                  margin: '11,11%',
                },
                {
                  code: '#502',
                  client: 'Cooperativa Cerrado Sul',
                  product: 'SORGO',
                  origin: 'Rio Verde, GO',
                  dest: 'Uberlândia, MG',
                  disp: '462 TON',
                  pct: 18,
                  rate: 'R$ 102,00/t',
                  margin: '9,73%',
                },
                {
                  code: '#503',
                  client: 'Grãos do Centro Ltda',
                  product: 'Milho em Grãos',
                  origin: 'Sorriso, MT',
                  dest: 'Santos, SP',
                  disp: '1.000 TON',
                  pct: 8,
                  rate: 'R$ 255,00/t',
                  margin: '5,56%',
                },
                {
                  code: '#504',
                  client: 'Fazenda Nova Era',
                  product: 'Milho em Grãos',
                  origin: 'Dourados, MS',
                  dest: 'Paranaguá, PR',
                  disp: '760 TON',
                  pct: 22,
                  rate: 'R$ 185,00/t',
                  margin: '7,50%',
                },
              ].map((load) => (
                <div
                  key={load.code}
                  className="p-2.5 rounded-xl border flex items-center justify-between gap-2 text-[10px]"
                  style={{ backgroundColor: '#0F172A', borderColor: '#1E293B' }}
                >
                  <div className="min-w-0 w-36">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sky-400 font-black">{load.code}</span>
                      <span className="font-bold text-white truncate">{load.client}</span>
                    </div>
                    <p className="text-[9px] text-slate-400">{load.product}</p>
                  </div>

                  <div className="hidden sm:flex items-center gap-1 shrink-0">
                    {['DOM 15/11', 'SEG 16/11', 'TER 17/11'].map((d) => (
                      <span
                        key={d}
                        className="px-1.5 py-0.5 rounded border text-[8px] font-bold text-slate-300"
                        style={{ backgroundColor: '#131C31', borderColor: '#24324D' }}
                      >
                        {d}
                      </span>
                    ))}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-semibold text-slate-200 truncate">
                      {load.origin} → {load.dest}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${load.pct}%`, backgroundColor: '#10B981' }} />
                      </div>
                      <span className="text-[8px] font-bold text-emerald-400 whitespace-nowrap">
                        DISP: {load.disp}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-black text-sky-300 text-[10px]">{load.rate}</p>
                    <p className="text-[8px] font-bold text-emerald-400">{load.margin}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'mapa' && (
          <div className="flex-1 flex flex-col gap-2 overflow-hidden animate-in fade-in duration-300 min-h-0">
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-white">Mapa Operacional Logístico</h4>
                <span
                  className="px-2 py-0.5 rounded text-white text-[8px] font-bold"
                  style={{ backgroundColor: '#10B981' }}
                >
                  Divulgar (3)
                </span>
              </div>
              <span className="text-[9px] font-bold text-slate-400">Sincronizado</span>
            </div>

            {/* 4 KPIs do Mapa */}
            <div className="grid grid-cols-4 gap-2 shrink-0">
              {[
                { label: 'CARGAS NO RAIO', val: '3', color: '#38BDF8' },
                { label: 'VOLUME DISP.', val: '732 ton', color: '#34D399' },
                { label: 'MÉDIA FRETE', val: 'R$ 1.599', color: '#FBBF24' },
                { label: 'CORREDORES', val: '3 origens', color: '#A78BFA' },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="p-2 rounded-xl border"
                  style={{ backgroundColor: '#0F172A', borderColor: '#1E293B' }}
                >
                  <p className="text-[7px] font-bold text-slate-400 uppercase truncate">{kpi.label}</p>
                  <p className="text-xs font-black mt-0.5" style={{ color: kpi.color }}>
                    {kpi.val}
                  </p>
                </div>
              ))}
            </div>

            {/* Área Mapa Real Leaflet + Parâmetros de Busca */}
            <div className="flex-1 grid grid-cols-12 gap-2.5 min-h-0">
              <div
                className="col-span-8 rounded-xl border relative overflow-hidden"
                style={{ borderColor: '#24324D', backgroundColor: '#E2E8F0' }}
              >
                <MapContainer
                  center={[-18.17, -48.3]}
                  zoom={6}
                  zoomControl={false}
                  dragging={false}
                  scrollWheelZoom={false}
                  doubleClickZoom={false}
                  attributionControl={false}
                  className="h-full w-full z-10"
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Circle
                    center={[-18.17, -48.1]}
                    radius={150000}
                    pathOptions={{
                      color: '#2563EB',
                      weight: 2,
                      fillColor: '#3B82F6',
                      fillOpacity: 0.14,
                    }}
                  />
                  {DEMO_MAP_CARGOS.map((c) => (
                    <Marker key={c.code} position={c.coords} icon={createDemoMapPinIcon(c.code)} />
                  ))}
                </MapContainer>

                {/* Seletor de Estilo no Canto Superior Esquerdo igual ao original */}
                <div
                  className="absolute top-2 left-2 z-20 flex items-center gap-1 p-0.5 rounded-lg border shadow-md"
                  style={{ backgroundColor: '#0F172A', borderColor: '#334155' }}
                >
                  {['Padrão', 'Satélite', 'Dark', 'Claro'].map((mode, idx) => (
                    <span
                      key={mode}
                      style={idx === 0 ? { backgroundColor: '#2563EB', color: '#FFFFFF' } : { color: '#94A3B8' }}
                      className="px-1.5 py-0.5 rounded text-[7px] font-bold"
                    >
                      {mode}
                    </span>
                  ))}
                </div>
              </div>

              {/* Painel Parâmetros de Busca fiel ao original */}
              <div
                className="col-span-4 rounded-xl border p-2.5 flex flex-col justify-between min-h-0"
                style={{ backgroundColor: '#0F172A', borderColor: '#1E293B' }}
              >
                <div className="space-y-2">
                  <p className="text-[8px] font-black text-slate-300 uppercase tracking-wider">
                    Parâmetros de Busca
                  </p>
                  <div
                    className="p-1.5 rounded-lg border"
                    style={{ backgroundColor: '#080E1A', borderColor: '#1E293B' }}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[7px] text-sky-400 font-bold">Origem (Coleta)</p>
                      <span
                        className="px-1 py-0.2 rounded text-[7px] font-bold text-white"
                        style={{ backgroundColor: '#2563EB' }}
                      >
                        400 km
                      </span>
                    </div>
                    <p className="text-[9px] text-white font-semibold mt-0.5 truncate">Catalão, GO</p>
                  </div>
                  <div
                    className="p-1.5 rounded-lg border"
                    style={{ backgroundColor: '#080E1A', borderColor: '#1E293B' }}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[7px] text-rose-400 font-bold">Destino (Opcional)</p>
                      <span
                        className="px-1 py-0.2 rounded text-[7px] font-bold text-white"
                        style={{ backgroundColor: '#DC2626' }}
                      >
                        200 km
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-0.5 truncate">Ex: Santos, SP</p>
                  </div>
                </div>
                <div
                  className="py-1.5 rounded-lg text-center text-[9px] font-black text-white shadow-md"
                  style={{ backgroundColor: '#2563EB' }}
                >
                  Filtrar Cargas no Mapa
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Rodapé da Demonstração ── */}
      <div
        className="border-t px-4 py-2 flex items-center justify-between text-[9px] text-slate-400 shrink-0"
        style={{ backgroundColor: '#0F172A', borderColor: '#1E293B' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <TrendingUp className="w-3 h-3 text-sky-400 shrink-0" />
          <span className="truncate">Demonstração Interativa • Clique nas abas acima</span>
        </div>
        <span className="font-black text-sky-400/85 uppercase shrink-0">© DLLOG INFRA</span>
      </div>
    </div>
  );
};

const MapHubsSection: React.FC = () => {
  const [selectedHubIndex, setSelectedHubIndex] = useState<number | null>(null);
  const activeHub = selectedHubIndex !== null ? HUBS[selectedHubIndex] : null;
  const mapCenter: [number, number] = activeHub ? activeHub.coords : [-16.5, -50.8];
  const mapZoom = activeHub ? 7 : 4;

  return (
    <section className="py-24 bg-white overflow-hidden">
      <style>{`
        .dllog-site-map .leaflet-tile-pane {
          filter: saturate(0.75) contrast(1.04) brightness(1.02);
        }
        .dllog-site-map .leaflet-popup-content-wrapper {
          border-radius: 1rem;
          border: 1px solid #e7e5e4;
          box-shadow: 0 20px 35px -10px rgba(28, 25, 23, 0.2);
        }
      `}</style>
      <div className="max-w-7xl mx-auto px-6">
        <div data-dllog-reveal className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-primary/10 text-brand-primary text-[11px] font-bold uppercase tracking-widest mb-4">
            <MapPin className="w-3 h-3" />
            Atendimento Nacional
          </div>
          <h2 className="text-4xl font-bold text-brand-secondary mb-4">
            Presença nos Polos <span className="text-brand-primary">Estratégicos</span>
          </h2>
          <p className="text-brand-secondary/60 max-w-2xl mx-auto">
            A DLLOG opera com precisão nos principais eixos produtivos do país, garantindo conectividade e agilidade onde o agronegócio acontece.
          </p>
        </div>

        <div
          data-dllog-reveal
          className="dllog-site-map h-[560px] w-full rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-white bg-stone-100 relative"
        >
          <MapContainer
            center={[-16.5, -50.8]}
            zoom={4}
            className="h-full w-full z-10"
            scrollWheelZoom={false}
          >
            <MapFocusController center={mapCenter} zoom={mapZoom} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Corredores Logísticos Conectando os Polos */}
            {HUB_ROUTES.map((route, rIdx) => (
              <Polyline
                key={rIdx}
                positions={route}
                pathOptions={{
                  color: '#B07D3C',
                  weight: 2.5,
                  opacity: 0.65,
                  dashArray: '6, 8',
                }}
              />
            ))}

            {HUBS.map((hub, idx) => (
              <Marker
                key={idx}
                position={hub.coords}
                icon={createHubPinIcon(selectedHubIndex === idx)}
                eventHandlers={{
                  click: () => setSelectedHubIndex(idx),
                }}
              >
                <Popup className="custom-popup">
                  <div className="p-2 min-w-[210px]">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="font-bold text-brand-primary text-base">{hub.name}</h4>
                      <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        Polo Ativo
                      </span>
                    </div>
                    <p className="text-xs text-brand-secondary/75 mb-3 leading-relaxed">{hub.description}</p>
                    <div className="flex items-center gap-2 bg-brand-primary/10 p-2 rounded-lg border border-brand-primary/20">
                      <Info className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                      <span className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">{hub.stats}</span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Overlay info */}
          <div className="absolute top-6 right-6 z-20 hidden md:block">
            <div className="bg-white/95 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-stone-200/80 max-w-[260px]">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-sm font-bold text-brand-secondary">
                  {activeHub ? activeHub.name : 'Cobertura Integrada'}
                </p>
              </div>
              <p className="text-xs text-brand-secondary/70 leading-relaxed mb-4">
                {activeHub
                  ? activeHub.description
                  : 'Monitoramos cada etapa do transporte através destes centros tecnológicos de distribuição.'}
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-brand-primary" />
                  <span className="text-[10px] font-bold text-brand-secondary uppercase">Monitoramento 24/7</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-brand-primary" />
                  <span className="text-[10px] font-bold text-brand-secondary uppercase">
                    {activeHub ? activeHub.stats : '6 Polos Agrícolas Conectados'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const PartnersSection: React.FC = () => (
  <section className="py-12 bg-white border-t border-brand-border overflow-hidden">
    <div className="max-w-7xl mx-auto px-6 mb-8 text-center">
      <div data-dllog-reveal>
        <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-primary mb-2">Nossa Rede</h2>
        <h3 className="text-2xl font-extrabold text-brand-secondary">
          Empresas que <span className="text-brand-primary">Confiam</span> em Nós
        </h3>
      </div>
    </div>

    <div className="relative w-full overflow-hidden before:absolute before:left-0 before:top-0 before:z-10 before:h-full before:w-10 before:bg-gradient-to-r before:from-white before:to-transparent after:absolute after:right-0 after:top-0 after:z-10 after:h-full after:w-10 after:bg-gradient-to-l after:from-white after:to-transparent">
      <div className="flex flex-nowrap w-fit dllog-partners-marquee">
        {SCROLL_PARTNERS.map((partner, index) => (
          <div
            key={index}
            className="flex items-center justify-center px-5 md:px-8 shrink-0"
          >
            <img
              src={partner.logo}
              alt={partner.name}
              className="h-8 md:h-12 w-auto object-contain"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </div>
  </section>
);

export const InstitutionalWebsitePage: React.FC<InstitutionalWebsitePageProps> = ({
  companyLogo,
  isLoggedIn,
  onGoToSystem,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const logoSrc = companyLogo || '/site-logo.png';

  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'DLLOG - Logística e Tecnologia Agro';
    return () => {
      document.title = prevTitle;
    };
  }, []);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-dllog-reveal]'));
    if (!('IntersectionObserver' in window)) {
      elements.forEach((el) => el.classList.add('dllog-revealed'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('dllog-revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -50px 0px' }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="dllog-institutional-site min-h-screen font-sans bg-brand-neutral text-brand-text selection:bg-brand-primary/30 selection:text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');

        .dllog-institutional-site {
          --color-brand-primary: #d4af37;
          --color-brand-secondary: #0a0a0a;
          --color-brand-neutral: #faf9f7;
          --color-brand-text: #4b4b4b;
          --color-brand-accent: #9ba3af;
          --color-brand-border: #e8e6e1;
          font-family: "Outfit", "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif;
        }

        .bg-gold-gradient {
          background-image: linear-gradient(to bottom, #e6c15a, #d4af37, #a88226);
        }

        .leaflet-popup-content-wrapper {
          background: white !important;
          color: #4b4b4b !important;
          border-radius: 12px !important;
          padding: 0 !important;
          overflow: hidden !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
        }

        .leaflet-popup-content {
          margin: 0 !important;
          padding: 0 !important;
        }

        .leaflet-container {
          font-family: inherit !important;
        }

        [data-dllog-reveal] {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.8s ease-out, transform 0.8s ease-out;
        }

        [data-dllog-reveal="left"] {
          transform: translateX(-40px);
        }

        [data-dllog-reveal="right"] {
          transform: translateX(40px);
        }

        [data-dllog-reveal].dllog-revealed {
          opacity: 1;
          transform: translate(0, 0);
        }

        @keyframes dllogMarquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }

        .dllog-partners-marquee {
          animation: dllogMarquee 35s linear infinite;
        }
      `}</style>

      {/* Navigation — Executive Corporate Header (25% Compacted) */}
      <nav className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-xl border-b border-stone-200/80 shadow-[0_4px_24px_-6px_rgba(28,25,23,0.08)]">
        {/* Linha superior executiva em dourado/bronze */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#A67142] to-transparent opacity-80" />

        <div className="max-w-7xl mx-auto px-6 h-[58px] flex items-center justify-between relative">
          {/* Identidade Visual */}
          <a href="#home" className="group flex items-center cursor-pointer shrink-0">
            <SiteLogo logoSrc={logoSrc} />
          </a>

          {/* Links centralizados em cápsula executiva */}
          <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-full bg-stone-50/90 border border-stone-200/75 shadow-inner absolute left-1/2 -translate-x-1/2">
            {[
              { href: '#home', label: 'Início' },
              { href: '#sobre', label: 'Sobre' },
              { href: '#sistema', label: 'Sistema' },
              { href: '#servicos', label: 'Serviços' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="relative px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[0.16em] text-stone-600 hover:text-stone-950 hover:bg-white hover:shadow-2xs transition-all duration-200 after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-0 after:h-[1.5px] after:bg-[#A67142] hover:after:w-4 after:transition-all"
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* Botões Executivos à direita */}
          <div className="hidden md:flex items-center gap-2.5 shrink-0">
            {onGoToSystem && (
              <button
                onClick={onGoToSystem}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-stone-300/90 bg-white text-stone-800 hover:bg-stone-900 hover:text-white hover:border-stone-900 transition-all duration-200 text-[11px] font-bold uppercase tracking-[0.12em] shadow-2xs cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-[#A67142]" />
                <span>{isLoggedIn ? 'Voltar ao Sistema' : 'Acessar Portal'}</span>
              </button>
            )}
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 bg-gold-gradient text-brand-secondary px-4 py-1.5 rounded-lg hover:brightness-105 transition-all duration-200 shadow-md shadow-brand-primary/20 text-[11px] font-extrabold uppercase tracking-[0.14em] border border-brand-primary/30 cursor-pointer"
            >
              <Phone className="w-3 h-3" />
              <span>Contato</span>
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-1.5 rounded-lg border border-stone-200 text-brand-secondary hover:bg-stone-50 cursor-pointer"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white/98 backdrop-blur-xl border-t border-stone-200/80 px-6 py-3.5 space-y-2.5 shadow-xl">
            <div className="flex flex-col gap-2 text-xs font-bold uppercase tracking-[0.16em]">
              <a href="#home" onClick={() => setMobileMenuOpen(false)} className="text-stone-700 hover:text-brand-primary py-1">Início</a>
              <a href="#sobre" onClick={() => setMobileMenuOpen(false)} className="text-stone-700 hover:text-brand-primary py-1">Sobre</a>
              <a href="#sistema" onClick={() => setMobileMenuOpen(false)} className="text-stone-700 hover:text-brand-primary py-1">Sistema</a>
              <a href="#servicos" onClick={() => setMobileMenuOpen(false)} className="text-stone-700 hover:text-brand-primary py-1">Serviços</a>
            </div>
            <div className="pt-2 flex flex-col gap-2 border-t border-stone-100">
              {onGoToSystem && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onGoToSystem();
                  }}
                  className="w-full py-2 rounded-lg border border-stone-300 text-stone-800 text-[11px] font-bold uppercase tracking-wider"
                >
                  {isLoggedIn ? 'Voltar ao Sistema' : 'Acessar Portal'}
                </button>
              )}
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setIsModalOpen(true);
                }}
                className="w-full bg-gold-gradient text-brand-secondary py-2 rounded-lg text-[11px] font-extrabold uppercase tracking-wider"
              >
                Contato
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section — Video Background Fullscreen */}
      <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-[60px]">
        {/* ── Vídeo de fundo ── */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/video.mp4" type="video/mp4" />
        </video>

        {/* ── Overlay gradiente escuro para legibilidade ── */}
        <div className="absolute inset-0 bg-gradient-to-b from-brand-secondary/70 via-brand-secondary/60 to-brand-secondary/80" />

        {/* ── Conteúdo centralizado ── */}
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center scale-[0.8]">
          <div data-dllog-reveal>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-primary/20 border border-brand-primary/30 text-brand-primary text-[11px] font-bold uppercase tracking-widest mb-8 backdrop-blur-sm">
              <Zap className="w-3 h-3" />
              Inovação no Agronegócio
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-[1.05] tracking-tight mb-8">
              Tecnologia que{' '}
              <span className="text-brand-primary">move o Agronegócio.</span>
            </h1>

            <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-12 leading-relaxed">
              Conectamos tecnologia de ponta com experiência para simplificar, otimizar e dar controle total ao seu transporte de grãos e fertilizantes.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-9 py-4 bg-gold-gradient text-brand-secondary rounded font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all cursor-pointer shadow-xl shadow-brand-primary/30 text-base border border-brand-primary/20"
              >
                Agendar Demonstração <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-9 py-4 border-2 border-white/20 text-white hover:bg-white/10 rounded-xl font-bold transition-all cursor-pointer backdrop-blur-sm text-base text-center"
              >
                Falar com Especialista
              </button>
            </div>
          </div>

          {/* Badge flutuante de estatística */}
          <div
            data-dllog-reveal
            className="mt-16 inline-flex items-center gap-5 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-8 py-5 shadow-xl"
          >
            <div className="w-12 h-12 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-primary">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="text-left">
              <p className="text-white/60 text-sm font-medium">Eficiência média</p>
              <p className="text-white font-extrabold text-2xl">+40% Otimização</p>
            </div>
            <div className="w-px h-12 bg-white/20 mx-2" />
            <div className="text-left">
              <p className="text-white/60 text-sm font-medium">Experiência</p>
              <p className="text-white font-extrabold text-2xl">+5 Anos</p>
            </div>
          </div>
        </div>

        {/* ── Seta scroll down ── */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/40">
          <span className="text-[10px] uppercase tracking-widest font-semibold">Scroll</span>
          <div className="w-px h-10 bg-gradient-to-b from-white/40 to-transparent animate-pulse" />
        </div>
      </section>

      {/* Philosophy Section */}
      <section id="sobre" className="py-20 bg-brand-secondary text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-brand-primary/5 -skew-x-12 transform translate-x-1/2" />
        <div className="max-w-7xl mx-auto px-6">
          <div data-dllog-reveal className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-sm font-bold uppercase tracking-[0.3em] text-brand-primary mb-4">Nossa Essência</h2>
            <h3 className="text-4xl md:text-5xl font-bold leading-tight">
              Tecnologia para servir, experiência para{' '}
              <span className="text-brand-primary italic underline decoration-white/20 underline-offset-8">liderar.</span>
            </h3>
          </div>

          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div data-dllog-reveal className="space-y-8">
              <div className="space-y-4">
                <p className="text-xl text-brand-neutral/80 leading-relaxed font-light italic">
                  "A tecnologia veio para dar{' '}
                  <span className="text-brand-primary font-bold not-italic">
                    Controle, Eficiência, Otimização e Simplificação
                  </span>
                  , mas não para substituir o olhar humano."
                </p>
                <p className="text-brand-neutral/60 leading-relaxed">
                  Na DLLOG, acreditamos que a verdadeira inovação acontece quando ferramentas inteligentes potencializam o talento das pessoas, nunca o contrário. Nosso DNA une o digital ao conhecimento prático do campo.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="p-6 bg-white rounded-lg border border-brand-border shadow-sm hover:shadow-md transition-all cursor-default">
                  <span className="text-brand-primary font-bold text-[11px] uppercase mb-2 block tracking-wider">Controle</span>
                  <Cpu className="w-8 h-8 text-brand-primary mb-4" />
                  <h4 className="text-brand-secondary font-bold mb-2">Pilar Digital</h4>
                  <p className="text-xs text-brand-secondary/60">Sistemas avançados de gestão e monitoramento real-time.</p>
                </div>
                <div className="p-6 bg-white rounded-lg border border-brand-border shadow-sm hover:shadow-md transition-all cursor-default">
                  <span className="text-brand-primary font-bold text-[11px] uppercase mb-2 block tracking-wider">Humano</span>
                  <Users className="w-8 h-8 text-brand-primary mb-4" />
                  <h4 className="text-brand-secondary font-bold mb-2">Pilar Humano</h4>
                  <p className="text-xs text-brand-secondary/60">Suporte ético e expertise de quem vive e compreende a estrada.</p>
                </div>
              </div>
            </div>

            <div
              data-dllog-reveal="right"
              className="relative aspect-square md:aspect-auto md:h-[500px] rounded-3xl overflow-hidden group shadow-2xl"
            >
              <img
                src="https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=1000"
                alt="Expertise Humana"
                className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700 hover:scale-105"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-brand-primary/20 mix-blend-overlay group-hover:opacity-0 transition-opacity" />
              <div className="absolute bottom-10 left-10 p-8 border-l-4 border-brand-primary bg-brand-secondary/90 backdrop-blur-sm max-w-xs shadow-xl">
                <p className="text-2xl font-bold flex items-center gap-2">
                  +5 Anos <TrendingUp className="w-6 h-6 text-brand-primary" />
                </p>
                <p className="text-sm text-brand-neutral/60 italic leading-snug mt-2">
                  Atuando em todas as esferas da logística nacional e agropecuária.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sistema Section */}
      <section id="sistema" className="py-24 bg-white relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div data-dllog-reveal="left" className="order-2 lg:order-1">
              <div className="relative group">
                <div className="absolute -inset-4 bg-brand-primary/10 rounded-[2.5rem] blur-2xl group-hover:bg-brand-primary/20 transition-all" />

                <InteractiveSystemDemoWindow />
              </div>
            </div>

            <div data-dllog-reveal="right" className="order-1 lg:order-2">
              <h2 className="text-sm font-bold uppercase tracking-[0.3em] text-brand-primary mb-6">O Diferencial</h2>
              <h3 className="text-4xl text-brand-secondary font-bold mb-8 leading-tight">
                Criado por quem entende as <br />
                <span className="text-brand-primary">dores do dia a dia.</span>
              </h3>
              <p className="text-lg text-brand-secondary/70 mb-10 leading-relaxed">
                Nossos sistemas não são apenas código; são a materialização de problemas reais resolvidos por especialistas com mais de 5 anos de imersão total no ecossistema logístico agro.
              </p>

              <div className="grid sm:grid-cols-2 gap-6 mb-12">
                {[
                  'Projetado por experientes do transporte',
                  'Simplificação radical de processos',
                  'Gestão inteligente de fretes agro',
                  'Monitoramento de ativos em tempo real',
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 bg-brand-neutral/50 p-3 rounded-xl border border-transparent hover:border-brand-primary/10 transition-colors"
                  >
                    <CheckCircle2 className="w-5 h-5 text-brand-primary shrink-0" />
                    <span className="font-bold text-brand-secondary/80 text-sm">{item}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-3 font-bold text-brand-primary hover:text-brand-secondary transition-colors group text-lg cursor-pointer"
              >
                Agendar Demonstração Gratuita{' '}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Connectivity Banner */}
      <section className="bg-brand-secondary py-12">
        <div className="max-w-7xl mx-auto px-6 overflow-hidden">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <Handshake className="w-12 h-12 text-brand-primary shrink-0" />
              <div>
                <h4 className="text-brand-primary text-xs font-bold uppercase tracking-widest mb-2">
                  Nosso Diferencial
                </h4>
                <p className="text-white text-lg font-medium">Conectividade Global e Precisão Logística.</p>
                <p className="text-white/60 text-sm max-w-md">
                  Nosso sistema não foi projetado apenas por programadores, mas por especialistas com mais de 5 anos de atuação direta.
                </p>
              </div>
            </div>
            <div className="flex gap-12 items-center">
              <div className="text-right">
                <div className="text-3xl font-extrabold text-brand-primary">+5 Anos</div>
                <div className="text-[11px] uppercase text-white/50 tracking-wider">Experiência</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-extrabold text-brand-primary">100%</div>
                <div className="text-[11px] uppercase text-white/50 tracking-wider">Agro</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="servicos" className="py-24 bg-brand-neutral/30 border-y border-brand-secondary/5">
        <div className="max-w-7xl mx-auto px-6">
          <div data-dllog-reveal className="text-center mb-20">
            <h2 className="text-sm font-bold uppercase tracking-[0.3em] text-brand-primary mb-4">O que fazemos</h2>
            <h3 className="text-4xl md:text-5xl font-bold text-brand-secondary">
              Soluções que <span className="text-brand-primary">Movem</span> o Negócio
            </h3>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div
              data-dllog-reveal
              className="p-8 bg-white rounded-lg border border-brand-border shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
            >
              <span className="text-brand-primary font-bold text-[11px] uppercase mb-3 block tracking-wider">
                Controle
              </span>
              <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center text-brand-primary mb-8 group-hover:bg-brand-primary group-hover:text-white transition-all">
                <Settings2 className="w-8 h-8" />
              </div>
              <h4 className="text-2xl font-bold mb-5 text-brand-secondary">Gestão Logística</h4>
              <p className="text-brand-secondary/60 text-base leading-relaxed mb-8">
                Controlamos todo o ciclo do transporte, garantindo que cada grama de carga chegue ao destino com eficiência, segurança e o menor custo operacional possível.
              </p>
              <ul className="space-y-3 font-bold text-brand-secondary/80 text-sm">
                <li className="flex items-center gap-3">
                  <Zap className="w-4 h-4 text-brand-primary" /> Otimização de Frete
                </li>
                <li className="flex items-center gap-3">
                  <Zap className="w-4 h-4 text-brand-primary" /> Redução de Gatilhos de Atraso
                </li>
              </ul>
            </div>

            <div
              data-dllog-reveal
              className="p-8 bg-white rounded-lg border border-brand-primary shadow-lg hover:shadow-xl transition-all group relative overflow-hidden"
            >
              <span className="text-brand-primary font-bold text-[11px] uppercase mb-3 block tracking-wider">
                Intermediação
              </span>
              <div className="w-16 h-16 bg-brand-primary text-white rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-brand-primary/20">
                <Handshake className="w-8 h-8" />
              </div>
              <h4 className="text-2xl font-bold mb-5 text-brand-secondary">Intermediação</h4>
              <p className="text-brand-secondary/60 text-base leading-relaxed mb-8">
                Conectamos de forma estratégica compradores e vendedores de grãos ou fertilizantes às transportadoras certas para demandas específicas e volumosas.
              </p>
              <ul className="space-y-3 font-bold text-brand-secondary/80 text-sm">
                <li className="flex items-center gap-3">
                  <Zap className="w-4 h-4 text-brand-primary" /> Networking Agro Ativo
                </li>
                <li className="flex items-center gap-3">
                  <Zap className="w-4 h-4 text-brand-primary" /> Segurança em Transações
                </li>
              </ul>
            </div>

            <div
              data-dllog-reveal
              className="p-8 bg-white rounded-lg border border-brand-border shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
            >
              <span className="text-brand-primary font-bold text-[11px] uppercase mb-3 block tracking-wider">
                Foco
              </span>
              <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center text-brand-primary mb-8 group-hover:bg-brand-primary group-hover:text-white transition-all">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h4 className="text-2xl font-bold mb-5 text-brand-secondary">Soluções Sob Medida</h4>
              <p className="text-brand-secondary/60 text-base leading-relaxed mb-8">
                Consultoria e desenvolvimento de ferramentas focadas em resolver demandas pontuais de transporte que as soluções genéricas não conseguem suprir.
              </p>
              <ul className="space-y-3 font-bold text-brand-secondary/80 text-sm">
                <li className="flex items-center gap-3">
                  <Zap className="w-4 h-4 text-brand-primary" /> Análise de Malha Logística
                </li>
                <li className="flex items-center gap-3">
                  <Zap className="w-4 h-4 text-brand-primary" /> Otimização de Fluxo de Carga
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <MapHubsSection />

      <PartnersSection />

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-brand-secondary rounded-xl p-12 md:p-20 relative overflow-hidden text-center shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,var(--color-brand-primary),transparent)]" />
            <div data-dllog-reveal className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-8">
                Tecnologia que move o Agro.
              </h2>
              <p className="text-white/80 text-lg mb-12 max-w-2xl mx-auto">
                Deixe de lutar contra os processos e comece a dominá-los com a tecnologia DLLOG.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-block px-10 py-5 bg-gold-gradient text-brand-secondary rounded font-bold text-lg hover:brightness-110 transition-all shadow-xl cursor-pointer uppercase tracking-widest border border-brand-primary/20"
              >
                Agendar Demonstração
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer
        id="contato"
        data-dllog-reveal
        className="bg-brand-secondary pt-32 pb-12 text-white relative overflow-hidden"
      >
        <div className="absolute bottom-0 right-0 w-1/2 h-full bg-brand-primary/5 -skew-y-12 transform translate-y-1/2" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid md:grid-cols-5 gap-16 border-b border-white/10 pb-24 mb-16">
            <div className="md:col-span-2 space-y-10">
              <div className="flex items-center leading-none mb-4">
                <SiteLogo logoSrc={logoSrc} />
              </div>
              <p className="text-white/50 max-w-sm leading-relaxed text-lg">
                Liderando a transformação digital no transporte agro com ética, eficiência e respeito humano. Somos a DLLOG.
              </p>
              <div className="flex gap-5">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-12 h-12 rounded-2xl border border-white/10 flex items-center justify-center hover:bg-brand-primary hover:border-brand-primary transition-all cursor-pointer group shadow-sm"
                  >
                    <Zap className="w-5 h-5 text-white/30 group-hover:text-white transition-colors" />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-8">
              <h5 className="font-black text-xs uppercase tracking-[0.3em] text-brand-primary">Contato</h5>
              <div className="space-y-6 text-white/60 font-medium">
                <a
                  href="https://wa.me/5564993058754"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 hover:text-white transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-brand-primary transition-colors">
                    <Phone className="w-4 h-4" />
                  </div>
                  (64) 99305-8754
                </a>
                <a
                  href="mailto:contato@dllog.com.br"
                  className="flex items-center gap-4 hover:text-white transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-brand-primary transition-colors">
                    <Mail className="w-4 h-4" />
                  </div>
                  contato@dllog.com.br
                </a>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <span className="leading-snug">
                    Atendimento Nacional
                    <br />
                    <span className="text-xs text-white/30">Principais Polos Agrícolas</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <h5 className="font-black text-xs uppercase tracking-[0.3em] text-brand-primary">Sitemap</h5>
              <div className="flex flex-col gap-5 text-white/60 font-bold text-sm">
                <a href="#home" className="hover:text-brand-primary transition-colors">Início</a>
                <a href="#sobre" className="hover:text-brand-primary transition-colors">Quem Somos</a>
                <a href="#sistema" className="hover:text-brand-primary transition-colors">Tecnologia</a>
                <a href="#servicos" className="hover:text-brand-primary transition-colors">Serviços</a>
              </div>
            </div>

            <div className="space-y-8">
              <h5 className="font-black text-xs uppercase tracking-[0.3em] text-brand-primary">Legais</h5>
              <div className="flex flex-col gap-5 text-white/60 font-bold text-sm">
                <a href="#home" className="hover:text-brand-primary transition-colors">Privacidade</a>
                <a href="#home" className="hover:text-brand-primary transition-colors">Termos de Uso</a>
                <a href="#home" className="hover:text-brand-primary transition-colors">Compliance</a>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center gap-8 text-white/20 text-[10px] font-black tracking-[0.2em] uppercase">
            <p>© 2026 DLLOG SOLUÇÕES EM LOGÍSTICA. TODOS OS DIREITOS RESERVADOS.</p>
            <p className="flex items-center gap-2">
              Design & Tecnologia <Zap className="w-3 h-3 text-brand-primary" /> DLLOG DEV
            </p>
          </div>
        </div>
      </footer>

      <ContactModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};

export default InstitutionalWebsitePage;
