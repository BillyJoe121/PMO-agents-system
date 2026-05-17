import type { DocVersion, GuideChapter, PmoType } from './types';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatInlineMarkdown(value: unknown): string {
  return escapeHtml(value).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function htmlParagraphs(value?: string): string {
  const lines = String(value ?? '').split(/\n+/).map(line => line.trim()).filter(Boolean);
  return lines.map(line => `<p>${formatInlineMarkdown(line)}</p>`).join('');
}

function htmlList(items?: string[]): string {
  if (!items?.length) return '';
  return `<ul>${items.map(item => `<li>${formatInlineMarkdown(item).replace(/\n/g, '<br>')}</li>`).join('')}</ul>`;
}

function tableColumnCount(table: NonNullable<GuideChapter['subsections'][number]['table']>): number {
  return Math.max(1, table.headers.length);
}

function generateDownloadHTML(
  chapters: GuideChapter[], org: string, pmoType: PmoType, version: DocVersion
): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });

  const chapHtml = chapters.map(ch => {
    const secHtml = ch.subsections.map(s => {
      const listHtml = htmlList(s.items);
      const tblHtml = s.table
        ? `<div class="table-wrap"><table class="cols-${tableColumnCount(s.table)}"><thead><tr>${s.table.headers.map(h => `<th>${formatInlineMarkdown(h)}</th>`).join('')}</tr></thead>
           <tbody>${s.table.rows.map(r => `<tr>${s.table!.headers.map((_, index) => `<td>${formatInlineMarkdown(r[index] ?? '').replace(/\n/g, '<br>')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
        : '';
      return `<h3>${escapeHtml(s.title)}</h3>${htmlParagraphs(s.content)}${listHtml}${tblHtml}`;
    }).join('');
    return `<div class="chapter"><h2>${ch.number}. ${escapeHtml(ch.title)}</h2><div class="intro">${htmlParagraphs(ch.intro)}</div>${secHtml}</div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"><title>Guía Metodológica — ${org}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4; margin: 12mm 10mm; }
  body { font-family: Georgia, serif; font-size: 13px; color: #1f2937; line-height: 1.7; overflow-wrap: anywhere; }
  .cover { background: #5454e9; color: #fff; padding: 80px 60px; min-height: 200px; }
  .cover h1 { font-size: 2.2em; font-weight: 700; margin-bottom: 12px; }
  .cover p { opacity: 0.7; font-size: 1em; margin-bottom: 6px; }
  .cover .badge { display: inline-block; margin-top: 20px; padding: 6px 16px; border: 1px solid rgba(255,255,255,0.3); border-radius: 999px; font-size: 0.8em; }
  .content { max-width: 800px; margin: 0 auto; padding: 40px 60px 80px; }
  .toc { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin-bottom: 40px; }
  .toc h2 { font-size: 1em; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280; margin-bottom: 12px; }
  .toc-item { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dotted #d1d5db; color: #374151; }
  .chapter { margin-bottom: 48px; break-inside: auto; }
  h2 { font-size: 1.25em; color: #5454e9; font-weight: 700; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #5454e9; }
  h2, h3 { break-after: avoid; }
  h3 { font-size: 1em; color: #374151; font-weight: 700; margin: 20px 0 8px; }
  p { margin-bottom: 12px; color: #374151; }
  .intro p { color: #4b5563; font-style: italic; }
  ul { margin: 8px 0 16px 20px; }
  li { margin-bottom: 5px; }
  .table-wrap { width: 100%; overflow-x: auto; margin: 16px 0; break-inside: auto; }
  table { width: max-content; min-width: 100%; border-collapse: collapse; font-size: 0.76em; table-layout: auto; }
  table.cols-1, table.cols-2, table.cols-3, table.cols-4 { width: 100%; table-layout: fixed; }
  th { background: #5454e9; color: #fff; padding: 8px 12px; text-align: left; }
  td { border: 1px solid #e5e7eb; padding: 7px 12px; vertical-align: top; white-space: normal; overflow-wrap: anywhere; word-break: break-word; }
  tr:nth-child(even) td { background: #f9fafb; }
  .footer { text-align: center; color: #9ca3af; font-size: 0.8em; margin-top: 60px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
  @media print {
    body { font-size: 10.5px; line-height: 1.45; }
    .cover { min-height: auto; padding: 32px 28px; break-after: page; }
    .content { max-width: none; width: 100%; padding: 0; }
    .toc { break-after: page; }
    .chapter { margin-bottom: 28px; }
    h2 { font-size: 1.12em; margin-top: 10px; }
    h3 { font-size: 1em; margin-top: 14px; }
    p { margin-bottom: 8px; }
    ul { margin-bottom: 10px; }
    li { margin-bottom: 3px; }
    .table-wrap { overflow: visible; margin: 10px 0 14px; }
    table {
      width: 100% !important;
      min-width: 0 !important;
      max-width: 100% !important;
      table-layout: fixed !important;
      font-size: 5.8px;
      line-height: 1.18;
      break-inside: auto;
      page-break-inside: auto;
    }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th, td {
      width: auto !important;
      min-width: 0 !important;
      max-width: none !important;
      padding: 2px 3px;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
      hyphens: auto;
    }
    .print-btn { display: none; }
  }
  @media screen { .print-btn { position: fixed; top: 20px; right: 20px; background: #5454e9; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 13px; } }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">Imprimir / Guardar PDF</button>
<div class="cover">
  <h1>Guía Metodológica<br>para la PMO</h1>
  <p><strong>${escapeHtml(org)}</strong></p>
  <p>PMO Tipo: ${escapeHtml(pmoType)}</p>
  <p>Generada por PMO Intelligence Platform · Agente 7</p>
  <div class="badge">Versión ${version.number} — ${fmt(version.generatedAt)}</div>
</div>
<div class="content">
<div class="toc">
  <h2>Tabla de contenidos</h2>
  ${chapters.map((c, i) => `<div class="toc-item"><span>${c.number}. ${escapeHtml(c.title)}</span><span>${i + 3}</span></div>`).join('')}
</div>
${chapHtml}
<div class="footer">
  Guía Metodológica · ${org} · Versión ${version.number} · ${fmt(version.generatedAt)}<br>
  Generado automáticamente por PMO Intelligence Platform — Agente 7
</div>
</div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------


export { generateDownloadHTML };
