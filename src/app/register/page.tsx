'use client';

import { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, Scissors, User, Store } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Sign Up User e passar os meta dados (O Banco cria a Barbearia via Trigger)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            shop_name: shopName,
          }
        }
      });

      if (authError) throw authError;

      alert('Cadastro realizado com sucesso! Verifique seu e-mail para confirmar a conta.');
      router.push('/login');
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="glass w-full max-w-md rounded-2xl p-8 shadow-2xl">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 neon-border">
            <Scissors className="h-8 w-8 text-accent" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Criar Conta</h1>
          <p className="text-muted text-sm mt-1">Comece a gerir sua barbearia hoje</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-danger/10 p-3 text-sm text-danger border border-danger/20">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted px-1">
              Nome Completo
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-border bg-card/50 py-3 pl-11 pr-4 text-white placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                placeholder="Ex: Allan Martins"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted px-1">
              Nome da Barbearia
            </label>
            <div className="relative">
              <Store className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
              <input
                type="text"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="w-full rounded-xl border border-border bg-card/50 py-3 pl-11 pr-4 text-white placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                placeholder="Ex: Stilo's Barber Shop"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted px-1">
              E-mail
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-border bg-card/50 py-3 pl-11 pr-4 text-white placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                placeholder="seu@email.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted px-1">
              Senha
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-card/50 py-3 pl-11 pr-12 text-white placeholder-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors"
                title={showPassword ? "Esconder senha" : "Ver senha"}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-accent py-4 mt-4 font-bold text-black transition-all hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(0,255,136,0.4)] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading ? 'Criando conta...' : 'Cadastrar'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Já tem uma conta?{' '}
          <a href="/login" className="font-medium text-accent hover:underline">
            Faça login
          </a>
        </p>
      </div>
    </div>
  );
}
