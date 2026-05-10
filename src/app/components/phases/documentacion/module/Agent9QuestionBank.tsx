import { motion } from 'motion/react';
import { AlertCircle, ChevronDown, ChevronRight, Clock, Download, Loader2, MessageSquare, RefreshCw, Users } from 'lucide-react';

type Agent9QuestionBankProps = {
  agent9Status: 'idle' | 'processing' | 'done' | 'error';
  agent9Data: any;
  expandedDim: string | null;
  setExpandedDim: (dim: string | null) => void;
  triggerAgent9: () => void;
};

const PERFILES: Record<string, string> = {
  'P-DIR': 'Dirección',
  'P-PMO': 'PMO',
  'P-GP': 'Ger. Proyecto',
  'P-OPS': 'Operativo',
  'P-FIN': 'Financiero',
  'P-TEC': 'Técnico',
  'P-ALL': 'Todos',
};

const PRIORIDAD_COLOR: Record<string, string> = {
  Alta: 'bg-neutral-900 text-white border-neutral-900',
  Media: 'bg-neutral-200 text-neutral-800 border-neutral-300',
  Baja: 'bg-neutral-50 text-neutral-500 border-neutral-200',
};

const DIMENSIONS = [
  { key: 'inicio', label: 'Inicio', prefix: 'DI' },
  { key: 'planeacion', label: 'Planeación', prefix: 'DP' },
  { key: 'ejecucion', label: 'Ejecución', prefix: 'DE' },
  { key: 'monitoreo_control', label: 'Monitoreo y Control', prefix: 'DMC' },
  { key: 'cierre', label: 'Cierre', prefix: 'DC' },
];

function openAgent9RawJson(a9: any) {
  const json = JSON.stringify(a9, null, 2);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html lang="es"><head>
    <meta charset="UTF-8"/>
    <title>Agente 9 · JSON raw</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{background:#0d1117;color:#e6edf3;font-family:'SF Mono','Fira Code',monospace;font-size:13px;line-height:1.65;padding:32px}
      h1{font-size:11px;font-weight:600;color:#7d8590;text-transform:uppercase;letter-spacing:.12em;margin-bottom:20px}
      pre{white-space:pre-wrap;word-break:break-word}
      .k{color:#79c0ff}.s{color:#a5d6ff}.n{color:#f2cc60}.b{color:#ff7b72}
    </style>
  </head><body>
    <h1>Agente 9 &mdash; Recomendaciones para entrevistas &mdash; Respuesta JSON</h1>
    <pre>${json
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"([^"]+)":/g, '<span class="k">"$1"</span>:')
      .replace(/: "([^"]*)"/g, ': <span class="s">"$1"</span>')
      .replace(/: (-?\d+\.?\d*)/g, ': <span class="n">$1</span>')
      .replace(/: (true|false|null)/g, ': <span class="b">$1</span>')
    }</pre>
  </body></html>`);
  win.document.close();
}

function printAgent9Pdf(a9: any) {
  const dims = [
    { key: 'inicio', label: 'Inicio' },
    { key: 'planeacion', label: 'Planeación' },
    { key: 'ejecucion', label: 'Ejecución' },
    { key: 'monitoreo_control', label: 'Monitoreo y Control' },
    { key: 'cierre', label: 'Cierre' },
  ];
  const renderQ = (p: any) => `
    <div class="q">
      <div class="q-head">
        <span class="qid">${p.pregunta_id}</span>
        <span class="qtxt">${p.pregunta_principal}</span>
      </div>
      <div class="q-meta">
        <span class="badge prio-${(p.prioridad || '').toLowerCase()}">${p.prioridad}</span>
      </div>
      ${(p.preguntas_de_profundizacion?.length > 0) ? `<ul class="sub">${p.preguntas_de_profundizacion.map((s: string) => `<li>${s}</li>`).join('')}</ul>` : ''}
      ${p.contexto_para_el_consultor ? `<p class="ctx">${p.contexto_para_el_consultor}</p>` : ''}
    </div>`;
  const sections: string[] = [];
  if (a9.preguntas_apertura?.length > 0) {
    sections.push(`<h2>Preguntas de Apertura <span class="count">${a9.preguntas_apertura.length}</span></h2>${a9.preguntas_apertura.map(renderQ).join('')}`);
  }
  for (const d of dims) {
    const preg = a9.preguntas_por_dimension?.[d.key] ?? [];
    if (preg.length > 0) {
      sections.push(`<h2>${d.label} <span class="count">${preg.length}</span></h2>${preg.map(renderQ).join('')}`);
    }
  }
  if (a9.preguntas_senales_metodologicas?.length > 0) {
    sections.push(`<h2>Señales Metodológicas <span class="count">${a9.preguntas_senales_metodologicas.length}</span></h2>${a9.preguntas_senales_metodologicas.map(renderQ).join('')}`);
  }
  if (a9.instrucciones_para_el_consultor?.advertencias?.length > 0) {
    sections.push(`<h2>Advertencias</h2><ul class="adv">${a9.instrucciones_para_el_consultor.advertencias.map((a: string) => `<li>${a}</li>`).join('')}</ul>`);
  }
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
    <title>Banco de Preguntas — Entrevistas</title>
    <style>
      @page { margin: 20mm 15mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 12px; color: #1a1a1a; line-height: 1.6; padding: 40px; max-width: 800px; margin: 0 auto; }
      h1 { font-size: 18px; font-weight: 700; margin-bottom: 4px; letter-spacing: -0.02em; }
      .subtitle { font-size: 12px; color: #737373; margin-bottom: 6px; }
      .stats { display: flex; gap: 24px; margin-bottom: 28px; padding: 12px 16px; background: #fafafa; border-radius: 10px; border: 1px solid #e5e5e5; }
      .stat-label { font-size: 9px; text-transform: uppercase; letter-spacing: .1em; color: #a3a3a3; font-weight: 500; }
      .stat-value { font-size: 18px; font-weight: 700; color: #171717; }
      h2 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #525252; margin: 24px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #e5e5e5; }
      .count { font-weight: 400; color: #a3a3a3; font-size: 11px; }
      .q { padding: 10px 14px; margin-bottom: 8px; border-radius: 8px; border: 1px solid #f0f0f0; background: #fafafa; page-break-inside: avoid; }
      .q-head { display: flex; gap: 8px; align-items: flex-start; }
      .qid { font-size: 9px; color: #a3a3a3; font-weight: 600; flex-shrink: 0; margin-top: 2px; }
      .qtxt { font-size: 12px; font-weight: 500; color: #262626; }
      .q-meta { margin: 4px 0 0 20px; }
      .badge { display: inline-block; font-size: 9px; padding: 1px 8px; border-radius: 10px; font-weight: 600; }
      .prio-alta { background: #171717; color: #fff; }
      .prio-media { background: #e5e5e5; color: #404040; }
      .prio-baja { background: #fafafa; color: #737373; border: 1px solid #e5e5e5; }
      .sub { margin: 6px 0 0 20px; list-style: none; }
      .sub li { font-size: 11px; color: #525252; padding: 2px 0; padding-left: 12px; position: relative; }
      .sub li::before { content: '›'; position: absolute; left: 0; color: #a3a3a3; }
      .ctx { margin: 4px 0 0 20px; font-size: 10px; color: #737373; font-style: italic; }
      .adv li { font-size: 12px; color: #525252; margin-bottom: 4px; }
      @media print { body { padding: 0; } }
    </style>
  </head><body>
    <h1>Banco de Preguntas para Entrevistas</h1>
    <p class="subtitle">Generado por Agente 9 — ${a9.total_preguntas} preguntas · ${a9.instrucciones_para_el_consultor?.tiempo_estimado_por_entrevista_minutos ?? '—'} min estimados</p>
    <p class="subtitle">${a9.instrucciones_para_el_consultor?.orden_recomendado ?? ''}</p>
    <div class="stats">
      <div><div class="stat-label">Total</div><div class="stat-value">${a9.total_preguntas}</div></div>
      <div><div class="stat-label">Tiempo est.</div><div class="stat-value">${a9.instrucciones_para_el_consultor?.tiempo_estimado_por_entrevista_minutos ?? '—'} min</div></div>
      <div><div class="stat-label">Mín. por sesión</div><div class="stat-value">${a9.instrucciones_para_el_consultor?.preguntas_minimas_recomendadas_por_entrevista ?? '—'}</div></div>
    </div>
    ${sections.join('')}
  </body></html>`;
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

function renderPregunta(p: any) {
  return (
    <div key={p.pregunta_id} className="p-4 rounded-xl bg-neutral-50 border border-neutral-100 space-y-2">
      <div className="flex items-start gap-2">
        <span className="text-[10px] text-neutral-400 tabular-nums mt-0.5 flex-shrink-0" style={{ fontWeight: 600 }}>{p.pregunta_id}</span>
        <p className="text-neutral-800 text-[13px] leading-relaxed flex-1" style={{ fontWeight: 500 }}>{p.pregunta_principal}</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap ml-5">
        <span className={`px-2 py-0.5 rounded-full text-[10px] border ${PRIORIDAD_COLOR[p.prioridad] || 'bg-neutral-100 text-neutral-500 border-neutral-200'}`} style={{ fontWeight: 500 }}>
          {p.prioridad}
        </span>
        <span className="px-2 py-0.5 rounded-full text-[10px] bg-neutral-900 text-white border border-neutral-900" style={{ fontWeight: 500 }}>
          {PERFILES[p.perfil] || p.perfil}
        </span>
      </div>
      {p.preguntas_de_profundizacion?.length > 0 && (
        <ul className="ml-5 space-y-1 pt-1 border-t border-neutral-100">
          {p.preguntas_de_profundizacion.map((pf: string, i: number) => (
            <li key={i} className="flex items-start gap-2 text-[12px] text-neutral-500">
              <ChevronRight size={11} className="flex-shrink-0 mt-0.5 text-neutral-300" />
              {pf}
            </li>
          ))}
        </ul>
      )}
      {p.contexto_para_el_consultor && (
        <p className="ml-5 text-[11px] text-neutral-500 italic border-t border-neutral-100 pt-1">
          {p.contexto_para_el_consultor}
        </p>
      )}
    </div>
  );
}

export function Agent9QuestionBank({ agent9Status, agent9Data, expandedDim, setExpandedDim, triggerAgent9 }: Agent9QuestionBankProps) {
  if (agent9Status === 'idle' || agent9Status === 'processing') {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 flex items-center gap-4">
        <div className="w-9 h-9 rounded-xl bg-neutral-200 flex items-center justify-center flex-shrink-0">
          <Loader2 size={16} className="text-neutral-600 animate-spin" strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500 mb-0.5" style={{ fontWeight: 500 }}>Recomendaciones para las entrevistas</p>
          <p className="text-neutral-700 text-[13px]">Generando recomendaciones para las entrevistas…</p>
        </div>
      </div>
    );
  }

  if (agent9Status === 'error') {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-neutral-200 flex items-center justify-center flex-shrink-0">
            <AlertCircle size={16} className="text-neutral-500" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500 mb-0.5" style={{ fontWeight: 500 }}>Error en recomendaciones</p>
            <p className="text-neutral-600 text-[13px]">No se pudieron generar las recomendaciones para las entrevistas.</p>
          </div>
        </div>
        <button
          onClick={triggerAgent9}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-[12px] bg-white border border-neutral-200 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 transition-all flex-shrink-0"
          style={{ fontWeight: 500 }}
        >
          <RefreshCw size={12} strokeWidth={2} /> Reintentar
        </button>
      </div>
    );
  }

  if (agent9Status !== 'done' || !agent9Data) return null;

  const a9 = agent9Data;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-7 h-7 rounded-lg bg-neutral-900 text-white flex items-center justify-center">
            <MessageSquare size={13} strokeWidth={1.75} />
          </div>
          <span className="text-[11px] uppercase tracking-[0.14em] text-neutral-500" style={{ fontWeight: 500 }}>Recomendaciones para las entrevistas</span>
          <div className="flex-1" />
          <button
            title="Ver respuesta raw del Agente 9 en JSON"
            onClick={() => openAgent9RawJson(a9)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-200/80 rounded-full text-neutral-500 text-[11px] hover:bg-neutral-50 hover:text-neutral-800 transition-colors font-mono"
            style={{ fontWeight: 600, letterSpacing: '-0.02em' }}
          >
            {'{ }'}
          </button>
          <button
            title="Descargar preguntas como PDF"
            onClick={() => printAgent9Pdf(a9)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-900 bg-neutral-900 rounded-full text-white text-[11px] hover:bg-neutral-800 transition-colors"
            style={{ fontWeight: 500 }}
          >
            <Download size={11} strokeWidth={1.75} />
            PDF
          </button>
        </div>
        <p className="text-neutral-700 text-[14px] leading-relaxed mb-5">{a9.summary}</p>

        <div className="grid grid-cols-3 gap-px bg-neutral-200/60 rounded-xl overflow-hidden border border-neutral-200/60">
          <div className="bg-white px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-400" style={{ fontWeight: 500 }}>Total Preguntas</p>
            <p className="mt-1 text-neutral-900 tabular-nums" style={{ fontWeight: 600, fontSize: '1.5rem', letterSpacing: '-0.02em' }}>{a9.total_preguntas}</p>
          </div>
          <div className="bg-white px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-400" style={{ fontWeight: 500 }}>Tiempo estimado</p>
            <div className="flex items-baseline gap-1 mt-1">
              <p className="text-neutral-900 tabular-nums" style={{ fontWeight: 600, fontSize: '1.5rem', letterSpacing: '-0.02em' }}>{a9.instrucciones_para_el_consultor?.tiempo_estimado_por_entrevista_minutos ?? '—'}</p>
              <span className="text-neutral-400 text-[12px]">min</span>
            </div>
          </div>
          <div className="bg-white px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-400" style={{ fontWeight: 500 }}>Mínimas por sesión</p>
            <p className="mt-1 text-neutral-900 tabular-nums" style={{ fontWeight: 600, fontSize: '1.5rem', letterSpacing: '-0.02em' }}>{a9.instrucciones_para_el_consultor?.preguntas_minimas_recomendadas_por_entrevista ?? '—'}</p>
          </div>
        </div>
      </div>

      {a9.preguntas_apertura?.length > 0 && (
        <div className="rounded-2xl border border-neutral-200/70 bg-white p-6" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Users size={14} className="text-neutral-500" strokeWidth={1.75} />
            <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500" style={{ fontWeight: 500 }}>Preguntas de Apertura</p>
            <span className="ml-auto text-[11px] text-neutral-400 tabular-nums">{a9.preguntas_apertura.length} preguntas</span>
          </div>
          <div className="space-y-3">{a9.preguntas_apertura.map(renderPregunta)}</div>
        </div>
      )}

      {DIMENSIONS.map(({ key, label }) => {
        const preguntas = a9.preguntas_por_dimension?.[key] ?? [];
        if (!preguntas.length) return null;
        const isOpen = expandedDim === key;
        return (
          <div key={key} className="rounded-2xl border border-neutral-200/70 bg-white overflow-hidden print:border-none print:shadow-none" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
            <button
              onClick={() => setExpandedDim(isOpen ? null : key)}
              className="w-full flex items-center gap-3 px-6 py-4 hover:bg-neutral-50 transition-colors text-left print:pointer-events-none print:px-0 print:pb-2"
            >
              <div className="w-6 h-6 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0 print:hidden">
                <MessageSquare size={11} className="text-neutral-600" strokeWidth={1.75} />
              </div>
              <p className="flex-1 text-neutral-800 text-[13px] print:text-[15px]" style={{ fontWeight: 600 }}>{label}</p>
              <span className="text-[11px] text-neutral-400 tabular-nums print:hidden">{preguntas.length} preguntas</span>
              <ChevronDown size={13} className={`text-neutral-400 transition-transform duration-200 print:hidden ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <motion.div
              initial={false}
              animate={{
                height: isOpen ? 'auto' : 0,
                opacity: isOpen ? 1 : 0
              }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden print:!h-auto print:!opacity-100 print:!block"
            >
              <div className="px-6 pb-5 pt-1 space-y-3 border-t border-neutral-100 print:px-0 print:border-none">
                {preguntas.map(renderPregunta)}
              </div>
            </motion.div>
          </div>
        );
      })}

      {a9.preguntas_senales_metodologicas?.length > 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50/30 p-6">
          <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500 mb-4" style={{ fontWeight: 500 }}>Señales Metodológicas</p>
          <div className="space-y-3">{a9.preguntas_senales_metodologicas.map(renderPregunta)}</div>
        </div>
      )}

      {a9.instrucciones_para_el_consultor?.advertencias?.length > 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={13} className="text-neutral-500" strokeWidth={1.75} />
            <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-600" style={{ fontWeight: 500 }}>Advertencias para el Consultor</p>
          </div>
          <ul className="space-y-2">
            {a9.instrucciones_para_el_consultor.advertencias.map((adv: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-neutral-700">
                <span className="text-neutral-400 mt-0.5">•</span>{adv}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-neutral-50 border border-neutral-200/60">
        <Clock size={13} className="text-neutral-400 flex-shrink-0" strokeWidth={1.75} />
        <p className="text-[12px] text-neutral-600">
          <span style={{ fontWeight: 500 }}>Orden recomendado: </span>
          {a9.instrucciones_para_el_consultor?.orden_recomendado}
        </p>
      </div>
    </motion.div>
  );
}
