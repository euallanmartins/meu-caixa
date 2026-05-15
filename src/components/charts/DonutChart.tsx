/* eslint-disable */
'use client';

import React from 'react';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

// FIX: Registro feito de forma lazy/segura fora do SSR
if (typeof window !== 'undefined') {
  Chart.register(ArcElement, Tooltip, Legend);
}

interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
  height?: number;
  centerLabel?: string;
  formatValue?: (v: number) => string;
}

export default function DonutChart({
  data,
  height = 200,
  centerLabel,
  formatValue = (v) => `${v}%`,
}: DonutChartProps) {
  const chartData = {
    labels: data.map(d => d.label),
    datasets: [
      {
        data: data.map(d => d.value),
        backgroundColor: data.map(d => d.color),
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 15, 15, 0.9)',
        titleFont: { size: 12, weight: 'bold' as const },
        bodyFont: { size: 14 },
        padding: 12,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        displayColors: true,
        cornerRadius: 12,
        callbacks: {
          label: (context: any) =>
            ` ${context.label}: ${formatValue(context.raw)}`,
        },
      },
    },
    animation: { duration: 400 },
  };

  return (
    <div
      className="relative flex w-full max-w-full items-center justify-center overflow-hidden"
      style={{ height: `${Math.max(170, height)}px` }}
    >
      <Doughnut data={chartData} options={options} />

      {centerLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
            {centerLabel}
          </span>
        </div>
      )}
    </div>
  );
}
