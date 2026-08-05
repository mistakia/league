-- STATUS: APPLIED 2026-08-05 against league_production
--
-- Release 118 player.nfl_player_id values that nfl.com contradicts.
--
-- Each value here was verified INDIVIDUALLY against fantasy.nfl.com's player
-- card, independently of any name matching, and falls in exactly one of two
-- classes:
--
--   dead     (91 rows) the held id is absent from nfl.com's player table,
--            while the row's player IS in nfl.com's current listing under a
--            different id. An active player's real id is live, so a dead one is
--            wrong.
--   foreign  (27 rows) the held id resolves to a different person
--            entirely -- 2564007 is Jordan Love and sat on Jeff Okudah's row.
--
-- Cause: the 2020 rookie class was ingested with PROVISIONAL ids assigned in
-- alphabetical order (ahmed 2563785, aiyuk 2563786, akers 2563787, ... burrow
-- 2563825). nfl.com later replaced them -- its real Joe Burrow is 2563722 --
-- and subsequently issued some of those provisional numbers to OTHER real
-- players, which is what produced the foreign class.
--
-- This releases to NULL and does NOT reassign. Choosing a replacement by name
-- is the era-unscoped name attach this whole task exists to close: a draft of
-- the audit offered 2543509 as the correct id for alton robinson, and 2543509
-- is ALLEN Robinson's, correctly held by ALLE-ROBI-007116.
-- scripts/import-nfl-player-ids.mjs refills from nfl.com's own id-to-name
-- statement afterwards, which is authoritative rather than inferred.
--
-- Deliberately NOT released: ROBB-ANDE-017101 holds 2556462, which nfl.com
-- serves as "Robbie Chosen" -- the same person under a legal name change, so
-- the value is correct despite the surname disagreeing.
--
-- Reproduce with: node scripts/audit-nfl-player-id-attribution.mjs

CREATE TEMP TABLE nfl_player_id_release (
  pid varchar(25) NOT NULL,
  released_nfl_player_id bigint NOT NULL,
  verdict text NOT NULL,
  card_name text
);

INSERT INTO nfl_player_id_release (pid, released_nfl_player_id, verdict, card_name) VALUES
  ('EMOR-JONE-007624', 57485, 'dead', '400'),
  ('TANN-MORD-004611', 57862, 'dead', '400'),
  ('KYLE-MCCO-009051', 58386, 'dead', '400'),
  ('WILL-HOWA-007781', 58390, 'dead', '400'),
  ('CAMX-MILL-000546', 58420, 'dead', '400'),
  ('KURT-ROUR-000311', 58432, 'dead', '400'),
  ('SETH-HENI-004906', 58766, 'dead', '400'),
  ('BRAD-COOK-016371', 58839, 'dead', '400'),
  ('CONN-BAZE-000885', 58859, 'dead', '400'),
  ('DJXX-UIAG-000753', 58909, 'dead', '400'),
  ('HUNT-DEKK-000642', 59093, 'dead', '400'),
  ('EQUA-STBR-026891', 560883, 'dead', '400'),
  ('IRVX-SMIT-027793', 2503024, 'dead', '400'),
  ('JOSH-WILL-025433', 2504157, 'dead', '400'),
  ('ANDR-BECK-003159', 2562231, 'dead', '400'),
  ('DREW-SAMP-027640', 2562336, 'dead', '400'),
  ('DAVI-SILL-007685', 2562343, 'dead', '400'),
  ('JOSH-OLIV-002686', 2562408, 'dead', '400'),
  ('ALEX-MATT-015714', 2562484, 'dead', '400'),
  ('JAKE-BROW-000854', 2562485, 'dead', '400'),
  ('TONY-POLL-006632', 2562511, 'dead', '400'),
  ('BRET-RYPI-004842', 2562519, 'dead', '400'),
  ('MILE-SAND-015718', 2562520, 'dead', '400'),
  ('DARI-SLAY-026148', 2562524, 'dead', '400'),
  ('TRAY-WILL-025898', 2562545, 'dead', '400'),
  ('GREG-DORT-000862', 2562561, 'dead', '400'),
  ('ASHT-DULI-026527', 2562562, 'dead', '400'),
  ('LILJ-HUMP-007882', 2562567, 'dead', '400'),
  ('TRAV-HOME-015214', 2562570, 'dead', '400'),
  ('SALV-AHME-006650', 2563785, 'dead', '400'),
  ('BRAN-AIYU-006142', 2563786, 'dead', '400'),
  ('CAMX-AKER-006499', 2563787, 'dead', '400'),
  ('HARR-BRYA-002737', 2563820, 'dead', '400'),
  ('JOEX-BURR-000131', 2563825, 'dead', '400'),
  ('LAWR-CAGE-025947', 2563827, 'dead', '400'),
  ('MARQ-CALL-026922', 2563829, 'dead', '400'),
  ('QUIN-CEPH-002008', 2563831, 'dead', '400'),
  ('RODN-CLEM-027471', 2563839, 'foreign', 'Ben DiNucci'),
  ('ISAI-COUL-007687', 2563848, 'foreign', 'CeeDee Lamb'),
  ('DEEJ-DALL-006093', 2563851, 'dead', '400'),
  ('MARL-DAVI-003406', 2563854, 'foreign', 'Sean McKeon'),
  ('JOSI-DEGU-002075', 2563864, 'dead', '400'),
  ('JKXX-DOBB-011954', 2563869, 'dead', '400'),
  ('RICO-DOWD-006404', 2563870, 'dead', '400'),
  ('DEVI-DUVE-025864', 2563874, 'dead', '400'),
  ('CLYD-EDWA-025919', 2563878, 'dead', '400'),
  ('DARR-EVAN-006596', 2563882, 'dead', '400'),
  ('TIPA-GALE-026870', 2563890, 'foreign', 'KJ Hamler'),
  ('HARR-HAND-007372', 2563911, 'foreign', 'Albert Okwuegbunam'),
  ('JAMY-HAST-025526', 2563916, 'dead', '400'),
  ('JUST-HERB-000057', 2563921, 'dead', '400'),
  ('TEEX-HIGG-000938', 2563924, 'dead', '400'),
  ('JOHN-HIGH-027307', 2563926, 'foreign', 'Quintez Cephus'),
  ('ISAI-HODG-007881', 2563930, 'dead', '400'),
  ('JALE-HURT-003085', 2563936, 'dead', '400'),
  ('TRIS-JACK-015217', 2563944, 'foreign', 'Jeff Okudah'),
  ('VANX-JEFF-007529', 2563945, 'dead', '400'),
  ('JUST-JEFF-007359', 2563946, 'dead', '400'),
  ('JAUA-JENN-026160', 2563947, 'foreign', 'Julian Okwara'),
  ('COLL-JOHN-007700', 2563950, 'dead', '400'),
  ('TYLE-JOHN-027139', 2563952, 'dead', '400'),
  ('JUWA-JOHN-027811', 2563953, 'foreign', 'Bobby Price'),
  ('DALT-KEEN-004938', 2563961, 'dead', '400'),
  ('JAVO-KINL-027608', 2563965, 'dead', ''),
  ('COLE-KMET-002218', 2563966, 'dead', '400'),
  ('CEED-LAMB-017761', 2563967, 'dead', '400'),
  ('JORD-LOVE-001990', 2563976, 'dead', '400'),
  ('JORD-MACK-012827', 2563980, 'foreign', 'Josiah Deguara'),
  ('SEAN-MCKE-004805', 2563986, 'foreign', 'AJ Dillon'),
  ('DARN-MOON-007213', 2563995, 'dead', '400'),
  ('ZACK-MOSS-011961', 2563997, 'dead', '400'),
  ('JEFF-OKUD-007629', 2564007, 'foreign', 'Jordan Love'),
  ('ALBE-OKWU-004654', 2564009, 'dead', '400'),
  ('KJXX-OSBO-007622', 2564013, 'dead', '400'),
  ('COLB-PARK-002712', 2564015, 'dead', '400'),
  ('DONO-PEOP-007676', 2564021, 'dead', '400'),
  ('MICH-PITT-007119', 2564031, 'dead', '400'),
  ('JAME-PROC-001500', 2564033, 'dead', '400'),
  ('JALE-REAG-026888', 2564036, 'dead', '400'),
  ('CHAU-RIVE-026695', 2564040, 'foreign', 'Patrick Taylor'),
  ('ALTO-ROBI-020526', 2564043, 'foreign', 'Darrynton Evans'),
  ('LAVI-SHEN-027299', 2564053, 'dead', '400'),
  ('DAND-SWIF-005581', 2564070, 'foreign', 'Jonathan Greenard'),
  ('TUAX-TAGO-005436', 2564071, 'dead', '400'),
  ('JONA-TAYL-005633', 2564076, 'dead', '400'),
  ('JJXX-TAYL-017941', 2564077, 'dead', '400'),
  ('PATR-TAYL-001312', 2564078, 'dead', '400'),
  ('ADAM-TRAU-027641', 2564087, 'dead', '400'),
  ('KESH-VAUG-005814', 2564091, 'dead', '400'),
  ('QUEZ-WATK-026967', 2564099, 'dead', '400'),
  ('CODY-WHIT-007710', 2564102, 'dead', '400'),
  ('CHAR-WOER-002736', 2564114, 'dead', '400'),
  ('AJXX-DILL-006067', 2564131, 'dead', '400'),
  ('JAVE-GUID-025656', 2564136, 'foreign', 'Michael Pittman'),
  ('KJXX-HAML-027180', 2564138, 'dead', '400'),
  ('TYLE-HUNT-004877', 2564157, 'dead', '400'),
  ('JONA-WARD-006880', 2564175, 'dead', '400'),
  ('GIOV-RICC-006694', 2564194, 'dead', '400'),
  ('TAVI-FEAS-006697', 2564202, 'foreign', 'Collin Johnson'),
  ('CHRI-ROWL-026404', 2564232, 'foreign', 'Laviska Shenault Jr.'),
  ('MARC-SPEA-003318', 2564250, 'foreign', 'Andre Baccellia'),
  ('SCOT-WASH-006794', 2564256, 'dead', '400'),
  ('JOSH-AVER-020553', 2564313, 'foreign', 'Cody White'),
  ('BRYC-PERK-009604', 2564314, 'dead', '400'),
  ('TYLE-DAVI-002115', 2564327, 'dead', '400'),
  ('BENX-DINU-004880', 2564331, 'foreign', 'Terrell Burgess'),
  ('ANDR-BACC-007732', 2564342, 'dead', '400'),
  ('BLAK-LYNC-007235', 2564358, 'foreign', 'Van Jefferson'),
  ('DANX-CHIS-027460', 2564361, 'dead', '400'),
  ('ROJE-FARR-014118', 2564382, 'foreign', 'Bryce Perkins'),
  ('BRYA-LOND-019267', 2564514, 'foreign', 'Dan Chisena'),
  ('TYLE-MABR-000858', 2564533, 'dead', '400'),
  ('STER-JOHN-017472', 2564556, 'foreign', 'Justin Jefferson'),
  ('REGG-GILL-007008', 2564566, 'dead', '400'),
  ('ISAI-BROW-021185', 2564574, 'foreign', 'K.J. Osborn'),
  ('MASO-KINS-026718', 2564587, 'dead', '400'),
  ('NICK-WEST-007553', 2564591, 'dead', '400'),
  ('KRIS-WILK-007317', 2564592, 'foreign', 'Myles Bryant');

-- Refuse to proceed if a stored value has moved since the audit ran.
DO $$
DECLARE
  mismatched int;
BEGIN
  SELECT count(*) INTO mismatched
  FROM nfl_player_id_release r
  JOIN player p ON p.pid = r.pid
  WHERE p.nfl_player_id IS DISTINCT FROM r.released_nfl_player_id;

  IF mismatched > 0 THEN
    RAISE EXCEPTION 'nfl_player_id moved under % row(s) since the audit ran; re-run the audit', mismatched;
  END IF;
END $$;

UPDATE player
SET nfl_player_id = NULL
FROM nfl_player_id_release r
WHERE player.pid = r.pid
  AND player.nfl_player_id = r.released_nfl_player_id;
