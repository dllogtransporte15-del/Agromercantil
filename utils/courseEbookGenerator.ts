import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { COURSE_CHAPTERS, COURSE_PHASES, CourseChapter, CoursePhaseNumber } from './shipperCourseData';

const COLORS = {
  charcoalDark: [18, 16, 15] as [number, number, number],
  charcoal: [35, 32, 30] as [number, number, number],
  charcoalMuted: [87, 81, 77] as [number, number, number],
  gold: [212, 175, 55] as [number, number, number],
  goldDeep: [166, 113, 66] as [number, number, number],
  goldSoft: [250, 245, 230] as [number, number, number],
  ivory: [250, 248, 246] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  border: [224, 218, 209] as [number, number, number],
  emerald: [16, 185, 129] as [number, number, number],
  emeraldSoft: [236, 253, 245] as [number, number, number],
  emeraldText: [6, 95, 70] as [number, number, number],
  amberSoft: [255, 251, 235] as [number, number, number],
  amberText: [146, 64, 14] as [number, number, number],
  textDark: [24, 22, 21] as [number, number, number],
  textBody: [55, 51, 48] as [number, number, number],
  textMuted: [120, 113, 107] as [number, number, number]
};

function sanitizeText(text: string): string {
  // jsPDF Helvetica padrão suporta Latin-1; substitui setas/emojis especiais por equivalentes nítidos
  return text
    .replace(/➔|→/g, '->')
    .replace(/←/g, '<-')
    .replace(/—/g, '-')
    .replace(/•/g, '•')
    .replace(/[^\x20-\xFF\n]/g, '')
    .trim();
}

export async function generateShipperCourseEbookPDF(phase?: CoursePhaseNumber): Promise<void> {
  const chaptersToInclude = phase
    ? COURSE_CHAPTERS.filter((c) => c.phase === phase)
    : COURSE_CHAPTERS;
  const phasesToRender: CoursePhaseNumber[] = phase ? [phase] : [1, 2];
  const phaseInfo = phase ? COURSE_PHASES[phase] : null;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210
  const pageHeight = doc.internal.pageSize.getHeight(); // 297
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  // =========================================================================
  // 1. CAPA EDITORIAL PREMIUM
  // =========================================================================
  doc.setFillColor(...COLORS.charcoalDark);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Faixas geométricas douradas laterais e superiores
  doc.setFillColor(...COLORS.gold);
  doc.rect(0, 0, 5, pageHeight, 'F');
  doc.rect(0, 0, pageWidth, 2.5, 'F');

  // Detalhe geométrico sutil no canto superior direito
  doc.setFillColor(35, 32, 30);
  doc.circle(pageWidth - 20, 35, 48, 'F');
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.4);
  doc.circle(pageWidth - 20, 35, 48, 'S');

  // Selo Academy
  doc.setFillColor(42, 36, 26);
  doc.setDrawColor(...COLORS.gold);
  doc.roundedRect(margin + 4, 28, 76, 9, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.gold);
  doc.text('DLLOG TRANSPORTES ACADEMY', margin + 9, 34);

  // Título Principal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...COLORS.white);
  doc.text('MANUAL DO EMBARCADOR', margin + 4, 70);
  doc.setFontSize(22);
  doc.setTextColor(...COLORS.gold);
  if (phase === 1) {
    doc.text('FASE 1 • OPERAÇÃO LOGÍSTICA', margin + 4, 83);
  } else if (phase === 2) {
    doc.text('FASE 2 • TRIBUTOS & REFORMA', margin + 4, 83);
  } else {
    doc.text('EDIÇÃO COMPLETA • FASE 1 & 2', margin + 4, 83);
  }

  // Linha divisória dourada
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(1.2);
  doc.line(margin + 4, 92, margin + 65, 92);

  // Subtítulo Editorial
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(214, 208, 198);
  const coverSubtitle = phaseInfo
    ? phaseInfo.description
    : 'Guia Completo de Operação Logística no Agronegócio, Dimensionamento de Frota, Créditos Fiscais e Reforma Tributária (EC 132/2023 • LC 214/2025).';
  const subtitleLines = doc.splitTextToSize(sanitizeText(coverSubtitle), contentWidth - 8);
  doc.text(subtitleLines, margin + 4, 105);

  // Cards de Destaque das Fases na Capa
  const drawCoverPhaseCard = (yPos: number, badge: string, title: string, desc: string) => {
    doc.setFillColor(28, 25, 23);
    doc.setDrawColor(70, 62, 52);
    doc.setLineWidth(0.35);
    doc.roundedRect(margin + 4, yPos, contentWidth - 4, 34, 3, 3, 'FD');

    doc.setFillColor(...COLORS.gold);
    doc.rect(margin + 4, yPos, 2.2, 34, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.gold);
    doc.text(badge.toUpperCase(), margin + 10, yPos + 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(...COLORS.white);
    doc.text(sanitizeText(title), margin + 10, yPos + 15.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(180, 174, 165);
    const wrapped = doc.splitTextToSize(sanitizeText(desc), contentWidth - 18);
    doc.text(wrapped.slice(0, 2), margin + 10, yPos + 22);
  };

  if (phase === 1) {
    drawCoverPhaseCard(144, COURSE_PHASES[1].badge, COURSE_PHASES[1].title, COURSE_PHASES[1].subtitle);
  } else if (phase === 2) {
    drawCoverPhaseCard(144, COURSE_PHASES[2].badge, COURSE_PHASES[2].title, COURSE_PHASES[2].subtitle);
  } else {
    drawCoverPhaseCard(142, 'Fase 1 • Módulos 00 a 06', COURSE_PHASES[1].title, COURSE_PHASES[1].description);
    drawCoverPhaseCard(184, 'Fase 2 • Módulos 07 a 12', COURSE_PHASES[2].title, COURSE_PHASES[2].description);
  }

  // Rodapé da Capa
  doc.setDrawColor(60, 54, 48);
  doc.setLineWidth(0.3);
  doc.line(margin + 4, pageHeight - 34, pageWidth - margin, pageHeight - 34);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...COLORS.gold);
  const editionLabel = phase
    ? `E-book Oficial Fase ${phase} • ${chaptersToInclude.length} Módulos`
    : `Edição Digital Completa • ${chaptersToInclude.length} Módulos`;
  doc.text(editionLabel, margin + 4, pageHeight - 25);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(168, 162, 158);
  doc.text(
    `Gerado em ${new Date().toLocaleDateString('pt-BR')} • DLLOG Transportes`,
    margin + 4,
    pageHeight - 18
  );

  // =========================================================================
  // 2. SUMÁRIO EXECUTIVO (TABLE OF CONTENTS)
  // =========================================================================
  doc.addPage();
  let y = 24;

  doc.setFillColor(...COLORS.ivory);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.charcoalDark);
  doc.text('SUMÁRIO DO E-BOOK', margin, y);
  y += 3;
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.9);
  doc.line(margin, y, margin + 45, y);
  y += 10;

  const renderTocPhase = (phaseNum: 1 | 2) => {
    const phaseInfo = COURSE_PHASES[phaseNum];
    const chapters = COURSE_CHAPTERS.filter((c) => c.phase === phaseNum);

    if (y > pageHeight - 40) {
      doc.addPage();
      doc.setFillColor(...COLORS.ivory);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      y = 24;
    }

    doc.setFillColor(...COLORS.charcoal);
    doc.roundedRect(margin, y, contentWidth, 10, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.gold);
    doc.text(sanitizeText(phaseInfo.title.toUpperCase()), margin + 4, y + 6.5);
    y += 13;

    chapters.forEach((ch) => {
      if (y > pageHeight - 22) {
        doc.addPage();
        doc.setFillColor(...COLORS.ivory);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        y = 24;
      }

      doc.setFillColor(...COLORS.white);
      doc.setDrawColor(...COLORS.border);
      doc.setLineWidth(0.25);
      doc.roundedRect(margin, y, contentWidth, 9.5, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...COLORS.goldDeep);
      doc.text(`MÓD. ${ch.number}`, margin + 3, y + 6);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.8);
      doc.setTextColor(...COLORS.textDark);
      const titleTrunc = sanitizeText(ch.title).slice(0, 74);
      doc.text(titleTrunc, margin + 23, y + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...COLORS.textMuted);
      doc.text(ch.readTime, pageWidth - margin - 3, y + 6, { align: 'right' });

      y += 11;
    });

    y += 4;
  };

  phasesToRender.forEach(renderTocPhase);

  // =========================================================================
  // 3. PÁGINAS DE CONTEÚDO DOS MÓDULOS
  // =========================================================================
  const startNewContentPage = () => {
    doc.addPage();
    doc.setFillColor(...COLORS.ivory);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    return 24;
  };

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageHeight - 20) {
      y = startNewContentPage();
    }
  };

  const renderChapter = (chapter: CourseChapter) => {
    y = startNewContentPage();

    // Hero Banner do Módulo
    const summaryLines = doc.splitTextToSize(sanitizeText(chapter.summary), contentWidth - 10);
    const titleLines = doc.splitTextToSize(sanitizeText(chapter.title), contentWidth - 10);
    const bannerHeight = 20 + titleLines.length * 6.5 + summaryLines.length * 4.5;

    doc.setFillColor(...COLORS.charcoalDark);
    doc.roundedRect(margin, y, contentWidth, bannerHeight, 3, 3, 'F');
    doc.setFillColor(...COLORS.gold);
    doc.rect(margin, y, 3, bannerHeight, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.gold);
    doc.text(
      `FASE ${chapter.phase} • MÓDULO ${chapter.number} • LEITURA ${chapter.readTime.toUpperCase()}`,
      margin + 6,
      y + 7.5
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5);
    doc.setTextColor(...COLORS.white);
    doc.text(titleLines, margin + 6, y + 14.5);

    const summaryStartY = y + 14.5 + titleLines.length * 6.5 + 1;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(214, 208, 198);
    doc.text(summaryLines, margin + 6, summaryStartY);

    y += bannerHeight + 8;

    // Seções do Módulo
    chapter.sections.forEach((sec) => {
      ensureSpace(18);

      // Título da Seção
      doc.setFillColor(...COLORS.gold);
      doc.rect(margin, y + 0.5, 2, 5.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...COLORS.charcoalDark);
      const secTitleLines = doc.splitTextToSize(sanitizeText(sec.title), contentWidth - 5);
      doc.text(secTitleLines, margin + 4.5, y + 4.8);
      y += secTitleLines.length * 5.2 + 3.5;

      // Parágrafos
      sec.content.forEach((para) => {
        const cleanPara = sanitizeText(para);
        if (!cleanPara) return;
        const lines = doc.splitTextToSize(cleanPara, contentWidth - 2);
        const blockH = lines.length * 4.6 + 2.2;
        ensureSpace(blockH);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.3);
        doc.setTextColor(...COLORS.textBody);
        doc.text(lines, margin + 1, y + 3.5);
        y += blockH;
      });

      // Tabela Comparativa
      if (sec.table && sec.table.rows.length > 0) {
        ensureSpace(24);
        y += 2;
        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [sec.table.headers.map(sanitizeText)],
          body: sec.table.rows.map((row) => row.map(sanitizeText)),
          theme: 'grid',
          styles: {
            font: 'helvetica',
            fontSize: 8,
            cellPadding: 2.5,
            textColor: COLORS.textDark,
            lineColor: COLORS.border,
            lineWidth: 0.2
          },
          headStyles: {
            fillColor: COLORS.charcoal,
            textColor: COLORS.gold,
            fontStyle: 'bold',
            fontSize: 8.2
          },
          alternateRowStyles: {
            fillColor: COLORS.goldSoft
          }
        });
        y = ((doc as any).lastAutoTable?.finalY || y) + 5;
      }

      // Dicas Práticas (Tips)
      if (sec.tips && sec.tips.length > 0) {
        sec.tips.forEach((tip) => {
          const tipLines = doc.splitTextToSize(`DICA PRÁTICA: ${sanitizeText(tip)}`, contentWidth - 10);
          const boxH = tipLines.length * 4.4 + 6;
          ensureSpace(boxH + 2);
          doc.setFillColor(...COLORS.emeraldSoft);
          doc.setDrawColor(...COLORS.emerald);
          doc.setLineWidth(0.3);
          doc.roundedRect(margin, y, contentWidth, boxH, 2, 2, 'FD');
          doc.setFillColor(...COLORS.emerald);
          doc.rect(margin, y, 2.2, boxH, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(...COLORS.emeraldText);
          doc.text(tipLines, margin + 5, y + 5);
          y += boxH + 4;
        });
      }

      // Alerta (Warning)
      if (sec.warning) {
        const warnLines = doc.splitTextToSize(`ATENÇÃO: ${sanitizeText(sec.warning)}`, contentWidth - 10);
        const boxH = warnLines.length * 4.4 + 6;
        ensureSpace(boxH + 2);
        doc.setFillColor(...COLORS.amberSoft);
        doc.setDrawColor(...COLORS.goldDeep);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, y, contentWidth, boxH, 2, 2, 'FD');
        doc.setFillColor(...COLORS.goldDeep);
        doc.rect(margin, y, 2.2, boxH, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...COLORS.amberText);
        doc.text(warnLines, margin + 5, y + 5);
        y += boxH + 4;
      }

      // Nota de Auditoria
      if (sec.auditNote) {
        const auditLines = doc.splitTextToSize(`AUDITORIA: ${sanitizeText(sec.auditNote)}`, contentWidth - 10);
        const boxH = auditLines.length * 4.4 + 6;
        ensureSpace(boxH + 2);
        doc.setFillColor(...COLORS.goldSoft);
        doc.setDrawColor(...COLORS.gold);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, y, contentWidth, boxH, 2, 2, 'FD');
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.2);
        doc.setTextColor(...COLORS.charcoal);
        doc.text(auditLines, margin + 5, y + 5);
        y += boxH + 4;
      }

      y += 3;
    });
  };

  chaptersToInclude.forEach(renderChapter);

  // =========================================================================
  // 4. CABEÇALHO E RODAPÉ EM TODAS AS PÁGINAS DE CONTEÚDO (Página 2 em diante)
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let p = 2; p <= totalPages; p++) {
    doc.setPage(p);

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.goldDeep);
    doc.text(
      phase ? `DLLOG TRANSPORTES ACADEMY • MANUAL DO EMBARCADOR (FASE ${phase})` : 'DLLOG TRANSPORTES ACADEMY • MANUAL DO EMBARCADOR',
      margin,
      11
    );
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.25);
    doc.line(margin, 14, pageWidth - margin, 14);

    // Footer
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.textMuted);
    doc.text(
      phase === 1
        ? 'Conteúdo Oficial • Fase 1: Operação Logística & Embarque Prático'
        : phase === 2
        ? 'Conteúdo Oficial • Fase 2: Tributação, Créditos Fiscais & Reforma Tributária'
        : 'Conteúdo Oficial • Fase 1 Operacional & Fase 2 Reforma Tributária',
      margin,
      pageHeight - 9
    );
    doc.setFont('helvetica', 'bold');
    doc.text(`Página ${p} de ${totalPages}`, pageWidth - margin, pageHeight - 9, { align: 'right' });
  }

  const fileName =
    phase === 1
      ? 'Ebook_Fase_1_Operacao_Logistica_DLLOG.pdf'
      : phase === 2
      ? 'Ebook_Fase_2_Reforma_Tributaria_DLLOG.pdf'
      : 'Ebook_Curso_Embarcador_DLLOG.pdf';
  doc.save(fileName);
}
