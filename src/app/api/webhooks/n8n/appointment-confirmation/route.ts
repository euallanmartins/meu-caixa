import { NextResponse } from 'next/server';
import { assertWebhookBearer } from '@/lib/security/webhook';
import { createServiceClient } from '@/lib/supabase/server';

type ConfirmationPayload = {
  agendamento_id?: string;
  acao?: 'confirmar_cliente' | 'cancelar_cliente';
};

const FINAL_STATUSES = new Set(['concluido', 'realizado', 'atendido', 'recusado', 'cancelado']);

export async function POST(request: Request) {
  try {
    assertWebhookBearer(request);
  } catch {
    return NextResponse.json({ error: 'Webhook nao autorizado.' }, { status: 401 });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Service client nao configurado.' }, { status: 503 });
  }

  let payload: ConfirmationPayload;
  try {
    payload = await request.json() as ConfirmationPayload;
  } catch {
    return NextResponse.json({ error: 'Payload invalido.' }, { status: 400 });
  }

  if (!payload.agendamento_id || !payload.acao) {
    return NextResponse.json({ error: 'Campos obrigatorios ausentes.' }, { status: 400 });
  }

  if (!['confirmar_cliente', 'cancelar_cliente'].includes(payload.acao)) {
    return NextResponse.json({ error: 'Acao invalida.' }, { status: 400 });
  }

  const { data: agendamento, error: fetchError } = await supabase
    .from('agendamentos')
    .select('id, status')
    .eq('id', payload.agendamento_id)
    .maybeSingle();

  if (fetchError) {
    console.error('Erro ao buscar agendamento via n8n', { agendamento_id: payload.agendamento_id, code: fetchError.code });
    return NextResponse.json({ error: 'Nao foi possivel processar agora.' }, { status: 500 });
  }

  if (!agendamento) {
    return NextResponse.json({ error: 'Agendamento nao encontrado.' }, { status: 404 });
  }

  if (payload.acao === 'confirmar_cliente') {
    const { error } = await supabase
      .from('agendamentos')
      .update({
        cliente_confirmou: true,
        cliente_confirmou_em: new Date().toISOString(),
        ultimo_webhook_evento: 'appointment_client_confirmed',
      })
      .eq('id', payload.agendamento_id);

    if (error) {
      console.error('Erro ao confirmar cliente via n8n', { agendamento_id: payload.agendamento_id, code: error.code });
      return NextResponse.json({ error: 'Nao foi possivel processar agora.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  if (FINAL_STATUSES.has(String(agendamento.status))) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const { error } = await supabase
    .from('agendamentos')
    .update({
      status: 'cancelado',
      cancelado_em: new Date().toISOString(),
      cancelamento_origem: 'n8n',
      ultimo_webhook_evento: 'appointment_cancelled_by_client',
    })
    .eq('id', payload.agendamento_id);

  if (error) {
    console.error('Erro ao cancelar agendamento via n8n', { agendamento_id: payload.agendamento_id, code: error.code });
    return NextResponse.json({ error: 'Nao foi possivel processar agora.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
