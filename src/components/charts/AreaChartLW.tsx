/* eslint-disable */
// === ARQUIVO: src/components/charts/AreaChartLW.tsx ===
'use client';

import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, LineStyle, AreaSeries, LineSeries } from 'lightweight-charts';

interface AreaChartLWProps {
  data: { time: string; value: number }[];
  projectionData?: { time: string; value: number }[];
  color: string;
  height?: number;
  formatValue?: (v: number) => string;
}

export default function AreaChartLW({
  data,
  projectionData,
  color,
  height = 220,
  formatValue = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}: AreaChartLWProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(255, 255, 255, 0.5)',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: height,
      timeScale: {
        borderVisible: false,
      },
      rightPriceScale: {
        borderVisible: false,
      },
      crosshair: {
        vertLine: {
          color: 'rgba(255, 255, 255, 0.2)',
          style: LineStyle.Solid,
        },
        horzLine: {
          color: 'rgba(255, 255, 255, 0.2)',
          style: LineStyle.Solid,
        },
      },
    });

    // API v5: addSeries com tipo específico
    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: color,
      topColor: `${color}4D`,
      bottomColor: 'transparent',
      lineWidth: 2,
    });

    areaSeries.setData(data);

    if (projectionData && projectionData.length > 0) {
      const lineSeries = chart.addSeries(LineSeries, {
        color: 'rgba(255, 255, 255, 0.3)',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
      });
      lineSeries.setData(projectionData);
    }

    // Tooltip
    chart.subscribeCrosshairMove((param) => {
      if (
        !param.point ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > chartContainerRef.current!.clientWidth ||
        param.point.y < 0 ||
        param.point.y > height
      ) {
        if (tooltipRef.current) tooltipRef.current.style.display = 'none';
        return;
      }

      if (tooltipRef.current) {
        const priceData = param.seriesData.get(areaSeries) as any;
        if (!priceData) return;

        const coordinate = areaSeries.priceToCoordinate(priceData.value);
        if (coordinate === null) return;

        tooltipRef.current.style.display = 'block';
        tooltipRef.current.innerHTML = `
          <div style="font-size:10px;font-weight:900;color:rgba(255,255,255,0.5);margin-bottom:4px;text-transform:uppercase">${param.time}</div>
          <div style="font-size:14px;font-weight:700;color:#fff">${formatValue(priceData.value)}</div>
        `;
        tooltipRef.current.style.left = `${param.point.x + 16}px`;
        tooltipRef.current.style.top = `${coordinate - 44}px`;
      }
    });

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, projectionData, color, height, formatValue]);

  return (
    <div className="relative w-full overflow-hidden" ref={chartContainerRef}>
      <div
        ref={tooltipRef}
        className="absolute z-10 hidden p-3 pointer-events-none rounded-xl"
        style={{
          backgroundColor: 'rgba(15, 15, 15, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(8px)',
        }}
      />
    </div>
  );
}
