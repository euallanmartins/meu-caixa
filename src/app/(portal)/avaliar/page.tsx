'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Scissors,
  Send,
  Star,
  Trash2,
} from 'lucide-react';
import { supabasePublic } from '@/lib/supabase';
import { publicBarbearias } from '@/lib/publicBarbearia';

type PublicBarbearia = {
  id: string;
  nome: string;
  endereco?: string | null;
  logo_url?: string | null;
  ativo?: boolean | null;
};

const MAX_PHOTOS = 4;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

function AvaliarInner() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get('id') || '';

  const [barbearias, setBarbearias] = useState<PublicBarbearia[]>([]);
  const [barbeariaId, setBarbeariaId] = useState(initialId);
  const [nome, setNome] = useState('');
  const [nota, setNota] = useState(5);
  const [depoimento, setDepoimento] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadBarbearias() {
      setLoading(true);
      const { data, error: dbError } = await supabasePublic
        .from('barbearias')
        .select('*')
        .order('nome');

      if (!active) return;

      if (dbError || !data?.length) {
        setBarbearias(publicBarbearias.map(item => ({ ...item, endereco: item.cidade })));
      } else {
        setBarbearias(((data || []) as PublicBarbearia[]).filter(item => item.ativo !== false));
      }

      setLoading(false);
    }

    loadBarbearias();

    return () => {
      active = false;
    };
  }, []);

  const selectedShop = useMemo(
    () => barbearias.find(item => item.id === barbeariaId) ?? null,
    [barbearias, barbeariaId],
  );

  function handleFiles(nextFiles: FileList | null) {
    if (!nextFiles) return;
    setError(null);

    const accepted: File[] = [];
    for (const file of Array.from(nextFiles)) {
      if (!file.type.startsWith('image/')) {
        setError('Envie apenas arquivos de imagem.');
        return;
      }

      if (file.size > MAX_PHOTO_SIZE) {
        setError('Cada foto pode ter no maximo 5MB.');
        return;
      }

      accepted.push(file);
    }

    setFiles(prev => [...prev, ...accepted].slice(0, MAX_PHOTOS));
  }

  function validate() {
    if (!barbeariaId) return 'Escolha a barbearia avaliada.';
    if (!nome.trim()) return 'Informe seu nome.';
    if (nota < 1 || nota > 5) return 'Escolha uma nota entre 1 e 5.';
    if (!depoimento.trim()) return 'Escreva seu depoimento.';
    if (files.length > MAX_PHOTOS) return 'Envie no maximo 4 fotos.';
    return null;
  }

  async function submit() {
    if (submitting) return;
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }

    setSubmitting(true);
    setError(null);

    const avaliacaoId = crypto.randomUUID();
    const uploadedPaths: string[] = [];

    try {
      const photoUrls: string[] = [];

      for (const [index, file] of files.entries()) {
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `barbearias/${barbeariaId}/avaliacoes/${avaliacaoId}/${index + 1}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabasePublic.storage
          .from('barber-photos')
          .upload(path, file, { cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;
        uploadedPaths.push(path);

        const { data } = supabasePublic.storage.from('barber-photos').getPublicUrl(path);
        photoUrls.push(data.publicUrl);
      }

      const { data, error: rpcError } = await supabasePublic.rpc('rpc_criar_avaliacao', {
        p_avaliacao_id: avaliacaoId,
        p_barbearia_id: barbeariaId,
        p_nome_cliente: nome.trim(),
        p_nota: nota,
        p_depoimento: depoimento.trim(),
        p_fotos: photoUrls,
      });

      if (rpcError) throw rpcError;

      setSuccessId(String(data || avaliacaoId));
      setNome('');
      setNota(5);
      setDepoimento('');
      setFiles([]);
    } catch (err) {
      if (uploadedPaths.length) {
        await supabasePublic.storage.from('barber-photos').remove(uploadedPaths);
      }
      setError(err instanceof Error ? err.message : 'Nao foi possivel enviar sua avaliacao.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] px-4 py-5 text-white sm:px-6">
      <main className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-3">
          <Link href={selectedShop ? `/barbearia/${selectedShop.id}` : '/'} className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Link href="/login" prefetch={false} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-white/65">
            Acesso profissional
          </Link>
        </header>

        <section className="pt-10">
          <p className="text-xs font-black uppercase tracking-[0.26em] text-[#D6B47A]">Avaliacoes</p>
          <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-6xl">
            Conte como foi sua experiencia.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
            Sua avaliacao fica pendente ate a barbearia aprovar. Depois disso, ela aparece no perfil publico para ajudar outros clientes.
          </p>
        </section>

        {successId ? (
          <section className="mt-8 rounded-[2rem] border border-[#D6B47A]/25 bg-[#D6B47A]/10 p-6 sm:p-8">
            <CheckCircle2 className="h-12 w-12 text-[#D6B47A]" />
            <h2 className="mt-5 text-2xl font-black">Avaliacao enviada</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/65">
              Obrigado pelo depoimento. Ele sera revisado pela barbearia antes de aparecer no perfil publico.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {barbeariaId && (
                <Link href={`/barbearia/${barbeariaId}`} className="flex h-13 items-center justify-center rounded-2xl bg-[#D6B47A] px-5 font-black text-black">
                  Ver barbearia
                </Link>
              )}
              <button type="button" onClick={() => setSuccessId(null)} className="flex h-13 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 font-black text-white">
                Enviar outra avaliacao
              </button>
            </div>
          </section>
        ) : (
          <section className="mt-8 grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5">
              <h2 className="text-lg font-black">Escolha a barbearia</h2>
              {loading ? (
                <div className="mt-8 flex justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-[#D6B47A]" />
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {barbearias.map(shop => (
                    <button
                      key={shop.id}
                      type="button"
                      onClick={() => setBarbeariaId(shop.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all ${
                        barbeariaId === shop.id
                          ? 'border-[#D6B47A]/45 bg-[#D6B47A]/10'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                      }`}
                    >
                      <div className="flex h-13 w-13 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#D6B47A]/12 text-[#D6B47A]">
                        {shop.logo_url ? <img src={shop.logo_url} alt="" className="h-full w-full object-cover" /> : <Scissors className="h-6 w-6" />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-black text-white">{shop.nome}</p>
                        <p className="truncate text-xs text-white/45">{shop.endereco || 'Agendamento online'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </aside>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
              {error && (
                <div className="mb-5 flex gap-3 rounded-2xl border border-[#ff5c5c]/25 bg-[#ff5c5c]/10 p-4 text-sm font-bold text-[#ff8a8a]">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-5">
                <Field label="Seu nome" value={nome} onChange={setNome} placeholder="Ex: Tales Augusto" />

                <div>
                  <p className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Nota</p>
                  <div className="mt-2 flex gap-2">
                    {[1, 2, 3, 4, 5].map(value => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setNota(value)}
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                          value <= nota
                            ? 'border-yellow-300/30 bg-yellow-300/12 text-yellow-300'
                            : 'border-white/10 bg-white/[0.04] text-white/30'
                        }`}
                        aria-label={`${value} estrela${value > 1 ? 's' : ''}`}
                      >
                        <Star className="h-6 w-6 fill-current" />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Depoimento</p>
                  <textarea
                    rows={6}
                    value={depoimento}
                    onChange={event => setDepoimento(event.target.value)}
                    placeholder="Conte como foi o atendimento, ambiente e resultado."
                    className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-white outline-none placeholder:text-white/28 focus:border-[#D6B47A]/45"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Fotos opcionais</p>
                    <span className="text-xs font-bold text-white/35">{files.length}/4</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {files.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                        <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setFiles(prev => prev.filter((_, i) => i !== index))}
                          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-xl bg-black/70 text-[#ff5c5c]"
                          aria-label="Remover foto"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    {files.length < MAX_PHOTOS && (
                      <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/14 bg-white/[0.03] text-center text-white/55">
                        <Camera className="h-8 w-8 text-[#D6B47A]" />
                        <span className="mt-2 text-xs font-black uppercase tracking-[0.12em]">Adicionar</span>
                        <input type="file" accept="image/*" multiple className="hidden" onChange={event => handleFiles(event.target.files)} />
                      </label>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#D6B47A] text-base font-black text-black disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  Enviar avaliacao
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </section>
        )}

        <footer className="mt-10 rounded-3xl border border-white/10 bg-white/[0.025] p-5 text-sm leading-relaxed text-white/45">
          As fotos e depoimentos enviados passam por moderacao da barbearia antes da publicacao.
        </footer>
      </main>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="block">
      <span className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">{label}</span>
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-14 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-white outline-none placeholder:text-white/28 focus:border-[#D6B47A]/45"
      />
    </label>
  );
}

export default function AvaliarPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
          <Loader2 className="h-10 w-10 animate-spin text-[#D6B47A]" />
        </div>
      }
    >
      <AvaliarInner />
    </Suspense>
  );
}
