-- Steps 2.11 and 2.12: audit helper and config seed.

-- Audit helper. Only server code (service role) and database functions may call it.
create function public.write_audit(
  p_actor uuid,
  p_action text,
  p_target_table text,
  p_target_id text,
  p_reason text default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, target_table, target_id, reason, details)
  values (p_actor, p_action, p_target_table, p_target_id, p_reason, coalesce(p_details, '{}'::jsonb));
$$;
revoke all on function public.write_audit(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.write_audit(uuid, text, text, text, text, jsonb) to service_role;

-- Every config change writes an audit row and stamps who changed it.
create function public.config_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.write_audit(
    auth.uid(), 'config.change', 'config', new.key, null,
    jsonb_build_object('old', old.value, 'new', new.value)
  );
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
create trigger config_audit before update on public.config
  for each row when (old.value is distinct from new.value)
  execute function public.config_before_update();

-- Config seed. Only values the owner has decided. Open questions are not seeded:
-- Q27 (reliability formula and new provider rating) has no row yet.
-- Q29 (urgent window 15 minutes) is a working default until the owner confirms.
insert into public.config (key, value, description) values
  ('ranking.normal', '{"distance":30,"rating":35,"reliability":20,"past_jobs":15}',
    'Ranking weights for normal jobs. Must add up to 100'),
  ('ranking.urgent', '{"distance":40,"reliability":25,"rating":25,"past_jobs":10}',
    'Ranking weights for urgent jobs. Must add up to 100'),
  ('ranking.max_distance_km', '15', 'Hard filter: providers farther than this are not listed'),
  ('ranking.list_size', '5', 'Providers shown to the customer on the pick screen'),
  ('offer.window_minutes.normal', '30', 'Minutes a picked provider has to answer'),
  ('offer.window_minutes.urgent', '15', 'Minutes per offer on urgent jobs (Q29, working default)'),
  ('offer.max_misses', '3', 'Declined or timed out offers before the job goes to admin'),
  ('tiers', '{"minor_below":20000,"large_from":80000,"standard_midpoint_check_days":3}',
    'Quote value in pesos. Minor is below minor_below. Large is large_from and up, or any major renovation'),
  ('deposit.percent', '50', 'Deposit as percent of the quote, always through the system (Q26 still open)'),
  ('large.split', '{"deposit":50,"milestones":40,"holdback":10}',
    'Large jobs: percent of the quote paid at each stage'),
  ('cancel.minor_flat_fee', '1500', 'Flat cancellation fee in pesos for minor jobs, taken from the deposit'),
  ('arrival.radius_m', '200', 'Provider must be within this many meters of the job pin to check in')
on conflict (key) do nothing;
