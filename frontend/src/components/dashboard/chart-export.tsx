'use client';

import { useCallback, useRef, RefObject } from 'react';
import { Download, Image as ImageIcon, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ============================================================================
// Types
// ============================================================================
interface ExportData {
  headers: string[];
  rows: (string | number)[][];
  filename: string;
}

interface ChartExportProps {
  chartRef: RefObject<HTMLDivElement | null>;
  exportData: ExportData;
  title: string;
}

// ============================================================================
// Utilities
// ============================================================================
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function toCSV(data: ExportData): string {
  const { headers, rows } = data;
  const csvRows = [
    headers.join(','),
    ...rows.map((row) =>
      row
        .map((cell) => {
          const str = String(cell);
          // Escape quotes and wrap in quotes if contains comma
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(',')
    ),
  ];
  return csvRows.join('\n');
}

async function exportToPNG(element: HTMLElement, filename: string): Promise<void> {
  // Dynamic import html2canvas to avoid SSR issues
  const html2canvas = (await import('html2canvas')).default;

  // Find SVG and convert to canvas
  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2, // Higher resolution
    logging: false,
    useCORS: true,
  });

  // Convert to PNG and download
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `${filename}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ============================================================================
// Component: ChartExportButton
// ============================================================================
export function ChartExportButton({ chartRef, exportData, title }: ChartExportProps) {
  const handleExportCSV = useCallback(() => {
    const csv = toCSV(exportData);
    downloadFile(csv, `${exportData.filename}.csv`, 'text/csv;charset=utf-8;');
  }, [exportData]);

  const handleExportPNG = useCallback(async () => {
    if (chartRef.current) {
      await exportToPNG(chartRef.current, exportData.filename);
    }
  }, [chartRef, exportData.filename]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title={`Esporta ${title}`}>
          <Download className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportPNG}>
          <ImageIcon className="h-4 w-4 mr-2" />
          Esporta come PNG
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportCSV}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Esporta come CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================================
// Hook: useChartExport
// ============================================================================
export function useChartExport() {
  const chartRef = useRef<HTMLDivElement>(null);

  const exportToCSV = useCallback((data: ExportData) => {
    const csv = toCSV(data);
    downloadFile(csv, `${data.filename}.csv`, 'text/csv;charset=utf-8;');
  }, []);

  const exportToPNGFromRef = useCallback(async (filename: string) => {
    if (chartRef.current) {
      await exportToPNG(chartRef.current, filename);
    }
  }, []);

  return {
    chartRef,
    exportToCSV,
    exportToPNG: exportToPNGFromRef,
  };
}

export default ChartExportButton;
