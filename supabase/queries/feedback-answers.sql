-- AI BVF feedback: one row for each answer a browser gave, newest first. Owner-only.
-- Reads the private reporting view, so traffic groups follow docs/adoption-metrics.md.
--
-- Left out: the internal and automated_test groups. Every row kept shows its group.
-- Rows in the unknown group predate the labels and can include test runs. No row is
-- classed as a test because of its timing.
--
-- One answer for each result:
--   Rows that share a feedback_key are one answer. The latest response wins and the
--   latest comments are kept. Rows recorded before 16 November 2026 have no key, so
--   rows from one browser session on one result label are read as one answer.
--
-- Each row is a browser storage ID, not a person.

with feedback as (
  -- The reporting view was created before feedback_key and held_back existed, so both
  -- are read from the table by row ID.
  select
    e.*,
    b.held_back,
    coalesce(b.feedback_key, e.session_hash || ':' || coalesce(e.classification, 'none')) as answer_key
  from bvf_analytics.web_events e
  join public.bvf_journey_events b on b.id = e.id
  where e.reporting_cohort not in ('internal', 'automated_test')
    and e.event_name in ('feedback_submitted', 'find_out_feedback_submitted')
    and e.feedback_response is not null
)
select
  max(observed_at) as answered_at,
  (array_agg(reporting_cohort order by observed_at desc, id desc))[1] as traffic_group,
  case when event_name = 'find_out_feedback_submitted' then 'find out' else 'result' end as asked_on,
  (array_agg(classification order by observed_at desc, id desc))[1] as result,
  (array_agg(held_back order by observed_at desc, id desc))[1] as held_back,
  (array_agg(feedback_response order by observed_at desc, id desc))[1] as response,
  (array_agg(feedback_more order by observed_at desc, id desc) filter (where feedback_more is not null))[1] as do_more_of,
  (array_agg(feedback_stop order by observed_at desc, id desc) filter (where feedback_stop is not null))[1] as stop_doing,
  (array_agg(industry order by observed_at desc, id desc) filter (where industry is not null))[1] as industry,
  (array_agg(user_role order by observed_at desc, id desc) filter (where user_role is not null))[1] as user_role,
  (array_agg(entry_route order by observed_at desc, id desc))[1] as entry_route,
  (array_agg(surface_version order by observed_at desc, id desc) filter (where surface_version is not null))[1] as surface_version,
  count(*) as rows_behind_this_answer,
  journey_hash,
  (array_agg(assessment_hash order by observed_at desc, id desc) filter (where assessment_hash is not null))[1] as assessment_hash
from feedback
group by journey_hash, event_name, answer_key
order by answered_at desc;
