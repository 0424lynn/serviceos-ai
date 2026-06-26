-- ============================================================
-- Migration 001: Core Layer
-- ServiceOS.ai — users, workspaces, members, roles, plans,
--                subscriptions, api_keys, webhooks, sso,
--                integrations, notifications, documents, chunks
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "vector";

-- ── Users (extends Supabase Auth) ────────────────────────────
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text unique not null,
  name        text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.users is 'Platform users, extends Supabase auth.users';

-- ── Plans ────────────────────────────────────────────────────
create table if not exists public.plans (
  id                    uuid primary key default uuid_generate_v4(),
  name                  text not null unique,
  price_monthly         numeric not null default 0,
  price_yearly          numeric not null default 0,
  max_users             int not null default 1,
  max_documents         int not null default 10,
  max_ai_calls_month    int not null default 50,
  max_storage_gb        numeric not null default 1,
  features              jsonb not null default '{}',
  is_active             boolean not null default true,
  created_at            timestamptz not null default now()
);

insert into public.plans (name, price_monthly, price_yearly, max_users, max_documents, max_ai_calls_month, max_storage_gb, features)
values
  ('free',         0,    0,    1,   10,    50,    1,    '{"agents": false, "automations": false, "marketplace": false}'),
  ('starter',      49,   470,  5,   200,   2000,  5,    '{"agents": false, "automations": false, "marketplace": true}'),
  ('professional', 149,  1430, 15,  1000,  10000, 20,   '{"agents": true,  "automations": false, "marketplace": true}'),
  ('business',     399,  3830, 50,  -1,    50000, 100,  '{"agents": true,  "automations": true,  "marketplace": true}'),
  ('enterprise',   0,    0,    -1,  -1,    -1,    -1,   '{"agents": true,  "automations": true,  "marketplace": true, "sso": true, "rbac": true}')
on conflict (name) do nothing;

-- ── Workspaces ───────────────────────────────────────────────
create table if not exists public.workspaces (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text unique not null,
  logo_url    text,
  plan_id     uuid references public.plans(id),
  industry    text not null default 'field_service',
  settings    jsonb not null default '{}',
  created_by  uuid references public.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Roles (RBAC) ─────────────────────────────────────────────
create table if not exists public.roles (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid references public.workspaces(id) on delete cascade,
  name          text not null,
  permissions   jsonb not null default '[]',
  is_system     boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Seed system roles (workspace_id null = global templates)
insert into public.roles (name, permissions, is_system)
values
  ('owner',  '["*"]',                                                                    true),
  ('admin',  '["members:manage","apps:manage","documents:manage","sessions:read:all"]',  true),
  ('member', '["documents:upload","apps:run","sessions:read:own"]',                      true),
  ('viewer', '["sessions:read:own","documents:read"]',                                   true)
on conflict do nothing;

-- ── Workspace Members ─────────────────────────────────────────
create table if not exists public.workspace_members (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  role_id       uuid not null references public.roles(id),
  invited_by    uuid references public.users(id),
  joined_at     timestamptz,
  created_at    timestamptz not null default now(),
  unique(workspace_id, user_id)
);

-- ── Subscriptions ─────────────────────────────────────────────
create table if not exists public.subscriptions (
  id                      uuid primary key default uuid_generate_v4(),
  workspace_id            uuid not null references public.workspaces(id) on delete cascade,
  plan_id                 uuid not null references public.plans(id),
  status                  text not null default 'active',
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  stripe_subscription_id  text,
  stripe_customer_id      text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ── API Keys ──────────────────────────────────────────────────
create table if not exists public.api_keys (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  user_id       uuid not null references public.users(id),
  name          text not null,
  key_hash      text unique not null,
  key_prefix    text not null,
  scopes        jsonb not null default '["read"]',
  last_used_at  timestamptz,
  expires_at    timestamptz,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ── Webhooks ──────────────────────────────────────────────────
create table if not exists public.webhooks (
  id                uuid primary key default uuid_generate_v4(),
  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  url               text not null,
  events            jsonb not null default '[]',
  secret            text not null,
  is_active         boolean not null default true,
  last_triggered_at timestamptz,
  created_at        timestamptz not null default now()
);

-- ── SSO Configs ───────────────────────────────────────────────
create table if not exists public.sso_configs (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade unique,
  provider      text not null,
  config        jsonb not null default '{}',
  is_active     boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ── Integrations ──────────────────────────────────────────────
create table if not exists public.integrations (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  type          text not null,
  config        jsonb not null default '{}',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ── Notifications ─────────────────────────────────────────────
create table if not exists public.notifications (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  type          text not null,
  title         text not null,
  body          text,
  data          jsonb not null default '{}',
  is_read       boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ── Documents ─────────────────────────────────────────────────
create table if not exists public.documents (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  uploaded_by     uuid not null references public.users(id),
  file_name       text not null,
  file_url        text not null,
  file_type       text not null,
  file_size_bytes bigint,
  status          text not null default 'processing',
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── Document Chunks (RAG) ─────────────────────────────────────
create table if not exists public.document_chunks (
  id            uuid primary key default uuid_generate_v4(),
  document_id   uuid not null references public.documents(id) on delete cascade,
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  content       text not null,
  embedding     vector(1536),
  page_number   int,
  chunk_index   int not null default 0,
  metadata      jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────
create index if not exists idx_workspace_members_workspace on public.workspace_members(workspace_id);
create index if not exists idx_workspace_members_user on public.workspace_members(user_id);
create index if not exists idx_documents_workspace on public.documents(workspace_id, created_at desc);
create index if not exists idx_documents_status on public.documents(workspace_id, status);
create index if not exists idx_document_chunks_document on public.document_chunks(document_id);
create index if not exists idx_document_chunks_workspace on public.document_chunks(workspace_id);
create index if not exists idx_notifications_user on public.notifications(user_id, is_read, created_at desc);

-- Vector index for similarity search (created after data exists for efficiency)
-- create index if not exists idx_document_chunks_embedding
--   on public.document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ── RLS ───────────────────────────────────────────────────────
alter table public.users enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.notifications enable row level security;

-- Helper: check membership
create or replace function public.is_workspace_member(ws_id uuid)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id
      and user_id = auth.uid()
  );
$$;

-- Helper: get member role name
create or replace function public.get_workspace_role(ws_id uuid)
returns text
language sql security definer stable
as $$
  select r.name
  from public.workspace_members wm
  join public.roles r on r.id = wm.role_id
  where wm.workspace_id = ws_id
    and wm.user_id = auth.uid()
  limit 1;
$$;

-- Users: can read/update own profile
create policy "users_select_own" on public.users
  for select using (id = auth.uid());
create policy "users_update_own" on public.users
  for update using (id = auth.uid());

-- Workspaces: members can read, owners can update
create policy "workspaces_select_member" on public.workspaces
  for select using (public.is_workspace_member(id));
create policy "workspaces_update_owner" on public.workspaces
  for update using (public.get_workspace_role(id) = 'owner');
create policy "workspaces_insert_auth" on public.workspaces
  for insert with check (auth.uid() is not null);

-- Workspace members: members can read their workspace's member list
create policy "workspace_members_select" on public.workspace_members
  for select using (public.is_workspace_member(workspace_id));
create policy "workspace_members_insert" on public.workspace_members
  for insert with check (auth.uid() is not null);

-- Documents: workspace members can read; member+ can insert
create policy "documents_select_member" on public.documents
  for select using (public.is_workspace_member(workspace_id));
create policy "documents_insert_member" on public.documents
  for insert with check (public.is_workspace_member(workspace_id));
create policy "documents_delete_uploader" on public.documents
  for delete using (
    uploaded_by = auth.uid()
    or public.get_workspace_role(workspace_id) in ('owner', 'admin')
  );

-- Document chunks: workspace members can read
create policy "document_chunks_select_member" on public.document_chunks
  for select using (public.is_workspace_member(workspace_id));

-- Notifications: own only
create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());
create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid());

-- ── Trigger: auto-update updated_at ──────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger workspaces_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

create trigger documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();
