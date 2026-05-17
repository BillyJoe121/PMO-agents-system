import { FileText } from 'lucide-react';
import type { DocVersion, GuideChapter, PmoType } from './types';

function InlineFormattedText({ text }: { text: string }) {
  const parts = String(text ?? '').split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, index) => {
        const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
        if (boldMatch) {
          return (
            <strong key={index} className="text-gray-800" style={{ fontWeight: 700 }}>
              {boldMatch[1]}
            </strong>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

function FormattedLine({ line }: { line: string }) {
  const colonIndex = line.indexOf(':');
  const label = colonIndex > 0 ? line.slice(0, colonIndex).trim() : '';
  const value = colonIndex > 0 ? line.slice(colonIndex + 1).trimStart() : '';
  const shouldEmphasize = label.length > 0 && label.length <= 36 && !label.includes('http');

  if (!shouldEmphasize) return <InlineFormattedText text={line} />;
  return (
    <>
      <strong className="text-gray-800" style={{ fontWeight: 700 }}>{label}:</strong>
      {value ? <> <InlineFormattedText text={value} /></> : ''}
    </>
  );
}

function TextBlock({ text, className = '' }: { text?: string; className?: string }) {
  const lines = String(text ?? '').split(/\n+/).map(line => line.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      {lines.map((line, index) => (
        <p key={index} className="text-gray-600 text-sm leading-relaxed">
          <FormattedLine line={line} />
        </p>
      ))}
    </div>
  );
}

function CellText({ text }: { text: string }) {
  const lines = String(text ?? '').split(/\n+/).map(line => line.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  return (
    <>
      {lines.map((line, index) => (
        <span key={index} className="block">
          <FormattedLine line={line} />
        </span>
      ))}
    </>
  );
}

function tableColumnWidth(headers: string[], rows: string[][], columnIndex: number) {
  const header = headers[columnIndex] ?? '';
  const longestCell = Math.max(
    header.length,
    ...rows.map(row => String(row[columnIndex] ?? '').length)
  );
  if (longestCell > 220) return 300;
  if (longestCell > 120) return 240;
  if (longestCell > 60) return 190;
  return 125;
}

function tableWidth(headers: string[], rows: string[][]) {
  return headers.reduce((total, _, index) => total + tableColumnWidth(headers, rows, index), 0);
}

function DocumentRenderer({ chapters, org, pmoType, version }: {
  chapters: GuideChapter[]; org: string; pmoType: PmoType; version: DocVersion;
}) {
  const fmt = new Date(version.generatedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
  const accent = '#5454e9';

  return (
    <div className="bg-white shadow-2xl mx-auto print:shadow-none print:w-full print:max-w-none" style={{ width: 'min(794px, 100%)' }}>
      <style>{`
        @media print {
          .phase7-table-wrap {
            overflow: visible !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .phase7-print-table {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            table-layout: fixed !important;
            font-size: 5.8px !important;
            line-height: 1.18 !important;
          }
          .phase7-print-table th,
          .phase7-print-table td {
            width: auto !important;
            min-width: 0 !important;
            max-width: none !important;
            padding: 2px 3px !important;
            white-space: normal !important;
            overflow-wrap: anywhere !important;
            word-break: break-word !important;
            hyphens: auto !important;
          }
          .phase7-print-table tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .phase7-print-table thead {
            display: table-header-group;
          }
        }
      `}</style>
      {/* Cover */}
      <div className="p-12 pb-10 print:p-8 print:pb-7" style={{ background: '#5454e9', color: '#fff' }}>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <FileText size={20} className="text-white" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest opacity-60">PMO Intelligence Platform · Agente 7</p>
          </div>
        </div>
        <h1 className="mb-2" style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1.2 }}>
          Guía Metodológica
        </h1>
        <p className="opacity-70 text-sm mb-1" style={{ fontWeight: 500 }}>{org}</p>
        <p className="opacity-50 text-xs">PMO {pmoType} · Generada por IA · {fmt}</p>
        <div className="mt-6 flex items-center gap-3">
          <span className="px-3 py-1.5 rounded-full text-xs" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', fontWeight: 600 }}>
            Versión {version.number}.0
          </span>
          <span className="px-3 py-1.5 rounded-full text-xs border border-white/20 text-white/70">
            {version.status === 'revisado' ? 'Documento revisado' : 'Borrador para revisión'}
          </span>
        </div>
      </div>

      {/* TOC */}
      <div className="px-12 py-8 border-b border-gray-100 print:px-8 print:py-6 print:break-after-page">
        <h2 className="text-xs uppercase tracking-widest text-gray-400 mb-4" style={{ fontWeight: 700 }}>Tabla de Contenidos</h2>
        <div className="space-y-1.5">
          {chapters.map((ch, i) => (
            <div key={ch.number} className="flex items-center justify-between py-1.5 border-b border-dashed border-gray-100 last:border-0">
              <div className="flex items-center gap-2">
                <ch.icon size={12} className="text-gray-400 flex-shrink-0" />
                <span className="text-gray-700 text-sm" style={{ fontWeight: 500 }}>
                  {ch.number}. {ch.title}
                </span>
              </div>
              <span className="text-gray-400 text-xs">{i + 4}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chapters */}
      <div className="px-12 py-8 space-y-10 print:px-8 print:py-6 print:space-y-8">
        {chapters.map(ch => (
          <div key={ch.number} className="print:break-inside-auto">
            {/* Chapter heading */}
            <div className="flex items-center gap-3 mb-4 pb-3 print:break-after-avoid" style={{ borderBottom: `2px solid ${accent}` }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: accent }}>
                <ch.icon size={14} className="text-white" />
              </div>
              <h2 className="text-gray-900" style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                {ch.number}. {ch.title}
              </h2>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed italic mb-6 print:text-[11px] print:leading-snug print:mb-4">{ch.intro}</p>

            {/* Subsections */}
            <div className="space-y-6">
              {ch.subsections.map((sec, si) => (
                <div key={si} className="print:break-inside-avoid">
                  <h3 className="text-gray-800 text-sm mb-2 print:text-[12px] print:break-after-avoid" style={{ fontWeight: 700 }}>
                    {ch.number}.{si + 1} {sec.title}
                  </h3>
                  <TextBlock text={sec.content} className="mb-3" />

                  {sec.items && (
                    <ul className="space-y-1.5 mb-3">
                      {sec.items.map((item, ii) => (
                        <li key={ii} className="flex items-start gap-2 text-sm text-gray-600 print:text-[10px] print:leading-snug">
                          <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: accent }} />
                          <span className="whitespace-pre-line leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {sec.table && (
                    <div className="phase7-table-wrap overflow-x-auto rounded-xl border border-gray-200 mb-3 print:overflow-visible print:rounded-none print:border-gray-300 print:break-inside-auto">
                      <table
                        className="phase7-print-table text-[10px] print:w-full print:min-w-0 print:table-fixed print:text-[5.8px]"
                        style={{ width: tableWidth(sec.table.headers, sec.table.rows) }}
                      >
                        <thead>
                          <tr style={{ background: '#5454e9' }}>
                            {sec.table.headers.map((h, hi) => (
                              <th
                                key={hi}
                                className="px-3 py-2 text-left text-white align-top leading-snug print:px-1.5 print:py-1 print:leading-tight print:break-words"
                                style={{
                                  fontWeight: 700,
                                  width: tableColumnWidth(sec.table!.headers, sec.table!.rows, hi),
                                  minWidth: tableColumnWidth(sec.table!.headers, sec.table!.rows, hi),
                                  maxWidth: tableColumnWidth(sec.table!.headers, sec.table!.rows, hi),
                                  whiteSpace: 'normal',
                                }}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sec.table.rows.map((row, ri) => (
                            <tr key={ri} style={{ background: ri % 2 === 0 ? '#fff' : '#f9fafb' }}>
                              {sec.table!.headers.map((_, ci) => {
                                const cell = row[ci] ?? '';
                                return (
                                  <td
                                    key={ci}
                                    className="px-3 py-3 text-gray-600 border-t border-gray-100 whitespace-pre-wrap break-words align-top leading-relaxed print:px-1.5 print:py-1 print:leading-tight print:border-gray-300"
                                    style={{
                                      width: tableColumnWidth(sec.table!.headers, sec.table!.rows, ci),
                                      minWidth: tableColumnWidth(sec.table!.headers, sec.table!.rows, ci),
                                      maxWidth: tableColumnWidth(sec.table!.headers, sec.table!.rows, ci),
                                      overflowWrap: 'anywhere',
                                      wordBreak: 'break-word',
                                    }}
                                  >
                                    <CellText text={cell} />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Footer */}
        <div className="pt-6 border-t border-gray-200 text-center">
          <p className="text-gray-400 text-xs">
            Guía Metodológica · {org} · Versión {version.number}.0 · {fmt}<br />
            Generado por PMO Intelligence Platform — Agente 7 · Documento confidencial
          </p>
        </div>
      </div>
    </div>
  );
}

export { DocumentRenderer };
