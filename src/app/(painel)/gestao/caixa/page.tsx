/* eslint-disable */
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShoppingCart } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CheckoutPOS } from '@/components/CheckoutPOS';
import { ProfessionalMobileHeader } from '@/components/layout/ProfessionalMobileHeader';

function CaixaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const agendamentoId = searchParams.get('agendamentoId');
  
  const [profile, setProfile] = useState<any>(null);
  const [initialAppointment, setInitialAppointment] = useState<any>(null);
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

        if (agendamentoId) {
          const { data: ag, error: agError } = await supabase
            .from('agendamentos')
            .select('*, clientes(nome), servicos(nome, valor)')
            .eq('id', agendamentoId)
            .eq('barbearia_id', profileData?.barbearia_id)
            .maybeSingle();
          if (agError) throw agError;
          setInitialAppointment(ag);
        }
      } catch (error) {
        console.error('[CaixaPage] Falha ao validar acesso:', error);
        setAuthError('Nao foi possivel validar seu acesso profissional agora.');
      } finally {
        setLoading(false);
      }
    }
    checkUser();
  }, [router, agendamentoId]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-12 h-12 border-4 border-[#D6B47A] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (authError) return <ProtectedRouteError message={authError} />;

  return (
    <div className="space-y-8">
      <ProfessionalMobileHeader
        icon={ShoppingCart}
        title="PDV"
        subtitle="Venda rapida, carrinho e pagamento"
      />

      <div className="hidden lg:block">
         <h2 className="text-3xl font-black text-white uppercase tracking-tight">Terminal PDV</h2>
         <p className="text-sm text-white/40 font-bold uppercase tracking-widest mt-1">Venda rápida e checkout profissional</p>
      </div>

      <CheckoutPOS 
        barbeariaId={profile?.barbearia_id} 
        onSaleCompleted={() => undefined} 
        initialAppointment={initialAppointment}
      />
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

export default function CaixaPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-[#D6B47A] border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <CaixaContent />
    </Suspense>
  );
}
