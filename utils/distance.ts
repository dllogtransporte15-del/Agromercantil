export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1); 
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

// Coordenadas das principais cidades e polos logísticos de atuação
const LOGISTICS_CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  // Minas Gerais
  'patrocinio': { lat: -18.9433, lng: -46.9944 },
  'perdizes': { lat: -19.3528, lng: -47.2917 },
  'uberaba': { lat: -19.7483, lng: -47.9319 },
  'uberlandia': { lat: -18.9186, lng: -48.2772 },
  'araguari': { lat: -18.6472, lng: -48.1872 },
  'araxa': { lat: -19.5933, lng: -46.9406 },
  'sacramento': { lat: -19.8653, lng: -47.4403 },
  'lagamar': { lat: -18.1811, lng: -46.8089 },
  'patos de minas': { lat: -18.5789, lng: -46.5181 },
  'serra do salitre': { lat: -19.1111, lng: -46.6908 },
  'serra do sallitre': { lat: -19.1111, lng: -46.6908 },
  'serra da salitre': { lat: -19.1111, lng: -46.6908 },
  'pouso alegre': { lat: -22.2300, lng: -45.9364 },
  'alfenas': { lat: -21.4289, lng: -45.9464 },
  'alpinopolis': { lat: -20.8633, lng: -46.3878 },
  'monte belo': { lat: -21.3189, lng: -46.3364 },
  'passos': { lat: -20.7230, lng: -46.6110 },
  'pratapolis': { lat: -20.7328, lng: -46.8539 },
  'alterosa': { lat: -21.2464, lng: -46.1439 },
  'bom jesus da penha': { lat: -21.0189, lng: -46.5208 },
  'nova resende': { lat: -21.1214, lng: -46.4214 },
  'tres coracoes': { lat: -21.6958, lng: -45.2589 },
  'varginha': { lat: -21.5517, lng: -45.4303 },
  'pocos de caldas': { lat: -21.7878, lng: -46.5614 },
  'arcos': { lat: -20.2819, lng: -45.5408 },
  'monte santo de minas': { lat: -21.1906, lng: -46.9808 },
  'campo do meio': { lat: -21.2464, lng: -45.8458 },
  'carmo do rio claro': { lat: -20.9719, lng: -46.1189 },
  'medeiros': { lat: -19.9964, lng: -46.2239 },
  'machado': { lat: -21.6758, lng: -45.9189 },
  'guape': { lat: -20.7678, lng: -45.9228 },
  'sao pedro da uniao': { lat: -21.0828, lng: -46.6214 },
  'sao sebastiao da vitoria': { lat: -21.2464, lng: -44.8917 },
  'ituiutaba': { lat: -18.9697, lng: -49.4653 },
  'abadia dos dourados': { lat: -18.4900, lng: -47.4042 },
  'monte carmelo': { lat: -18.7258, lng: -47.4983 },
  'coromandel': { lat: -18.4736, lng: -47.2003 },
  'joao pinheiro': { lat: -17.7428, lng: -46.1725 },
  'paracatu': { lat: -17.2222, lng: -46.8747 },
  'unai': { lat: -16.3575, lng: -46.9056 },
  'guarda mor': { lat: -17.7769, lng: -47.1042 },
  'sao joao nepomuceno': { lat: -21.5439, lng: -43.0103 },
  'belo horizonte': { lat: -19.9167, lng: -43.9345 },

  // Goiás & DF
  'catalao': { lat: -18.1691, lng: -47.9463 },
  'ipameri': { lat: -17.7219, lng: -48.1597 },
  'nazario': { lat: -16.5833, lng: -49.8833 },
  'bela vista de goias': { lat: -16.9728, lng: -48.9528 },
  'rio verde': { lat: -17.7915, lng: -50.9202 },
  'montividiu': { lat: -17.4439, lng: -51.1739 },
  'mineiros': { lat: -17.5694, lng: -52.5514 },
  'jatai': { lat: -17.8814, lng: -51.7144 },
  'goiatuba': { lat: -18.0125, lng: -49.3556 },
  'itumbiara': { lat: -18.4189, lng: -49.2153 },
  'goiania': { lat: -16.6869, lng: -49.2648 },
  'aparecida de goiania': { lat: -16.8228, lng: -49.2481 },
  'anapolis': { lat: -16.3267, lng: -48.9528 },
  'senador canedo': { lat: -16.7083, lng: -49.0917 },
  'trindade': { lat: -16.6506, lng: -49.4897 },
  'cristalina': { lat: -16.7686, lng: -47.6133 },
  'luziania': { lat: -16.2528, lng: -47.9500 },
  'formosa': { lat: -15.5367, lng: -47.3344 },
  'caldas novas': { lat: -17.7442, lng: -48.6258 },
  'brasilia': { lat: -15.7975, lng: -47.8919 },

  // São Paulo
  'santos': { lat: -23.9608, lng: -46.3339 },
  'cubatao': { lat: -23.8950, lng: -46.4253 },
  'guaruja': { lat: -23.9930, lng: -46.2570 },
  'sao paulo': { lat: -23.5505, lng: -46.6333 },
  'campinas': { lat: -22.9099, lng: -47.0626 },
  'araras': { lat: -22.3572, lng: -47.3842 },
  'rio claro': { lat: -22.4114, lng: -47.5614 },
  'limeira': { lat: -22.5647, lng: -47.4017 },
  'piracicaba': { lat: -22.7338, lng: -47.6476 },
  'paulinia': { lat: -22.7611, lng: -47.1539 },
  'ribeirao preto': { lat: -21.1767, lng: -47.8208 },
  'franca': { lat: -20.5386, lng: -47.4008 },
  'orlandia': { lat: -20.7206, lng: -47.8878 },
  'matao': { lat: -21.6033, lng: -48.3653 },
  'sao carlos': { lat: -22.0175, lng: -47.8908 },
  'araraquara': { lat: -21.7944, lng: -48.1758 },
  'colombia': { lat: -20.1764, lng: -48.6892 },
  'barretos': { lat: -20.5572, lng: -48.5678 },
  'itapui': { lat: -22.2344, lng: -48.7189 },
  'avare': { lat: -23.1056, lng: -48.9256 },
  'sorocaba': { lat: -23.5015, lng: -47.4526 },
  'salto de pirapora': { lat: -23.6494, lng: -47.5728 },

  // Paraná, Santa Catarina & RS
  'paranagua': { lat: -25.5204, lng: -48.5093 },
  'curitiba': { lat: -25.4284, lng: -49.2733 },
  'londrina': { lat: -23.3045, lng: -51.1696 },
  'maringa': { lat: -23.4210, lng: -51.9331 },
  'cascavel': { lat: -24.9578, lng: -53.4595 },
  'castro': { lat: -24.7911, lng: -50.0119 },
  'ponta grossa': { lat: -25.0994, lng: -50.1583 },
  'itajai': { lat: -26.9078, lng: -48.6619 },

  // Centro-Oeste & Norte
  'gurupi': { lat: -11.7297, lng: -49.0686 },
  'palmas': { lat: -10.1844, lng: -48.3336 },
  'rio brilhante': { lat: -21.8019, lng: -54.5464 },
  'sao gabriel do oeste': { lat: -19.3925, lng: -54.5658 },
  'campo grande': { lat: -20.4697, lng: -54.6201 },
  'dourados': { lat: -22.2235, lng: -54.8064 },
  'cuiaba': { lat: -15.6010, lng: -56.0974 },
  'rondonopolis': { lat: -16.4674, lng: -54.6347 },
  'sinop': { lat: -11.8598, lng: -55.5031 },
  'sorriso': { lat: -12.5507, lng: -55.7126 }
};

function normalizeName(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findCityCoords(cityName: string): { lat: number; lng: number } | null {
  if (!cityName) return null;
  const norm = normalizeName(cityName);
  if (!norm) return null;

  // Busca exata
  if (LOGISTICS_CITY_COORDINATES[norm]) {
    return LOGISTICS_CITY_COORDINATES[norm];
  }

  // Remove estado (ex: "lagamar mg" -> "lagamar")
  const words = norm.split(' ');
  const stateTokens = ['mg', 'go', 'sp', 'pr', 'ms', 'mt', 'to', 'rj', 'es', 'ba', 'sc', 'rs', 'df'];
  const cleanWords = words.filter(w => !stateTokens.includes(w));
  const withoutState = cleanWords.join(' ');

  if (withoutState && LOGISTICS_CITY_COORDINATES[withoutState]) {
    return LOGISTICS_CITY_COORDINATES[withoutState];
  }

  // Busca por prefixo ou inclusão
  for (const [key, coords] of Object.entries(LOGISTICS_CITY_COORDINATES)) {
    if (norm.includes(key) || key.includes(withoutState)) {
      return coords;
    }
  }

  return null;
}

/**
 * Calcula a distância rodoviária estimada em KM entre cidade de origem e destino
 */
export function calculateRoadDistanceKm(originCity: string, destCity: string, rawRoute?: string | null): number {
  // 1. Se na rota existir número explícito de km (ex: "580 km", "430km" ou "580")
  if (rawRoute && typeof rawRoute === 'string') {
    const kmMatch = rawRoute.match(/(\d{2,4})\s*(?:km|kms)?/i);
    if (kmMatch && kmMatch[1]) {
      const num = parseInt(kmMatch[1], 10);
      if (num >= 30 && num <= 4000) return num;
    }
  }

  // 2. Extrai cidade limpa se tiver múltiplos destinos (ex: "Cubatão Sp / Santos Sp" -> "Cubatão")
  const cleanOrigin = originCity?.split('/')[0]?.split('(')[0]?.trim();
  const cleanDest = destCity?.split('/')[0]?.split('(')[0]?.trim();

  if (!cleanOrigin || !cleanDest || cleanOrigin === '-' || cleanDest === '-') {
    return 0;
  }

  const c1 = findCityCoords(cleanOrigin);
  const c2 = findCityCoords(cleanDest);

  if (c1 && c2) {
    const directKm = getDistanceKm(c1.lat, c1.lng, c2.lat, c2.lng);
    // Fator médio de sinuosidade rodoviária no Brasil = 1.25x
    return Math.round(directKm * 1.25);
  }

  return 0;
}
