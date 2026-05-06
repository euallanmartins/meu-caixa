import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface LinkItem {
  label: string;
  href: string;
}

interface RelatoriosSidebarProps {
  title?: string;
  links: LinkItem[];
}

export function RelatoriosSidebar({ title = 'Relatórios', links }: RelatoriosSidebarProps) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 h-fit">
       <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6">{title}</h3>
       
       <div className="flex flex-col">
          {links.map((link, idx) => (
             <Link 
                key={idx} 
                href={link.href}
                className="group flex items-center justify-between py-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors px-2 -mx-2 rounded-xl"
             >
                <span className="text-xs font-bold text-white/70 group-hover:text-white transition-colors">{link.label}</span>
                <ChevronRight size={16} className="text-white/20 group-hover:text-accent transition-all group-hover:translate-x-1" />
             </Link>
          ))}
       </div>
    </div>
  );
}
