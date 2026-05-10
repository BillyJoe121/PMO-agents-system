import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ReactNode } from 'react';
import { ModernTooltip, chartColors, chartFont, phaseChartPalette } from '../../charts';

type DomainScore = {
  score: number;
  nivel: string;
};

type MaturityResult = {
  por_dominio?: Record<string, DomainScore>;
  por_factor?: Record<string, DomainScore>;
  por_fase?: Record<string, DomainScore>;
};

type FullResults = {
  predictiva?: MaturityResult;
  agil?: MaturityResult;
};

type MaturityRow = {
  key: string;
  label: string;
  value: number;
  maturity: string;
};

const maturityLevelPrefixMap: Record<string, number> = {
  inicial: 1,
  repetible: 2,
  definido: 3,
  gestionado: 4,
  optimizado: 5,
};

const maturityLevelNames = ['Inicial', 'Repetible', 'Definido', 'Gestionado', 'Optimizado'];

const domainRows = [
  { key: 'gobernanza', label: 'Gobernanza' },
  { key: 'alcance', label: 'Alcance' },
  { key: 'cronograma', label: 'Cronograma' },
  { key: 'financiero', label: 'Financiero' },
  { key: 'interesados', label: 'Interesados' },
  { key: 'recursos', label: 'Recursos' },
  { key: 'riesgos', label: 'Riesgos' },
];

const focusAreaRows = [
  { key: 'inicio', label: 'Inicio' },
  { key: 'planeacion', label: 'Planeacion' },
  { key: 'ejecucion', label: 'Ejecucion' },
  { key: 'monitoreo_control', label: 'Monitoreo y Control' },
  { key: 'cierre', label: 'Cierre' },
];

function normalizeKey(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'y')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function toFivePointScale(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const scaled = numeric > 5 ? numeric / 20 : numeric;
  return Math.max(0, Math.min(5, Number(scaled.toFixed(1))));
}

function formatOneDecimal(value: unknown) {
  return toFivePointScale(value).toFixed(1);
}

function formatMaturityLabel(label: string, fallbackScore: number) {
  const raw = String(label || '').trim();
  const withoutPrefix = raw.replace(/^\d+\.\s*/, '');
  const normalized = normalizeKey(withoutPrefix).replace(/_/g, ' ');
  const prefix =
    maturityLevelPrefixMap[normalized] ??
    maturityLevelPrefixMap[normalizeKey(withoutPrefix)] ??
    Math.max(1, Math.min(5, Math.round(toFivePointScale(fallbackScore))));
  const display = withoutPrefix || maturityLevelNames[prefix - 1] || 'N/A';
  return `${prefix}. ${display}`;
}

function findScore(map: Record<string, DomainScore> | undefined, key: string): DomainScore | undefined {
  if (!map) return undefined;
  const target = normalizeKey(key);
  const aliases: Record<string, string[]> = {
    financiero: ['finanzas', 'financiera', 'financiero', 'costos', 'presupuesto'],
    riesgos: ['riesgo', 'riesgos', 'gestion_de_riesgos', 'gestion_riesgos'],
    planeacion: ['planeacion', 'planificacion'],
    monitoreo_control: ['monitoreo_control', 'monitoreo_y_control', 'monitoreo', 'control', 'seguimiento_control'],
  };

  for (const [rawKey, value] of Object.entries(map)) {
    const normalized = normalizeKey(rawKey);
    if (normalized === target || aliases[target]?.includes(normalized)) return value;
  }
  return undefined;
}

function buildRows(definitions: { key: string; label: string }[], map: Record<string, DomainScore> | undefined): MaturityRow[] {
  return definitions.map((row) => {
    const data = findScore(map, row.key);
    const value = toFivePointScale(data?.score ?? 0);
    return {
      ...row,
      value,
      maturity: formatMaturityLabel(data?.nivel || '', value),
    };
  });
}

function averageRows(rows: MaturityRow[]) {
  if (!rows.length) return 0;
  return Number((rows.reduce((sum, row) => sum + row.value, 0) / rows.length).toFixed(1));
}

function wrapLabel(value: unknown, maxChars = 12) {
  const words = String(value ?? '').split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) current = word;
    else if (`${current} ${word}`.length <= maxChars) current = `${current} ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function WrappedAxisTick({ x, y, payload }: any) {
  const lines = wrapLabel(payload?.value, 13);
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" fill={chartColors.axis} fontFamily={chartFont.fontFamily} fontSize={11} fontWeight={700}>
        {lines.map((line, index) => (
          <tspan key={line} x={0} dy={index === 0 ? 12 : 13}>{line}</tspan>
        ))}
      </text>
    </g>
  );
}

function MaturityChartPanel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="mb-6 rounded-[1.35rem] border border-[#5454e9]/15 bg-white overflow-hidden" style={{ boxShadow: '0 18px 44px -32px rgba(84,84,233,0.42)' }}>
      <div className="h-1.5 bg-[#5454e9]" />
      <div className="px-5 py-4 border-b border-neutral-100 bg-white">
        <h3 className="text-[16px] tracking-tight text-neutral-950" style={{ fontWeight: 850 }}>{title}</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-neutral-500">{description}</p>
      </div>
      <div className="p-4 md:p-5">{children}</div>
    </section>
  );
}

function MaturityBISection({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: MaturityRow[];
}) {
  const total = averageRows(rows);
  const tableRows = [...rows, { key: 'total_general', label: 'Total general', value: total, maturity: formatMaturityLabel('', total) }];

  return (
    <MaturityChartPanel title={title} description={description}>
      <div className="grid grid-cols-1 gap-5">
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full border-collapse text-xs text-slate-900">
            <thead>
              <tr className="bg-[#5454e9]/[0.07]">
                <th className="border-b border-[#5454e9]/10 px-4 py-3 text-left font-black text-[#3535a8]">Dimension</th>
                <th className="border-b border-[#5454e9]/10 px-4 py-3 text-right font-black text-[#3535a8]">Promedio</th>
                <th className="border-b border-[#5454e9]/10 px-4 py-3 text-left font-black text-[#3535a8]">Nivel</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => {
                const isTotal = row.key === 'total_general';
                return (
                  <tr key={row.key} className={isTotal ? 'bg-[#5454e9]/[0.08] font-black' : 'bg-white'}>
                    <td className="border-b border-slate-100 px-4 py-3">{row.label}</td>
                    <td className="border-b border-slate-100 px-4 py-3 text-right tabular-nums font-black text-slate-950">{formatOneDecimal(row.value)}</td>
                    <td className="border-b border-slate-100 px-4 py-3">
                      <span className="inline-flex rounded-full border border-[#5454e9]/15 bg-[#5454e9]/[0.06] px-2.5 py-1 text-[11px] font-black text-[#3535a8]">
                        {row.maturity}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_0.8fr] gap-5">
          <div className="h-[560px] rounded-2xl border border-slate-200 bg-white px-5 pt-5 pb-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 20, right: 8, left: 4, bottom: 62 }} barCategoryGap={8}>
                <CartesianGrid stroke={chartColors.grid} strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="label"
                  interval={0}
                  height={58}
                  tick={<WrappedAxisTick />}
                />
                <YAxis
                  domain={[0, 5]}
                  ticks={[0, 1, 2, 3, 4, 5]}
                  tickFormatter={(value) => Number(value).toFixed(1)}
                  tick={{ ...chartFont, fill: chartColors.axis, fontSize: 11 }}
                />
                <Tooltip content={<ModernTooltip valueFormatter={(value) => formatOneDecimal(value)} />} />
                <Bar dataKey="value" name="Madurez" radius={[10, 10, 0, 0]} maxBarSize={82} isAnimationActive={false}>
                  {rows.map((row, index) => (
                    <Cell key={row.key} fill={phaseChartPalette[index % phaseChartPalette.length]} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="top"
                    formatter={(value: unknown) => formatOneDecimal(value)}
                    style={{ fill: chartColors.label, fontSize: 12, fontWeight: 800, fontFamily: chartFont.fontFamily }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="h-[430px] rounded-2xl border border-slate-200 bg-white px-3 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={rows} margin={{ top: 26, right: 48, bottom: 26, left: 48 }} outerRadius="76%">
                <PolarGrid stroke={chartColors.grid} />
                <PolarAngleAxis dataKey="label" tick={{ ...chartFont, fill: chartColors.label, fontSize: 11 }} />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 5]}
                  ticks={[0, 1, 2, 3, 4, 5]}
                  tickFormatter={(value) => Number(value).toFixed(1)}
                  tick={{ ...chartFont, fill: chartColors.axis, fontSize: 10 }}
                />
                <Tooltip content={<ModernTooltip valueFormatter={(value) => formatOneDecimal(value)} />} />
                <Radar
                  dataKey="value"
                  name="Madurez"
                  stroke={chartColors.blue}
                  strokeWidth={2.5}
                  fill={chartColors.blue}
                  fillOpacity={0.16}
                  dot={{ r: 3.5, fill: chartColors.blue, stroke: '#fff', strokeWidth: 1.5 }}
                  isAnimationActive={false}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </MaturityChartPanel>
  );
}

export default function MaturityBIDashboard({ results }: { results: FullResults }) {
  const primary = results.predictiva ?? results.agil;
  const domainMap = results.predictiva?.por_dominio ?? results.agil?.por_dominio ?? results.agil?.por_factor ?? primary?.por_dominio;
  const phaseMap = results.predictiva?.por_fase ?? results.agil?.por_fase ?? primary?.por_fase;
  const domainData = buildRows(domainRows, domainMap);
  const focusAreaData = buildRows(focusAreaRows, phaseMap);

  return (
    <div className="mb-6">
      <MaturityBISection
        title="Analisis de madurez por dominio"
        description="Lectura comparativa de capacidades PMO con acentos de color institucional."
        rows={domainData}
      />
      <MaturityBISection
        title="Analisis de madurez por area de enfoque"
        description="Vista de consistencia metodologica por momento del ciclo de vida."
        rows={focusAreaData}
      />
    </div>
  );
}
