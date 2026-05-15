'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type Role = 'platform_admin' | 'super_admin' | 'owner' | 'admin' | 'proprietario' | 'barbeiro' | 'funcionario' | 'gerente' | 'free' | null;

const PLATFORM_ROLES = new Set(['platform_admin', 'super_admin']);
const PROFESSIONAL_ROLES = new Set(['owner', 'admin', 'proprietario', 'barbeiro', 'funcionario', 'gerente', ...PLATFORM_ROLES]);
const ADMIN_ROLES = new Set(['owner', 'admin', 'proprietario', 'gerente', ...PLATFORM_ROLES]);

// Cache de sessão — evita múltiplas queries durante a mesma sessão ativa
let _cache: { value: Role; uid: string; barbeariaId: string | null; barbeiroId: string | null } | null = null;


export function useUserRole() {
  const [role, setRole] = useState<Role>(null);
  const [barbeariaId, setBarbeariaId] = useState<string | null>(null);
  const [barbeiroId, setBarbeiroId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function fetchRole() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        if (!user) {
          if (active) { setRole(null); setBarbeariaId(null); setBarbeiroId(null); setLoading(false); }
          return;
        }

        // Verificar cache para evitar requisiçoes repetidas
        if (_cache && _cache.uid === user.id) {
          if (active) { setRole(_cache.value); setBarbeariaId(_cache.barbeariaId); setBarbeiroId(_cache.barbeiroId); setLoading(false); }
          return;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role, barbearia_id, barbeiro_id')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        const profileRole = (profile?.role as Role) ?? null;
        const resolvedRole = profileRole && (
          PLATFORM_ROLES.has(profileRole) || (profile?.barbearia_id && PROFESSIONAL_ROLES.has(profileRole))
        )
          ? profileRole
          : null;

        // Salvar no cache da sessão
        _cache = { value: resolvedRole, uid: user.id, barbeariaId: profile?.barbearia_id ?? null, barbeiroId: profile?.barbeiro_id ?? null };

        if (active) {
          setRole(resolvedRole);
          setBarbeariaId(profile?.barbearia_id ?? null);
          setBarbeiroId(profile?.barbeiro_id ?? null);
          setLoading(false);
        }
      } catch (err) {
        console.warn('[useUserRole] Nao foi possivel buscar role pelo navegador; usando menu basico.', {
          message: err instanceof Error ? err.message : String(err || ''),
        });
        if (active) {
          setRole(null);
          setBarbeariaId(null);
          setBarbeiroId(null);
          setLoading(false);
        }
      }
    }

    fetchRole();

    // Limpar cache ao fazer logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        _cache = null;
        if (active) { setRole(null); setBarbeariaId(null); setBarbeiroId(null); setLoading(false); }
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    role,
    barbeariaId,
    barbeiroId,
    isAdmin: Boolean(role && ADMIN_ROLES.has(role)),
    isPlatformAdmin: Boolean(role && PLATFORM_ROLES.has(role)),
    isBarbeiro: role === 'barbeiro',
    loading,
  };
}
