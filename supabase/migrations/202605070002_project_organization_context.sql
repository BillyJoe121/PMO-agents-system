alter table public.proyectos
  add column if not exists tamano text,
  add column if not exists mision text,
  add column if not exists vision text;
