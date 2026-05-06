/* eslint-disable */
'use client';

// O jsPDF e autoTable serão importados dinamicamente apenas quando a função de exportação for chamada.
// Isso reduz o bundle size inicial em ~200kb.

interface ExportPDFOptions {
  filename: string;
  title: string;
  subtitle?: string;
  headers: string[];
  data: any[];
  keys: string[];
}

export function useExportPDF() {
  const exportToPDF = async ({ filename, title, subtitle, headers, data, keys }: ExportPDFOptions) => {
    // Importação dinâmica (Lazy Loading)
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();
    
    // Configurações Globais
    const pageWidth = doc.internal.pageSize.getWidth();
    const dateStr = new Date().toLocaleString('pt-BR');
    
    // Título Principal
    doc.setFontSize(18);
    doc.setTextColor(20, 20, 20);
    doc.text(title.toUpperCase(), 14, 22);
    
    // Subtítulo / Período
    if (subtitle) {
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(subtitle, 14, 30);
    }
    
    // Linha Separadora
    doc.setDrawColor(230, 230, 230);
    doc.line(14, 35, pageWidth - 14, 35);

    // Preparar dados da tabela
    const tableBody = data.map(item => {
      return keys.map(key => {
        if (key.includes('.')) {
          const parts = key.split('.');
          let val = item;
          for (const part of parts) {
            val = val?.[part];
          }
          return val !== undefined && val !== null ? String(val) : '-';
        }
        
        const val = item[key];
        return val !== undefined && val !== null ? String(val) : '-';
      });
    });

    // Gerar Tabela
    autoTable(doc, {
      startY: 40,
      head: [headers],
      body: tableBody,
      styles: {
        fontSize: 9,
        cellPadding: 3,
        overflow: 'linebreak',
        font: 'helvetica'
      },
      headStyles: {
        fillColor: [30, 30, 30],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'left'
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250]
      },
      margin: { top: 40 },
      didDrawPage: (data) => {
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        const pageCount = doc.internal.pages.length - 1;
        doc.text(
          `Relatório gerado em: ${dateStr} - Página ${pageCount}`,
          14,
          doc.internal.pageSize.getHeight() - 10
        );
      }
    });

    // Download do Arquivo
    doc.save(`${filename}.pdf`);
  };

  return { exportToPDF };
}
