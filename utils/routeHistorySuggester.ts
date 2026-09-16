import type { Cargo } from '../types';
import { getAllToolQuotes, QuoteRecord } from './toolStorage';
import { geocodeCity } from './geocoding';

/**
 * Calcula a distância em linha reta (em km) entre duas coordenadas geográficas
 * utilizando a fórmula de Haversine.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Raio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface RouteHistorySuggestion {
  source: 'cargo' | 'quote';
  companyFreightRate: number; // R$/ton
  driverFreightRate: number;  // R$/ton
  tollValue?: number;
  matchedOrigin: string;
  matchedDestination: string;
  originDistanceKm: number;
  destinationDistanceKm: number;
  date: string;
  clientName?: string;
  cargoSequenceId?: number;
  totalMatchesCount: number;
}

const normalizeCityName = (city: string): string => {
  return city
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Busca sugestões de valores no histórico de cargas (1ª prioridade)
 * ou no histórico de cotações (2ª prioridade) dentro de um raio de até 150 km.
 */
export async function findRouteHistorySuggestion(
  originQuery: string,
  destinationQuery: string,
  cargos: Cargo[] = [],
  preloadedQuotes?: QuoteRecord[],
  maxRadiusKm: number = 150
): Promise<RouteHistorySuggestion | null> {
  if (!originQuery || !destinationQuery) return null;

  const cleanOrigin = originQuery.trim();
  const cleanDest = destinationQuery.trim();

  if (!cleanOrigin || !cleanDest) return null;

  const normalizedOrigin = normalizeCityName(cleanOrigin);
  const normalizedDest = normalizeCityName(cleanDest);

  // 1. Obter coordenadas da rota pesquisada
  const [originCoord, destCoord] = await Promise.all([
    geocodeCity(cleanOrigin),
    geocodeCity(cleanDest),
  ]);

  // ─────────────────────────────────────────────────────────────
  // 1ª PRIORIDADE: Buscar no histórico de Cargas (todas as cargas)
  // ─────────────────────────────────────────────────────────────
  if (cargos && cargos.length > 0) {
    const validCargos = cargos.filter((c) => {
      const companyRate = Number(c.companyFreightValuePerTon) || 0;
      const driverRate = Number(c.driverFreightValuePerTon) || 0;
      return (companyRate > 0 || driverRate > 0) && c.origin && c.destination;
    });

    const matchingCargos: Array<{
      cargo: Cargo;
      originDist: number;
      destDist: number;
      dateTimestamp: number;
    }> = [];

    for (const cargo of validCargos) {
      const cNormOrigin = normalizeCityName(cargo.origin);
      const cNormDest = normalizeCityName(cargo.destination);

      let isMatch = false;
      let originDist = 0;
      let destDist = 0;

      // Correspondência exata por texto
      if (cNormOrigin === normalizedOrigin && cNormDest === normalizedDest) {
        isMatch = true;
        originDist = 0;
        destDist = 0;
      } else if (originCoord && destCoord) {
        // Obter coordenadas das cidades da carga
        const [cOriginCoord, cDestCoord] = await Promise.all([
          geocodeCity(cargo.origin),
          geocodeCity(cargo.destination),
        ]);

        if (cOriginCoord && cDestCoord) {
          originDist = calculateHaversineDistanceKm(
            originCoord.lat,
            originCoord.lng,
            cOriginCoord.lat,
            cOriginCoord.lng
          );
          destDist = calculateHaversineDistanceKm(
            destCoord.lat,
            destCoord.lng,
            cDestCoord.lat,
            cDestCoord.lng
          );

          if (originDist <= maxRadiusKm && destDist <= maxRadiusKm) {
            isMatch = true;
          }
        }
      }

      if (isMatch) {
        const rawDate = cargo.createdAt || cargo.loadingDeadline || '';
        const timestamp = rawDate ? new Date(rawDate).getTime() : 0;
        matchingCargos.push({
          cargo,
          originDist: Math.round(originDist),
          destDist: Math.round(destDist),
          dateTimestamp: isNaN(timestamp) ? 0 : timestamp,
        });
      }
    }

    if (matchingCargos.length > 0) {
      // Ordenar pelas cargas mais recentes primeiro
      matchingCargos.sort((a, b) => b.dateTimestamp - a.dateTimestamp);
      const best = matchingCargos[0];

      return {
        source: 'cargo',
        companyFreightRate: Number(best.cargo.companyFreightValuePerTon) || 0,
        driverFreightRate: Number(best.cargo.driverFreightValuePerTon) || 0,
        matchedOrigin: best.cargo.origin,
        matchedDestination: best.cargo.destination,
        originDistanceKm: best.originDist,
        destinationDistanceKm: best.destDist,
        date: best.cargo.createdAt || best.cargo.loadingDeadline || new Date().toISOString(),
        cargoSequenceId: best.cargo.sequenceId,
        totalMatchesCount: matchingCargos.length,
      };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2ª PRIORIDADE: Buscar no histórico de Cotações (tool_quotes)
  // ─────────────────────────────────────────────────────────────
  try {
    const quotes = preloadedQuotes || (await getAllToolQuotes());

    if (quotes && quotes.length > 0) {
      const validQuotes = quotes.filter((q) => {
        const companyRate = Number(q.companyFreightPerTon) || 0;
        const driverRate = Number(q.driverFreightPerTon) || 0;
        return (companyRate > 0 || driverRate > 0) && q.origin && q.destination;
      });

      const matchingQuotes: Array<{
        quote: QuoteRecord;
        originDist: number;
        destDist: number;
        dateTimestamp: number;
      }> = [];

      for (const quote of validQuotes) {
        const qNormOrigin = normalizeCityName(quote.origin);
        const qNormDest = normalizeCityName(quote.destination);

        let isMatch = false;
        let originDist = 0;
        let destDist = 0;

        if (qNormOrigin === normalizedOrigin && qNormDest === normalizedDest) {
          isMatch = true;
          originDist = 0;
          destDist = 0;
        } else if (originCoord && destCoord) {
          const [qOriginCoord, qDestCoord] = await Promise.all([
            geocodeCity(quote.origin),
            geocodeCity(quote.destination),
          ]);

          if (qOriginCoord && qDestCoord) {
            originDist = calculateHaversineDistanceKm(
              originCoord.lat,
              originCoord.lng,
              qOriginCoord.lat,
              qOriginCoord.lng
            );
            destDist = calculateHaversineDistanceKm(
              destCoord.lat,
              destCoord.lng,
              qDestCoord.lat,
              qDestCoord.lng
            );

            if (originDist <= maxRadiusKm && destDist <= maxRadiusKm) {
              isMatch = true;
            }
          }
        }

        if (isMatch) {
          const timestamp = quote.date ? new Date(quote.date).getTime() : 0;
          matchingQuotes.push({
            quote,
            originDist: Math.round(originDist),
            destDist: Math.round(destDist),
            dateTimestamp: isNaN(timestamp) ? 0 : timestamp,
          });
        }
      }

      if (matchingQuotes.length > 0) {
        matchingQuotes.sort((a, b) => b.dateTimestamp - a.dateTimestamp);
        const best = matchingQuotes[0];

        return {
          source: 'quote',
          companyFreightRate: Number(best.quote.companyFreightPerTon) || 0,
          driverFreightRate: Number(best.quote.driverFreightPerTon) || 0,
          tollValue: Number(best.quote.tollValue) || undefined,
          matchedOrigin: best.quote.origin,
          matchedDestination: best.quote.destination,
          originDistanceKm: best.originDist,
          destinationDistanceKm: best.destDist,
          date: best.quote.date,
          clientName: best.quote.clientName,
          totalMatchesCount: matchingQuotes.length,
        };
      }
    }
  } catch (err) {
    console.warn('[findRouteHistorySuggestion] Erro ao buscar cotações:', err);
  }

  return null;
}
