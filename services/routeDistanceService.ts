import { getDistanceKm, findCityCoords } from '../utils/distance';

export interface ResolvedWaypoint {
  label: string;
  subLabel?: string;
  lat: number;
  lng: number;
  isExact: boolean;
  type: 'origin' | 'destination' | 'via';
}

export interface RouteCalculationResult {
  distanceKm: number;
  durationMin: number;
  isExact: boolean;
  originCoords: { lat: number; lng: number };
  destinationCoords: { lat: number; lng: number };
  coordinates?: [number, number][]; // [lat, lng] for Polyline
  originWaypoint: ResolvedWaypoint;
  destinationWaypoint: ResolvedWaypoint;
}

// In-memory caches to prevent redundant network calls during session
const unshortenMemoryCache = new Map<string, string>();
const routeCalculationMemoryCache = new Map<string, RouteCalculationResult>();

const UNSHORTEN_STORAGE_KEY = 'transcunha_unshorten_cache_v1';
const ROUTE_STORAGE_KEY = 'transcunha_route_dist_cache_v1';

function getLocalStorageMap(key: string): Record<string, any> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function setLocalStorageItem(key: string, itemKey: string, value: any) {
  if (typeof window === 'undefined') return;
  try {
    const existing = getLocalStorageMap(key);
    existing[itemKey] = value;
    // Limit cache size to 500 entries
    const keys = Object.keys(existing);
    if (keys.length > 500) {
      delete existing[keys[0]];
    }
    localStorage.setItem(key, JSON.stringify(existing));
  } catch (e) {
    // Ignore quota errors
  }
}

/**
 * Converts DMS (Degrees Minutes Seconds) string to decimal degrees.
 * e.g. "18°16'41.5\"S" -> -18.278194
 */
function dmsToDecimal(degrees: number, minutes: number, seconds: number, direction: string): number {
  let dd = degrees + minutes / 60 + seconds / 3600;
  if (direction === 'S' || direction === 'W' || direction === 's' || direction === 'w') {
    dd = dd * -1;
  }
  return dd;
}

/**
 * Parses exact coordinates from any text or Google Maps URL format.
 */
export const parseCoordinatesFromLocation = (str: string | undefined | null): { lat: number; lng: number } | null => {
  if (!str) return null;
  const decoded = decodeURIComponent(str).trim();

  // 1. Direct decimal coordinates: "-20.742556, -51.574995" or "-20.742556 -51.574995"
  const directMatch = decoded.match(/^(-?\d{1,2}\.\d+)\s*[\s,]\s*(-?\d{1,3}\.\d+)$/);
  if (directMatch) {
    const lat = parseFloat(directMatch[1]);
    const lng = parseFloat(directMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  // 2. Google Maps @lat,lng e.g. /@ -20.1137246,-49.7638759,1259m
  const atMatch = decoded.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  // 3. Google Maps !3dlat!4dlng (e.g. !3d-20.1131884!4d-49.7605525)
  const d3d4Match = decoded.match(/!?3d(-?\d+\.\d+)!?4d(-?\d+\.\d+)/);
  if (d3d4Match) {
    const lat = parseFloat(d3d4Match[1]);
    const lng = parseFloat(d3d4Match[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }

  // 4. Google Maps directions !1d(lng)!2d(lat) e.g. !1d-46.726963!2d-19.0662803
  const dirMatch = decoded.match(/!1d(-?\d+\.\d+)!2d(-?\d+\.\d+)/);
  if (dirMatch) {
    const lng = parseFloat(dirMatch[1]);
    const lat = parseFloat(dirMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }

  // 5. Query params: ?q=lat,lng or ?ll=lat,lng or center=lat,lng
  const paramMatch = decoded.match(/[?&](?:q|ll|destination|origin|center)=(-?\d+\.\d+)[,\s+]+(-?\d+\.\d+)/i);
  if (paramMatch) {
    const lat = parseFloat(paramMatch[1]);
    const lng = parseFloat(paramMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }

  // 6. Path coords: /search/-20.742556,+-51.574995 or /place/-20.742556,-51.574995
  const pathMatch = decoded.match(/\/(?:search|place|dir)\/(-?\d+\.\d+)[,\s+]+(-?\d+\.\d+)/i);
  if (pathMatch) {
    const lat = parseFloat(pathMatch[1]);
    const lng = parseFloat(pathMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }

  // 7. DMS Format in Google Maps URL: 18°16'41.5"S+46°51'26.4"W
  const dmsMatch = decoded.match(/(\d{1,2})[°\s](\d{1,2})['\s]([\d.]+)["]?\s*([NSns])[\s+,]+(\d{1,3})[°\s](\d{1,2})['\s]([\d.]+)["]?\s*([EWew])/);
  if (dmsMatch) {
    const lat = dmsToDecimal(parseFloat(dmsMatch[1]), parseFloat(dmsMatch[2]), parseFloat(dmsMatch[3]), dmsMatch[4]);
    const lng = dmsToDecimal(parseFloat(dmsMatch[5]), parseFloat(dmsMatch[6]), parseFloat(dmsMatch[7]), dmsMatch[8]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }

  return null;
};

/**
 * Extracts human place name from Google Maps URL if present.
 */
export const extractPlaceNameFromUrl = (url: string): string | null => {
  const match = url.match(/\/place\/([^\/@?]+)/);
  if (match && match[1]) {
    try {
      const decoded = decodeURIComponent(match[1].replace(/\+/g, ' ')).trim();
      if (decoded && !/^-?\d+\.\d+/.test(decoded)) {
        return decoded;
      }
    } catch (e) {
      return match[1].replace(/\+/g, ' ').trim();
    }
  }
  return null;
};

/**
 * Unshortens Google Maps links (e.g. maps.app.goo.gl or goo.gl/maps).
 */
export async function unshortenUrl(url: string): Promise<string> {
  const trimmed = url.trim();
  if (!trimmed.startsWith('http')) return trimmed;

  // If URL already contains coordinates, no need to unshorten
  if (parseCoordinatesFromLocation(trimmed)) {
    return trimmed;
  }

  // Check in-memory cache
  if (unshortenMemoryCache.has(trimmed)) {
    return unshortenMemoryCache.get(trimmed)!;
  }

  // Check localStorage cache
  const localCache = getLocalStorageMap(UNSHORTEN_STORAGE_KEY);
  if (localCache[trimmed]) {
    unshortenMemoryCache.set(trimmed, localCache[trimmed]);
    return localCache[trimmed];
  }

  // Check if it's a short URL
  const isShort = trimmed.includes('goo.gl') || 
                  trimmed.includes('maps.app') || 
                  trimmed.includes('shorturl') || 
                  trimmed.includes('bit.ly') || 
                  trimmed.includes('t.co') ||
                  trimmed.includes('page.link');

  if (!isShort) {
    return trimmed;
  }

  // 1. Try local Vite dev server / Vercel API endpoint
  try {
    const res = await fetch(`/api/unshorten?url=${encodeURIComponent(trimmed)}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.resolvedUrl && data.resolvedUrl !== trimmed) {
        unshortenMemoryCache.set(trimmed, data.resolvedUrl);
        setLocalStorageItem(UNSHORTEN_STORAGE_KEY, trimmed, data.resolvedUrl);
        return data.resolvedUrl;
      }
    }
  } catch (e) {
    // API endpoint failed, try fallback
  }

  return trimmed;
}

/**
 * Resolves a location string and city into a ResolvedWaypoint.
 */
export async function resolveLocationToWaypoint(
  locationStr: string | undefined,
  cityStr: string,
  type: 'origin' | 'destination' | 'via'
): Promise<ResolvedWaypoint | null> {
  const targetLocation = locationStr?.trim() || '';
  let extractedCoords = parseCoordinatesFromLocation(targetLocation);
  let extractedPlaceName: string | null = null;

  const urlMatch = targetLocation.match(/(https?:\/\/[^\s]+)/i);
  const url = urlMatch ? urlMatch[0] : null;

  if (url && !extractedCoords) {
    extractedPlaceName = extractPlaceNameFromUrl(url);
    const resolvedUrl = await unshortenUrl(url);
    extractedCoords = parseCoordinatesFromLocation(resolvedUrl);
    if (!extractedPlaceName) {
      extractedPlaceName = extractPlaceNameFromUrl(resolvedUrl);
    }
  }

  // If exact coordinates were successfully extracted
  if (extractedCoords) {
    const cleanLabel = targetLocation.replace(/https?:\/\/[^\s]+/g, '').trim();
    const label = cleanLabel && cleanLabel.length > 2 && !cleanLabel.startsWith('-')
      ? cleanLabel 
      : (extractedPlaceName || (type === 'origin' ? 'Origem' : type === 'destination' ? 'Destino' : 'Ponto de Apoio'));

    return {
      label,
      subLabel: cityStr ? `Localização Exata (${cityStr})` : `Coordenadas: ${extractedCoords.lat.toFixed(4)}, ${extractedCoords.lng.toFixed(4)}`,
      lat: extractedCoords.lat,
      lng: extractedCoords.lng,
      isExact: true,
      type
    };
  }

  // Check if cityStr itself contains coordinates
  const cityCoords = parseCoordinatesFromLocation(cityStr);
  if (cityCoords) {
    return {
      label: `Coordenadas: ${cityCoords.lat.toFixed(4)}, ${cityCoords.lng.toFixed(4)}`,
      lat: cityCoords.lat,
      lng: cityCoords.lng,
      isExact: true,
      type
    };
  }

  // Fallback to City Geocoding (first local logistics coords, then Nominatim)
  const cleanCity = cityStr.replace(/https?:\/\/[^\s]+/g, '').replace(/[\\/]/g, ' ').trim();
  if (cleanCity && cleanCity.length >= 2) {
    const knownCoords = findCityCoords(cleanCity);
    if (knownCoords) {
      return {
        label: cleanCity,
        subLabel: extractedPlaceName ? `Local: "${extractedPlaceName}" (aproximado por cidade)` : undefined,
        lat: knownCoords.lat,
        lng: knownCoords.lng,
        isExact: false,
        type
      };
    }

    try {
      const query = `${cleanCity}, Brasil`;
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&accept-language=pt-br&countrycodes=br`
      );
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.length > 0) {
          return {
            label: cleanCity,
            subLabel: extractedPlaceName ? `Local: "${extractedPlaceName}" (aproximado por cidade)` : undefined,
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            isExact: false,
            type
          };
        }
      }
    } catch (e) {
      console.warn('Geocoding fallback failed for:', cleanCity, e);
    }
  }

  return null;
}

/**
 * Calculates road percurso (KM and Duration) using exact origin/destination location links.
 */
export async function calculateOfferRoute(params: {
  originLocation?: string;
  origin: string;
  destinationLocation?: string;
  destination: string;
  additionalDestinations?: { city: string; location?: string }[];
}): Promise<RouteCalculationResult | null> {
  const origKey = (params.originLocation || params.origin || '').trim();
  const destKey = (params.destinationLocation || params.destination || '').trim();
  const cacheKey = `${origKey}__TO__${destKey}`;

  if (!origKey || !destKey) return null;

  // Check in-memory cache
  if (routeCalculationMemoryCache.has(cacheKey)) {
    return routeCalculationMemoryCache.get(cacheKey)!;
  }

  // Check localStorage cache
  const localCache = getLocalStorageMap(ROUTE_STORAGE_KEY);
  if (localCache[cacheKey]) {
    const cached = localCache[cacheKey] as RouteCalculationResult;
    routeCalculationMemoryCache.set(cacheKey, cached);
    return cached;
  }

  // 1. Resolve Origin
  const originWaypoint = await resolveLocationToWaypoint(params.originLocation, params.origin, 'origin');
  if (!originWaypoint) return null;

  // 2. Resolve Vias (if any)
  const viaWaypoints: ResolvedWaypoint[] = [];
  if (params.additionalDestinations && params.additionalDestinations.length > 0) {
    for (const addDest of params.additionalDestinations) {
      if (addDest.city && addDest.city.trim().length >= 3) {
        const viaRes = await resolveLocationToWaypoint(addDest.location, addDest.city, 'via');
        if (viaRes) viaWaypoints.push(viaRes);
      }
    }
  }

  // 3. Resolve Destination
  const destinationWaypoint = await resolveLocationToWaypoint(params.destinationLocation, params.destination, 'destination');
  if (!destinationWaypoint) return null;

  const allWaypoints = [originWaypoint, ...viaWaypoints, destinationWaypoint];
  const isExact = originWaypoint.isExact && destinationWaypoint.isExact;

  // 4. Query OSRM for exact driving route
  try {
    const waypointsParam = allWaypoints.map(w => `${w.lng},${w.lat}`).join(';');
    const osrmResp = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${waypointsParam}?overview=full&geometries=geojson`
    );

    if (osrmResp.ok) {
      const osrmData = await osrmResp.json();
      if (osrmData.code === 'Ok' && osrmData.routes && osrmData.routes.length > 0) {
        const route = osrmData.routes[0];
        const distanceKm = Math.round(route.distance / 1000);
        const durationMin = Math.round(route.duration / 60);
        const coordinates: [number, number][] = route.geometry.coordinates.map(
          (c: [number, number]) => [c[1], c[0]]
        );

        const result: RouteCalculationResult = {
          distanceKm,
          durationMin,
          isExact,
          originCoords: { lat: originWaypoint.lat, lng: originWaypoint.lng },
          destinationCoords: { lat: destinationWaypoint.lat, lng: destinationWaypoint.lng },
          coordinates,
          originWaypoint,
          destinationWaypoint
        };

        routeCalculationMemoryCache.set(cacheKey, result);
        setLocalStorageItem(ROUTE_STORAGE_KEY, cacheKey, result);
        return result;
      }
    }
  } catch (err) {
    console.warn('OSRM routing request failed, falling back to Haversine * 1.25 road factor:', err);
  }

  // Fallback to Haversine * 1.25 road factor
  const straightKm = getDistanceKm(originWaypoint.lat, originWaypoint.lng, destinationWaypoint.lat, destinationWaypoint.lng);
  const distanceKm = Math.round(straightKm * 1.25);
  const durationMin = Math.round((distanceKm / 70) * 60); // approx 70 km/h average truck speed

  const fallbackResult: RouteCalculationResult = {
    distanceKm,
    durationMin,
    isExact,
    originCoords: { lat: originWaypoint.lat, lng: originWaypoint.lng },
    destinationCoords: { lat: destinationWaypoint.lat, lng: destinationWaypoint.lng },
    coordinates: [
      [originWaypoint.lat, originWaypoint.lng],
      [destinationWaypoint.lat, destinationWaypoint.lng]
    ],
    originWaypoint,
    destinationWaypoint
  };

  routeCalculationMemoryCache.set(cacheKey, fallbackResult);
  setLocalStorageItem(ROUTE_STORAGE_KEY, cacheKey, fallbackResult);
  return fallbackResult;
}
