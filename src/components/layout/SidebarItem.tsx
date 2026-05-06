/* eslint-disable */
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as LucideIcons from 'lucide-react';
import { SidebarBadge } from './SidebarBadge';

interface SidebarItemProps {
  label: string;
  icon: keyof typeof LucideIcons;
  href: string;
  testId: string;
  badge?: { label: string; variant?: 'accent' | 'blue' | 'red' };
  isCollapsed?: boolean;
}

export function SidebarItem({ label, icon, href, testId, badge, isCollapsed }: SidebarItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href;
  const Icon = LucideIcons[icon] as LucideIcons.LucideIcon;

  return (
    <Link
      href={href}
      data-testid={testId}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      className={`
        group relative flex items-center gap-3 px-4 py-3.5 mx-2 rounded-2xl transition-all duration-300
        ${isActive 
          ? 'bg-[#D6B47A]/10 text-[#D6B47A] border-l-2 border-[#D6B47A] shadow-[inset_0_0_20px_rgba(214,180,122,0.05)]' 
          : 'text-white/50 hover:bg-white/5 hover:text-white'
        }
      `}
    >
      <Icon 
        size={20} 
        className={`shrink-0 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'animate-pulse' : ''}`} 
      />
      
      {!isCollapsed && (
        <div className="flex-1 flex items-center justify-between overflow-hidden">
          <span className="text-xs font-black uppercase tracking-widest truncate">
            {label}
          </span>
          {badge && <SidebarBadge label={badge.label} variant={badge.variant as any} />}
        </div>
      )}

      {/* Glow Effect on Hover/Active */}
      {isActive && (
        <div className="absolute inset-0 rounded-2xl shadow-[0_0_15px_rgba(214,180,122,0.1)] pointer-events-none" />
      )}

      {/* Tooltip for Collapsed State */}
      {isCollapsed && (
        <div className="absolute left-full ml-4 px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all pointer-events-none z-50">
          {label}
        </div>
      )}
    </Link>
  );
}
