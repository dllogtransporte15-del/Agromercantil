import { geocodeCity, calculateDistance, getCoordsSync } from './geocoding';
import type { Cargo } from '../types';
import { getAllToolQuotes, getToolQuotes, QuoteRecord } from '../services/api/toolsApi';

export interface RouteSuggestion {
  type: 'cargo' | 'quote';
  id: string;
  sourceTitle: string; // Ex: "Última Cotação (Rota Exata)" ou "Carga Real #274"
  isExactRoute?: boolean; // True when origin and destination match exactly (0km)
  clientName?: string;
  productName?: string;
  matchedOrigin: string;
  matchedDestination: string;
  originDistanceKm: number;
  destinationDistanceKm: number;
  date: string; // ISO date
  companyFreightRate: number; // R$/ton
  driverFreightRatePJ?: number; // R$/ton
  driverFreightRatePF?: number; // R$/ton
  driverFreightRate: number; // R$/ton
  tollValue?: number;
  hasCompanyToll?: boolean;
  hasDriverTollPJ?: boolean;
  hasDriverTollPF?: boolean;
  hasIcms?: boolean;
  icmsPercentage?: number;
  margin?: number;
  status?: string;
  axes?: number;
}

interface Coords {
  lat: number;
  lng: number;
}

// In-memory cache for fast coordinate resolution
const coordsCache = new Map<string, Coords>();

export async function getCityCoordinates(cityName: string): Promise<Coords | null> {
  if (!cityName || !cityName.trim()) return null;
  const normalized = cityName.trim().toLowerCase();
  
  if (coordsCache.has(normalized)) {
    return coordsCache.get(normalized)!;
  }

  // Check sync cache in geocoding.ts
  const syncCoord = getCoordsSync(normalized);
  if (syncCoord) {
    coordsCache.set(normalized, syncCoord);
    return syncCoord;
  }

  // Fetch via geocodeCity
  try {
    const res = await geocodeCity(cityName);
    if (res) {
      coordsCache.set(normalized, res);
      return res;
    }
  } catch (err) {
    console.warn(`[RouteHistorySuggester] Failed to geocode ${cityName}:`, err);
  }

  return null;
}

/**
 * Normalizes city string for comparison (stripping accents and punctuation)
 */
function normalizeCityName(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Extracts UF (state code) if present
 */
function extractUF(str: string): string | null {
  const parts = str.split(/[-–,/]/);
  if (parts.length > 1) {
    const candidate = parts[parts.length - 1].trim().toUpperCase();
    if (candidate.length === 2) return candidate;
  }
  return null;
}

/**
 * Checks if two city strings are practically identical
 */
export function areCityNamesEqual(cityA: string, cityB: string): boolean {
  if (!cityA || !cityB) return false;
  const a = normalizeCityName(cityA);
  const b = normalizeCityName(cityB);
  if (a === b) return true;

  const ufA = extractUF(cityA);
  const ufB = extractUF(cityB);
  if (ufA && ufB && ufA !== ufB) {
    return false; // Different states
  }

  const aCity = a.split(/[-–,/]/)[0].trim();
  const bCity = b.split(/[-–,/]/)[0].trim();
  return aCity === bCity && aCity.length > 2;
}

export interface FindRouteSuggestionOptions {
  origin: string;
  destination: string;
  cargos?: Cargo[];
  quotes?: QuoteRecord[];
  maxRadiusKm?: number; // default 150km
  userId?: string;
}

/**
 * Finds the best/most recent historical route suggestion within a max radius (default 150km).
 * 
 * INTELLIGENT HIERARCHY:
 * 1. Exact Route Match (Origin and Destination match 100%):
 *    - Looks across both real cargos and saved quotes, picking the most recent transaction/quote!
 * 2. Nearby Cargos (Radius <= 150km):
 *    - Real operations within the geographic radius, sorted by proximity & recent date.
 * 3. Nearby Quotes (Radius <= 150km):
 *    - Saved quotes within the geographic radius.
 */
export async function findRouteHistorySuggestion({
  origin,
  destination,
  cargos = [],
  quotes,
  maxRadiusKm = 150,
  userId
}: FindRouteSuggestionOptions): Promise<RouteSuggestion | null> {
  if (!origin || !destination) return null;

  const originCoords = await getCityCoordinates(origin);
  const destCoords = await getCityCoordinates(destination);

  // Load quotes if not provided or if list is short
  let quotesList = quotes;
  if (!quotesList || quotesList.length === 0) {
    try {
      if (userId) {
        quotesList = await getToolQuotes(userId);
      } else {
        quotesList = await getAllToolQuotes();
      }
    } catch (err) {
      console.warn('[RouteHistorySuggester] Failed to fetch quotes:', err);
      quotesList = [];
    }
  }

  const cargoMatches: Array<{
    type: 'cargo';
    cargo: Cargo;
    destCity: string;
    originDist: number;
    destDist: number;
    isExact: boolean;
    date: number;
  }> = [];

  const quoteMatches: Array<{
    type: 'quote';
    quote: QuoteRecord;
    originDist: number;
    destDist: number;
    isExact: boolean;
    date: number;
  }> = [];

  // --- 1. Process Cargos ---
  if (cargos && cargos.length > 0) {
    for (const cargo of cargos) {
      const cargoOrigin = cargo.origin || '';
      if (!cargoOrigin) continue;

      const destinationCities: string[] = [];
      if (cargo.destinations && cargo.destinations.length > 0) {
        cargo.destinations.forEach(d => {
          if (d.city) destinationCities.push(d.city);
        });
      }
      if (cargo.destination && !destinationCities.includes(cargo.destination)) {
        destinationCities.push(cargo.destination);
      }

      if (destinationCities.length === 0) continue;

      let originDist = 999999;
      const isOriginExact = areCityNamesEqual(origin, cargoOrigin);
      if (isOriginExact) {
        originDist = 0;
      } else if (originCoords) {
        let cOriginCoords = cargo.originCoords;
        if (!cOriginCoords) {
          cOriginCoords = await getCityCoordinates(cargoOrigin) || undefined;
        }
        if (cOriginCoords) {
          originDist = calculateDistance(originCoords.lat, originCoords.lng, cOriginCoords.lat, cOriginCoords.lng);
        }
      }

      if (originDist > maxRadiusKm) continue;

      for (const dCity of destinationCities) {
        let destDist = 999999;
        const isDestExact = areCityNamesEqual(destination, dCity);
        if (isDestExact) {
          destDist = 0;
        } else if (destCoords) {
          let cDestCoords = cargo.destinationCoords;
          if (!cDestCoords) {
            cDestCoords = await getCityCoordinates(dCity) || undefined;
          }
          if (cDestCoords) {
            destDist = calculateDistance(destCoords.lat, destCoords.lng, cDestCoords.lat, cDestCoords.lng);
          }
        }

        if (destDist <= maxRadiusKm) {
          const isExact = (isOriginExact || originDist <= 5) && (isDestExact || destDist <= 5);
          cargoMatches.push({
            type: 'cargo',
            cargo,
            destCity: dCity,
            originDist,
            destDist,
            isExact,
            date: new Date(cargo.createdAt || 0).getTime()
          });
          break;
        }
      }
    }
  }

  // --- 2. Process Quotes ---
  if (quotesList && quotesList.length > 0) {
    for (const q of quotesList) {
      if (!q.origin || !q.destination) continue;

      let originDist = 999999;
      const isOriginExact = areCityNamesEqual(origin, q.origin);
      if (isOriginExact) {
        originDist = 0;
      } else if (originCoords) {
        const qOriginCoords = await getCityCoordinates(q.origin);
        if (qOriginCoords) {
          originDist = calculateDistance(originCoords.lat, originCoords.lng, qOriginCoords.lat, qOriginCoords.lng);
        }
      }

      if (originDist > maxRadiusKm) continue;

      let destDist = 999999;
      const isDestExact = areCityNamesEqual(destination, q.destination);
      if (isDestExact) {
        destDist = 0;
      } else if (destCoords) {
        const qDestCoords = await getCityCoordinates(q.destination);
        if (qDestCoords) {
          destDist = calculateDistance(destCoords.lat, destCoords.lng, qDestCoords.lat, qDestCoords.lng);
        }
      }

      if (destDist <= maxRadiusKm) {
        const isExact = (isOriginExact || originDist <= 5) && (isDestExact || destDist <= 5);
        quoteMatches.push({
          type: 'quote',
          quote: q,
          originDist,
          destDist,
          isExact,
          date: new Date(q.date || 0).getTime()
        });
      }
    }
  }

  // --- 3. Prioritization & Selection ---

  // LEVEL 1: EXACT MATCHES (Top Priority)
  // When origin and destination match the route, return the most recent transaction or quote!
  const exactCargoMatches = cargoMatches.filter(m => m.isExact).sort((a, b) => b.date - a.date);
  const exactQuoteMatches = quoteMatches.filter(m => m.isExact).sort((a, b) => b.date - a.date);

  if (exactCargoMatches.length > 0 || exactQuoteMatches.length > 0) {
    // If both exact cargo and exact quote exist, pick the most recent
    const latestCargo = exactCargoMatches[0];
    const latestQuote = exactQuoteMatches[0];

    if (latestQuote && (!latestCargo || latestQuote.date >= latestCargo.date)) {
      const q = latestQuote.quote;
      return {
        type: 'quote',
        id: q.id,
        isExactRoute: true,
        sourceTitle: 'Última Cotação (Rota Exata)',
        clientName: q.clientName,
        productName: q.productName,
        matchedOrigin: q.origin,
        matchedDestination: q.destination,
        originDistanceKm: 0,
        destinationDistanceKm: 0,
        date: q.date,
        companyFreightRate: q.companyFreightPerTon || 0,
        driverFreightRate: q.driverFreightPerTon || 0,
        driverFreightRatePJ: q.driverFreightPerTon || 0,
        driverFreightRatePF: q.driverFreightPerTon || 0,
        tollValue: q.tollValue || 0,
        margin: q.margin || 0,
        axes: q.axes
      };
    } else if (latestCargo) {
      return buildCargoSuggestion(latestCargo.cargo, latestCargo.destCity, 0, 0, true);
    }
  }

  // LEVEL 2: NEARBY CARGOS (Radius <= 150km)
  if (cargoMatches.length > 0) {
    // Sort by proximity sum, then by most recent date
    cargoMatches.sort((a, b) => {
      const distSumA = a.originDist + a.destDist;
      const distSumB = b.originDist + b.destDist;
      if (Math.abs(distSumA - distSumB) > 30) {
        return distSumA - distSumB; // Closer route takes precedence
      }
      return b.date - a.date;
    });

    const best = cargoMatches[0];
    return buildCargoSuggestion(best.cargo, best.destCity, Math.round(best.originDist), Math.round(best.destDist), false);
  }

  // LEVEL 3: NEARBY QUOTES (Radius <= 150km)
  if (quoteMatches.length > 0) {
    quoteMatches.sort((a, b) => {
      const distSumA = a.originDist + a.destDist;
      const distSumB = b.originDist + b.destDist;
      if (Math.abs(distSumA - distSumB) > 30) {
        return distSumA - distSumB;
      }
      return b.date - a.date;
    });

    const best = quoteMatches[0];
    const q = best.quote;
    return {
      type: 'quote',
      id: q.id,
      isExactRoute: false,
      sourceTitle: 'Cotação Salva',
      clientName: q.clientName,
      productName: q.productName,
      matchedOrigin: q.origin,
      matchedDestination: q.destination,
      originDistanceKm: Math.round(best.originDist),
      destinationDistanceKm: Math.round(best.destDist),
      date: q.date,
      companyFreightRate: q.companyFreightPerTon || 0,
      driverFreightRate: q.driverFreightPerTon || 0,
      driverFreightRatePJ: q.driverFreightPerTon || 0,
      driverFreightRatePF: q.driverFreightPerTon || 0,
      tollValue: q.tollValue || 0,
      margin: q.margin || 0,
      axes: q.axes
    };
  }

  return null;
}

function buildCargoSuggestion(
  cargo: Cargo,
  destCity: string,
  originDist: number,
  destDist: number,
  isExact: boolean
): RouteSuggestion {
  let companyFreightRate = cargo.companyFreightValuePerTon || 0;
  let driverFreightRatePJ = cargo.driverFreightValuePerTonPJ ?? cargo.driverFreightValuePerTon ?? 0;
  let driverFreightRatePF = cargo.driverFreightValuePerTonPF ?? cargo.driverFreightValuePerTon ?? 0;
  let driverFreightRate = cargo.driverFreightValuePerTon || driverFreightRatePJ || 0;
  let hasCompanyToll = !!cargo.companyFreightHasToll;
  let hasDriverTollPJ = !!(cargo.driverFreightHasTollPJ ?? cargo.driverFreightHasToll);
  let hasDriverTollPF = !!(cargo.driverFreightHasTollPF ?? cargo.driverFreightHasToll);
  let hasIcms = !!cargo.hasIcms;
  let icmsPercentage = cargo.icmsPercentage || 0;

  if (cargo.destinations && cargo.destinations.length > 0) {
    const matchingDestObj = cargo.destinations.find(d => areCityNamesEqual(d.city, destCity)) || cargo.destinations[0];
    if (matchingDestObj && matchingDestObj.freightLegs && matchingDestObj.freightLegs.length > 0) {
      const leg = matchingDestObj.freightLegs[0];
      if (leg.companyFreightValuePerTon > 0) companyFreightRate = leg.companyFreightValuePerTon;
      if (leg.driverFreightValuePerTonPJ !== undefined) driverFreightRatePJ = leg.driverFreightValuePerTonPJ;
      if (leg.driverFreightValuePerTonPF !== undefined) driverFreightRatePF = leg.driverFreightValuePerTonPF;
      if (leg.driverFreightValuePerTon > 0) driverFreightRate = leg.driverFreightValuePerTon;
      hasCompanyToll = !!leg.companyFreightHasToll;
      hasDriverTollPJ = !!(leg.driverFreightHasTollPJ ?? leg.driverFreightHasToll);
      hasDriverTollPF = !!(leg.driverFreightHasTollPF ?? leg.driverFreightHasToll);
      hasIcms = !!leg.hasIcms;
      icmsPercentage = leg.icmsPercentage || 0;
    }
  } else if (cargo.freightLegs && cargo.freightLegs.length > 0) {
    const leg = cargo.freightLegs[0];
    if (leg.companyFreightValuePerTon > 0) companyFreightRate = leg.companyFreightValuePerTon;
    if (leg.driverFreightValuePerTonPJ !== undefined) driverFreightRatePJ = leg.driverFreightValuePerTonPJ;
    if (leg.driverFreightValuePerTonPF !== undefined) driverFreightRatePF = leg.driverFreightValuePerTonPF;
    if (leg.driverFreightValuePerTon > 0) driverFreightRate = leg.driverFreightValuePerTon;
    hasCompanyToll = !!leg.companyFreightHasToll;
    hasDriverTollPJ = !!(leg.driverFreightHasTollPJ ?? leg.driverFreightHasToll);
    hasDriverTollPF = !!(leg.driverFreightHasTollPF ?? leg.driverFreightHasToll);
    hasIcms = !!leg.hasIcms;
    icmsPercentage = leg.icmsPercentage || 0;
  }

  return {
    type: 'cargo',
    id: cargo.id,
    isExactRoute: isExact,
    sourceTitle: isExact ? `Carga Real #${cargo.sequenceId || cargo.id} (Rota Exata)` : `Carga Real #${cargo.sequenceId || cargo.id}`,
    clientName: cargo.clientId,
    productName: cargo.productId,
    matchedOrigin: cargo.origin,
    matchedDestination: destCity,
    originDistanceKm: originDist,
    destinationDistanceKm: destDist,
    date: cargo.createdAt,
    companyFreightRate,
    driverFreightRatePJ,
    driverFreightRatePF,
    driverFreightRate,
    hasCompanyToll,
    hasDriverTollPJ,
    hasDriverTollPF,
    hasIcms,
    icmsPercentage,
    status: cargo.status
  };
}
