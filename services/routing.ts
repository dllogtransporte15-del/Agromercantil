/**
 * Routing service for Agromarcantil Control.
 * Uses OSRM (Open Source Routing Machine) for road geometry
 * and Nominatim (OpenStreetMap) for reverse geocoding cities along the route.
 */

export interface RouteGeometry {
    coordinates: [number, number][]; // [lat, lng]
    distance: number; // in meters
    duration: number; // in seconds
}

export interface RouteSuggestion {
    formatted: string; // "City1, ST -> City2, ST -> ..."
    distance: number;
}

const NOMINATIM_DELAY = 1100; // Delay between Nominatim calls to respect 1 req/sec limit

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetches the road geometry between origin and destination.
 */
export async function fetchRouteGeometry(origin: { lat: number; lng: number }, dest: { lat: number; lng: number }): Promise<RouteGeometry | null> {
    try {
        const response = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`
        );
        
        if (!response.ok) throw new Error('OSRM request failed');
        
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            return {
                coordinates: route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]), // Swap [lng, lat] to [lat, lng]
                distance: route.distance,
                duration: route.duration
            };
        }
        return null;
    } catch (error) {
        console.error('Error fetching route geometry:', error);
        return null;
    }
}

/**
 * Reverse geocodes a single point to get the city and state.
 */
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
            {
                headers: {
                    'Accept-Language': 'pt-BR',
                    'User-Agent': 'Agromarcantil-Control/1.0'
                }
            }
        );
        
        if (!response.ok) return null;
        
        const data = await response.json();
        if (data && data.address) {
            const city = data.address.city || data.address.town || data.address.village || data.address.municipality;
            const state = data.address['ISO3166-2-lvl4']?.split('-')[1] || data.address.state;
            
            if (city && state) {
                return `${city}, ${state}`;
            }
            return city || null;
        }
        return null;
    } catch (error) {
        console.error('Error reverse geocoding:', error);
        return null;
    }
}

/**
 * Gets route suggestions by sampling points along the OSRM route.
 */
export async function getRouteSuggestions(origin: { lat: number; lng: number }, dest: { lat: number; lng: number }): Promise<RouteSuggestion[]> {
    const geometry = await fetchRouteGeometry(origin, dest);
    if (!geometry || geometry.coordinates.length < 2) return [];

    // We take points at regular intervals (start, 25%, 50%, 75%, end)
    const pointsToGeocode = [];
    const len = geometry.coordinates.length;
    
    pointsToGeocode.push(geometry.coordinates[0]);
    if (len > 10) {
        pointsToGeocode.push(geometry.coordinates[Math.floor(len * 0.25)]);
        pointsToGeocode.push(geometry.coordinates[Math.floor(len * 0.5)]);
        pointsToGeocode.push(geometry.coordinates[Math.floor(len * 0.75)]);
    }
    pointsToGeocode.push(geometry.coordinates[len - 1]);

    const cities: string[] = [];
    const seenCities = new Set<string>();

    for (let i = 0; i < pointsToGeocode.length; i++) {
        const pt = pointsToGeocode[i];
        const city = await reverseGeocode(pt[0], pt[1]);
        
        if (city && !seenCities.has(city)) {
            cities.push(city);
            seenCities.add(city);
        }
        
        // Respect Nominatim limits
        if (i < pointsToGeocode.length - 1) {
            await delay(NOMINATIM_DELAY);
        }
    }

    if (cities.length < 2) return [];

    return [{
        formatted: cities.join(' → '),
        distance: geometry.distance
    }];
}
