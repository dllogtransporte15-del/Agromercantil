/**
 * Utility to geocode address strings using multiple high-reliability providers:
 * 1. Local Pre-cached In-Memory & LocalStorage Dictionary
 * 2. Photon API (Komoot OSM Geocoder - fast, CORS-enabled, reliable)
 * 3. OpenStreetMap Nominatim API (Fallback)
 */

export interface GeocodedLocation {
  lat: number;
  lng: number;
  label?: string;
}

const LOCAL_STORAGE_KEY = 'agromercantil_geocache_v1';

const geocodeCache: Record<string, GeocodedLocation | null> = {
  'catalão, go': { lat: -18.1691, lng: -47.9463, label: 'Catalão, Goiás, Brasil' },
  'sinop, mt': { lat: -11.8598, lng: -55.5031, label: 'Sinop, Mato Grosso, Brasil' },
  'cuiabá, mt': { lat: -15.6010, lng: -56.0974, label: 'Cuiabá, Mato Grosso, Brasil' },
  'sorriso, mt': { lat: -12.5507, lng: -55.7126, label: 'Sorriso, Mato Grosso, Brasil' },
  'rio verde, go': { lat: -17.7915, lng: -50.9202, label: 'Rio Verde, Goiás, Brasil' },
  'goiânia, go': { lat: -16.6869, lng: -49.2648, label: 'Goiânia, Goiás, Brasil' },
  'campo grande, ms': { lat: -20.4697, lng: -54.6201, label: 'Campo Grande, Mato Grosso do Sul, Brasil' },
  'rondonópolis, mt': { lat: -16.4674, lng: -54.6347, label: 'Rondonópolis, Mato Grosso, Brasil' },
  'são paulo, sp': { lat: -23.5505, lng: -46.6333, label: 'São Paulo, São Paulo, Brasil' },
  'santos, sp': { lat: -23.9608, lng: -46.3339, label: 'Santos, São Paulo, Brasil' },
  'paranaguá, pr': { lat: -25.5204, lng: -48.5093, label: 'Paranaguá, Paraná, Brasil' },
  'uberlândia, mg': { lat: -18.9186, lng: -48.2772, label: 'Uberlândia, Minas Gerais, Brasil' },
  'patrocínio, mg': { lat: -18.9433, lng: -46.9944, label: 'Patrocínio, Minas Gerais, Brasil' },
  'guarda-mor, mg': { lat: -17.7769, lng: -47.1042, label: 'Guarda-Mor, Minas Gerais, Brasil' },
  'cristalina, go': { lat: -16.7686, lng: -47.6133, label: 'Cristalina, Goiás, Brasil' },
  'anápolis, go': { lat: -16.3267, lng: -48.9528, label: 'Anápolis, Goiás, Brasil' },
  'rio verde de mato grosso, ms': { lat: -18.9181, lng: -54.8442, label: 'Rio Verde de Mato Grosso, Mato Grosso do Sul, Brasil' },
  'dourados, ms': { lat: -22.2235, lng: -54.8064, label: 'Dourados, Mato Grosso do Sul, Brasil' },
  'luís eduardo magalhães, ba': { lat: -12.0968, lng: -45.7872, label: 'Luís Eduardo Magalhães, Bahia, Brasil' },
  'barreiras, ba': { lat: -12.1528, lng: -44.9978, label: 'Barreiras, Bahia, Brasil' },
  'primavera do leste, mt': { lat: -15.5591, lng: -54.2965, label: 'Primavera do Leste, Mato Grosso, Brasil' },
  'nova mutum, mt': { lat: -13.8294, lng: -56.0792, label: 'Nova Mutum, Mato Grosso, Brasil' },
  'lucas do rio verde, mt': { lat: -13.0645, lng: -55.9103, label: 'Lucas do Rio Verde, Mato Grosso, Brasil' },
  'passos, mg': { lat: -20.723, lng: -46.611, label: 'Passos, Minas Gerais, Brasil' },
  'guarujá, sp': { lat: -23.993, lng: -46.257, label: 'Guarujá, São Paulo, Brasil' },
  'carmo do rio claro, mg': { lat: -20.973315, lng: -46.1186754, label: 'Carmo do Rio Claro, Minas Gerais, Brasil' },
  'santa luzia, mg': { lat: -19.7702097, lng: -43.8505291, label: 'Santa Luzia, Minas Gerais, Brasil' },
  'belo horizonte, mg': { lat: -19.9227318, lng: -43.9450948, label: 'Belo Horizonte, Minas Gerais, Brasil' },
};

// Try to hydrate cache from LocalStorage if available in browser
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.assign(geocodeCache, parsed);
    }
  }
} catch (e) {
  // Ignore storage access errors
}

function saveToLocalStorageCache(key: string, value: GeocodedLocation) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const current = JSON.parse(window.localStorage.getItem(LOCAL_STORAGE_KEY) || '{}');
      current[key] = value;
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current));
    }
  } catch (e) {
    // Ignore storage write errors
  }
}

/**
 * Clean and standardize address inputs (e.g., "Carmo do Rio Claro - MG" -> "Carmo do Rio Claro, MG")
 */
function cleanQueryString(rawQuery: string): string {
  let cleaned = rawQuery.trim();
  cleaned = cleaned.replace(/\s+-\s+Brasil$/i, '').replace(/,\s*Brasil$/i, '').replace(/,\s*Brazil$/i, '');
  // Replace "Cidade - UF" with "Cidade, UF" or "Cidade / UF"
  cleaned = cleaned.replace(/\s+[-/]\s+([a-zA-Z]{2})$/i, ', $1');
  return cleaned.trim();
}

/**
 * Normalizes query string for cache keying
 */
function normalizeForCache(query: string): string {
  return cleanQueryString(query).toLowerCase();
}

/**
 * Primary Geocoder: Photon (Komoot OSM Geocoder)
 */
async function fetchFromPhoton(query: string): Promise<GeocodedLocation | null> {
  const clean = cleanQueryString(query);
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(clean)}&limit=1`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  if (data && data.features && data.features.length > 0) {
    const f = data.features[0];
    const coords = f.geometry?.coordinates;
    if (coords && coords.length >= 2) {
      return {
        lng: parseFloat(coords[0]),
        lat: parseFloat(coords[1]),
        label: [f.properties?.name, f.properties?.state, f.properties?.country].filter(Boolean).join(', ') || clean
      };
    }
  }
  return null;
}

/**
 * Secondary Geocoder: OpenStreetMap Nominatim
 */
async function fetchFromNominatim(query: string): Promise<GeocodedLocation | null> {
  const clean = cleanQueryString(query);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(clean + ', Brasil')}&countrycodes=br&addressdetails=1&limit=1`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  if (data && data.length > 0) {
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      label: data[0].display_name
    };
  }
  return null;
}

/**
 * Main geocoding function with multi-tier fallback and persistent caching
 */
export async function geocodeCity(query: string): Promise<GeocodedLocation | null> {
  if (!query || !query.trim()) return null;
  
  const normalized = normalizeForCache(query);
  
  // 1. In-memory and pre-cached check
  if (geocodeCache[normalized]) {
    return geocodeCache[normalized];
  }

  // 2. Try Photon API (Komoot - fast, reliable, CORS-enabled)
  try {
    const photonResult = await fetchFromPhoton(query);
    if (photonResult) {
      geocodeCache[normalized] = photonResult;
      saveToLocalStorageCache(normalized, photonResult);
      return photonResult;
    }
  } catch (err) {
    console.warn(`[Geocoding] Photon failed for "${query}":`, err);
  }

  // 3. Fallback to Nominatim OSM
  try {
    const nominatimResult = await fetchFromNominatim(query);
    if (nominatimResult) {
      geocodeCache[normalized] = nominatimResult;
      saveToLocalStorageCache(normalized, nominatimResult);
      return nominatimResult;
    }
  } catch (err) {
    console.warn(`[Geocoding] Nominatim failed for "${query}":`, err);
  }

  // 4. Try simplified query if state was present (e.g. "Carmo do Rio Claro")
  const parts = query.split(/[,/-]/);
  if (parts.length > 1) {
    const cityOnly = parts[0].trim();
    if (cityOnly.length >= 3) {
      try {
        const simplifiedResult = await fetchFromPhoton(cityOnly);
        if (simplifiedResult) {
          geocodeCache[normalized] = simplifiedResult;
          saveToLocalStorageCache(normalized, simplifiedResult);
          return simplifiedResult;
        }
      } catch (e) {
        // ignore
      }
    }
  }

  return null;
}

export function getCoordsSync(query: string): { lat: number; lng: number } | null {
  if (!query || !query.trim()) return null;
  const normalized = normalizeForCache(query);
  return geocodeCache[normalized] || null;
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

const STATE_DDDS: Record<string, string[]> = {
  'AC': ['68'],
  'AL': ['82'],
  'AM': ['92', '97'],
  'AP': ['96'],
  'BA': ['71', '73', '74', '75', '77'],
  'CE': ['85', '88'],
  'DF': ['61'],
  'ES': ['27', '28'],
  'GO': ['61', '62', '64'],
  'MA': ['98', '99'],
  'MG': ['31', '32', '33', '34', '35', '37', '38'],
  'MS': ['67'],
  'MT': ['65', '66'],
  'PA': ['91', '93', '94'],
  'PB': ['83'],
  'PE': ['81', '87'],
  'PI': ['86', '89'],
  'PR': ['41', '42', '43', '44', '45', '46'],
  'RJ': ['21', '22', '24'],
  'RN': ['84'],
  'RO': ['69'],
  'RR': ['95'],
  'RS': ['51', '53', '54', '55'],
  'SC': ['47', '48', '49'],
  'SE': ['79'],
  'SP': ['11', '12', '13', '14', '15', '16', '17', '18', '19'],
  'TO': ['63'],
};

export function getDDDsForCity(cityString: string): string[] {
  if (!cityString) return [];
  const parts = cityString.split(',');
  if (parts.length > 1) {
    const uf = parts[1].trim().toUpperCase();
    return STATE_DDDS[uf] || [];
  }
  return [];
}
