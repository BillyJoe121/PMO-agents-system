const IDONEIDAD_ITEM_RE = /([CEP]\d{2})/i;

const ITEM_LABELS: Record<string, string> = {
  C01: "Apertura al cambio",
  C02: "Autonomia en decisiones",
  C03: "Confianza entre equipos",
  C04: "Orientacion a valor vs. cumplimiento",
  C05: "Adaptacion ante imprevistos",
  C06: "Tolerancia a la ambiguedad",
  C07: "Colaboracion entre areas",
  C08: "Liderazgo participativo",
  C09: "Aprendizaje continuo",
  C10: "Orientacion a resultados sobre procesos",
  E01: "Capacidades tecnicas",
  E02: "Experiencia en enfoques agiles",
  E03: "Acceso al cliente",
  E04: "Estructura del equipo",
  E05: "Dedicacion de roles",
  E06: "Nivel de autogestion",
  P01: "Nivel de incertidumbre en requisitos",
  P02: "Frecuencia de cambios esperados",
  P03: "Viabilidad de entrega iterativa",
  P04: "Criticidad y riesgo del producto",
  P05: "Claridad del alcance desde el inicio",
};

const EXPECTED_ITEMS = [
  "C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08", "C09", "C10",
  "E01", "E02", "E03", "E04", "E05", "E06",
  "P01", "P02", "P03", "P04", "P05",
];

const DIMENSION_ITEMS: Record<string, string[]> = {
  cultura: EXPECTED_ITEMS.filter((item) => item.startsWith("C")),
  equipo: EXPECTED_ITEMS.filter((item) => item.startsWith("E")),
  proyecto: EXPECTED_ITEMS.filter((item) => item.startsWith("P")),
};

type ScoreRecord = {
  respondent_id: string;
  name: string;
  role: string;
  code: string;
  score: number;
  source: string;
};

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

function dimensionKey(code: string) {
  if (code.startsWith("C")) return "cultura";
  if (code.startsWith("E")) return "equipo";
  if (code.startsWith("P")) return "proyecto";
  return "general";
}

function normalizeIdoneidadScore(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!normalized) return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function round(value: number, decimals: number) {
  return Number(value.toFixed(decimals));
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function std(values: number[]) {
  const avg = average(values);
  if (avg === null) return 0;
  const variance = values.reduce((acc, value) => acc + Math.pow(value - avg, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function zoneFromScore(score: number | null) {
  if (score === null) return "sin_datos";
  if (score <= 3) return "agil";
  if (score < 7) return "transicion";
  return "predictivo";
}

function zoneLabel(zone: string) {
  if (zone === "agil") return "Zona agil";
  if (zone === "predictivo") return "Zona predictiva";
  if (zone === "transicion") return "Zona de transicion";
  return "No disponible";
}

function coherenceFromStd(value: number) {
  if (value <= 1.5) return "Alta";
  if (value <= 2.5) return "Media";
  return "Baja";
}

function behaviorFromStd(value: number) {
  if (value <= 1.5) return "consistente";
  if (value <= 2.5) return "en_transicion";
  return "polarizado";
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

function emptyItemRecord() {
  return Object.fromEntries(EXPECTED_ITEMS.map((item) => [item, 0]));
}

function collectRawScores(inputEnvelope: any, csvTexts: string[] = []) {
  const records: ScoreRecord[] = [];
  const invalidAlerts: string[] = [];
  const respondentMap = new Map<string, { respondent_id: string; name: string; role: string; scores: Record<string, number> }>();

  const addScore = (respondentId: string, name: string, role: string, codeValue: unknown, scoreValue: unknown, source: string) => {
    const code = cleanIdoneidadItemCode(codeValue);
    const score = normalizeIdoneidadScore(scoreValue);
    if (!code || !EXPECTED_ITEMS.includes(code)) return;

    if (!respondentMap.has(respondentId)) {
      respondentMap.set(respondentId, { respondent_id: respondentId, name, role, scores: {} });
    }

    if (score === null || score < 1 || score > 10) {
      invalidAlerts.push(`${respondentId} - ${code}: score fuera de rango o invalido (${String(scoreValue)})`);
      return;
    }

    records.push({ respondent_id: respondentId, name, role, code, score, source });
    respondentMap.get(respondentId)!.scores[code] = score;
  };

  const respondents = inputEnvelope?.payload?.respondents;
  if (Array.isArray(respondents)) {
    for (const [index, respondent] of respondents.entries()) {
      const respondentId = respondent?.respondent_id ?? `r-${String(index + 1).padStart(3, "0")}`;
      const name = respondent?.name ?? "No disponible";
      const role = respondent?.role ?? "No disponible";
      const answers = Array.isArray(respondent?.answers) ? respondent.answers : [];
      if (!respondentMap.has(respondentId)) {
        respondentMap.set(respondentId, { respondent_id: respondentId, name, role, scores: {} });
      }
      for (const answer of answers) {
        addScore(
          respondentId,
          name,
          role,
          answer?.question_id ?? answer?.question_code ?? answer?.codigo ?? answer?.item,
          answer?.answer_score ?? answer?.valor ?? answer?.score,
          "online_survey",
        );
      }
    }
  }

  for (const [fileIndex, csvText] of csvTexts.entries()) {
    const rows = parseCsvRows(csvText);
    if (rows.length < 2) continue;
    const headers = rows[0];
    const codes = headers.map(cleanIdoneidadItemCode);
    const nameIndex = headers.findIndex((h) => /nombre/i.test(h));
    const roleIndex = headers.findIndex((h) => /cargo|rol/i.test(h));

    for (const [rowIndex, row] of rows.slice(1).entries()) {
      const respondentId = `csv-${fileIndex + 1}-${String(rowIndex + 1).padStart(3, "0")}`;
      const name = nameIndex >= 0 ? row[nameIndex] || respondentId : respondentId;
      const role = roleIndex >= 0 ? row[roleIndex] || "No disponible" : "No disponible";
      if (!respondentMap.has(respondentId)) {
        respondentMap.set(respondentId, { respondent_id: respondentId, name, role, scores: {} });
      }
      row.forEach((cell, index) => {
        const code = codes[index];
        if (code) addScore(respondentId, name, role, code, cell, "csv");
      });
    }
  }

  return { records, respondents: [...respondentMap.values()], invalidAlerts };
}

function buildDistribution(records: ScoreRecord[], itemCodes: string[]) {
  const selected = records.filter((record) => itemCodes.includes(record.code));
  const total = selected.length;
  const count = (predicate: (score: number) => boolean) => selected.filter((record) => predicate(record.score)).length;
  return {
    porcentaje_agil: total ? round((count((score) => score <= 3) / total) * 100, 1) : 0,
    porcentaje_transicion: total ? round((count((score) => score >= 4 && score <= 6) / total) * 100, 1) : 0,
    porcentaje_predictivo: total ? round((count((score) => score >= 7) / total) * 100, 1) : 0,
  };
}

function buildDeterministicDiagnosis(inputEnvelope: any, csvTexts: string[] = []) {
  const { records, respondents, invalidAlerts } = collectRawScores(inputEnvelope, csvTexts);
  if (!records.length) return null;

  const scoresByItem = new Map<string, ScoreRecord[]>();
  for (const item of EXPECTED_ITEMS) scoresByItem.set(item, []);
  for (const record of records) scoresByItem.get(record.code)?.push(record);

  const itemStats = EXPECTED_ITEMS.map((item) => {
    const itemRecords = scoresByItem.get(item) ?? [];
    const scores = itemRecords.map((record) => record.score);
    const avg = average(scores);
    const deviation = std(scores);
    const zone = zoneFromScore(avg);
    return {
      item,
      dimension: inferIdoneidadDimension(item),
      promedio_raw: avg,
      promedio: avg === null ? null : round(avg, 2),
      minimo: scores.length ? Math.min(...scores) : null,
      maximo: scores.length ? Math.max(...scores) : null,
      desviacion_estandar: round(deviation, 2),
      zona: zone,
      factor_critico: avg !== null && (avg <= 3 || avg >= 7),
      scores,
    };
  });

  const validItemStats = itemStats.filter((item) => item.promedio_raw !== null);
  const missingItems = itemStats.filter((item) => item.promedio_raw === null).map((item) => item.item);
  const allItemsAvailable = missingItems.length === 0;
  const itemAverageValues = validItemStats.map((item) => item.promedio_raw as number);
  const sumAvailableItemAverages = itemAverageValues.reduce((acc, value) => acc + value, 0);
  const suitabilityRaw = allItemsAvailable ? sumAvailableItemAverages / EXPECTED_ITEMS.length : average(itemAverageValues);
  const suitabilityScore = suitabilityRaw === null ? 0 : round(suitabilityRaw, 1);
  const generalZone = zoneFromScore(suitabilityRaw);

  const traceScores = respondents.map((respondent) => {
    const presentScores = EXPECTED_ITEMS
      .map((item) => respondent.scores[item])
      .filter((score) => typeof score === "number");
    return {
      respondent_id: respondent.respondent_id,
      role: respondent.role,
      scores: { ...emptyItemRecord(), ...respondent.scores },
      promedio_individual: presentScores.length ? round(average(presentScores)!, 2) : 0,
    };
  });

  const incompleteRespondents = respondents
    .filter((respondent) => EXPECTED_ITEMS.some((item) => typeof respondent.scores[item] !== "number"))
    .map((respondent) => respondent.respondent_id);

  const zeroVariationRespondents = respondents
    .filter((respondent) => {
      const values = EXPECTED_ITEMS.map((item) => respondent.scores[item]).filter((score) => typeof score === "number");
      return values.length > 1 && new Set(values).size === 1;
    })
    .map((respondent) => respondent.respondent_id);

  const sumByItem = Object.fromEntries(EXPECTED_ITEMS.map((item) => [item, round((scoresByItem.get(item) ?? []).reduce((acc, record) => acc + record.score, 0), 4)]));
  const countByItem = Object.fromEntries(EXPECTED_ITEMS.map((item) => [item, (scoresByItem.get(item) ?? []).length]));
  const rawAvgByItem = Object.fromEntries(EXPECTED_ITEMS.map((item) => {
    const avg = itemStats.find((stat) => stat.item === item)?.promedio_raw;
    return [item, avg === null || avg === undefined ? null : round(avg, 4)];
  }));

  const dimensionSummary = Object.fromEntries(Object.entries(DIMENSION_ITEMS).map(([key, items]) => {
    const dimensionStats = itemStats.filter((stat) => items.includes(stat.item) && stat.promedio_raw !== null);
    const averages = dimensionStats.map((stat) => stat.promedio_raw as number);
    const avg = average(averages);
    const deviation = std(averages);
    const sorted = [...dimensionStats].sort((a, b) => (a.promedio_raw ?? 0) - (b.promedio_raw ?? 0));
    return [key, {
      promedio_raw: avg,
      promedio: avg === null ? 0 : round(avg, 2),
      desviacion_estandar: round(deviation, 2),
      item_mas_bajo: sorted[0]?.item ?? "No disponible",
      item_mas_alto: sorted[sorted.length - 1]?.item ?? "No disponible",
      coherencia_interna: coherenceFromStd(deviation),
    }];
  })) as Record<string, any>;

  const indicadores_agilidad = itemStats
    .filter((item) => item.promedio_raw !== null && item.promedio_raw <= 3)
    .map((item) => ({
      item: item.item,
      dimension: item.dimension,
      promedio: item.promedio,
      interpretacion_del_factor: `${item.item} - ${ITEM_LABELS[item.item]} se ubica en zona agil con promedio ${item.promedio}.`,
    }));

  const indicadores_predictivos = itemStats
    .filter((item) => item.promedio_raw !== null && item.promedio_raw >= 7)
    .map((item) => ({
      item: item.item,
      dimension: item.dimension,
      promedio: item.promedio,
      interpretacion_del_factor: `${item.item} - ${ITEM_LABELS[item.item]} se ubica en zona predictiva con promedio ${item.promedio}.`,
    }));

  const indicadores_hibridos = itemStats
    .filter((item) => item.promedio_raw !== null && item.promedio_raw > 3 && item.promedio_raw < 7 && item.desviacion_estandar <= 2.5)
    .map((item) => ({
      item_o_dimension: item.item,
      promedio: item.promedio,
      desviacion: item.desviacion_estandar,
      interpretacion_del_factor: `${item.item} - ${ITEM_LABELS[item.item]} se ubica en zona de transicion con dispersion ${item.desviacion_estandar}.`,
    }));

  const conflictos = itemStats
    .filter((item) => item.minimo !== null && item.maximo !== null && (item.maximo - item.minimo) >= 5)
    .map((item) => {
      const involved = records
        .filter((record) => record.code === item.item && (record.score === item.minimo || record.score === item.maximo))
        .map((record) => record.role);
      return {
        item: item.item,
        valor_maximo: item.maximo,
        valor_minimo: item.minimo,
        cargos_involucrados: [...new Set(involved)],
        diferencia: round((item.maximo ?? 0) - (item.minimo ?? 0), 2),
      };
    });

  const dimensionPairs = [
    ["Cultura-Equipo", "cultura", "equipo"],
    ["Cultura-Proyecto", "cultura", "proyecto"],
    ["Equipo-Proyecto", "equipo", "proyecto"],
  ];
  const tensiones = dimensionPairs.map(([label, a, b]) => {
    const diff = Math.abs((dimensionSummary[a]?.promedio_raw ?? 0) - (dimensionSummary[b]?.promedio_raw ?? 0));
    const clasificacion = diff > 3 ? "Severa" : diff >= 2 ? "Moderada" : "Leve";
    return {
      par_dimensiones: label,
      diferencia_promedios: round(diff, 2),
      clasificacion,
      interpretacion: `La diferencia cuantitativa entre ${label.toLowerCase()} es ${round(diff, 2)} puntos.`,
    };
  });

  const risks = [];
  if (conflictos.length > 0) {
    risks.push({
      nombre: "Polarizacion de percepciones",
      descripcion: "Se identificaron items con diferencia mayor o igual a 5 puntos entre respuestas.",
      datos_respaldo: conflictos.slice(0, 4).map((item) => `${item.item}: diferencia ${item.diferencia}`),
      nivel: conflictos.length >= 3 ? "Alto" : "Medio",
    });
  }
  if (tensiones.some((tension) => tension.clasificacion === "Severa")) {
    risks.push({
      nombre: "Desalineacion entre dimensiones",
      descripcion: "La encuesta muestra diferencias severas entre dimensiones cuantitativas.",
      datos_respaldo: tensiones.filter((tension) => tension.clasificacion === "Severa").map((tension) => `${tension.par_dimensiones}: ${tension.diferencia_promedios}`),
      nivel: "Alto",
    });
  }
  if (!risks.length) {
    risks.push({
      nombre: "Sin riesgo cuantitativo critico",
      descripcion: "No se identificaron tensiones severas ni conflictos de percepcion mayores con los datos validos.",
      datos_respaldo: [`Desviacion general ${round(std(itemAverageValues), 2)}`],
      nivel: "Bajo",
    });
  }

  const p01 = itemStats.find((item) => item.item === "P01")?.promedio_raw ?? null;
  const p05 = itemStats.find((item) => item.item === "P05")?.promedio_raw ?? null;
  const c09 = itemStats.find((item) => item.item === "C09")?.promedio_raw ?? null;
  const tienePreproyecto = p01 === null || p05 === null ? null : p01 <= 3 && p05 <= 3;
  const tienePostcierre = c09 === null ? null : c09 >= 7;

  const confidence = allItemsAvailable && respondents.length >= 3 && invalidAlerts.length === 0
    ? "Alta"
    : allItemsAvailable && respondents.length > 0
      ? "Media"
      : "Baja";

  const observations = [
    `El score deterministico calculado sobre ${validItemStats.length} items validos es ${suitabilityScore}/10.`,
    `La zona predominante calculada es ${zoneLabel(generalZone)} segun escala invertida 1-10.`,
    missingItems.length ? `Items sin datos validos: ${missingItems.join(", ")}.` : "Los 21 items esperados tienen al menos una respuesta valida.",
    conflictos.length ? `Se identificaron ${conflictos.length} conflictos de percepcion con diferencia >= 5.` : "No se identificaron conflictos de percepcion con diferencia >= 5.",
  ].slice(0, 6);

  const deterministic = {
    summary: `El calculo deterministico ubica la encuesta en ${zoneLabel(generalZone)} con score ${suitabilityScore}/10. Los resultados fueron calculados exclusivamente con answer_score validos en escala 1-10.`,
    suitability_score: suitabilityScore,
    suitability_level: zoneLabel(generalZone),
    zona_predominante_general: zoneLabel(generalZone),
    formato_entrada_detectado: csvTexts.length && respondents.some((r) => !r.respondent_id.startsWith("csv-")) ? "mixto" : csvTexts.length ? "crudos" : "crudos",
    indicadores_agilidad,
    indicadores_predictivos,
    indicadores_hibridos,
    tensiones_criticas_resumen: tensiones.filter((tension) => tension.clasificacion === "Severa").slice(0, 3).map((tension) => `${tension.par_dimensiones}: diferencia ${tension.diferencia_promedios}`),
    numero_encuestados: respondents.length,
    cargos_representados: [...new Set(respondents.map((respondent) => respondent.role).filter(Boolean))],
    calidad_input: {
      items_faltantes: missingItems,
      encuestados_con_datos_incompletos: incompleteRespondents,
      alertas_respuesta_invalida: [...invalidAlerts, ...zeroVariationRespondents.map((id) => `${id}: patron de respuesta con variacion cero`)],
      limitaciones_por_formato: [
        ...(!allItemsAvailable ? ["No fue posible calcular la formula completa de 21 items porque hay items faltantes."] : []),
        ...(inputEnvelope?.payload?.input_method === "offline_file" && !csvTexts.length ? ["El archivo PDF adjunto no puede auditarse aritmeticamente desde el motor deterministico."] : []),
      ],
    },
    trazabilidad_calculo: {
      scores_por_encuestado_por_item: traceScores,
      suma_por_item: sumByItem,
      n_respondentes_por_item: countByItem,
      promedio_por_item_sin_redondear: rawAvgByItem,
      suma_promedios_cultura_10_items: round(DIMENSION_ITEMS.cultura.reduce((acc, item) => acc + (itemStats.find((stat) => stat.item === item)?.promedio_raw ?? 0), 0), 4),
      promedio_dimension_cultura: dimensionSummary.cultura.promedio,
      suma_promedios_equipo_6_items: round(DIMENSION_ITEMS.equipo.reduce((acc, item) => acc + (itemStats.find((stat) => stat.item === item)?.promedio_raw ?? 0), 0), 4),
      promedio_dimension_equipo: dimensionSummary.equipo.promedio,
      suma_promedios_proyecto_5_items: round(DIMENSION_ITEMS.proyecto.reduce((acc, item) => acc + (itemStats.find((stat) => stat.item === item)?.promedio_raw ?? 0), 0), 4),
      promedio_dimension_proyecto: dimensionSummary.proyecto.promedio,
      suma_21_promedios_items: round(sumAvailableItemAverages, 4),
      suitability_score_sin_redondear: suitabilityRaw === null ? 0 : round(suitabilityRaw, 4),
      verificacion_rango_superada: itemStats.every((item) => item.promedio_raw === null || (item.minimo !== null && item.maximo !== null && item.promedio_raw >= item.minimo && item.promedio_raw <= item.maximo)),
    },
    resultados_por_item: validItemStats.map((item) => ({
      item: item.item,
      dimension: item.dimension,
      promedio: item.promedio ?? 0,
      minimo: item.minimo ?? 0,
      maximo: item.maximo ?? 0,
      desviacion_estandar: item.desviacion_estandar,
      zona: item.zona === "sin_datos" ? "transicion" : item.zona,
      factor_critico: item.factor_critico,
    })),
    indicadores: {
      cultura: dimensionSummary.cultura,
      equipo: dimensionSummary.equipo,
      proyecto: dimensionSummary.proyecto,
      general: {
        promedio: suitabilityRaw === null ? 0 : round(suitabilityRaw, 2),
        desviacion_estandar: round(std(itemAverageValues), 2),
        zona_predominante: zoneLabel(generalZone),
        comportamiento: behaviorFromStd(std(itemAverageValues)),
      },
    },
    distribucion: {
      cultura: buildDistribution(records, DIMENSION_ITEMS.cultura),
      equipo: buildDistribution(records, DIMENSION_ITEMS.equipo),
      proyecto: buildDistribution(records, DIMENSION_ITEMS.proyecto),
      general: buildDistribution(records, EXPECTED_ITEMS),
    },
    factores_criticos: {
      alta_afinidad_agil: indicadores_agilidad.map((item) => ({ item: item.item, dimension: item.dimension, promedio: item.promedio, interpretacion: item.interpretacion_del_factor })),
      alta_afinidad_predictiva: indicadores_predictivos.map((item) => ({ item: item.item, dimension: item.dimension, promedio: item.promedio, interpretacion: item.interpretacion_del_factor })),
    },
    alineacion: {
      disponible: respondents.length > 1,
      consenso_por_dimension: {
        cultura: dimensionSummary.cultura.coherencia_interna,
        equipo: dimensionSummary.equipo.coherencia_interna,
        proyecto: dimensionSummary.proyecto.coherencia_interna,
      },
      conflictos_percepcion: conflictos,
    },
    tensiones,
    riesgos: risks,
    nivel_confiabilidad: confidence,
    justificacion_confiabilidad: `Confiabilidad ${confidence}: ${allItemsAvailable ? "cobertura completa de items" : "cobertura parcial de items"} y ${respondents.length} encuestados con datos validos o parcialmente validos.`,
    observations,
    listo_para_integracion: allItemsAvailable && records.length > 0,
    insumos_para_agente_4: {
      indicadores_agilidad,
      indicadores_predictivos,
      indicadores_hibridos,
      zona_predominante_general: zoneLabel(generalZone),
      comportamiento_general: behaviorFromStd(std(itemAverageValues)),
      tiene_preproyecto: tienePreproyecto,
      justificacion_preproyecto: tienePreproyecto === null
        ? "No hay datos suficientes en P01 y P05 para identificar senales de preproyecto."
        : tienePreproyecto
          ? `P01 (${round(p01!, 2)}) y P05 (${round(p05!, 2)}) presentan puntajes bajos que sugieren senales cuantitativas de exploracion previa.`
          : `P01 (${round(p01!, 2)}) y P05 (${round(p05!, 2)}) no presentan conjuntamente la senal cuantitativa definida para preproyecto.`,
      tiene_postcierre: tienePostcierre,
      justificacion_postcierre: tienePostcierre === null
        ? "No hay datos suficientes en C09 para identificar senales de post-cierre."
        : tienePostcierre
          ? `C09 (${round(c09!, 2)}) presenta puntaje alto y sugiere senales cuantitativas asociadas a aprendizaje o seguimiento posterior.`
          : `C09 (${round(c09!, 2)}) no presenta la senal cuantitativa definida para post-cierre.`,
      tensiones_criticas_resumen: tensiones.filter((tension) => tension.clasificacion === "Severa").slice(0, 3).map((tension) => `${tension.par_dimensiones}: diferencia ${tension.diferencia_promedios}`),
      inconsistencias_criticas_resumen: [],
      nivel_confiabilidad: confidence,
    },
  };

  return deterministic;
}

function mergeLimitedStrings(...groups: unknown[][]) {
  const result: string[] = [];
  for (const group of groups) {
    if (!Array.isArray(group)) continue;
    for (const item of group) {
      const text = String(item ?? "").trim();
      if (text && !result.includes(text)) result.push(text);
      if (result.length >= 6) return result;
    }
  }
  return result;
}

export function withCompletedPhase3Items(diagnosis: unknown, inputEnvelope: any, csvTexts: string[] = []) {
  const deterministic = buildDeterministicDiagnosis(inputEnvelope, csvTexts);
  if (!deterministic || typeof diagnosis !== "object" || diagnosis === null) return diagnosis;

  const wrapper = diagnosis as Record<string, any>;
  const inner = typeof wrapper.diagnosis === "object" && wrapper.diagnosis !== null
    ? wrapper.diagnosis
    : wrapper;

  const aiScore = normalizeIdoneidadScore(inner.suitability_score);
  const auditObservations: string[] = [];
  if (aiScore !== null && Math.abs(aiScore - deterministic.suitability_score) > 0.05) {
    auditObservations.push(`Se detecto diferencia entre suitability_score de IA (${aiScore}) y calculo deterministico (${deterministic.suitability_score}); se conservo el calculo deterministico.`);
  }

  const preservedSummary = inner.summary;
  const preservedInterpretation = inner.interpretacion_por_factores;
  const preservedInconsistencies = Array.isArray(inner.inconsistencias) ? inner.inconsistencias : [];

  Object.assign(inner, deterministic);

  if (preservedSummary) inner.summary = preservedSummary;
  if (preservedInterpretation) inner.interpretacion_por_factores = preservedInterpretation;
  inner.inconsistencias = preservedInconsistencies;
  inner.observations = mergeLimitedStrings(auditObservations, deterministic.observations, Array.isArray((wrapper as any).observations) ? (wrapper as any).observations : []);
  inner._calculo_deterministico_fuente = "edge_function_phase3_v4";

  if (typeof wrapper.metadata === "object" && wrapper.metadata !== null) {
    wrapper.metadata.agent_id = "asistente-3";
  }

  return diagnosis;
}
