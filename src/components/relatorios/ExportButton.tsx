// === ARQUIVO: src/components/relatorios/ExportButton.tsx ===
'use client';

import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

interface ExportButtonProps {
  filename: string;
  getData: () => Promise<Record<string, unknown>[]>;
  columns: {
    key: string;
    label: string;
    format?: (v: unknown) => string;
  }[];
  periodo?: string; // ex: "Abril 2026"
}

export function ExportButton({ filename, getData, columns, periodo }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (loading) return;
    setLoading(true);

    try {
      // 1. Carregar jsPDF apenas no click (nunca no bundle inicial)
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable')
      ]);

      // 2. Buscar dados
      const rows = await getData();

      // 3. Criar documento
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      // Header
      doc.setFillColor(10, 10, 10);
      doc.rect(0, 0, 210, 30, 'F');
      doc.setTextColor(214, 180, 122); // premium accent
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Meu Caixa Premium', 14, 14);
      doc.setTextColor(200, 200, 200);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Relatório gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 22);
      if (periodo) {
        doc.text(`Período: ${periodo}`, 14, 27);
      }

      // Tabela de dados
      const head = [columns.map(c => c.label)];
      const body = rows.map(row =>
        columns.map(col => {
          const val = row[col.key];
          return col.format ? col.format(val) : String(val ?? '-');
        })
      );

      autoTable(doc, {
        head,
        body,
        startY: 35,
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 4,
          textColor: [30, 30, 30],
        },
        headStyles: {
          fillColor: [74, 222, 128],
          textColor: [10, 10, 10],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [248, 248, 248],
        },
      });

      // 4. Download
      doc.save(`${filename}.pdf`);
    } catch (err) {
      console.error('[ExportButton] Erro ao gerar PDF:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className={`
        flex items-center gap-2 px-4 py-2.5 rounded-xl
        text-[10px] font-black uppercase tracking-widest
        border border-white/10
        transition-all duration-200
        ${loading 
          ? 'bg-white/5 text-white/30 cursor-not-allowed' 
          : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
        }
      `}
    >
      {loading 
        ? <Loader2 size={14} className="animate-spin" />
        : <Download size={14} />
      }
      {loading ? 'Gerando...' : 'Baixar'}
    </button>
  );
}
