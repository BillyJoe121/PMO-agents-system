alter table public.ai_model_settings
add column if not exists kimi_model text not null default 'kimi-k2.6';

update public.ai_model_settings
set
  mode = case when mode = 'deepseek' then 'kimi' else mode end,
  kimi_model = coalesce(nullif(kimi_model, ''), 'kimi-k2.6')
where id = 'global';

alter table public.ai_model_settings
drop constraint if exists ai_model_settings_mode_check;

alter table public.ai_model_settings
add constraint ai_model_settings_mode_check check (mode in ('low', 'high_with_fallback', 'kimi'));

insert into public.ai_model_settings (id, mode, high_model, low_model, kimi_model)
values ('global', 'high_with_fallback', 'gemini-3.1-pro-preview', 'gemini-flash-lite-latest', 'kimi-k2.6')
on conflict (id) do update set
  mode = case when public.ai_model_settings.mode = 'deepseek' then 'kimi' else public.ai_model_settings.mode end,
  kimi_model = coalesce(public.ai_model_settings.kimi_model, excluded.kimi_model),
  updated_at = now();
