import { FileText } from 'lucide-react';
import type { DocVersion, GuideChapter, PmoType } from './types';

function TextBlock({ text, className = '' }: { text?: string; className?: string }) {
  const lines = String(text ?? '').split(/\n+/).map(line => line.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      {lines.map((line, index) => (
        <p key={index} className="text-gray-600 text-sm leading-relaxed">
          {line}
        </p>
      ))}
    </div>
  );
}

function DocumentRenderer({ chapters, org, pmoType, version }: {
  chapters: GuideChapter[]; org: string; pmoType: PmoType; version: DocVersion;
}) {
  const fmt = new Date(version.generatedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
  const accent = '#5454e9';

  return (
    <div className="bg-white shadow-2xl mx-auto" style={{ width: 'min(794px, 100%)' }}>
      {/* Cover */}
      <div className="p-12 pb-10" style={{ background: '#5454e9', color: '#fff' }}>
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
      <div className="px-12 py-8 border-b border-gray-100">
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
      <div className="px-12 py-8 space-y-10">
        {chapters.map(ch => (
          <div key={ch.number}>
            {/* Chapter heading */}
            <div className="flex items-center gap-3 mb-4 pb-3" style={{ borderBottom: `2px solid ${accent}` }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: accent }}>
                <ch.icon size={14} className="text-white" />
              </div>
              <h2 className="text-gray-900" style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                {ch.number}. {ch.title}
              </h2>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed italic mb-6">{ch.intro}</p>

            {/* Subsections */}
            <div className="space-y-6">
              {ch.subsections.map((sec, si) => (
                <div key={si}>
                  <h3 className="text-gray-800 text-sm mb-2" style={{ fontWeight: 700 }}>
                    {ch.number}.{si + 1} {sec.title}
                  </h3>
                  <TextBlock text={sec.content} className="mb-3" />

                  {sec.items && (
                    <ul className="space-y-1.5 mb-3">
                      {sec.items.map((item, ii) => (
                        <li key={ii} className="flex items-start gap-2 text-sm text-gray-600">
                          <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: accent }} />
                          <span className="whitespace-pre-line leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {sec.table && (
                    <div className="overflow-x-auto rounded-xl border border-gray-200 mb-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ background: '#5454e9' }}>
                            {sec.table.headers.map((h, hi) => (
                              <th key={hi} className="px-4 py-2.5 text-left text-white" style={{ fontWeight: 600 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sec.table.rows.map((row, ri) => (
                            <tr key={ri} style={{ background: ri % 2 === 0 ? '#fff' : '#f9fafb' }}>
                              {row.map((cell, ci) => (
                                <td key={ci} className="px-4 py-2.5 text-gray-600 border-t border-gray-100 whitespace-pre-line">{cell}</td>
                              ))}
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