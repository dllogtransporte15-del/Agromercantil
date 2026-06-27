import { jsPDF } from 'jspdf';

export interface FilterDescriptor {
  label: string;
  values: string[];
}

// ─── Color palette (RGB tuples) ──────────────────────────────────────────────
export const PDF_COLORS = {
  primary:      [30,  64, 175] as [number, number, number], // blue-800
  headerBg:     [30,  64, 175] as [number, number, number],
  headerText:   [255, 255, 255] as [number, number, number],
  totalsBg:     [239, 246, 255] as [number, number, number], // blue-50
  totalsText:   [30,  58, 138]  as [number, number, number], // blue-900
  bodyAlt:      [249, 250, 251] as [number, number, number], // gray-50
  bodyText:     [17,  24,  39]  as [number, number, number], // gray-900
  mutedText:    [107, 114, 128] as [number, number, number], // gray-500
  border:       [229, 231, 235] as [number, number, number], // gray-200
};

// ─── Build the standard PDF header and return the Y offset after it ──────────
export function buildPdfHeader(
  doc: jsPDF,
  title: string,
  filters: FilterDescriptor[],
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 10;

  // ── Title bar ────────────────────────────────────────────────────────────
  doc.setFillColor(...PDF_COLORS.primary);
  doc.rect(10, y, pageWidth - 20, 12, 'F');

  doc.setTextColor(...PDF_COLORS.headerText);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, y + 8.5);

  // ── Timestamp (right-aligned) ─────────────────────────────────────────────
  const now = new Date().toLocaleString('pt-BR');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em: ${now}`, pageWidth - 14, y + 8.5, { align: 'right' });

  y += 17;

  // ── Active filters summary ────────────────────────────────────────────────
  const activeFilters = filters.filter(f => f.values.length > 0);
  if (activeFilters.length > 0) {
    doc.setFillColor(239, 246, 255);
    doc.rect(10, y, pageWidth - 20, 7 + (activeFilters.length - 1) * 5.5, 'F');

    doc.setTextColor(...PDF_COLORS.primary);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Filtros aplicados:', 14, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_COLORS.mutedText);

    const parts = activeFilters.map(f => `${f.label}: ${f.values.join(', ')}`);
    const filterText = parts.join('   |   ');

    // Wrap long filter text automatically
    const splitLines = doc.splitTextToSize(filterText, pageWidth - 60);
    splitLines.forEach((line: string, idx: number) => {
      doc.text(line, 14, y + 5 + 5 + idx * 4.5);
    });

    y += 8 + splitLines.length * 4.5 + 4;
  } else {
    // Subtle "no filters" note
    doc.setFontSize(7);
    doc.setTextColor(...PDF_COLORS.mutedText);
    doc.setFont('helvetica', 'italic');
    doc.text('Sem filtros aplicados — exibindo todos os registros.', 14, y + 4);
    y += 10;
  }

  return y;
}

// ─── Currency formatter ───────────────────────────────────────────────────────
export function fmtCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── Number formatter ─────────────────────────────────────────────────────────
export function fmtNumber(value: number, decimals = 2): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
