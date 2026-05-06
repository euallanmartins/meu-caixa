import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string | number;
  variation?: {
    percent: number;
    direction: 'up' | 'down';
  };
  subMetrics?: Array<{
    label: string;
    value: string | number;
    highlight?: boolean;
  }>;
}

export function KpiCard({ title, value, variation, subMetrics }: KpiCardProps) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 relative overflow-hidden group hover:border-white/20 transition-all">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h4 className="text-[10px] font-black uppercase tracking-widest text-muted">{title}</h4>
          <div className="flex items-center gap-3 mt-1">
             <span className="text-3xl font-black text-white">{value}</span>
             {variation && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black border ${
                  variation.direction === 'up' 
                    ? 'bg-[#D6B47A]/10 text-[#D6B47A] border-[#D6B47A]/20' 
                    : 'bg-red-500/10 text-red-500 border-red-500/20'
                }`}>
                   {variation.direction === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                   {variation.percent}%
                </div>
             )}
          </div>
        </div>
      </div>

      {subMetrics && subMetrics.length > 0 && (
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 pt-4 border-t border-white/5">
            {subMetrics.map((sm, idx) => (
               <div key={idx} className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-black text-white/30 uppercase tracking-widest truncate">{sm.label}</span>
                  <span className={`text-[13px] font-black ${sm.highlight ? 'text-accent drop-shadow-[0_0_8px_rgba(214,180,122,0.5)]' : 'text-white'}`}>
                    {sm.value}
                  </span>
               </div>
            ))}
         </div>
      )}
    </div>
  );
}
