/* eslint-disable */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ClientsView } from '@/components/ClientsView';

export default function ClientesPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    async function checkUser() {
      try {
        setAuthError(null);
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) {
          router.push('/login');
          return;
        }
        
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*, barbearias(nome)')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        setProfile(profileData);
      } catch (error) {
        console.error('[ClientesPage] Falha ao validar acesso:', error);
        setAuthError('Nao foi possivel validar seu acesso profissional agora.');
      } finally {
        setLoading(false);
      }
    }
    checkUser();
  }, [router]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-12 h-12 border-4 border-[#D6B47A] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (authError) return <ProtectedRouteError message={authError} />;

  return (
    <div className="space-y-8">
      <div className="hidden lg:block">
         <h2 className="text-3xl font-black text-white uppercase tracking-tight">Gestão CRM</h2>
         <p className="text-sm text-white/40 font-bold uppercase tracking-widest mt-1">Base de dados e segmentação de clientes</p>
      </div>

      <ClientsView barbeariaId={profile?.barbearia_id} />
    </div>
  );
}

function ProtectedRouteError({ message }: { message: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-2">
      <div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
        <h2 className="text-2xl font-black text-white">Acesso indisponivel</h2>
        <p className="mt-3 text-sm leading-relaxed text-white/55">{message}</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-6 h-12 rounded-2xl bg-[#D6B47A] px-6 font-black text-black">
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
