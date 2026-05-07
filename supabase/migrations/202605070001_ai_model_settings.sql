create table if not exists public.ai_model_settings (
  id text primary key default 'global',
  mode text not null default 'high_with_fallback',
  high_model text not null default 'gemini-3.1-pro-preview',
  low_model text not null default 'gemini-flash-lite-latest',
  updated_at timestamptz not null default now(),
  constraint ai_model_settings_singleton check (id = 'global'),
  constraint ai_model_settings_mode_check check (mode in ('low', 'high_with_fallback'))
);

insert into public.ai_model_settings (id, mode, high_model, low_model)
values ('global', 'high_with_fallback', 'gemini-3.1-pro-preview', 'gemini-flash-lite-latest')
on conflict (id) do update
set
  high_model = excluded.high_model,
  low_model = excluded.low_model,
  updated_at = now();

alter table public.ai_model_settings enable row level security;

drop policy if exists "ai_model_settings_select_authenticated" on public.ai_model_settings;
create policy "ai_model_settings_select_authenticated"
on public.ai_model_settings
for select
to authenticated
using (true);

drop policy if exists "ai_model_settings_update_admin" on public.ai_model_settings;
create policy "ai_model_settings_update_admin"
on public.ai_model_settings
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and lower(profiles.role::text) = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and lower(profiles.role::text) = 'admin'
  )
);

drop policy if exists "ai_model_settings_insert_admin" on public.ai_model_settings;
create policy "ai_model_settings_insert_admin"
on public.ai_model_settings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and lower(profiles.role::text) = 'admin'
  )
);
