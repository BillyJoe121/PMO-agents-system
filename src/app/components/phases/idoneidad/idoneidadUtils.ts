export function getIdoneidadItemCode(value: any, fallback = 'Item') {
  const raw = String(value?.item ?? value?.codigo ?? value?.question_code ?? value?.factor ?? value?.id ?? fallback);
  const match = raw.match(/^([CEP]\d{1,2})/i);
  return match ? match[1].toUpperCase() : raw;
}

export function getIdoneidadItemScore(value: any) {
  const score = value?.promedio ?? value?.puntaje ?? value?.score ?? value?.valor ?? value?.answer_score;
  const numeric = typeof score === 'number' ? score : Number(score);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(1)) : null;
}

export function inferIdoneidadDimension(codeOrDimension: string) {
  const value = String(codeOrDimension || '').toUpperCase();
  if (value.startsWith('C') || value.includes('CULTURA')) return 'CULTURA';
  if (value.startsWith('E') || value.includes('EQUIPO')) return 'EQUIPO';
  if (value.startsWith('P') || value.includes('PROYECTO')) return 'PROYECTO';
  return value || 'N/A';
}

export function normalizeIdoneidadItems(source: any): any[] {
  const found: any[] = [];

  const visit = (node: any, fallbackKey?: string) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item));
      return;
    }
    if (typeof node !== 'object') {
      if (fallbackKey && /^[CEP]\d{1,2}/i.test(fallbackKey)) {
        const numeric = Number(node);
        if (Number.isFinite(numeric)) {
          const match = fallbackKey.match(/^([CEP]\d{1,2})/i);
          const code = match ? match[1].toUpperCase() : fallbackKey.toUpperCase();
          found.push({
            item: code,
            dimension: inferIdoneidadDimension(code),
            promedio: Number(numeric.toFixed(1)),
          });
        }
      }
      return;
    }

    const code = getIdoneidadItemCode(node, fallbackKey ?? '');
    const score = getIdoneidadItemScore(node);
    if (score !== null && /^[CEP]\d{1,2}/i.test(code)) {
      const match = code.match(/^([CEP]\d{1,2})/i);
      const cleanCode = match ? match[1].toUpperCase() : code.toUpperCase();
      found.push({
        ...node,
        item: cleanCode,
        dimension: node.dimension ?? inferIdoneidadDimension(cleanCode),
        promedio: score,
      });
    }

    for (const [key, value] of Object.entries(node)) {
      if (typeof value === 'number' || typeof value === 'string') {
        if (/^[CEP]\d{1,2}/i.test(key)) {
          const numeric = Number(value);
          if (Number.isFinite(numeric)) {
            const match = key.match(/^([CEP]\d{1,2})/i);
            const codeFromKey = match ? match[1].toUpperCase() : key.toUpperCase();
            found.push({
              item: codeFromKey,
              dimension: inferIdoneidadDimension(codeFromKey),
              promedio: Number(numeric.toFixed(1)),
            });
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        visit(value, key);
      }
    }
  };

  visit(source);

  const byCode = new Map<string, any>();
  for (const item of found) {
    byCode.set(item.item, item);
  }

  const orderGroup: Record<string, number> = { C: 0, E: 1, P: 2 };
  return [...byCode.values()].sort((a, b) => {
    const ac = a.item;
    const bc = b.item;
    const ag = orderGroup[ac[0]] ?? 9;
    const bg = orderGroup[bc[0]] ?? 9;
    if (ag !== bg) return ag - bg;
    return (Number(ac.slice(1)) || 0) - (Number(bc.slice(1)) || 0);
  });
}

export function normalizeIdoneidadDiagnosisItems(diagnosis: any): any[] {
  // Pass the entire diagnosis object to ensure we find all items regardless of where the agent placed them
  return normalizeIdoneidadItems(diagnosis);
}

// Mapeo de factores de Idoneidad a nombres propuestos y descripciones tecnicas
export const factorMapping: Record<string, { name: string; description: string }> = {
  C01: { name: 'Apropiacion de Agilidad', description: 'Porcentaje de adopcion historica de marcos agiles.' },
  C02: { name: 'Seguridad Psicologica', description: 'Nivel de confianza y entorno colaborativo interno.' },
  C03: { name: 'Alineacion de Patrocinadores', description: 'Grado de entendimiento y soporte de los stakeholders.' },
  C04: { name: 'Confianza en la Entrega', description: 'Fe de los patrocinadores en el ciclo de retroalimentacion.' },
  C05: { name: 'Autonomia Operativa', description: 'Nivel de empoderamiento del equipo para toma de decisiones.' },
  C06: { name: 'Tolerancia a la Incertidumbre', description: 'Disposicion a ajustar estimaciones segun el aprendizaje.' },
  C07: { name: 'Compromiso de Recursos', description: 'Disponibilidad de personal y desjerarquizacion funcional.' },
  C08: { name: 'Priorizacion de Funcionalidad', description: 'Valoracion de la entrega sobre la documentacion exhaustiva.' },
  C09: { name: 'Aceptacion de Valor Incremental', description: 'Disposicion a recibir el producto por etapas.' },
  C10: { name: 'Enfoque en Valor de Negocio', description: 'Medicion de exito basada en valor y no solo en cronograma.' },
  E01: { name: 'Escalabilidad del Equipo', description: 'Tamano y gestion del nucleo de trabajo.' },
  E02: { name: 'Seniory de Roles Clave', description: 'Nivel de experiencia tecnica en posiciones criticas.' },
  E03: { name: 'Alfabetizacion Agil', description: 'Experiencia previa acumulada de los integrantes en agilidad.' },
  E04: { name: 'Cercania con el Cliente', description: 'Frecuencia y calidad del feedback con el negocio.' },
  E05: { name: 'Sincronia del Entorno', description: 'Factibilidad de co-ubicacion fisica o digital sincrona.' },
  E06: { name: 'Autoridad del Product Owner', description: 'Capacidad decisoria del PO sin burocracia de comites.' },
  P01: { name: 'Tasa de Variabilidad', description: 'Porcentaje de cambio mensual en los requisitos.' },
  P02: { name: 'Viabilidad de MVP', description: 'Aceptacion de construccion por minimos viables evaluables.' },
  P03: { name: 'Refinamiento Iterativo', description: 'Apertura a la evolucion de requisitos durante el ciclo.' },
  P04: { name: 'Criticidad del Error', description: 'Magnitud del impacto ante fallos en el producto final.' },
  P05: { name: 'Estabilidad de Alcance', description: 'Claridad y rigidez de los requisitos en la fase inicial.' },
};
