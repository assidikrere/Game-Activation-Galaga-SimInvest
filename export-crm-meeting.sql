-- ADMIN / SQL EDITOR ONLY. Contains private contact information.
-- Do not publish query results or put a service-role key in the game.
-- New registrations use simoon_private; old simoon_participants data is preserved.
-- One row per declared email/phone. Latest registration sets the consent snapshot.
select p.player_id as crm_participant_id,p.email,p.phone_e164,
  s.risk_profile,s.marketing_opt_in,s.marketing_consented_at,s.consent_text,
  p.created_at as first_registered_at,s.created_at as last_registered_at,
  p.officials_used,
  (select max(r.score) from simoon_private.event_rounds r
    where r.player_id=p.player_id and r.finished_at is not null) as best_official_score
from simoon_private.event_players p
join lateral (select risk_profile,marketing_opt_in,marketing_consented_at,consent_text,created_at
  from simoon_private.event_sessions s where s.player_id=p.player_id
  order by created_at desc,session_token desc limit 1) s on true
where p.event_id='activation-2026'
order by p.created_at desc,p.player_id;
-- For telephone/WhatsApp promotion, filter the latest snapshot to marketing_opt_in=true.
-- The existing checkbox does not grant email marketing consent.
