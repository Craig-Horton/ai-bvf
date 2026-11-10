-- Record each step of the guided Start journey and label automated browser checks.
-- Store no proposal text, no answer chosen, no organisation and no user identity.

alter table public.bvf_journey_events
  add column if not exists step smallint,
  add column if not exists activity_cohort text not null default 'unknown';

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

alter table public.bvf_journey_events
  drop constraint if exists bvf_journey_events_step_check;

alter table public.bvf_journey_events
  add constraint bvf_journey_events_step_check
  check (step is null or step between 1 and 5);

alter table public.bvf_journey_events
  drop constraint if exists bvf_journey_events_activity_cohort_check;

alter table public.bvf_journey_events
  add constraint bvf_journey_events_activity_cohort_check
  check (activity_cohort = any (array['unknown', 'automated_test', 'internal', 'external']));

comment on column public.bvf_journey_events.step is
  'Position of a guided question, 1 to 5, on question_answered events. The answer chosen is never stored.';

comment on column public.bvf_journey_events.activity_cohort is
  'unknown by default. automated_test when the browser reports that automation is driving it. internal and external are reserved for authenticated checks. Rows recorded before this column existed stay unknown.';

-- Let the REST layer see the new columns straight away.
notify pgrst, 'reload schema';
