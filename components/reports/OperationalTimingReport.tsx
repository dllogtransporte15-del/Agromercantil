
import React, { useMemo, useState } from 'react';
import type { Shipment } from '../../types';
import { ShipmentStatus } from '../../types';

interface OperationalTimingReportProps {
  shipments: Shipment[];
}

interface StatusTimeStat {
  status: ShipmentStatus;
  averageDurationHours: number;
  averageDurationText: string;
}

// Helper functions to calculate duration considering only business hours (08:00 to 20:00)
const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
};

const getStartOfDay = (dateObj: Date): Date => {
    const d = new Date(dateObj);
    d.setHours(0, 0, 0, 0);
    return d;
};

const getEndOfDay = (dateObj: Date): Date => {
    const d = new Date(dateObj);
    d.setHours(23, 59, 59, 999);
    return d;
};

const getDailyOverlap = (dateObj: Date, rangeStart: Date, rangeEnd: Date): number => {
  const businessStart = new Date(dateObj);
  businessStart.setHours(8, 0, 0, 0);
  
  const businessEnd = new Date(dateObj);
  businessEnd.setHours(20, 0, 0, 0);
  
  const effectiveStart = Math.max(businessStart.getTime(), rangeStart.getTime());
  const effectiveEnd = Math.min(businessEnd.getTime(), rangeEnd.getTime());
  
  return Math.max(0, effectiveEnd - effectiveStart);
};

const calculateBusinessDuration = (startTimeMs: number, endTimeMs: number): number => {
  if (endTimeMs <= startTimeMs) return 0;
  
  let totalBusinessMs = 0;
  const startObj = new Date(startTimeMs);
  const endObj = new Date(endTimeMs);
  
  if (isSameDay(startObj, endObj)) {
    return getDailyOverlap(startObj, startObj, endObj);
  }
  
  totalBusinessMs += getDailyOverlap(startObj, startObj, getEndOfDay(startObj));
  
  let currentDay = new Date(startObj);
  currentDay.setDate(currentDay.getDate() + 1);
  currentDay.setHours(0, 0, 0, 0);
  
  while (!isSameDay(currentDay, endObj)) {
    totalBusinessMs += getDailyOverlap(currentDay, getStartOfDay(currentDay), getEndOfDay(currentDay));
    currentDay.setDate(currentDay.getDate() + 1);
  }
  
  totalBusinessMs += getDailyOverlap(endObj, getStartOfDay(endObj), endObj);
  
  return totalBusinessMs;
};

// Helper function to format milliseconds into a readable string
const formatDuration = (ms: number): string => {
  if (isNaN(ms) || ms < 0) return 'N/A';

  const seconds = ms / 1000;
  const minutes = seconds / 60;
  const hours = minutes / 60;
  const days = hours / 24;

  if (days >= 1) return `${days.toFixed(1)} dias`;
  if (hours >= 1) return `${hours.toFixed(1)} horas`;
  if (minutes >= 1) return `${minutes.toFixed(1)} min`;
  return `${seconds.toFixed(0)} seg`;
};

const OperationalTimingReport: React.FC<OperationalTimingReportProps> = ({ shipments }) => {
  const timingStats = useMemo<StatusTimeStat[]>(() => {
    const stats: { [key in ShipmentStatus]?: { totalDuration: number; count: number } } = {};

    shipments.forEach(shipment => {
      // Ignore shipments with incomplete history
      if (!shipment.statusHistory || shipment.statusHistory.length < 2) {
        return;
      }

      for (let i = 0; i < shipment.statusHistory.length - 1; i++) {
        const currentEntry = shipment.statusHistory[i];
        const nextEntry = shipment.statusHistory[i+1];

        const startTime = new Date(currentEntry.timestamp).getTime();
        const endTime = new Date(nextEntry.timestamp).getTime();
        const duration = calculateBusinessDuration(startTime, endTime);

        if (!stats[currentEntry.status]) {
          stats[currentEntry.status] = { totalDuration: 0, count: 0 };
        }
        stats[currentEntry.status]!.totalDuration += duration;
        stats[currentEntry.status]!.count += 1;
      }
    });
    
    return Object.entries(stats).map(([status, data]) => {
      const averageDurationMs = data.totalDuration / data.count;
      return {
        status: status as ShipmentStatus,
        averageDurationHours: averageDurationMs / (1000 * 60 * 60),
        averageDurationText: formatDuration(averageDurationMs),
      };
    }).sort((a,b) => {
        // Sort by the canonical order of statuses
        const orderA = Object.values(ShipmentStatus).indexOf(a.status);
        const orderB = Object.values(ShipmentStatus).indexOf(b.status);
        return orderA - orderB;
    });

  }, [shipments]);

  const maxDurationHours = useMemo(() => {
      return Math.max(...timingStats.map(s => s.averageDurationHours), 0) || 1;
  }, [timingStats]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Tempo Médio por Status</h2>
      </div>
      
      <div className="bg-white dark:bg-gray-800/90 p-6 rounded-xl shadow-sm border border-gray-200/80 dark:border-gray-700/80">
        {timingStats.length > 0 ? (
          <div className="space-y-6">
            {timingStats.map(stat => (
              <div key={stat.status}>
                <div className="flex justify-between items-center mb-1.5 text-sm">
                  <span className="font-semibold text-gray-700 dark:text-gray-200">{stat.status}</span>
                  <span className="font-black text-gray-900 dark:text-white">{stat.averageDurationText}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3.5 dark:bg-gray-700/60 overflow-hidden border border-gray-200/40 dark:border-gray-600/40">
                  <div
                    className="bg-primary h-3.5 rounded-full transition-all duration-500 ease-out shadow-sm"
                    style={{ width: `${(stat.averageDurationHours / maxDurationHours) * 100}%` }}
                    title={`Média: ${stat.averageDurationText}`}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 dark:text-gray-300 py-10 font-medium">
            Nenhum dado de tempo de operação encontrado para o período selecionado.
          </div>
        )}
      </div>
    </div>
  );
};

export default OperationalTimingReport;
