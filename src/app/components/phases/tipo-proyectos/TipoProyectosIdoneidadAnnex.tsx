import { Fragment } from 'react';
import { BarChart2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { valueOrEmpty } from '../_shared/PhaseReportVisuals';
import { factorMapping, getIdoneidadItemCode, getIdoneidadItemScore, normalizeIdoneidadDiagnosisItems } from '../idoneidad/idoneidadUtils';

function CustomRadarTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-white border border-neutral-200/80 p-3.5 rounded-xl" style={{ boxShadow: '0 4px 24px -6px rgba(0,0,0,0.12)' }}>
      <div className="mb-2.5 pb-2 border-b border-neutral-100">
        <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold mb-0.5">{data.dimension}</p>
        <p className="text-[12px] text-neutral-900 leading-tight" style={{ fontWeight: 700 }}>{data.fullLabel}</p>
      </div>
      {payload.filter((p: any) => p.dataKey === 'Puntaje').map((entry: any, index: number) => (
        <div key={index} className="flex items-center justify-between gap-6">
          <span className="text-[12px] flex items-center gap-1.5 text-neutral-600 font-medium">
            <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="text-[13px] tabular-nums font-bold" style={{ color: entry.color }}>{Number(entry.value).toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

export default function TipoProyectosIdoneidadAnnex({ phase3AgentData, radarData }: { phase3AgentData: any; radarData: any[] }) {
  if (!phase3AgentData) return null;
  const diagnosisFase3 = phase3AgentData.diagnosis || phase3AgentData;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-[1.35rem] border border-neutral-200 bg-white overflow-hidden">
      <div className="h-1.5 bg-neutral-900" />
      <div className="p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-neutral-50 flex items-center justify-center border border-neutral-200">
            <BarChart2 size={17} className="text-neutral-700" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-neutral-400 mb-1" style={{ fontWeight: 700 }}>Anexo fase 3</p>
            <h2 className="text-neutral-950 text-[18px] tracking-tight" style={{ fontWeight: 750 }}>Resultados de idoneidad</h2>
          </div>
        </div>

        <div className="p-5 bg-white rounded-xl border border-neutral-200/70 overflow-x-auto print:overflow-visible print:border-none print:shadow-none print:p-0 print:break-inside-avoid" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div className="h-[620px] min-w-[720px] w-full print:min-w-0 print:w-full print:h-[620px] mx-auto">
            {radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#374151', fontSize: 11, fontWeight: 700 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickCount={6} />
                  <Radar name="Zona Predictiva (7-10)" dataKey="PredictiveZone" stroke="#5454e9" strokeWidth={1.5} strokeDasharray="5 3" fill="#5454e9" fillOpacity={0.12} isAnimationActive={false} />
                  <Radar name="Zona de transicion (3.1-6.9)" dataKey="TransitionZone" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 3" fill="#f59e0b" fillOpacity={0.18} isAnimationActive={false} />
                  <Radar name="Zona agil (1-3)" dataKey="AgileZone" stroke="#10b981" strokeWidth={1.5} strokeDasharray="5 3" fill="#10b981" fillOpacity={0.22} isAnimationActive={false} />
                  <Radar name="Puntaje Real" dataKey="Puntaje" stroke="#5454e9" strokeWidth={3} fill="#5454e9" fillOpacity={0.18} dot={{ r: 4.5, fill: '#5454e9', stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} />
                  <Tooltip content={<CustomRadarTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 500 }} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-neutral-400">
                <p className="text-[13px]">Grafica no disponible para estos datos</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6 pt-5 border-t border-neutral-100">
            {['cultura', 'equipo', 'proyecto'].map((dim) => {
              const data = (diagnosisFase3?.indicadores || diagnosisFase3?.indicadores_dimension)?.[dim];
              if (!data) return null;
              return (
                <div key={dim} className="bg-neutral-50 p-3 rounded-xl border border-neutral-200/50 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mb-0.5">{dim}</p>
                    <p className="text-[10px] text-neutral-400">Coherencia: {data.coherencia_interna}</p>
                  </div>
                  <p className="text-neutral-900 font-bold text-lg tabular-nums">
                    {typeof data.promedio === 'number' ? Number(data.promedio.toFixed(1)) : data.promedio}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-5 border-t border-neutral-100">
            <h4 className="text-[10px] uppercase tracking-[0.12em] text-neutral-400 font-semibold mb-3">Detalle por factor</h4>
            <div className="overflow-hidden rounded-xl border border-neutral-200/50 bg-white print:overflow-visible print:border-none print:break-inside-avoid">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-neutral-50/80 border-b border-neutral-200/60">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-neutral-500 w-16">Codigo</th>
                    <th className="px-3 py-2 font-semibold text-neutral-500">Factor propuesto</th>
                    <th className="px-3 py-2 font-semibold text-neutral-500">Descripcion tecnica</th>
                    <th className="px-3 py-2 font-semibold text-neutral-500 w-16 text-right">Pts</th>
                    <th className="px-3 py-2 font-semibold text-neutral-500 w-24 text-center">Zona</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100/60">
                  {(() => {
                    const groups: Record<string, any[]> = { Cultura: [], Equipo: [], Proyecto: [], Otros: [] };
                    normalizeIdoneidadDiagnosisItems(diagnosisFase3).forEach((res: any) => {
                      let dim = res.dimension || '';
                      if (!dim) {
                        const code = getIdoneidadItemCode(res);
                        if (code.match(/^C\d/i)) dim = 'Cultura';
                        else if (code.match(/^E\d/i)) dim = 'Equipo';
                        else if (code.match(/^P\d/i)) dim = 'Proyecto';
                        else dim = 'Otros';
                      }
                      const key = Object.keys(groups).find((candidate) => candidate.toLowerCase() === dim.toLowerCase()) || 'Otros';
                      groups[key].push(res);
                    });

                    return [
                      { name: 'Cultura', items: groups.Cultura },
                      { name: 'Equipo', items: groups.Equipo },
                      { name: 'Proyecto', items: groups.Proyecto },
                      { name: 'Otros', items: groups.Otros },
                    ].filter((group) => group.items.length > 0).map((group, groupIndex) => (
                      <Fragment key={groupIndex}>
                        <tr className="bg-neutral-50/30">
                          <td className="px-3 py-1.5 font-bold text-neutral-800 uppercase tracking-tight text-[9px] bg-neutral-50/50" colSpan={5}>{group.name}</td>
                        </tr>
                        {group.items.map((res: any, index: number) => {
                          const score = getIdoneidadItemScore(res) ?? res.promedio;
                          const code = getIdoneidadItemCode(res);
                          const factorInfo = factorMapping[code] || { name: res.factor || 'Factor desconocido', description: res.interpretacion || 'Sin descripcion' };
                          const zoneColor = score <= 3
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : score < 7
                              ? 'bg-amber-50 text-amber-700 border-amber-100'
                              : 'bg-rose-50 text-rose-700 border-rose-100';
                          const zoneText = score <= 3 ? 'Agil' : score < 7 ? 'Transicion' : 'Predictivo';
                          return (
                            <tr key={`${groupIndex}-${index}`} className="hover:bg-neutral-50/50 transition-colors">
                              <td className="px-3 py-2 pl-5">
                                <span className="text-neutral-500 font-mono text-[10px] bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200">{code}</span>
                              </td>
                              <td className="px-3 py-2"><span className="text-neutral-800 font-medium leading-tight">{factorInfo.name}</span></td>
                              <td className="px-3 py-2"><p className="text-[10px] text-neutral-500 leading-snug">{factorInfo.description}</p></td>
                              <td className="px-3 py-2 tabular-nums text-right font-bold text-neutral-900" style={{ fontSize: '13px' }}>{valueOrEmpty(score)}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`inline-block px-2 py-0.5 text-[9px] uppercase font-bold tracking-wider rounded-md border ${zoneColor}`}>{zoneText}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
