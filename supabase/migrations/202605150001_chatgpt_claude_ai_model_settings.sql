alter table public.ai_model_settings
add column if not exists provider text not null default 'openai',
add column if not exists selected_model text not null default 'gpt-5.4',
add column if not exists openai_model text not null default 'gpt-5.4',
add column if not exists anthropic_model text not null default 'claude-sonnet-4-6';

update public.ai_model_settings
set
  provider = case
    when selected_model like 'claude-%' then 'anthropic'
    else 'openai'
  end,
  selected_model = case
    when selected_model in (
      'gpt-5.5',
      'gpt-5.4',
      'gpt-5.4-mini',
      'claude-sonnet-4-6',
      'claude-haiku-4-5'
    )
    then selected_model
    else 'gpt-5.4'
  end,
  openai_model = case
    when openai_model in ('gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini') then openai_model
    else 'gpt-5.4'
  end,
  anthropic_model = case
    when anthropic_model in ('claude-sonnet-4-6', 'claude-haiku-4-5') then anthropic_model
    else 'claude-sonnet-4-6'
  end,
  updated_at = now()
where id = 'global';

alter table public.ai_model_settings
drop constraint if exists ai_model_settings_mode_check,
drop constraint if exists ai_model_settings_provider_check,
drop constraint if exists ai_model_settings_selected_model_check,
drop constraint if exists ai_model_settings_openai_model_check,
drop constraint if exists ai_model_settings_anthropic_model_check;

alter table public.ai_model_settings
drop column if exists kimi_model,
drop column if exists deepseek_model,
drop column if exists mode;

alter table public.ai_model_settings
add constraint ai_model_settings_provider_check
  check (provider in ('openai', 'anthropic')),
add constraint ai_model_settings_selected_model_check
  check (selected_model in (
    'gpt-5.5',
    'gpt-5.4',
    'gpt-5.4-mini',
    'claude-sonnet-4-6',
    'claude-haiku-4-5'
  )),
add constraint ai_model_settings_openai_model_check
  check (openai_model in ('gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini')),
add constraint ai_model_settings_anthropic_model_check
  check (anthropic_model in ('claude-sonnet-4-6', 'claude-haiku-4-5'));

insert into public.ai_model_settings (
  id,
  provider,
  selected_model,
  openai_model,
  anthropic_model,
  high_model,
  low_model
)
values (
  'global',
  'openai',
  'gpt-5.4',
  'gpt-5.4',
  'claude-sonnet-4-6',
  'gemini-3.1-pro-preview',
  'gemini-flash-lite-latest'
)
on conflict (id) do update set
  provider = excluded.provider,
  selected_model = excluded.selected_model,
  openai_model = excluded.openai_model,
  anthropic_model = excluded.anthropic_model,
  high_model = coalesce(public.ai_model_settings.high_model, excluded.high_model),
  low_model = coalesce(public.ai_model_settings.low_model, excluded.low_model),
  updated_at = now();
