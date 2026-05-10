# Sprint 1 - Base de Refactor Visual y Tecnico

## Objetivo

Crear una base compartida para continuar la migracion visual de fases, reducir duplicacion y preparar `pmo-agent` para separarse por fase sin cambiar rutas, Supabase, agentes ni flujos actuales.

## Entregado

- Componentes compartidos de fase en `src/app/components/phases/_shared`.
- Tema de graficas reutilizable en `src/app/components/charts`.
- Piloto visual de fase 5 con tablero BI separado en `src/app/components/phases/madurez/MaturityBIDashboard.tsx`.
- Helpers comunes de datos en `src/app/lib/phase-data`.
- Estructura modular para `supabase/functions/pmo-agent`:
  - `_shared/cors.ts`
  - `_shared/aiModels.ts`
  - `_shared/processing.ts`
  - `phases/phase1.ts`

## Regla de continuidad

Los siguientes sprints deben migrar pantallas grandes por adopcion gradual:

1. Usar los componentes compartidos nuevos en una fase.
2. Mover helpers locales repetidos a `phase-data`.
3. Validar build.
4. Solo despues eliminar codigo legacy equivalente.

## Verificacion manual sugerida

- Abrir fase 5 con resultados existentes y revisar tabla, barras y radar.
- Revisar dashboard de fase 5 en desktop y movil.
- Ejecutar una fase documental para confirmar que `pmo-agent` conserva labels de categoria.
- Repetir `npm run build` despues de cada fase migrada.

