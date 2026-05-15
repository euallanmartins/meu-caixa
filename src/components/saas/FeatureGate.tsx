'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { UpsellCard } from './UpsellCard';

type FeatureGateProps = {
  barbeariaId?: string | null;
  featureKey: string;
  children: React.ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
  requiredPlan?: 'STARTER' | 'PRO' | 'PREMIUM';
  softFailOpen?: boolean;
};

type FeatureResult = {
  enabled?: boolean;
  plan_id?: string;
  status?: string;
  limit_value?: number | null;
};

export function FeatureGate({
  barbeariaId,
  featureKey,
  children,
  fallbackTitle,
  fallbackDescription,
  requiredPlan = 'PRO',
  softFailOpen = true,
}: FeatureGateProps) {
  const [loading, setLoading] = useState(Boolean(barbeariaId));
  const [allowed, setAllowed] = useState(softFailOpen);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!barbeariaId) {
        setAllowed(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('rpc_can_use_feature', {
          p_barbearia_id: barbeariaId,
          p_feature_key: featureKey,
        });

        if (error) throw error;
        if (!active) return;
        setAllowed(Boolean((data as FeatureResult | null)?.enabled));
      } catch (error) {
        console.warn('[FeatureGate] Falha ao verificar recurso:', { featureKey, error });
        if (active) setAllowed(softFailOpen);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [barbeariaId, featureKey, softFailOpen]);

  if (loading) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.025]">
        <Loader2 className="h-7 w-7 animate-spin text-[#D6B47A]" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <UpsellCard
        title={fallbackTitle}
        description={fallbackDescription}
        requiredPlan={requiredPlan}
      />
    );
  }

  return <>{children}</>;
}
