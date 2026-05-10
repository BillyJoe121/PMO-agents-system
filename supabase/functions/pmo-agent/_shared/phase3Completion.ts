const IDONEIDAD_ITEM_RE = /([CEP]\d{1,2})/i;

function cleanIdoneidadItemCode(value: unknown) {
  const match = String(value ?? "").match(IDONEIDAD_ITEM_RE);
  return match ? match[1].toUpperCase() : null;
}

function inferIdoneidadDimension(code: string) {
  if (code.startsWith("C")) return "Cultura";
  if (code.startsWith("E")) return "Equipo";
  if (code.startsWith("P")) return "Proyecto";
  return "N/A";
}

function normalizeIdoneidadScore(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!normalized) return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseCsvRows(csvText: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current.trim());
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

function buildPhase3ItemResults(inputEnvelope: any, csvTexts: string[] = []) {
  const scoreMap = new Map<string, number[]>();

  const addScore = (codeValue: unknown, scoreValue: unknown) => {
    const code = cleanIdoneidadItemCode(codeValue);
    const score = normalizeIdoneidadScore(scoreValue);
    if (!code || score === null) return;
    const scores = scoreMap.get(code) ?? [];
    scores.push(score);
    scoreMap.set(code, scores);
  };

  const respondents = inputEnvelope?.payload?.respondents;
  if (Array.isArray(respondents)) {
    for (const respondent of respondents) {
      const answers = Array.isArray(respondent?.answers) ? respondent.answers : [];
      for (const answer of answers) {
        addScore(answer?.question_code ?? answer?.codigo ?? answer?.item, answer?.answer_score ?? answer?.valor ?? answer?.score);
      }
    }
  }

  for (const csvText of csvTexts) {
    const rows = parseCsvRows(csvText);
    if (rows.length < 2) continue;
    const headers = rows[0].map(cleanIdoneidadItemCode);

    for (const row of rows.slice(1)) {
      row.forEach((cell, index) => {
        const code = headers[index];
        if (code) addScore(code, cell);
      });
    }
  }

  const orderGroup: Record<string, number> = { C: 0, E: 1, P: 2 };
  return [...scoreMap.entries()]
    .map(([item, scores]) => {
      const count = scores.length;
      const sum = scores.reduce((acc, score) => acc + score, 0);
      const promedio = count ? sum / count : 0;
      const variance = count
        ? scores.reduce((acc, score) => acc + Math.pow(score - promedio, 2), 0) / count
        : 0;
      const zona = promedio < 4 ? "agil" : promedio < 8 ? "hibrido" : "predictivo";

      return {
        item,
        dimension: inferIdoneidadDimension(item),
        promedio: Number(promedio.toFixed(1)),
        minimo: Math.min(...scores),
        maximo: Math.max(...scores),
        desviacion_estandar: Number(Math.sqrt(variance).toFixed(1)),
        zona,
        factor_critico: promedio <= 3 || promedio >= 8,
        numero_respuestas: count,
      };
    })
    .sort((a, b) => {
      const groupDelta = (orderGroup[a.item[0]] ?? 9) - (orderGroup[b.item[0]] ?? 9);
      if (groupDelta !== 0) return groupDelta;
      return (Number(a.item.slice(1)) || 0) - (Number(b.item.slice(1)) || 0);
    });
}

export function withCompletedPhase3Items(diagnosis: unknown, inputEnvelope: any, csvTexts: string[] = []) {
  const deterministicItems = buildPhase3ItemResults(inputEnvelope, csvTexts);
  if (deterministicItems.length === 0 || typeof diagnosis !== "object" || diagnosis === null) return diagnosis;

  const wrapper = diagnosis as Record<string, any>;
  const inner = typeof wrapper.diagnosis === "object" && wrapper.diagnosis !== null
    ? wrapper.diagnosis
    : wrapper;

  const currentItems = Array.isArray(inner.resultados_por_item) ? inner.resultados_por_item : [];
  if (currentItems.length >= deterministicItems.length) return diagnosis;

  inner.resultados_por_item = deterministicItems;
  inner._resultados_por_item_fuente = "calculado_en_edge_function";

  if (typeof wrapper.metadata === "object" && wrapper.metadata !== null) {
    wrapper.metadata.agent_id = "agente-3";
  }

  return diagnosis;
}

