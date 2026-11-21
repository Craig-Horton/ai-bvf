-- Additive: record which piece of context the engine had to ask for because it
-- could not read it from the proposal. No proposal text is stored. No row changes.
alter table public.mcp_calls drop constraint mcp_calls_question_key_check;
alter table public.mcp_calls add constraint mcp_calls_question_key_check
  check (question_key is null or question_key in (
    'financial_return','governance_risk','strategic_alignment','change_enablement','work_architecture',
    'industry','function','ai_tier','employees'));
notify pgrst, 'reload schema';
