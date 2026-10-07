-- Run in the SQL Editor of project fomrafdtfafvmhnovkrd before deploying this version.
-- Preserves existing participants and their insert-only RLS policy.
begin;
alter table public.simoon_participants add column if not exists email text;
do $$ begin
 if not exists (select 1 from pg_constraint where conrelid='public.simoon_participants'::regclass and conname='simoon_participants_email_check') then
  alter table public.simoon_participants add constraint simoon_participants_email_check
  check (email is null or (char_length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')) not valid;
 end if;
end $$;
-- The existing contacts remain valid; new frontend registrations require email.
-- The existing INSERT table grant covers the new column. Public contact reads stay denied.

-- Optional public inventory snapshot: only stock data, never participant contacts.
create table if not exists public.simoon_reward_stock (
  reward_code text primary key check (reward_code in ('scent10','scent50')),
  stock_total integer not null check (stock_total >= 0),
  claimed integer not null default 0 check (claimed >= 0 and claimed <= stock_total),
  updated_at timestamptz not null default now()
);
alter table public.simoon_reward_stock enable row level security;
revoke all on public.simoon_reward_stock from public,anon,authenticated;
grant select on public.simoon_reward_stock to anon,authenticated;
grant all on public.simoon_reward_stock to service_role;
drop policy if exists simoon_read_stock_snapshot on public.simoon_reward_stock;
create policy simoon_read_stock_snapshot on public.simoon_reward_stock for select to anon,authenticated using (true);
create or replace view public.simoon_reward_available with (security_invoker=true) as
select reward_code,stock_total-claimed as remaining,updated_at from public.simoon_reward_stock;
revoke all on public.simoon_reward_available from public,anon,authenticated;
grant select on public.simoon_reward_available to anon,authenticated;
-- Count record-setting runs, not unique people. Display names are not unique identities.
-- Simultaneous rows are ordered by descending score, so the same timestamp cannot
-- produce several lower records. First positive score establishes the first record.
create or replace view public.simoon_daily_record_stats with (security_invoker=true) as
with ordered_scores as (
 select event_date,score,
 max(score) over (partition by event_date order by played_at,score desc rows between unbounded preceding and 1 preceding) as previous_high
 from public.daily_scores
)
select event_date,count(*) filter (where score>coalesce(previous_high,0))::integer as record_breaks
from ordered_scores group by event_date;
revoke all on public.simoon_daily_record_stats from public,anon,authenticated;
grant select on public.simoon_daily_record_stats to anon,authenticated;
-- No sample stock is seeded. An administrator records actual quantities and claims.
-- Set updated_at=now() whenever recording a change. Game completion never decrements stock.
notify pgrst,'reload schema';
commit;

-- Verify access without disclosing contacts.
select
 has_table_privilege('anon','public.simoon_participants','SELECT') as public_can_read_contacts,
 has_table_privilege('anon','public.simoon_participants','INSERT') as public_can_register,
 has_table_privilege('anon','public.simoon_reward_stock','UPDATE') as public_can_change_stock;
