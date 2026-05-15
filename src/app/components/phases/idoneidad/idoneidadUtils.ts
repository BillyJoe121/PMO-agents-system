export function getIdoneidadItemCode(value: any, fallback = 'Item') {
  const raw = String(value?.item ?? value?.codigo ?? value?.question_code ?? value?.factor ?? value?.id ?? fallback);
  const match = raw.match(/^([CEP]\d{1,2})/i);
  return match ? match[1].toUpperCase() : raw;
}

export function getIdoneidadItemScore(value: any) {
  const score = value?.promedio ?? value?.puntaje ?? value?.score ?? value?.valor ?? value?.answer_score;
  const numeric = typeof score === 'number' ? score : Number(score);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : null;
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
  C01: { name: 'Apertura al cambio', description: 'Disposicion organizacional frente a cambios en forma de trabajo, prioridades o decisiones.' },
  C02: { name: 'Autonomia en decisiones', description: 'Capacidad de los equipos para tomar decisiones sin dependencia excesiva de aprobaciones superiores.' },
  C03: { name: 'Confianza entre equipos', description: 'Nivel de confianza operativa entre areas y personas involucradas en proyectos.' },
  C04: { name: 'Orientacion a valor vs. cumplimiento', description: 'Balance entre entregar valor y cumplir planes, procesos o documentacion predefinida.' },
  C05: { name: 'Adaptacion ante imprevistos', description: 'Capacidad de responder ante cambios, bloqueos o nueva informacion durante el proyecto.' },
  C06: { name: 'Tolerancia a la ambiguedad', description: 'Comodidad organizacional para trabajar con informacion incompleta o requisitos evolutivos.' },
  C07: { name: 'Colaboracion entre areas', description: 'Grado de colaboracion transversal entre areas para ejecutar proyectos.' },
  C08: { name: 'Liderazgo participativo', description: 'Nivel de participacion del liderazgo en decisiones colaborativas y aprendizaje del equipo.' },
  C09: { name: 'Aprendizaje continuo', description: 'Presencia de practicas de aprendizaje, retroalimentacion y mejora continua.' },
  C10: { name: 'Orientacion a resultados sobre procesos', description: 'Peso relativo de resultados de negocio frente al seguimiento estricto de procesos.' },
  E01: { name: 'Capacidades tecnicas', description: 'Nivel de capacidades tecnicas disponibles en los equipos para ejecutar proyectos.' },
  E02: { name: 'Experiencia en enfoques agiles', description: 'Experiencia del equipo trabajando con enfoques iterativos o agiles.' },
  E03: { name: 'Acceso al cliente', description: 'Disponibilidad de contacto con cliente o usuario para validar decisiones y entregables.' },
  E04: { name: 'Estructura del equipo', description: 'Claridad y estabilidad de la estructura del equipo de proyecto.' },
  E05: { name: 'Dedicacion de roles', description: 'Nivel de dedicacion de los roles clave a las actividades del proyecto.' },
  E06: { name: 'Nivel de autogestion', description: 'Capacidad del equipo para organizar y coordinar su trabajo.' },
  P01: { name: 'Nivel de incertidumbre en requisitos', description: 'Grado de incertidumbre inicial sobre necesidades, alcance o requerimientos.' },
  P02: { name: 'Frecuencia de cambios esperados', description: 'Frecuencia esperada de cambios durante el ciclo de vida del proyecto.' },
  P03: { name: 'Viabilidad de entrega iterativa', description: 'Factibilidad de entregar resultados por incrementos o versiones parciales.' },
  P04: { name: 'Criticidad y riesgo del producto', description: 'Nivel de criticidad, riesgo o impacto de fallos del producto o servicio.' },
  P05: { name: 'Claridad del alcance desde el inicio', description: 'Nivel de claridad inicial del alcance, objetivos y entregables.' },
};
