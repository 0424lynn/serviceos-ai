-- ============================================================
-- Migration 004: Agents, Automations, Usage, Billing, Audit
-- ServiceOS.ai — Phase 1 chat-only agents + full audit trail
-- ============================================================

-- ── Agents ────────────────────────────────────────────────────
create table if not exists public.agents (
  id                uuid primary key default uuid_generate_v4(),
  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  name              text not null,
  description       text,
  system_prompt     text,
  model_id          uuid references public.ai_models(id),
  tools             jsonb not null default '[]',
  memory_enabled    boolean not null default true,
  max_iterations    int not null default 10,
  temperature       numeric not null default 0.3,
  config            jsonb not null default '{}',
  is_active         boolean not null default true,
  created_by        uuid references public.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── Agent Runs ────────────────────────────────────────────────
create table if not exists public.agent_runs (
  id                  uuid primary key default uuid_generate_v4(),
  workspace_id        uuid not null references public.workspaces(id) on delete cascade,
  agent_id            uuid not null references public.agents(id),
  user_id             uuid not null references public.users(id),
  automation_run_id   uuid,
  status              text not null default 'pending',
  trigger_type        text not null default 'user',
  goal                text,
  result              jsonb,
  error               text,
  tokens_total        int not null default 0,
  cost_usd            numeric not null default 0,
  duration_ms         int,
  started_at          timestamptz,
  completed_at        timestamptz,
  created_at          timestamptz not null default now()
);

-- ── Agent Messages ────────────────────────────────────────────
create table if not exists public.agent_messages (
  id             uuid primary key default uuid_generate_v4(),
  agent_run_id   uuid not null references public.agent_runs(id) on delete cascade,
  role           text not null,
  content        text,
  tool_name      text,
  tool_input     jsonb,
  tool_output    jsonb,
  tokens         int not null default 0,
  created_at     timestamptz not null default now()
);

-- ── Agent Memory ──────────────────────────────────────────────
create table if not exists public.agent_memory (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  agent_id      uuid not null references public.agents(id) on delete cascade,
  user_id       uuid references public.users(id),
  memory_type   text not null default 'fact',
  key           text not null,
  value         text not null,
  embedding     vector(1536),
  expires_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Automations (structure only — Phase 2 implementation) ─────
create table if not exists public.automations (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  name            text not null,
  description     text,
  trigger_type    text not null,
  trigger_config  jsonb not null default '{}',
  steps           jsonb not null default '[]',
  is_active       boolean not null default false,
  created_by      uuid references public.users(id),
  last_run_at     timestamptz,
  next_run_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.automation_runs (
  id              uuid primary key default uuid_generate_v4(),
  automation_id   uuid not null references public.automations(id) on delete cascade,
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  trigger_type    text,
  trigger_data    jsonb not null default '{}',
  status          text not null default 'pending',
  error           text,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists public.automation_run_steps (
  id                  uuid primary key default uuid_generate_v4(),
  automation_run_id   uuid not null references public.automation_runs(id) on delete cascade,
  step_index          int not null,
  step_type           text not null,
  step_config         jsonb not null default '{}',
  input               jsonb,
  output              jsonb,
  status              text not null default 'pending',
  error               text,
  duration_ms         int,
  created_at          timestamptz not null default now()
);

-- Add deferred FKs now that both tables exist
alter table public.app_sessions
  add constraint fk_app_sessions_agent_run
  foreign key (agent_run_id) references public.agent_runs(id);

alter table public.agent_runs
  add constraint fk_agent_runs_automation_run
  foreign key (automation_run_id) references public.automation_runs(id);

-- ── Usage Logs ────────────────────────────────────────────────
create table if not exists public.usage_logs (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  user_id       uuid references public.users(id),
  source_type   text not null,
  source_id     uuid,
  app_id        uuid references public.apps(id),
  agent_id      uuid references public.agents(id),
  model_id      uuid references public.ai_models(id),
  tokens_input  int not null default 0,
  tokens_output int not null default 0,
  tokens_total  int not null default 0,
  cost_usd      numeric not null default 0,
  duration_ms   int,
  created_at    timestamptz not null default now()
);

-- ── Billing Events ────────────────────────────────────────────
create table if not exists public.billing_events (
  id               uuid primary key default uuid_generate_v4(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  type             text not null,
  amount_usd       numeric not null default 0,
  stripe_event_id  text,
  metadata         jsonb not null default '{}',
  created_at       timestamptz not null default now()
);

-- ── Cost Limits ───────────────────────────────────────────────
create table if not exists public.cost_limits (
  id                uuid primary key default uuid_generate_v4(),
  workspace_id      uuid not null references public.workspaces(id) on delete cascade unique,
  daily_limit_usd   numeric,
  monthly_limit_usd numeric,
  daily_tokens      bigint,
  monthly_tokens    bigint,
  on_exceed         text not null default 'block',
  notify_at_pct     int not null default 80,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── Audit Logs (append-only) ──────────────────────────────────
create table if not exists public.audit_logs (
  id             uuid primary key default uuid_generate_v4(),
  workspace_id   uuid references public.workspaces(id) on delete cascade,
  user_id        uuid references public.users(id),
  action         text not null,
  resource_type  text,
  resource_id    uuid,
  ip_address     text,
  user_agent     text,
  metadata       jsonb not null default '{}',
  created_at     timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────
create index if not exists idx_agent_runs_workspace on public.agent_runs(workspace_id, created_at desc);
create index if not exists idx_agent_messages_run on public.agent_messages(agent_run_id, created_at);
create index if not exists idx_agent_memory_agent on public.agent_memory(workspace_id, agent_id, user_id);
create index if not exists idx_usage_logs_workspace on public.usage_logs(workspace_id, created_at desc);
create index if not exists idx_usage_logs_source on public.usage_logs(workspace_id, source_type, created_at desc);
create index if not exists idx_audit_logs_workspace on public.audit_logs(workspace_id, action, created_at desc);
create index if not exists idx_audit_logs_user on public.audit_logs(user_id, created_at desc);

-- ── RLS ───────────────────────────────────────────────────────
alter table public.agents enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_messages enable row level security;
alter table public.agent_memory enable row level security;
alter table public.usage_logs enable row level security;
alter table public.audit_logs enable row level security;

create policy "agents_member_read" on public.agents
  for select using (public.is_workspace_member(workspace_id));
create policy "agents_admin_manage" on public.agents
  for all using (public.get_workspace_role(workspace_id) in ('owner', 'admin'));

create policy "agent_runs_member_read" on public.agent_runs
  for select using (public.is_workspace_member(workspace_id));
create policy "agent_runs_insert" on public.agent_runs
  for insert with check (public.is_workspace_member(workspace_id));
create policy "agent_runs_update" on public.agent_runs
  for update using (public.is_workspace_member(workspace_id));

create policy "agent_messages_select" on public.agent_messages
  for select using (
    agent_run_id in (
      select id from public.agent_runs
      where workspace_id in (
        select workspace_id from public.workspace_members where user_id = auth.uid()
      )
    )
  );
create policy "agent_messages_insert" on public.agent_messages
  for insert with check (
    agent_run_id in (
      select id from public.agent_runs
      where workspace_id in (
        select workspace_id from public.workspace_members where user_id = auth.uid()
      )
    )
  );

create policy "usage_logs_admin_read" on public.usage_logs
  for select using (public.get_workspace_role(workspace_id) in ('owner', 'admin'));
create policy "usage_logs_insert" on public.usage_logs
  for insert with check (true);

create policy "audit_logs_admin_read" on public.audit_logs
  for select using (public.get_workspace_role(workspace_id) in ('owner', 'admin'));
create policy "audit_logs_insert" on public.audit_logs
  for insert with check (true);

-- updated_at triggers
create trigger agents_updated_at
  before update on public.agents
  for each row execute function public.set_updated_at();

create trigger agent_memory_updated_at
  before update on public.agent_memory
  for each row execute function public.set_updated_at();
