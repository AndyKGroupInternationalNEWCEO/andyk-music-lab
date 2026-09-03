-- Onboarding/webhook integrity migration.
--
-- Run once via the Supabase SQL editor (or `supabase db execute < this file`).
-- Idempotent: safe to run more than once. Non-destructive: never deletes or
-- modifies existing rows — where a duplicate-safety check would need to remove
-- data to succeed, it SKIPS that step and RAISES a NOTICE instead of failing or
-- silently corrupting data, so this migration can never destroy production rows.
--
-- Why this is needed:
--   1. src/lib/access.ts and the Revolut webhook (src/app/api/revolut/webhook/route.ts)
--      grant tool_access via `POST .../tool_access?on_conflict=user_id,tool_name`
--      with `Prefer: resolution=merge-duplicates`. PostgREST requires a real unique
--      constraint matching that conflict target for this to work — without it, every
--      such request errors, so *no* onboarding path (register/link-access/webhook)
--      can grant tool access at all until this exists.
--   2. pending_access is upserted via `on_conflict=order_id` from three places
--      (revolut/order, revolut/subscription's free-order path, notify/payment-success,
--      and the webhook) — same requirement, on order_id.
--   3. The webhook's idempotency guard (claimEvent in the webhook route) writes to a
--      webhook_events table keyed by Revolut's event id — this table did not exist
--      before this migration, so duplicate webhook deliveries were not deduplicated.
--   4. profiles.plan currently has `check (plan in ('single','studio','pro'))`, but
--      src/lib/access.ts's PLAN_TOOLS (and the standalone-tool pricing in
--      revolut/subscription/route.ts) also sell 8 individual "tool_*" plans
--      (tool_mastering, tool_bpm, ...). Every write of profiles.plan = 'tool_bpm'
--      (etc.) violates this constraint and silently fails (the app code does not
--      check the response status on that PATCH/INSERT) — the customer still gets
--      working tool_access (that table has no such constraint), but their profile
--      plan/expiry never gets recorded, so they never appear in the admin customer
--      list and never receive expiry-warning emails. This widens the constraint to
--      match every plan the app actually sells.

-- ── 1. webhook_events — idempotency ledger for Revolut webhook deliveries ──────
create table if not exists webhook_events (
  id         text primary key,        -- Revolut event id (falls back to "type:order_id" if absent)
  event_type text not null,
  created_at timestamptz not null default now()
);

-- Only ever touched via the service-role key (bypasses RLS) from the webhook route —
-- enabling RLS with no policies blocks the anon/authenticated PostgREST roles from
-- reading or writing it directly.
alter table webhook_events enable row level security;

-- ── 2. tool_access(user_id, tool_name) — required for the on_conflict upserts ──
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'tool_access_user_id_tool_name_key'
  ) then
    raise notice 'tool_access_user_id_tool_name_key already exists — skipping.';
  elsif exists (
    select 1 from tool_access
    group by user_id, tool_name
    having count(*) > 1
  ) then
    raise notice 'tool_access has existing duplicate (user_id, tool_name) rows — '
      'constraint NOT added. Review and de-duplicate manually (this migration '
      'will not delete rows), then re-run this migration.';
  else
    alter table tool_access
      add constraint tool_access_user_id_tool_name_key unique (user_id, tool_name);
  end if;
end $$;

-- ── 3. pending_access(order_id) — required for the on_conflict=order_id upserts ─
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'pending_access_order_id_key'
  ) then
    raise notice 'pending_access_order_id_key already exists — skipping.';
  elsif exists (
    select 1 from pending_access
    group by order_id
    having count(*) > 1
  ) then
    raise notice 'pending_access has existing duplicate order_id rows — '
      'constraint NOT added. Review and de-duplicate manually (this migration '
      'will not delete rows), then re-run this migration.';
  else
    alter table pending_access
      add constraint pending_access_order_id_key unique (order_id);
  end if;
end $$;

-- ── 4. Widen profiles.plan check constraint to cover the standalone tool plans ──
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'profiles_plan_check') then
    alter table profiles drop constraint profiles_plan_check;
  end if;
  alter table profiles add constraint profiles_plan_check check (
    plan is null or plan in (
      'single', 'studio', 'pro',
      'tool_mastering', 'tool_bpm', 'tool_planner', 'tool_comparator',
      'tool_chord', 'tool_metronome', 'tool_loudness', 'tool_stems'
    )
  );
end $$;
