-- AI BVF guided Start journey: where browsers stop. Read-only, one row.
-- Run as an owner or service role. Public browser roles cannot read this table.
-- Replace now() in report_end with a timestamptz literal to reproduce a snapshot.
-- The window is [starts_at, ends_at). Event timestamps are client supplied.
-- Rows labelled automated_test are left out. Every other row is counted,
-- including internal use, because the browser cannot tell the two apart.
-- Each count is browser storage IDs, not people. See docs/adoption-metrics.md.

with report_end as (
  select now() as ends_at
),
report as (
  select ends_at - interval '30 days' as starts_at, ends_at from report_end
),
web as (
  select e.*
  from public.bvf_journey_events e cross join report r
  where e.ts >= r.starts_at and e.ts < r.ends_at
    and e.entry_route = 'start'
    and e.activity_cohort <> 'automated_test'
),
browsers as (
  select
    journey_hash,
    bool_or(event_name = 'start_page_viewed') as viewed,
    bool_or(event_name = 'assessment_started') as started,
    bool_or(event_name = 'reading_shown') as reading_shown,
    bool_or(event_name = 'reading_corrected') as reading_corrected,
    bool_or(event_name = 'reading_confirmed') as reading_confirmed,
    coalesce(max(step) filter (where event_name = 'question_answered'), 0) as furthest_question,
    bool_or(event_name = 'find_out_returned') as told_to_find_out,
    bool_or(event_name = 'verdict_returned') as reached_verdict,
    bool_or(event_name in ('decision_record_saved', 'result_printed', 'result_copied')) as saved_or_shared,
    bool_or(event_name = 'answer_changed') as changed_an_answer,
    bool_or(event_name = 'feedback_submitted') as gave_feedback
  from web
  group by journey_hash
)
select
  (select starts_at from report) as starts_at,
  (select ends_at from report) as ends_at,
  count(*) filter (where viewed) as page_viewers,
  count(*) filter (where started) as starters,
  count(*) filter (where reading_shown) as shown_the_reading,
  count(*) filter (where reading_corrected) as corrected_the_reading,
  count(*) filter (where reading_confirmed) as confirmed_the_reading,
  count(*) filter (where furthest_question >= 1) as answered_question_1,
  count(*) filter (where furthest_question >= 2) as answered_question_2,
  count(*) filter (where furthest_question >= 3) as answered_question_3,
  count(*) filter (where furthest_question >= 4) as answered_question_4,
  count(*) filter (where furthest_question >= 5) as answered_question_5,
  count(*) filter (where told_to_find_out) as told_to_find_out,
  count(*) filter (where reached_verdict) as reached_verdict,
  count(*) filter (where reached_verdict and saved_or_shared) as saved_or_shared_after_verdict,
  count(*) filter (where reached_verdict and changed_an_answer) as changed_an_answer_after_verdict,
  count(*) filter (where reached_verdict and gave_feedback) as gave_feedback_after_verdict,
  (select count(*) from public.bvf_journey_events e cross join report r
    where e.ts >= r.starts_at and e.ts < r.ends_at and e.activity_cohort = 'automated_test') as automated_test_events_left_out
from browsers;
