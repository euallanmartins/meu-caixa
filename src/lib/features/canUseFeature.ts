import 'server-only';

import { createServiceClient } from '@/lib/supabase/server';

export type FeatureKey =
  | 'premium_reports'
  | 'advanced_analytics'
  | 'marketing_automation'
  | 'push_notifications'
  | 'waitlist'
  | 'promotions'
  | 'custom_forms'
  | 'qr_code_links'
  | 'multi_barber'
  | 'unlimited_barbers'
  | 'barber_commissions'
  | 'marketplace_analytics'
  | 'ai_insights'
  | 'priority_support'
  | 'multi_unit';

export type BarbeariaSubscription = {
  barbearia_id: string;
  plan_id: string;
  status: string;
  trial_ends_at?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean | null;
};

export type PlanFeature = {
  feature_key: FeatureKey | string;
  enabled: boolean;
  limit_value?: number | null;
};

export async function getBarbeariaSubscription(barbeariaId: string): Promise<BarbeariaSubscription | null> {
  const supabase = createServiceClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('subscriptions')
    .select('barbearia_id, plan_id, status, trial_ends_at, current_period_start, current_period_end, cancel_at_period_end')
    .eq('barbearia_id', barbeariaId)
    .maybeSingle();

  if (error) {
    console.warn('Feature subscription lookup failed', { barbearia_id: barbeariaId, code: error.code });
    return null;
  }

  return (data as BarbeariaSubscription | null) ?? null;
}

export async function getPlanFeatures(planId: string): Promise<PlanFeature[]> {
  const supabase = createServiceClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('plan_features')
    .select('feature_key, enabled, limit_value')
    .eq('plan_id', planId);

  if (error) {
    console.warn('Feature plan lookup failed', { plan_id: planId, code: error.code });
    return [];
  }

  return (data || []) as PlanFeature[];
}

export async function canUseFeature(barbeariaId: string, featureKey: FeatureKey | string) {
  const subscription = await getBarbeariaSubscription(barbeariaId);
  const planId = subscription?.plan_id || 'free';
  const status = subscription?.status || 'active';

  if (!['active', 'trialing'].includes(status)) return false;

  const features = await getPlanFeatures(planId);
  return Boolean(features.find(feature => feature.feature_key === featureKey)?.enabled);
}

export async function getFeatureLimit(barbeariaId: string, featureKey: FeatureKey | string) {
  const subscription = await getBarbeariaSubscription(barbeariaId);
  const features = await getPlanFeatures(subscription?.plan_id || 'free');
  return features.find(feature => feature.feature_key === featureKey)?.limit_value ?? null;
}

export async function enforceFeatureOrThrow(barbeariaId: string, featureKey: FeatureKey | string) {
  const allowed = await canUseFeature(barbeariaId, featureKey);
  if (!allowed) {
    throw new Error('Recurso indisponivel no plano atual.');
  }
}
