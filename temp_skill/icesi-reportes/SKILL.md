---
name: icesi-reportes
description: |
  Genera reportes y presentaciones HTML institucionales de Universidad Icesi. Úsala cuando el usuario pida: "crea un reporte", "genera un informe de gestión", "arma el HTML del reporte", "informe semestral", "reporte de indicadores", "dashboard de datos", "informe ejecutivo Icesi", "presentación Icesi", "slides Icesi", "PPT en HTML", o cualquier documento de seguimiento, análisis o presentación de resultados en contexto universitario. Soporta dos formatos: Onepage (reporte scrollable HTML + estilos.css) y PPT (presentación tipo slides 100vw×100vh autocontenida con CSS inline). SIEMPRE confirma logo y formato antes de generar.
---

# Icesi Reportes — HTML con estilos externos

Genera reportes HTML en dos formatos posibles: **Onepage** (reporte scrollable con `estilos.css`) o **PPT** (presentación tipo slides, autocontenida con CSS inline). Siempre confirma 3 preguntas antes de generar.

---

## Paso 1 — TRES preguntas obligatorias antes de generar

**Presentar SIEMPRE las tres preguntas al usuario antes de escribir cualquier HTML.**

### 1.1 Logo (SIEMPRE preguntar)

> "¿Qué logo(s) usamos?"

Opciones disponibles:

| Opción | Logos | Cuándo elegirlo |
|---|---|---|
| **Solo Icesi** | Logo Universidad Icesi | Reportes institucionales generales |
| **INNLAB + Icesi** | Logo INNLAB + Icesi | Piezas del laboratorio de innovación |
| **Solo INNLAB** | Solo logo INNLAB | Comunicaciones propias del lab |

Para cada logo hay variantes de color — elegir según el fondo del header:
- **Header azul oscuro** → Icesi NEGATIVO (blanco) + INNLAB Blanco
- **Header blanco / claro** → Icesi POSITIVO (azul) + INNLAB Azul o Negro
- **Header negro / muy oscuro** → Icesi NEGATIVO (blanco) + INNLAB Blanco

Leer el data URI correspondiente en `references/logos.md`.

### 1.2 Formato del entregable (SIEMPRE preguntar)

> "¿En qué formato quieres el entregable?"

- **Onepage** — reporte HTML scrollable tradicional, usa `estilos.css` externo. Ideal para informes de gestión, reportes ejecutivos, dashboards de datos.
- **PPT** — presentación HTML tipo slides (pantalla completa, una diapositiva a la vez, navegación con flechas/teclado). CSS inline, sin dependencias externas. Ideal para presentaciones a audiencias, decks de resultados.

### 1.3 Modo de generación (SIEMPRE preguntar)

> "¿Genero el contenido completo desde tu brief, o prefieres un esqueleto con placeholders?"

- **Desde brief** → el usuario provee datos, contexto y cifras; Claude redacta y estructura todo
- **Esqueleto** → Claude elige las secciones apropiadas y deja `[PLACEHOLDER]` en textos y cifras

---

## Paso 2 — Analizar el brief y elegir secciones (solo Onepage)

*Este paso aplica solo al formato Onepage. Para PPT, ir directamente al Paso 3B.*

Según el tipo de reporte, seleccionar las secciones más apropiadas del catálogo en `references/clases.md`. No todas las secciones son obligatorias.

| Tipo de reporte | Secciones recomendadas |
|---|---|
| Gestión / seguimiento | header-kpi-bar · grid de kpi-cards · tabla-datos · alertas · highlight-boxes |
| Ejecutivo / directivo | header limpio · highlight-boxes · cita · lista-hallazgos · grid-2 con texto |
| Investigación | secciones narrativas · cita · grafica-wrapper · tabla-datos · timeline |
| Evento / actividad | timeline · highlight-boxes · grid de kpi-cards · lista-numerada |
| Financiero | kpi-cards sólidas · tabla-datos con tfoot · alertas · divider-label |

Regla general: empezar con las secciones más importantes primero. Menos secciones bien usadas > muchas secciones mediocres.

---

## Paso 3A — Formato Onepage: Reglas de construcción HTML

### 3A.1 Estructura base obligatoria

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[Título del reporte]</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="estilos.css">
</head>
<body>
<div class="reporte">
  <div class="report-header"> ... </div>
  <div class="reporte-body">
    <!-- secciones apiladas aquí -->
  </div>
  <div class="report-footer"> ... </div>
</div>
</body>
</html>
```

### 3A.2 Reglas estrictas de estilo

- Prohibido usar `<style>` en el `<head>`
- Prohibido usar atributos `style=""` en línea, salvo excepciones justificadas (ver 3A.3)
- Prohibido definir colores, tamaños o espaciados fuera de las clases de `estilos.css`
- Usar solo las clases documentadas en `references/clases.md`
- Combinar clases de modificador: `kpi-card kpi-card--blue` es correcto

### 3A.3 Excepciones permitidas para `style=""`
- `style="margin-top: Npx"` para ajustar espaciado puntual
- `style="color: var(--c-green)"` para colorear un delta inline en tabla
- `style="height: Npx"` en logos `<img>` para control de tamaño

### 3A.4 Divs apilados — sin superposición
- Todo el contenido va en `<div class="reporte-body">` con `display: flex; flex-direction: column; gap: var(--space-xl)`
- Cada bloque de información es un `<div class="section">` independiente
- Los grids (`.grid-2`, `.grid-3`, `.grid-4`) se usan **dentro** de una `.section`
- Nunca anidar `.reporte-body` dentro de otro `.reporte-body`

### 3A.5 Paleta de colores — máximo 3
- Azul `--c-blue` es obligatorio y siempre cuenta como uno
- Blanco y negro son neutros, no cuentan
- Elegir máximo 2 colores adicionales y ser consistente

---

## Paso 3B — Formato PPT: Reglas de construcción

El formato PPT es un **HTML autocontenido** (sin archivo CSS externo). Todo el CSS va inline en `<style>`. Simula slides de presentación a pantalla completa.

### 3B.1 Paleta y tokens PPT

```css
:root {
  --azul:      #5454e9;
  --amarillo:  #e4eb60;
  --naranja:   #e9683b;
  --morado:    #865cf0;
  --verde:     #4cb979;
  --gris:      #88898c;
  --gris-claro:#cecfd4;
  --negro:     #1a1a1a;
  --blanco:    #ffffff;
  --font:      'Plus Jakarta Sans', sans-serif;
}
```

### 3B.2 Estructura base del HTML PPT

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[Título]</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; font-family: 'Plus Jakarta Sans', sans-serif; background: #1a1a1a; }
    :root { --azul: #5454e9; --amarillo: #e4eb60; --naranja: #e9683b; --morado: #865cf0; --verde: #4cb979; --negro: #1a1a1a; --blanco: #ffffff; }

    /* SLIDE ENGINE */
    .deck { position: relative; width: 100vw; height: 100vh; }
    .slide { position: absolute; inset: 0; width: 100%; height: 100%; display: flex; flex-direction: column; opacity: 0; pointer-events: none; transition: opacity 0.35s ease; overflow: hidden; }
    .slide.active { opacity: 1; pointer-events: all; }

    /* FONDOS */
    .bg-azul    { background: #5454e9; color: #fff; }
    .bg-negro   { background: #1a1a1a; color: #fff; }
    .bg-blanco  { background: #ffffff; color: #1a1a1a; }
    .bg-gris    { background: #f4f4f6; color: #1a1a1a; }
    .bg-amarillo { background: #e4eb60; color: #1a1a1a; }
    .bg-gradient-azul { background: linear-gradient(135deg, #3a3acc 0%, #5454e9 60%, #7c7cf5 100%); color: #fff; }
    .bg-gradient-oscuro { background: linear-gradient(135deg, #0d0d1a 0%, #1a1a2e 100%); color: #fff; }

    /* LAYOUTS */
    .slide--cover { display: flex; flex-direction: column; justify-content: center; padding: 80px; height: 100%; }
    .slide--content { display: flex; flex-direction: column; justify-content: center; padding: 60px 80px; height: 100%; }
    .slide--split { flex-direction: row; height: 100%; }
    .slide--split .split-left, .slide--split .split-right { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 60px; }

    /* TIPOGRAFÍA */
    .slide-eyebrow { font-size: 12px; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; opacity: 0.6; margin-bottom: 16px; }
    .slide-title { font-size: clamp(36px, 5vw, 72px); font-weight: 800; line-height: 1.05; margin-bottom: 24px; }
    .slide-subtitle { font-size: clamp(16px, 2vw, 22px); font-weight: 400; line-height: 1.5; opacity: 0.8; max-width: 600px; }
    .slide-heading { font-size: clamp(24px, 3vw, 40px); font-weight: 700; line-height: 1.15; margin-bottom: 20px; }
    .slide-body { font-size: clamp(14px, 1.5vw, 18px); line-height: 1.65; opacity: 0.85; }

    /* KPI CARDS PPT */
    .slide-grid { display: grid; gap: 24px; margin-top: 32px; }
    .slide-grid--2 { grid-template-columns: 1fr 1fr; }
    .slide-grid--3 { grid-template-columns: repeat(3, 1fr); }
    .slide-grid--4 { grid-template-columns: repeat(4, 1fr); }
    .ppt-kpi { background: rgba(255,255,255,0.08); border-radius: 16px; padding: 28px 24px; border: 1px solid rgba(255,255,255,0.12); }
    .ppt-kpi__label { font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.55; margin-bottom: 12px; display: block; }
    .ppt-kpi__value { font-size: clamp(28px, 4vw, 48px); font-weight: 800; display: block; line-height: 1; }
    .ppt-kpi__delta--up { color: #4cb979; }
    .ppt-kpi__delta--down { color: #e9683b; }

    /* ELEMENTOS DECORATIVOS */
    .slide-accent-bar { width: 6px; height: 60px; border-radius: 3px; margin-bottom: 24px; }
    .slide-divider { width: 48px; height: 4px; border-radius: 2px; margin: 20px 0; }
    .slide-logo { position: absolute; top: 36px; right: 48px; height: 36px; }

    /* LISTA */
    .slide-list { list-style: none; display: flex; flex-direction: column; gap: 16px; margin-top: 24px; }
    .slide-list li { display: flex; align-items: flex-start; gap: 14px; font-size: clamp(14px, 1.4vw, 17px); line-height: 1.5; opacity: 0.9; }
    .slide-list li::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: currentColor; flex-shrink: 0; margin-top: 7px; }

    /* CITA */
    .slide-quote { font-size: clamp(20px, 2.5vw, 32px); font-weight: 300; line-height: 1.4; font-style: italic; border-left: 4px solid currentColor; padding-left: 24px; }

    /* NAVEGACIÓN */
    .nav { position: fixed; bottom: 32px; right: 40px; display: flex; gap: 12px; z-index: 100; }
    .nav button { width: 44px; height: 44px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.1); color: #fff; font-size: 18px; cursor: pointer; backdrop-filter: blur(8px); transition: background 0.2s; }
    .nav button:hover { background: rgba(255,255,255,0.25); }
    .slide-counter { position: fixed; bottom: 38px; left: 40px; font-size: 13px; color: rgba(255,255,255,0.5); z-index: 100; letter-spacing: 0.05em; }
  </style>
</head>
<body>
<div class="deck" id="deck">

  <!-- SLIDE 1: PORTADA -->
  <section class="slide active bg-azul">
    <img class="slide-logo" src="[DATA_URI_INNLAB_BLANCO_O_ICESI_NEGATIVO]" alt="Logo" style="height:36px">
    <div class="slide--cover">
      <div class="slide-accent-bar" style="background:#e4eb60"></div>
      <p class="slide-eyebrow">[Área · Período]</p>
      <h1 class="slide-title">[Título de la<br>presentación]</h1>
      <p class="slide-subtitle">[Subtítulo o descripción]</p>
    </div>
  </section>

  <!-- SLIDE N: CONTENIDO (copiar y adaptar) -->
  <section class="slide bg-blanco">
    <img class="slide-logo" src="[DATA_URI_INNLAB_AZUL_O_ICESI_POSITIVO]" alt="Logo" style="height:32px">
    <div class="slide--content">
      <p class="slide-eyebrow" style="color:#5454e9">[Sección]</p>
      <h2 class="slide-heading">[Título del slide]</h2>
      <div class="slide-divider" style="background:#5454e9"></div>
      <p class="slide-body">[Contenido]</p>
    </div>
  </section>

  <!-- SLIDE CIERRE -->
  <section class="slide bg-negro">
    <img class="slide-logo" src="[DATA_URI_INNLAB_BLANCO_O_ICESI_NEGATIVO]" alt="Logo" style="height:36px">
    <div class="slide--cover">
      <h1 class="slide-title">Gracias</h1>
      <p class="slide-subtitle">[Contacto · URL · Cierre]</p>
    </div>
  </section>

</div>

<div class="slide-counter" id="counter">1 / 3</div>
<div class="nav">
  <button onclick="navigate(-1)">&#8249;</button>
  <button onclick="navigate(1)">&#8250;</button>
</div>

<script>
  const slides = document.querySelectorAll('.slide');
  let current = 0;
  const counter = document.getElementById('counter');
  function show(n) {
    slides[current].classList.remove('active');
    current = (n + slides.length) % slides.length;
    slides[current].classList.add('active');
    counter.textContent = (current + 1) + ' / ' + slides.length;
  }
  function navigate(dir) { show(current + dir); }
  document.addEventListener('keydown', e => {
    if (['ArrowRight','ArrowDown',' '].includes(e.key)) navigate(1);
    if (['ArrowLeft','ArrowUp'].includes(e.key)) navigate(-1);
  });
</script>
</body>
</html>
```

### 3B.3 Reglas de diseño PPT

- Cada `<section class="slide">` es una diapositiva independiente
- Máximo 5–7 líneas de texto por slide; si hay más, dividir en dos slides
- La primera slide SIEMPRE es portada (`.bg-azul` o `.bg-gradient-azul`)
- La última slide SIEMPRE es cierre con agradecimiento o llamada a la acción
- No usar `estilos.css` — todo CSS va en el `<style>` del `<head>`
- El archivo es completamente autocontenido

### 3B.4 Selección de logo según fondo en PPT

| Fondo del slide | Logo Icesi | Logo INNLAB |
|---|---|---|
| `.bg-azul`, `.bg-negro`, `.bg-gradient-*` | NEGATIVO (blanco) | Blanco |
| `.bg-blanco`, `.bg-gris` | POSITIVO (azul) | Azul o Negro |
| `.bg-amarillo` | POSITIVO (azul) | Negro |

---

## Paso 4 — Patrones Onepage frecuentes

Consultar `references/clases.md` para la lista completa de clases.

### Header con KPI bar
```html
<div class="report-header">
  <div class="report-header__top">
    <div class="report-header__logo">
      <img src="[DATA_URI_NEGATIVO]" alt="Universidad Icesi">
    </div>
    <div class="report-header__meta">
      <span class="report-header__meta-label">Período</span>
      <span class="report-header__meta-value">[Período]</span>
    </div>
  </div>
  <div class="report-header__title-block">
    <span class="report-header__eyebrow">[Área o dependencia]</span>
    <h1 class="report-header__title">[Título del reporte]</h1>
    <p class="report-header__subtitle">[Descripción breve]</p>
  </div>
  <div class="report-header__kpi-bar">
    <div class="report-header__kpi-item">
      <span class="report-header__kpi-value">[Valor]</span>
      <span class="report-header__kpi-label">[Etiqueta]</span>
    </div>
  </div>
</div>
```

### Sección con grid de KPI cards
```html
<div class="section">
  <div class="section-title">
    <span class="section-title__label">[Sección N]</span>
    <h2 class="section-title__heading">[Título]</h2>
    <p class="section-title__desc">[Descripción opcional]</p>
  </div>
  <div class="grid-4">
    <div class="kpi-card kpi-card--blue">
      <span class="kpi-card__label">[Indicador]</span>
      <span class="kpi-card__value">[Valor]</span>
      <span class="kpi-card__delta kpi-card__delta--up">↑ [Variación]</span>
      <span class="kpi-card__desc">[Nota opcional]</span>
    </div>
  </div>
</div>
```

### Separadores
```html
<hr class="divider">          <!-- línea gris sutil -->
<hr class="divider--thick">   <!-- línea azul gruesa -->
```

### Footer
```html
<div class="report-footer">
  <img src="[DATA_URI_NEGATIVO]" alt="Universidad Icesi">
  <span class="report-footer__info">[Nombre del reporte · Dependencia · Confidencialidad]</span>
  <span class="report-footer__url">icesi.edu.co</span>
</div>
```

---

## Paso 5 — Entrega

### Onepage
- Guardar en `/mnt/user-data/outputs/[nombre-reporte].html`
- Referencia `estilos.css` — ambos archivos deben estar en la misma carpeta para verse en local
- Si el usuario necesita versión autocontenida, indicar que se puede hacer inline manualmente

### PPT
- Guardar en `/mnt/user-data/outputs/[nombre-presentacion].html`
- El archivo es **completamente autocontenido** — no requiere ningún archivo externo
- Navegación: flechas de teclado (←/→/Espacio) o botones en pantalla
