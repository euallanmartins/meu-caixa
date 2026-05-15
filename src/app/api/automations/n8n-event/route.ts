import { NextResponse } from 'next/server';
import { notifyN8nEvent } from '@/lib/security/webhook';
import { createClient } from '@/lib/supabase/server';
import { hasPermission, isPlatformRole, type AppPermission } from '@/lib/security/permissions';
import { canUseFeature } from '@/lib/features/canUseFeature';

type EventRequest = {
  eventName?: string;
  barbearia_id?: string | null;
  permission?: AppPermission;
  payload?: Record<string, unknown>;
};

const EVENT_FEATURES: Record<string, string> = {
  marketing_campaign_created: 'marketing_automation',
  promotion_created: 'promotions',
  waitlist_available_slot: 'waitlist',
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Login necessario.' }, { status: 401 });
  }

  let body: EventRequest;
  try {
    body = await request.json() as EventRequest;
  } catch {
    return NextResponse.json({ error: 'Payload invalido.' }, { status: 400 });
  }

  if (!body.eventName || !body.payload) {
    return NextResponse.json({ error: 'Evento invalido.' }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, barbearia_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile?.role) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  }

  const permission = body.permission || 'marketing.manage';
  const sameTenant = body.barbearia_id && profile.barbearia_id === body.barbearia_id;
  const allowed = isPlatformRole(profile.role) || (sameTenant && hasPermission(profile.role, permission));

  if (!allowed) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  }

  const requiredFeature = EVENT_FEATURES[body.eventName];
  const targetBarbeariaId = body.barbearia_id || profile.barbearia_id || null;
  if (requiredFeature && targetBarbeariaId && !(await canUseFeature(targetBarbeariaId, requiredFeature))) {
    return NextResponse.json({ error: 'Recurso indisponivel no plano atual.' }, { status: 402 });
  }

  const result = await notifyN8nEvent(body.eventName, {
    ...body.payload,
    barbearia_id: body.barbearia_id || profile.barbearia_id || null,
  });

  return NextResponse.json({ ok: result.ok, skipped: result.skipped ?? false, status: result.status ?? null });
}
