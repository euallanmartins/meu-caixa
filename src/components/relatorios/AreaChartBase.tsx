/* eslint-disable */
import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface AreaChartBaseProps {
  data: { mes: string; valor: number; projecao?: number }[];
  color: string;
  gradientId: string;
  label: string;
  formatValue?: (v: number) => string;
  height?: number;
}

export function AreaChartBase({ 
  data, 
  color, 
  gradientId, 
  label, 
  formatValue = (v) => String(v),
  height = 240 
}: AreaChartBaseProps) {
  
  // Custom tooltips (Liquid Glass Theme)
  const CustomTooltip = ({ active, payload, label: xLabel }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-black/80 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-xl">
          <p className="text-[10px] uppercase font-black tracking-widest text-muted mb-2">{xLabel}</p>
          {payload.map((entry: any, index: number) => (
             <div key={index} className="flex flex-col">
               <span className="text-[10px] text-white/50 font-bold uppercase">{entry.name}</span>
               <span className="text-lg font-black" style={{ color: entry.color }}>
                 {formatValue(entry.value)}
               </span>
             </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="mes" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700 }}
            dy={10}
          />
          <YAxis 
            hide 
            domain={['auto', 'auto']} 
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }} />
          
          <Area 
            type="monotone" 
            dataKey="valor" 
            name={label}
            stroke={color} 
            strokeWidth={3}
            fillOpacity={1} 
            fill={`url(#${gradientId})`} 
            activeDot={{ r: 6, strokeWidth: 0, fill: color }}
          />

          {data.some(d => d.projecao) && (
            <Area 
              type="monotone" 
              dataKey="projecao" 
              name="Projeção"
              stroke={color} 
              strokeWidth={2}
              strokeDasharray="4 4"
              fill="transparent" 
              activeDot={{ r: 4, strokeWidth: 0, fill: color }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
