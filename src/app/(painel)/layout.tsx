import Layout from '@/components/layout/Layout';

export default function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Layout>{children}</Layout>;
}
