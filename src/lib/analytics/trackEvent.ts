import { supabase } from '@/lib/supabase';

const recentEvents = new Map<string, number>();
const DEDUPE_WINDOW_MS = 1500;

export type AnalyticsEventType =
  | 'public_profile_view'
  | 'click_agendar'
  | 'click_whatsapp'
  | 'click_instagram'
  | 'appointment_created'
  | 'appointment_accepted'
  | 'appointment_rejected'
  | 'appointment_cancelled'
  | 'appointment_completed'
  | 'checkout_completed'
  | 'review_created'
  | 'campaign_sent'
  | 'campaign_converted';

type TrackAnalyticsEventInput = {
  barbearia_id: string;
  event_type: AnalyticsEventType;
  event_source?: string | null;
  user_id?: string | null;
  cliente_id?: string | null;
  barbeiro_id?: string | null;
  agendamento_id?: string | null;
  metadata?: Record<string, unknown>;
};

function eventKey(input: TrackAnalyticsEventInput) {
  return [
    input.barbearia_id,
    input.event_type,
    input.cliente_id || '',
    input.barbeiro_id || '',
    input.agendamento_id || '',
    JSON.stringify(input.metadata || {}),
  ].join(':');
}

export async function trackAnalyticsEvent(input: TrackAnalyticsEventInput) {
  const key = eventKey(input);
  const now = Date.now();
  const last = recentEvents.get(key) || 0;

  if (now - last < DEDUPE_WINDOW_MS) {
    return { skipped: true };
  }

  recentEvents.set(key, now);

  try {
    const { data, error } = await supabase.rpc('rpc_track_analytics_event', {
      p_barbearia_id: input.barbearia_id,
      p_event_type: input.event_type,
      p_event_source: input.event_source || null,
      p_cliente_id: input.cliente_id || null,
      p_barbeiro_id: input.barbeiro_id || null,
      p_agendamento_id: input.agendamento_id || null,
      p_metadata: input.metadata || {},
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.warn('[Analytics] Falha ao registrar evento:', error);
    return { skipped: false, ok: false };
  }
}
