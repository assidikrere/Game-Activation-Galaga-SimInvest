-- SimInvest meeting revision, 9 October 2026.
-- Run this complete file in Supabase SQL Editor as the project administrator.
-- Existing participant and daily_scores archives are preserved. New clients use
-- the new API/table below; older unverified/name-only scores are not imported.
-- Jatah: TWO started official Galaga rounds per declared email/phone for this event.
-- Daily board: highest eligible score per participant per Jakarta calendar day.
-- Self-declared contact data is NOT proof of email ownership or SimInvest status.
begin;
create schema if not exists simoon_private;
revoke all on schema simoon_private from public;
grant usage on schema simoon_private to anon, authenticated;

create table if not exists simoon_private.event_players (
  player_id uuid primary key default gen_random_uuid(),
  event_id text not null check(event_id = 'activation-2026'),
  email text not null,
  phone_e164 text not null check(phone_e164 ~ '^\+628[0-9]{8,11}$'),
  officials_used smallint not null default 0 check(officials_used between 0 and 2),
  created_at timestamptz not null default statement_timestamp(),
  unique(event_id, email), unique(event_id, phone_e164),
  check(email = lower(btrim(email)) and char_length(email) between 5 and 254
    and email ~ '^[^[:space:]@]{1,64}@[^[:space:]@.]+(\.[^[:space:]@.]+)+$')
);
create table if not exists simoon_private.event_sessions (
  session_token uuid primary key,
  player_id uuid not null references simoon_private.event_players,
  risk_profile text not null check(risk_profile in ('konservatif','moderat','agresif')),
  marketing_opt_in boolean not null,
  marketing_consented_at timestamptz,
  consent_version text not null default 'crm-contact-v1-2026-10-05',
  consent_text text not null default 'Saya bersedia dihubungi SimInvest melalui telepon atau WhatsApp untuk informasi dan promosi produk investasi.',
  device_id text not null check(char_length(device_id) between 8 and 100),
  source text not null default 'siminvest_to_the_moon',
  created_at timestamptz not null default statement_timestamp()
);
create index if not exists event_sessions_player_idx on simoon_private.event_sessions(player_id);
create table if not exists simoon_private.event_rounds (
  round_id uuid primary key,
  player_id uuid not null references simoon_private.event_players,
  session_token uuid not null references simoon_private.event_sessions,
  ordinal smallint not null check(ordinal between 1 and 2),
  event_date date not null default (statement_timestamp() at time zone 'Asia/Jakarta')::date,
  started_at timestamptz not null default statement_timestamp(),
  finished_at timestamptz,
  score integer check(score >= 0),
  unique(player_id, ordinal)
);
create index if not exists event_rounds_date_idx on simoon_private.event_rounds(event_date, finished_at);
alter table simoon_private.event_players enable row level security;
alter table simoon_private.event_sessions enable row level security;
alter table simoon_private.event_rounds enable row level security;
revoke all on all tables in schema simoon_private from public, anon, authenticated;
grant usage on schema simoon_private to service_role;
grant all on all tables in schema simoon_private to service_role;

-- This is the only public score surface: no full email, phone, session token or CRM consent.
create table if not exists public.simoon_event_scores (
  event_id text not null check(event_id = 'activation-2026'),
  event_date date not null,
  player_id uuid not null,
  player_name text not null check(char_length(player_name) = 16 and right(player_name,12) = 'xxxxxxxxxxxx'),
  score integer not null check(score >= 0),
  played_at timestamptz not null,
  primary key(event_id, event_date, player_id)
);
create index if not exists simoon_event_scores_rank_idx
  on public.simoon_event_scores(event_id, event_date, score desc, played_at asc, player_id);
alter table public.simoon_event_scores enable row level security;
revoke all on public.simoon_event_scores from public, anon, authenticated;
grant select on public.simoon_event_scores to anon, authenticated;
grant all on public.simoon_event_scores to service_role;
drop policy if exists simoon_event_scores_read on public.simoon_event_scores;
create policy simoon_event_scores_read on public.simoon_event_scores
  for select to anon, authenticated using(event_id = 'activation-2026');

-- Privileged implementations are in the non-exposed schema. Public wrappers
-- are SECURITY INVOKER. A random 128-bit session token is the capability for
-- this anonymous event flow; no function accepts a caller-supplied player ID.
-- Fixed empty search_path; explicit grants; no contact-reading RPC.
create or replace function simoon_private.register_event(
  p_session_token uuid, p_email text, p_phone text, p_risk text,
  p_marketing boolean, p_device text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(p_email));
  v_phone text := btrim(p_phone);
  v_player simoon_private.event_players;
  v_session simoon_private.event_sessions;
begin
  if p_session_token is null or v_email is null or char_length(v_email) not between 5 and 254
    or v_email !~ '^[^[:space:]@]{1,64}@[^[:space:]@.]+(\.[^[:space:]@.]+)+$'
    or v_phone is null or v_phone !~ '^\+628[0-9]{8,11}$'
    or p_risk is null or p_risk not in ('konservatif','moderat','agresif')
    or p_marketing is null or p_device is null or char_length(p_device) not between 8 and 100
  then raise exception 'invalid_registration' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('simoon-email:' || v_email,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('simoon-phone:' || v_phone,0));
  select * into v_player from simoon_private.event_players
    where event_id = 'activation-2026' and (email = v_email or phone_e164 = v_phone) limit 1 for update;
  if found then
    if v_player.email <> v_email or v_player.phone_e164 <> v_phone then
      raise exception 'registration_contact_mismatch' using errcode = '22023';
    end if;
  else
    insert into simoon_private.event_players(event_id,email,phone_e164)
      values('activation-2026',v_email,v_phone) returning * into v_player;
  end if;
  select * into v_session from simoon_private.event_sessions where session_token = p_session_token;
  if found then
    if v_session.player_id <> v_player.player_id or v_session.risk_profile <> p_risk
      or v_session.marketing_opt_in <> p_marketing or v_session.device_id <> p_device then
      raise exception 'invalid_session' using errcode = '22023';
    end if;
  else
    insert into simoon_private.event_sessions(session_token,player_id,risk_profile,marketing_opt_in,marketing_consented_at,device_id)
      values(p_session_token,v_player.player_id,p_risk,p_marketing,
        case when p_marketing then statement_timestamp() else null end,p_device);
  end if;
  return jsonb_build_object('session_token',p_session_token,'display_email',left(v_email,4) || 'xxxxxxxxxxxx',
    'officials_used',v_player.officials_used,'remaining',2-v_player.officials_used);
end;
$$;

create or replace function simoon_private.begin_event_round(p_session_token uuid, p_round_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_player simoon_private.event_players; v_round simoon_private.event_rounds;
begin
  if p_round_id is null then raise exception 'invalid_round' using errcode = '22023'; end if;
  select p.* into v_player from simoon_private.event_players p
    join simoon_private.event_sessions s on s.player_id = p.player_id
    where s.session_token = p_session_token for update of p;
  if not found then raise exception 'invalid_session' using errcode = '22023'; end if;
  select * into v_round from simoon_private.event_rounds where round_id = p_round_id;
  if found then
    if v_round.session_token <> p_session_token or v_round.finished_at is not null then
      raise exception 'invalid_round' using errcode = '22023';
    end if;
    return jsonb_build_object('round_id',p_round_id,'eligible',true,'ordinal',v_round.ordinal,
      'remaining',2-v_player.officials_used,'event_date',v_round.event_date);
  end if;
  if v_player.officials_used >= 2 then
    return jsonb_build_object('round_id',p_round_id,'eligible',false,'ordinal',null,'remaining',0);
  end if;
  update simoon_private.event_players set officials_used = officials_used + 1
    where player_id = v_player.player_id returning * into v_player;
  insert into simoon_private.event_rounds(round_id,player_id,session_token,ordinal)
    values(p_round_id,v_player.player_id,p_session_token,v_player.officials_used) returning * into v_round;
  return jsonb_build_object('round_id',p_round_id,'eligible',true,'ordinal',v_round.ordinal,
    'remaining',2-v_player.officials_used,'event_date',v_round.event_date);
end;
$$;

create or replace function simoon_private.finish_event_round(p_session_token uuid, p_round_id uuid, p_score integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_round simoon_private.event_rounds; v_player simoon_private.event_players; v_best integer;
begin
  if p_score is null or p_score < 0 then raise exception 'invalid_score' using errcode = '22023'; end if;
  select * into v_round from simoon_private.event_rounds
    where round_id = p_round_id and session_token = p_session_token for update;
  if not found then raise exception 'invalid_round' using errcode = '22023'; end if;
  select * into v_player from simoon_private.event_players where player_id = v_round.player_id;
  if v_round.finished_at is null then
    update simoon_private.event_rounds set score = p_score, finished_at = statement_timestamp()
      where round_id = p_round_id returning * into v_round;
    insert into public.simoon_event_scores(event_id,event_date,player_id,player_name,score,played_at)
      values('activation-2026',v_round.event_date,v_player.player_id,left(v_player.email,4) || 'xxxxxxxxxxxx',
        v_round.score,v_round.finished_at)
      on conflict(event_id,event_date,player_id) do update
        set score = excluded.score, played_at = excluded.played_at
        where excluded.score > simoon_event_scores.score;
  end if;
  select score into v_best from public.simoon_event_scores
    where event_id = 'activation-2026' and event_date = v_round.event_date and player_id = v_round.player_id;
  return jsonb_build_object('score',v_round.score,'best_score',v_best,'ordinal',v_round.ordinal,
    'remaining',2-v_player.officials_used,'event_date',v_round.event_date);
end;
$$;

-- Aggregate-only record history for the reward panel, without exposing round tokens.
create or replace function simoon_private.record_stats(p_date date)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('record_breaks',count(*) filter(where score > coalesce(previous_best,0)))
  from (select score,max(score) over(order by finished_at,score desc,round_id
    rows between unbounded preceding and 1 preceding) as previous_best
    from simoon_private.event_rounds where event_date = p_date and finished_at is not null) r;
$$;

create or replace function public.simoon_register_event(p_session_token uuid,p_email text,p_phone text,p_risk text,p_marketing boolean,p_device text)
returns jsonb language sql security invoker set search_path = '' as $$
  select simoon_private.register_event(p_session_token,p_email,p_phone,p_risk,p_marketing,p_device);
$$;
create or replace function public.simoon_begin_round(p_session_token uuid,p_round_id uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select simoon_private.begin_event_round(p_session_token,p_round_id);
$$;
create or replace function public.simoon_finish_round(p_session_token uuid,p_round_id uuid,p_score integer)
returns jsonb language sql security invoker set search_path = '' as $$
  select simoon_private.finish_event_round(p_session_token,p_round_id,p_score);
$$;
create or replace function public.simoon_record_stats(p_date date)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select simoon_private.record_stats(p_date);
$$;
revoke all on function simoon_private.register_event(uuid,text,text,text,boolean,text),
  simoon_private.begin_event_round(uuid,uuid),simoon_private.finish_event_round(uuid,uuid,integer),
  simoon_private.record_stats(date) from public, anon, authenticated;
grant execute on function simoon_private.register_event(uuid,text,text,text,boolean,text),
  simoon_private.begin_event_round(uuid,uuid),simoon_private.finish_event_round(uuid,uuid,integer),
  simoon_private.record_stats(date) to anon, authenticated;
revoke all on function public.simoon_register_event(uuid,text,text,text,boolean,text),
  public.simoon_begin_round(uuid,uuid),public.simoon_finish_round(uuid,uuid,integer),
  public.simoon_record_stats(date) from public, anon, authenticated;
grant execute on function public.simoon_register_event(uuid,text,text,text,boolean,text),
  public.simoon_begin_round(uuid,uuid),public.simoon_finish_round(uuid,uuid,integer),
  public.simoon_record_stats(date) to anon, authenticated;

-- Add only the new masked score table to an existing realtime publication.
do $$ begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'simoon_event_scores') then
    alter publication supabase_realtime add table public.simoon_event_scores;
  end if;
end $$;
notify pgrst, 'reload schema';
commit;

-- All three results should be true, false, false respectively.
select has_table_privilege('anon','public.simoon_event_scores','SELECT') as public_reads_masked_scores,
  has_table_privilege('anon','public.simoon_event_scores','INSERT') as public_inserts_scores_directly,
  has_table_privilege('anon','simoon_private.event_players','SELECT') as public_reads_contacts;
