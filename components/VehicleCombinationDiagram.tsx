import React from 'react';

export type VehicleDiagramType =
  | 'truck_3_eixos'
  | 'toco_carreta_2_eixos'
  | 'toco_carreta_ls'
  | 'toco_vanderleia'
  | 'carreta_simples'
  | 'ls_4_eixos'
  | 'bitrem'
  | 'bitrem_9_eixos'
  | 'rodotrem'
  | 'rodocacamba';

export interface VehicleCombinationSpec {
  id: VehicleDiagramType;
  title: string;
  shortTitle: string;
  subtitle: string;
  axlesCount: number;
  pbtTons: number;
  taraTons: string;
  netCapacityTons: string;
  lengthMeters: string;
  formulaText: string;
  couplingNote: string;
  platesRequired: string;
  applicationNote: string;
  badgeColor: 'amber' | 'emerald' | 'violet' | 'cyan' | 'rose';
}

export const VEHICLE_COMBINATION_SPECS: Record<VehicleDiagramType, VehicleCombinationSpec> = {
  truck_3_eixos: {
    id: 'truck_3_eixos',
    title: 'Caminhão Truck 6x2 (3 Eixos Rígido)',
    shortTitle: 'Truck 3 Eixos (6x2)',
    subtitle: 'Veículo monobloco sem articulação • 1 eixo direcional + 2 eixos traseiros em tandem',
    axlesCount: 3,
    pbtTons: 23.0,
    taraTons: '≈ 8,5 a 9,0 t',
    netCapacityTons: '≈ 14,0 a 14,5 t',
    lengthMeters: '14,00 m',
    formulaText: '6t + 17t = 23,0 toneladas',
    couplingNote: 'Monobloco (Sem quinta-roda / Sem reboque)',
    platesRequired: '1 Placa (Caminhão Rígido)',
    applicationNote: 'Entregas regionais, sacarias e rotas com restrição a carretas articuladas.',
    badgeColor: 'cyan'
  },
  toco_carreta_2_eixos: {
    id: 'toco_carreta_2_eixos',
    title: 'Cavalo Toco (4x2) + Carreta 2 Eixos (4 Eixos)',
    shortTitle: 'Cavalo Toco + Carreta 2 Eixos',
    subtitle: 'Cavalo simples (2 eixos) acoplado a semirreboque de 2 eixos em tandem',
    axlesCount: 4,
    pbtTons: 33.0,
    taraTons: '≈ 13,0 t',
    netCapacityTons: '≈ 20,0 t',
    lengthMeters: '18,60 m',
    formulaText: '6t + 10t + 17t = 33,0 toneladas',
    couplingNote: 'Pino-rei na quinta-roda do cavalo toco',
    platesRequired: '2 Placas (1 Cavalo + 1 Carreta)',
    applicationNote: 'Cargas leves, paletizadas ou rotas curtas com menor peso específico.',
    badgeColor: 'cyan'
  },
  toco_carreta_ls: {
    id: 'toco_carreta_ls',
    title: 'Cavalo Toco (4x2) + Carreta LS 3 Eixos (5 Eixos)',
    shortTitle: 'Cavalo Toco + Carreta LS',
    subtitle: 'Cavalo simples 4x2 (6t + 10t) + Carreta de 3 eixos juntos (25,5t)',
    axlesCount: 5,
    pbtTons: 41.5,
    taraTons: '≈ 15,5 t',
    netCapacityTons: '≈ 26,0 t',
    lengthMeters: '18,60 m',
    formulaText: '6t + 10t + 25,5t = 41,5 toneladas',
    couplingNote: 'Pino-rei na quinta-roda do cavalo toco',
    platesRequired: '2 Placas (1 Cavalo + 1 Carreta)',
    applicationNote: 'Operações regionais de grãos e sacarias onde não se exige cavalo trucado.',
    badgeColor: 'amber'
  },
  toco_vanderleia: {
    id: 'toco_vanderleia',
    title: 'Cavalo Toco (4x2) + Carreta Vanderleia (5 Eixos Espaçados)',
    shortTitle: 'Cavalo Toco + Vanderleia',
    subtitle: '3 eixos da carreta distanciados (> 2,40m), permitindo 10t em cada eixo isolado',
    axlesCount: 5,
    pbtTons: 46.0,
    taraTons: '≈ 16,5 t',
    netCapacityTons: '≈ 29,5 t',
    lengthMeters: '18,60 m',
    formulaText: '6t + 10t + 10t + 10t + 10t = 46,0 toneladas',
    couplingNote: 'Eixos espaçados ("Vanderleia") ganham +4,5t de PBT sobre a LS comum no cavalo toco',
    platesRequired: '2 Placas (1 Cavalo + 1 Carreta)',
    applicationNote: 'Muito usada em bebidas, industrializados e grãos com cavalo 4x2 ou 6x2.',
    badgeColor: 'amber'
  },
  carreta_simples: {
    id: 'carreta_simples',
    title: 'Cavalo Trucado (6x2) + Carreta LS 3 Eixos (6 Eixos)',
    shortTitle: 'Cavalo Trucado + Carreta LS',
    subtitle: 'Conjunto clássico do agro: Cavalo Trucado (6t + 17t) + Carreta 3 eixos em tandem (25,5t)',
    axlesCount: 6,
    pbtTons: 48.5,
    taraTons: '≈ 16,5 t (Graneleiro) / 18,5 t (Caçamba)',
    netCapacityTons: '≈ 32,0 t (Graneleiro) / 29,0 t (Caçamba)',
    lengthMeters: '16,00 m a 18,60 m',
    formulaText: '6t + 17t + 25,5t = 48,5 toneladas',
    couplingNote: 'Pino-rei acoplado na quinta-roda do cavalo trucado',
    platesRequired: '2 Placas (1 Cavalo + 1 Carreta)',
    applicationNote: 'Versátil: cabe em praticamente qualquer balança de fazenda, armazém ou porto.',
    badgeColor: 'amber'
  },
  ls_4_eixos: {
    id: 'ls_4_eixos',
    title: 'Cavalo Trucado (6x2/6x4) + Carreta LS 4 Eixos (7 Eixos)',
    shortTitle: 'Carreta LS 4 Eixos',
    subtitle: 'Cavalo Trucado (6t + 17t) + Semirreboque de 4 eixos (35,5t)',
    axlesCount: 7,
    pbtTons: 58.5,
    taraTons: '≈ 18,5 t',
    netCapacityTons: '≈ 40,0 t (Graneleiro) / 37,5 t (Caçamba)',
    lengthMeters: '18,60 m',
    formulaText: '6t + 17t + 35,5t = 58,5 toneladas',
    couplingNote: '1 única carreta de 4 eixos (dispensa segunda carreta e cabe em balança padrão)',
    platesRequired: '2 Placas (1 Cavalo + 1 Carreta 4 Eixos)',
    applicationNote: 'Alta eficiência no agro: leva quase 40t líquidas com apenas 1 carreta.',
    badgeColor: 'emerald'
  },
  bitrem: {
    id: 'bitrem',
    title: 'Bitrem / Bicaçamba 7 Eixos (Acoplamento Quinta-Roda)',
    shortTitle: 'Bitrem 7 Eixos',
    subtitle: 'Cavalo Trucado (3 eixos) + 1ª Carreta (2 eixos) + Quinta-Roda + 2ª Carreta (2 eixos)',
    axlesCount: 7,
    pbtTons: 57.0,
    taraTons: '≈ 19,5 a 21,0 t (Graneleiro) / 22,0 t (Bicaçamba)',
    netCapacityTons: '≈ 37,0 a 38,0 t (Graneleiro) / 35,5 t (Bicaçamba)',
    lengthMeters: '19,80 m',
    formulaText: '6t + 17t + 17t + 17t = 57,0 toneladas',
    couplingNote: 'A 2ª carreta apoia direto sobre a QUINTA-RODA traseira da 1ª carreta (sem dolly)',
    platesRequired: '3 Placas (1 Cavalo + 2 Carretas)',
    applicationNote: 'Excelente estabilidade e manobrabilidade; cabe na maioria das balanças de 21m.',
    badgeColor: 'emerald'
  },
  bitrem_9_eixos: {
    id: 'bitrem_9_eixos',
    title: 'Bitrem 9 Eixos / Tritrem (Quinta-Roda • Carretas de 3 Eixos)',
    shortTitle: 'Bitrem 9 Eixos',
    subtitle: 'Cavalo 6x4 (3 eixos) + 1ª Carreta (3 eixos) + Quinta-Roda + 2ª Carreta (3 eixos)',
    axlesCount: 9,
    pbtTons: 74.0,
    taraTons: '≈ 24,0 a 25,0 t',
    netCapacityTons: '≈ 49,0 a 50,0 t',
    lengthMeters: '25,00 m a 30,00 m',
    formulaText: '6t + 17t + 25,5t + 25,5t = 74,0 toneladas',
    couplingNote: 'Acoplado por QUINTA-RODA estendida na traseira da 1ª carreta (exige AET e Cavalo 6x4)',
    platesRequired: '3 Placas (1 Cavalo 6x4 + 2 Carretas 3 Eixos)',
    applicationNote: 'Capacidade máxima de 74t sem uso de dolly intermediário.',
    badgeColor: 'violet'
  },
  rodotrem: {
    id: 'rodotrem',
    title: 'Rodotrem 9 Eixos Graneleiro (Acoplamento com Dolly)',
    shortTitle: 'Rodotrem 9 Eixos',
    subtitle: 'Cavalo 6x4 (3 eixos) + 1ª Carreta (2 eixos) + DOLLY (2 eixos) + 2ª Carreta (2 eixos)',
    axlesCount: 9,
    pbtTons: 74.0,
    taraTons: '≈ 24,0 a 24,5 t',
    netCapacityTons: '≈ 48,5 a 50,0 t',
    lengthMeters: '19,80 m (curto) ou 25,00 m a 30,00 m (alongado)',
    formulaText: '6t + 17t + 17t + 17t (Dolly) + 17t = 74,0 toneladas',
    couplingNote: 'Possui reboque intermediário DOLLY (cambão + quinta-roda) unindo as 2 carretas',
    platesRequired: '4 Placas (1 Cavalo 6x4 + 1ª Carreta + Dolly + 2ª Carreta)',
    applicationNote: 'Gigante do escoamento de grãos (soja/milho). Atenção a balanças menores que 25m!',
    badgeColor: 'violet'
  },
  rodocacamba: {
    id: 'rodocacamba',
    title: 'Rodocaçamba 9 Eixos Basculante (com Dolly)',
    shortTitle: 'Rodocaçamba 9 Eixos',
    subtitle: 'Cavalo 6x4 (3 eixos) + 1ª Caçamba (2 eixos) + DOLLY (2 eixos) + 2ª Caçamba (2 eixos)',
    axlesCount: 9,
    pbtTons: 74.0,
    taraTons: '≈ 26,0 a 27,0 t',
    netCapacityTons: '≈ 47,0 a 48,5 t',
    lengthMeters: '25,00 m a 30,00 m',
    formulaText: '6t + 17t + 17t + 17t (Dolly) + 17t = 74,0 toneladas',
    couplingNote: '2 Caçambas Basculantes unidas por DOLLY de 2 eixos para descarga em moegas',
    platesRequired: '4 Placas (1 Cavalo 6x4 + 1ª Caçamba + Dolly + 2ª Caçamba)',
    applicationNote: 'Indispensável para fertilizante a granel, calcário, gesso, brita e açúcar VHP.',
    badgeColor: 'rose'
  }
};

export const ALL_VEHICLE_DIAGRAM_TYPES: VehicleDiagramType[] = [
  'truck_3_eixos',
  'toco_carreta_2_eixos',
  'toco_carreta_ls',
  'toco_vanderleia',
  'carreta_simples',
  'ls_4_eixos',
  'bitrem',
  'bitrem_9_eixos',
  'rodotrem',
  'rodocacamba'
];

interface WheelProps {
  cx: number;
  cy?: number;
}

const Wheel: React.FC<WheelProps> = ({ cx, cy = 118 }) => (
  <g>
    <circle cx={cx} cy={cy} r={11.5} fill="#18181b" stroke="#52525b" strokeWidth={2} />
    <circle cx={cx} cy={cy} r={6.5} fill="#a1a1aa" stroke="#27272a" strokeWidth={1.5} />
    <circle cx={cx} cy={cy} r={2.5} fill="#B27C26" />
  </g>
);

interface AxleBracketProps {
  xStart: number;
  xEnd: number;
  label: string;
  y?: number;
}

const AxleBracket: React.FC<AxleBracketProps> = ({ xStart, xEnd, label, y = 138 }) => {
  const mid = (xStart + xEnd) / 2;
  const isSingle = Math.abs(xEnd - xStart) < 6;
  return (
    <g>
      {isSingle ? (
        <>
          <line x1={mid} y1={y - 5} x2={mid} y2={y + 5} stroke="#d97706" strokeWidth={1.8} />
          <line x1={mid - 6} y1={y} x2={mid + 6} y2={y} stroke="#d97706" strokeWidth={1.8} />
        </>
      ) : (
        <>
          <line x1={xStart} y1={y - 5} x2={xStart} y2={y + 4} stroke="#d97706" strokeWidth={1.8} />
          <line x1={xEnd} y1={y - 5} x2={xEnd} y2={y + 4} stroke="#d97706" strokeWidth={1.8} />
          <line x1={xStart} y1={y} x2={xEnd} y2={y} stroke="#d97706" strokeWidth={1.8} />
        </>
      )}
      <text
        x={mid}
        y={y + 16}
        textAnchor="middle"
        fill="#fbbf24"
        fontSize="11"
        fontWeight="800"
        fontFamily="system-ui, sans-serif"
      >
        {label}
      </text>
    </g>
  );
};

interface TractorCabProps {
  x: number;
  isTrucado: boolean;
  label?: string;
}

const TractorCab: React.FC<TractorCabProps> = ({ x, isTrucado, label = 'cavalo' }) => {
  const chassisEnd = isTrucado ? x + 132 : x + 108;
  const cabCenter = isTrucado ? x + 66 : x + 55;

  return (
    <g>
      {/* Chassi do Cavalo */}
      <rect x={x + 8} y={103} width={chassisEnd - (x + 8)} height={8} rx={2} fill="#3f3f46" stroke="#52525b" strokeWidth={1} />
      {/* Quinta-roda no chassi do cavalo */}
      <path
        d={`M ${chassisEnd - 30} 103 L ${chassisEnd - 14} 97 L ${chassisEnd - 8} 103 Z`}
        fill="#f59e0b"
      />
      {/* Tanque de Combustível */}
      <rect x={x + 48} y={102} width={22} height={11} rx={3} fill="#71717a" stroke="#3f3f46" strokeWidth={1} />

      {/* Cabine Aerodinâmica (Estilo Executivo Dourado/Bronze DLLOG) */}
      <path
        d={`M ${x + 8} 105
            L ${x + 8} 72
            L ${x + 15} 48
            Q ${x + 19} 36 ${x + 32} 34
            L ${x + 54} 32
            L ${x + 54} 105 Z`}
        fill="url(#dllogCabGrad)"
        stroke="#f59e0b"
        strokeWidth={1.2}
      />
      {/* Defletor de teto */}
      <path
        d={`M ${x + 28} 34 Q ${x + 42} 25 ${x + 54} 28 L ${x + 54} 34 Z`}
        fill="#92400e"
      />
      {/* Para-brisa / Janela */}
      <path
        d={`M ${x + 13} 70 L ${x + 18} 51 Q ${x + 21} 45 ${x + 29} 45 L ${x + 40} 45 L ${x + 40} 70 Z`}
        fill="#090d16"
        stroke="#fbbf24"
        strokeWidth={0.8}
      />
      {/* Grade frontal e farol */}
      <rect x={x + 8} y={78} width={5} height={18} rx={1} fill="#27272a" />
      <rect x={x + 8} y={96} width={6} height={5} rx={1} fill="#fef08a" />

      {/* Rodas do Cavalo */}
      <Wheel cx={x + 28} />
      <Wheel cx={x + 88} />
      {isTrucado && <Wheel cx={x + 114} />}

      {/* Badge [cavalo] estilo imagem de referência */}
      <rect
        x={cabCenter - 32}
        y={8}
        width={64}
        height={18}
        rx={5}
        fill="#1e293b"
        stroke="#38bdf8"
        strokeWidth={1.2}
      />
      <text
        x={cabCenter}
        y={21}
        textAnchor="middle"
        fill="#7dd3fc"
        fontSize="10.5"
        fontWeight="800"
        fontFamily="system-ui, sans-serif"
      >
        {label}
      </text>
    </g>
  );
};

interface TrailerBoxProps {
  x: number;
  width: number;
  label?: string;
  isDumpBody?: boolean;
  hasRearFifthWheel?: boolean;
}

const TrailerBox: React.FC<TrailerBoxProps> = ({
  x,
  width,
  label = 'carreta',
  isDumpBody = false,
  hasRearFifthWheel = false
}) => {
  const center = x + width / 2;
  return (
    <g>
      {/* Chassi inferior da carreta */}
      <rect
        x={x + 10}
        y={96}
        width={hasRearFifthWheel ? width + 26 : width - 12}
        height={7}
        rx={2}
        fill="#3f3f46"
      />
      {/* Pé mecânico de apoio (Landing Gear) */}
      <line x1={x + 42} y1={96} x2={x + 42} y2={116} stroke="#71717a" strokeWidth={3} />
      <line x1={x + 37} y1={116} x2={x + 47} y2={116} stroke="#71717a" strokeWidth={2.5} />

      {isDumpBody ? (
        /* Caçamba Basculante */
        <g>
          {/* Pistão hidráulico frontal */}
          <line x1={x + 6} y1={96} x2={x + 14} y2={52} stroke="#a1a1aa" strokeWidth={4} />
          <polygon
            points={`${x + 12},48 ${x + width - 4},48 ${x + width - 10},95 ${x + 6},95`}
            fill="url(#dllogDumpGrad)"
            stroke="#d4d4d8"
            strokeWidth={1.2}
          />
          {/* Nervuras diagonais da caçamba */}
          {Array.from({ length: Math.max(3, Math.floor(width / 36)) }).map((_, idx) => {
            const rx = x + 26 + idx * 32;
            if (rx > x + width - 18) return null;
            return (
              <line
                key={idx}
                x1={rx}
                y1={50}
                x2={rx - 4}
                y2={94}
                stroke="#52525b"
                strokeWidth={1.5}
              />
            );
          })}
        </g>
      ) : (
        /* Carreta Graneleira / Carga Seca com Lona */
        <g>
          <rect
            x={x}
            y={46}
            width={width}
            height={50}
            rx={3}
            fill="url(#dllogTrailerGrad)"
            stroke="#d4d4d8"
            strokeWidth={1.2}
          />
          {/* Lona superior */}
          <rect x={x} y={46} width={width} height={7} rx={2} fill="#B27C26" />
          {/* Fuenhos / Travessas verticais da grade graneleira */}
          {Array.from({ length: Math.max(4, Math.floor(width / 28)) }).map((_, idx) => {
            const lx = x + 22 + idx * 26;
            if (lx > x + width - 10) return null;
            return (
              <line
                key={idx}
                x1={lx}
                y1={53}
                x2={lx}
                y2={95}
                stroke="#a1a1aa"
                strokeWidth={1}
              />
            );
          })}
          {/* Faixa refletiva lateral */}
          <line
            x1={x + 4}
            y1={92}
            x2={x + width - 4}
            y2={92}
            stroke="#ef4444"
            strokeWidth={2}
            strokeDasharray="8 4"
          />
        </g>
      )}

      {/* Quinta-roda traseira estendida (para Bitrem) */}
      {hasRearFifthWheel && (
        <path
          d={`M ${x + width + 4} 96 L ${x + width + 18} 90 L ${x + width + 26} 96 Z`}
          fill="#f59e0b"
        />
      )}

      {/* Badge [carreta] / [caçamba] estilo imagem de referência */}
      <rect
        x={center - 38}
        y={22}
        width={76}
        height={18}
        rx={5}
        fill="#2e1065"
        stroke="#f43f5e"
        strokeWidth={1.2}
      />
      <text
        x={center}
        y={35}
        textAnchor="middle"
        fill="#fda4af"
        fontSize="10.5"
        fontWeight="800"
        fontFamily="system-ui, sans-serif"
      >
        {label}
      </text>
    </g>
  );
};

interface CouplingCalloutProps {
  targetX: number;
  targetY: number;
  label: string;
  badgeX: number;
  badgeY: number;
}

const CouplingCallout: React.FC<CouplingCalloutProps> = ({
  targetX,
  targetY,
  label,
  badgeX,
  badgeY
}) => (
  <g>
    {/* Seta curva estilo imagem de referência */}
    <path
      d={`M ${targetX} ${targetY} Q ${targetX - 8} ${badgeY + 9} ${badgeX - 6} ${badgeY + 9}`}
      fill="none"
      stroke="#fbbf24"
      strokeWidth={2.2}
      strokeLinecap="round"
    />
    <polygon
      points={`${badgeX - 3},${badgeY + 9} ${badgeX - 11},${badgeY + 4} ${badgeX - 10},${badgeY + 14}`}
      fill="#fbbf24"
    />
    <rect
      x={badgeX}
      y={badgeY}
      width={label.length * 6.8 + 18}
      height={19}
      rx={5}
      fill="#451a03"
      stroke="#f59e0b"
      strokeWidth={1.3}
    />
    <text
      x={badgeX + (label.length * 6.8 + 18) / 2}
      y={badgeY + 13}
      textAnchor="middle"
      fill="#fde68a"
      fontSize="10.5"
      fontWeight="800"
      fontFamily="system-ui, sans-serif"
    >
      {label}
    </text>
  </g>
);

export const VehicleCombinationDiagram: React.FC<{
  type: VehicleDiagramType;
  compact?: boolean;
}> = ({ type, compact = false }) => {
  const spec = VEHICLE_COMBINATION_SPECS[type] || VEHICLE_COMBINATION_SPECS.carreta_simples;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950/95 p-3.5 sm:p-4 shadow-lg space-y-3 text-slate-100">
      {/* Topo descritivo do conjunto */}
      <div className="flex items-start justify-between gap-2 flex-wrap border-b border-slate-800/80 pb-2.5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500 text-slate-950">
              {spec.axlesCount} Eixos
            </span>
            <h4 className="text-xs sm:text-sm font-black text-white">
              {spec.title}
            </h4>
          </div>
          {!compact && (
            <p className="text-[11px] text-slate-400 mt-0.5">
              {spec.subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-emerald-950/90 text-emerald-300 border border-emerald-700/60">
            PBT: {spec.pbtTons.toFixed(1).replace('.', ',')} t
          </span>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-violet-950/90 text-violet-300 border border-violet-700/60">
            Líquido: {spec.netCapacityTons}
          </span>
        </div>
      </div>

      {/* Ilustração Técnica SVG (Responsiva Mobile & Desktop) */}
      <div className="w-full bg-slate-900/90 rounded-xl border border-slate-800/90 p-1.5 sm:p-2">
        <svg
          viewBox="0 0 680 175"
          className="w-full h-auto max-h-[190px] select-none"
          role="img"
          aria-label={spec.title}
        >
          <defs>
            <linearGradient id="dllogCabGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#92400e" />
            </linearGradient>
            <linearGradient id="dllogTrailerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f4f4f5" />
              <stop offset="100%" stopColor="#d4d4d8" />
            </linearGradient>
            <linearGradient id="dllogDumpGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#e4e4e7" />
              <stop offset="100%" stopColor="#a1a1aa" />
            </linearGradient>
          </defs>

          {/* Linha da Rodovia / Pista */}
          <line x1={12} y1={130} x2={668} y2={130} stroke="#52525b" strokeWidth={2} />

          {/* 1. CAMINHÃO TRUCK 3 EIXOS (6x2 RÍGIDO) */}
          {type === 'truck_3_eixos' && (
            <g>
              <TractorCab x={80} isTrucado={false} label="cabine" />
              {/* Chassi longo monobloco */}
              <rect x={134} y={103} width={250} height={8} rx={2} fill="#3f3f46" />
              {/* Carroceria fixa sobre o chassi */}
              <TrailerBox x={138} width={242} label="carroceria truck" />
              {/* Eixo duplo traseiro (17t) */}
              <Wheel cx={312} />
              <Wheel cx={340} />
              {/* Cotas de Peso por Eixo */}
              <AxleBracket xStart={108} xEnd={108} label="6t" />
              <AxleBracket xStart={312} xEnd={340} label="17t" />
              <CouplingCallout
                targetX={250}
                targetY={108}
                label="monobloco 14,0m (23t)"
                badgeX={410}
                badgeY={96}
              />
            </g>
          )}

          {/* 2. CAVALO TOCO + CARRETA 2 EIXOS (4 EIXOS - 33t) */}
          {type === 'toco_carreta_2_eixos' && (
            <g>
              <TractorCab x={55} isTrucado={false} label="cavalo toco" />
              <TrailerBox x={140} width={285} label="carreta 2 eixos" />
              <Wheel cx={365} />
              <Wheel cx={393} />
              {/* Cotas de Peso por Eixo */}
              <AxleBracket xStart={83} xEnd={83} label="6t" />
              <AxleBracket xStart={143} xEnd={143} label="10t" />
              <AxleBracket xStart={365} xEnd={393} label="17t" />
              <CouplingCallout
                targetX={148}
                targetY={102}
                label="18,60m • PBT 33,0t"
                badgeX={455}
                badgeY={95}
              />
            </g>
          )}

          {/* 3. CAVALO TOCO + CARRETA LS 3 EIXOS (5 EIXOS - 41,5t) */}
          {type === 'toco_carreta_ls' && (
            <g>
              <TractorCab x={55} isTrucado={false} label="cavalo toco" />
              <TrailerBox x={140} width={305} label="carreta LS (3 eixos)" />
              <Wheel cx={360} />
              <Wheel cx={388} />
              <Wheel cx={416} />
              {/* Cotas de Peso por Eixo (Igual à Imagem 2!) */}
              <AxleBracket xStart={83} xEnd={83} label="6t" />
              <AxleBracket xStart={143} xEnd={143} label="10t" />
              <AxleBracket xStart={360} xEnd={416} label="25,5t" />
              <CouplingCallout
                targetX={148}
                targetY={102}
                label="quinta-roda (41,5t)"
                badgeX={470}
                badgeY={95}
              />
            </g>
          )}

          {/* 4. CAVALO TOCO + CARRETA VANDERLEIA (5 EIXOS ESPAÇADOS - 46t) */}
          {type === 'toco_vanderleia' && (
            <g>
              <TractorCab x={45} isTrucado={false} label="cavalo toco" />
              <TrailerBox x={130} width={330} label="carreta vanderleia" />
              {/* 3 eixos espaçados (> 2,40m) valendo 10t cada */}
              <Wheel cx={305} />
              <Wheel cx={362} />
              <Wheel cx={419} />
              {/* Cotas de Peso por Eixo (Igual à Imagem 2!) */}
              <AxleBracket xStart={73} xEnd={73} label="6t" />
              <AxleBracket xStart={133} xEnd={133} label="10t" />
              <AxleBracket xStart={305} xEnd={305} label="10t" />
              <AxleBracket xStart={362} xEnd={362} label="10t" />
              <AxleBracket xStart={419} xEnd={419} label="10t" />
              <CouplingCallout
                targetX={362}
                targetY={118}
                label="eixos espaçados (10t cada)"
                badgeX={475}
                badgeY={95}
              />
            </g>
          )}

          {/* 5. CAVALO TRUCADO + CARRETA LS 3 EIXOS (6 EIXOS - 48,5t) */}
          {type === 'carreta_simples' && (
            <g>
              <TractorCab x={45} isTrucado={true} label="cavalo trucado" />
              <TrailerBox x={152} width={310} label="carreta LS (3 eixos)" />
              <Wheel cx={375} />
              <Wheel cx={403} />
              <Wheel cx={431} />
              {/* Cotas de Peso por Eixo (Igual à Imagem 2!) */}
              <AxleBracket xStart={73} xEnd={73} label="6t" />
              <AxleBracket xStart={133} xEnd={159} label="17t" />
              <AxleBracket xStart={375} xEnd={431} label="25,5t" />
              <CouplingCallout
                targetX={155}
                targetY={100}
                label="quinta-roda (48,5t)"
                badgeX={485}
                badgeY={95}
              />
            </g>
          )}

          {/* 6. CAVALO TRUCADO + CARRETA LS 4 EIXOS (7 EIXOS - 58,5t) */}
          {type === 'ls_4_eixos' && (
            <g>
              <TractorCab x={40} isTrucado={true} label="cavalo trucado" />
              <TrailerBox x={147} width={335} label="carreta LS 4 eixos" />
              {/* 4 eixos na carreta (1 direcional/autodirecional + 3 tandem) */}
              <Wheel cx={352} />
              <Wheel cx={392} />
              <Wheel cx={420} />
              <Wheel cx={448} />
              <AxleBracket xStart={68} xEnd={68} label="6t" />
              <AxleBracket xStart={128} xEnd={154} label="17t" />
              <AxleBracket xStart={352} xEnd={448} label="35,5t (4 eixos)" />
              <CouplingCallout
                targetX={352}
                targetY={118}
                label="4º eixo direcional (58,5t)"
                badgeX={495}
                badgeY={95}
              />
            </g>
          )}

          {/* 7. BITREM 7 EIXOS (QUINTA-RODA - 57t) */}
          {type === 'bitrem' && (
            <g>
              <TractorCab x={24} isTrucado={true} label="cavalo" />
              {/* 1ª Carreta com extensão de chassi e quinta-roda traseira */}
              <TrailerBox x={130} width={205} label="carreta" hasRearFifthWheel={true} />
              <Wheel cx={302} />
              <Wheel cx={328} />
              {/* 2ª Carreta acoplada diretamente sobre a quinta-roda da 1ª */}
              <TrailerBox x={342} width={215} label="carreta" />
              <Wheel cx={502} />
              <Wheel cx={528} />
              {/* Cotas de Peso por Eixo */}
              <AxleBracket xStart={52} xEnd={52} label="6t" />
              <AxleBracket xStart={112} xEnd={138} label="17t" />
              <AxleBracket xStart={302} xEnd={328} label="17t" />
              <AxleBracket xStart={502} xEnd={528} label="17t" />
              {/* Seta indicando Quinta-Roda igual à Imagem 1! */}
              <CouplingCallout
                targetX={348}
                targetY={98}
                label="quinta-roda"
                badgeX={375}
                badgeY={140}
              />
            </g>
          )}

          {/* 8. BITREM 9 EIXOS (QUINTA-RODA • 2 CARRETAS DE 3 EIXOS - 74t) */}
          {type === 'bitrem_9_eixos' && (
            <g>
              <TractorCab x={18} isTrucado={true} label="cavalo" />
              {/* 1ª Carreta (3 eixos) */}
              <TrailerBox x={124} width={225} label="carreta" hasRearFifthWheel={true} />
              <Wheel cx={278} />
              <Wheel cx={304} />
              <Wheel cx={330} />
              {/* 2ª Carreta (3 eixos) */}
              <TrailerBox x={358} width={245} label="carreta" />
              <Wheel cx={528} />
              <Wheel cx={554} />
              <Wheel cx={580} />
              {/* Cotas de Peso por Eixo */}
              <AxleBracket xStart={46} xEnd={46} label="6t" />
              <AxleBracket xStart={106} xEnd={132} label="17t" />
              <AxleBracket xStart={278} xEnd={330} label="25,5t" />
              <AxleBracket xStart={528} xEnd={580} label="25,5t" />
              <CouplingCallout
                targetX={364}
                targetY={98}
                label="quinta-roda"
                badgeX={388}
                badgeY={140}
              />
            </g>
          )}

          {/* 9. RODOTREM 9 EIXOS GRANELEIRO (COM DOLLY - 74t) */}
          {type === 'rodotrem' && (
            <g>
              <TractorCab x={16} isTrucado={true} label="cavalo" />
              {/* 1ª Carreta (2 eixos) */}
              <TrailerBox x={122} width={205} label="carreta" />
              <Wheel cx={275} />
              <Wheel cx={301} />

              {/* DOLLY INTERMEDIÁRIO (Cambão + 2 Eixos + Quinta-Roda) — Igual à Imagem 1! */}
              <line x1={315} y1={104} x2={366} y2={104} stroke="#f59e0b" strokeWidth={3.5} />
              <rect x={360} y={98} width={54} height={8} rx={2} fill="#f59e0b" />
              <Wheel cx={373} />
              <Wheel cx={399} />

              {/* 2ª Carreta (2 eixos) apoiada sobre o Dolly */}
              <TrailerBox x={365} width={240} label="carreta" />
              <Wheel cx={548} />
              <Wheel cx={574} />

              {/* Cotas de Peso por Eixo */}
              <AxleBracket xStart={44} xEnd={44} label="6t" />
              <AxleBracket xStart={104} xEnd={130} label="17t" />
              <AxleBracket xStart={275} xEnd={301} label="17t" />
              <AxleBracket xStart={373} xEnd={399} label="17t" />
              <AxleBracket xStart={548} xEnd={574} label="17t" />

              {/* Seta indicando DOLLY igual à Imagem 1! */}
              <CouplingCallout
                targetX={345}
                targetY={108}
                label="dolly"
                badgeX={422}
                badgeY={140}
              />
            </g>
          )}

          {/* 10. RODOCAÇAMBA 9 EIXOS BASCULANTE (COM DOLLY - 74t) */}
          {type === 'rodocacamba' && (
            <g>
              <TractorCab x={16} isTrucado={true} label="cavalo" />
              {/* 1ª Caçamba Basculante (2 eixos) */}
              <TrailerBox x={122} width={205} label="caçamba 1" isDumpBody={true} />
              <Wheel cx={275} />
              <Wheel cx={301} />

              {/* DOLLY INTERMEDIÁRIO (Cambão + 2 Eixos) */}
              <line x1={315} y1={104} x2={366} y2={104} stroke="#f59e0b" strokeWidth={3.5} />
              <rect x={360} y={98} width={54} height={8} rx={2} fill="#f59e0b" />
              <Wheel cx={373} />
              <Wheel cx={399} />

              {/* 2ª Caçamba Basculante (2 eixos) */}
              <TrailerBox x={365} width={240} label="caçamba 2" isDumpBody={true} />
              <Wheel cx={548} />
              <Wheel cx={574} />

              {/* Cotas de Peso por Eixo */}
              <AxleBracket xStart={44} xEnd={44} label="6t" />
              <AxleBracket xStart={104} xEnd={130} label="17t" />
              <AxleBracket xStart={275} xEnd={301} label="17t" />
              <AxleBracket xStart={373} xEnd={399} label="17t" />
              <AxleBracket xStart={548} xEnd={574} label="17t" />

              <CouplingCallout
                targetX={345}
                targetY={108}
                label="dolly"
                badgeX={422}
                badgeY={140}
              />
            </g>
          )}
        </svg>
      </div>

      {/* Rodapé Técnico: Soma de Eixos, Acoplamento, Placas e Comprimento */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
        <div className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-[9px] font-black uppercase tracking-wider text-amber-400 block">
            Soma de Pesos por Eixo (Balança)
          </span>
          <span className="font-bold text-white">{spec.formulaText}</span>
        </div>

        <div className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-[9px] font-black uppercase tracking-wider text-cyan-400 block">
            Acoplamento &amp; Placas no CRLV
          </span>
          <span className="font-bold text-slate-200">{spec.platesRequired}</span>
        </div>

        <div className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-[9px] font-black uppercase tracking-wider text-violet-400 block">
            Comprimento &amp; Tara Média
          </span>
          <span className="font-bold text-slate-200">
            {spec.lengthMeters} • Tara {spec.taraTons}
          </span>
        </div>
      </div>

      {!compact && (
        <div className="text-[11px] text-slate-300 bg-slate-900/60 border border-slate-800/80 rounded-xl px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <span>
            <strong className="text-amber-400">Engate Técnico:</strong> {spec.couplingNote}
          </span>
          <span className="text-slate-400">
            <strong className="text-emerald-400">Uso:</strong> {spec.applicationNote}
          </span>
        </div>
      )}
    </div>
  );
};

export const VehicleCombinationsInteractiveAtlas: React.FC<{
  compact?: boolean;
}> = ({ compact = false }) => {
  const [selectedFilter, setSelectedFilter] = React.useState<'todos' | 'simples' | 'articulados'>('todos');

  const visibleTypes = React.useMemo(() => {
    if (selectedFilter === 'simples') {
      return ['truck_3_eixos', 'toco_carreta_2_eixos', 'toco_carreta_ls', 'toco_vanderleia', 'carreta_simples', 'ls_4_eixos'] as VehicleDiagramType[];
    }
    if (selectedFilter === 'articulados') {
      return ['bitrem', 'bitrem_9_eixos', 'rodotrem', 'rodocacamba'] as VehicleDiagramType[];
    }
    return ALL_VEHICLE_DIAGRAM_TYPES;
  }, [selectedFilter]);

  return (
    <div className="space-y-4 my-4">
      <div className="p-4 rounded-2xl bg-linear-to-r from-amber-950/50 via-slate-900 to-violet-950/40 border border-amber-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
            Atlas Visual de Conjuntos Veiculares, Eixos e Balança
          </span>
          <h4 className="text-sm sm:text-base font-black text-white">
            Demonstração Visual de Cada Conjunto (Cavalo, Carreta, Quinta-Roda, Dolly e Peso por Eixo)
          </h4>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: 'todos', label: 'Todos (10)' },
            { id: 'simples', label: 'Truck, LS & Vanderleia (6)' },
            { id: 'articulados', label: 'Bitrem & Rodotrem c/ Dolly (4)' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedFilter(tab.id as any)}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                selectedFilter === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {visibleTypes.map((vType) => (
          <VehicleCombinationDiagram key={vType} type={vType} compact={compact} />
        ))}
      </div>
    </div>
  );
};
