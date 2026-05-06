'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Role = 'admin' | 'barbeiro' | 'free' | null;

// Cache de sessão — evita múltiplas queries durante a mesma sessão ativa
let _cache: { value: Role; uid: string } | null = null;


export function useUserRole() {
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function fetchRole() {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          if (active) { setRole(null); setLoading(false); }
          return;
        }

        // Verificar cache para evitar requisiçoes repetidas
        if (_cache && _cache.uid === user.id) {
          if (active) { setRole(_cache.value); setLoading(false); }
          return;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        const resolvedRole = (profile?.role as Role) ?? 'barbeiro';

        // Salvar no cache da sessão
        _cache = { value: resolvedRole, uid: user.id };

        if (active) {
          setRole(resolvedRole);
          setLoading(false);
        }
      } catch (err) {
        console.error('[useUserRole] Erro ao buscar role:', err);
        if (active) { setRole(null); setLoading(false); }
      }
    }

    fetchRole();

    // Limpar cache ao fazer logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        _cache = null;
        if (active) { setRole(null); setLoading(false); }
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    role,
    isAdmin: role === 'admin',
    isBarbeiro: role === 'barbeiro',
    loading,
  };
}
