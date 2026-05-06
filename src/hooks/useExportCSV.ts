/* eslint-disable */
import { useCallback } from 'react';

interface ExportOptions {
  filename: string;
  headers: string[];   // Nomes amigáveis que aparecerão na primeira linha
  data: any[];         // Array de objetos
  keys: string[];      // Chaves dos objetos correspondentes aos headers na mesma ordem
}

export function useExportCSV() {
  const exportToCSV = useCallback(({ filename, headers, data, keys }: ExportOptions) => {
    // Escape e formatação de valores para CSV
    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      // Se tiver vírgula, aspas ou quebra de linha, envolve em aspas duplas
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    // Constrói o conteúdo CSV
    const csvRows = [];
    
    // 1. Linha de Headers
    csvRows.push(headers.map(escapeCSV).join(','));

    // 2. Linhas de Dados
    data.forEach(item => {
      const row = keys.map(k => {
        // Suporte para keys aninhadas, ex: "clientes.nome"
        const value = k.split('.').reduce((acc, part) => acc && acc[part], item);
        return escapeCSV(value);
      });
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    
    // BOM para forçar o Excel a ler em UTF-8
    const BOM = '\uFEFF';
    
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().getTime()}.csv`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  return { exportToCSV };
}
