-- TeacherTemplate VTR Evidence Hub — initial schema
-- Run in Supabase SQL Editor (or `supabase db push`). Then run supabase/seed.sql.
--
-- Security model:
--   * RLS is ENABLED on every table and NO policies are created for the
--     `anon` / `authenticated` roles, so the public Supabase API cannot read or
--     write anything directly.
--   * All reads/writes go through Next.js Route Handlers that use the
--     service-role key (server-side only) after validating input and checking
--     the admin/viewer session.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z][A-Z0-9_]{0,15}$'),
  name        text not null check (char_length(name) between 1 and 200),
  name_en     text not null default '' check (char_length(name_en) <= 200),
  color       text not null default '#38bdf8' check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index categories_sort_idx on public.categories (sort_order);
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- indicators
-- ---------------------------------------------------------------------------
create table public.indicators (
  id                    uuid primary key default gen_random_uuid(),
  code                  text not null unique check (code ~ '^[A-Z][A-Z0-9_]{0,15}$'),
  category_id           uuid not null references public.categories (id) on delete restrict,
  title                 text not null check (char_length(title) between 1 and 300),
  description           text not null default '' check (char_length(description) <= 2000),
  recommended_evidence  text not null default '' check (char_length(recommended_evidence) <= 2000),
  required_image_count  integer not null default 0 check (required_image_count between 0 and 100),
  required_video_count  integer not null default 0 check (required_video_count between 0 and 100),
  sort_order            integer not null default 0,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index indicators_category_idx on public.indicators (category_id, sort_order);
create index indicators_active_idx on public.indicators (is_active);
create trigger indicators_updated_at before update on public.indicators
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- submissions (one form submission = one activity, many files)
-- ---------------------------------------------------------------------------
create table public.submissions (
  id                  uuid primary key default gen_random_uuid(),
  indicator_id        uuid not null references public.indicators (id) on delete restrict,
  submitter_name      text not null check (char_length(submitter_name) between 1 and 150),
  submitter_position  text not null check (char_length(submitter_position) between 1 and 150),
  activity_title      text not null check (char_length(activity_title) between 1 and 300),
  activity_detail     text not null default '' check (char_length(activity_detail) <= 5000),
  activity_date       date not null,
  note                text not null default '' check (char_length(note) <= 2000),
  status              text not null default 'UPLOADING'
                      check (status in ('UPLOADING', 'COMPLETED', 'PARTIAL', 'FAILED')),
  client_ip_hash      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index submissions_indicator_idx on public.submissions (indicator_id, created_at desc);
create index submissions_created_idx on public.submissions (created_at desc);
create trigger submissions_updated_at before update on public.submissions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- evidence_files
-- ---------------------------------------------------------------------------
create table public.evidence_files (
  id                       uuid primary key default gen_random_uuid(),
  submission_id            uuid not null references public.submissions (id) on delete cascade,
  indicator_id             uuid not null references public.indicators (id) on delete restrict,
  client_upload_id         text not null unique check (char_length(client_upload_id) between 8 and 100),
  file_name                text not null check (char_length(file_name) between 1 and 255),
  mime_type                text not null,
  media_type               text not null check (media_type in ('IMAGE', 'VIDEO')),
  size_bytes               bigint not null check (size_bytes > 0),
  status                   text not null default 'PENDING'
                           check (status in ('PENDING', 'UPLOADING', 'UPLOADED', 'FAILED', 'MISSING', 'DELETED')),
  bytes_uploaded           bigint not null default 0 check (bytes_uploaded >= 0),
  -- Google Drive resumable session URL. Never returned to browsers.
  drive_upload_session_url text,
  drive_upload_session_at  timestamptz,
  drive_file_id            text unique,
  drive_folder_id          text,
  drive_md5                text,
  error_message            text,
  is_vtr_selected          boolean not null default false,
  vtr_order                integer,
  vtr_note                 text not null default '' check (char_length(vtr_note) <= 2000),
  uploaded_at              timestamptz,
  deleted_at               timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint evidence_uploaded_has_drive_id
    check (status <> 'UPLOADED' or drive_file_id is not null)
);
create index evidence_files_submission_idx on public.evidence_files (submission_id);
create index evidence_files_indicator_status_idx on public.evidence_files (indicator_id, status);
create index evidence_files_vtr_idx on public.evidence_files (is_vtr_selected, vtr_order) where is_vtr_selected;
create trigger evidence_files_updated_at before update on public.evidence_files
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- drive_folders (real Google Drive folder IDs, created once and reused)
-- ---------------------------------------------------------------------------
create table public.drive_folders (
  id                uuid primary key default gen_random_uuid(),
  kind              text not null check (kind in ('ROOT', 'CATEGORY', 'INDICATOR')),
  root_folder_id    text not null,
  category_id       uuid references public.categories (id) on delete cascade,
  indicator_id      uuid references public.indicators (id) on delete cascade,
  drive_folder_id   text not null unique,
  name              text not null,
  created_at        timestamptz not null default now(),
  constraint drive_folders_kind_refs check (
    (kind = 'ROOT' and category_id is null and indicator_id is null) or
    (kind = 'CATEGORY' and category_id is not null and indicator_id is null) or
    (kind = 'INDICATOR' and indicator_id is not null)
  )
);
create unique index drive_folders_category_uniq on public.drive_folders (root_folder_id, category_id) where kind = 'CATEGORY';
create unique index drive_folders_indicator_uniq on public.drive_folders (root_folder_id, indicator_id) where kind = 'INDICATOR';

-- ---------------------------------------------------------------------------
-- system_settings (key/value). Secret values (e.g. the AES-GCM encrypted
-- Google refresh token) are flagged is_secret and never sent to clients.
-- ---------------------------------------------------------------------------
create table public.system_settings (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique check (key ~ '^[a-z][a-z0-9_.]{1,63}$'),
  value       jsonb not null,
  is_secret   boolean not null default false,
  updated_at  timestamptz not null default now()
);
create trigger system_settings_updated_at before update on public.system_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- admin_sessions (admin + read-only viewer sessions; only SHA-256 hashes of
-- the cookie token are stored)
-- ---------------------------------------------------------------------------
create table public.admin_sessions (
  id            uuid primary key default gen_random_uuid(),
  token_hash    text not null unique,
  role          text not null check (role in ('ADMIN', 'VIEWER')),
  csrf_token    text not null,
  ip_hash       text,
  user_agent    text,
  expires_at    timestamptz not null,
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index admin_sessions_expires_idx on public.admin_sessions (expires_at);

-- ---------------------------------------------------------------------------
-- rate_limits (fixed-window counters shared by all serverless instances)
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  id            uuid primary key default gen_random_uuid(),
  bucket        text not null unique,
  hits          integer not null default 0,
  window_start  timestamptz not null default now()
);

create or replace function public.rate_limit_hit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits integer;
begin
  insert into public.rate_limits as r (bucket, hits, window_start)
  values (p_bucket, 1, now())
  on conflict (bucket) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- aggregated file counts per indicator (only successfully uploaded files)
-- ---------------------------------------------------------------------------
create or replace view public.indicator_file_counts
with (security_invoker = true) as
select
  i.id as indicator_id,
  count(f.id) filter (where f.media_type = 'IMAGE') as image_count,
  count(f.id) filter (where f.media_type = 'VIDEO') as video_count,
  count(f.id) filter (where f.is_vtr_selected) as vtr_selected_count,
  max(f.uploaded_at) as last_uploaded_at
from public.indicators i
left join public.evidence_files f
  on f.indicator_id = i.id and f.status = 'UPLOADED'
group by i.id;

-- ---------------------------------------------------------------------------
-- Row Level Security: deny everything to anon/authenticated.
-- ---------------------------------------------------------------------------
alter table public.categories      enable row level security;
alter table public.indicators      enable row level security;
alter table public.submissions     enable row level security;
alter table public.evidence_files  enable row level security;
alter table public.drive_folders   enable row level security;
alter table public.system_settings enable row level security;
alter table public.admin_sessions  enable row level security;
alter table public.rate_limits     enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke execute on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
