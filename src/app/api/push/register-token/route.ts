import { NextResponse } from 'next/server';
import { assertTrustedOrigin } from '@/lib/security/csrf';
import { createClient } from '@/lib/supabase/server';

type RegisterPushTokenRequest = {
  expo_push_token?: string;
  device_id?: string | null;
  platform?: string | null;
  barbearia_id?: string | null;
  barbeiro_id?: string | null;
  cliente_id?: string | null;
};

type RemovePushTokenRequest = {
  expo_push_token?: string;
  device_id?: string | null;
};

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
  } catch {
    return NextResponse.json({ error: 'Origem nao autorizada.' }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Login necessario.' }, { status: 401 });
  }

  let body: RegisterPushTokenRequest;
  try {
    body = await request.json() as RegisterPushTokenRequest;
  } catch {
    return NextResponse.json({ error: 'Payload invalido.' }, { status: 400 });
  }

  if (!body.expo_push_token) {
    return NextResponse.json({ error: 'Token Expo obrigatorio.' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('rpc_register_expo_push_token', {
    p_expo_push_token: body.expo_push_token,
    p_device_id: body.device_id || null,
    p_platform: body.platform || null,
    p_barbearia_id: body.barbearia_id || null,
    p_barbeiro_id: body.barbeiro_id || null,
    p_cliente_id: body.cliente_id || null,
  });

  if (error) {
    console.error('Erro ao registrar Expo push token', { user_id: user.id, code: error.code, message: error.message });
    return NextResponse.json({ error: error.message || 'Nao foi possivel ativar notificacoes.' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, result: data });
}

export async function DELETE(request: Request) {
  try {
    assertTrustedOrigin(request);
  } catch {
    return NextResponse.json({ error: 'Origem nao autorizada.' }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Login necessario.' }, { status: 401 });
  }

  let body: RemovePushTokenRequest;
  try {
    body = await request.json() as RemovePushTokenRequest;
  } catch {
    return NextResponse.json({ error: 'Payload invalido.' }, { status: 400 });
  }

  if (!body.expo_push_token && !body.device_id) {
    return NextResponse.json({ error: 'Informe o token ou dispositivo.' }, { status: 400 });
  }

  let query = supabase
    .from('push_tokens')
    .update({ is_active: false })
    .eq('user_id', user.id);

  if (body.expo_push_token) {
    query = query.eq('expo_push_token', body.expo_push_token);
  } else if (body.device_id) {
    query = query.eq('device_id', body.device_id);
  }

  const { error } = await query;

  if (error) {
    console.error('Erro ao remover Expo push token', { user_id: user.id, code: error.code });
    return NextResponse.json({ error: 'Nao foi possivel desativar este dispositivo.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
