'use client';

import { useEffect, useState } from 'react';
import { Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type PortfolioPhoto = {
  id: string;
  url: string;
  storage_path: string | null;
  ordem: number | null;
};

export function BarbeariaPortfolioManager({ barbeariaId }: { barbeariaId: string | null }) {
  const [photos, setPhotos] = useState<PortfolioPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    if (!barbeariaId) return;
    setLoading(true);
    setMessage(null);

    const { data, error } = await supabase
      .from('barbearia_fotos')
      .select('id, url, storage_path, ordem')
      .eq('barbearia_id', barbeariaId)
      .eq('tipo', 'portfolio')
      .order('ordem');

    if (error) {
      setPhotos([]);
      setMessage('Tabela de portfolio ainda nao esta disponivel. Aplique a migration nova no Supabase.');
    } else {
      setPhotos((data || []) as PortfolioPhoto[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [barbeariaId]);

  async function upload(file: File | null) {
    if (!file || !barbeariaId || busy) return;
    setBusy(true);
    setMessage(null);

    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `barbearias/${barbeariaId}/portfolio/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('barber-photos')
        .upload(path, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage.from('barber-photos').getPublicUrl(path);
      const { error: insertError } = await supabase.from('barbearia_fotos').insert({
        barbearia_id: barbeariaId,
        url: publicUrl.publicUrl,
        storage_path: path,
        tipo: 'portfolio',
        ordem: photos.length + 1,
      });

      if (insertError) throw insertError;
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Erro ao enviar foto.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(photo: PortfolioPhoto) {
    if (!barbeariaId || busy) return;
    setBusy(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('barbearia_fotos')
        .delete()
        .eq('id', photo.id)
        .eq('barbearia_id', barbeariaId);

      if (error) throw error;

      if (photo.storage_path) {
        await supabase.storage.from('barber-photos').remove([photo.storage_path]);
      }

      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Erro ao remover foto.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-white">Portfolio publico</h2>
            <p className="mt-1 text-sm text-white/50">Fotos exibidas na pagina publica da barbearia.</p>
          </div>
          <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#D6B47A] px-5 text-sm font-black text-black">
            <Upload className="h-4 w-4" />
            Adicionar foto
            <input type="file" accept="image/*" className="hidden" onChange={event => upload(event.target.files?.[0] ?? null)} />
          </label>
        </div>

        {message && (
          <div className="mt-5 rounded-2xl border border-yellow-300/20 bg-yellow-300/8 p-4 text-sm font-bold text-yellow-200">
            {message}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#D6B47A] border-t-transparent" />
          </div>
        ) : photos.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-white/10 bg-white/[0.025] p-10 text-center">
            <ImageIcon className="mx-auto h-12 w-12 text-white/25" />
            <p className="mt-4 font-bold text-white/50">Nenhuma foto cadastrada.</p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map(photo => (
              <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
                <img src={photo.url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => remove(photo)}
                  disabled={busy}
                  className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-black/70 text-[#ff5c5c] backdrop-blur transition-all hover:bg-[#ff5c5c] hover:text-white"
                  aria-label="Remover foto"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
