// === ARQUIVO: src/components/charts/BarChartGrouped.tsx ===
'use client';

import React from 'react';
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

Chart.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface BarChartGroupedProps {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color: string;
  }[];
  height?: number;
}

export default function BarChartGrouped({
  labels,
  datasets,
  height = 180
}: BarChartGroupedProps) {
  const chartData = {
    labels,
    datasets: datasets.map(ds => ({
      label: ds.label,
      data: ds.data,
      backgroundColor: ds.color,
      borderRadius: 4,
      barPercentage: 0.8,
      categoryPercentage: 0.7,
    })),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(15, 15, 15, 0.9)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 12,
        titleFont: { size: 12, weight: 'bold' as const },
        bodyFont: { size: 14 },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.4)',
          font: { size: 10 },
        },
        border: {
          display: false,
        }
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.4)',
          font: { size: 10 },
        },
        border: {
          display: false,
        }
      },
    },
  };

  return (
    <div className="w-full max-w-full overflow-hidden" style={{ height: `${Math.max(170, height)}px` }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}
