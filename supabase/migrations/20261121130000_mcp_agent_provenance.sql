-- Additive: record whether a guided assessment was answered by a person or by
-- an agent working from evidence, and at a review, the earlier verdict and
-- what happened since. Categories only. No proposal, quote or source is
-- stored. Older package versions leave all three columns empty. No row changes.
alter table public.mcp_calls
  add column if not exists answered_by text,
  add column if not exists review_previous_verdict text,
  add column if not exists review_outcome text;

alter table public.mcp_calls drop constraint if exists mcp_calls_answered_by_check;
alter table public.mcp_calls add constraint mcp_calls_answered_by_check
  check (answered_by is null or answered_by in ('owner','evidence'));

alter table public.mcp_calls drop constraint if exists mcp_calls_review_previous_verdict_check;
alter table public.mcp_calls add constraint mcp_calls_review_previous_verdict_check
  check (review_previous_verdict is null or review_previous_verdict in ('Accelerate','Fix','Stop'));

alter table public.mcp_calls drop constraint if exists mcp_calls_review_outcome_check;
alter table public.mcp_calls add constraint mcp_calls_review_outcome_check
  check (review_outcome is null or review_outcome in (
    'delivering','falling_short','fixed_then_went_ahead','paused_or_stopped','no_decision'));

comment on column public.mcp_calls.answered_by is
  'owner: a person answered the guided questions. evidence: an agent working alone answered from evidence it quoted.';
comment on column public.mcp_calls.review_previous_verdict is
  'At a review: the verdict the initiative received at its last assessment.';
comment on column public.mcp_calls.review_outcome is
  'At a review: what happened since the earlier verdict, as one of five fixed answers. Set beside review_previous_verdict, this is the record of whether verdicts matched what happened.';

-- The owner-only reporting view gains the three columns at the end. Its
-- existing columns, its cohort rule and its security_invoker setting are unchanged.
create or replace view bvf_analytics.mcp_events with (security_invoker = true) as
 select e.id, e.ts, e.tool_name, e.bvf_version, e.caller_hash, e.industry, e.function, e.ai_tier,
    e.readiness, e.classification, e.confidence, e.package_version, e.install_hash, e.entry_route,
    e.assessment_stage, e.work_architecture_status, e.user_role, e.activity_cohort, e.assessment_hash,
    e.question_key, e.outcome, e.received_at,
    coalesce(e.received_at, e.ts) as observed_at,
    case
      when l.cohort = any (array['internal'::text, 'automated_test'::text]) then l.cohort
      when e.activity_cohort = any (array['internal'::text, 'automated_test'::text]) then e.activity_cohort
      when l.cohort = 'external_confirmed'::text then l.cohort
      when e.activity_cohort = 'public_unverified'::text then 'public_unverified'::text
      else 'unknown'::text
    end as reporting_cohort,
    e.answered_by, e.review_previous_verdict, e.review_outcome
   from public.mcp_calls e
     left join bvf_analytics.subject_labels l on l.subject_kind = 'install'::text and l.subject_hash = e.install_hash;
notify pgrst, 'reload schema';
