// Emit a rollback-only database check using the current report, not a copied query.
import { readFileSync } from 'node:fs';
const report = readFileSync(new URL('../supabase/queries/measurement-integrity.sql', import.meta.url), 'utf8')
  .replace('where observed_at<p.report_end)', "where observed_at<p.report_end and journey_hash like 'f0f0f0f0f0f0f0f0f0f0f0%')")
  .replace('where observed_at<p.report_end)', 'where false)')
  .trim().replace(/;$/, '');
console.log(`begin;
do $$ declare result jsonb; cohort jsonb; retention jsonb; begin
 if exists(select 1 from public.bvf_journey_events where journey_hash like 'f0f0f0f0f0f0f0f0f0f0f0%') then raise exception 'Fixture prefix already exists'; end if;
 insert into public.bvf_journey_events(event_id,journey_hash,session_hash,assessment_hash,event_name,question_key,ts,activity_cohort,surface_version)
 select gen_random_uuid(),'f0f0f0f0f0f0f0f0f0f0f0'||browser,'abcdef1234567890abcdef12','abcdefabcdefabcdefabcd'||attempt,event_name,question_key,now()-age::interval,'automated_test','measurement-regression'
 from (values
 ('01','01','assessment_started',null,'10 days'),
 ('01','01','verdict_returned',null,'9 days 23 hours'),
 ('01','01','decision_record_saved',null,'9 days 22 hours'),
 ('01','01','decision_reopened',null,'1 day'),
 ('01','02','assessment_started',null,'2 days'),
 ('01','02','question_shown','financial_return','2 days'),
 ('02','03','assessment_started',null,'2 days'),
 ('02','03','question_answered','financial_return','1 hour'),
 ('03','04','assessment_started',null,'1 hour')
 ) as f(browser,attempt,event_name,question_key,age);
 if exists(select 1 from public.bvf_journey_events where surface_version='measurement-regression' and received_at < now()) then raise exception 'Server receipt was not stamped'; end if;
 begin
  insert into public.bvf_journey_events(event_id,journey_hash,session_hash,event_name)
  select event_id,journey_hash,session_hash,event_name from public.bvf_journey_events where surface_version='measurement-regression' limit 1;
  raise exception 'Duplicate delivery was accepted';
 exception when unique_violation then null;
 end;
 -- Only these rollback fixtures get historical server times to test maturity.
 update public.bvf_journey_events set received_at=ts where surface_version='measurement-regression';
 select to_jsonb(r) into result from (${report}) r;
 select value into cohort from jsonb_array_elements(result->'web_by_cohort') where value->>'reporting_cohort'='automated_test';
 if (cohort->>'assessments_started')::int<>4 or (cohort->>'assessments_with_verdict')::int<>1 or (cohort->>'assessments_saved')::int<>1 then raise exception 'Assessment isolation failed: %',cohort; end if;
 if not exists(select 1 from jsonb_array_elements(result->'web_last_recorded_steps') s where s->>'observed_state'='inactive_24h_without_result' and s->>'last_question'='financial_return') then raise exception 'Stopped question not visible'; end if;
 select value into retention from jsonb_array_elements(result->'meaningful_return_use') where value->>'surface'='web';
 if (retention->>'eligible_d1_plus')::int<>2 or (retention->>'returned_d1_plus')::int<>2 or (retention->>'eligible_d7_plus')::int<>1 or (retention->>'returned_d7_plus')::int<>1 then raise exception 'Return maturity failed: %',retention; end if;
 insert into bvf_analytics.subject_labels(subject_kind,subject_hash,cohort,basis) values('browser','f0f0f0f0f0f0f0f0f0f0f001','internal','Rollback-only test');
 if exists(select 1 from bvf_analytics.web_events where journey_hash='f0f0f0f0f0f0f0f0f0f0f001' and reporting_cohort<>'internal') then raise exception 'Historical exclusion failed'; end if;
 if has_schema_privilege('anon','bvf_analytics','USAGE') or has_table_privilege('anon','bvf_analytics.subject_labels','SELECT') or has_table_privilege('authenticated','bvf_analytics.web_events','SELECT') then raise exception 'Private reporting is exposed'; end if;
end $$;
rollback;
select 'passed: isolated attempts, last question, mature returns, server receipt, deduplication, retrospective exclusion and private access' as result;`);
