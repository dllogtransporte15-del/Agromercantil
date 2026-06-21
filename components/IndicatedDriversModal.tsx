import React, { useMemo } from 'react';
import { X, MapPin, Phone, User as UserIcon } from 'lucide-react';
import type { Cargo, Driver, Shipment } from '../types';
import { getCoordsSync, calculateDistance, getDDDsForCity } from '../utils/geocoding';

interface IndicatedDriversModalProps {
  isOpen: boolean;
  onClose: () => void;
  cargo: Cargo | null;
  drivers: Driver[];
  shipments: Shipment[];
  loads: Cargo[];
}

interface IndicatedDriver {
  driver: Driver;
  criteriaCount: number;
  tags: string[];
}

const IndicatedDriversModal: React.FC<IndicatedDriversModalProps> = ({
  isOpen,
  onClose,
  cargo,
  drivers,
  shipments,
  loads,
}) => {
  const indicatedDrivers = useMemo(() => {
    if (!cargo) return [];

    const originDDDs = getDDDsForCity(cargo.origin);
    const destDDDs = cargo.destinations && cargo.destinations.length > 0 
        ? cargo.destinations.flatMap(d => getDDDsForCity(d.city))
        : getDDDsForCity(cargo.destination);
        
    const validDDDs = new Set([...originDDDs, ...destDDDs]);

    const originCoords = getCoordsSync(cargo.origin);
    const destCoords = cargo.destinations && cargo.destinations.length > 0
        ? cargo.destinations.map(d => getCoordsSync(d.city)).filter(Boolean)
        : [getCoordsSync(cargo.destination)].filter(Boolean);
        
    const allCurrentCoords = [originCoords, ...destCoords].filter(Boolean) as {lat: number, lng: number}[];

    const activeDrivers = drivers.filter(d => d.active);
    const indicated: IndicatedDriver[] = [];

    for (const driver of activeDrivers) {
      let criteriaCount = 0;
      const tags: string[] = [];
      
      // Rule 1: DDD
      const driverDDDMatch = driver.phone?.match(/\((\d{2})\)/);
      if (driverDDDMatch && driverDDDMatch[1]) {
        const driverDDD = driverDDDMatch[1];
        if (validDDDs.has(driverDDD)) {
          criteriaCount++;
          tags.push(`DDD Correspondente (${driverDDD})`);
        }
      }
      
      // Rule 2: Radius 200km
      let hasHistoryRadius = false;
      const driverShipments = shipments.filter(s => s.driverCpf === driver.cpf || s.driverName === driver.name);
      
      for (const s of driverShipments) {
         const pastCargo = loads.find(l => l.id === s.cargoId);
         if (!pastCargo) continue;
         
         const pastOriginCoords = getCoordsSync(pastCargo.origin);
         const pastDestCoords = pastCargo.destinations && pastCargo.destinations.length > 0
            ? pastCargo.destinations.map(d => getCoordsSync(d.city)).filter(Boolean)
            : [getCoordsSync(pastCargo.destination)].filter(Boolean);
            
         const allPastCoords = [pastOriginCoords, ...pastDestCoords].filter(Boolean) as {lat: number, lng: number}[];
         
         for (const pC of allPastCoords) {
            for (const cC of allCurrentCoords) {
               const dist = calculateDistance(pC.lat, pC.lng, cC.lat, cC.lng);
               if (dist <= 200) {
                 hasHistoryRadius = true;
                 break;
               }
            }
            if (hasHistoryRadius) break;
         }
         if (hasHistoryRadius) break;
      }
      
      if (hasHistoryRadius) {
        criteriaCount++;
        tags.push('Histórico em raio de 200km');
      }
      
      if (criteriaCount > 0) {
        indicated.push({ driver, criteriaCount, tags });
      }
    }

    return indicated.sort((a, b) => b.criteriaCount - a.criteriaCount);
  }, [cargo, drivers, shipments, loads]);

  if (!isOpen || !cargo) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <UserIcon className="w-6 h-6 text-primary dark:text-blue-400" />
              Motoristas Indicados
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Carga #{cargo.sequenceId} | {cargo.origin} → {(cargo.destinations && cargo.destinations.length > 0) ? `${cargo.destinations[0].city} (+${cargo.destinations.length - 1})` : cargo.destination}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {indicatedDrivers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
              <UserIcon className="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-lg font-medium">Nenhum motorista indicado encontrado.</p>
              <p className="text-sm mt-1">Tente buscar motoristas em outras regiões ou sem restrições.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {indicatedDrivers.map((item) => (
                <div key={item.driver.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-2.5 px-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200">
                  <div className="flex justify-between items-start mb-1.5">
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-base leading-tight">
                        {item.driver.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-600 dark:text-gray-300">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        {item.driver.phone ? (
                          <a 
                            href={`https://wa.me/55${item.driver.phone.replace(/\D/g, '')}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition-colors font-medium"
                          >
                            {item.driver.phone}
                          </a>
                        ) : (
                          <span>Sem telefone</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-[10px] uppercase font-bold text-gray-400">Critérios Atendidos:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {item.tags.map((tag, idx) => {
                        const isDDD = tag.startsWith('DDD');
                        return (
                          <span 
                            key={idx} 
                            className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                isDDD 
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-100 dark:border-blue-800/50' 
                                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800/50'
                            }`}
                          >
                            {isDDD ? <Phone className="w-3 h-3 mr-1" /> : <MapPin className="w-3 h-3 mr-1" />}
                            {tag}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IndicatedDriversModal;
