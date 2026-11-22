-- Additive: at a review, record what the owner decided on the next round of
-- money, as one of three words. No amount, threshold or result is stored.
-- Older package versions leave the column empty. No row changes.
alter table public.mcp_calls
  add column if not exists funding_decision text;

alter table public.mcp_calls drop constraint if exists mcp_calls_funding_decision_check;
alter table public.mcp_calls add constraint mcp_calls_funding_decision_check
  check (funding_decision is null or funding_decision in ('released','deferred','withdrew'));

comment on column public.mcp_calls.funding_decision is
  'At a review: what the person who holds the budget decided. released: the next round of money was released. deferred: the decision was put off. withdrew: the request was withdrawn. No amount is stored.';

-- The owner-only reporting view gains the column at the end. Its existing
-- columns, its cohort rule and its security_invoker setting are unchanged.
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
    e.answered_by, e.review_previous_verdict, e.review_outcome, e.funding_decision
   from public.mcp_calls e
     left join bvf_analytics.subject_labels l on l.subject_kind = 'install'::text and l.subject_hash = e.install_hash;
notify pgrst, 'reload schema';
