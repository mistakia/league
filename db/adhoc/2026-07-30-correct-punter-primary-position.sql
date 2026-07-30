-- STATUS: APPLIED 2026-07-30 against league_production
--
-- player: correct primary_position K -> P for 55 verified punters
--
-- Task: user:task/league/add-fantasypoints-player-ids.md
--
-- The FantasyPoints id backfill left 41 punters unresolved: FantasyPoints reports
-- them as P while the player table records primary_position = 'K'. expand_position
-- (libs-server/find-player-row.mjs) has no native case for either code, so each
-- expands only to itself and the two conventions never cross-match.
--
-- The repair is the position value, not the matcher. The table already carries
-- BOTH conventions (207 rows 'P', 557 'K'), and 38 name groups hold the same
-- punter once under each, so adding a K/P expansion group would convert those 38
-- currently-unambiguous lookups into MatchedMultiplePlayers across all 57
-- find_player_row callers -- 38 new failures to fix 40.
--
-- Population: the 41 from the FantasyPoints report plus 16 more found in the same
-- pid serial block (0279xx), a single batch import that labelled every specialist
-- 'K'. Each of the 57 was verified against an external source and two were
-- rejected as genuine kickers -- Cameron Dicker (CAME-DICK-027923) and Kaare
-- Vedvik (KAAR-VEDV-027989) -- leaving 55. Sleeper confirmed position = 'P' for
-- 52; Pro-Football-Reference confirmed Austin Rehkow and Richie Leone, who are
-- absent from Sleeper; Brad Wing is carried by the FantasyPoints feed itself.
--
-- Why this is SQL rather than resolve-player-match.mjs: 'primary_position' is in
-- excluded_props in libs-server/update-player.mjs, so updatePlayer silently
-- refuses it and the CLI's --primary-position flag only ever writes
-- secondary_position and position_depth. Those two columns were already corrected
-- to 'P' through the CLI (source = 'manual'); this file finishes the primary
-- column and records the matching changelog entries.

CREATE TEMP TABLE punter_pids (pid varchar(64) PRIMARY KEY);

INSERT INTO punter_pids (pid) VALUES
  ('AJXX-COLE-027934'),
  ('ANDY-LEEX-027888'),
  ('ARRY-SIPO-027980'),
  ('AUST-REHK-027984'),
  ('BLAK-GILL-027899'),
  ('BRAD-MANN-027953'),
  ('BRAD-PINI-006226'),
  ('BRAD-WING-027954'),
  ('BRAN-WRIG-027986'),
  ('BRET-KERN-027950'),
  ('BRYA-ANGE-027840'),
  ('CAME-JOHN-027941'),
  ('CAME-NIZI-027981'),
  ('COLB-WADM-027976'),
  ('COLT-SCHM-027920'),
  ('CORE-BOJO-027932'),
  ('CORL-WAIT-027982'),
  ('DOMX-MAGG-027962'),
  ('DONA-JONE-027961'),
  ('DRUE-CHRI-027964'),
  ('DUST-COLQ-027958'),
  ('JACK-FOXX-027978'),
  ('JAKE-BAIL-027905'),
  ('JAMI-GILL-027963'),
  ('JKXX-SCOT-027902'),
  ('JOHN-HEKK-027839'),
  ('JOHN-TOWN-027987'),
  ('JORD-BERR-008516'),
  ('JOSE-CHAR-027967'),
  ('KASE-REDF-027977'),
  ('KEVI-HUBE-027949'),
  ('LOGA-COOK-027914'),
  ('MATT-DARR-027917'),
  ('MATT-HAAC-027955'),
  ('MATT-WILE-027983'),
  ('MICH-DICK-027893'),
  ('MICH-PALA-027956'),
  ('MITC-WISH-027957'),
  ('NOLA-COON-027960'),
  ('PATX-ODON-008510'),
  ('PRES-HARV-027876'),
  ('RICH-LEON-027985'),
  ('RIGO-SANC-027924'),
  ('RILE-DIXO-027892'),
  ('RYAN-ALLE-027990'),
  ('RYAN-WINS-027988'),
  ('SAMX-KOCH-027784'),
  ('SAMX-MART-027846'),
  ('STER-HOFR-027969'),
  ('THOM-MORS-027856'),
  ('TOMM-TOWN-027894'),
  ('TRES-WAYX-027800'),
  ('TREV-DANI-027991'),
  ('TYLE-NEWS-027940'),
  ('TYXX-LONG-027948');

-- Refuse to run if the population drifted since this file was authored. Without
-- this the UPDATE would silently no-op on a re-run or a partial apply and read as
-- success.
DO $$
DECLARE
  found int;
BEGIN
  SELECT count(*) INTO found
  FROM player p
  JOIN punter_pids t ON t.pid = p.pid
  WHERE p.primary_position = 'K';

  IF found <> 55 THEN
    RAISE EXCEPTION 'expected 55 rows at primary_position K, found %', found;
  END IF;
END $$;

INSERT INTO player_changelog (
  pid, column_name, previous_value, new_value, source, reason, changed_at
)
SELECT
  p.pid,
  'primary_position',
  p.primary_position,
  'P',
  'manual',
  'verified punter mislabelled K by the specialist batch import; see user:task/league/add-fantasypoints-player-ids.md',
  now()
FROM player p
JOIN punter_pids t ON t.pid = p.pid
WHERE p.primary_position = 'K';

UPDATE player p
SET primary_position = 'P'
FROM punter_pids t
WHERE t.pid = p.pid
  AND p.primary_position = 'K';
