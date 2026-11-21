-- A later feedback migration replaced the event constraint; retain both releases.
do $$ declare old_check text; begin
  select pg_get_constraintdef(oid) into old_check from pg_constraint
    where conrelid='public.bvf_journey_events'::regclass and conname='bvf_journey_events_event_name_check';
  if old_check is null then raise exception 'Expected event allowlist is missing'; end if;
  alter table public.bvf_journey_events drop constraint bvf_journey_events_event_name_check;
  execute 'alter table public.bvf_journey_events add constraint bvf_journey_events_event_name_check check (('
    || substring(old_check from 7) || ') or event_name in (''question_shown'',''assessment_failed'',''decision_save_failed'',''decision_reopened'',''assessment_restarted'',''review_opened'',''internal_browser_marked''))';
end $$;
notify pgrst, 'reload schema';
