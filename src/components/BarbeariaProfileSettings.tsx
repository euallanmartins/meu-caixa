'use client';

import { useEffect, useState } from 'react';
import { Check, Image as ImageIcon, Save, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PUBLIC_IMAGE_ACCEPT, publicImageExtension, TEMPORARY_FAILURE_MESSAGE, validatePublicImageFile } from '@/lib/security/upload';
import { safeImageUrl } from '@/lib/security/url';

type ProfileForm = {
  nome: string;
  slug: string;
  descricao: string;
  endereco: string;
  telefone: string;
  whatsapp: string;
  instagram: string;
  logo_url: string;
  capa_url: string;
  mensagem_boas_vindas: string;
  ativo: boolean;
};

const EMPTY_FORM: ProfileForm = {
  nome: '',
  slug: '',
  descricao: '',
  endereco: '',
  telefone: '',
  whatsapp: '',
  instagram: '',
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
          slug: data.slug || '',
          descricao: data.descricao || '',
          endereco: data.endereco || '',
          telefone: data.telefone || '',
          whatsapp: data.whatsapp || '',
          instagram: data.instagram || '',
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
          slug: form.slug.trim() || null,
          descricao: form.descricao.trim() || null,
          endereco: form.endereco.trim() || null,
          telefone: form.telefone.trim() || null,
          whatsapp: form.whatsapp.trim() || null,
          instagram: form.instagram.trim() || null,
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
    <div className="space-y-6">
      {message && (
        <div className="flex items-center gap-2 rounded-2xl border border-[#D6B47A]/20 bg-[#D6B47A]/8 p-4 text-sm font-bold text-[#D6B47A]">
          <Check className="h-4 w-4 shrink-0" />
          <p className="text-wrap">{message}</p>
        </div>
      )}

      <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-white text-wrap">Perfil público</h2>
            <p className="mt-1 text-sm text-white/50 text-wrap">Estes dados aparecem na landing e na página pública da barbearia.</p>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving || !form.nome.trim()}
            className="flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#D6B47A] px-5 text-sm font-black text-black sm:w-auto disabled:opacity-50"
          >
            {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" /> : <Save className="h-4 w-4" />}
            Salvar perfil
          </button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Field label="Nome da barbearia" value={form.nome} onChange={value => update('nome', value)} />
          <Field label="Link público (Slug)" placeholder="ex: minha-barbearia" value={form.slug} onChange={value => update('slug', value)} />
          <Field label="WhatsApp" placeholder="(00) 00000-0000" value={form.whatsapp} onChange={value => update('whatsapp', value)} />
          <Field label="Telefone" placeholder="(00) 0000-0000" value={form.telefone} onChange={value => update('telefone', value)} />
          <Field label="Instagram" placeholder="@suabarbearia" value={form.instagram} onChange={value => update('instagram', value)} />
          <Field label="Endereço da barbearia" placeholder="Rua, número, bairro — cidade/UF" value={form.endereco} onChange={value => update('endereco', value)} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <TextArea label="Descrição curta" value={form.descricao} onChange={value => update('descricao', value)} />
          <TextArea label="Observações / Boas-vindas" value={form.mensagem_boas_vindas} onChange={value => update('mensagem_boas_vindas', value)} />
        </div>

        <div className="mt-5">
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm font-bold text-white">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={event => update('ativo', event.target.checked)}
              className="h-5 w-5 shrink-0 accent-[#D6B47A]"
            />
            <span className="text-wrap">Agendamento público ativo (Disponível na plataforma)</span>
          </label>
        </div>
      </div>

      <VisualUploadCard
        title="Logo / Foto de perfil"
        description="Aparece redonda nos agendamentos e no seu perfil."
        type="logo"
        url={form.logo_url}
        saving={saving}
        onUpload={(file) => uploadImage(file, 'logo_url')}
      />

      <VisualUploadCard
        title="Capa"
        description="Banner retangular (16:9) exibido no topo da sua página."
        type="capa"
        url={form.capa_url}
        saving={saving}
        onUpload={(file) => uploadImage(file, 'capa_url')}
      />
    </div>
  );
}

function Field({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-2">
      <span className="ml-1 block text-[10px] font-black uppercase tracking-[0.18em] text-white/40 text-wrap">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value)}
        className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-white outline-none placeholder:text-white/20 focus:border-[#D6B47A]/40"
      />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-2">
      <span className="ml-1 block text-[10px] font-black uppercase tracking-[0.18em] text-white/40 text-wrap">{label}</span>
      <textarea
        rows={5}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-white outline-none focus:border-[#D6B47A]/40"
      />
    </label>
  );
}

function VisualUploadCard({
  title,
  description,
  type,
  url,
  saving,
  onUpload
}: {
  title: string;
  description: string;
  type: 'logo' | 'capa';
  url: string;
  saving: boolean;
  onUpload: (file: File | null) => void;
}) {
  const safeUrl = safeImageUrl(url, { allowBlob: false });
  const isCapa = type === 'capa';

  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
      <div className="mb-4">
        <h3 className="text-xl font-black text-white text-wrap">{title}</h3>
        <p className="mt-1 text-sm text-white/50 text-wrap">{description}</p>
      </div>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
        <div className={`${isCapa ? 'w-full sm:w-80 aspect-[16/9]' : 'h-32 w-32 shrink-0 aspect-square rounded-[2rem]'} overflow-hidden rounded-[2rem] border border-dashed border-white/20 bg-black/40`}>
          {safeUrl ? (
            <img src={safeUrl} alt={title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-white/25">
              <ImageIcon className="mb-2 h-8 w-8" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-center">Sem<br/>foto</span>
            </div>
          )}
        </div>

        <label className={`flex h-12 w-full sm:w-auto shrink-0 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-black text-white transition-all hover:border-[#D6B47A]/30 ${saving ? 'pointer-events-none opacity-50' : ''}`}>
          <Upload className="h-4 w-4 text-[#D6B47A]" />
          {url ? `Trocar ${type}` : `Enviar ${type}`}
          <input type="file" accept={PUBLIC_IMAGE_ACCEPT} className="hidden" onChange={event => onUpload(event.target.files?.[0] ?? null)} />
        </label>
      </div>
    </div>
  );
}
