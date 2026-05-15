/* eslint-disable */
import {
  hourLabel,
  calculateTopFromTime,
  calculateHeightFromTimes,
  calculateTop,
  calculateHeight,
  AgendaAppointmentCard,
  BlockCard,
  formatTime
} from './ScheduleView';

interface AgendaMobileProfissionalProps {
  barber: any;
  hours: number[];
  startHour: number;
  appointments: any[];
  bloqueios: any[];
  onSelectAppointment: (appointment: any) => void;
  onSelectBlock: (block: any) => void;
  onSlotClick: (event: React.MouseEvent, barberId: string, hour: number) => void;
}

const HOUR_HEIGHT = 104;

export function AgendaMobileProfissional({
  barber,
  hours,
  startHour,
  appointments,
  bloqueios,
  onSelectAppointment,
  onSelectBlock,
  onSlotClick,
}: AgendaMobileProfissionalProps) {
  if (!barber) return null;

  const gridHeight = Math.max(1, hours.length) * HOUR_HEIGHT;
  const blocks = bloqueios.filter(block => !block.barbeiro_id || block.barbeiro_id === barber.id);

  // Calcula próximo atendimento
  const now = new Date();
  const upcomingAppointments = appointments
    .filter(appointment => new Date(appointment.data_hora_inicio).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.data_hora_inicio).getTime() - new Date(b.data_hora_inicio).getTime());
  
  const nextAppointment = upcomingAppointments[0];

  return (
    <div className="space-y-6">
      {/* Resumo e Perfil */}
      <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#151515] to-[#0a0a0a] p-6 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[1.25rem] border-2 border-[#D6B47A]/30 bg-[#D6B47A]/10 text-xl font-black text-[#D6B47A]">
            {barber.foto_url ? (
              <img src={barber.foto_url} alt="" className="h-full w-full object-cover" />
            ) : (
              String(barber.nome || 'B').slice(0, 2).toUpperCase()
            )}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#D6B47A]">Sua agenda</p>
            <h2 className="mt-1 text-2xl font-black text-white">{barber.nome}</h2>
            <div className="mt-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#D6B47A] shadow-[0_0_12px_rgba(214,180,122,0.8)]" />
              <span className="text-xs font-bold text-white/60">Disponível para agendamentos</span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-6">
          <div className="rounded-2xl bg-white/[0.03] p-4 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/40">Hoje</p>
            <p className="mt-1 text-2xl font-black text-white">{appointments.length}</p>
            <p className="text-xs font-bold text-white/40">Atendimentos</p>
          </div>
          <div className="rounded-2xl bg-[#D6B47A]/[0.05] p-4 text-center border border-[#D6B47A]/10">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#D6B47A]/60">Próximo</p>
            {nextAppointment ? (
              <>
                <p className="mt-1 text-xl font-black text-[#D6B47A]">{formatTime(nextAppointment.data_hora_inicio)}</p>
                <p className="truncate text-xs font-bold text-white/60">{nextAppointment.clientes?.nome || 'Cliente'}</p>
              </>
            ) : (
              <p className="mt-2 text-sm font-bold text-white/40">Nenhum</p>
            )}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-3xl border border-white/10 bg-[#0d0d0d] shadow-2xl overflow-hidden">
        <div className="flex items-center border-b border-white/10 bg-[#111]/95 px-5 py-4">
          <h3 className="text-sm font-black uppercase tracking-[0.14em] text-white/70">Linha do Tempo</h3>
        </div>

        <div className="flex bg-[#0f0f0f]">
          <div className="w-[60px] border-r border-white/10 shrink-0 bg-[#0f0f0f]">
            {hours.map(hour => (
              <div key={hour} className="flex items-start justify-center border-b border-white/[0.055] pt-3 text-[11px] font-black text-white/38" style={{ height: HOUR_HEIGHT }}>
                {hourLabel(hour)}
              </div>
            ))}
          </div>

          <div className="relative flex-1" style={{ height: gridHeight }}>
            {hours.map(hour => (
              <button
                key={`slot-${hour}`}
                type="button"
                onClick={(event) => onSlotClick(event, barber.id, hour)}
                className="group block w-full border-b border-white/[0.055] bg-[#0c0c0c] text-left transition-all hover:bg-white/[0.04]"
                style={{ height: HOUR_HEIGHT }}
                aria-label={`Bloquear horário às ${hourLabel(hour)}`}
              >
                <span className="ml-3 mt-3 inline-flex rounded-full border border-dashed border-white/8 px-2 py-1 text-[10px] font-bold text-white/0 transition-all group-active:border-white/20 group-active:text-white/40">
                  Bloquear
                </span>
              </button>
            ))}

            {blocks.map(block => (
              <BlockCard
                key={block.id}
                block={block}
                top={block.tipo === 'dia' ? 6 : calculateTopFromTime(block.hora_inicio || hourLabel(startHour), startHour)}
                height={block.tipo === 'dia' ? Math.max(72, gridHeight - 12) : calculateHeightFromTimes(block.hora_inicio || hourLabel(startHour), block.hora_fim || hourLabel(startHour + 1))}
                onSelect={() => onSelectBlock(block)}
                onDragStart={() => {}}
                onDragEnd={() => {}}
                canDrag={false}
              />
            ))}

            {appointments.map(appointment => (
              <AgendaAppointmentCard
                key={appointment.id}
                appointment={appointment}
                top={calculateTop(appointment.data_hora_inicio, startHour)}
                height={calculateHeight(appointment.data_hora_inicio, appointment.data_hora_fim)}
                onSelect={() => onSelectAppointment(appointment)}
                onDragStart={() => {}}
                onDragEnd={() => {}}
                canDrag={false}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
