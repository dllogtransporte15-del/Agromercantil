import React, { useMemo, useState } from 'react';
import { X, MapPin, Phone, History } from 'lucide-react';
import type { Cargo, Driver, Shipment } from '../types';
import { getDistanceKm } from '../utils/distance';
import { getDDDsFromCity } from '../utils/ddd';
import { getCoordsSync } from '../utils/geocoding';
import ShipmentHistoryModal from './ShipmentHistoryModal';

interface RecommendedDriversModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCargo: Cargo | null;
  drivers: Driver[];
  shipments: Shipment[];
  cargos: Cargo[];
}

interface RecommendedDriver extends Driver {
  recommendationReasons: string[];
}

const RecommendedDriversModal: React.FC<RecommendedDriversModalProps> = ({
  isOpen,
  onClose,
  currentCargo,
  drivers,
  shipments,
  cargos,
}) => {
  const [selectedDriverForHistory, setSelectedDriverForHistory] = useState<RecommendedDriver | null>(null);

  const recommendedDrivers = useMemo(() => {
    if (!currentCargo || !isOpen) return [];

    const cargoOriginDDDs = getDDDsFromCity(currentCargo.origin);
    const cargoDestDDDs = getDDDsFromCity(currentCargo.destination);
    const targetDDDs = Array.from(new Set([...cargoOriginDDDs, ...cargoDestDDDs]));

    const originCoords = currentCargo.originCoords || getCoordsSync(currentCargo.origin);
    const destCoords = currentCargo.destinationCoords || getCoordsSync(currentCargo.destination);

    const cargoMap = new Map(cargos.map(c => [c.id, c]));

    const recommendations: RecommendedDriver[] = [];

    for (const driver of drivers) {
      if (!driver.active) continue;

      const reasons = new Set<string>();

      // 1. Check DDD
      const driverDdd = driver.phone.replace(/\D/g, '').substring(0, 2);
      if (targetDDDs.includes(driverDdd)) {
        reasons.add('DDD Correspondente (' + driverDdd + ')');
      }

      // 2. Check past shipments distance (200km radius)
      if (originCoords || destCoords) {
        const driverShipments = shipments.filter(s => s.driverCpf === driver.cpf || s.driverName === driver.name);
        
        let foundNearby = false;
        for (const shipment of driverShipments) {
          if (foundNearby) break;
          const pastCargo = cargoMap.get(shipment.cargoId);
          if (!pastCargo) continue;

          const pastOriginCoords = pastCargo.originCoords || getCoordsSync(pastCargo.origin);
          const pastDestCoords = pastCargo.destinationCoords || getCoordsSync(pastCargo.destination);

          const checkDistance = (c1?: {lat: number, lng: number} | null, c2?: {lat: number, lng: number} | null) => {
            if (!c1 || !c2) return false;
            return getDistanceKm(c1.lat, c1.lng, c2.lat, c2.lng) <= 200;
          };

          if (
            checkDistance(originCoords, pastOriginCoords) ||
            checkDistance(originCoords, pastDestCoords) ||
            checkDistance(destCoords, pastOriginCoords) ||
            checkDistance(destCoords, pastDestCoords)
          ) {
            foundNearby = true;
          }
        }

        if (foundNearby) {
          reasons.add('Histórico em raio de 200km');
        }
      }

      if (reasons.size > 0) {
        recommendations.push({
          ...driver,
          recommendationReasons: Array.from(reasons)
        });
      }
    }

    // Sort by number of reasons (more reasons first)
    return recommendations.sort((a, b) => b.recommendationReasons.length - a.recommendationReasons.length);
  }, [currentCargo, isOpen, drivers, shipments, cargos]);

  if (!isOpen || !currentCargo) return null;

  const formatWhatsAppLink = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) return '#';
    if (cleanPhone.startsWith('55') && cleanPhone.length > 11) {
        return `https://wa.me/${cleanPhone}`;
    }
    return `https://wa.me/55${cleanPhone}`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
              Motoristas Indicados
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Baseado no DDD e histórico de viagens (raio de 200km) para a carga <span className="font-semibold text-gray-700 dark:text-gray-300">#{currentCargo.sequenceId || currentCargo.id.slice(0,8)}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-gray-50 dark:bg-gray-900/20">
          <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
            <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Referência da Carga
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Origem: </span>
                <span className="font-medium text-gray-800 dark:text-gray-200">{currentCargo.origin}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Destino: </span>
                <span className="font-medium text-gray-800 dark:text-gray-200">{currentCargo.destination}</span>
              </div>
            </div>
          </div>

          {recommendedDrivers.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
              <p className="text-gray-500 dark:text-gray-400">Nenhum motorista indicado encontrado para esta rota.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {recommendedDrivers.map(driver => (
                <div key={driver.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-gray-800 dark:text-white">{driver.name}</h3>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {driver.cpf} • {driver.classification}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {driver.recommendationReasons.map((r, i) => (
                        <span key={i} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedDriverForHistory(driver)}
                      className="p-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                      title="Ver Histórico do Motorista"
                    >
                      <History className="w-4 h-4" />
                    </button>
                    <a 
                      href={formatWhatsAppLink(driver.phone)}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium shadow-sm"
                    >
                      <Phone className="w-4 h-4" />
                      {driver.phone}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ShipmentHistoryModal
        isOpen={!!selectedDriverForHistory}
        onClose={() => setSelectedDriverForHistory(null)}
        shipments={selectedDriverForHistory ? shipments.filter(s => s.driverCpf === selectedDriverForHistory.cpf || s.driverName === selectedDriverForHistory.name) : []}
        cargos={cargos}
        title={`Histórico de Embarques - ${selectedDriverForHistory?.name}`}
      />
    </div>
  );
};

export default RecommendedDriversModal;
