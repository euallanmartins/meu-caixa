import { NextResponse } from 'next/server';
import { assertTrustedOrigin } from '@/lib/security/csrf';
import { isPlatformRole, type AppRole } from '@/lib/security/permissions';
import { sendExpoPushToCliente } from '@/lib/server/expoPush';
import { createClient, createServiceClient } from '@/lib/supabase/server';

type ProfessionalResponsePushRequest = {
  agendamento_id?: string;
  status?: 'aceito' | 'recusado';
};

type RelationName = { nome?: string | null } | Array<{ nome?: string | null }> | null;

type AppointmentRow = {
  id: string;
  barbearia_id: string;
  barbeiro_id: string | null;
  cliente_id: string | null;
  data_hora_inicio: string;
  status: string | null;
  barbearias?: RelationName;
};

type ProfileRow = {
  role: string | null;
  barbearia_id: string | null;
  barbeiro_id: string | null;
};

export const dynamic = 'force-dynamic';

function firstName(relation?: RelationName) {
  if (Array.isArray(relation)) return relation[0]?.nome || null;
  return relation?.nome || null;
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
  } catch {
    return NextResponse.json({ error: 'Origem nao autorizada.' }, { status: 403 });
  }

  const supabase = await createClient();
  const service = createServiceClient();

  if (!service) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Login necessario.' }, { status: 401 });
  }

  let body: ProfessionalResponsePushRequest;
  try {
    body = await request.json() as ProfessionalResponsePushRequest;
  } catch {
    return NextResponse.json({ error: 'Payload invalido.' }, { status: 400 });
  }

  if (!body.agendamento_id || !body.status || !['aceito', 'recusado'].includes(body.status)) {
    return NextResponse.json({ error: 'Dados da resposta ausentes.' }, { status: 400 });
  }

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('role, barbearia_id, barbeiro_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profileData) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  }

  const profile = profileData as ProfileRow;
  const { data: appointmentData, error: appointmentError } = await service
    .from('agendamentos')
    .select('id, barbearia_id, barbeiro_id, cliente_id, data_hora_inicio, status, barbearias(nome)')
    .eq('id', body.agendamento_id)
    .maybeSingle();

  if (appointmentError) {
    console.error('Erro ao buscar agendamento para push de resposta', { agendamento_id: body.agendamento_id, code: appointmentError.code });
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const appointment = appointmentData as AppointmentRow | null;
  if (!appointment) {
    return NextResponse.json({ error: 'Agendamento nao encontrado.' }, { status: 404 });
  }

  const role = profile.role as AppRole;
  const isPlatform = isPlatformRole(role);
  const sameTenant = profile.barbearia_id === appointment.barbearia_id;
  const barberAllowed = profile.role === 'barbeiro'
    ? sameTenant && profile.barbeiro_id === appointment.barbeiro_id
    : sameTenant;

  if (!isPlatform && !barberAllowed) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
  }

  if (body.status === 'aceito' && !['aceito', 'confirmado'].includes(String(appointment.status))) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  if (body.status === 'recusado' && appointment.status !== 'recusado') {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const barbeariaNome = firstName(appointment.barbearias) || 'barbearia';
  const pushPayload = body.status === 'aceito'
    ? {
        title: 'Agendamento aceito',
        body: `Seu agendamento na ${barbeariaNome} foi aceito. Te esperamos as ${formatTime(appointment.data_hora_inicio)}.`,
        data: {
          type: 'agendamento_aceito',
          agendamento_id: appointment.id,
          barbearia_id: appointment.barbearia_id,
          cliente_id: appointment.cliente_id,
          target_url: `/cliente?id=${appointment.barbearia_id}`,
        },
      }
    : {
        title: 'Agendamento recusado',
        body: 'Seu horario nao pode ser confirmado. Escolha outro horario disponivel.',
        data: {
          type: 'agendamento_recusado',
          agendamento_id: appointment.id,
          barbearia_id: appointment.barbearia_id,
          cliente_id: appointment.cliente_id,
          target_url: `/cliente?id=${appointment.barbearia_id}`,
        },
      };

  const result = await sendExpoPushToCliente({
    clienteId: appointment.cliente_id,
    barbeariaId: appointment.barbearia_id,
  }, pushPayload);

  return NextResponse.json({ ok: true, result });
}
