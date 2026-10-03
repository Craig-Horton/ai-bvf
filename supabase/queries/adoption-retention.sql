-- AI BVF observed adoption and repeat-use readout.
-- Run as an owner or service role; public browser roles cannot read either telemetry table.
-- Cohort: browser journeys starting in the last 30 days, observed through now.
-- Steps must follow the preceding step for the same browser journey.
-- Browser hashes cannot distinguish people or individual assessment records.
-- Recent starters have less time to return; these rates are not fixed-day retention.
-- Local counts cover telemetry-enabled stdio clients with stable install hashes.
-- Remote caller hashes cannot identify remote users and are excluded.

with report as (
  select now() - interval '30 days' as starts_at, now() as ends_at
),
web as (
  select e.*
  from public.bvf_journey_events e
  cross join report r
  where e.ts >= r.starts_at and e.ts < r.ends_at
),
starters as (
  select journey_hash, min(ts) as started_at
  from web
  where event_name = 'assessment_started'
  group by journey_hash
),
verdicts as (
  select s.*, v.verdict_at
  from starters s
  left join lateral (
    select min(w.ts) as verdict_at
    from web w
    where w.journey_hash = s.journey_hash
      and w.event_name = 'verdict_returned'
      and w.ts >= s.started_at
  ) v on true
),
savers as (
  select v.*, d.saved_at
  from verdicts v
  left join lateral (
    select min(w.ts) as saved_at
    from web w
    where w.journey_hash = v.journey_hash
      and w.event_name = 'decision_record_saved'
      and w.ts >= v.verdict_at
  ) d on true
),
journeys as (
  select s.*, a.rescored_at
  from savers s
  left join lateral (
    select min(w.ts) as rescored_at
    from web w
    where w.journey_hash = s.journey_hash
      and w.event_name = 'assessment_rescored'
      and w.ts > s.saved_at
  ) a on true
),
web_counts as (
  select
    count(*) as assessment_starters,
    count(verdict_at) as verdict_recipients,
    count(saved_at) as decision_savers,
    count(rescored_at) as subsequent_rescorers,
    count(*) filter (where exists (
      select 1 from web w
      where w.journey_hash = j.journey_hash
        and w.event_name = 'feedback_submitted'
        and w.ts >= j.started_at
    )) as feedback_respondents
  from journeys j
),
mcp_installs as (
  select
    install_hash,
    count(distinct (ts at time zone 'UTC')::date) as active_days,
    bool_or(assessment_stage = 'verdict') as reached_verdict
  from public.mcp_calls
  cross join report r
  where ts >= r.starts_at and ts < r.ends_at
    and entry_route = 'stdio'
    and install_hash is not null
  group by install_hash
)
select
  assessment_starters,
  verdict_recipients,
  round(100.0 * verdict_recipients / nullif(assessment_starters, 0), 1) as web_activation_pct,
  decision_savers,
  round(100.0 * decision_savers / nullif(verdict_recipients, 0), 1) as decision_save_pct,
  subsequent_rescorers,
  round(100.0 * subsequent_rescorers / nullif(decision_savers, 0), 1) as subsequent_rescore_pct,
  feedback_respondents,
  (select count(*) from mcp_installs) as observed_local_mcp_installs,
  (select count(*) from mcp_installs where reached_verdict) as local_mcp_installs_reaching_verdict,
  (select count(*) from mcp_installs where active_days > 1) as local_mcp_installs_active_on_multiple_days
from web_counts;

-- Event detail for finding the point where the journey loses people.
select
  event_name,
  entry_route,
  count(*) as events,
  count(distinct journey_hash) as anonymous_browsers
from public.bvf_journey_events
where ts >= now() - interval '30 days'
group by event_name, entry_route
order by events desc;

-- Feedback split; free-text comments remain visible only to the database owner.
select
  feedback_response,
  count(*) as responses,
  count(*) filter (where feedback_more is not null or feedback_stop is not null) as responses_with_comments
from public.bvf_journey_events
where ts >= now() - interval '30 days'
  and event_name = 'feedback_submitted'
group by feedback_response
order by responses desc;
