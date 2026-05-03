-- ============================================================
-- SEED PROJECTS — Ejecutar en Supabase SQL Editor
-- Borra proyectos existentes y crea 5 nuevos en etapas 0–4
-- ============================================================

DO $$
DECLARE
  v_auditor_id    uuid;
  v_empresa_id    uuid;
  v_proyecto_id   uuid;
BEGIN

  -- ── 1. Obtener el auditor existente ──────────────────────
  SELECT id INTO v_auditor_id FROM public.profiles LIMIT 1;

  IF v_auditor_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró ningún usuario en profiles';
  END IF;

  RAISE NOTICE 'Auditor: %', v_auditor_id;

  -- ── 2. Borrar datos existentes (en orden por FK) ─────────
  DELETE FROM public.encuestas_respuestas
    WHERE proyecto_id IN (SELECT id FROM public.proyectos);

  DELETE FROM public.entrevistas
    WHERE proyecto_id IN (SELECT id FROM public.proyectos);

  DELETE FROM public.documentos
    WHERE proyecto_id IN (SELECT id FROM public.proyectos);

  DELETE FROM public.fases_estado
    WHERE proyecto_id IN (SELECT id FROM public.proyectos);

  DELETE FROM public.proyectos;

  RAISE NOTICE 'Proyectos anteriores eliminados.';

  -- ── 3. Helper: crea fases_estado para un proyecto ────────
  -- (inline via repeated inserts agrupados por proyecto)

  -- ====================================================
  -- PROYECTO 1 — Etapa 0: Sin iniciar (solo fase 1 disponible)
  -- ====================================================
  INSERT INTO public.empresas (nombre) VALUES ('Constructora Andina S.A.S')
    ON CONFLICT DO NOTHING;
  SELECT id INTO v_empresa_id FROM public.empresas WHERE nombre = 'Constructora Andina S.A.S' LIMIT 1;

  INSERT INTO public.proyectos (empresa_id, auditor_id, nombre_proyecto, fase_actual)
    VALUES (v_empresa_id, v_auditor_id, 'PMO Corporativa 2026', 1)
    RETURNING id INTO v_proyecto_id;

  INSERT INTO public.fases_estado (proyecto_id, numero_fase, estado_visual) VALUES
    (v_proyecto_id, 1, 'disponible'),
    (v_proyecto_id, 2, 'bloqueado'),
    (v_proyecto_id, 3, 'bloqueado'),
    (v_proyecto_id, 4, 'bloqueado'),
    (v_proyecto_id, 5, 'bloqueado'),
    (v_proyecto_id, 6, 'bloqueado'),
    (v_proyecto_id, 7, 'bloqueado'),
    (v_proyecto_id, 8, 'bloqueado');

  RAISE NOTICE 'Proyecto 1 creado (Etapa 0): %', v_proyecto_id;

  -- ====================================================
  -- PROYECTO 2 — Etapa 1: Fase 1 completada
  -- ====================================================
  INSERT INTO public.empresas (nombre) VALUES ('TechColombia Ltda')
    ON CONFLICT DO NOTHING;
  SELECT id INTO v_empresa_id FROM public.empresas WHERE nombre = 'TechColombia Ltda' LIMIT 1;

  INSERT INTO public.proyectos (empresa_id, auditor_id, nombre_proyecto, fase_actual)
    VALUES (v_empresa_id, v_auditor_id, 'Transformación Digital PMO', 2)
    RETURNING id INTO v_proyecto_id;

  INSERT INTO public.fases_estado (proyecto_id, numero_fase, estado_visual) VALUES
    (v_proyecto_id, 1, 'completado'),
    (v_proyecto_id, 2, 'disponible'),
    (v_proyecto_id, 3, 'bloqueado'),
    (v_proyecto_id, 4, 'bloqueado'),
    (v_proyecto_id, 5, 'bloqueado'),
    (v_proyecto_id, 6, 'bloqueado'),
    (v_proyecto_id, 7, 'bloqueado'),
    (v_proyecto_id, 8, 'bloqueado');

  RAISE NOTICE 'Proyecto 2 creado (Etapa 1): %', v_proyecto_id;

  -- ====================================================
  -- PROYECTO 3 — Etapa 2: Fases 1 y 2 completadas
  -- ====================================================
  INSERT INTO public.empresas (nombre) VALUES ('Grupo Logístico del Norte')
    ON CONFLICT DO NOTHING;
  SELECT id INTO v_empresa_id FROM public.empresas WHERE nombre = 'Grupo Logístico del Norte' LIMIT 1;

  INSERT INTO public.proyectos (empresa_id, auditor_id, nombre_proyecto, fase_actual)
    VALUES (v_empresa_id, v_auditor_id, 'Gestión de Portafolio Regional', 3)
    RETURNING id INTO v_proyecto_id;

  INSERT INTO public.fases_estado (proyecto_id, numero_fase, estado_visual) VALUES
    (v_proyecto_id, 1, 'completado'),
    (v_proyecto_id, 2, 'completado'),
    (v_proyecto_id, 3, 'disponible'),
    (v_proyecto_id, 4, 'bloqueado'),
    (v_proyecto_id, 5, 'bloqueado'),
    (v_proyecto_id, 6, 'bloqueado'),
    (v_proyecto_id, 7, 'bloqueado'),
    (v_proyecto_id, 8, 'bloqueado');

  RAISE NOTICE 'Proyecto 3 creado (Etapa 2): %', v_proyecto_id;

  -- ====================================================
  -- PROYECTO 4 — Etapa 3: Fases 1, 2 y 3 completadas
  -- ====================================================
  INSERT INTO public.empresas (nombre) VALUES ('Banco Meridiano')
    ON CONFLICT DO NOTHING;
  SELECT id INTO v_empresa_id FROM public.empresas WHERE nombre = 'Banco Meridiano' LIMIT 1;

  INSERT INTO public.proyectos (empresa_id, auditor_id, nombre_proyecto, fase_actual)
    VALUES (v_empresa_id, v_auditor_id, 'PMO Financiera y Regulatoria', 4)
    RETURNING id INTO v_proyecto_id;

  INSERT INTO public.fases_estado (proyecto_id, numero_fase, estado_visual) VALUES
    (v_proyecto_id, 1, 'completado'),
    (v_proyecto_id, 2, 'completado'),
    (v_proyecto_id, 3, 'completado'),
    (v_proyecto_id, 4, 'disponible'),   -- Fase 4 disponible (las 3 anteriores completas)
    (v_proyecto_id, 5, 'bloqueado'),
    (v_proyecto_id, 6, 'bloqueado'),
    (v_proyecto_id, 7, 'bloqueado'),
    (v_proyecto_id, 8, 'bloqueado');

  RAISE NOTICE 'Proyecto 4 creado (Etapa 3): %', v_proyecto_id;

  -- ====================================================
  -- PROYECTO 5 — Etapa 4: Fases 1–4 completadas
  -- ====================================================
  INSERT INTO public.empresas (nombre) VALUES ('Salud Innovación SAS')
    ON CONFLICT DO NOTHING;
  SELECT id INTO v_empresa_id FROM public.empresas WHERE nombre = 'Salud Innovación SAS' LIMIT 1;

  INSERT INTO public.proyectos (empresa_id, auditor_id, nombre_proyecto, fase_actual)
    VALUES (v_empresa_id, v_auditor_id, 'Reestructuración PMO Clínica', 5)
    RETURNING id INTO v_proyecto_id;

  INSERT INTO public.fases_estado (proyecto_id, numero_fase, estado_visual) VALUES
    (v_proyecto_id, 1, 'completado'),
    (v_proyecto_id, 2, 'completado'),
    (v_proyecto_id, 3, 'completado'),
    (v_proyecto_id, 4, 'completado'),
    (v_proyecto_id, 5, 'disponible'),
    (v_proyecto_id, 6, 'bloqueado'),
    (v_proyecto_id, 7, 'bloqueado'),
    (v_proyecto_id, 8, 'bloqueado');

  RAISE NOTICE 'Proyecto 5 creado (Etapa 4): %', v_proyecto_id;

  RAISE NOTICE '✅ Seed completado exitosamente. 5 proyectos creados.';

END $$;
