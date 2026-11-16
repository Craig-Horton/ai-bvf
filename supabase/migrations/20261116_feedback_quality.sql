-- Make feedback on the guided Start journey countable as one answer per result.
-- Store no proposal text, no organisation and no user identity.
--
-- feedback_key  A random ID the browser makes for each result it shows. Every feedback
--               row for that result carries it, so a changed answer or added comments
--               can be read as one answer. It is not derived from the idea or the answers.
-- held_back     On feedback only: the first question holding the idea back, from the
--               closed list of five. Sent when a person chooses to answer the feedback
--               question, and never on any other event.
-- find_out_feedback_submitted  Feedback on the "find out and come back" screen.

begin;

alter table public.bvf_journey_events
  add column if not exists feedback_key text,
  add column if not exists held_back text;

alter table public.bvf_journey_events
  drop constraint if exists bvf_journey_events_feedback_key_check;

alter table public.bvf_journey_events
  add constraint bvf_journey_events_feedback_key_check
  check (feedback_key is null or feedback_key ~ '^[a-f0-9]{16}$');

alter table public.bvf_journey_events
  drop constraint if exists bvf_journey_events_held_back_check;

alter table public.bvf_journey_events
  add constraint bvf_journey_events_held_back_check
  check (
    held_back is null
    or (
      event_name = 'feedback_submitted'
      and held_back = any (array[
        'financial_return',
        'governance_risk',
        'strategic_alignment',
        'change_enablement',
        'work_architecture'
      ])
    )
  );

alter table public.bvf_journey_events
  drop constraint if exists bvf_journey_events_event_name_check;

alter table public.bvf_journey_events
  add constraint bvf_journey_events_event_name_check
  check (event_name = any (array[
    'start_page_viewed',
    'assessment_started',
    'verdict_returned',
    'improvement_plan_opened',
    'decision_record_saved',
    'rescore_due',
    'assessment_rescored',
    'evidence_review_completed',
    'quick_check_completed',
    'portfolio_handoff_started',
    'portfolio_import_confirmed',
    'change_plan_opened',
    'connector_setup_opened',
    'feedback_submitted',
    'find_out_feedback_submitted',
    'usage_context_saved',
    'workflow_test_opened',
    'workflow_test_completed',
    'workflow_test_returned',
    'reading_shown',
    'reading_corrected',
    'reading_confirmed',
    'question_answered',
    'find_out_returned',
    'answer_changed',
    'result_printed',
    'result_copied',
    'advisory_link_opened'
  ]));

create index if not exists bvf_journey_events_feedback_idx
  on public.bvf_journey_events (journey_hash, feedback_key, ts desc)
  where feedback_key is not null;

comment on column public.bvf_journey_events.feedback_key is
  'Random ID made by the browser for each result it shows. All feedback rows for one result share it; the latest row is the answer. Not derived from the idea or the answers. Null on rows recorded before 16 November 2026.';

comment on column public.bvf_journey_events.held_back is
  'On feedback_submitted only: the first question holding the idea back, from the closed list of five. Null for an Accelerate and on every other event. The answer chosen is never stored.';

comment on column public.bvf_journey_events.activity_cohort is
  'unknown by default. automated_test when the browser reports that automation is driving it. internal when the browser was marked as internal by opening the page with ?internal=1, which is self-declared and unauthenticated. external is reserved for authenticated checks. Rows recorded before this column existed stay unknown.';

commit;

-- Let the REST layer see the new columns straight away.
notify pgrst, 'reload schema';

-- Verification after deployment:
-- select column_name from information_schema.columns
-- where table_schema = 'public' and table_name = 'bvf_journey_events'
--   and column_name in ('feedback_key', 'held_back');
--
-- select grantee, privilege_type from information_schema.role_table_grants
-- where table_schema = 'public' and table_name = 'bvf_journey_events'
-- order by grantee, privilege_type;
