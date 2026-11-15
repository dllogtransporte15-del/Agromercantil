
import React from 'react';

interface CancellationReasonData {
  label: string;
  value: number;
  color: string;
}

interface CancellationReasonChartProps {
  data: CancellationReasonData[];
}

const COLORS = [
  'bg-amber-500',
  'bg-emerald-500',
  'bg-orange-500',
  'bg-purple-500',
  'bg-red-500',
  'bg-yellow-500',
  'bg-pink-500',
  'bg-amber-600',
];

const STROKE_COLORS: Record<string, string> = {
  'bg-amber-500': 'stroke-amber-500',
  'bg-emerald-500': 'stroke-emerald-500',
  'bg-orange-500': 'stroke-orange-500',
  'bg-purple-500': 'stroke-purple-500',
  'bg-red-500': 'stroke-red-500',
  'bg-yellow-500': 'stroke-yellow-500',
  'bg-pink-500': 'stroke-pink-500',
  'bg-amber-600': 'stroke-amber-600',
};

const CancellationReasonChart: React.FC<CancellationReasonChartProps> = ({ data }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  if (total === 0) return null;

  return (
    <div className="flex items-center bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
      <div className="relative w-20 h-20 mr-4">
        <svg className="w-full h-full" viewBox="-50 -50 100 100" transform="rotate(-90)">
          <circle
            className="stroke-gray-200 dark:stroke-gray-700"
            r={radius}
            cx="0"
            cy="0"
            fill="transparent"
            strokeWidth="15"
          />
          {data.map((item, index) => {
            if (item.value === 0) return null;
            const percentage = (item.value / total) * 100;
            const dash = (percentage * circumference) / 100;
            const strokeColor = STROKE_COLORS[item.color] || 'stroke-gray-500';
            const currentOffset = offset;
            offset += dash;

            return (
              <circle
                key={index}
                className={`${strokeColor} transition-all duration-500`}
                r={radius}
                cx="0"
                cy="0"
                fill="transparent"
                strokeWidth="15"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-currentOffset}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{total}</span>
        </div>
      </div>
      <div className="flex flex-col space-y-1">
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Motivos de Cancelamento</h4>
        <div className="grid grid-cols-1 gap-x-4 gap-y-1">
          {data.map((item, index) => (
            <div key={index} className="flex items-center text-[10px]">
              <span className={`w-2 h-2 rounded-full mr-1.5 ${item.color}`}></span>
              <span className="text-gray-600 dark:text-gray-400 font-medium truncate max-w-[120px]" title={item.label}>
                {item.label}:
              </span>
              <span className="ml-1 text-gray-900 dark:text-gray-200 font-bold">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CancellationReasonChart;
