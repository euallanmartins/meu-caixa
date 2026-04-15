'use client';

import { useState, useEffect } from 'react';
import { X, User, DollarSign, Check, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface BarberFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  barbeariaId: string;
  editingBarber?: any; // If provided, we are in edit mode
}

export function BarberFormModal({ isOpen, onClose, onSuccess, barbeariaId, editingBarber }: BarberFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nome, setNome] = useState(editingBarber?.nome || '');
  const [comissao, setComissao] = useState(editingBarber?.comissao?.toString() || '50');
  const [comissaoTipo, setComissaoTipo] = useState<'percentual' | 'fixo'>(editingBarber?.comissao_tipo || 'percentual');

  // Sincroniza os campos sempre que o modal abre ou muda o barbeiro sendo editado
  useEffect(() => {
    if (isOpen) {
      setNome(editingBarber?.nome || '');
      setComissao(editingBarber?.comissao?.toString() || '50');
      setComissaoTipo(editingBarber?.comissao_tipo || 'percentual');
      setError(null);
    }
  }, [isOpen, editingBarber]);

  if (!isOpen) return null;

  async function handleSave() {
    if (!nome.trim() || !comissao || loading) return;
    setLoading(true);
    setError(null);

    try {
      const payload = {
        nome,
        comissao: parseFloat(comissao),
        comissao_tipo: comissaoTipo,
        barbearia_id: barbeariaId,
      };

      if (editingBarber) {
        const { error: updateError } = await supabase
          .from('barbeiros')
          .update(payload)
          .eq('id', editingBarber.id);
        
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('barbeiros')
          .insert([payload]);
        
        if (insertError) throw insertError;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar barbeiro:', err);
      setError(err.message || 'Erro ao salvar os dados.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="glass w-full max-w-md rounded-3xl border border-border overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent/20 flex items-center justify-center">
              <User className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {editingBarber ? 'Editar Profissional' : 'Novo Profissional'}
              </h3>
              <p className="text-[10px] text-muted uppercase tracking-widest">Configure os detalhes da equipe</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X className="h-5 w-5 text-muted hover:text-white" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="bg-danger/10 border border-danger/20 p-3 rounded-xl flex items-center gap-2 text-danger text-xs font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold text-muted ml-1">Nome Completo</label>
            <input 
              type="text" 
              placeholder="Ex: Diego Martins"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full bg-white/5 border border-border rounded-xl p-3 text-white focus:border-accent outline-none ring-1 ring-transparent focus:ring-accent/20 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold text-muted ml-1">Comissão</label>
            <div className="flex gap-2">
              <input 
                type="number" 
                placeholder="0"
                value={comissao}
                onChange={(e) => setComissao(e.target.value)}
                className="flex-1 bg-white/5 border border-border rounded-xl p-3 text-white focus:border-accent outline-none transition-all"
              />
              <div className="flex bg-white/5 rounded-xl border border-border p-1">
                <button 
                  onClick={() => setComissaoTipo('percentual')}
                  className={`px-3 rounded-lg text-xs font-bold transition-all ${comissaoTipo === 'percentual' ? 'bg-accent text-black shadow-lg shadow-accent/20' : 'text-muted hover:text-white'}`}
                >
                  %
                </button>
                <button 
                  onClick={() => setComissaoTipo('fixo')}
                  className={`px-3 rounded-lg text-xs font-bold transition-all ${comissaoTipo === 'fixo' ? 'bg-accent text-black shadow-lg shadow-accent/20' : 'text-muted hover:text-white'}`}
                >
                  R$
                </button>
              </div>
            </div>
            <p className="text-[9px] text-muted-foreground ml-1">
              Valor que o profissional recebe por cada serviço prestado.
            </p>
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              onClick={onClose}
              className="flex-1 py-3 text-sm font-bold text-muted hover:text-white transition-all"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave}
              disabled={loading || !nome.trim()}
              className="flex-[2] bg-accent p-3 rounded-xl font-bold text-black flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 shadow-lg shadow-accent/10"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  {editingBarber ? 'Salvar Alterações' : 'Cadastrar Barbeiro'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
