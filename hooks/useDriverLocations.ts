import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import type { DriverLocation } from '../types';

const CHANNEL_NAME = 'driver_locations_monitor';
const LAST_LOCATIONS_KEY = 'transcunha_last_driver_locations';

export interface ExtendedDriverLocation extends DriverLocation {
  isAppActive?: boolean;
}

export function normalizeDriverKey(str?: string): string {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

export function getStoredLastLocations(): Record<string, ExtendedDriverLocation> {
  try {
    const data = localStorage.getItem(LAST_LOCATIONS_KEY);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    return {};
  }
}

export function saveStoredLastLocations(records: Record<string, ExtendedDriverLocation>) {
  try {
    localStorage.setItem(LAST_LOCATIONS_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Error saving last driver locations to localStorage', e);
  }
}

export async function fetchRemoteLastDriverLocations(): Promise<Record<string, ExtendedDriverLocation>> {
  try {
    const { data, error } = await supabase
      .from('profile_permissions')
      .select('permissions')
      .eq('id', 1)
      .single();

    if (error || !data?.permissions?.driver_last_locations) {
      return {};
    }

    return (data.permissions.driver_last_locations || {}) as Record<string, ExtendedDriverLocation>;
  } catch (err) {
    console.warn('[useDriverLocations] Error fetching remote driver last locations:', err);
    return {};
  }
}

let saveLocationTimeout: any = null;
let pendingLocationsToSave: Record<string, ExtendedDriverLocation> = {};

export function saveDriverLastLocationToDb(location: ExtendedDriverLocation | DriverLocation) {
  if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number' || (location.lat === 0 && location.lng === 0)) return;

  const sanitized: ExtendedDriverLocation = {
    ...location,
    isAppActive: false,
    timestamp: location.timestamp || new Date().toISOString()
  };

  const keys: string[] = [];
  if (location.driverId) keys.push(location.driverId);
  if (location.driverName) {
    keys.push(location.driverName.trim().toLowerCase());
    keys.push(normalizeDriverKey(location.driverName));
  }

  // 1. Update localStorage immediately for instantaneous responsive UI
  const localSaved = getStoredLastLocations();
  keys.forEach(k => {
    pendingLocationsToSave[k] = sanitized;
    localSaved[k] = sanitized;
  });
  saveStoredLastLocations(localSaved);

  // 2. Debounced save to Supabase cloud database
  if (saveLocationTimeout) clearTimeout(saveLocationTimeout);
  saveLocationTimeout = setTimeout(async () => {
    try {
      const { data } = await supabase
        .from('profile_permissions')
        .select('permissions')
        .eq('id', 1)
        .single();

      const current = data?.permissions || {};
      const currentLocations = current.driver_last_locations || {};

      const updatedLocations = {
        ...currentLocations,
        ...pendingLocationsToSave
      };

      await supabase
        .from('profile_permissions')
        .upsert({ id: 1, permissions: { ...current, driver_last_locations: updatedLocations } });

      pendingLocationsToSave = {};
    } catch (err) {
      console.warn('[useDriverLocations] Error persisting driver_last_locations to Supabase:', err);
    }
  }, 2000);
}

export function useDriverLocations() {
  const [driverLocations, setDriverLocations] = useState<Map<string, ExtendedDriverLocation>>(new Map());

  useEffect(() => {
    const populateMap = (records: Record<string, ExtendedDriverLocation>, targetMap: Map<string, ExtendedDriverLocation>) => {
      Object.entries(records).forEach(([key, loc]) => {
        if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number' && (loc.lat !== 0 || loc.lng !== 0)) {
          const offlineLoc: ExtendedDriverLocation = { ...loc, isAppActive: false };
          targetMap.set(key, offlineLoc);
          if (loc.driverId) targetMap.set(loc.driverId, offlineLoc);
          if (loc.driverName) {
            targetMap.set(loc.driverName.trim().toLowerCase(), offlineLoc);
            targetMap.set(normalizeDriverKey(loc.driverName), offlineLoc);
          }
        }
      });
    };

    // 1. Initial load from localStorage
    const saved = getStoredLastLocations();
    const initialMap = new Map<string, ExtendedDriverLocation>();
    populateMap(saved, initialMap);
    setDriverLocations(initialMap);

    // 2. Fetch remote locations from Supabase
    fetchRemoteLastDriverLocations().then((remote) => {
      if (remote && Object.keys(remote).length > 0) {
        const currentSaved = getStoredLastLocations();
        const merged = { ...remote, ...currentSaved };
        saveStoredLastLocations(merged);

        setDriverLocations(prev => {
          const next = new Map(prev);
          Object.entries(merged).forEach(([key, loc]) => {
            if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number' && (loc.lat !== 0 || loc.lng !== 0)) {
              const existing = next.get(key);
              if (!existing || !existing.isAppActive) {
                const offlineLoc: ExtendedDriverLocation = { ...loc, isAppActive: false };
                next.set(key, offlineLoc);
                if (loc.driverId) next.set(loc.driverId, offlineLoc);
                if (loc.driverName) {
                  next.set(loc.driverName.trim().toLowerCase(), offlineLoc);
                  next.set(normalizeDriverKey(loc.driverName), offlineLoc);
                }
              }
            }
          });
          return next;
        });
      }
    });

    // 3. Realtime presence tracking
    const channel = supabase.channel(CHANNEL_NAME);

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const currentSaved = getStoredLastLocations();
        const locations = new Map<string, ExtendedDriverLocation>();

        // Pre-populate with saved offline locations first
        populateMap(currentSaved, locations);

        // Overlay active presences
        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[];
          if (presences && presences.length > 0) {
            const latest = presences[presences.length - 1];
            const locObj = latest.location || (typeof latest.lat === 'number' ? latest : null);

            if (
              locObj &&
              typeof locObj.lat === 'number' &&
              typeof locObj.lng === 'number' &&
              (locObj.lat !== 0 || locObj.lng !== 0)
            ) {
              const locationData: ExtendedDriverLocation = {
                driverId: locObj.driverId || latest.driverId || key,
                driverName: locObj.driverName || latest.driverName || '',
                lat: locObj.lat,
                lng: locObj.lng,
                speed: locObj.speed ?? null,
                heading: locObj.heading ?? null,
                timestamp: locObj.timestamp || new Date().toISOString(),
                isAppActive: true,
              };

              locations.set(key, locationData);
              if (locationData.driverId) locations.set(locationData.driverId, locationData);
              if (locationData.driverName) {
                locations.set(locationData.driverName.trim().toLowerCase(), locationData);
                locations.set(normalizeDriverKey(locationData.driverName), locationData);
              }

              // Update persistent store & database
              saveDriverLastLocationToDb(locationData);
            } else {
              const pendingData: ExtendedDriverLocation = {
                driverId: latest.driverId || key,
                driverName: latest.driverName || '',
                lat: 0,
                lng: 0,
                speed: null,
                heading: null,
                isAppActive: true,
                timestamp: new Date().toISOString(),
              };
              locations.set(key, pendingData);
              if (pendingData.driverId) locations.set(pendingData.driverId, pendingData);
              if (pendingData.driverName) {
                locations.set(pendingData.driverName.trim().toLowerCase(), pendingData);
                locations.set(normalizeDriverKey(pendingData.driverName), pendingData);
              }
            }
          }
        });

        setDriverLocations(locations);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log(`[useDriverLocations] Motorista entrou: ${key}`, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log(`[useDriverLocations] Motorista saiu: ${key}`, leftPresences);
        const currentSaved = getStoredLastLocations();

        setDriverLocations(prev => {
          const next = new Map(prev);
          let driverId = key;
          let driverName = '';
          if (leftPresences && leftPresences.length > 0) {
            const latest = leftPresences[leftPresences.length - 1];
            driverId = latest.driverId || key;
            driverName = latest.driverName || '';
          }

          const savedLoc = currentSaved[driverId] || (driverName ? currentSaved[driverName.trim().toLowerCase()] : null) || (driverName ? currentSaved[normalizeDriverKey(driverName)] : null) || currentSaved[key];
          if (savedLoc) {
            const offlineLoc: ExtendedDriverLocation = { ...savedLoc, isAppActive: false };
            next.set(key, offlineLoc);
            if (driverId) next.set(driverId, offlineLoc);
            if (driverName) {
              next.set(driverName.trim().toLowerCase(), offlineLoc);
              next.set(normalizeDriverKey(driverName), offlineLoc);
            }
          } else {
            next.delete(key);
          }
          return next;
        });
      })
      .subscribe((status) => {
        console.log(`[useDriverLocations] Canal status: ${status}`);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return driverLocations;
}
