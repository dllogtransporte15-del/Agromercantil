import React, { useState, useMemo, useEffect } from 'react';
import type { Cargo, Client, Product, User, DailyScheduleEntry } from '../types';
import { CargoStatus, CargoType, VehicleSetType, VehicleBodyType, DailyScheduleType } from '../types';
import { BRAZILIAN_CITIES } from '../brazilianCities';
import { processComigoImage, formatComigoObservations, ComigoExtractedData } from '../services/comigoImageParser';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ParsedCargo {
  rawText: string;
  origin: string;
  originLocation?: string;
  originMapLink?: string;
  destination: string;
  destinationLocation?: string;
  destinationMapLink?: string;
  productName: string;
  productId?: string;
  totalVolume: number;
  baseValue: number;
  companyFreightValuePerTon: number;
  driverFreightValuePerTonPJ: number;
  driverFreightValuePerTonPF: number;
  driverFreightValuePerTon: number;
  hasIcms: boolean;
  icmsPercentage: number;
  vehicleTypes?: { setType: VehicleSetType; bodyTypes: VehicleBodyType[] }[];
  observations?: string;
  loadingStartDate?: string;
  dailySchedule?: DailyScheduleEntry[];
  type: CargoType;
  tollIncluded: boolean;
  imageDataUrl?: string;
  errors: string[];
  warnings: string[];
}

interface BulkCargoImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveBulk: (cargos: Array<Omit<Cargo, 'id' | 'history' | 'createdAt' | 'createdById'>>) => Promise<void>;
  clients: Client[];
  products: Product[];
  currentUser: User;
}

// ─────────────────────────────────────────────
// City Formatter (Converts to "Cidade, UF")
// ─────────────────────────────────────────────

function toTitleCase(str: string): string {
  if (!str) return '';
  const lowercaseWords = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'd\'', 'du']);
  return str
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      if (index > 0 && lowercaseWords.has(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export function normalizeCityFormat(cityRaw: string): string {
  if (!cityRaw) return '';
  let cleaned = cityRaw.trim().replace(/^[📍🏁]/g, '').trim();

  // Remove surrounding parenthesis if any
  cleaned = cleaned.replace(/^\((.+)\)$/, '$1').trim();

  let match = cleaned.match(/^(.+?)\s*[-/,]\s*([a-zA-Z]{2})$/);
  if (!match) {
    match = cleaned.match(/^(.+?)\s+([a-zA-Z]{2})$/);
  }

  let cityName = cleaned;
  let uf = '';

  if (match) {
    cityName = match[1].trim();
    uf = match[2].trim().toUpperCase();
  }

  const cleanNormalize = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '');

  if (uf) {
    const cityNorm = cleanNormalize(cityName);
    const foundByCity = BRAZILIAN_CITIES.find(c => {
      const parts = c.split(',');
      if (parts.length === 2 && parts[1].trim().toUpperCase() === uf) {
        return cleanNormalize(parts[0]) === cityNorm;
      }
      return false;
    });
    if (foundByCity) return foundByCity;
    return `${toTitleCase(cityName)}, ${uf}`;
  } else {
    const targetNorm = cleanNormalize(cityName);
    const found = BRAZILIAN_CITIES.find(c => cleanNormalize(c) === targetNorm);
    if (found) return found;
    return toTitleCase(cleaned);
  }
}

// ─────────────────────────────────────────────
// Freight Calculator com Abatimento de ICMS
// ─────────────────────────────────────────────

function calcFreight(
  companyValue: number,
  isMilhao: boolean = false,
  hasIcms: boolean = false,
  icmsPercentage: number = 0
) {
  const company = companyValue;

  // Abatimento de ICMS se ativo
  const icmsRate = hasIcms ? ((Number(icmsPercentage) || 0) / 100) : 0;
  const netCompany = parseFloat((company * (1 - icmsRate)).toFixed(2));

  // O frete motorista PJ (-8%) e PF (-12%) incide sobre o valor líquido (após abater o ICMS)
  const pj = parseFloat((netCompany * (1 - 0.08)).toFixed(2));
  const pf = parseFloat((netCompany * (1 - 0.12)).toFixed(2));

  return { company, pj, pf, netCompany, icmsDeduction: parseFloat((company * icmsRate).toFixed(2)) };
}

// ─────────────────────────────────────────────
// Programação Diária Automática (40 ton, Demanda a Verificar)
// Até 16h = hoje, após 16h = amanhã
// ─────────────────────────────────────────────

function getInitialDailySchedule(): DailyScheduleEntry[] {
  const now = new Date();
  const currentHour = now.getHours();

  const targetDate = new Date(now);
  if (currentHour >= 16) {
    targetDate.setDate(targetDate.getDate() + 1);
  }

  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  return [
    {
      date: dateStr,
      type: DailyScheduleType.Verificar,
      tonnage: 40,
    },
  ];
}

// ─────────────────────────────────────────────
// Data de Embarque Parser
// ─────────────────────────────────────────────

function parseLoadingDate(dateTextRaw: string): string | undefined {
  const dateText = dateTextRaw.replace(/[🗓️🗓]|EMBARQUE:/gi, '').replace(/\*+/g, '').trim().toUpperCase();
  if (!dateText) return undefined;

  const now = new Date();
  if (dateText.includes('IMEDIATO') || dateText.includes('HOJE')) {
    return now.toISOString().split('T')[0];
  }
  if (dateText.includes('AMANHÃ') || dateText.includes('AMANHA')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  const weekdaysMap: Record<string, number> = {
    'DOMINGO': 0,
    'SEGUNDA': 1,
    'TERCA': 2,
    'TERÇA': 2,
    'QUARTA': 3,
    'QUINTA': 4,
    'SEXTA': 5,
    'SABADO': 6,
    'SÁBADO': 6,
  };

  for (const [name, targetDay] of Object.entries(weekdaysMap)) {
    if (dateText.includes(name)) {
      const result = new Date(now);
      const currentDay = now.getDay();
      let diff = targetDay - currentDay;
      if (diff <= 0) diff += 7;
      result.setDate(now.getDate() + diff);
      const y = result.getFullYear();
      const m = String(result.getMonth() + 1).padStart(2, '0');
      const d = String(result.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const dateMatch = dateText.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    const month = dateMatch[2].padStart(2, '0');
    const year = dateMatch[3] || new Date().getFullYear().toString();
    return `${year}-${month}-${day}`;
  }

  return now.toISOString().split('T')[0];
}

// ─────────────────────────────────────────────
// Route Parser (WhatsApp text)
// ─────────────────────────────────────────────

function parseRoute(line: string) {
  const cleaned = line.replace(/[📍🏁]/g, '').trim();
  const parts = cleaned.split(/\s+[xX]\s+/);
  if (parts.length < 2) {
    return {
      origin: normalizeCityFormat(cleaned),
      destination: '',
      originLocation: '',
      destinationLocation: '',
    };
  }

  const extractCityAndLocation = (str: string) => {
    const match = str.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (match) {
      return {
        city: normalizeCityFormat(match[1].trim()),
        location: match[2].trim(),
      };
    }
    return {
      city: normalizeCityFormat(str.trim()),
      location: '',
    };
  };

  const orig = extractCityAndLocation(parts[0].trim());
  const dest = extractCityAndLocation(parts[1].trim());
  return {
    origin: orig.city,
    originLocation: orig.location,
    destination: dest.city,
    destinationLocation: dest.location,
  };
}

function parseVehicleTypes(text: string): { setType: VehicleSetType; bodyTypes: VehicleBodyType[] }[] {
  const upper = text.toUpperCase();
  const results: { setType: VehicleSetType; bodyTypes: VehicleBodyType[] }[] = [];

  const bodyTypes: VehicleBodyType[] = [];
  if (upper.includes('GRANELEIRO')) bodyTypes.push(VehicleBodyType.Graneleiro);
  if (upper.includes('BASCULANTE') || upper.includes('CAÇAMBA') || upper.includes('CACAMBA')) bodyTypes.push(VehicleBodyType.Basculante);
  const defaultBodies = bodyTypes.length > 0 ? bodyTypes : [VehicleBodyType.Graneleiro, VehicleBodyType.Basculante];

  if (upper.includes('BITREM')) results.push({ setType: VehicleSetType.Bitrem7e, bodyTypes: defaultBodies });
  if (upper.includes('RODOTREM')) results.push({ setType: VehicleSetType.Rodotrem, bodyTypes: defaultBodies });
  if (upper.includes('TRUCK') && !upper.includes('BITRUCK')) results.push({ setType: VehicleSetType.Truck, bodyTypes: defaultBodies });
  if (upper.includes('BITRUCK')) results.push({ setType: VehicleSetType.Bitruck, bodyTypes: defaultBodies });
  if (upper.includes('LS')) results.push({ setType: VehicleSetType.LSSimples, bodyTypes: defaultBodies });
  if (upper.includes('4° EIXO') || upper.includes('4 EIXO') || upper.includes('4º EIXO') || upper.includes('QUARTO EIXO')) {
    results.push({ setType: VehicleSetType.Carreta4e, bodyTypes: defaultBodies });
  }

  return results.length > 0 ? results : [];
}

/**
 * Retorna todos os tipos de veículos exceto Truck e Bitruck, com carrocerias Graneleiro e Basculante
 */
export function getMilhaoDefaultVehicleTypes(): { setType: VehicleSetType; bodyTypes: VehicleBodyType[] }[] {
  const bodies = [VehicleBodyType.Graneleiro, VehicleBodyType.Basculante];
  return Object.values(VehicleSetType)
    .filter(st => st !== VehicleSetType.Truck && st !== VehicleSetType.Bitruck)
    .map(st => ({
      setType: st,
      bodyTypes: bodies,
    }));
}

function findProduct(name: string, products: Product[], isMilhaoClient: boolean = false, isComigoClient: boolean = false): Product | undefined {
  if (isComigoClient) {
    const fert = products.find(p => p.name.toUpperCase().includes('FERTILIZANTE'));
    if (fert) return fert;
  }

  const upper = (name || '').toUpperCase().trim();
  if (upper) {
    const exact = products.find(p => p.name.toUpperCase() === upper);
    if (exact) return exact;

    const partial = products.find(p => {
      const pUpper = p.name.toUpperCase();
      return pUpper.includes(upper) || upper.includes(pUpper);
    });
    if (partial) return partial;

    const words = upper.split(/\s+/).filter(w => w.length >= 3 && !['PARA', 'GRANEL', 'SACS', 'SACAS'].includes(w));
    for (const word of words) {
      const wordMatch = products.find(p => p.name.toUpperCase().includes(word));
      if (wordMatch) return wordMatch;
    }
  }

  if (isMilhaoClient) {
    const milhoProduct = products.find(p => p.name.toUpperCase().includes('MILHO'));
    if (milhoProduct) return milhoProduct;
  }

  return products[0];
}

function parseEmojiCargo(block: string, products: Product[], isMilhaoClient: boolean = false): ParsedCargo {
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
  const errors: string[] = [];
  const warnings: string[] = [];

  let origin = '';
  let originLocation = '';
  let originMapLink = '';
  let destination = '';
  let destinationLocation = '';
  let productName = '';
  let productId: string | undefined;
  let baseValue = 0;
  let vehicleText = '';
  let observations: string[] = [];
  let loadingStartDate: string | undefined;
  let tollIncluded = false;
  let inObs = false;

  for (const line of lines) {
    if (/^carga\s+\d+/i.test(line)) continue;

    if (line.includes('📍') || line.includes('🏁')) {
      const route = parseRoute(line);
      origin = route.origin;
      originLocation = route.originLocation || '';
      destination = route.destination;
      destinationLocation = route.destinationLocation || '';
      inObs = false;
      continue;
    }

    if (line.includes('🚛') || line.includes('🚚')) {
      let cleanLine = line.replace(/[🚛🚚]/g, '').replace(/VEÍCULO:|VEICULO:/gi, '').trim();
      if (cleanLine.includes('🚨')) {
        const [vPart, ...alertParts] = cleanLine.split('🚨');
        vehicleText += ' ' + vPart.replace(/\*+/g, '').trim();
        const alertNote = alertParts.join('🚨').replace(/\*+/g, '').replace(/\)+$/, '').trim();
        if (alertNote) {
          observations.push(`🚨 ${alertNote}`);
        }
      } else {
        vehicleText += ' ' + cleanLine.replace(/\*+/g, '').trim();
      }
      inObs = false;
      continue;
    }

    if (line.includes('📌') || (line.includes('maps.app.goo.gl') && !originMapLink)) {
      const urlMatch = line.match(/https?:\/\/[^\s]+/);
      if (urlMatch) originMapLink = urlMatch[0];
      inObs = false;
      continue;
    }

    if (line.includes('💰') || (line.toUpperCase().includes('VALOR:') && baseValue === 0)) {
      const valMatch = line.match(/R\$\s*([\d.,]+)/i) || line.match(/VALOR:\s*R?\$?\s*([\d.,]+)/i);
      if (valMatch) baseValue = parseFloat(valMatch[1].replace(',', '.'));
      inObs = false;
      continue;
    }

    if (line.includes('🧾') || line.toUpperCase().startsWith('PRODUTO:')) {
      productName = line.replace(/🧾|PRODUTO:/gi, '').replace(/\*+/g, '').trim();
      inObs = false;
      continue;
    }

    if (line.includes('🗓️') || line.includes('🗓') || line.toUpperCase().startsWith('EMBARQUE:')) {
      loadingStartDate = parseLoadingDate(line);
      inObs = false;
      continue;
    }

    if (line.includes('✅') && (line.toUpperCase().includes('PEDÁGIO') || line.toUpperCase().includes('PEDAGIO'))) {
      tollIncluded = true;
      inObs = false;
      continue;
    }

    if (line.includes('🚨') || line.toUpperCase().includes('LINK DA CARGA:')) {
      observations.push(line.replace(/\*+/g, '').trim());
      inObs = false;
      continue;
    }

    if (line.includes('⚖️') || line.toUpperCase().startsWith('PESO:')) {
      observations.push(line.replace(/\*+/g, '').trim());
      inObs = false;
      continue;
    }

    if (line.includes('🤑') || line.toUpperCase().startsWith('DESCARGA:')) {
      observations.push(line.replace(/\*+/g, '').trim());
      inObs = false;
      continue;
    }

    if (line.includes('⚠️') || line.toUpperCase().startsWith('OBS:') || line.toUpperCase().startsWith('OBSERVA')) {
      const cleanObsHeader = line.replace(/⚠️|OBS:|OBSERVAÇÕES:|OBSERVACOES:/gi, '').replace(/\*+/g, '').trim();
      if (cleanObsHeader) {
        observations.push(cleanObsHeader);
      }
      inObs = true;
      continue;
    }

    if (inObs) {
      const obsLine = line.replace(/\*+/g, '').replace(/^[-•]\s*/, '').trim();
      if (obsLine) observations.push(obsLine);
    } else {
      const extraLine = line.replace(/\*+/g, '').trim();
      if (extraLine) observations.push(extraLine);
    }
  }

  const foundProd = findProduct(productName, products, isMilhaoClient, false);
  if (foundProd) {
    productId = foundProd.id;
    if (!productName) productName = foundProd.name;
  } else {
    warnings.push(`Produto "${productName}" não encontrado no cadastro. Selecione manualmente.`);
  }

  if (!origin) errors.push('Origem não encontrada (verifique o emoji 📍)');
  if (!destination) errors.push('Destino não encontrado (verifique o emoji 📍)');
  if (baseValue <= 0) errors.push('Valor do frete não encontrado (verifique o emoji 💰)');

  const { company, pj, pf } = calcFreight(baseValue, isMilhaoClient, false, 0);
  const obsList = [
    ...(tollIncluded ? ['PEDÁGIO INCLUSO'] : []),
    ...observations,
  ];
  const obsText = obsList.filter(Boolean).join('\n');

  return {
    rawText: block,
    origin,
    originLocation,
    originMapLink,
    destination,
    destinationLocation,
    productName: productName || (foundProd?.name || 'Milho'),
    productId,
    totalVolume: isMilhaoClient ? 100 : 0,
    baseValue,
    companyFreightValuePerTon: company,
    driverFreightValuePerTonPJ: pj,
    driverFreightValuePerTonPF: pf,
    driverFreightValuePerTon: pj,
    hasIcms: false,
    icmsPercentage: 12,
    vehicleTypes: isMilhaoClient ? getMilhaoDefaultVehicleTypes() : (vehicleText.trim() ? parseVehicleTypes(vehicleText) : []),
    observations: obsText || undefined,
    loadingStartDate,
    dailySchedule: getInitialDailySchedule(),
    type: CargoType.Spot,
    tollIncluded,
    errors,
    warnings,
  };
}

function splitIntoBlocks(text: string): string[] {
  const parts = text.split(/(?=^carga\s+\d+)/im).filter(p => p.trim().length > 0);
  if (parts.length > 1) return parts;
  const byBlank = text.split(/\n\s*\n\s*\n/).filter(p => p.trim().length > 0);
  if (byBlank.length > 1) return byBlank;
  return [text];
}

function parseRawText(text: string, products: Product[], isMilhaoClient: boolean = false): ParsedCargo[] {
  return splitIntoBlocks(text).map(block => parseEmojiCargo(block, products, isMilhaoClient));
}

// ─────────────────────────────────────────────
// Lightbox Modal para Visualização da Imagem
// ─────────────────────────────────────────────

interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  title?: string;
}

const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({ isOpen, onClose, imageUrl, title }) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
    }
  }, [isOpen]);

  if (!isOpen || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative max-w-5xl w-full max-h-[95vh] flex flex-col bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header do visualizador */}
        <div className="flex items-center justify-between px-6 py-3 bg-gray-800/90 border-b border-gray-700 text-white z-10">
          <div className="flex items-center gap-2">
            <span className="text-xl">📸</span>
            <div>
              <h3 className="text-sm font-bold">{title || 'Visualizador de Roteiro Digitalizado'}</h3>
              <p className="text-[11px] text-gray-400">Visualização interativa (sem download)</p>
            </div>
          </div>

          {/* Controles de Zoom e Rotação */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))}
              className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-gray-200 transition-colors"
              title="Diminuir Zoom"
            >
              🔍 −
            </button>
            <span className="text-xs font-mono px-2 py-1 bg-gray-800 rounded">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(prev => Math.min(3, prev + 0.25))}
              className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-gray-200 transition-colors"
              title="Aumentar Zoom"
            >
              🔍 +
            </button>
            <button
              onClick={() => setRotation(prev => (prev + 90) % 360)}
              className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-gray-200 transition-colors ml-1"
              title="Girar 90°"
            >
              ↻ Girar
            </button>
            <button
              onClick={() => { setZoom(1); setRotation(0); }}
              className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-gray-200 transition-colors"
              title="Resetar Zoom"
            >
              ↺ 100%
            </button>
            <button
              onClick={onClose}
              className="p-1.5 bg-red-600/80 hover:bg-red-600 rounded-lg text-xs text-white transition-colors ml-2"
              title="Fechar (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Área da imagem */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[400px] max-h-[82vh] bg-black/40 select-none">
          <img
            src={imageUrl}
            alt="Documento Digitalizado"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transition: 'transform 0.2s ease-out',
            }}
            className="max-w-full max-h-[78vh] object-contain rounded-lg shadow-lg cursor-grab active:cursor-grabbing"
          />
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// UI Components
// ─────────────────────────────────────────────

const StepIndicator: React.FC<{ current: number; steps: string[] }> = ({ current, steps }) => (
  <div className="flex items-center justify-center mb-6">
    {steps.map((label, i) => (
      <React.Fragment key={i}>
        <div className="flex flex-col items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
            i < current ? 'bg-green-500 text-white' :
            i === current ? 'bg-primary text-white ring-4 ring-primary/20' :
            'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
          }`}>
            {i < current ? '✓' : i + 1}
          </div>
          <span className={`text-xs mt-1 font-medium whitespace-nowrap ${i === current ? 'text-primary' : 'text-gray-400'}`}>{label}</span>
        </div>
        {i < steps.length - 1 && (
          <div className={`flex-1 h-0.5 mx-2 mb-4 transition-all duration-300 min-w-8 ${i < current ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-600'}`} />
        )}
      </React.Fragment>
    ))}
  </div>
);

const FreightBadge: React.FC<{ label: string; value: number; sublabel?: string; color: string }> = ({ label, value, sublabel, color }) => (
  <div className={`flex flex-col items-center px-3 py-1.5 rounded-lg ${color}`}>
    <span className="text-[11px] opacity-75">{label}</span>
    <div className="flex items-baseline gap-1 mt-0.5">
      <span className="font-bold text-sm">R$ {value.toFixed(2).replace('.', ',')}</span>
      {sublabel && <span className="text-xs font-semibold opacity-90">({sublabel})</span>}
    </div>
  </div>
);

// ─────────────────────────────────────────────
// Gerenciador de Tipos de Veículos e Carrocerias
// ─────────────────────────────────────────────

const CargoVehicleTypesManager: React.FC<{
  vehicleTypes?: { setType: VehicleSetType; bodyTypes: VehicleBodyType[] }[];
  onChange: (updated: { setType: VehicleSetType; bodyTypes: VehicleBodyType[] }[]) => void;
}> = ({ vehicleTypes = [], onChange }) => {
  const [selectedSet, setSelectedSet] = useState<VehicleSetType>(VehicleSetType.LSSimples);
  const [selectedBodies, setSelectedBodies] = useState<VehicleBodyType[]>([VehicleBodyType.Graneleiro, VehicleBodyType.Basculante]);

  const toggleBody = (bt: VehicleBodyType) => {
    setSelectedBodies(prev =>
      prev.includes(bt) ? prev.filter(b => b !== bt) : [...prev, bt]
    );
  };

  const handleAdd = () => {
    if (selectedBodies.length === 0) return;
    const existsIndex = vehicleTypes.findIndex(v => v.setType === selectedSet);
    if (existsIndex >= 0) {
      const next = [...vehicleTypes];
      next[existsIndex] = { setType: selectedSet, bodyTypes: selectedBodies };
      onChange(next);
    } else {
      onChange([...vehicleTypes, { setType: selectedSet, bodyTypes: selectedBodies }]);
    }
  };

  const handleRemove = (setType: VehicleSetType) => {
    onChange(vehicleTypes.filter(v => v.setType !== setType));
  };

  const handleAddPresetGrain = () => {
    onChange(getMilhaoDefaultVehicleTypes());
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
          🚛 Tipos de Veículos e Carrocerias
        </label>
        {vehicleTypes.length === 0 && (
          <button
            type="button"
            onClick={handleAddPresetGrain}
            className="text-[10px] text-primary hover:underline font-semibold"
          >
            ⚡ Adicionar Padrão (Todos exceto Truck/Bitruck)
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 p-2 bg-white dark:bg-gray-700/60 rounded-lg border border-gray-200 dark:border-gray-600">
        <select
          value={selectedSet}
          onChange={e => setSelectedSet(e.target.value as VehicleSetType)}
          className="text-xs px-2 py-1 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          {Object.values(VehicleSetType).map(st => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          {Object.values(VehicleBodyType).map(bt => (
            <label key={bt} className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedBodies.includes(bt)}
                onChange={() => toggleBody(bt)}
                className="rounded text-primary focus:ring-primary h-3.5 w-3.5"
              />
              <span>{bt}</span>
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={handleAdd}
          className="px-2.5 py-1 text-xs font-semibold bg-primary text-white rounded hover:bg-primary-dark transition-colors shadow-sm ml-auto"
        >
          + Adicionar
        </button>
      </div>

      {vehicleTypes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {vehicleTypes.map(vt => (
            <span
              key={vt.setType}
              className="inline-flex items-center gap-1 text-[11px] font-medium bg-blue-50 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800/50 px-2 py-0.5 rounded-full"
            >
              <strong>{vt.setType}:</strong> {vt.bodyTypes?.join('/') || 'Qualquer'}
              <button
                type="button"
                onClick={() => handleRemove(vt.setType)}
                className="text-blue-600 dark:text-blue-300 hover:text-red-600 dark:hover:text-red-400 font-bold ml-0.5"
                title="Remover tipo de veículo"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// Main Modal
// ─────────────────────────────────────────────

const BulkCargoImportModal: React.FC<BulkCargoImportModalProps> = ({
  isOpen, onClose, onSaveBulk, clients, products, currentUser,
}) => {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [importMode, setImportMode] = useState<'text' | 'image'>('text');
  
  // Text state
  const [rawText, setRawText] = useState('');
  
  // Image state
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  
  const [editedCargos, setEditedCargos] = useState<ParsedCargo[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: number; failed: number } | null>(null);

  // Lightbox modal state
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxTitle, setLightboxTitle] = useState<string>('');

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const isMilhaoClient = useMemo(() => {
    if (!selectedClient) return false;
    const name = (selectedClient.nomeFantasia || selectedClient.razaoSocial || '').toLowerCase();
    return name.includes('milhao') || name.includes('milhão');
  }, [selectedClient]);

  const isComigoClient = useMemo(() => {
    if (!selectedClient) return false;
    const name = (selectedClient.nomeFantasia || selectedClient.razaoSocial || '').toLowerCase();
    return name.includes('comigo');
  }, [selectedClient]);

  useEffect(() => {
    if (isComigoClient) {
      setImportMode('image');
    } else {
      setImportMode('text');
    }
  }, [isComigoClient]);

  // Paste image handler (Ctrl+V)
  useEffect(() => {
    if (step !== 1 || !isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        const imageFiles = Array.from(e.clipboardData.files).filter(f => f.type.startsWith('image/'));
        if (imageFiles.length > 0) {
          e.preventDefault();
          setImportMode('image');
          setAttachedFiles(prev => [...prev, ...imageFiles]);
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [step, isOpen]);

  const handleParseText = () => {
    if (!rawText.trim()) return;
    const parsed = parseRawText(rawText, products, isMilhaoClient);
    setEditedCargos(parsed.map(p => ({ ...p })));
    setStep(2);
  };

  const handleProcessImages = async () => {
    if (attachedFiles.length === 0) return;
    setIsProcessingImages(true);
    const parsedList: ParsedCargo[] = [];

    const fertProduct = findProduct('Fertilizante', products, false, true);

    for (let i = 0; i < attachedFiles.length; i++) {
      const file = attachedFiles[i];
      setProcessingStatus(`Digitalizando e aprimorando imagem ${i + 1} de ${attachedFiles.length}...`);
      try {
        const extracted = await processComigoImage(file);
        const obs = formatComigoObservations(extracted);
        const baseCompanyVal = extracted.freteEmpresaSugerido || 0;
        const { company, pj, pf } = calcFreight(baseCompanyVal, false, false, 0);

        const cargo: ParsedCargo = {
          rawText: extracted.rawText || '',
          origin: 'Rio Verde, GO',
          originLocation: 'COMIGO - Rio Verde',
          destination: normalizeCityFormat(extracted.destinoSugerido || 'Aparecida do Rio Doce, GO'),
          destinationLocation: extracted.destinoLocal || extracted.fazenda,
          productName: fertProduct?.name || 'Fertilizante',
          productId: fertProduct?.id,
          totalVolume: extracted.toneladas || 0,
          baseValue: baseCompanyVal,
          companyFreightValuePerTon: company,
          driverFreightValuePerTonPJ: pj,
          driverFreightValuePerTonPF: pf,
          driverFreightValuePerTon: pj,
          hasIcms: false,
          icmsPercentage: 12,
          observations: obs || undefined,
          loadingStartDate: extracted.dataEntrega ? parseLoadingDate(extracted.dataEntrega) : new Date().toISOString().split('T')[0],
          dailySchedule: getInitialDailySchedule(),
          type: CargoType.Spot,
          tollIncluded: false,
          imageDataUrl: extracted.imageDataUrl,
          errors: [],
          warnings: baseCompanyVal === 0 ? ['Informe o Frete Empresa para calcular os fretes dos motoristas.'] : [],
        };

        parsedList.push(cargo);
      } catch (err: any) {
        console.error(`Erro ao processar imagem ${file.name}:`, err);
      }
    }

    setIsProcessingImages(false);
    setProcessingStatus('');

    if (parsedList.length > 0) {
      setEditedCargos(parsedList);
      setStep(2);
    }
  };

  const updateEdited = (index: number, field: keyof ParsedCargo, value: any) => {
    setEditedCargos(prev => {
      const next = [...prev];
      let val = value;
      if (field === 'origin' || field === 'destination') {
        val = normalizeCityFormat(value);
      }
      const cargo: any = { ...next[index], [field]: val };

      // Se mudar o frete empresa ou parâmetros de ICMS, recalcula tudo imediatamente
      if (field === 'companyFreightValuePerTon' || field === 'baseValue' || field === 'hasIcms' || field === 'icmsPercentage') {
        const numCompany = field === 'companyFreightValuePerTon' || field === 'baseValue' ? (Number(val) || 0) : (cargo.companyFreightValuePerTon || 0);
        const hasIcms = field === 'hasIcms' ? Boolean(val) : Boolean(cargo.hasIcms);
        const icmsPct = field === 'icmsPercentage' ? (Number(val) || 0) : (Number(cargo.icmsPercentage) || 0);

        const { company, pj, pf } = calcFreight(numCompany, isMilhaoClient, hasIcms, icmsPct);
        cargo.companyFreightValuePerTon = company;
        cargo.driverFreightValuePerTonPJ = pj;
        cargo.driverFreightValuePerTonPF = pf;
        cargo.driverFreightValuePerTon = pj;
        cargo.baseValue = numCompany;
        cargo.hasIcms = hasIcms;
        cargo.icmsPercentage = icmsPct;

        if (numCompany > 0) {
          cargo.warnings = (cargo.warnings || []).filter((w: string) => !w.includes('Informe o Frete Empresa'));
        }
      }

      next[index] = cargo;
      return next;
    });
  };

  const validCount = editedCargos.filter(c => c.errors.length === 0 && c.productId).length;

  const handleConfirm = async () => {
    if (!selectedClientId) return;
    setIsSaving(true);
    const validCargos = editedCargos.filter(c => c.errors.length === 0 && c.productId);

    const cargoData: Array<Omit<Cargo, 'id' | 'history' | 'createdAt' | 'createdById'>> = validCargos.map(c => {
      const attachments = c.imageDataUrl ? [c.imageDataUrl] : [];

      return {
        sequenceId: 0,
        clientId: selectedClientId,
        productId: c.productId!,
        origin: normalizeCityFormat(c.origin),
        originLocation: c.originLocation,
        originMapLink: c.originMapLink,
        destination: normalizeCityFormat(c.destination),
        destinationLocation: c.destinationLocation,
        totalVolume: c.totalVolume || 0,
        scheduledVolume: 0,
        loadedVolume: 0,
        companyFreightValuePerTon: c.companyFreightValuePerTon,
        driverFreightValuePerTon: c.driverFreightValuePerTonPJ,
        driverFreightValuePerTonPJ: c.driverFreightValuePerTonPJ,
        driverFreightValuePerTonPF: c.driverFreightValuePerTonPF,
        hasIcms: c.hasIcms,
        icmsPercentage: c.icmsPercentage || 0,
        requiresScheduling: false,
        type: c.type,
        status: CargoStatus.EmAndamento,
        loadingStartDate: c.loadingStartDate,
        dailySchedule: c.dailySchedule && c.dailySchedule.length > 0 ? c.dailySchedule : getInitialDailySchedule(),
        allowedVehicleTypes: c.vehicleTypes && c.vehicleTypes.length > 0 ? c.vehicleTypes : undefined,
        observations: c.observations,
        attachments,
        freightLegs: [{
          companyFreightValuePerTon: c.companyFreightValuePerTon,
          driverFreightValuePerTon: c.driverFreightValuePerTonPJ,
          driverFreightValuePerTonPJ: c.driverFreightValuePerTonPJ,
          driverFreightValuePerTonPF: c.driverFreightValuePerTonPF,
          hasIcms: c.hasIcms,
          icmsPercentage: c.icmsPercentage || 0,
          disableDriverFreightPF: false,
        }],
        destinations: [{
          id: `dest-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          city: normalizeCityFormat(c.destination),
          location: c.destinationLocation,
          targetTonnage: c.totalVolume || 0,
          freightLegs: [{
            companyFreightValuePerTon: c.companyFreightValuePerTon,
            driverFreightValuePerTon: c.driverFreightValuePerTonPJ,
            driverFreightValuePerTonPJ: c.driverFreightValuePerTonPJ,
            driverFreightValuePerTonPF: c.driverFreightValuePerTonPF,
            hasIcms: c.hasIcms,
            icmsPercentage: c.icmsPercentage || 0,
            disableDriverFreightPF: false,
          }],
        }],
      };
    });

    try {
      await onSaveBulk(cargoData);
      setSaveResult({ success: cargoData.length, failed: editedCargos.length - validCargos.length });
    } catch {
      setSaveResult({ success: 0, failed: editedCargos.length });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setStep(0); setSelectedClientId(''); setRawText(''); setAttachedFiles([]);
    setEditedCargos([]); setSaveResult(null); setIsSaving(false); setIsProcessingImages(false);
    setLightboxImage(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col border border-gray-200 dark:border-gray-700">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Importar Cargas em Lote</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {isComigoClient ? 'Importação inteligente de Roteiros COMIGO via Anexo de Imagem / OCR' : 'Cole o texto ou anexe imagens e o sistema estrutura os dados automaticamente'}
            </p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 pt-4 flex-shrink-0">
          <StepIndicator current={step} steps={['Selecionar Cliente', isComigoClient || importMode === 'image' ? 'Anexar Imagens' : 'Colar Texto', 'Revisar e Criar']} />
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 min-h-0">

          {/* STEP 0: Select Client */}
          {step === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Selecione o cliente para aplicar o modelo e as regras correspondentes:
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cliente *</label>
                <select
                  value={selectedClientId}
                  onChange={e => setSelectedClientId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent text-base"
                >
                  <option value="">— Selecione um cliente —</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.nomeFantasia}</option>
                  ))}
                </select>
              </div>

              {/* Informações da regra COMIGO */}
              {isComigoClient && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5">🌾</span>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">Cliente COMIGO — Modelo por Anexo de Imagem</p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        • <strong>Origem Padrão:</strong> Fixa em <code>Rio Verde, GO</code>.
                      </p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        • <strong>Produto Padrão:</strong> <strong>Fertilizante</strong>.
                      </p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        • <strong>Destino Automático:</strong> Detectado a partir do roteiro de entrega para você confirmar.
                      </p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        • <strong>Frete & Abatimento ICMS:</strong> Frete Empresa com cálculo de PJ (−8%) e PF (−12%), abatendo o ICMS se informado.
                      </p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        • <strong>Aprimoramento Automático:</strong> Imagens recebem realce de contraste e nitidez sem perda de informação.
                      </p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        • <strong>Programação Diária:</strong> 40 ton em <em>Demanda a Verificar</em> (hoje até 16h, ou amanhã).
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Informações da regra MILHÃO */}
              {isMilhaoClient && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5">🌽</span>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-blue-800 dark:text-blue-200">Cliente Milhão Ingredients — Modelo WhatsApp</p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        • <strong>Cidades:</strong> Convertidas para <code>"Cidade, UF"</code>.
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        • <strong>Produto:</strong> Seleciona automaticamente <strong>Milho</strong>.
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        • <strong>Volume Padrão:</strong> <strong>100 ton</strong> (editável na conferência).
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        • <strong>Veículos Padrão:</strong> Todos os tipos de veículos (exceto Truck e Bitruck) com carrocerias <strong>Graneleiro e Basculante</strong>.
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        • <strong>Margens:</strong> Frete Empresa (Valor informado), PJ (−8%), PF (−12%).
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        • <strong>Programação Diária:</strong> 40 ton em <em>Demanda a Verificar</em> (hoje até 16h, ou amanhã).
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <button
                disabled={!selectedClientId}
                onClick={() => setStep(1)}
                className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md"
              >
                Continuar →
              </button>
            </div>
          )}

          {/* STEP 1: Input (Text or Image) */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-semibold text-primary">{selectedClient?.nomeFantasia}</span>
                  <span>·</span>
                  <span>{importMode === 'image' ? 'Anexe os roteiros em imagem' : 'Cole o texto das cargas'}</span>
                </div>

                {/* Mode Selector Tabs */}
                <div className="flex bg-gray-100 dark:bg-gray-700 p-0.5 rounded-lg text-xs">
                  <button
                    onClick={() => setImportMode('image')}
                    className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                      importMode === 'image' ? 'bg-white dark:bg-gray-800 text-primary shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                    }`}
                  >
                    📷 Anexo de Imagem / OCR
                  </button>
                  <button
                    onClick={() => setImportMode('text')}
                    className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                      importMode === 'text' ? 'bg-white dark:bg-gray-800 text-primary shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                    }`}
                  >
                    📝 Texto (WhatsApp)
                  </button>
                </div>
              </div>

              {/* MODO IMAGEM (COMIGO e outros) */}
              {importMode === 'image' && (
                <div className="space-y-4">
                  {/* Dropzone */}
                  <div
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault();
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                        if (files.length > 0) setAttachedFiles(prev => [...prev, ...files]);
                      }
                    }}
                    className="border-2 border-dashed border-primary/40 dark:border-primary/30 hover:border-primary bg-primary/5 dark:bg-primary/10 rounded-2xl p-8 text-center transition-all cursor-pointer relative"
                    onClick={() => document.getElementById('comigo-file-input')?.click()}
                  >
                    <input
                      id="comigo-file-input"
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        if (e.target.files && e.target.files.length > 0) {
                          const files = Array.from(e.target.files);
                          setAttachedFiles(prev => [...prev, ...files]);
                        }
                      }}
                    />
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl">
                        📸
                      </div>
                      <p className="font-semibold text-gray-900 dark:text-white text-base">
                        Clique para selecionar ou arraste as fotos/prints dos roteiros
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Você também pode colar direto com <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded font-mono text-[11px]">Ctrl + V</kbd>
                      </p>
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full mt-1">
                        ✨ Aprimoramento e nitidez aplicados automaticamente
                      </span>
                    </div>
                  </div>

                  {/* Attached images gallery */}
                  {attachedFiles.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                          {attachedFiles.length} imagem(ns) selecionada(s)
                        </span>
                        <button
                          onClick={() => setAttachedFiles([])}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Limpar todas
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {attachedFiles.map((file, i) => (
                          <div key={i} className="relative group border rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 aspect-video flex items-center justify-center">
                            <img
                              src={URL.createObjectURL(file)}
                              alt={file.name}
                              className="w-full h-full object-cover cursor-pointer"
                              onClick={() => {
                                setLightboxImage(URL.createObjectURL(file));
                                setLightboxTitle(file.name);
                              }}
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAttachedFiles(prev => prev.filter((_, idx) => idx !== i));
                              }}
                              className="absolute top-1 right-1 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                            >
                              ✕
                            </button>
                            <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded truncate max-w-[90%]">
                              {file.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setStep(0)}
                      className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                    >
                      ← Voltar
                    </button>
                    <button
                      disabled={attachedFiles.length === 0 || isProcessingImages}
                      onClick={handleProcessImages}
                      className="flex-1 py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md"
                    >
                      {isProcessingImages ? (
                        <>
                          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                          <span>{processingStatus || 'Processando Imagens...'}</span>
                        </>
                      ) : (
                        `Processar ${attachedFiles.length} Roteiro(s) →`
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* MODO TEXTO (WhatsApp) */}
              {importMode === 'text' && (
                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Exemplo de Formato Aceito</p>
                    <pre className="text-xs text-gray-600 dark:text-gray-300 font-mono leading-relaxed whitespace-pre-wrap">{`carga 1
📍 PEROLANDIA-GO (COMAG) X ACREUNA-GO (SIAP) 🏁
🚛 VEÍCULO: GRANELEIRO/CAÇAMBA
📌 LOCAL DE EMBARQUE: https://maps.app.goo.gl/...
⚖️ PESO: PESO LIBERADO
💰 VALOR: R$ 80 A TON
🧾 PRODUTO: MILHO A GRANEL
🗓️ EMBARQUE: SEGUNDA FEIRA
🚨 LINK DA CARGA: https://transporter.azship.com.br/...`}</pre>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Texto das cargas *</label>
                    <textarea
                      value={rawText}
                      onChange={e => setRawText(e.target.value)}
                      rows={12}
                      className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent text-sm font-mono resize-none"
                      placeholder="Cole aqui o texto das cargas (carga 1, carga 2, etc.)"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setStep(0)} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
                      ← Voltar
                    </button>
                    <button disabled={!rawText.trim()} onClick={handleParseText} className="flex-1 py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                      Interpretar Cargas →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Review */}
          {step === 2 && !saveResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-semibold text-gray-900 dark:text-white">{editedCargos.length} carga(s)</span> pronta(s) para{' '}
                    <span className="font-semibold text-primary">{selectedClient?.nomeFantasia}</span>
                  </p>
                  {editedCargos.length - validCount > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                      ⚠️ {editedCargos.length - validCount} carga(s) com pendências. Revise os campos antes de confirmar.
                    </p>
                  )}
                </div>
                <button onClick={() => setStep(1)} className="text-sm text-primary hover:underline">← Voltar para anexos/texto</button>
              </div>

              {/* Lista de Cargas Extraídas */}
              {editedCargos.map((cargo, idx) => {
                const icmsRate = cargo.hasIcms ? ((Number(cargo.icmsPercentage) || 0) / 100) : 0;
                const netCompanyVal = parseFloat((cargo.companyFreightValuePerTon * (1 - icmsRate)).toFixed(2));
                const icmsVal = parseFloat((cargo.companyFreightValuePerTon * icmsRate).toFixed(2));

                return (
                  <div key={idx} className={`border rounded-xl overflow-hidden transition-all ${
                    cargo.errors.length > 0 ? 'border-red-300 dark:border-red-700' :
                    cargo.warnings.length > 0 ? 'border-amber-300 dark:border-amber-700' :
                    'border-green-300 dark:border-green-700'
                  }`}>
                    <div className={`flex items-center justify-between px-4 py-2.5 ${
                      cargo.errors.length > 0 ? 'bg-red-50 dark:bg-red-900/20' :
                      cargo.warnings.length > 0 ? 'bg-amber-50 dark:bg-amber-900/20' :
                      'bg-green-50 dark:bg-green-900/20'
                    }`}>
                      <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                        Carga {idx + 1} {cargo.destination ? `— ${cargo.destination}` : ''}
                      </span>
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                        cargo.errors.length > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                        cargo.warnings.length > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' :
                        'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                      }`}>
                        {cargo.errors.length > 0 ? `❌ ${cargo.errors.length} erro(s)` : cargo.warnings.length > 0 ? `⚠️ ${cargo.warnings.length} aviso(s)` : '✅ Pronta'}
                      </span>
                    </div>

                    {(cargo.errors.length > 0 || cargo.warnings.length > 0) && (
                      <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                        {cargo.errors.map((e, i) => <p key={i} className="text-xs text-red-600 dark:text-red-400">❌ {e}</p>)}
                        {cargo.warnings.map((w, i) => <p key={i} className="text-xs text-amber-600 dark:text-amber-400">⚠️ {w}</p>)}
                      </div>
                    )}

                    <div className="p-4 bg-white dark:bg-gray-800 space-y-4">
                      {/* Miniatura do Roteiro com Abertura em Modal */}
                      {cargo.imageDataUrl && (
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center gap-4">
                          <img
                            src={cargo.imageDataUrl}
                            alt="Roteiro"
                            className="w-20 h-20 object-cover rounded-lg border cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => {
                              setLightboxImage(cargo.imageDataUrl || null);
                              setLightboxTitle(`Roteiro da Carga ${idx + 1} (${cargo.destination || 'COMIGO'})`);
                            }}
                            title="Clique para visualizar em tela cheia sem baixar"
                          />
                          <div className="flex-1 text-xs text-gray-600 dark:text-gray-400">
                            <p className="font-semibold text-gray-800 dark:text-gray-200">📸 Roteiro de Entrega Digitalizado</p>
                            <p className="mt-0.5">A imagem original foi aprimorada e será salva automaticamente nos anexos da carga.</p>
                            <button
                              type="button"
                              onClick={() => {
                                setLightboxImage(cargo.imageDataUrl || null);
                                setLightboxTitle(`Roteiro da Carga ${idx + 1} (${cargo.destination || 'COMIGO'})`);
                              }}
                              className="mt-1.5 text-primary text-xs font-semibold hover:underline inline-flex items-center gap-1"
                            >
                              Ver imagem ampliada ↗
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Campos de Origem, Destino e Produto */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            📍 Origem (Cidade, UF) {isComigoClient && <span className="text-[10px] text-emerald-600 font-semibold">(Padrão COMIGO: Rio Verde, GO)</span>}
                          </label>
                          <input
                            type="text"
                            value={cargo.origin}
                            onChange={e => updateEdited(idx, 'origin', e.target.value)}
                            onBlur={e => updateEdited(idx, 'origin', normalizeCityFormat(e.target.value))}
                            className="w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            🏁 Destino (Cidade, UF) *
                          </label>
                          <input
                            type="text"
                            list="brazilian-cities-list"
                            value={cargo.destination}
                            onChange={e => updateEdited(idx, 'destination', e.target.value)}
                            onBlur={e => updateEdited(idx, 'destination', normalizeCityFormat(e.target.value))}
                            placeholder="Digite ou selecione a cidade..."
                            className="w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary"
                          />
                          {cargo.destinationLocation && (
                            <p className="text-xs text-gray-500 mt-0.5">Local / Fazenda: {cargo.destinationLocation}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            🧾 Produto *
                          </label>
                          <select
                            value={cargo.productId || ''}
                            onChange={e => updateEdited(idx, 'productId', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary"
                          >
                            <option value="">— Selecionar produto —</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            ⚖️ Volume Total (ton)
                          </label>
                          <input
                            type="number"
                            value={cargo.totalVolume || ''}
                            onChange={e => updateEdited(idx, 'totalVolume', parseFloat(e.target.value) || 0)}
                            placeholder="Ex: 134"
                            className="w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      </div>

                      {/* Bloco de Fretes, ICMS e Tipos de Veículos */}
                      <div className="p-3.5 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                          {/* Frete Empresa */}
                          <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                              💰 Frete Empresa (R$/ton) *
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={cargo.companyFreightValuePerTon || ''}
                              onChange={e => updateEdited(idx, 'companyFreightValuePerTon', parseFloat(e.target.value) || 0)}
                              placeholder="Digite o valor (ex: 40.00)"
                              className="w-full px-3 py-2 text-sm font-bold border-2 border-primary/40 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                            />
                          </div>

                          {/* ICMS Toggle */}
                          <div className="md:col-span-3 pt-6 flex items-center gap-2">
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={cargo.hasIcms}
                                onChange={e => updateEdited(idx, 'hasIcms', e.target.checked)}
                                className="rounded text-primary focus:ring-primary h-4 w-4"
                              />
                              <span>Tem ICMS?</span>
                            </label>
                            {cargo.hasIcms && (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  value={cargo.icmsPercentage}
                                  onChange={e => updateEdited(idx, 'icmsPercentage', parseFloat(e.target.value) || 0)}
                                  className="w-14 px-2 py-1 text-xs border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                                <span className="text-xs text-gray-500">%</span>
                              </div>
                            )}
                          </div>

                          {/* Tipos de Veículos e Carrocerias */}
                          <div className="md:col-span-6">
                            <CargoVehicleTypesManager
                              vehicleTypes={cargo.vehicleTypes}
                              onChange={(newTypes) => updateEdited(idx, 'vehicleTypes', newTypes)}
                            />
                          </div>
                        </div>

                        {/* Badges de Fretes Calculados */}
                        {cargo.companyFreightValuePerTon > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <div className="flex flex-wrap gap-2">
                              <FreightBadge
                                label="Frete Empresa (Bruto)"
                                value={cargo.companyFreightValuePerTon}
                                sublabel="Base"
                                color="bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800"
                              />
                              {cargo.hasIcms && (
                                <FreightBadge
                                  label={`Base Líquida (-${cargo.icmsPercentage}% ICMS)`}
                                  value={netCompanyVal}
                                  sublabel={`-R$ ${icmsVal.toFixed(2)}`}
                                  color="bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800"
                                />
                              )}
                              <FreightBadge
                                label="Motorista PJ (Margem 8%)"
                                value={cargo.driverFreightValuePerTonPJ}
                                sublabel={cargo.hasIcms ? "-8% pós-ICMS" : "-8%"}
                                color="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
                              />
                              <FreightBadge
                                label="Motorista PF (Margem 12%)"
                                value={cargo.driverFreightValuePerTonPF}
                                sublabel={cargo.hasIcms ? "-12% pós-ICMS" : "-12%"}
                                color="bg-violet-50 dark:bg-violet-900/30 text-violet-800 dark:text-violet-200 border border-violet-200 dark:border-violet-800"
                              />
                            </div>
                            {cargo.hasIcms && (
                              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                                ℹ️ Com ICMS de <strong>{cargo.icmsPercentage}%</strong> (abatimento de R$ {icmsVal.toFixed(2)}/ton), a base líquida de cálculo é de <strong>R$ {netCompanyVal.toFixed(2)}/ton</strong>.
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Programação Diária Badge */}
                      {cargo.dailySchedule && cargo.dailySchedule.length > 0 && (
                        <div className="flex items-center gap-2 text-xs bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5 text-amber-800 dark:text-amber-200">
                          <span className="text-base">📅</span>
                          <div>
                            <span className="font-bold">Programação Diária Automática:</span> Data{' '}
                            <strong>{cargo.dailySchedule[0].date.split('-').reverse().join('/')}</strong> —{' '}
                            <span className="font-semibold">{cargo.dailySchedule[0].type}</span> ({cargo.dailySchedule[0].tonnage} ton)
                          </div>
                        </div>
                      )}

                      {/* Observações / Informações Extras */}
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                          📝 Observações da Carga (Informações do Roteiro)
                        </label>
                        <textarea
                          rows={4}
                          value={cargo.observations || ''}
                          onChange={e => updateEdited(idx, 'observations', e.target.value)}
                          placeholder="Nenhuma observação informada."
                          className="w-full px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white focus:ring-1 focus:ring-primary resize-none font-mono leading-relaxed"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Save result */}
          {step === 2 && saveResult && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              {saveResult.success > 0 ? (
                <>
                  <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{saveResult.success} carga(s) criada(s) com sucesso!</p>
                    {saveResult.failed > 0 && <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">{saveResult.failed} carga(s) não foram criadas (erros).</p>}
                  </div>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">Nenhuma carga foi criada</p>
                </>
              )}
              <button onClick={handleClose} className="px-8 py-2.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-all shadow-md">Fechar</button>
            </div>
          )}
        </div>

        {/* Footer for review step */}
        {step === 2 && !saveResult && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-semibold text-green-600 dark:text-green-400">{validCount}</span> de{' '}
              <span className="font-semibold">{editedCargos.length}</span> carga(s) prontas
            </p>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-all">
                ← Voltar
              </button>
              <button
                disabled={validCount === 0 || isSaving}
                onClick={handleConfirm}
                className="px-6 py-2 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-md"
              >
                {isSaving ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Criando...</>
                ) : `Criar ${validCount} Carga(s)`}
              </button>
            </div>
          </div>
        )}

        {/* Datalist global para autocomplete de cidades brasileiras */}
        <datalist id="brazilian-cities-list">
          {BRAZILIAN_CITIES.map((c, i) => (
            <option key={i} value={c} />
          ))}
        </datalist>

        {/* Modal Interativo de Visualização Ampliada da Imagem */}
        <ImageLightboxModal
          isOpen={!!lightboxImage}
          onClose={() => setLightboxImage(null)}
          imageUrl={lightboxImage}
          title={lightboxTitle}
        />

      </div>
    </div>
  );
};

export default BulkCargoImportModal;
