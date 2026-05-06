/* eslint-disable */
export const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

export function appointmentDate(item: any) {
  return item?.data_hora_inicio || item?.data_hora || item?.data || item?.created_at;
}

export function appointmentValue(item: any) {
  return Number(item?.valor_estimado ?? item?.preco_total ?? item?.servicos?.valor ?? item?.valor_total ?? 0);
}

export function appointmentService(item: any) {
  return item?.servicos?.nome || item?.servico_nome || item?.servico || 'Servico';
}

export function appointmentClient(item: any) {
  return item?.clientes?.nome || item?.cliente_nome || 'Cliente avulso';
}

export function appointmentBarber(item: any) {
  return item?.barbeiros?.nome || item?.profissionais?.nome || item?.barbeiro_nome || '-';
}

export function isDoneStatus(status?: string) {
  return ['concluido', 'realizado', 'atendido', 'finalizado'].includes(String(status || '').toLowerCase());
}

export function isPendingStatus(status?: string) {
  return ['pendente', 'agendado', 'confirmado'].includes(String(status || '').toLowerCase());
}

export function isCancelStatus(status?: string) {
  return ['cancelado', 'cancelada'].includes(String(status || '').toLowerCase());
}

export function isNoShowStatus(status?: string) {
  return ['nao_compareceu', 'ausente', 'no_show'].includes(String(status || '').toLowerCase());
}

export function statusLabel(status?: string) {
  const normalized = String(status || '').toLowerCase();
  if (isDoneStatus(normalized)) return 'Concluido';
  if (isCancelStatus(normalized)) return 'Cancelado';
  if (isNoShowStatus(normalized)) return 'Nao compareceu';
  if (normalized === 'pendente') return 'Pendente';
  if (normalized === 'confirmado' || normalized === 'agendado') return 'Confirmado';
  return status || '-';
}

export function dayKey(dateLike: string | Date) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

export function dailyCountSeries(items: any[], valueGetter: (item: any) => number = () => 1) {
  const map = new Map<string, number>();
  items.forEach(item => {
    const date = appointmentDate(item);
    if (!date) return;
    const key = dayKey(date);
    map.set(key, (map.get(key) || 0) + valueGetter(item));
  });
  return Array.from(map.entries()).map(([mes, valor]) => ({ mes, valor }));
}

export function safePercent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}
