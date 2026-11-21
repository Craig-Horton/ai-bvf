-- Owner-only report. Cohorts are never merged into a claimed human-user total.
-- Change report_end to reproduce a snapshot. Inactivity means no recorded continuation,
-- not a known reason for leaving. D1+/D7+ mean a later meaningful action after 24h/7d.
with p as (select now() as report_end, now()-interval '30 days' as report_start),
w as (select e.* from bvf_analytics.web_events e,p where observed_at<p.report_end),
m as (select e.* from bvf_analytics.mcp_events e,p where observed_at<p.report_end),
web_summary as (
 select reporting_cohort,count(*) as events,count(distinct journey_hash) as browser_ids,
 count(distinct journey_hash) filter(where event_name='start_page_viewed') as viewed,
 count(distinct assessment_hash) filter(where event_name='assessment_started') as assessments_started,
 count(distinct assessment_hash) filter(where event_name='verdict_returned') as assessments_with_verdict,
 count(distinct assessment_hash) filter(where event_name='find_out_returned') as assessments_needing_information,
 count(distinct assessment_hash) filter(where event_name='decision_record_saved') as assessments_saved,
 count(distinct assessment_hash) filter(where event_name='decision_reopened') as saved_assessments_reopened,
 count(distinct assessment_hash) filter(where event_name='assessment_rescored') as assessments_rescored,
 count(distinct assessment_hash) filter(where event_name='portfolio_handoff_started') as assessments_handed_off,
 count(distinct assessment_hash) filter(where event_name='portfolio_import_confirmed') as assessments_imported,
 count(*) filter(where assessment_hash is null and event_name<>'start_page_viewed') as events_without_assessment_link,
 count(*) filter(where event_name in ('assessment_failed','decision_save_failed')) as failure_events,
 count(distinct journey_hash) filter(where event_name='feedback_submitted') as feedback_browser_ids,
 max(observed_at) as latest_event_at
 from w,p where observed_at>=p.report_start group by reporting_cohort
),
attempts as (
 select reporting_cohort,journey_hash,assessment_hash,min(observed_at) as first_at,max(observed_at) as last_at,
 bool_or(event_name='verdict_returned') as reached_verdict,
 bool_or(event_name='find_out_returned') as needs_information,
 bool_or(event_name='decision_record_saved') as saved,
 bool_or(event_name='assessment_restarted') as restarted,
 bool_or(event_name in ('assessment_failed','decision_save_failed')) as had_error,
 (array_agg(event_name order by observed_at desc,id desc))[1] as last_event,
 (array_agg(question_key order by observed_at desc,id desc) filter(where question_key is not null))[1] as last_question
 from w where assessment_hash is not null and event_name not in ('start_page_viewed','internal_browser_marked','usage_context_saved','rescore_due')
 group by reporting_cohort,journey_hash,assessment_hash
),
stops as (
 select reporting_cohort,last_event,last_question,
 case when last_event in ('assessment_failed','decision_save_failed') then 'recorded_error'
 when saved then 'saved' when reached_verdict then 'verdict_received'
 when needs_information then 'needs_information' when had_error then 'recorded_error'
 when restarted then 'started_another_idea'
 when last_at<=p.report_end-interval '24 hours' then 'inactive_24h_without_result'
 else 'still_in_24h_observation_window' end as observed_state,count(*) as assessments
 from attempts,p where first_at>=p.report_start
 group by reporting_cohort,last_event,last_question,observed_state
),
mcps as (
 select reporting_cohort,entry_route,count(*) filter(where tool_name='server_connect') as connections,
 count(*) filter(where tool_name<>'server_connect') as tool_calls,
 count(distinct install_hash) as installation_ids,
 count(distinct install_hash) filter(where tool_name<>'server_connect') as tool_using_ids,
 count(*) filter(where assessment_stage='verdict') as verdict_calls,
 count(distinct assessment_hash) as linked_assessments,
 count(distinct assessment_hash) filter(where assessment_stage='verdict') as linked_assessments_with_verdict,
 count(*) filter(where tool_name='assess_ai_initiative' and assessment_hash is null) as unlinked_assessment_calls,
 count(*) filter(where install_hash is null) as events_without_return_identity,
 count(*) filter(where outcome='error') as error_calls,
 count(*) filter(where outcome='refused') as refused_calls,max(observed_at) as latest_event_at
 from m,p where observed_at>=p.report_start group by reporting_cohort,entry_route
),
mcp_stops as (
 select reporting_cohort,assessment_hash,max(observed_at) as last_at,
 (array_agg(assessment_stage order by observed_at desc,id desc))[1] as last_stage,
 (array_agg(question_key order by observed_at desc,id desc))[1] as last_question
 from m where assessment_hash is not null group by reporting_cohort,assessment_hash
),
actions as (
 select 'web' as surface,reporting_cohort,journey_hash as subject,observed_at
 from w where event_name in ('assessment_started','reading_confirmed','question_answered','answer_changed','decision_record_saved','decision_reopened','assessment_rescored','feedback_submitted','portfolio_import_confirmed')
 union all select 'mcp_'||entry_route,reporting_cohort,install_hash,observed_at
 from m where tool_name<>'server_connect' and install_hash is not null
),
first_action as (
 select surface,reporting_cohort,subject,min(observed_at) as first_at,max(observed_at) as last_at
 from actions group by surface,reporting_cohort,subject
),
retention as (
 select surface,reporting_cohort,count(*) as active_ids,
 count(*) filter(where first_at<=p.report_end-interval '24 hours') as eligible_d1_plus,
 count(*) filter(where last_at>=first_at+interval '24 hours') as returned_d1_plus,
 count(*) filter(where first_at<=p.report_end-interval '7 days') as eligible_d7_plus,
 count(*) filter(where last_at>=first_at+interval '7 days') as returned_d7_plus
 from first_action,p where first_at>=p.report_start
 group by surface,reporting_cohort
)
select p.*,
 'Internal and automated traffic is separate. public_unverified is not proof of a human; unknown is legacy/unclassified. Browser or installation IDs are not people. No fingerprints or cross-device matching.' as interpretation,
 (select jsonb_agg(to_jsonb(s)) from web_summary s) as web_by_cohort,
 (select jsonb_agg(to_jsonb(s)) from stops s) as web_last_recorded_steps,
 (select jsonb_agg(to_jsonb(s)) from (
   select reporting_cohort,question_key,
     count(distinct assessment_hash) filter(where event_name='question_shown') as assessments_shown,
     count(distinct assessment_hash) filter(where event_name='question_answered') as assessments_answered
   from w,p where observed_at>=p.report_start and question_key is not null
   group by reporting_cohort,question_key
 ) s) as questions_by_cohort,
 (select jsonb_agg(to_jsonb(s)) from mcps s) as mcp_by_cohort,
 (select jsonb_agg(to_jsonb(s)) from (
   select reporting_cohort,last_stage,last_question,count(*) as assessments,
   count(*) filter(where last_at<=p.report_end-interval '24 hours' and last_stage not in ('verdict','error')) as inactive_24h
   from mcp_stops,p where last_at>=p.report_start group by reporting_cohort,last_stage,last_question
 ) s) as mcp_last_recorded_steps,
 (select jsonb_agg(to_jsonb(s)) from retention s) as meaningful_return_use,
 (select count(*) from w where received_at is null) as historical_web_rows_without_server_receipt,
 (select count(*) from m where received_at is null) as historical_mcp_rows_without_server_receipt
from p;
