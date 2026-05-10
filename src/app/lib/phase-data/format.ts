export function valueOrEmpty(value: unknown, fallback = 'No registrado') {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text.length ? text : fallback;
}

export function toFivePointScale(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const scaled = numeric > 5 ? numeric / 20 : numeric;
  return Math.max(0, Math.min(5, Number(scaled.toFixed(1))));
}

export function formatOneDecimal(value: unknown) {
  return toFivePointScale(value).toFixed(1);
}

export function formatPercent(value: unknown, fallback = '0%') {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return `${Math.round(numeric)}%`;
}

export function formatDate(value: unknown, fallback = 'Sin fecha') {
  if (!value) return fallback;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

