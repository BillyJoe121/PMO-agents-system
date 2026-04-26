/**
 * ProjectSummaryView — Módulo 10: Resumen Consolidado (Reporte Ejecutivo)
 * RF-PROJ-09 | RF-F8-07
 * CRÍTICO: Componente estrictamente de solo lectura. No hay inputs, textareas ni botones de mutación.
 * TODO: fetch de todas las tablas uniendo por proyecto_id
 * RF-F8-07: Implementar html2pdf.js o react-to-print para el botón de exportación
 */

import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Printer, FileDown, CheckCircle2, Download, TrendingUp, Users, Layers } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const MATURITY_DATA = [
  { dimension: 'Procesos', value: 78 },
  { dimension: 'Personas', value: 65 },
  { dimension: 'Tecnología', value: 82 },
  { dimension: 'Gobernanza', value: 71 },
  { dimension: 'Estrategia', value: 58 },
  { dimension: 'Cultura', value: 74 },
];

const DELIVERABLES = [
  { name: 'Guía Metodológica Corporativa', phase: 'Fase 7', format: 'PDF / DOCX', available: true },
  { name: 'Matriz de Riesgos V1', phase: 'Fase 8', format: 'XLSX', available: true },
  { name: 'Acta de Constitución PMO', phase: 'Fase 8', format: 'DOCX', available: true },
  { name: 'Dashboard KPIs', phase: 'Fase 8', format: 'XLSX', available: true },
  { name: 'Plantilla de Kickoff', phase: 'Fase 8', format: 'DOCX', available: true },
  { name: 'Cronograma Maestra', phase: 'Fase 8', format: 'XLSX', available: true },
  { name: 'Informe Ejecutivo Consolidado', phase: 'Fase 8', format: 'PDF', available: true },
];

function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90">
          <circle cx="44" cy="44" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
          <circle
            cx="44" cy="44" r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span style={{ fontWeight: 700, fontSize: '1.25rem', color }}>{score}</span>
        </div>
      </div>
      <span className="text-gray-600 text-xs text-center" style={{ fontWeight: 500 }}>{label}</span>
    </div>
  );
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <h2 className="text-gray-900 whitespace-nowrap" style={{ fontWeight: 700, fontSize: '1.125rem' }}>{title}</h2>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom SVG Radar / Spider Chart — avoids recharts PolarGrid duplicate-key bug
// ---------------------------------------------------------------------------
function SpiderChart({ data }: { data: { dimension: string; value: number }[] }) {
  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 90;
  const levels = 4;
  const total = data.length;

  const angle = (i: number) => (Math.PI * 2 * i) / total - Math.PI / 2;
  const point = (i: number, r: number) => ({
    x: cx + r * Math.cos(angle(i)),
    y: cy + r * Math.sin(angle(i)),
  });

  const gridPaths = Array.from({ length: levels }, (_, lvl) => {
    const r = (maxR / levels) * (lvl + 1);
    const pts = data.map((_, i) => point(i, r));
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') + ' Z';
  });

  const dataPath =
    data
      .map((d, i) => {
        const r = (d.value / 100) * maxR;
        const p = point(i, r);
        return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
      })
      .join(' ') + ' Z';

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" style={{ maxHeight: 240 }}>
      {gridPaths.map((d, lvl) => (
        <path key={`grid-${lvl}`} d={d} fill="none" stroke="#e5e7eb" strokeWidth={1} />
      ))}
      {data.map((_, i) => {
        const outer = point(i, maxR);
        return (
          <line key={`axis-${i}`} x1={cx} y1={cy} x2={outer.x.toFixed(2)} y2={outer.y.toFixed(2)} stroke="#e5e7eb" strokeWidth={1} />
        );
      })}
      <path d={dataPath} fill="#030213" fillOpacity={0.15} stroke="#030213" strokeWidth={2} strokeLinejoin="round" />
      {data.map((d, i) => {
        const r = (d.value / 100) * maxR;
        const p = point(i, r);
        return <circle key={`dot-${i}`} cx={p.x} cy={p.y} r={3.5} fill="#030213" />;
      })}
      {data.map((d, i) => {
        const labelR = maxR + 18;
        const p = point(i, labelR);
        const textAnchor = Math.abs(p.x - cx) < 5 ? 'middle' : p.x < cx ? 'end' : 'start';
        return (
          <text key={`label-${i}`} x={p.x.toFixed(2)} y={p.y.toFixed(2)} textAnchor={textAnchor} dominantBaseline="middle" fontSize={10} fontWeight={500} fill="#6b7280">
            {d.dimension}
          </text>
        );
      })}
      {data.map((d, i) => {
        const r = (d.value / 100) * maxR;
        const p = point(i, r);
        return (
          <text key={`val-${i}`} x={p.x.toFixed(2)} y={(p.y - 9).toFixed(2)} textAnchor="middle" fontSize={8} fontWeight={700} fill="#030213">
            {d.value}
          </text>
        );
      })}
    </svg>
  );
}

export default function ProjectSummaryView() {
  // useParams() extrae :id desde la URL dinámica (TODO: usar para queries a Supabase)
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject } = useApp();
  const project = getProject(projectId!);

  if (!project) return null;

  const handleExport = () => {
    // RF-F8-07: Implementar html2pdf.js o react-to-print
    window.print();
  };

  const completedPhases = project.phases.filter(p => p.status === 'completado');
  const idoneidadPhase = project.phases[0];
  const scoreDisplay = idoneidadPhase?.agentDiagnosis?.match(/(\d+)\/100/)?.[1] ?? '78';

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Non-printable action bar */}
      <div className="print:hidden bg-white border-b border-gray-200 px-8 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <button
          onClick={() => navigate(`/dashboard/project/${projectId}`)}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm transition-colors group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Volver al proyecto
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-gray-600 text-sm hover:bg-gray-50 transition-colors"
            style={{ fontWeight: 500 }}
          >
            <Printer size={15} />
            Imprimir
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm hover:opacity-90 transition-opacity"
            style={{ background: '#030213', fontWeight: 600 }}
          >
            <FileDown size={15} />
            Exportar a PDF
          </button>
        </div>
      </div>

      {/* Document */}
      <div className="max-w-5xl mx-auto bg-white p-10 shadow-lg my-8 print:shadow-none print:my-0">

        {/* ── Report Header ── */}
        <div className="flex items-start justify-between mb-8 pb-8 border-b-2 border-gray-200">
          <div>
            {/* Logo placeholder */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white" style={{ background: '#030213' }}>
                <TrendingUp size={22} />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-widest" style={{ fontWeight: 600 }}>Universidad ICESI · PMO Intelligence Platform</p>
                <h1 className="text-gray-900" style={{ fontWeight: 800, fontSize: '1.75rem' }}>
                  Diagnóstico Consolidado de PMO
                </h1>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
              {[
                ['Empresa', project.companyName],
                ['Proyecto', project.projectName],
                ['Fecha de Inicio', new Date(project.startDate).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })],
                ['Fecha de Cierre', completedPhases.length === 8 ? 'Completado' : 'En ejecución'],
                ['Auditores', project.auditors.map(a => a.name).join(', ')],
                ['Estado', project.status === 'completado' ? 'Proyecto Cerrado' : 'En Ejecución'],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-2">
                  <span className="text-gray-400 min-w-[120px]" style={{ fontWeight: 500 }}>{label}:</span>
                  <span className="text-gray-700" style={{ fontWeight: 600 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm ${
              project.status === 'completado'
                ? 'bg-green-100 text-green-700'
                : 'bg-blue-100 text-blue-700'
            }`} style={{ fontWeight: 600 }}>
              <div className={`w-2 h-2 rounded-full ${project.status === 'completado' ? 'bg-green-500' : 'bg-blue-500'}`} />
              {project.status === 'completado' ? 'Proyecto Completado' : 'En Ejecución'}
            </div>
            <p className="text-gray-400 text-xs mt-3">
              {completedPhases.length}/8 fases completadas
            </p>
          </div>
        </div>

        {/* ── Sección 1: Diagnóstico de Idoneidad ── */}
        <div className="mb-10">
          <SectionDivider title="1. Diagnóstico de Idoneidad" />
          <div className="grid grid-cols-4 gap-6 mb-6">
            <div className="col-span-1 flex flex-col items-center justify-center bg-zinc-50 rounded-2xl p-6 border border-zinc-200">
              <ScoreRing score={parseInt(scoreDisplay)} label="Score Final" color="#030213" />
              <span className="text-zinc-700 text-xs mt-2 text-center" style={{ fontWeight: 600 }}>Alta Idoneidad</span>
            </div>
            <div className="col-span-3 space-y-3">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="text-gray-600 text-xs mb-2 uppercase tracking-wide" style={{ fontWeight: 600 }}>Diagnóstico del Agente 1 — Idoneidad</p>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {idoneidadPhase?.agentDiagnosis ?? 'La organización presenta condiciones favorables para la implementación de una PMO. Score de idoneidad 78/100.'}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Estructura', value: '87%', icon: <Layers size={14} /> },
                  { label: 'Liderazgo', value: '91%', icon: <TrendingUp size={14} /> },
                  { label: 'Cultura', value: '74%', icon: <Users size={14} /> },
                ].map(item => (
                  <div key={item.label} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-700">
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">{item.label}</p>
                      <p className="text-gray-800" style={{ fontWeight: 700 }}>{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Sección 2: Entorno y Madurez ── */}
        <div className="mb-10">
          <SectionDivider title="2. Entorno y Madurez Organizacional" />
          <div className="grid grid-cols-2 gap-8">
            {/* Spider Chart */}
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-4" style={{ fontWeight: 600 }}>
                Spider Chart — Dimensiones de Madurez
              </p>
              <div className="flex items-center justify-center" style={{ height: 260 }}>
                <SpiderChart data={MATURITY_DATA} />
              </div>
            </div>

            {/* PMO Type */}
            <div className="flex flex-col gap-4">
              <div className="bg-zinc-900 rounded-2xl p-6 text-white">
                <p className="text-zinc-400 text-xs uppercase tracking-wider mb-2" style={{ fontWeight: 600 }}>Tipo de PMO Recomendada</p>
                <h3 className="text-white mb-2" style={{ fontWeight: 800, fontSize: '1.5rem' }}>PMO Híbrida</h3>
                <p className="text-zinc-300 text-sm leading-relaxed">
                  Combinación de metodologías predictivas para proyectos complejos y marcos ágiles para iniciativas de innovación.
                </p>
              </div>
              <div className="space-y-2">
                {MATURITY_DATA.map(d => (
                  <div key={d.dimension} className="flex items-center gap-3">
                    <span className="text-gray-500 text-xs w-24" style={{ fontWeight: 500 }}>{d.dimension}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${d.value}%`, background: '#030213', opacity: 0.7 + (d.value / 500) }}
                      />
                    </div>
                    <span className="text-gray-700 text-xs w-8 text-right" style={{ fontWeight: 600 }}>{d.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Sección 3: Enfoque Estratégico ── */}
        <div className="mb-10">
          <SectionDivider title="3. Enfoque Estratégico" />
          <div className="space-y-4 text-gray-700 text-sm leading-relaxed">
            <p>
              El análisis estratégico realizado en la Fase 6 determinó que <strong>{project.companyName}</strong> se encuentra
              en una posición óptima para la transición hacia una estructura de PMO robusta. La organización dispone
              del capital humano, la infraestructura tecnológica y el respaldo directivo necesarios para sostener este
              cambio transformacional.
            </p>
            <p>
              La hoja de ruta de implementación contempla tres horizontes: en el corto plazo (0–3 meses), el
              establecimiento del Comité de Gobernanza y la formalización de roles; en el mediano plazo (3–9 meses),
              la estandarización de procesos y la adopción de herramientas de gestión; y en el largo plazo (9–18 meses),
              la madurez sostenida y la medición continua del ROI de proyectos.
            </p>
            <p>
              Las entrevistas ejecutivas revelan una alineación del 89% entre la visión corporativa y los objetivos
              de la PMO propuesta, constituyendo una fortaleza diferencial que facilitará la adopción cultural del
              nuevo modelo de gobernanza.
            </p>
          </div>
        </div>

        {/* ── Sección 4: Entregables ── */}
        <div className="mb-6">
          <SectionDivider title="4. Entregables del Proyecto" />
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left text-gray-500 pb-3 text-xs uppercase tracking-wide" style={{ fontWeight: 600 }}>Documento</th>
                <th className="text-left text-gray-500 pb-3 text-xs uppercase tracking-wide" style={{ fontWeight: 600 }}>Fase</th>
                <th className="text-left text-gray-500 pb-3 text-xs uppercase tracking-wide" style={{ fontWeight: 600 }}>Formato</th>
                <th className="text-right text-gray-500 pb-3 text-xs uppercase tracking-wide print:hidden" style={{ fontWeight: 600 }}>Descarga</th>
              </tr>
            </thead>
            <tbody>
              {DELIVERABLES.map((d, i) => (
                <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-gray-50/60' : ''}`}>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
                      <span className="text-gray-800" style={{ fontWeight: 500 }}>{d.name}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-gray-500 text-xs">{d.phase}</td>
                  <td className="py-3 pr-4">
                    <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded" style={{ fontWeight: 500 }}>
                      {d.format}
                    </span>
                  </td>
                  <td className="py-3 text-right print:hidden">
                    <button className="flex items-center gap-1 text-zinc-600 hover:text-zinc-900 text-xs ml-auto transition-colors" style={{ fontWeight: 500 }}>
                      <Download size={12} />Descargar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Report Footer */}
        <div className="pt-6 border-t border-gray-200 flex items-center justify-between text-gray-400 text-xs">
          <span>PMO Intelligence Platform · Universidad ICESI</span>
          <span>Generado el {new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          <span>Confidencial</span>
        </div>
      </div>
    </div>
  );
}