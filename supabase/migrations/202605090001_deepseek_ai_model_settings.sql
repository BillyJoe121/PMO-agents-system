alter table public.ai_model_settings
add column if not exists deepseek_model text not null default 'deepseek-v4-flash';

alter table public.ai_model_settings
drop constraint if exists ai_model_settings_mode_check;

alter table public.ai_model_settings
add constraint ai_model_settings_mode_check check (mode in ('low', 'high_with_fallback', 'deepseek'));

insert into public.ai_model_settings (id, mode, high_model, low_model, deepseek_model)
values ('global', 'high_with_fallback', 'gemini-3.1-pro-preview', 'gemini-flash-lite-latest', 'deepseek-v4-flash')
on conflict (id) do update
set
  deepseek_model = coalesce(public.ai_model_settings.deepseek_model, excluded.deepseek_model),
  updated_at = now();

