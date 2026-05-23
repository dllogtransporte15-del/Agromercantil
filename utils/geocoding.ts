
/**
 * Utility to geocode address strings using OpenStreetMap Nominatim API.
 * Includes a simple local cache to avoid redundant requests.
 */

const geocodeCache: Record<string, { lat: number; lng: number } | null> = {
  'catalão, go': { lat: -18.1691, lng: -47.9463 },
  'sinop, mt': { lat: -11.8598, lng: -55.5031 },
  'cuiabá, mt': { lat: -15.6010, lng: -56.0974 },
  'sorriso, mt': { lat: -12.5507, lng: -55.7126 },
  'rio verde, go': { lat: -17.7915, lng: -50.9202 },
  'goiânia, go': { lat: -16.6869, lng: -49.2648 },
  'campo grande, ms': { lat: -20.4697, lng: -54.6201 },
  'rondonópolis, mt': { lat: -16.4674, lng: -54.6347 },
  'são paulo, sp': { lat: -23.5505, lng: -46.6333 },
  'santos, sp': { lat: -23.9608, lng: -46.3339 },
  'paranaguá, pr': { lat: -25.5204, lng: -48.5093 },
  'uberlândia, mg': { lat: -18.9186, lng: -48.2772 },
  'patrocínio, mg': { lat: -18.9433, lng: -46.9944 },
  'guarda-mor, mg': { lat: -17.7769, lng: -47.1042 },
  'cristalina, go': { lat: -16.7686, lng: -47.6133 },
  'anápolis, go': { lat: -16.3267, lng: -48.9528 },
  'rio verde de mato grosso, ms': { lat: -18.9181, lng: -54.8442 },
  'dourados, ms': { lat: -22.2235, lng: -54.8064 },
  'luís eduardo magalhães, ba': { lat: -12.0968, lng: -45.7872 },
  'barreiras, ba': { lat: -12.1528, lng: -44.9978 },
  'primavera do leste, mt': { lat: -15.5591, lng: -54.2965 },
  'nova mutum, mt': { lat: -13.8294, lng: -56.0792 },
  'lucas do rio verde, mt': { lat: -13.0645, lng: -55.9103 },
  'passos, mg': { lat: -20.723, lng: -46.611 },
  'guarujá, sp': { lat: -23.993, lng: -46.257 },
};

export async function geocodeCity(query: string): Promise<{ lat: number; lng: number } | null> {
  if (!query || !query.trim()) return null;
  
  const normalizedQuery = query.trim().toLowerCase();
  
  if (geocodeCache[normalizedQuery] !== undefined) {
    return geocodeCache[normalizedQuery];
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Brasil')}&countrycodes=br&addressdetails=1&limit=1`,
      {
        headers: {
          'Accept-Language': 'pt-BR',
          'User-Agent': 'Agromarcantil-Control/1.0'
        }
      }
    );
    
    if (!response.ok) throw new Error('Network response was not ok');
    
    const data = await response.json();
    if (data && data.length > 0) {
      const result = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
      geocodeCache[normalizedQuery] = result;
      return result;
    }
    
    geocodeCache[normalizedQuery] = null;
    return null;
  } catch (error) {
    console.error(`Error geocoding "${query}":`, error);
    return null;
  }
}

export function getCoordsSync(query: string): { lat: number; lng: number } | null {
  if (!query || !query.trim()) return null;
  const normalizedQuery = query.trim().toLowerCase();
  return geocodeCache[normalizedQuery] || null;
}
