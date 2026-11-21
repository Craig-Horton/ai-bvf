-- Additive: a declined input is recorded as refused, separate from a server fault.
-- No existing row changes. Older package versions keep sending ok or error.
alter table public.mcp_calls drop constraint mcp_calls_outcome_check;
alter table public.mcp_calls add constraint mcp_calls_outcome_check
  check (outcome is null or outcome in ('ok','error','refused'));
comment on column public.mcp_calls.outcome is
  'ok: the tool returned a result. refused: the tool declined incomplete or invalid input by design. error: a fault in the server.';
notify pgrst, 'reload schema';
