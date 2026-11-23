-- The agent page on aibvf.com counts each run: started, finished or failed.
-- The event carries the way in (entry_route) and the industry picked, and nothing from the documents.
alter table public.bvf_journey_events drop constraint if exists bvf_journey_events_event_name_check;
alter table public.bvf_journey_events add constraint bvf_journey_events_event_name_check check (
  event_name = any (array[
    'start_page_viewed', 'assessment_started', 'verdict_returned', 'improvement_plan_opened',
    'decision_record_saved', 'rescore_due', 'assessment_rescored', 'evidence_review_completed',
    'quick_check_completed', 'portfolio_handoff_started', 'portfolio_import_confirmed', 'change_plan_opened',
    'connector_setup_opened', 'feedback_submitted', 'find_out_feedback_submitted', 'usage_context_saved',
    'workflow_test_opened', 'workflow_test_completed', 'workflow_test_returned',
    'reading_shown', 'reading_corrected', 'reading_confirmed', 'question_answered', 'find_out_returned',
    'answer_changed', 'result_printed', 'result_copied', 'advisory_link_opened',
    'question_shown', 'assessment_failed', 'decision_save_failed', 'decision_reopened',
    'assessment_restarted', 'review_opened', 'internal_browser_marked',
    'agent_run_started', 'agent_run_finished', 'agent_run_failed'
  ]::text[])
);
