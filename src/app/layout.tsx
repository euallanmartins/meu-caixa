import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Meu Caixa | Agendamento de Barbearias',
  description: 'Escolha uma barbearia, agende seu horario online e acompanhe seus agendamentos.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full overflow-x-hidden antialiased">
      <body className="min-h-full overflow-x-hidden font-sans">
        {children}
      </body>
    </html>
  );
}
