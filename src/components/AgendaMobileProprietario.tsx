/* eslint-disable */
import { hourLabel, calculateTopFromTime, calculateHeightFromTimes, calculateTop, calculateHeight, AgendaAppointmentCard, BlockCard } from './ScheduleView';

interface AgendaMobileProprietarioProps {
  barbers: any[];
  hours: number[];
  startHour: number;
  appointmentsByBarber: Record<string, any[]>;
  bloqueios: any[];
  onSelectAppointment: (appointment: any) => void;
  onSelectBlock: (block: any) => void;
  onSlotClick: (event: React.MouseEvent, barberId: string, hour: number) => void;
}

const HOUR_HEIGHT = 104;

export function AgendaMobileProprietario({
  barbers,
  hours,
  startHour,
  appointmentsByBarber,
  bloqueios,
  onSelectAppointment,
  onSelectBlock,
  onSlotClick,
}: AgendaMobileProprietarioProps) {
  if (!barbers.length) {
    return (
      <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.025] px-6 py-16 text-center">
        <h3 className="mt-4 text-xl font-black text-white">Nenhum barbeiro ativo</h3>
        <p className="mt-2 text-sm text-white/45">Cadastre profissionais ativos para ver a agenda.</p>
      </div>
    );
  }

  const gridHeight = Math.max(1, hours.length) * HOUR_HEIGHT;

  return (
    <div className="space-y-6">
      {barbers.map(barber => {
        const appointments = appointmentsByBarber[barber.id] || [];
        const blocks = bloqueios.filter(block => !block.barbeiro_id || block.barbeiro_id === barber.id);

        return (
          <div key={barber.id} className="rounded-3xl border border-white/10 bg-[#0d0d0d] shadow-2xl shadow-black/30 overflow-hidden">
            <div className="flex items-center gap-3 border-b border-white/10 bg-[#111]/95 px-5 py-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#D6B47A]/18 bg-[#D6B47A]/10 text-sm font-black text-[#D6B47A]">
                {barber.foto_url ? (
                  <img src={barber.foto_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  String(barber.nome || 'B').slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-black text-white">{barber.nome}</p>
                <p className="mt-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/35">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#D6B47A]" />
                  Disponível
                </p>
              </div>
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
                    className="group block w-full border-b border-white/[0.055] bg-[#0c0c0c] text-left transition-all hover:bg-[#D6B47A]/[0.045]"
                    style={{ height: HOUR_HEIGHT }}
                    aria-label={`Criar agendamento para ${barber.nome} às ${hourLabel(hour)}`}
                  >
                    <span className="ml-3 mt-3 inline-flex rounded-full border border-dashed border-white/8 px-2 py-1 text-[10px] font-bold text-white/0 transition-all group-active:border-[#D6B47A]/20 group-active:text-[#D6B47A]/70">
                      Livre
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
        );
      })}
    </div>
  );
}
