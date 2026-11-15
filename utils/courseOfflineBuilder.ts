import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  COURSE_PHASES,
  COURSE_CHAPTERS,
  QUIZ_QUESTIONS
} from './shipperCourseData';
import {
  VEHICLE_COMBINATION_SPECS,
  ALL_VEHICLE_DIAGRAM_TYPES
} from '../components/VehicleCombinationDiagram';

const OFFLINE_STORAGE_KEY = 'dllog_course_offline_bundle_v1';

export interface OfflinePackStatus {
  saved: boolean;
  savedAt?: string;
  chaptersCount: number;
}

/**
 * Verifica se o pacote offline já foi salvo no dispositivo
 */
export function getCourseOfflineStatus(): OfflinePackStatus {
  try {
    const raw = localStorage.getItem(OFFLINE_STORAGE_KEY);
    if (!raw) return { saved: false, chaptersCount: COURSE_CHAPTERS.length };
    const parsed = JSON.parse(raw);
    return {
      saved: Boolean(parsed?.savedAt),
      savedAt: parsed?.savedAt,
      chaptersCount: COURSE_CHAPTERS.length
    };
  } catch {
    return { saved: false, chaptersCount: COURSE_CHAPTERS.length };
  }
}

/**
 * Salva todos os capítulos, roteiros de áudio, tabelas e diagramas no armazenamento local
 * e no Cache API (Service Worker / PWA) para leitura e audição offline dentro do próprio sistema.
 */
export async function saveCourseToDeviceOfflineCache(): Promise<OfflinePackStatus> {
  const nowStr = new Date().toLocaleString('pt-BR');
  const payload = {
    savedAt: nowStr,
    phases: COURSE_PHASES,
    chapters: COURSE_CHAPTERS,
    quiz: QUIZ_QUESTIONS,
    vehicles: VEHICLE_COMBINATION_SPECS
  };

  try {
    localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('Aviso ao gravar pacote no localStorage:', err);
  }

  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await window.caches.open('dllog-course-offline-v1');
      await cache.addAll(['/', '/curso-embarcador']).catch(() => {});
    } catch {
      // Ignora caso Cache API esteja restrita
    }
  }

  return {
    saved: true,
    savedAt: nowStr,
    chaptersCount: COURSE_CHAPTERS.length
  };
}

/**
 * Gera e baixa a Apostila Completa em PDF (Fase 1 + Fase 2 + Roteiros das Aulas + Tabela de Conjuntos + Gabarito)
 */
export function downloadCourseOfflinePDF(): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 18;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 16) {
      doc.addPage();
      y = 18;
    }
  };

  // Capa / Cabeçalho Institucional
  doc.setFillColor(28, 25, 23);
  doc.rect(0, 0, pageWidth, 42, 'F');
  doc.setFillColor(178, 124, 38);
  doc.rect(0, 40, pageWidth, 2, 'F');

  doc.setTextColor(251, 191, 36);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('DLLOG TRANSPORTES ACADEMY • APOSTILA OFICIAL COMPLETA (OFFLINE)', margin, 14);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.text('Curso Profissional para Embarcador (Fase 1 & Fase 2)', margin, 24);

  doc.setTextColor(214, 211, 209);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(
    'Operação Logística, Conjuntos Veiculares, Pesos de Balança, Tributos, Créditos Fiscais e Reforma Tributária (CBS/IBS)',
    margin,
    33
  );

  y = 50;

  // Tabela Técnica dos 10 Conjuntos Veiculares
  doc.setTextColor(28, 25, 23);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('1. Guia Visual e Técnico de Conjuntos Veiculares e Pesos por Eixo', margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    headStyles: { fillColor: [178, 124, 38], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7.5, textColor: [40, 40, 40] },
    alternateRowStyles: { fillColor: [250, 248, 246] },
    head: [['Conjunto Veicular', 'Eixos', 'Soma na Balança', 'PBT', 'Carga Líquida', 'Placas / Engate']],
    body: ALL_VEHICLE_DIAGRAM_TYPES.map((vKey) => {
      const v = VEHICLE_COMBINATION_SPECS[vKey];
      return [
        v.shortTitle,
        `${v.axlesCount} eixos`,
        v.formulaText,
        `${v.pbtTons.toFixed(1).replace('.', ',')} t`,
        v.netCapacityTons,
        v.platesRequired
      ];
    })
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Capítulos (Módulos 00 a 12)
  COURSE_CHAPTERS.forEach((ch) => {
    ensureSpace(35);

    // Banner do Módulo
    doc.setFillColor(ch.phase === 1 ? 76 : 146, ch.phase === 1 ? 29 : 64, ch.phase === 1 ? 149 : 14);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 12, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(`FASE ${ch.phase} • MÓDULO ${ch.number}: ${ch.title.toUpperCase()}`, margin + 3, y + 7.5);
    y += 16;

    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    const subLines = doc.splitTextToSize(`${ch.subtitle} (Leitura: ${ch.readTime} | Aula em Áudio: ${ch.audioDuration})`, pageWidth - margin * 2);
    doc.text(subLines, margin, y);
    y += subLines.length * 4.5 + 2;

    // Resumo Executivo
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(28, 25, 23);
    doc.setFontSize(9);
    const sumLines = doc.splitTextToSize(`Resumo Executivo: ${ch.summary}`, pageWidth - margin * 2);
    ensureSpace(sumLines.length * 4.5 + 4);
    doc.text(sumLines, margin, y);
    y += sumLines.length * 4.5 + 3;

    // Roteiro da Aula do Professor (Para leitura offline)
    if (ch.audioScript && ch.audioScript.length > 0) {
      ensureSpace(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(146, 64, 14);
      doc.setFontSize(9);
      doc.text('Roteiro da Aula Explicativa do Professor:', margin, y);
      y += 4.5;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(55, 55, 55);
      doc.setFontSize(8.5);
      ch.audioScript.forEach((p) => {
        const lines = doc.splitTextToSize(`• "${p}"`, pageWidth - margin * 2);
        ensureSpace(lines.length * 4.2 + 2);
        doc.text(lines, margin, y);
        y += lines.length * 4.2 + 1.5;
      });
      y += 2;
    }

    // Seções do Capítulo
    ch.sections.forEach((sec) => {
      ensureSpace(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(28, 25, 23);
      doc.setFontSize(9.5);
      doc.text(`▸ ${sec.title}`, margin, y);
      y += 4.5;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(45, 45, 45);
      doc.setFontSize(8.5);
      sec.content.forEach((p) => {
        const lines = doc.splitTextToSize(p, pageWidth - margin * 2);
        ensureSpace(lines.length * 4.2 + 2);
        doc.text(lines, margin, y);
        y += lines.length * 4.2 + 1.5;
      });

      if (sec.table) {
        ensureSpace(20);
        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          headStyles: { fillColor: [68, 64, 60], textColor: [255, 255, 255], fontSize: 7.5 },
          bodyStyles: { fontSize: 7.2 },
          head: [sec.table.headers],
          body: sec.table.rows
        });
        y = (doc as any).lastAutoTable.finalY + 4;
      }

      if (sec.auditNote) {
        const lines = doc.splitTextToSize(`Auditoria Técnica: ${sec.auditNote}`, pageWidth - margin * 2);
        ensureSpace(lines.length * 4.2 + 3);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(14, 116, 144);
        doc.text(lines, margin, y);
        y += lines.length * 4.2 + 2;
      }

      if (sec.tips && sec.tips.length > 0) {
        const lines = doc.splitTextToSize(`Dica de Ouro: ${sec.tips.join(' | ')}`, pageWidth - margin * 2);
        ensureSpace(lines.length * 4.2 + 3);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(5, 150, 105);
        doc.text(lines, margin, y);
        y += lines.length * 4.2 + 2;
      }

      if (sec.warning) {
        const lines = doc.splitTextToSize(`Atenção Mandatória: ${sec.warning}`, pageWidth - margin * 2);
        ensureSpace(lines.length * 4.2 + 3);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(190, 18, 60);
        doc.text(lines, margin, y);
        y += lines.length * 4.2 + 2;
      }

      y += 2;
    });

    y += 4;
  });

  // Gabarito Comentado do Teste de Fixação
  ensureSpace(30);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(28, 25, 23);
  doc.setFontSize(12);
  doc.text('Gabarito Comentado — Teste de Fixação (Fase 1 & Fase 2)', margin, y);
  y += 6;

  QUIZ_QUESTIONS.forEach((q, idx) => {
    const qLines = doc.splitTextToSize(`${idx + 1}. [Fase ${q.phase}] ${q.question}`, pageWidth - margin * 2);
    const ansLines = doc.splitTextToSize(`✓ Resposta Correta: ${q.options[q.correctIndex]}`, pageWidth - margin * 2);
    const expLines = doc.splitTextToSize(`Explicação: ${q.explanation}`, pageWidth - margin * 2);
    ensureSpace((qLines.length + ansLines.length + expLines.length) * 4.2 + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(28, 25, 23);
    doc.text(qLines, margin, y);
    y += qLines.length * 4.2 + 1;

    doc.setTextColor(5, 150, 105);
    doc.text(ansLines, margin, y);
    y += ansLines.length * 4.2 + 1;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(expLines, margin, y);
    y += expLines.length * 4.2 + 3.5;
  });

  // Numeração de páginas
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `DLLOG Transportes Academy • Curso para Embarcador (Modo Offline) • Página ${p} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  doc.save('Apostila-Completa-Curso-Embarcador-DLLOG.pdf');
}

/**
 * Gera e baixa um Aplicativo Portátil HTML5 100% Autônomo (Mobile-First)
 * que funciona SEM INTERNET no celular ou computador para LER todos os capítulos,
 * ver as tabelas de conjuntos e OUVIR as aulas narradas com voz masculina offline!
 */
export function downloadOfflineInteractiveCourseBundle(): void {
  const courseDataJson = JSON.stringify({
    phases: COURSE_PHASES,
    chapters: COURSE_CHAPTERS,
    vehicles: ALL_VEHICLE_DIAGRAM_TYPES.map(k => VEHICLE_COMBINATION_SPECS[k]),
    quiz: QUIZ_QUESTIONS
  });

  const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
  <title>Curso para Embarcador (Modo Offline • Leitura & Áudio) — DLLOG Transportes</title>
  <style>
    :root {
      --bg: #0f172a;
      --card: #1e293b;
      --border: #334155;
      --gold: #f59e0b;
      --violet: #7c3aed;
      --emerald: #10b981;
      --text: #f8fafc;
      --muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding-bottom: 110px;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 50;
      background: rgba(15, 23, 42, 0.96);
      backdrop-filter: blur(10px);
      border-bottom: 2px solid var(--gold);
      padding: 12px 16px;
    }
    .container { max-width: 960px; margin: 0 auto; padding: 14px; }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .badge-gold { background: var(--gold); color: #0f172a; }
    .badge-emerald { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.4); }
    .controls-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
      margin-top: 10px;
    }
    @media (min-width: 640px) {
      .controls-grid { grid-template-columns: 1.4fr 1fr auto; }
    }
    select, button {
      font: inherit;
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 13px;
      font-weight: 700;
      border: 1px solid var(--border);
      background: var(--card);
      color: var(--text);
      cursor: pointer;
    }
    .btn-gold {
      background: var(--gold);
      color: #0f172a;
      border-color: var(--gold);
      font-weight: 900;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 16px;
      margin-bottom: 16px;
    }
    h1 { font-size: 18px; font-weight: 900; }
    h2 { font-size: 20px; font-weight: 900; margin: 8px 0 4px; color: #fff; }
    h3 { font-size: 16px; font-weight: 800; margin: 16px 0 8px; color: var(--gold); border-left: 4px solid var(--gold); padding-left: 10px; }
    p { margin-bottom: 10px; font-size: 14px; color: #e2e8f0; }
    .script-box {
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.4);
      border-radius: 12px;
      padding: 12px;
      margin: 12px 0;
    }
    .script-chunk {
      padding: 8px 10px;
      border-radius: 8px;
      margin-bottom: 6px;
      cursor: pointer;
      border: 1px solid transparent;
    }
    .script-chunk.active {
      background: rgba(245, 158, 11, 0.22);
      border-color: var(--gold);
      color: #fff;
    }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
    th, td { border: 1px solid var(--border); padding: 8px; text-align: left; }
    th { background: #0f172a; color: var(--gold); }
    .table-wrap { overflow-x: auto; }
    .bottom-player {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(15, 23, 42, 0.98);
      border-top: 2px solid var(--gold);
      padding: 10px 14px;
      z-index: 60;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }
  </style>
</head>
<body>
  <header>
    <div style="max-width:960px;margin:0 auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
        <div>
          <span class="badge badge-gold">DLLOG Transportes Academy</span>
          <span class="badge badge-emerald">✓ Modo 100% Offline (Leitura + Áudio)</span>
        </div>
        <span style="font-size:12px;color:var(--muted);" id="progressText">13 Módulos Disponíveis Offline</span>
      </div>
      <div class="controls-grid">
        <select id="chapterSelect" aria-label="Selecionar Módulo"></select>
        <select id="voiceSelect" aria-label="Selecionar Voz Masculina"></select>
        <div style="display:flex;gap:6px;">
          <button type="button" id="prevBtn">◀ Ant.</button>
          <button type="button" id="nextBtn">Próx. ▶</button>
        </div>
      </div>
    </div>
  </header>

  <main class="container" id="mainContent"></main>

  <div class="bottom-player">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      <button type="button" class="btn-gold" id="playPauseBtn">▶ Ouvir Aula Offline</button>
      <button type="button" id="stopBtn">■ Parar</button>
      <select id="modeSelect" style="padding:8px;">
        <option value="professor">🎙️ Aula do Professor</option>
        <option value="completa">📖 Leitura Integral</option>
      </select>
    </div>
    <div style="display:flex;align-items:center;gap:6px;">
      <span style="font-size:12px;color:var(--muted);">Velocidade:</span>
      <button type="button" class="spd-btn" data-spd="1">1x</button>
      <button type="button" class="spd-btn" data-spd="1.25">1.25x</button>
      <button type="button" class="spd-btn" data-spd="1.5">1.5x</button>
    </div>
  </div>

  <script>
    const DATA = ${courseDataJson};
    let currentChapterIdx = 0;
    let currentChunkIdx = 0;
    let isPlaying = false;
    let audioSpeed = 1.0;
    let audioMode = 'professor';
    let voices = [];
    let selectedVoiceURI = '';
    let stopFlag = false;
    let timerId = null;

    function humanizeText(raw) {
      if (!raw) return '';
      return raw
        .replace(/⇄/g, ', em conexão com ')
        .replace(/→/g, ', portanto, ')
        .replace(/≈/g, 'aproximadamente ')
        .replace(/÷/g, ' dividido por ')
        .replace(/R\\$\\s*(\\d+(?:\\.\\d{3})*),00/g, '$1 reais')
        .replace(/R\\$\\s*(\\d+(?:\\.\\d{3})*,\\d{2})/g, '$1 reais')
        .replace(/(\\d+(?:,\\d+)?)\\s*t\\b/g, '$1 toneladas')
        .replace(/\\bCT-e\\b/gi, 'C T é')
        .replace(/\\bMDF-e\\b/gi, 'M D F é')
        .replace(/\\bNF-e\\b/gi, 'Nota Fiscal Eletrônica')
        .replace(/\\bPIS\\s*\\/\\s*COFINS\\b/gi, 'PIS e Cofins')
        .replace(/\\bCBS\\s*\\/\\s*IBS\\b/gi, 'C B S e I B S')
        .replace(/\\bICMS\\b/g, 'I C M S')
        .replace(/\\bANTT\\b/g, 'A N T T')
        .replace(/\\bRNTRC\\b/g, 'R N T R C');
    }

    function scoreVoice(v) {
      const n = (v.name + ' ' + v.voiceURI).toLowerCase();
      const l = v.lang.toLowerCase();
      if (!l.includes('pt')) return -1000;
      let s = l.includes('pt-br') ? 300 : 100;
      const isFem = ['maria','francisca','thalita','leila','leticia','camila','vitoria','female','feminino'].some(k => n.includes(k));
      const isMale = !isFem && ['antonio','donato','fabio','humberto','julio','nicolau','valerio','daniel','felipe','ricardo','male','masculino'].some(k => n.includes(k));
      const isNat = n.includes('natural') || n.includes('online') || n.includes('neural');
      if (isMale && isNat) s += 1000;
      else if (isMale) s += 700;
      else if (!isFem) s += 300;
      else s -= 500;
      return s;
    }

    function loadVoices() {
      if (!('speechSynthesis' in window)) return;
      const all = window.speechSynthesis.getVoices();
      const pt = all.filter(v => v.lang.toLowerCase().includes('pt'));
      voices = (pt.length ? pt : all).sort((a, b) => scoreVoice(b) - scoreVoice(a));
      const sel = document.getElementById('voiceSelect');
      sel.innerHTML = '';
      voices.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.voiceURI;
        opt.textContent = '🎙️ ' + v.name;
        sel.appendChild(opt);
      });
      if (voices[0] && !selectedVoiceURI) {
        selectedVoiceURI = voices[0].voiceURI;
        sel.value = selectedVoiceURI;
      }
    }

    if ('speechSynthesis' in window) {
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    function getChunks(ch) {
      if (audioMode === 'professor' && ch.audioScript && ch.audioScript.length) {
        return ch.audioScript.map((p, i) => ({ label: 'Explicação do Professor • Parte ' + (i + 1), text: p }));
      }
      const list = [{ label: 'Resumo Executivo', text: ch.title + '. ' + ch.summary }];
      ch.sections.forEach(s => {
        s.content.forEach(p => list.push({ label: s.title, text: p }));
      });
      return list;
    }

    function stopAudio() {
      stopFlag = true;
      if (timerId) clearTimeout(timerId);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      isPlaying = false;
      document.getElementById('playPauseBtn').textContent = '▶ Ouvir Aula Offline';
    }

    function speakChunk(idx) {
      const ch = DATA.chapters[currentChapterIdx];
      const chunks = getChunks(ch);
      if (idx < 0 || idx >= chunks.length) {
        stopAudio();
        return;
      }
      stopFlag = true;
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setTimeout(() => {
        stopFlag = false;
        currentChunkIdx = idx;
        isPlaying = true;
        document.getElementById('playPauseBtn').textContent = '⏸ Pausar Aula';
        renderChapter();
        const u = new SpeechSynthesisUtterance(humanizeText(chunks[idx].text));
        const v = voices.find(x => x.voiceURI === selectedVoiceURI) || voices[0];
        if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = 'pt-BR'; }
        u.pitch = 0.94;
        u.rate = audioSpeed;
        u.onend = () => {
          if (stopFlag) return;
          if (idx + 1 < chunks.length) {
            timerId = setTimeout(() => speakChunk(idx + 1), 220);
          } else {
            stopAudio();
          }
        };
        window.speechSynthesis.speak(u);
      }, 60);
    }

    function renderChapter() {
      const ch = DATA.chapters[currentChapterIdx];
      const chunks = getChunks(ch);
      const main = document.getElementById('mainContent');

      let html = '<div class="card">';
      html += '<span class="badge badge-gold">Fase ' + ch.phase + ' • Módulo ' + ch.number + '</span> ';
      html += '<span style="font-size:12px;color:var(--muted);">⏱ ' + ch.readTime + ' leitura • 🎧 ' + ch.audioDuration + ' áudio</span>';
      html += '<h2>' + ch.title + '</h2>';
      html += '<p style="color:var(--muted);">' + ch.subtitle + '</p>';
      html += '<div style="background:#0f172a;padding:12px;border-radius:10px;border:1px solid var(--border);margin-top:8px;"><strong>Resumo Executivo:</strong> ' + ch.summary + '</div>';

      html += '<div class="script-box"><strong style="color:var(--gold);font-size:12px;text-transform:uppercase;display:block;margin-bottom:6px;">🎧 Roteiro Interativo para Ouvir Offline (Toque em um trecho para ouvir):</strong>';
      chunks.forEach((c, i) => {
        const activeClass = (isPlaying && i === currentChunkIdx) ? 'script-chunk active' : 'script-chunk';
        html += '<div class="' + activeClass + '" onclick="window.__playChunk(' + i + ')"><small style="color:var(--gold);font-weight:800;">' + c.label + '</small><p style="margin:2px 0 0;font-size:13px;">"' + c.text + '"</p></div>';
      });
      html += '</div>';

      ch.sections.forEach(s => {
        html += '<h3>' + s.title + '</h3>';
        s.content.forEach(p => { html += '<p>' + p + '</p>'; });
        if (s.table) {
          html += '<div class="table-wrap"><table><thead><tr>';
          s.table.headers.forEach(h => { html += '<th>' + h + '</th>'; });
          html += '</tr></thead><tbody>';
          s.table.rows.forEach(r => {
            html += '<tr>';
            r.forEach(cell => { html += '<td>' + cell + '</td>'; });
            html += '</tr>';
          });
          html += '</tbody></table></div>';
        }
        if (s.auditNote) html += '<p style="color:#38bdf8;font-weight:700;">🛡️ Auditoria Técnica: ' + s.auditNote + '</p>';
        if (s.tips && s.tips.length) html += '<p style="color:#34d399;font-weight:700;">✨ Dica de Ouro: ' + s.tips.join(' ') + '</p>';
        if (s.warning) html += '<p style="color:#fb7185;font-weight:700;">⚠️ Atenção: ' + s.warning + '</p>';
      });

      html += '</div>';
      main.innerHTML = html;
    }

    window.__playChunk = function(i) { speakChunk(i); };

    const chSel = document.getElementById('chapterSelect');
    DATA.chapters.forEach((ch, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = 'F' + ch.phase + ' • Mód. ' + ch.number + ' — ' + ch.title;
      chSel.appendChild(opt);
    });

    chSel.onchange = (e) => {
      stopAudio();
      currentChapterIdx = parseInt(e.target.value, 10) || 0;
      currentChunkIdx = 0;
      renderChapter();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    document.getElementById('voiceSelect').onchange = (e) => {
      selectedVoiceURI = e.target.value;
      if (isPlaying) speakChunk(currentChunkIdx);
    };

    document.getElementById('modeSelect').onchange = (e) => {
      stopAudio();
      audioMode = e.target.value;
      currentChunkIdx = 0;
      renderChapter();
    };

    document.getElementById('prevBtn').onclick = () => {
      if (currentChapterIdx > 0) {
        stopAudio();
        currentChapterIdx--;
        chSel.value = currentChapterIdx;
        currentChunkIdx = 0;
        renderChapter();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    document.getElementById('nextBtn').onclick = () => {
      if (currentChapterIdx < DATA.chapters.length - 1) {
        stopAudio();
        currentChapterIdx++;
        chSel.value = currentChapterIdx;
        currentChunkIdx = 0;
        renderChapter();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    document.getElementById('playPauseBtn').onclick = () => {
      if (isPlaying) stopAudio();
      else speakChunk(currentChunkIdx);
    };

    document.getElementById('stopBtn').onclick = stopAudio;

    document.querySelectorAll('.spd-btn').forEach(btn => {
      btn.onclick = () => {
        audioSpeed = parseFloat(btn.getAttribute('data-spd')) || 1.0;
        if (isPlaying) speakChunk(currentChunkIdx);
      };
    });

    renderChapter();
  </script>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Curso-Embarcador-DLLOG-Offline-Audio-e-Leitura.html';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
