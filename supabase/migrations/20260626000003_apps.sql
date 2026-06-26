-- ============================================================
-- Migration 003: Apps Layer
-- ServiceOS.ai — apps registry, workspace_apps, app_sessions
-- ============================================================

-- ── Apps Registry (system-level) ─────────────────────────────
create table if not exists public.apps (
  id              uuid primary key default uuid_generate_v4(),
  slug            text unique not null,
  name            text not null,
  description     text,
  icon            text,
  category        text,
  version         text not null default '1.0.0',
  config_schema   jsonb not null default '{}',
  input_schema    jsonb not null default '{}',
  output_schema   jsonb not null default '{}',
  is_active       boolean not null default true,
  is_builtin      boolean not null default true,
  source_type     text not null default 'official',
  created_at      timestamptz not null default now()
);

-- Seed built-in MVP apps
insert into public.apps (slug, name, description, icon, category, source_type)
values
  ('knowledge-base',   'Knowledge Base',         'Ask AI questions from your uploaded company documents', 'database',       'knowledge',      'official'),
  ('email-assistant',  'Email Assistant',         'Generate professional email replies from customer messages',  'mail',           'communication',  'official'),
  ('ticket-assistant', 'Ticket Assistant',        'Extract structured ticket fields from customer descriptions', 'clipboard-list', 'operations',     'official'),
  ('report-generator', 'Report Generator',        'Turn repair notes into professional English service reports', 'file-text',     'reporting',      'official'),
  ('daily-summary',    'Daily Summary AI',        'AI-generated daily business digest for your team',           'calendar',       'reporting',      'official')
on conflict (slug) do nothing;

-- ── Workspace Apps (enable/disable per workspace) ─────────────
create table if not exists public.workspace_apps (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  app_id        uuid not null references public.apps(id),
  config        jsonb not null default '{}',
  is_enabled    boolean not null default true,
  enabled_by    uuid references public.users(id),
  created_at    timestamptz not null default now(),
  unique(workspace_id, app_id)
);

-- ── App Sessions (universal history for all apps) ─────────────
create table if not exists public.app_sessions (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  app_id          uuid not null references public.apps(id),
  user_id         uuid not null references public.users(id),
  agent_run_id    uuid,
  input           jsonb not null,
  output          jsonb,
  status          text not null default 'pending',
  model_id        uuid references public.ai_models(id),
  tokens_input    int not null default 0,
  tokens_output   int not null default 0,
  cost_usd        numeric not null default 0,
  duration_ms     int,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────
create index if not exists idx_workspace_apps_workspace on public.workspace_apps(workspace_id);
create index if not exists idx_app_sessions_workspace on public.app_sessions(workspace_id, created_at desc);
create index if not exists idx_app_sessions_app on public.app_sessions(workspace_id, app_id, created_at desc);
create index if not exists idx_app_sessions_user on public.app_sessions(user_id, created_at desc);

-- ── RLS ───────────────────────────────────────────────────────
alter table public.workspace_apps enable row level security;
alter table public.app_sessions enable row level security;

create policy "workspace_apps_select_member" on public.workspace_apps
  for select using (public.is_workspace_member(workspace_id));
create policy "workspace_apps_manage_admin" on public.workspace_apps
  for all using (public.get_workspace_role(workspace_id) in ('owner', 'admin'));

create policy "app_sessions_select_member" on public.app_sessions
  for select using (
    public.is_workspace_member(workspace_id)
    and (
      user_id = auth.uid()
      or public.get_workspace_role(workspace_id) in ('owner', 'admin')
    )
  );
create policy "app_sessions_insert_member" on public.app_sessions
  for insert with check (public.is_workspace_member(workspace_id));
create policy "app_sessions_update_member" on public.app_sessions
  for update using (workspace_id in (
    select workspace_id from public.workspace_members where user_id = auth.uid()
  ));

-- updated_at trigger
create trigger app_sessions_updated_at
  before update on public.app_sessions
  for each row execute function public.set_updated_at();
