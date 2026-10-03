-- AI BVF observed activity. Read-only, aggregate report.
-- Run as an owner or service role. Public browser roles cannot read these tables.
-- Replace now() in report_end with a timestamptz literal to reproduce a snapshot.
-- All sections share [starts_at, ends_at). Event timestamps are client supplied.
-- Browser hashes describe storage instances; local hashes describe persisted seeds.
-- Counts can include internal or automated activity. Diagnostics never exclude rows.
-- See docs/adoption-metrics.md for event meanings and coverage limits.

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
),
mcp as (
  select e.*
  from public.mcp_calls e cross join report r
  where e.ts >= r.starts_at and e.ts < r.ends_at
),
starters as (
  select journey_hash, min(ts) as started_at
  from web where event_name = 'assessment_started'
  group by journey_hash
),
verdicts as (
  select s.*, v.verdict_at
  from starters s
  left join lateral (
    select min(w.ts) as verdict_at from web w
    where w.journey_hash = s.journey_hash
      and w.event_name = 'verdict_returned' and w.ts >= s.started_at
  ) v on true
),
savers as (
  select v.*, d.saved_at
  from verdicts v
  left join lateral (
    select min(w.ts) as saved_at from web w
    where w.journey_hash = v.journey_hash
      and w.event_name = 'decision_record_saved' and w.ts >= v.verdict_at
  ) d on true
),
journeys as (
  select s.*, a.rescored_at, h.handoff_at, i.imported_at
  from savers s
  left join lateral (
    select min(w.ts) as rescored_at from web w
    where w.journey_hash = s.journey_hash
      and w.event_name = 'assessment_rescored' and w.ts > s.saved_at
  ) a on true
  left join lateral (
    select min(w.ts) as handoff_at from web w
    where w.journey_hash = s.journey_hash
      and w.event_name = 'portfolio_handoff_started' and w.ts >= s.verdict_at
  ) h on true
  left join lateral (
    select min(w.ts) as imported_at from web w
    where w.journey_hash = s.journey_hash
      and w.event_name = 'portfolio_import_confirmed' and w.ts >= h.handoff_at
  ) i on true
),
web_counts as (
  select
    count(*) as assessment_starter_ids,
    count(verdict_at) as verdict_recipient_ids,
    count(saved_at) as local_decision_saver_ids,
    count(rescored_at) as later_rescorer_ids,
    count(handoff_at) as portfolio_handoff_ids,
    count(imported_at) as later_portfolio_import_ids,
    count(*) filter (where exists (
      select 1 from web w where w.journey_hash = j.journey_hash
        and w.event_name = 'feedback_submitted' and w.ts >= j.started_at
    )) as feedback_respondent_ids
  from journeys j
),
web_ids as (
  select journey_hash, count(distinct (ts at time zone 'UTC')::date) as event_days
  from web group by journey_hash
),
local_ids as (
  select
    install_hash,
    count(*) filter (where tool_name = 'server_connect') as connection_events,
    count(*) filter (where tool_name <> 'server_connect') as tool_calls,
    count(distinct (ts at time zone 'UTC')::date) as event_days,
    count(distinct (ts at time zone 'UTC')::date)
      filter (where tool_name <> 'server_connect') as tool_days,
    bool_or(assessment_stage = 'verdict') as reached_verdict,
    max(ts) filter (where tool_name <> 'server_connect')
      - min(ts) filter (where tool_name <> 'server_connect') as tool_span
  from mcp where entry_route = 'stdio' and install_hash is not null
  group by install_hash
),
-- Match each handoff to the most recent preceding verdict in the same browser.
-- A short delay is a diagnostic only; it cannot identify automated callers.
handoff_delays as (
  select h.journey_hash, extract(epoch from h.ts - v.verdict_at) as seconds
  from web h
  join lateral (
    select max(w.ts) as verdict_at from web w
    where w.journey_hash = h.journey_hash
      and w.event_name = 'verdict_returned' and w.ts <= h.ts
  ) v on v.verdict_at is not null
  where h.event_name = 'portfolio_handoff_started'
),
event_detail as (
  select
    event_name,
    case event_name
      when 'decision_record_saved' then 'decision saved in browser local storage'
      when 'rescore_due' then 'future re-score date recorded at save time'
      when 'improvement_plan_opened' then 'non-Accelerate plan rendered automatically'
      when 'portfolio_handoff_started' then 'portfolio navigation requested'
      when 'portfolio_import_confirmed' then 'portfolio import confirmation emitted'
      else event_name
    end as event_meaning,
    entry_route,
    count(*) as events,
    count(distinct journey_hash) as browser_ids,
    count(*) filter (where user_role is not null) as role_tagged_events
  from web group by event_name, entry_route
),
route_detail as (
  select
    coalesce(entry_route, 'unknown') as entry_route,
    count(*) as events,
    count(*) filter (where tool_name = 'server_connect') as connection_events,
    count(*) filter (where tool_name <> 'server_connect') as tool_calls,
    count(*) filter (where assessment_stage = 'verdict') as verdict_stage_calls,
    count(*) filter (where assessment_stage = 'needs_input') as needs_input_calls,
    count(*) filter (where user_role is not null) as role_tagged_events,
    count(*) filter (where install_hash is null) as events_without_install_hash
  from mcp group by coalesce(entry_route, 'unknown')
),
feedback as (
  select feedback_response, count(*) as responses,
    count(*) filter (where feedback_more is not null or feedback_stop is not null)
      as responses_with_comments
  from web where event_name = 'feedback_submitted'
  group by feedback_response
)
select
  r.starts_at as window_start_inclusive,
  r.ends_at as window_end_exclusive,
  now() as generated_at,
  (select max(ts) from public.bvf_journey_events where ts < r.ends_at)
    as latest_browser_event_at,
  (select max(ts) from public.mcp_calls where ts < r.ends_at)
    as latest_mcp_event_at,
  'Observed IDs and events; internal and automated activity are unlabelled.'
    as interpretation,
  w.*,
  round(100.0 * verdict_recipient_ids / nullif(assessment_starter_ids, 0), 1)
    as requested_assessment_verdict_pct,
  round(100.0 * local_decision_saver_ids / nullif(verdict_recipient_ids, 0), 1)
    as verdict_to_local_save_pct,
  round(100.0 * later_rescorer_ids / nullif(local_decision_saver_ids, 0), 1)
    as local_save_to_later_rescore_pct,
  round(100.0 * later_portfolio_import_ids / nullif(portfolio_handoff_ids, 0), 1)
    as handoff_to_import_event_pct,
  (select count(*) from web_ids) as observed_browser_ids,
  (select count(*) from web_ids where event_days > 1)
    as browser_ids_with_events_on_multiple_utc_days,
  (select count(*) from local_ids) as observed_local_install_ids,
  (select count(*) from local_ids where connection_events > 0 and tool_calls = 0)
    as local_connection_only_ids,
  (select count(*) from local_ids where tool_calls > 0) as local_tool_using_ids,
  (select count(*) from local_ids where reached_verdict) as local_verdict_ids,
  (select count(*) from local_ids where event_days > 1)
    as local_ids_with_events_on_multiple_utc_days,
  (select count(*) from local_ids where tool_days > 1)
    as local_ids_with_tool_use_on_multiple_utc_days,
  jsonb_build_object(
    'interpretation', 'Timing patterns only; no activity is excluded.',
    'handoff_events_with_preceding_verdict', (select count(*) from handoff_delays),
    'handoff_events_under_one_second', (select count(*) from handoff_delays where seconds < 1),
    'browser_ids_with_handoff_under_one_second',
      (select count(distinct journey_hash) from handoff_delays where seconds < 1),
    'median_seconds_verdict_to_handoff',
      (select percentile_cont(0.5) within group (order by seconds) from handoff_delays),
    'local_ids_with_20_or_more_tool_calls_within_two_minutes',
      (select count(*) from local_ids where tool_calls >= 20 and tool_span <= interval '2 minutes'),
    'browser_event_utc_days', (select count(distinct (ts at time zone 'UTC')::date) from web)
  ) as traffic_diagnostics,
  coalesce((select jsonb_agg(to_jsonb(d) order by event_name, entry_route) from event_detail d), '[]'::jsonb)
    as browser_event_detail,
  coalesce((select jsonb_agg(to_jsonb(d) order by entry_route) from route_detail d), '[]'::jsonb)
    as mcp_route_detail,
  coalesce((select jsonb_agg(to_jsonb(f) order by feedback_response) from feedback f), '[]'::jsonb)
    as feedback_summary
from report r cross join web_counts w;
