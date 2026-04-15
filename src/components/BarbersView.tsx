'use client';

import { useState } from 'react';
import { BarberCard } from './BarberCard';
import { UserPlus } from 'lucide-react';
import { BarberFormModal } from './BarberFormModal';

interface BarbersViewProps {
  barbers: any[];
  barbeariaId: string | null;
  refreshData: () => void;
  loading: boolean;
}

export function BarbersView({ barbers, barbeariaId, refreshData, loading }: BarbersViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBarber, setEditingBarber] = useState<any>(null);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!barbeariaId) return null;

  function handleOpenCreate() {
    setEditingBarber(null);
    setIsModalOpen(true);
  }

  function handleOpenEdit(barber: any) {
    setEditingBarber(barber);
    setIsModalOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-white">Equipe</h2>
          <p className="text-sm text-muted">Lançamento rápido por profissional</p>
        </div>
        <button 
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-3 sm:py-2 text-sm font-medium text-white hover:bg-white/10 transition-all active:scale-95"
        >
          <UserPlus className="h-4 w-4 text-accent" />
          Novo Barbeiro
        </button>
      </div>

      <BarberFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={refreshData}
        barbeariaId={barbeariaId}
        editingBarber={editingBarber}
      />

      <div className="grid grid-cols-1 gap-4">
        {barbers.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center border border-dashed border-border">
            <p className="text-muted">Nenhum barbeiro cadastrado para esta barbearia.</p>
          </div>
        ) : (
          barbers.map((barber) => (
            <BarberCard 
              key={barber.id} 
              barber={barber} 
              barbeariaId={barbeariaId} 
              onSuccess={refreshData}
              onEdit={handleOpenEdit}
            />
          ))
        )}
      </div>
    </div>
  );
}
