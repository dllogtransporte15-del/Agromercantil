import React, { useMemo, useState } from 'react';
import { MapPin, Navigation, RotateCcw } from 'lucide-react';
import type { Cargo, Shipment } from '../types';
import { CargoStatus } from '../types';
import {
  BrazilianRegion,
  extractBrazilianUF,
  getBrazilianRegionByUF,
  getCoordsWithStateFallbackSync,
} from '../utils/geocoding';
import { BRAZIL_STATES_GEO } from '../utils/brazilStatesGeo';

interface RegionalDeliveriesMapCardProps {
  shipments: Shipment[];
  cargos: Cargo[];
  dateRangeBounds?: { start: number | null; end: number | null };
  periodLabel?: string;
  onViewShipments?: () => void;
}

const REGION_CONFIG: {
  region: BrazilianRegion;
  color: string;
  fill: string;
  stroke: string;
}[] = [
  {
    region: 'Sudeste',
    color: '#D4AF37', // DLLOG Gold Principal
    fill: 'rgba(212, 175, 55, 0.24)',
    stroke: '#D4AF37',
  },
  {
    region: 'Centro-Oeste',
    color: '#C4922E', // DLLOG Amber Gold
    fill: 'rgba(196, 146, 46, 0.22)',
    stroke: '#C4922E',
  },
  {
    region: 'Sul',
    color: '#A67142', // DLLOG Bronze
    fill: 'rgba(166, 113, 66, 0.24)',
    stroke: '#A67142',
  },
  {
    region: 'Norte',
    color: '#8A591C', // Deep Bronze
    fill: 'rgba(138, 89, 28, 0.28)',
    stroke: '#B47B38',
  },
  {
    region: 'Nordeste',
    color: '#10B981', // Emerald
    fill: 'rgba(16, 185, 129, 0.20)',
    stroke: '#10B981',
  },
];

const REGION_MAP = Object.fromEntries(REGION_CONFIG.map(r => [r.region, r])) as Record<
  BrazilianRegion,
  (typeof REGION_CONFIG)[number]
>;

function projectLatLng(lat: number, lng: number): { x: number; y: number } {
  const minLng = -74.2;
  const maxLng = -34.5;
  const minLat = -34.0;
  const maxLat = 5.5;
  const pad = 22;
  const size = 456; // 500 - 2 * 22
  const x = pad + ((lng - minLng) / (maxLng - minLng)) * size;
  const y = pad + ((maxLat - lat) / (maxLat - minLat)) * size;
  return { x, y };
}

function coordsToSvgPath(coords: [number, number][]): string {
  return (
    coords
      .map(([lat, lng], i) => {
        const { x, y } = projectLatLng(lat, lng);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ') + ' Z'
  );
}

const STATE_NAMES: Record<string, string> = {
  AC: 'Acre',
  AL: 'Alagoas',
  AP: 'Amapá',
  AM: 'Amazonas',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',
  PA: 'Pará',
  PB: 'Paraíba',
  PR: 'Paraná',
  PE: 'Pernambuco',
  PI: 'Piauí',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul',
  RO: 'Rondônia',
  RR: 'Roraima',
  SC: 'Santa Catarina',
  SP: 'São Paulo',
  SE: 'Sergipe',
  TO: 'Tocantins',
};

const LABEL_OFFSETS: Record<string, [number, number]> = {
  GO: [-8, 10],
  DF: [6, -4],
  BA: [-4, -4],
  PE: [-8, 0],
  PB: [8, -2],
  RN: [6, -3],
  AL: [10, 3],
  SE: [10, 5],
  ES: [8, 2],
  RJ: [8, 5],
  SC: [4, 2],
};

function getPolygonCenter(coords: [number, number][], uf: string): { x: number; y: number } {
  const pts = coords.map(([lat, lng]) => projectLatLng(lat, lng));
  const avgX = pts.reduce((acc, p) => acc + p.x, 0) / pts.length;
  const avgY = pts.reduce((acc, p) => acc + p.y, 0) / pts.length;
  const [dx, dy] = LABEL_OFFSETS[uf] || [0, 0];
  return { x: avgX + dx, y: avgY + dy };
}

const STATE_SVG_PATHS = BRAZIL_STATES_GEO.map(st => {
  const center = getPolygonCenter(st.coords, st.uf);
  return {
    ...st,
    name: STATE_NAMES[st.uf] || st.uf,
    d: coordsToSvgPath(st.coords),
    labelX: center.x,
    labelY: center.y,
  };
});

interface PinPoint {
  key: string;
  x: number;
  y: number;
  label: string;
  region: BrazilianRegion | null;
  count: number;
  tonnage: number;
  routes: string[];
}

interface RouteArc {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cx: number;
  cy: number;
  originRegion: BrazilianRegion | null;
  destRegion: BrazilianRegion | null;
  label: string;
}

type HoveredPin =
  | { type: 'origin'; pin: PinPoint }
  | { type: 'dest'; pin: PinPoint }
  | null;

const RegionalDeliveriesMapCard: React.FC<RegionalDeliveriesMapCardProps> = ({
  cargos,
  periodLabel = 'Mês Atual',
  onViewShipments,
}) => {
  const [selectedRegion, setSelectedRegion] = useState<BrazilianRegion | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<BrazilianRegion | null>(null);
  const [hoveredStateUf, setHoveredStateUf] = useState<string | null>(null);
  const [hoveredPin, setHoveredPin] = useState<HoveredPin>(null);
  const [showOrigins, setShowOrigins] = useState(true);
  const [showDestinations, setShowDestinations] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);

  const activeRegion = hoveredRegion || selectedRegion;

  const analytics = useMemo(() => {
    // Cargas cadastradas ainda não finalizadas (Em andamento ou Suspensa)
    const openCargos = cargos.filter(c => c.status !== CargoStatus.Fechada);

    const regionTonnage: Record<BrazilianRegion, number> = {
      Sudeste: 0,
      Sul: 0,
      Norte: 0,
      Nordeste: 0,
      'Centro-Oeste': 0,
    };

    const regionCargoCount: Record<BrazilianRegion, number> = {
      Sudeste: 0,
      Sul: 0,
      Norte: 0,
      Nordeste: 0,
      'Centro-Oeste': 0,
    };

    const originMap = new Map<string, PinPoint>();
    const destMap = new Map<string, PinPoint>();
    const routeMap = new Map<string, RouteArc>();
    const stateStats: Record<string, { count: number; tonnage: number }> = {};

    let totalTonnage = 0;

    openCargos.forEach(cargo => {
      const tons = Number(cargo.totalVolume || 0);
      totalTonnage += tons;

      const originText = cargo.origin || '';
      const destText = cargo.destination || '';

      const originUF = extractBrazilianUF(originText);
      const destUF = extractBrazilianUF(destText) || originUF;
      const originRegion = getBrazilianRegionByUF(originUF);
      const destRegion = getBrazilianRegionByUF(destUF);

      const touchedUFs = new Set<string>();
      if (originUF) touchedUFs.add(originUF);
      if (destUF) touchedUFs.add(destUF);
      touchedUFs.forEach(uf => {
        if (!stateStats[uf]) stateStats[uf] = { count: 0, tonnage: 0 };
        stateStats[uf].count += 1;
        stateStats[uf].tonnage += tons;
      });

      if (destRegion) {
        regionTonnage[destRegion] += tons > 0 ? tons : 1;
        regionCargoCount[destRegion] += 1;
      }

      const oCoords = cargo.originCoords || getCoordsWithStateFallbackSync(originText);
      const dCoords = cargo.destinationCoords || getCoordsWithStateFallbackSync(destText);

      let oProj: { x: number; y: number } | null = null;
      let dProj: { x: number; y: number } | null = null;

      if (oCoords) {
        oProj = projectLatLng(oCoords.lat, oCoords.lng);
        const oKey = `${oProj.x.toFixed(0)}_${oProj.y.toFixed(0)}`;
        const existing = originMap.get(oKey);
        const routeLabel = destText ? `→ ${destText}` : '';
        if (existing) {
          existing.count += 1;
          existing.tonnage += tons;
          if (routeLabel && !existing.routes.includes(routeLabel) && existing.routes.length < 4) {
            existing.routes.push(routeLabel);
          }
        } else {
          originMap.set(oKey, {
            key: oKey,
            x: oProj.x,
            y: oProj.y,
            label: originText || 'Origem',
            region: originRegion,
            count: 1,
            tonnage: tons,
            routes: routeLabel ? [routeLabel] : [],
          });
        }
      }

      if (dCoords) {
        dProj = projectLatLng(dCoords.lat, dCoords.lng);
        const dKey = `${dProj.x.toFixed(0)}_${dProj.y.toFixed(0)}`;
        const existing = destMap.get(dKey);
        const routeLabel = originText ? `← ${originText}` : '';
        if (existing) {
          existing.count += 1;
          existing.tonnage += tons;
          if (routeLabel && !existing.routes.includes(routeLabel) && existing.routes.length < 4) {
            existing.routes.push(routeLabel);
          }
        } else {
          destMap.set(dKey, {
            key: dKey,
            x: dProj.x,
            y: dProj.y,
            label: destText || 'Destino',
            region: destRegion,
            count: 1,
            tonnage: tons,
            routes: routeLabel ? [routeLabel] : [],
          });
        }
      }

      if (oProj && dProj) {
        const rKey = `${oProj.x.toFixed(0)}_${oProj.y.toFixed(0)}->${dProj.x.toFixed(0)}_${dProj.y.toFixed(0)}`;
        if (!routeMap.has(rKey)) {
          const mx = (oProj.x + dProj.x) / 2;
          const my = (oProj.y + dProj.y) / 2;
          const dx = dProj.x - oProj.x;
          const dy = dProj.y - oProj.y;
          const dist = Math.hypot(dx, dy) || 1;
          const offset = Math.min(28, dist * 0.22);
          const cx = mx - (dy / dist) * offset;
          const cy = my + (dx / dist) * offset;
          routeMap.set(rKey, {
            key: rKey,
            x1: oProj.x,
            y1: oProj.y,
            x2: dProj.x,
            y2: dProj.y,
            cx,
            cy,
            originRegion,
            destRegion,
            label: `${originText || 'Origem'} → ${destText || 'Destino'}`,
          });
        }
      }
    });

    const sumRegionWeight = Object.values(regionTonnage).reduce((a, b) => a + b, 0);
    const regionStats = REGION_CONFIG.map(cfg => {
      const value = regionTonnage[cfg.region];
      const pct = sumRegionWeight > 0 ? (value / sumRegionWeight) * 100 : 0;
      return {
        ...cfg,
        pct,
        tonnage: value,
        cargoCount: regionCargoCount[cfg.region],
      };
    }).sort((a, b) => b.pct - a.pct);

    return {
      activeCount: openCargos.length,
      totalTonnage,
      regionStats,
      stateStats,
      origins: Array.from(originMap.values()),
      destinations: Array.from(destMap.values()),
      routes: Array.from(routeMap.values()),
    };
  }, [cargos]);

  const displayedTonnage = useMemo(() => {
    if (!selectedRegion) return analytics.totalTonnage;
    const found = analytics.regionStats.find(r => r.region === selectedRegion);
    return found ? found.tonnage : analytics.totalTonnage;
  }, [analytics, selectedRegion]);

  const formattedTonnage = displayedTonnage.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  const handleToggleRegion = (region: BrazilianRegion) => {
    setSelectedRegion(prev => (prev === region ? null : region));
  };

  return (
    <div
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden"
      style={{
        backgroundImage: 'radial-gradient(rgba(196, 146, 46, 0.10) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }}
    >
      <style>{`
        @keyframes dllogMapPulse {
          0%, 100% { transform: scale(1); opacity: 0.35; }
          50% { transform: scale(1.45); opacity: 0.12; }
        }
        @keyframes dllogRouteFlow {
          to { stroke-dashoffset: -24; }
        }
        .dllog-pin-pulse {
          transform-box: fill-box;
          transform-origin: center;
          animation: dllogMapPulse 2.6s ease-in-out infinite;
        }
        .dllog-route-arc {
          animation: dllogRouteFlow 2.2s linear infinite;
        }
      `}</style>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-semibold text-gray-700 dark:text-gray-200 leading-tight">
                Entregas por Região
              </h3>
              {selectedRegion && (
                <button
                  type="button"
                  onClick={() => setSelectedRegion(null)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/60 transition-colors cursor-pointer"
                  title="Limpar filtro de região"
                >
                  <span>{selectedRegion}</span>
                  <RotateCcw className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {analytics.activeCount} {analytics.activeCount === 1 ? 'carga cadastrada' : 'cargas cadastradas'} não finalizadas ({periodLabel})
            </p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-gray-700 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-gray-600 shrink-0 tabular-nums">
          {formattedTonnage} t
        </span>
      </div>

      {/* Map + Region Bars */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center my-auto relative z-10">
        {/* Brazil SVG Map */}
        <div className="md:col-span-8 flex items-center justify-center relative">
          <svg
            viewBox="0 0 500 500"
            className="w-full max-w-[440px] h-auto select-none"
            role="img"
            aria-label="Mapa interativo de origens e destinos de cargas não finalizadas"
          >
            <defs>
              <filter id="glow-origin" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glow-dest" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* States */}
            <g>
              {STATE_SVG_PATHS.map(st => {
                const cfg = REGION_MAP[st.region];
                const isStateHovered = hoveredStateUf === st.uf;
                const isDimmed = !isStateHovered && activeRegion !== null && activeRegion !== st.region;
                const isHighlighted = isStateHovered || activeRegion === st.region;
                return (
                  <path
                    key={st.uf}
                    d={st.d}
                    fill={cfg.fill}
                    stroke={isStateHovered ? '#FFFBEB' : cfg.stroke}
                    strokeWidth={isStateHovered ? 2.1 : isHighlighted ? 1.7 : 1.05}
                    strokeLinejoin="round"
                    style={{
                      opacity: isDimmed ? 0.3 : 1,
                      fillOpacity: isStateHovered ? 0.45 : undefined,
                      cursor: 'pointer',
                      transition: 'opacity 0.2s ease, stroke-width 0.2s ease, fill-opacity 0.2s ease',
                    }}
                    onMouseEnter={() => {
                      setHoveredRegion(st.region);
                      setHoveredStateUf(st.uf);
                    }}
                    onMouseLeave={() => {
                      setHoveredRegion(null);
                      setHoveredStateUf(null);
                    }}
                    onClick={() => handleToggleRegion(st.region)}
                  />
                );
              })}
            </g>

            {/* State UF Siglas */}
            <g pointerEvents="none">
              {STATE_SVG_PATHS.map(st => {
                const isStateHovered = hoveredStateUf === st.uf;
                const isDimmed = !isStateHovered && activeRegion !== null && activeRegion !== st.region;
                const isTiny = st.uf === 'DF' || st.uf === 'SE' || st.uf === 'AL' || st.uf === 'RJ' || st.uf === 'ES';
                if (isTiny && !isStateHovered) return null;
                return (
                  <text
                    key={`lbl_${st.uf}`}
                    x={st.labelX}
                    y={st.labelY}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={isStateHovered ? 11.5 : 8.5}
                    fontWeight={isStateHovered ? 800 : 700}
                    fill={isStateHovered ? '#FFFBEB' : '#E2E8F0'}
                    stroke="rgba(16, 14, 13, 0.72)"
                    strokeWidth={isStateHovered ? 2.6 : 1.8}
                    paintOrder="stroke"
                    style={{
                      opacity: isDimmed ? 0.25 : isStateHovered ? 1 : 0.82,
                      transition: 'opacity 0.2s ease, font-size 0.15s ease',
                    }}
                  >
                    {st.uf}
                  </text>
                );
              })}
            </g>

            {/* Open Routes (Animated Dashed Arcs) */}
            {showRoutes && (
              <g pointerEvents="none">
                {analytics.routes.map(r => {
                  const isDimmed =
                    activeRegion !== null &&
                    r.originRegion !== activeRegion &&
                    r.destRegion !== activeRegion;
                  return (
                    <path
                      key={r.key}
                      d={`M${r.x1.toFixed(1)},${r.y1.toFixed(1)} Q${r.cx.toFixed(1)},${r.cy.toFixed(1)} ${r.x2.toFixed(1)},${r.y2.toFixed(1)}`}
                      fill="none"
                      stroke="#D4AF37"
                      strokeOpacity={isDimmed ? 0.12 : 0.65}
                      strokeWidth={1.35}
                      strokeDasharray="4 4"
                      className="dllog-route-arc"
                    />
                  );
                })}
              </g>
            )}

            {/* Origin Pins (Emerald Green) */}
            {showOrigins && (
              <g>
                {analytics.origins.map(pt => {
                  const isDimmed = activeRegion !== null && pt.region !== activeRegion;
                  return (
                    <g
                      key={`o_${pt.key}`}
                      filter="url(#glow-origin)"
                      style={{
                        opacity: isDimmed ? 0.22 : 1,
                        cursor: 'pointer',
                        transition: 'opacity 0.2s ease',
                      }}
                      onMouseEnter={() => setHoveredPin({ type: 'origin', pin: pt })}
                      onMouseLeave={() => setHoveredPin(null)}
                    >
                      <circle cx={pt.x} cy={pt.y} r={9} fill="#10B981" className="dllog-pin-pulse" />
                      <circle cx={pt.x} cy={pt.y} r={6.5} fill="#10B981" fillOpacity={0.28} />
                      <circle cx={pt.x} cy={pt.y} r={3.6} fill="#10B981" stroke="#ECFDF5" strokeWidth={1.1} />
                    </g>
                  );
                })}
              </g>
            )}

            {/* Destination Pins (DLLOG Gold) */}
            {showDestinations && (
              <g>
                {analytics.destinations.map(pt => {
                  const isDimmed = activeRegion !== null && pt.region !== activeRegion;
                  return (
                    <g
                      key={`d_${pt.key}`}
                      filter="url(#glow-dest)"
                      style={{
                        opacity: isDimmed ? 0.22 : 1,
                        cursor: 'pointer',
                        transition: 'opacity 0.2s ease',
                      }}
                      onMouseEnter={() => setHoveredPin({ type: 'dest', pin: pt })}
                      onMouseLeave={() => setHoveredPin(null)}
                    >
                      <circle cx={pt.x} cy={pt.y} r={10} fill="#D4AF37" className="dllog-pin-pulse" />
                      <circle cx={pt.x} cy={pt.y} r={7} fill="#D4AF37" fillOpacity={0.32} />
                      <circle cx={pt.x} cy={pt.y} r={3.8} fill="#D4AF37" stroke="#FFFBEB" strokeWidth={1.1} />
                    </g>
                  );
                })}
              </g>
            )}
          </svg>

          {/* Interactive State Tooltip (when not hovering a specific pin) */}
          {!hoveredPin && hoveredStateUf && (() => {
            const st = STATE_SVG_PATHS.find(s => s.uf === hoveredStateUf);
            if (!st) return null;
            const cfg = REGION_MAP[st.region];
            const stInfo = analytics.stateStats[st.uf];
            return (
              <div
                className="pointer-events-none absolute top-2 left-2 right-2 sm:right-auto sm:max-w-[230px] rounded-lg px-3 py-2 text-xs shadow-xl border bg-white/95 dark:bg-gray-900/95 text-gray-800 dark:text-gray-100 backdrop-blur-md z-20"
                style={{ borderColor: cfg.stroke }}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cfg.color }}
                  />
                  <span>{st.name} ({st.uf})</span>
                </div>
                <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                  Região: <strong className="text-gray-700 dark:text-gray-200">{st.region}</strong>
                </div>
                <div className="mt-1 text-[11px]">
                  {stInfo && stInfo.count > 0 ? (
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      {stInfo.count} {stInfo.count === 1 ? 'carga não finalizada' : 'cargas não finalizadas'} • {stInfo.tonnage.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t
                    </span>
                  ) : (
                    <span className="italic text-gray-400 dark:text-gray-500">
                      Sem cargas não finalizadas
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Interactive Pin Tooltip */}
          {hoveredPin && (
            <div
              className="pointer-events-none absolute top-2 left-2 right-2 sm:right-auto sm:max-w-[230px] rounded-lg px-3 py-2 text-xs shadow-xl border bg-white/95 dark:bg-gray-900/95 text-gray-800 dark:text-gray-100 backdrop-blur-md z-20"
              style={{
                borderColor: hoveredPin.type === 'origin' ? 'rgba(16, 185, 129, 0.5)' : 'rgba(212, 175, 55, 0.55)',
              }}
            >
              <div className="flex items-center gap-1.5 font-bold">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: hoveredPin.type === 'origin' ? '#10B981' : '#D4AF37' }}
                />
                <span className="truncate">{hoveredPin.pin.label}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                <span>{hoveredPin.type === 'origin' ? 'Origem (Embarque)' : 'Destino (Descarga)'}</span>
                <span className="font-semibold text-gray-700 dark:text-gray-200">
                  {hoveredPin.pin.count} {hoveredPin.pin.count === 1 ? 'carga' : 'cargas'} • {hoveredPin.pin.tonnage.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t
                </span>
              </div>
              {hoveredPin.pin.routes.length > 0 && (
                <div className="mt-1 pt-1 border-t border-gray-200 dark:border-gray-700 text-[10px] space-y-0.5 text-gray-600 dark:text-gray-300">
                  {hoveredPin.pin.routes.map((rt, idx) => (
                    <div key={idx} className="truncate">{rt}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Region Breakdown */}
        <div className="md:col-span-4 space-y-2">
          {analytics.regionStats.map(item => {
            const isSelected = selectedRegion === item.region;
            const isDimmed = activeRegion !== null && activeRegion !== item.region;
            return (
              <button
                key={item.region}
                type="button"
                onClick={() => handleToggleRegion(item.region)}
                onMouseEnter={() => setHoveredRegion(item.region)}
                onMouseLeave={() => setHoveredRegion(null)}
                className={`w-full text-left space-y-1 p-1 -mx-1 rounded-md transition-all cursor-pointer ${
                  isSelected ? 'bg-amber-50/70 dark:bg-gray-700/60' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                }`}
                style={{ opacity: isDimmed ? 0.45 : 1 }}
              >
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: item.color,
                        boxShadow: `0 0 6px ${item.color}88`,
                      }}
                    />
                    <span className="truncate">{item.region}</span>
                    {item.cargoCount > 0 && (
                      <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">
                        ({item.cargoCount})
                      </span>
                    )}
                  </div>
                  <span className="tabular-nums text-gray-600 dark:text-gray-300 shrink-0 ml-1">
                    {item.pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                  </span>
                </div>
                <div className="w-full h-1 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(item.pct > 0 ? 4 : 2, Math.min(100, item.pct))}%`,
                      backgroundColor: item.color,
                      boxShadow: item.pct > 0 ? `0 0 8px ${item.color}66` : 'none',
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Legend */}
      <div className="mt-5 pt-3.5 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3 text-[11px] relative z-10">
        <div className="flex flex-wrap items-center gap-3.5 text-gray-500 dark:text-gray-400">
          <button
            type="button"
            onClick={() => setShowOrigins(v => !v)}
            className="inline-flex items-center gap-1.5 cursor-pointer transition-opacity"
            style={{ opacity: showOrigins ? 1 : 0.4 }}
            title="Mostrar/ocultar pontos de Origem"
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#10B981' }} />
            <span>Origem (Embarque)</span>
          </button>
          <button
            type="button"
            onClick={() => setShowDestinations(v => !v)}
            className="inline-flex items-center gap-1.5 cursor-pointer transition-opacity"
            style={{ opacity: showDestinations ? 1 : 0.4 }}
            title="Mostrar/ocultar pontos de Destino"
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#D4AF37' }} />
            <span>Destino (Descarga)</span>
          </button>
          <button
            type="button"
            onClick={() => setShowRoutes(v => !v)}
            className="inline-flex items-center gap-1.5 cursor-pointer transition-opacity"
            style={{ opacity: showRoutes ? 1 : 0.4 }}
            title="Mostrar/ocultar rotas em aberto"
          >
            <span className="w-4 border-t-2 border-dashed" style={{ borderColor: '#D4AF37' }} />
            <span>Rotas em Aberto</span>
          </button>
        </div>
        <button
          type="button"
          onClick={onViewShipments}
          className="inline-flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
        >
          <Navigation className="w-3 h-3" />
          <span>{analytics.activeCount} cargas não finalizadas</span>
        </button>
      </div>
    </div>
  );
};

export default RegionalDeliveriesMapCard;
