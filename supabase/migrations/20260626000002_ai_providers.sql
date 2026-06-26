-- ============================================================
-- Migration 002: AI Provider Layer
-- ServiceOS.ai — providers, models, workspace configs
-- ============================================================

-- ── AI Providers (system-level registry) ─────────────────────
create table if not exists public.ai_providers (
  id            uuid primary key default uuid_generate_v4(),
  name          text unique not null,
  display_name  text not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

insert into public.ai_providers (name, display_name) values
  ('anthropic', 'Anthropic Claude'),
  ('openai',    'OpenAI'),
  ('gemini',    'Google Gemini'),
  ('deepseek',  'DeepSeek'),
  ('azure',     'Azure OpenAI'),
  ('local',     'Local LLM')
on conflict (name) do nothing;

-- ── AI Models ─────────────────────────────────────────────────
create table if not exists public.ai_models (
  id                    uuid primary key default uuid_generate_v4(),
  provider_id           uuid not null references public.ai_providers(id),
  model_id              text not null,
  display_name          text not null,
  context_window        int,
  input_cost_per_1k     numeric,
  output_cost_per_1k    numeric,
  supports_vision       boolean not null default false,
  supports_tools        boolean not null default true,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  unique(provider_id, model_id)
);

-- Seed models (costs in USD per 1K tokens)
insert into public.ai_models (provider_id, model_id, display_name, context_window, input_cost_per_1k, output_cost_per_1k, supports_vision, supports_tools)
select
  p.id,
  m.model_id,
  m.display_name,
  m.context_window,
  m.input_cost,
  m.output_cost,
  m.vision,
  m.tools
from public.ai_providers p
join (values
  ('anthropic', 'claude-sonnet-4-6',        'Claude Sonnet 4.6',    200000, 0.003,  0.015,  true,  true),
  ('anthropic', 'claude-haiku-4-5-20251001', 'Claude Haiku 4.5',    200000, 0.0008, 0.004,  true,  true),
  ('openai',    'gpt-4o',                    'GPT-4o',               128000, 0.005,  0.015,  true,  true),
  ('openai',    'gpt-4o-mini',               'GPT-4o Mini',          128000, 0.00015,0.0006, false, true),
  ('gemini',    'gemini-1.5-pro',            'Gemini 1.5 Pro',      2000000, 0.00125,0.005,  true,  true),
  ('deepseek',  'deepseek-chat',             'DeepSeek Chat',         65536, 0.00014,0.00028,false, true)
) as m(provider, model_id, display_name, context_window, input_cost, output_cost, vision, tools)
  on p.name = m.provider
on conflict do nothing;

-- ── Workspace AI Configs (per-workspace credentials) ─────────
create table if not exists public.workspace_ai_configs (
  id                  uuid primary key default uuid_generate_v4(),
  workspace_id        uuid not null references public.workspaces(id) on delete cascade,
  provider_id         uuid not null references public.ai_providers(id),
  api_key_encrypted   text,
  default_model_id    uuid references public.ai_models(id),
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  unique(workspace_id, provider_id)
);

-- RLS
alter table public.workspace_ai_configs enable row level security;

create policy "ai_configs_select_admin" on public.workspace_ai_configs
  for select using (
    public.get_workspace_role(workspace_id) in ('owner', 'admin')
  );
create policy "ai_configs_upsert_admin" on public.workspace_ai_configs
  for all using (
    public.get_workspace_role(workspace_id) in ('owner', 'admin')
  );
