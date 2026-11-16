-- AI BVF feedback: one row for each answer a browser gave, newest first. Read-only.
-- Run as an owner or service role. Public browser roles cannot read this table.
--
-- What is left out, and why:
--   1. Rows labelled automated_test or internal.
--   2. Before 11 November 2026 no label existed, so test runs look like visitors. A
--      browser ID first seen in an hour when more than 5 new browser IDs appeared is
--      treated as part of a test burst and left out. Ordinary traffic in that period
--      was about one new browser a day. From 11 November the label does this work and
--      the burst rule is not applied, so a real spike is never hidden.
--
-- One answer for each result:
--   Rows that share a feedback_key are one answer. The latest response wins and the
--   latest comments are kept. Rows recorded before 16 November 2026 have no key, so
--   rows from one browser session on one result label are read as one answer.
--
-- Each row is a browser storage ID, not a person. See docs/adoption-metrics.md.
-- The summary at the foot of this file counts verdicts and answers by week.

with first_seen as (
  select journey_hash, min(ts) as first_ts
  from public.bvf_journey_events
  group by journey_hash
),
burst_hours as (
  select date_trunc('hour', first_ts) as hr
  from first_seen
  where first_ts < timestamptz '2026-11-11 00:00:00+00'
  group by 1
  having count(*) > 5
),
kept as (
  select e.*
  from public.bvf_journey_events e
  join first_seen f on f.journey_hash = e.journey_hash
  where e.activity_cohort not in ('automated_test', 'internal')
    and date_trunc('hour', f.first_ts) not in (select hr from burst_hours)
),
feedback as (
  select
    k.*,
    coalesce(k.feedback_key, k.session_hash || ':' || coalesce(k.classification, 'none')) as answer_key
  from kept k
  where k.event_name in ('feedback_submitted', 'find_out_feedback_submitted')
    and k.feedback_response is not null
)
select
  max(ts) as answered_at,
  case when event_name = 'find_out_feedback_submitted' then 'find out' else 'result' end as asked_on,
  (array_agg(classification order by ts desc, id desc))[1] as result,
  (array_agg(held_back order by ts desc, id desc))[1] as held_back,
  (array_agg(feedback_response order by ts desc, id desc))[1] as response,
  (array_agg(feedback_more order by ts desc, id desc) filter (where feedback_more is not null))[1] as do_more_of,
  (array_agg(feedback_stop order by ts desc, id desc) filter (where feedback_stop is not null))[1] as stop_doing,
  (array_agg(industry order by ts desc, id desc) filter (where industry is not null))[1] as industry,
  (array_agg(user_role order by ts desc, id desc) filter (where user_role is not null))[1] as user_role,
  (array_agg(entry_route order by ts desc, id desc))[1] as entry_route,
  (array_agg(surface_version order by ts desc, id desc) filter (where surface_version is not null))[1] as surface_version,
  count(*) as rows_behind_this_answer,
  journey_hash
from feedback
group by journey_hash, event_name, answer_key
order by answered_at desc;

-- Weekly summary. Run it separately with the same CTEs down to "feedback":
--
-- , answers as (
--   select journey_hash, event_name, answer_key, max(ts) as answered_at,
--          (array_agg(feedback_response order by ts desc, id desc))[1] as response
--   from feedback group by 1, 2, 3
-- )
-- select
--   w.week,
--   (select count(distinct journey_hash) from kept
--     where event_name = 'verdict_returned' and date_trunc('week', ts) = w.week) as browsers_with_a_verdict,
--   (select count(distinct journey_hash) from kept
--     where event_name = 'find_out_returned' and date_trunc('week', ts) = w.week) as browsers_told_to_find_out,
--   count(a.answer_key) as answers,
--   count(*) filter (where a.response = 'Yes') as yes,
--   count(*) filter (where a.response = 'Partly') as partly,
--   count(*) filter (where a.response = 'No') as no
-- from (select distinct date_trunc('week', ts) as week from kept) w
-- left join answers a on date_trunc('week', a.answered_at) = w.week
-- group by w.week
-- order by w.week desc;
