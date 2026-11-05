-- Add a visit denominator and privacy-limited acquisition fields to the public journey.
-- Store no proposal text, organisation, full URL, query string or user identity.

alter table public.bvf_journey_events
  add column if not exists referrer_host text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text;

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
    'workflow_test_returned'
  ]));

alter table public.bvf_journey_events
  add constraint bvf_journey_events_referrer_host_check
    check (referrer_host is null or char_length(referrer_host) between 1 and 100),
  add constraint bvf_journey_events_utm_source_check
    check (utm_source is null or char_length(utm_source) between 1 and 100),
  add constraint bvf_journey_events_utm_medium_check
    check (utm_medium is null or char_length(utm_medium) between 1 and 100),
  add constraint bvf_journey_events_utm_campaign_check
    check (utm_campaign is null or char_length(utm_campaign) between 1 and 100);

create index if not exists bvf_journey_events_source_ts_idx
  on public.bvf_journey_events (utm_source, ts desc)
  where utm_source is not null;

comment on column public.bvf_journey_events.referrer_host is
  'Referring hostname only. Paths, query strings and full URLs are not stored.';

comment on column public.bvf_journey_events.utm_source is
  'Sanitised campaign source supplied in the page URL, limited to 100 characters.';

comment on column public.bvf_journey_events.utm_medium is
  'Sanitised campaign medium supplied in the page URL, limited to 100 characters.';

comment on column public.bvf_journey_events.utm_campaign is
  'Sanitised campaign name supplied in the page URL, limited to 100 characters.';
