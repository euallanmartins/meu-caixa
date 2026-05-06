'use client';

import React from 'react';

interface ChartSkeletonProps {
  height?: number;
}

export default function ChartSkeleton({ height = 220 }: ChartSkeletonProps) {
  return (
    <div
      className="relative w-full overflow-hidden bg-white/[0.03] border border-white/10"
      style={{ height: `${height}px`, borderRadius: '12px' }}
    >
      {/* FIX: Usando style tag sem jsx (styled-jsx não instalado) */}
      <style>{`
        @keyframes chartShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .chart-shimmer-inner {
          animation: chartShimmer 1.8s infinite linear;
        }
      `}</style>

      {/* Shimmer sweep */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="chart-shimmer-inner absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
            width: '200%',
            left: '-50%',
          }}
        />
      </div>

      {/* Grid line placeholders */}
      <div className="absolute inset-0 flex flex-col justify-around px-4 py-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="w-full h-px bg-white/[0.05]" />
        ))}
      </div>

      {/* Label placeholder */}
      <div className="absolute bottom-4 left-4 right-4 flex justify-between">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="h-2 w-8 bg-white/10 rounded" />
        ))}
      </div>
    </div>
  );
}
