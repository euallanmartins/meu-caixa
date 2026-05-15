'use client';

import { useEffect, useState } from 'react';
import { Check, Image as ImageIcon, Save, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PUBLIC_IMAGE_ACCEPT, publicImageExtension, TEMPORARY_FAILURE_MESSAGE, validatePublicImageFile } from '@/lib/security/upload';
import { safeImageUrl } from '@/lib/security/url';

type ProfileForm = {
  nome: string;
  descricao: string;
  endereco: string;
  telefone: string;
  whatsapp: string;
  logo_url: string;
  capa_url: string;
  mensagem_boas_vindas: string;
  ativo: boolean;
};

const EMPTY_FORM: ProfileForm = {
  nome: '',
  descricao: '',
  endereco: '',
  telefone: '',
  whatsapp: '',
  logo_url: '',
  capa_url: '',
  mensagem_boas_vindas: '',
  ativo: true,
};

export function BarbeariaProfileSettings({ barbeariaId }: { barbeariaId: string | null }) {
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!barbeariaId) return;
      setLoading(true);

      const { data, error } = await supabase
        .from('barbearias')
        .select('*')
        .eq('id', barbeariaId)
        .maybeSingle();

      if (!active) return;

      if (error) {
        setMessage(error.message);
      } else if (data) {
        setForm({
          nome: data.nome || '',
          descricao: data.descricao || '',
          endereco: data.endereco || '',
          telefone: data.telefone || '',
          whatsapp: data.whatsapp || '',
          logo_url: data.logo_url || '',
          capa_url: data.capa_url || '',
          mensagem_boas_vindas: data.mensagem_boas_vindas || '',
          ativo: data.ativo !== false,
        });
      }

      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [barbeariaId]);

  function update<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function uploadImage(file: File | null, field: 'logo_url' | 'capa_url') {
    if (!file || !barbeariaId) return;
    setSaving(true);
    setMessage(null);

    try {
      const fileError = validatePublicImageFile(file);
      if (fileError) {
        setMessage(fileError);
        return;
      }

      const ext = publicImageExtension(file);
      const path = `barbearias/${barbeariaId}/profile/${field}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('barber-photos')
        .upload(path, file, { cacheControl: '3600', upsert: true });

      if (error) throw error;
      const { data } = supabase.storage.from('barber-photos').getPublicUrl(path);
      update(field, data.publicUrl);
    } catch {
      setMessage(TEMPORARY_FAILURE_MESSAGE);
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!barbeariaId || saving) return;
    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('barbearias')
        .update({
          nome: form.nome.trim(),
          descricao: form.descricao.trim() || null,
          endereco: form.endereco.trim() || null,
          telefone: form.telefone.trim() || null,
          whatsapp: form.whatsapp.trim() || null,
          logo_url: form.logo_url.trim() || null,
          capa_url: form.capa_url.trim() || null,
          mensagem_boas_vindas: form.mensagem_boas_vindas.trim() || null,
          ativo: form.ativo,
        })
        .eq('id', barbeariaId);

      if (error) throw error;
      setMessage('Perfil publico salvo.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Erro ao salvar perfil.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#D6B47A] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-white">Perfil publico</h2>
            <p className="mt-1 text-sm text-white/50">Estes dados aparecem na landing e na pagina publica da barbearia.</p>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving || !form.nome.trim()}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#D6B47A] px-5 text-sm font-black text-black disabled:opacity-50"
          >
            {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" /> : <Save className="h-4 w-4" />}
            Salvar perfil
          </button>
        </div>

        {message && (
          <div className="mt-5 flex items-center gap-2 rounded-2xl border border-[#D6B47A]/20 bg-[#D6B47A]/8 p-4 text-sm font-bold text-[#D6B47A]">
            <Check className="h-4 w-4" />
            {message}
          </div>
        )}

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Field label="Nome da barbearia" value={form.nome} onChange={value => update('nome', value)} />
          <Field label="Endereco" value={form.endereco} onChange={value => update('endereco', value)} />
          <Field label="Telefone" value={form.telefone} onChange={value => update('telefone', value)} />
          <Field label="WhatsApp" value={form.whatsapp} onChange={value => update('whatsapp', value)} />
          <Field label="Logo / foto principal" value={form.logo_url} onChange={value => update('logo_url', value)} />
          <Field label="Foto de capa" value={form.capa_url} onChange={value => update('capa_url', value)} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <TextArea label="Descricao" value={form.descricao} onChange={value => update('descricao', value)} />
          <TextArea label="Mensagem de boas-vindas" value={form.mensagem_boas_vindas} onChange={value => update('mensagem_boas_vindas', value)} />
        </div>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm font-bold text-white">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={event => update('ativo', event.target.checked)}
              className="h-5 w-5 accent-[#D6B47A]"
            />
            Disponivel publicamente quando aprovada
          </label>

          <div className="flex flex-col gap-3 sm:flex-row">
            <UploadButton label="Enviar logo" onChange={file => uploadImage(file, 'logo_url')} />
            <UploadButton label="Enviar capa" onChange={file => uploadImage(file, 'capa_url')} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Preview title="Logo" url={form.logo_url} />
        <Preview title="Capa" url={form.capa_url} wide />
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-2">
      <span className="ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/40">{label}</span>
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-white outline-none focus:border-[#D6B47A]/40"
      />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-2">
      <span className="ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/40">{label}</span>
      <textarea
        rows={5}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-white outline-none focus:border-[#D6B47A]/40"
      />
    </label>
  );
}

function UploadButton({ label, onChange }: { label: string; onChange: (file: File | null) => void }) {
  return (
    <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-black text-white transition-all hover:border-[#D6B47A]/30">
      <Upload className="h-4 w-4 text-[#D6B47A]" />
      {label}
      <input type="file" accept={PUBLIC_IMAGE_ACCEPT} className="hidden" onChange={event => onChange(event.target.files?.[0] ?? null)} />
    </label>
  );
}

function Preview({ title, url, wide }: { title: string; url: string; wide?: boolean }) {
  const safeUrl = safeImageUrl(url, { allowBlob: false });

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
      <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-white/40">{title}</p>
      <div className={`${wide ? 'aspect-[16/7]' : 'aspect-square max-w-56'} overflow-hidden rounded-2xl border border-white/10 bg-black/40`}>
        {safeUrl ? <img src={safeUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><ImageIcon className="h-9 w-9 text-white/25" /></div>}
      </div>
    </div>
  );
}
