export interface StatusBarProps {
  items: {
    status: string;
    percent: number;
    color: string;
  }[];
}

export function HighlightsBar({ items }: StatusBarProps) {
  return (
    <div className="w-full flex h-4 rounded-full overflow-hidden bg-white/5 border border-white/10 gap-0.5">
       {items.map((item, idx) => (
          <div 
             key={idx} 
             title={`${item.status}: ${item.percent}%`}
             style={{ 
               width: `${item.percent}%`, 
               backgroundColor: item.color 
             }} 
             className="h-full transition-all hover:opacity-80 cursor-pointer"
          />
       ))}
    </div>
  );
}
