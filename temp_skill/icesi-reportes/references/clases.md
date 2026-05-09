# Catálogo de clases — estilos.css

Referencia rápida de todas las clases disponibles. Usar solo estas; no inventar clases nuevas.

---

## Layout

| Clase | Descripción |
|---|---|
| `.reporte` | Contenedor principal del documento. `max-width: 860px`, centrado. |
| `.reporte-body` | Área de contenido. `flex-direction: column`, `gap: 48px`. |
| `.grid-2` | Grid de 2 columnas iguales |
| `.grid-3` | Grid de 3 columnas iguales |
| `.grid-4` | Grid de 4 columnas iguales |
| `.grid-2-1` | Grid asimétrico 2/3 + 1/3 |
| `.grid-1-2` | Grid asimétrico 1/3 + 2/3 |

---

## Encabezado (`report-header`)

| Clase | Uso |
|---|---|
| `.report-header` | Contenedor del header (fondo azul) |
| `.report-header__top` | Fila logo + metadata |
| `.report-header__logo` | Wrapper del `<img>` del logo |
| `.report-header__meta` | Columna derecha: período, versión, área |
| `.report-header__meta-label` | Etiqueta en gris claro |
| `.report-header__meta-value` | Valor en blanco semitransparente |
| `.report-header__title-block` | Bloque de eyebrow + título + subtítulo |
| `.report-header__eyebrow` | Texto pequeño amarillo sobre el título |
| `.report-header__title` | Título principal `h1` blanco ExtraBold |
| `.report-header__subtitle` | Subtítulo gris claro Regular |
| `.report-header__kpi-bar` | Fila de KPIs resumen en el header |
| `.report-header__kpi-item` | Cada celda de la kpi-bar |
| `.report-header__kpi-value` | Número grande blanco |
| `.report-header__kpi-label` | Etiqueta pequeña gris |

---

## Pie de página (`report-footer`)

| Clase | Uso |
|---|---|
| `.report-footer` | Contenedor del footer (fondo negro) |
| `.report-footer__info` | Texto descriptivo gris oscuro |
| `.report-footer__url` | URL en amarillo |

---

## Secciones y títulos

| Clase | Uso |
|---|---|
| `.section` | Bloque de sección. `flex-direction: column`, `gap: 20px` |
| `.section--tinted` | Sección con fondo gris suave |
| `.section--accented` | Sección con borde izquierdo azul |
| `.section-title` | Wrapper del título de sección (incluye línea azul inferior) |
| `.section-title--compact` | Sin línea inferior, título más pequeño |
| `.section-title__label` | Etiqueta "Sección N" en azul pequeño |
| `.section-title__heading` | Título `h2` principal de la sección |
| `.section-title__desc` | Descripción/subtítulo de la sección |

---

## KPI Cards

### Estructura base
```html
<div class="kpi-card [modificador]">
  <span class="kpi-card__label">Etiqueta</span>
  <span class="kpi-card__value">Valor<span class="kpi-card__unit">%</span></span>
  <span class="kpi-card__delta kpi-card__delta--up">↑ Variación</span>
  <span class="kpi-card__desc">Nota adicional</span>
</div>
```

### Modificadores de borde izquierdo
`.kpi-card--blue` · `.kpi-card--green` · `.kpi-card--orange` · `.kpi-card--purple` · `.kpi-card--yellow`

### Modificadores de fondo sólido
`.kpi-card--solid-blue` · `.kpi-card--solid-green` · `.kpi-card--solid-orange`

### Modificadores de fondo tint (suave)
`.kpi-card--tint-blue` · `.kpi-card--tint-green` · `.kpi-card--tint-purple` · `.kpi-card--tint-orange`

### Delta (variación)
`.kpi-card__delta--up` → verde · `.kpi-card__delta--down` → naranja · `.kpi-card__delta--flat` → gris

---

## Tablas

### Estructura
```html
<div class="tabla-wrapper">
  <table class="tabla-datos [modificador]">
    <thead><tr><th>Col</th>...</tr></thead>
    <tbody>
      <tr><td>Dato</td>...</tr>
      <tr class="row--highlight"><td>Fila destacada</td>...</tr>
    </tbody>
    <tfoot><tr><td>Total</td>...</tr></tfoot>
  </table>
</div>
```

| Clase | Uso |
|---|---|
| `.tabla-wrapper` | Wrapper con scroll horizontal en móvil |
| `.tabla-datos` | Tabla base con header azul |
| `.tabla-datos--striped` | Filas alternadas gris/blanco |
| `.row--highlight` | Fila resaltada en azul tint + bold |
| `.num` | Celda numérica alineada a la derecha (en `<th>` y `<td>`) |

---

## Highlight boxes

```html
<div class="highlight-box [modificador]">
  <span class="highlight-box__label">Etiqueta</span>
  <span class="highlight-box__texto">Texto destacado</span>
</div>
```

Modificadores: `highlight-box--green` · `highlight-box--orange` · `highlight-box--purple` · `highlight-box--yellow`
- `--yellow`: el texto y etiqueta son negros (no blancos)

---

## Cita

```html
<div class="cita">
  <span class="cita__texto">Texto de la cita...</span>
  <span class="cita__fuente">Fuente — Área, fecha</span>
</div>
```

---

## Alertas

```html
<div class="alerta alerta--[tipo]">
  <span class="alerta__titulo">Título</span>
  <p class="alerta__texto">Descripción...</p>
</div>
```

Tipos: `alerta--info` (azul) · `alerta--ok` (verde) · `alerta--advertencia` (naranja) · `alerta--critica` (rojo)

---

## Listas

### Lista con puntos azules
```html
<ul class="lista-icesi">
  <li>Elemento</li>
</ul>
```

### Lista numerada estilizada
```html
<ol class="lista-numerada">
  <li>Paso uno</li>
</ol>
```

### Lista de hallazgos (con estado)
```html
<ul class="lista-hallazgos">
  <li class="ok">Hallazgo positivo</li>
  <li class="alerta">Hallazgo de atención</li>
  <li class="info">Hallazgo informativo</li>
</ul>
```

---

## Línea de tiempo

```html
<div class="timeline">
  <div class="timeline__item">
    <div class="timeline__dot [--green|--orange|--purple|--gray]">
      <span>N</span>
    </div>
    <div class="timeline__content">
      <span class="timeline__fecha">Mes día, año</span>
      <span class="timeline__titulo">Título del hito</span>
      <p class="timeline__desc">Descripción breve</p>
    </div>
  </div>
</div>
```

---

## Badges

```html
<span class="badge badge--[color]">Etiqueta</span>
```

Sólidos: `badge--blue` · `badge--green` · `badge--orange` · `badge--purple` · `badge--yellow` · `badge--gray`
Outline: `badge--outline-blue` · `badge--outline-green`

---

## Gráficas / contenedor de imagen

```html
<div class="grafica-wrapper">
  <div class="grafica-wrapper__titulo">
    Título de la gráfica
    <div class="grafica-wrapper__subtitulo">Descripción o fuente</div>
  </div>
  <div class="grafica-wrapper__body">
    <!-- <img>, <iframe>, <canvas> o placeholder -->
  </div>
  <div class="grafica-wrapper__fuente">Fuente: nombre, año</div>
</div>
```

---

## Separadores

| Clase | Descripción |
|---|---|
| `<hr class="divider">` | Línea gris sutil (entre subsecciones) |
| `<hr class="divider--blue">` | Línea azul de 2px |
| `<hr class="divider--thick">` | Línea azul gruesa 4px (entre secciones mayores) |
| `.divider-label` + `<span>Texto</span>` | Separador con etiqueta centrada |

---

## Tipografía utilitaria

| Clase | Descripción |
|---|---|
| `.text-sm` | Texto pequeño 13px |
| `.text-xs` | Texto muy pequeño 11px |
| `.text-muted` | Color gris (`--c-gray1`) |
| `.text-blue` | Color azul Icesi |
| `.text-bold` | `font-weight: 700` |
| `.text-label` | Etiqueta uppercase, gris, espaciado |
| `.h2` `.h3` `.h4` `.h5` | Clases de heading aplicables a cualquier elemento |

---

## Acento dinámico (cambio de color global)

Agregar en `.reporte` junto con `.usa-acento` para cambiar el color de acento del documento completo:

```html
<div class="reporte acento-green usa-acento">
```

Opciones: `.acento-blue` (por defecto) · `.acento-green` · `.acento-orange` · `.acento-purple`
Afecta: títulos de sección, valor de KPI cards, header, header de tabla, puntos de timeline.

---

## Variables CSS disponibles para las excepciones permitidas

```css
var(--c-blue)    var(--c-green)    var(--c-orange)
var(--c-purple)  var(--c-yellow)   var(--c-gray1)
var(--c-blue-tint)  var(--c-green-tint)  var(--c-orange-tint)
var(--space-xs)  var(--space-sm)   var(--space-md)  var(--space-lg)
```
