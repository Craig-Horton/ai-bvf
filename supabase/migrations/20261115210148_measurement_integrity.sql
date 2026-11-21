-- Additive: keep historical events and never manufacture historical receipt times.
create schema if not exists bvf_analytics;
revoke all on schema bvf_analytics from public, anon, authenticated;
grant usage on schema bvf_analytics to service_role;

create table bvf_analytics.subject_labels (
  subject_kind text not null check (subject_kind in ('browser', 'install')),
  subject_hash text not null check (subject_hash ~ '^[a-f0-9]{8,24}$'),
  cohort text not null check (cohort in ('internal', 'automated_test', 'external_confirmed')),
  basis text not null check (length(basis) between 1 and 300),
  labelled_at timestamptz not null default now(),
  primary key (subject_kind, subject_hash)
);
alter table bvf_analytics.subject_labels enable row level security;
revoke all on bvf_analytics.subject_labels from public, anon, authenticated;
grant select, insert, update, delete on bvf_analytics.subject_labels to service_role;

alter table public.bvf_journey_events
  add column event_id uuid,
  add column assessment_hash text check (assessment_hash is null or assessment_hash ~ '^[a-f0-9]{8,24}$'),
  add column question_key text check (question_key is null or question_key in ('financial_return','governance_risk','strategic_alignment','change_enablement','work_architecture')),
  add column received_at timestamptz;
alter table public.mcp_calls
  add column activity_cohort text not null default 'unknown' check (activity_cohort in ('unknown','automated_test','internal','public_unverified')),
  add column assessment_hash text check (assessment_hash is null or assessment_hash ~ '^[a-f0-9]{24}$'),
  add column question_key text check (question_key is null or question_key in ('financial_return','governance_risk','strategic_alignment','change_enablement','work_architecture')),
  add column outcome text check (outcome is null or outcome in ('ok','error')),
  add column received_at timestamptz;

create function bvf_analytics.stamp_received_at() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin new.received_at := clock_timestamp(); return new; end;
$$;
revoke all on function bvf_analytics.stamp_received_at() from public, anon, authenticated;
create trigger stamp_journey_receipt before insert on public.bvf_journey_events
  for each row execute function bvf_analytics.stamp_received_at();
create trigger stamp_mcp_receipt before insert on public.mcp_calls
  for each row execute function bvf_analytics.stamp_received_at();
create unique index bvf_journey_event_dedup on public.bvf_journey_events(event_id) where event_id is not null;
create index bvf_journey_assessment_idx on public.bvf_journey_events(assessment_hash,ts) where assessment_hash is not null;
create index mcp_assessment_idx on public.mcp_calls(assessment_hash,ts) where assessment_hash is not null;

alter table public.bvf_journey_events drop constraint bvf_journey_events_activity_cohort_check;
alter table public.bvf_journey_events add constraint bvf_journey_events_activity_cohort_check
  check (activity_cohort in ('unknown','automated_test','internal','external','public_unverified'));
-- Preserve the existing event allowlist while adding the new events.
do $$ declare old_check text; begin
  select pg_get_constraintdef(oid) into old_check from pg_constraint
    where conrelid='public.bvf_journey_events'::regclass and conname='bvf_journey_events_event_name_check';
  alter table public.bvf_journey_events drop constraint bvf_journey_events_event_name_check;
  execute 'alter table public.bvf_journey_events add constraint bvf_journey_events_event_name_check check (('
    || substring(old_check from 7) || ') or event_name in (''question_shown'',''assessment_failed'',''decision_save_failed'',''decision_reopened'',''assessment_restarted'',''review_opened'',''internal_browser_marked''))';
end $$;

-- Public payloads cannot certify an external user. Only the private operator labels can.
create view bvf_analytics.web_events with (security_invoker=true) as
select e.*, coalesce(e.received_at,e.ts) as observed_at,
  case
    when l.cohort in ('internal','automated_test') then l.cohort
    when exists(select 1 from public.bvf_journey_events i where i.journey_hash=e.journey_hash and
      (i.activity_cohort='internal' or i.utm_source='codex_release' or i.utm_medium='canary')) then 'internal'
    when e.activity_cohort='automated_test' then 'automated_test'
    when l.cohort='external_confirmed' then l.cohort
    when e.activity_cohort in ('external','public_unverified') then 'public_unverified'
    else 'unknown' end as reporting_cohort
from public.bvf_journey_events e left join bvf_analytics.subject_labels l
  on l.subject_kind='browser' and l.subject_hash=e.journey_hash;
create view bvf_analytics.mcp_events with (security_invoker=true) as
select e.*, coalesce(e.received_at,e.ts) as observed_at,
  case when l.cohort in ('internal','automated_test') then l.cohort
    when e.activity_cohort in ('internal','automated_test') then e.activity_cohort
    when l.cohort='external_confirmed' then l.cohort
    when e.activity_cohort='public_unverified' then 'public_unverified'
    else 'unknown' end as reporting_cohort
from public.mcp_calls e left join bvf_analytics.subject_labels l
  on l.subject_kind='install' and l.subject_hash=e.install_hash;
revoke all on all tables in schema bvf_analytics from public,anon,authenticated;
grant select on all tables in schema bvf_analytics to service_role;
notify pgrst, 'reload schema';
