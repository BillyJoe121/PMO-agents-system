/**
 * seed_projects.ts
 * 
 * Limpia todos los proyectos existentes y crea 5 proyectos demo,
 * cada uno en una etapa distinta (0 = sin iniciar, 1–4 = fases completadas).
 * 
 * Uso: npx tsx seed_projects.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// Cliente con Service Role para poder borrar sin restricciones de RLS
// ─────────────────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(`
❌  Falta la variable SUPABASE_SERVICE_ROLE_KEY en el archivo .env

   Esta clave es necesaria para bypassear RLS y poder crear/borrar proyectos.
   Puedes encontrarla en:
   Supabase Dashboard → Settings → API → service_role (secret)

   Agrega esta línea a tu archivo .env:
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJI...tu-key-aqui
  `);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ─────────────────────────────────────────────────────────────────────────────
// Configuración de los proyectos a crear
// etapa = número de fases completadas (0..4)
// ─────────────────────────────────────────────────────────────────────────────
const PROJECTS_TO_CREATE = [
  { empresa: 'Constructora Andina S.A.S',   nombre: 'PMO Corporativa 2026',          etapa: 0 },
  { empresa: 'TechColombia Ltda',            nombre: 'Transformación Digital PMO',    etapa: 1 },
  { empresa: 'Grupo Logístico del Norte',   nombre: 'Gestión de Portafolio Regional', etapa: 2 },
  { empresa: 'Banco Meridiano',             nombre: 'PMO Financiera y Regulatoria',   etapa: 3 },
  { empresa: 'Salud Innovación SAS',        nombre: 'Reestructuración PMO Clínica',   etapa: 4 },
];

// Las 8 fases canónicas (mismas que AppContext)
const PHASE_NAMES = [
  'Registro documental',
  'Registro de entrevistas',
  'Encuestas de idoneidad',
  'Diagnostico de idoneidad',
  'Encuestas de Madurez',
  'Consolidación y pasos para Guía Metodologica',
  'Diseño Metodologica del proyecto',
  'Artefactos',
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Calcula estado_visual de cada fase dado cuántas están completadas */
function buildFasesEstado(proyectoId: string, etapa: number) {
  return PHASE_NAMES.map((_, i) => {
    const faseNum = i + 1;
    let estado: string;

    if (faseNum <= etapa) {
      estado = 'completado';
    } else if (etapa === 0 && faseNum === 1) {
      estado = 'disponible';          // Fase 1 siempre disponible al inicio
    } else if (faseNum === etapa + 1) {
      // La siguiente fase tras las completadas — aplica regla especial para fase 4
      if (faseNum === 4) {
        estado = etapa >= 3 ? 'disponible' : 'bloqueado';
      } else {
        estado = 'disponible';
      }
    } else {
      estado = 'bloqueado';
    }

    return {
      proyecto_id: proyectoId,
      numero_fase: faseNum,
      estado_visual: estado,
      datos_consolidados: null,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🗑️  Paso 1 — Obteniendo auditor existente...');

  // Leer el primer auditor disponible en profiles
  const { data: profiles, error: profileErr } = await supabase
    .from('profiles')
    .select('id, full_name')
    .limit(1);

  if (profileErr || !profiles || profiles.length === 0) {
    console.error('❌  No se encontró ningún usuario en profiles:', profileErr?.message);
    process.exit(1);
  }

  const auditor = profiles[0];
  console.log(`   ✅  Auditor encontrado: ${auditor.full_name} (${auditor.id})`);

  // ── 1. Borrar proyectos existentes ────────────────────────────────────────
  console.log('\n🗑️  Paso 2 — Borrando proyectos existentes...');

  const { data: existingProjects } = await supabase
    .from('proyectos')
    .select('id');

  if (existingProjects && existingProjects.length > 0) {
    const ids = existingProjects.map(p => p.id);

    // Borrar en cascada: fases_estado → proyectos
    const { error: fasesErr } = await supabase
      .from('fases_estado')
      .delete()
      .in('proyecto_id', ids);

    if (fasesErr) console.warn('   ⚠️  Error borrando fases_estado:', fasesErr.message);

    // Borrar documentos, encuestas, entrevistas si existen
    for (const table of ['documentos', 'entrevistas', 'encuestas_respuestas']) {
      const { error } = await supabase.from(table).delete().in('proyecto_id', ids);
      if (error) console.warn(`   ⚠️  Error borrando ${table}:`, error.message);
    }

    const { error: projErr } = await supabase
      .from('proyectos')
      .delete()
      .in('id', ids);

    if (projErr) {
      console.error('❌  Error borrando proyectos:', projErr.message);
      process.exit(1);
    }

    console.log(`   ✅  ${ids.length} proyecto(s) eliminado(s)`);
  } else {
    console.log('   ℹ️  No había proyectos existentes');
  }

  // ── 2. Crear empresas y proyectos ─────────────────────────────────────────
  console.log('\n🏗️  Paso 3 — Creando proyectos nuevos...\n');

  for (const cfg of PROJECTS_TO_CREATE) {
    process.stdout.write(`   ➕  "${cfg.nombre}" (${cfg.empresa}) — Etapa ${cfg.etapa}... `);

    // Buscar o crear empresa
    let empresaId: string;
    const { data: existEmp } = await supabase
      .from('empresas')
      .select('id')
      .ilike('nombre', cfg.empresa)
      .maybeSingle();

    if (existEmp) {
      empresaId = existEmp.id;
    } else {
      const { data: newEmp, error: empErr } = await supabase
        .from('empresas')
        .insert({ nombre: cfg.empresa })
        .select('id')
        .single();
      if (empErr || !newEmp) {
        console.error('\n❌  Error creando empresa:', empErr?.message);
        continue;
      }
      empresaId = newEmp.id;
    }

    // Crear proyecto
    const { data: proj, error: projErr } = await supabase
      .from('proyectos')
      .insert({
        empresa_id: empresaId,
        auditor_id: auditor.id,
        nombre_proyecto: cfg.nombre,
        fase_actual: Math.max(1, cfg.etapa),
      })
      .select('id')
      .single();

    if (projErr || !proj) {
      console.error('\n❌  Error creando proyecto:', projErr?.message);
      continue;
    }

    // Crear fases_estado
    const fases = buildFasesEstado(proj.id, cfg.etapa);
    const { error: fasesErr } = await supabase
      .from('fases_estado')
      .insert(fases);

    if (fasesErr) {
      console.error('\n❌  Error creando fases_estado:', fasesErr.message);
      continue;
    }

    console.log('✅');
  }

  // ── 3. Resumen final ──────────────────────────────────────────────────────
  const { data: final } = await supabase
    .from('proyectos')
    .select('id, nombre_proyecto')
    .order('created_at', { ascending: true });

  console.log(`\n🎉  Seed completado. ${final?.length ?? 0} proyectos en la base de datos:\n`);
  final?.forEach((p, i) => {
    const cfg = PROJECTS_TO_CREATE[i];
    console.log(`   ${i + 1}. "${p.nombre_proyecto}" — Etapa ${cfg?.etapa ?? '?'}`);
  });
  console.log('');
}

main().catch(err => {
  console.error('❌  Error inesperado:', err);
  process.exit(1);
});
