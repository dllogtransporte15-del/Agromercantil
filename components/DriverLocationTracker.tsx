import React, { useState, useEffect, useRef } from 'react';
import { MapPin, MapPinOff } from 'lucide-react';
import { supabase } from '../supabase';
import type { User, DriverLocation } from '../types';
import { saveDriverLastLocationToDb } from '../hooks/useDriverLocations';

interface DriverLocationTrackerProps {
  user: User;
}

const CHANNEL_NAME = 'driver_locations_monitor';

const DriverLocationTracker: React.FC<DriverLocationTrackerProps> = ({ user }) => {
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      stopTracking();
    };
  }, []);

  const startTracking = () => {
    if (!navigator.geolocation) {
      setError('Geolocalização não suportada pelo navegador.');
      return;
    }

    // Solicitar permissão antes de ligar o canal
    navigator.permissions?.query({ name: 'geolocation' }).then((result) => {
      if (result.state === 'denied') {
        setError('Permissão de localização negada. Habilite nas configurações do navegador.');
        return;
      }
      _initChannel();
    }).catch(() => {
      // API de permissões não disponível, tenta direto
      _initChannel();
    });
  };

  const _initChannel = () => {
    setIsSharing(true);
    setError(null);

    // IMPORTANTE: Não passar `config.presence.key` aqui.
    // O Supabase Presence usa a chave passada no `.track()`, não na criação do canal.
    // Passar aqui causava comportamento assimétrico entre o sender e o receiver.
    const channel = supabase.channel(CHANNEL_NAME);

    channel.subscribe(async (status) => {
      console.log(`[DriverLocationTracker] Canal status: ${status}`);

      if (status === 'SUBSCRIBED') {
        // Enviar presença inicial para indicar que o motorista está online
        await channel.track({
          driverId: user.id,
          driverName: user.name,
          hasLocation: false,
          timestamp: new Date().toISOString(),
        });

        // Iniciar rastreamento GPS
        watchIdRef.current = navigator.geolocation.watchPosition(
          async (position) => {
            const location: DriverLocation = {
              driverId: user.id,
              driverName: user.name,
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              speed: position.coords.speed,
              heading: position.coords.heading,
              timestamp: new Date(position.timestamp).toISOString(),
            };

            console.log(`[DriverLocationTracker] Enviando localização: ${location.lat}, ${location.lng}`);

            // Rastrear com a chave sendo o ID do usuário (correto para Presence)
            await channel.track({ location });
            saveDriverLastLocationToDb(location);
          },
          (err) => {
            console.error('[DriverLocationTracker] Erro no GPS:', err);
            let mensagem = 'Erro ao obter localização.';
            if (err.code === err.PERMISSION_DENIED) {
              mensagem = 'Permissão de localização negada. Habilite nas configurações do navegador.';
            } else if (err.code === err.POSITION_UNAVAILABLE) {
              mensagem = 'Localização indisponível. Verifique o GPS do dispositivo.';
            } else if (err.code === err.TIMEOUT) {
              mensagem = 'Tempo esgotado ao obter localização. Tente novamente.';
            }
            setError(mensagem);
            stopTracking();
          },
          {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 15000,
          }
        );
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error(`[DriverLocationTracker] Erro no canal: ${status}`);
        setError('Falha na conexão com o servidor. Tente novamente.');
        stopTracking();
      }
    });

    channelRef.current = channel;
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    
    if (channelRef.current) {
      channelRef.current.untrack();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setIsSharing(false);
  };

  const toggleTracking = () => {
    if (isSharing) {
      stopTracking();
    } else {
      startTracking();
    }
  };

  return (
    <div className="relative flex items-center">
      <button
        onClick={toggleTracking}
        title={isSharing ? "Parar de compartilhar localização" : "Compartilhar localização em tempo real"}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all shadow-sm ${
          isSharing 
            ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800' 
            : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800'
        }`}
      >
        {isSharing ? (
          <>
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <MapPinOff className="w-4 h-4" />
            <span className="hidden md:inline">Parar GPS</span>
          </>
        ) : (
          <>
            <MapPin className="w-4 h-4" />
            <span className="hidden md:inline">Compartilhar GPS</span>
          </>
        )}
      </button>
      {error && (
        <div className="absolute top-full mt-2 right-0 w-56 bg-white dark:bg-gray-800 text-red-500 text-xs p-2 rounded shadow-lg border border-red-200 z-50">
          {error}
        </div>
      )}
    </div>
  );
};

export default DriverLocationTracker;
