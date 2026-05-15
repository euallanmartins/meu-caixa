'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, FileText, Loader2, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUserRole } from '@/hooks/useUserRole';
import { hasPermission } from '@/lib/security/permissions';
import { ProfessionalMobileHeader } from '@/components/layout/ProfessionalMobileHeader';

type Service = { id: string; nome: string };
type FormRow = {
  id: string;
  titulo: string;
  descricao: string | null;
  servico_id: string | null;
  ativo: boolean;
  custom_form_fields?: FieldRow[];
};
type FieldRow = {
  id: string;
  label: string;
  type: string;
  required: boolean;
  sort_order: number;
};

const FIELD_TYPES = [
  { value: 'text', label: 'Texto curto' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'select', label: 'Selecao' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'radio', label: 'Radio' },
];

export default function FormulariosPage() {
  const { role, barbeariaId, loading: roleLoading } = useUserRole();
  const [forms, setForms] = useState<FormRow[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [formDraft, setFormDraft] = useState({ titulo: '', descricao: '', servico_id: '' });
  const [fieldDraft, setFieldDraft] = useState({ label: '', type: 'text', required: false });

  const canManage = useMemo(() => hasPermission(role, 'formularios.manage'), [role]);
  const selectedForm = forms.find(item => item.id === selectedFormId) || forms[0] || null;

  async function load() {
    if (!barbeariaId || !canManage) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [formsRes, servicesRes] = await Promise.all([
        supabase
          .from('custom_forms')
          .select('id, titulo, descricao, servico_id, ativo, custom_form_fields(id, label, type, required, sort_order)')
          .eq('barbearia_id', barbeariaId)
          .order('created_at', { ascending: false }),
        supabase.from('servicos').select('id, nome').eq('barbearia_id', barbeariaId).eq('ativo', true).order('nome'),
      ]);

      if (formsRes.error) throw formsRes.error;
      if (servicesRes.error) throw servicesRes.error;
      const rows = (formsRes.data || []) as FormRow[];
      setForms(rows.map(row => ({ ...row, custom_form_fields: [...(row.custom_form_fields || [])].sort((a, b) => a.sort_order - b.sort_order) })));
      setServices((servicesRes.data || []) as Service[]);
      setSelectedFormId(current => current || rows[0]?.id || null);
    } catch (err) {
      console.error('[Formularios] Erro ao carregar:', err);
      setError('Nao foi possivel carregar formularios.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!roleLoading) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading, barbeariaId, canManage]);

  async function createForm() {
    if (!barbeariaId || saving || !formDraft.titulo.trim()) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const { data, error: insertError } = await supabase
        .from('custom_forms')
        .insert({
          barbearia_id: barbeariaId,
          titulo: formDraft.titulo.trim(),
          descricao: formDraft.descricao.trim() || null,
          servico_id: formDraft.servico_id || null,
          ativo: true,
        })
        .select('id')
        .single();
      if (insertError) throw insertError;
      setFormDraft({ titulo: '', descricao: '', servico_id: '' });
      setSelectedFormId(data.id);
      setMessage('Formulario criado.');
      await load();
    } catch (err) {
      console.error('[Formularios] Erro ao criar:', err);
      setError('Nao foi possivel criar o formulario.');
    } finally {
      setSaving(false);
    }
  }

  async function addField() {
    if (!selectedForm || !fieldDraft.label.trim() || saving) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const nextOrder = (selectedForm.custom_form_fields?.length || 0) + 1;
      const { error: insertError } = await supabase.from('custom_form_fields').insert({
        form_id: selectedForm.id,
        label: fieldDraft.label.trim(),
        type: fieldDraft.type,
        required: fieldDraft.required,
        sort_order: nextOrder,
      });
      if (insertError) throw insertError;
      setFieldDraft({ label: '', type: 'text', required: false });
      await load();
    } catch (err) {
      console.error('[Formularios] Erro ao criar campo:', err);
      setError('Nao foi possivel adicionar o campo.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteField(fieldId: string) {
    const { error: deleteError } = await supabase.from('custom_form_fields').delete().eq('id', fieldId);
    if (deleteError) {
      setError('Nao foi possivel remover o campo.');
      return;
    }
    await load();
  }

  async function toggleForm(form: FormRow) {
    if (!barbeariaId) return;
    const { error: updateError } = await supabase
      .from('custom_forms')
      .update({ ativo: !form.ativo })
      .eq('id', form.id)
      .eq('barbearia_id', barbeariaId);
    if (updateError) {
      setError('Nao foi possivel atualizar o formulario.');
      return;
    }
    await load();
  }

  if (roleLoading || loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-9 w-9 animate-spin text-[#D6B47A]" /></div>;
  if (!barbeariaId || !canManage) return <Denied />;

  return (
    <div className="max-w-full space-y-8 overflow-hidden animate-in fade-in duration-500">
      <ProfessionalMobileHeader icon={FileText} title="Formularios" subtitle="Perguntas por barbearia ou servico" />
      <div className="hidden lg:block">
        <p className="text-[11px] font-black uppercase tracking-[0.35em] text-[#D6B47A]">Coleta de informacoes</p>
        <h1 className="mt-2 text-4xl font-black text-white">Formularios personalizados</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/50">Crie perguntas para preparar melhor o atendimento antes do cliente chegar.</p>
      </div>

      {(error || message) && <div className={`rounded-2xl border p-4 text-sm font-bold ${error ? 'border-[#ff4d4d]/25 bg-[#ff4d4d]/10 text-[#ff9a9a]' : 'border-[#D6B47A]/20 bg-[#D6B47A]/10 text-[#D6B47A]'}`}>{error || message}</div>}

      <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <aside className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.035] p-5">
          <h2 className="text-xl font-black text-white">Novo formulario</h2>
          <div className="mt-5 grid gap-3">
            <input value={formDraft.titulo} onChange={e => setFormDraft(prev => ({ ...prev, titulo: e.target.value }))} placeholder="Titulo" className="h-12 w-full min-w-0 rounded-2xl border border-white/12 bg-white/[0.04] px-4 font-bold text-white outline-none" />
            <textarea value={formDraft.descricao} onChange={e => setFormDraft(prev => ({ ...prev, descricao: e.target.value }))} rows={3} placeholder="Descricao" className="w-full min-w-0 resize-none rounded-2xl border border-white/12 bg-white/[0.04] p-4 font-bold text-white outline-none" />
            <select value={formDraft.servico_id} onChange={e => setFormDraft(prev => ({ ...prev, servico_id: e.target.value }))} className="h-12 w-full min-w-0 rounded-2xl border border-white/12 bg-white/[0.04] px-4 font-bold text-white outline-none">
              <option value="">Todos os servicos</option>
              {services.map(service => <option key={service.id} value={service.id}>{service.nome}</option>)}
            </select>
            <button onClick={createForm} disabled={saving || !formDraft.titulo.trim()} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#D6B47A] font-black text-black disabled:opacity-50"><Plus className="h-4 w-4" />Criar</button>
          </div>

          <div className="mt-6 space-y-2 border-t border-white/8 pt-5">
            {forms.length === 0 ? <p className="text-sm text-white/40">Nenhum formulario criado.</p> : forms.map(form => (
              <button key={form.id} onClick={() => setSelectedFormId(form.id)} className={`w-full min-w-0 rounded-2xl border p-4 text-left ${selectedForm?.id === form.id ? 'border-[#D6B47A]/35 bg-[#D6B47A]/10' : 'border-white/10 bg-white/[0.03]'}`}>
                <p className="break-words font-black text-white">{form.titulo}</p>
                <p className="mt-1 text-xs text-white/45">{form.ativo ? 'Ativo' : 'Inativo'} | {form.custom_form_fields?.length || 0} campos</p>
              </button>
            ))}
          </div>
        </aside>

        <main className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.035] p-5">
          {!selectedForm ? (
            <div className="py-20 text-center text-white/35">Selecione ou crie um formulario.</div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="break-words text-2xl font-black text-white">{selectedForm.titulo}</h2>
                  <p className="mt-1 break-words text-sm text-white/50">{selectedForm.descricao || 'Sem descricao'}</p>
                </div>
                <button onClick={() => toggleForm(selectedForm)} className="h-11 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-white">
                  {selectedForm.ativo ? 'Desativar' : 'Ativar'}
                </button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <h3 className="font-black text-white">Adicionar pergunta</h3>
                <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_180px_140px_120px]">
                  <input value={fieldDraft.label} onChange={e => setFieldDraft(prev => ({ ...prev, label: e.target.value }))} placeholder="Pergunta" className="h-12 w-full min-w-0 rounded-xl border border-white/12 bg-white/[0.04] px-4 font-bold text-white outline-none" />
                  <select value={fieldDraft.type} onChange={e => setFieldDraft(prev => ({ ...prev, type: e.target.value }))} className="h-12 w-full min-w-0 rounded-xl border border-white/12 bg-white/[0.04] px-4 font-bold text-white outline-none">
                    {FIELD_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                  <label className="flex h-12 items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-4 text-sm font-bold text-white"><input type="checkbox" checked={fieldDraft.required} onChange={e => setFieldDraft(prev => ({ ...prev, required: e.target.checked }))} /> Obrigatorio</label>
                  <button onClick={addField} disabled={saving || !fieldDraft.label.trim()} className="h-12 rounded-xl bg-[#D6B47A] font-black text-black disabled:opacity-50">Adicionar</button>
                </div>
              </div>

              <div className="space-y-3">
                {(selectedForm.custom_form_fields || []).length === 0 ? <p className="rounded-2xl border border-dashed border-white/12 p-8 text-center text-white/40">Nenhuma pergunta ainda.</p> : selectedForm.custom_form_fields?.map(field => (
                  <div key={field.id} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="min-w-0">
                      <p className="break-words font-black text-white">{field.label}</p>
                      <p className="mt-1 text-xs text-white/45">{field.type} {field.required ? '| obrigatorio' : ''}</p>
                    </div>
                    <button onClick={() => deleteField(field.id)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#ff4d4d]/25 bg-[#ff4d4d]/10 text-[#ff8a8a]"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </section>
    </div>
  );
}

function Denied() {
  return <div className="rounded-3xl border border-[#ff4d4d]/25 bg-[#ff4d4d]/10 p-8 text-center text-[#ff9a9a]"><AlertCircle className="mx-auto h-10 w-10" /><p className="mt-4 font-black">Seu cargo nao tem permissao para formularios.</p></div>;
}
