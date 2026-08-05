-- STATUS: APPLIED 2026-08-05 against league_production
--
-- Collapse 170 further duplicate-PERSON rows in `player` onto 167 survivors:
-- one real person represented by two (or three) rows under different forms of
-- their name. This is the follow-on to 7eda49a6c, which merged 189 pairs of the
-- same defect. Distinct from the conflated-identity work (one row merging two
-- people), which owns four referred pairs this migration deliberately leaves
-- alone.
--
-- Population. 173 verified pairs resolving to 167 clusters, three of which hold
-- THREE rows rather than two (Wong, Kemoeatu, Peko). A pairwise merge loop would
-- leave those survivors still duplicated, so the map is expressed as
-- drop -> keep and the three clusters simply carry two drop rows each.
--
-- Survivor rule: most gamelogs wins; on a tie, most identifiers. That keeps the
-- expensive-to-move side in place -- 168 of the 170 deleted rows carry no
-- gamelogs at all.
--
-- Evidence. Every pair carries an external verdict; none rests on a birth-date
-- coincidence in our own data.
--   * nflverse identifier join  -- 48 pairs. Both rows resolve to the SAME
--     nflverse person across gsis/esb/pfr/espn/otc/pff/smart. nflverse `nfl_id`
--     was deliberately NOT used: it is gsis_it_player_id, not nfl_player_id.
--   * nflverse name variant     -- 107 pairs. One row resolves; that person's
--     own recorded name forms (display_name, first_name, common_first_name,
--     football_name) carry the very alias the other row is filed under.
--   * Pro Football Reference    -- 18 pairs, legal-name field read directly.
--
-- Independent re-validation before applying (scratch/.../VALIDATION.md):
--   * The nflverse snapshot is byte-identical to a fresh pull (sha256 a17c10b1).
--   * All 337 rows were re-resolved from scratch: ZERO clusters have their two
--     sides resolving to different nflverse people.
--   * Corroboration on fields never used to match: high school agrees on 41
--     clusters and disagrees on NONE; date of birth agrees on 163, disagrees on
--     2 (both known digit corruption). No cluster lacks all corroboration.
--   * Twins and brothers are the dominant false positive in this data and are
--     what produced the 12 excluded pairs. Asked nflverse how many real people
--     match each cluster's (last name, birth date): exactly ONE cluster is
--     ambiguous, Ronde Barber, and nflverse settles it directly by recording
--     Ronde's first_name as `Jamael` against Tiki's `Atiim`.
--   * Sleeper, which compiles its own biographies, contradicted nothing.
--
-- Two birth-date "repairs" were REMOVED after browser verification. The handoff
-- called for rewriting Alex Kupper to 1990-02-14 and Nate Menkin to 1988-10-04
-- on nflverse's authority. Pro Football Reference gives February 4 1990 and
-- October 10 1988 -- agreeing with the value each surviving row already holds,
-- against nflverse. Neither surviving row carries a pfr_player_id, so ours is
-- not simply PFR restated; the GSIS-derived side is the outlier in both cases.
-- Two sources against one is not a mandate to overwrite, so nothing is written.
--
-- Gamelog collisions. Only two merges move gamelogs, and they resolve in
-- OPPOSITE directions -- which is why each was adjudicated column by column
-- rather than by precedent.
--   * JACK-WOOD-002453 (keep, 6) over ERNE-WOOD-001965 (drop, 4), colliding on
--     4 games. The survivor holds every snap count and no dropped copy holds a
--     value the survivor lacks, so the survivor's rows stand as they are.
--   * JAME-JONE-025111 (keep, 41) over JAMI-JONE-026287 (drop, 32), colliding
--     on all 32. Here the DROPPED copies carry all 56 snap columns and the
--     survivor's are null. Deleting them outright would destroy Jamir Jones's
--     entire 2021-2022 snap record, so step 4 fills the survivor's nulls from
--     the donor before anything is deleted.
--
-- Other collisions. Beyond gamelogs, only two more drop rows collide anywhere:
-- MICH-STRA-008776 and MAUR-FLEM-025460, in projection and ranking tables where
-- both rows were independently projected. The survivor's rows are authoritative
-- and the donor's duplicates are dropped. 166 of the 170 deleted rows repoint
-- with no collision at all.
--
-- Identifier ordering. Copying an identifier onto the survivor while the donor
-- still holds it would violate the UNIQUE index for the duration of the
-- statement, so the order is: snapshot, re-point, DELETE, then fill from the
-- snapshot.
--
-- Era gate on nfl_player_id. A row produced by a name-match hijack inherits the
-- nfl_player_id of whoever the matcher hit, and a foreign-but-unique id collides
-- with nothing, so the UNIQUE index cannot catch it. All 81 carries were gated:
-- predict entry year from the median nfl_draft_year of the 60 nearest
-- nfl_player_id neighbours and compare against the survivor's date of birth plus
-- 22. 71 agree within five years (median gap 1 year, max 4) and are carried. 10
-- are withheld and flagged false below -- two inside the sparse 2508600-2530400
-- dead zone where nearest-median is a coin flip, one where the survivor's date
-- of birth is the 0000-00-00 sentinel, and seven where the era disagrees by 6 to
-- 13 years (mostly late NFL entrants, for whom birth-year-plus-22 is a poor
-- expectation). Every withheld value is preserved in player_changelog by step 2
-- and so stays recoverable.
--
-- Reversibility. Every non-null column value on every deleted row is written to
-- player_changelog under this source before the delete. A full JSON backup of
-- all 337 player rows plus all 86,460 downstream rows that reference a deleted
-- pid sits in
-- scratch/dedupe-duplicate-person-rows/2026-08-04-dedupe-round2-backup.jsonl.
--
-- db:exec wraps this file in a single transaction; no explicit BEGIN here.

CREATE TEMP TABLE merge_map (
  drop_pid varchar NOT NULL PRIMARY KEY,
  keep_pid varchar NOT NULL,
  carry_nfl_player_id boolean NOT NULL
) ON COMMIT DROP;

INSERT INTO merge_map (drop_pid, keep_pid, carry_nfl_player_id) VALUES
  ('AJXX-SCHA-018518', 'ANDR-SCHA-001913', true),
  ('ALEX-KUPP-002212', 'ALEX-KUPP-002100', true),
  ('ANDR-COCH-009641', 'DEVI-COCH-004509', true),
  ('ANDY-KING-016511', 'ANDR-KING-001391', true),
  ('ANFE-ADAM-018655', 'KEIO-ADAM-026250', true),
  ('ANTH-SEMP-009766', 'TONY-SEMP-001807', true),
  ('BENX-NOLL-018867', 'BENJ-NOLL-001773', true),
  ('BOSS-BAIL-017397', 'RODN-BAIL-023504', true),
  ('BRIA-BLAC-010556', 'JORD-BLAC-001544', true),
  ('BRYA-EVAN-006313', 'HEAT-EVAN-009666', true),
  ('BXXX-ROBI-019415', 'MICH-ROBI-019021', true),
  ('BYRO-TRAY-017614', 'KEIT-TRAY-015401', true),
  ('CHAD-CLIF-001973', 'JEFF-CLIF-021405', true),
  ('CHAD-STAN-006913', 'BENJ-STAN-001015', true),
  ('CHAR-TULL-015225', 'DAVI-TULL-026772', true),
  ('CHIB-OKOR-019698', 'KENN-OKOR-002217', true),
  ('CHRI-HOLL-008239', 'DEVO-HOLL-004160', true),
  ('CHRI-KEMO-002198', 'CHRI-KEMO-001887', true),
  ('CHUC-NWOK-007159', 'CHIJ-NWOK-000820', true),
  ('CHUK-JONA-019753', 'KING-JONA-026669', true),
  ('CORN-GREE-019802', 'CHRI-GREE-019738', true),
  ('CORN-STAL-002351', 'TREX-STAL-019551', true),
  ('CRAI-JARR-009407', 'THOM-JARR-001845', true),
  ('DAMU-BOLD-019875', 'BUBB-BOLD-027195', true),
  ('DANI-CURL-019900', 'DANX-CURL-001549', true),
  ('DANI-KOOI-019904', 'SCOT-KOOI-019345', true),
  ('DANI-ZIEM-009136', 'LEEX-ZIEM-027228', true),
  ('DANX-STRY-020065', 'DANI-STRY-001018', false),  -- era DISAGREES (predicted 1997 vs expected 1987, gap 10y)
  ('DAVE-FIOR-020087', 'DAVI-FIOR-000418', true),
  ('DAVE-YOVA-018183', 'DAVI-YOVA-012073', true),
  ('DAVI-STEW-018414', 'JAME-STEW-021276', true),
  ('DEME-BELL-018245', 'DEME-BELL-018239', true),
  ('DEMO-SAND-008321', 'BOBX-SAND-017401', true),
  ('DEON-HILL-008365', 'TREY-HILL-025779', true),
  ('DERE-SMIT-003035', 'DAVI-SMIT-018423', true),
  ('DEUC-LUTU-002264', 'TAIT-LUTU-023880', true),
  ('DEVO-EDWA-020216', 'DOVO-EDWA-001875', true),
  ('DEVO-JOHN-020219', 'BUDD-JOHN-028038', true),
  ('DIRK-JOHN-007979', 'DAVI-JOHN-015871', true),
  ('DJXX-YOUN-020425', 'CURT-YOUN-002150', true),
  ('DUST-WOOD-004192', 'DUST-WOOD-020516', true),
  ('EDWA-JOHN-001585', 'EDDI-JOHN-001565', true),
  ('EDWA-LECH-015528', 'SHAN-LECH-027869', true),
  ('EMMA-LAWS-020965', 'MANN-LAWS-006458', true),
  ('ERIC-HEND-020646', 'EJXX-HEND-005074', true),
  ('ERNE-WOOD-001965', 'JACK-WOOD-002453', true),
  ('ETHA-ALBR-020671', 'LAWR-ALBR-000034', true),
  ('EUGE-HAYE-015316', 'GENO-HAYE-016470', true),
  ('GERA-WISN-005237', 'JERR-WISN-001808', true),
  ('GERA-WUNS-007840', 'JERR-WUNS-001145', true),
  ('GREG-HOWE-021123', 'BUDD-HOWE-025928', true),
  ('HASE-CLIN-009579', 'HAHA-CLIN-017396', true),
  ('HAUO-WONG-012546', 'JOSE-WONG-001111', true),
  ('HENR-SIMM-012349', 'KEND-SIMM-005263', true),
  ('IDRE-WALK-021180', 'KENY-WALK-005337', true),
  ('IKEX-NDUK-020864', 'IKEC-NDUK-001885', true),
  ('JAMA-BARB-020920', 'ROND-BARB-008604', true),
  ('JAME-BROW-015782', 'JAME-BROW-021331', false),  -- survivor date_of_birth is the 0000-00-00 sentinel, cannot gate
  ('JAME-GRIG-021341', 'BOOM-GRIG-017252', true),
  ('JAME-WILL-021384', 'JEFF-WILL-010058', false),  -- inside the sparse 2508600-2530400 dead zone -- nearest-median is a coin flip there
  ('JAME-WILS-021385', 'REIN-WILS-001110', true),
  ('JAMI-JONE-026287', 'JAME-JONE-025111', true),
  ('JAQU-WALK-002835', 'QUAY-WALK-025046', true),
  ('JASO-ALFO-006320', 'JAYX-ALFO-004590', true),
  ('JAYS-OWEH-005117', 'ODAF-OWEH-005554', true),
  ('JEFF-HATC-005536', 'JEFF-HATC-021435', true),
  ('JIMM-HERN-008786', 'JAME-HERN-015898', true),
  ('JIMX-NEWT-021539', 'JAME-NEWT-001504', true),
  ('JMIC-STUR-030507', 'JMIC-STUR-000355', true),
  ('JOEX-ANDR-021576', 'JOSE-ANDR-000060', true),
  ('JOEX-WONG-015945', 'JOSE-WONG-001111', true),
  ('JOHN-BARN-021626', 'TOMM-BARN-019491', true),
  ('JOHN-TOUD-018375', 'MICH-TOUD-012141', true),
  ('JONA-MEAD-010585', 'ADAM-MEAD-016609', true),
  ('JONA-PETR-021683', 'MITC-PETR-007057', true),
  ('JONA-STIN-009765', 'JONX-STIN-001562', true),
  ('JONX-BEAS-027537', 'JONA-BEAS-021765', true),
  ('JOSE-LONG-002195', 'JOEX-LONG-021573', true),
  ('JOSE-SCOT-021724', 'IANX-SCOT-010010', true),
  ('JOSE-TUPA-021728', 'TOMX-TUPA-019496', true),
  ('JOSH-BIDW-018762', 'JOSH-BIDW-006044', true),
  ('JTER-JONE-026762', 'JOSE-JONE-012868', false),  -- era DISAGREES (predicted 2025 vs expected 2015, gap 10y)
  ('JULI-JOHN-010809', 'RASH-JOHN-026347', true),
  ('JUMB-ELLI-018804', 'JOHN-ELLI-012780', false),  -- era DISAGREES (predicted 1997 vs expected 1987, gap 10y)
  ('JXXX-TALL-021940', 'JULI-TALL-021904', true),
  ('KEIT-BROO-027509', 'HOWA-BROO-000084', true),
  ('KEND-REDM-012910', 'ANTH-REDM-017070', true),
  ('KENN-DILG-009831', 'KENX-DILG-000252', true),
  ('KRIS-FARR-018380', 'KRIS-FARR-022093', true),
  ('LEEX-JOHN-015835', 'LELA-JOHN-022155', false),  -- era DISAGREES (predicted 1996 vs expected 1983, gap 13y)
  ('LEON-FRIE-022199', 'LENN-FRIE-008261', true),
  ('LESL-JASP-022215', 'MICH-JASP-026399', true),
  ('LORE-KIRK-022237', 'LEVO-KIRK-027498', true),
  ('MAKO-FREI-006972', 'ROCK-FREI-014115', true),
  ('MANU-RAMI-016676', 'MANN-RAMI-003545', true),
  ('MARC-SPRI-014006', 'THOM-SPRI-014593', true),
  ('MARK-THOR-022512', 'HUGH-THOR-026144', true),
  ('MATT-MART-022450', 'MARK-MART-016413', true),
  ('MATT-WILL-022459', 'MATT-WILL-001109', false),  -- era DISAGREES (predicted 1997 vs expected 1991, gap 6y)
  ('MAUR-FLEM-025460', 'REES-FLEM-013763', true),
  ('MICH-ALST-010099', 'MIKE-ALST-000035', true),
  ('MICH-KARN-008892', 'MIKE-KARN-001779', true),
  ('MICH-MALA-022561', 'MIKE-MALA-001810', true),
  ('MICH-MITC-016686', 'MIKE-MITC-026186', true),
  ('MICH-MOOR-005837', 'KENN-MOOR-011019', false),  -- era DISAGREES (predicted 2010 vs expected 1998, gap 12y)
  ('MICH-PUCI-019031', 'MIKE-PUCI-001462', true),
  ('MICH-STRA-008776', 'MIKE-STRA-027201', true),
  ('MICH-VICK-006400', 'MIKE-VICK-007103', true),
  ('MICH-WILL-013496', 'DUKE-WILL-004435', true),
  ('MIKE-GAND-019044', 'MICH-GAND-013422', true),
  ('MIKE-JONE-013529', 'MICH-JONE-001799', false),  -- inside the sparse 2508600-2530400 dead zone -- nearest-median is a coin flip there
  ('MIKE-PEAR-019035', 'MICH-PEAR-013352', true),
  ('MOSI-TATU-022686', 'LOFA-TATU-018912', true),
  ('NATE-GARN-005919', 'NATH-GARN-022775', true),
  ('NATE-MENK-002186', 'NATE-MENK-022713', true),
  ('NATH-EACH-002183', 'NATE-EACH-022731', true),
  ('NICH-HARD-013573', 'NICK-HARD-001782', true),
  ('NICH-HARR-010309', 'NICK-HARR-001320', true),
  ('NICK-HENN-022794', 'NICH-HENN-002070', true),
  ('NICK-MURP-022757', 'NICH-MURP-001680', true),
  ('NICO-TURN-019098', 'COLE-TURN-027912', true),
  ('NICX-HARR-009050', 'NICH-HARR-011983', true),
  ('ORLA-BRAN-022820', 'ANDR-BRAN-025816', true),
  ('PATR-MANN-019112', 'JAME-MANN-021255', true),
  ('PETE-PIER-019125', 'PETE-PIER-013713', true),
  ('PHIL-OSTR-013664', 'PHIL-OSTR-011752', true),
  ('PJXX-ALEX-023024', 'PATR-ALEX-001377', true),
  ('PLAC-FIAM-023026', 'TONY-FIAM-011302', true),
  ('PORT-PETE-022912', 'MIKE-PETE-019043', true),
  ('REGI-COLE-013792', 'REGG-COLE-001844', true),
  ('REGI-HODG-019196', 'REGG-HODG-001895', true),
  ('RICH-RAZZ-013853', 'RICK-RAZZ-001896', true),
  ('RICH-TYLS-020633', 'RICH-TYLS-001655', true),
  ('RJXX-HARR-002220', 'RODE-HARR-023508', true),
  ('ROBE-FRED-010623', 'ROBX-FRED-001796', true),
  ('ROBX-SMIT-023487', 'ROBE-SMIT-014085', true),
  ('ROMA-OBEN-018457', 'ROBE-OBEN-000821', true),
  ('RONA-STON-023563', 'RONX-STON-001016', true),
  ('SAII-ADEB-023606', 'PAUL-ADEB-000029', true),
  ('SAMU-GARN-010800', 'SAMX-GARN-000491', true),
  ('SAMU-MATH-023624', 'JASO-MATH-004633', true),
  ('SAVX-ROCC-007510', 'SAVE-ROCC-001953', false),  -- era DISAGREES (predicted 2006 vs expected 1995, gap 11y)
  ('SCOT-GRAG-019347', 'CHRI-GRAG-001648', true),
  ('SHAW-CRAB-019957', 'SHAN-CRAB-007659', true),
  ('SITU-PEKO-014351', 'SIIT-PEKO-001339', true),
  ('SOLO-VERA-023780', 'ALIJ-VERA-017197', true),
  ('STAF-MAYS-023787', 'TAYL-MAYS-004431', true),
  ('STEP-STUP-023806', 'NATE-STUP-020273', true),
  ('STEV-MCDU-023814', 'ISAI-MCDU-015830', true),
  ('STEV-MORL-023815', 'STEV-MORL-001739', true),
  ('TAME-KENN-023879', 'LINC-KENN-005524', true),
  ('THOM-BEAS-014476', 'CHAD-BEAS-001463', true),
  ('THOM-SPOO-014598', 'BRAN-SPOO-017278', true),
  ('TIMO-BROW-007898', 'BENX-BROW-025730', true),
  ('TIMO-STEP-024011', 'BRAN-STEP-008943', true),
  ('TIMX-FLAN-016974', 'TIMO-FLAN-002533', true),
  ('TJXX-CONL-006693', 'TIMO-CONL-002126', true),
  ('TOBI-MYLE-024071', 'TOBY-MYLE-019471', true),
  ('TONY-PASH-019494', 'ANTH-PASH-009698', true),
  ('TRAV-WHAR-011529', 'GLEN-WHAR-021117', true),
  ('TUPE-PEKO-006835', 'SIIT-PEKO-001339', true),
  ('TUTA-REYE-006837', 'TUTA-REYE-008059', true),
  ('TYSO-CLAB-002378', 'JOHN-CLAB-001742', true),
  ('UIKE-KEMO-024217', 'CHRI-KEMO-001887', true),
  ('WARR-BANK-014952', 'CHRI-BANK-002050', true),
  ('WILL-FERR-014890', 'BILL-FERR-001679', true),
  ('YORO-KARL-008179', 'GEOR-KARL-025361', true),
  ('YURY-WALK-008180', 'TRAV-WALK-025045', true),
  ('ZEEK-BIGG-016247', 'EZEK-BIGG-019446', true),
  ('ZOIS-PANO-015096', 'JOEX-PANO-004840', true);

-- Step 0. Refuse to run against a database that is not the one this map was
-- built for. A drop pid that no longer exists, or a keep pid that is itself
-- scheduled for deletion, means the map is stale.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM merge_map;
  IF n <> 170 THEN RAISE EXCEPTION 'expected 170 merge rows, got %', n; END IF;

  SELECT count(DISTINCT keep_pid) INTO n FROM merge_map;
  IF n <> 167 THEN RAISE EXCEPTION 'expected 167 survivors, got %', n; END IF;

  SELECT count(*) INTO n FROM merge_map m WHERE NOT EXISTS (SELECT 1 FROM player p WHERE p.pid = m.drop_pid);
  IF n > 0 THEN RAISE EXCEPTION '% drop rows are already absent from player -- map is stale', n; END IF;

  SELECT count(*) INTO n FROM merge_map m WHERE NOT EXISTS (SELECT 1 FROM player p WHERE p.pid = m.keep_pid);
  IF n > 0 THEN RAISE EXCEPTION '% survivors are absent from player -- map is stale', n; END IF;

  SELECT count(*) INTO n FROM merge_map m JOIN merge_map x ON x.drop_pid = m.keep_pid;
  IF n > 0 THEN RAISE EXCEPTION '% survivors are themselves scheduled for deletion -- map is not transitively closed', n; END IF;

  SELECT count(*) INTO n FROM merge_map WHERE NOT carry_nfl_player_id;
  IF n <> 10 THEN RAISE EXCEPTION 'expected 10 withheld nfl_player_id carries, got %', n; END IF;
END $$;

-- Step 1. Snapshot every row about to be deleted. Everything later in this file
-- reads the deleted rows from here, never from `player`, so the fill in step 9
-- still works after the delete in step 8.
CREATE TEMP TABLE drop_snapshot ON COMMIT DROP AS
SELECT p.* FROM player p JOIN merge_map m ON m.drop_pid = p.pid;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM drop_snapshot;
  IF n <> 170 THEN RAISE EXCEPTION 'expected 170 rows snapshotted, got %', n; END IF;
END $$;

-- Step 2. Preserve every non-null value held by each deleted row into
-- player_changelog against the surviving pid. This is what makes the delete
-- reversible from the database alone, and it is what keeps the 10 withheld
-- nfl_player_id values recoverable.
INSERT INTO player_changelog (pid, column_name, previous_value, new_value, source, reason, changed_at)
SELECT m.keep_pid, kv.key, kv.value #>> '{}', NULL,
  'adhoc/2026-08-04-dedupe-duplicate-person-rows-round-2',
  'preserved value from merged duplicate row ' || m.drop_pid,
  now()
FROM merge_map m
JOIN drop_snapshot s ON s.pid = m.drop_pid
CROSS JOIN LATERAL jsonb_each(to_jsonb(s)) kv
WHERE kv.value IS NOT NULL
  AND kv.value <> 'null'::jsonb
  AND kv.key NOT IN ('pid', 'name_search_vector');

-- Step 3. Record the merge itself, mirroring how the 2023 pid migration
-- recorded its rewrites and how 7eda49a6c recorded round one.
INSERT INTO player_changelog (pid, column_name, previous_value, new_value, source, reason, changed_at)
SELECT m.keep_pid, 'pid', m.drop_pid, m.keep_pid,
  'adhoc/2026-08-04-dedupe-duplicate-person-rows-round-2',
  'duplicate-person row merged into surviving pid',
  now()
FROM merge_map m;

-- Step 4. Rescue the gamelog values that live only on a row about to be dropped.
-- This matters for exactly one merge (Jamir Jones, 32 colliding games whose snap
-- counts exist only on the donor), but it is written generically and is a no-op
-- wherever the survivor already holds a value. It never overwrites: coalesce
-- takes the survivor's value whenever the survivor has one.
DO $$
DECLARE cols text; n int;
BEGIN
  SELECT string_agg(format('%I = coalesce(k.%I, d.%I)', column_name, column_name, column_name), ', ')
  INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'player_gamelogs'
    AND column_name NOT IN ('pid', 'esbid', 'season_year');

  EXECUTE format($f$
    UPDATE player_gamelogs k SET %s
    FROM merge_map m
    JOIN player_gamelogs d ON d.pid = m.drop_pid
    WHERE k.pid = m.keep_pid AND k.esbid = d.esbid AND k.season_year = d.season_year
  $f$, cols);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'step 4: filled % surviving gamelog rows from donor copies', n;
  IF n <> 36 THEN RAISE EXCEPTION 'expected 36 colliding gamelog rows (4 Woodard + 32 Jones), got %', n; END IF;
END $$;

-- Step 5. Drop the donor rows that would collide once re-pointed. Driven off the
-- live unique indexes rather than a hand-written table list, so an index added
-- since this file was written is still respected. Every row deleted here is a
-- duplicate of one the survivor already holds, and step 4 has already lifted any
-- value that existed only on the donor side.
DO $$
DECLARE r record; q text; n int; total int := 0;
BEGIN
  FOR r IN
    SELECT t.relname AS tbl, array_agg(a.attname ORDER BY k.ord) AS colnames
    FROM pg_index x
    JOIN pg_class t ON t.oid = x.indrelid
    JOIN pg_namespace ns ON ns.oid = t.relnamespace AND ns.nspname = 'public'
    CROSS JOIN LATERAL unnest(x.indkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
    WHERE x.indisunique AND t.relname <> 'player' AND NOT t.relispartition
    GROUP BY t.relname, x.indexrelid
    HAVING 'pid' = ANY(array_agg(a.attname))
  LOOP
    q := format(
      'DELETE FROM %I d USING merge_map m WHERE m.drop_pid = d.pid AND EXISTS (SELECT 1 FROM %I k WHERE k.pid = m.keep_pid%s)',
      r.tbl, r.tbl,
      (SELECT coalesce(string_agg(format(' AND k.%I IS NOT DISTINCT FROM d.%I', c, c), ''), '')
       FROM unnest(r.colnames) c WHERE c <> 'pid'));
    EXECUTE q;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN
      RAISE NOTICE 'step 5: dropped % colliding rows from %', n, r.tbl;
      total := total + n;
    END IF;
  END LOOP;
  RAISE NOTICE 'step 5: % colliding donor rows dropped in total', total;
END $$;

-- Step 6. Re-point everything that still references a row being deleted. Driven
-- off information_schema so no pid-bearing table can be missed; partitions are
-- skipped because the update is applied to their parent.
DO $$
DECLARE tbl text; n int; total int := 0;
BEGIN
  FOR tbl IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN pg_class t ON t.relname = c.table_name
    JOIN pg_namespace ns ON ns.oid = t.relnamespace AND ns.nspname = 'public'
    WHERE c.column_name = 'pid' AND c.table_schema = 'public'
      AND c.table_name <> 'player' AND NOT t.relispartition AND t.relkind IN ('r','p')
    ORDER BY 1
  LOOP
    EXECUTE format('UPDATE %I t SET pid = m.keep_pid FROM merge_map m WHERE t.pid = m.drop_pid', tbl);
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN
      RAISE NOTICE 'step 6: re-pointed % rows in %', n, tbl;
      total := total + n;
    END IF;
  END LOOP;
  RAISE NOTICE 'step 6: % rows re-pointed in total', total;
END $$;

-- Step 7. Verify nothing anywhere still references a row about to be deleted.
DO $$
DECLARE tbl text; n int;
BEGIN
  FOR tbl IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN pg_class t ON t.relname = c.table_name
    JOIN pg_namespace ns ON ns.oid = t.relnamespace AND ns.nspname = 'public'
    WHERE c.column_name = 'pid' AND c.table_schema = 'public'
      AND c.table_name <> 'player' AND NOT t.relispartition AND t.relkind IN ('r','p')
  LOOP
    EXECUTE format('SELECT count(*) FROM %I t JOIN merge_map m ON m.drop_pid = t.pid', tbl) INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'table % still holds % rows on a pid about to be deleted', tbl, n; END IF;
  END LOOP;
END $$;

-- Step 8. Drop the duplicate rows, releasing their identifiers from every UNIQUE
-- index before those identifiers are written onto the survivors in step 9.
DELETE FROM player p USING merge_map m WHERE p.pid = m.drop_pid;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM player p JOIN merge_map m ON m.drop_pid = p.pid;
  IF n <> 0 THEN RAISE EXCEPTION '% duplicate rows survived the delete', n; END IF;
END $$;

-- Step 9. Fill every column the survivor is missing, from the snapshot. Purely
-- additive: coalesce never overwrites a value the survivor already holds, so no
-- adjudication between two competing non-null values happens here. That is also
-- what keeps the corrupt "Montana State" on the deleted Mike Pearson row from
-- reaching the survivor, which already holds the correct Florida.
--
-- nfl_player_id is the one field that is NOT filled unconditionally: it is
-- gated on the era test recorded in merge_map.carry_nfl_player_id.
UPDATE player c SET
  tertiary_position = coalesce(c.tertiary_position, s.tertiary_position),
  height_inches = coalesce(c.height_inches, s.height_inches),
  weight_pounds = coalesce(c.weight_pounds, s.weight_pounds),
  date_of_birth = coalesce(c.date_of_birth, s.date_of_birth),
  forty_yard_dash_seconds = coalesce(c.forty_yard_dash_seconds, s.forty_yard_dash_seconds),
  bench_press_reps = coalesce(c.bench_press_reps, s.bench_press_reps),
  vertical_jump_inches = coalesce(c.vertical_jump_inches, s.vertical_jump_inches),
  broad_jump_inches = coalesce(c.broad_jump_inches, s.broad_jump_inches),
  shuttle_run_seconds = coalesce(c.shuttle_run_seconds, s.shuttle_run_seconds),
  three_cone_drill_seconds = coalesce(c.three_cone_drill_seconds, s.three_cone_drill_seconds),
  arm_length_inches = coalesce(c.arm_length_inches, s.arm_length_inches),
  hand_size_inches = coalesce(c.hand_size_inches, s.hand_size_inches),
  draft_overall_pick = coalesce(c.draft_overall_pick, s.draft_overall_pick),
  draft_round = coalesce(c.draft_round, s.draft_round),
  college = coalesce(c.college, s.college),
  college_division = coalesce(c.college_division, s.college_division),
  nfl_draft_year = coalesce(c.nfl_draft_year, s.nfl_draft_year),
  position_depth = coalesce(c.position_depth, s.position_depth),
  jersey_number = coalesce(c.jersey_number, s.jersey_number),
  draft_capital_points = coalesce(c.draft_capital_points, s.draft_capital_points),
  nfl_player_id = coalesce(c.nfl_player_id, case when m.carry_nfl_player_id then s.nfl_player_id end),
  esb_player_id = coalesce(c.esb_player_id, s.esb_player_id),
  gsis_player_id = coalesce(c.gsis_player_id, s.gsis_player_id),
  smart_player_id = coalesce(c.smart_player_id, s.smart_player_id),
  gsis_it_player_id = coalesce(c.gsis_it_player_id, s.gsis_it_player_id),
  high_school = coalesce(c.high_school, s.high_school),
  sleeper_player_id = coalesce(c.sleeper_player_id, s.sleeper_player_id),
  rotoworld_player_id = coalesce(c.rotoworld_player_id, s.rotoworld_player_id),
  rotowire_player_id = coalesce(c.rotowire_player_id, s.rotowire_player_id),
  sportradar_player_id = coalesce(c.sportradar_player_id, s.sportradar_player_id),
  espn_player_id = coalesce(c.espn_player_id, s.espn_player_id),
  fantasy_data_player_id = coalesce(c.fantasy_data_player_id, s.fantasy_data_player_id),
  yahoo_player_id = coalesce(c.yahoo_player_id, s.yahoo_player_id),
  keeptradecut_player_id = coalesce(c.keeptradecut_player_id, s.keeptradecut_player_id),
  pfr_player_id = coalesce(c.pfr_player_id, s.pfr_player_id),
  ngs_athleticism_score = coalesce(c.ngs_athleticism_score, s.ngs_athleticism_score),
  ngs_draft_grade = coalesce(c.ngs_draft_grade, s.ngs_draft_grade),
  nfl_grade = coalesce(c.nfl_grade, s.nfl_grade),
  ngs_production_score = coalesce(c.ngs_production_score, s.ngs_production_score),
  ngs_size_score = coalesce(c.ngs_size_score, s.ngs_size_score),
  otc_player_id = coalesce(c.otc_player_id, s.otc_player_id),
  contract_year_signed = coalesce(c.contract_year_signed, s.contract_year_signed),
  contract_years = coalesce(c.contract_years, s.contract_years),
  contract_value = coalesce(c.contract_value, s.contract_value),
  contract_apy = coalesce(c.contract_apy, s.contract_apy),
  contract_guaranteed = coalesce(c.contract_guaranteed, s.contract_guaranteed),
  contract_apy_cap_pct = coalesce(c.contract_apy_cap_pct, s.contract_apy_cap_pct),
  contract_inflated_value = coalesce(c.contract_inflated_value, s.contract_inflated_value),
  contract_inflated_apy = coalesce(c.contract_inflated_apy, s.contract_inflated_apy),
  contract_inflated_guaranteed = coalesce(c.contract_inflated_guaranteed, s.contract_inflated_guaranteed),
  pff_player_id = coalesce(c.pff_player_id, s.pff_player_id),
  mfl_player_id = coalesce(c.mfl_player_id, s.mfl_player_id),
  fleaflicker_player_id = coalesce(c.fleaflicker_player_id, s.fleaflicker_player_id),
  cbs_player_id = coalesce(c.cbs_player_id, s.cbs_player_id),
  cfbref_player_id = coalesce(c.cfbref_player_id, s.cfbref_player_id),
  twitter_username = coalesce(c.twitter_username, s.twitter_username),
  swish_player_id = coalesce(c.swish_player_id, s.swish_player_id),
  draftkings_player_id = coalesce(c.draftkings_player_id, s.draftkings_player_id),
  fanduel_player_id = coalesce(c.fanduel_player_id, s.fanduel_player_id),
  rts_player_id = coalesce(c.rts_player_id, s.rts_player_id),
  draft_team = coalesce(c.draft_team, s.draft_team),
  sis_player_id = coalesce(c.sis_player_id, s.sis_player_id),
  sis_prospect_grade = coalesce(c.sis_prospect_grade, s.sis_prospect_grade),
  sis_prospect_position_rank = coalesce(c.sis_prospect_position_rank, s.sis_prospect_position_rank),
  sis_prospect_overall_rank = coalesce(c.sis_prospect_overall_rank, s.sis_prospect_overall_rank),
  all_pro_first_team_selections = coalesce(c.all_pro_first_team_selections, s.all_pro_first_team_selections),
  pro_bowls_selections = coalesce(c.pro_bowls_selections, s.pro_bowls_selections),
  pfr_years_as_primary_starter = coalesce(c.pfr_years_as_primary_starter, s.pfr_years_as_primary_starter),
  pfr_weighted_career_approximate_value = coalesce(c.pfr_weighted_career_approximate_value, s.pfr_weighted_career_approximate_value),
  pfr_weighted_career_approximate_value_drafted_team = coalesce(c.pfr_weighted_career_approximate_value_drafted_team, s.pfr_weighted_career_approximate_value_drafted_team),
  ffpc_player_id = coalesce(c.ffpc_player_id, s.ffpc_player_id),
  nffc_player_id = coalesce(c.nffc_player_id, s.nffc_player_id),
  fantrax_player_id = coalesce(c.fantrax_player_id, s.fantrax_player_id),
  roster_status = coalesce(c.roster_status, s.roster_status),
  game_designation = coalesce(c.game_designation, s.game_designation),
  forty_yard_dash_designation = coalesce(c.forty_yard_dash_designation, s.forty_yard_dash_designation),
  ten_yard_split_seconds = coalesce(c.ten_yard_split_seconds, s.ten_yard_split_seconds),
  ten_yard_split_designation = coalesce(c.ten_yard_split_designation, s.ten_yard_split_designation),
  pro_day_forty_seconds = coalesce(c.pro_day_forty_seconds, s.pro_day_forty_seconds),
  pro_day_forty_designation = coalesce(c.pro_day_forty_designation, s.pro_day_forty_designation),
  sixty_yard_shuttle_seconds = coalesce(c.sixty_yard_shuttle_seconds, s.sixty_yard_shuttle_seconds),
  sixty_yard_shuttle_designation = coalesce(c.sixty_yard_shuttle_designation, s.sixty_yard_shuttle_designation),
  combine_attendance = coalesce(c.combine_attendance, s.combine_attendance),
  hometown = coalesce(c.hometown, s.hometown),
  sumer_player_id = coalesce(c.sumer_player_id, s.sumer_player_id),
  fantasylabs_player_id = coalesce(c.fantasylabs_player_id, s.fantasylabs_player_id),
  underdog_player_id = coalesce(c.underdog_player_id, s.underdog_player_id),
  fantasypoints_player_id = coalesce(c.fantasypoints_player_id, s.fantasypoints_player_id)
FROM merge_map m
JOIN drop_snapshot s ON s.pid = m.drop_pid
WHERE c.pid = m.keep_pid;

-- Step 10. Repair the surviving Jamir Jones row. It won the survivor rule on
-- gamelog count but carries a corrupted identity: the wrong first name and a
-- 1958 draft year against a 1998 date of birth. nflverse (gsis 00-0036068) and
-- Pro Football Reference both give Jamir Jones, Notre Dame, born 1998-06-14 and
-- undrafted; 2020 is the entry year the deleted row carried. No other survivor
-- needs this -- Pearson's corrupt college is on the deleted side and cannot
-- reach him through step 9.
INSERT INTO player_changelog (pid, column_name, previous_value, new_value, source, reason, changed_at)
SELECT 'JAME-JONE-025111', v.col, v.prev, v.new,
  'adhoc/2026-08-04-dedupe-duplicate-person-rows-round-2',
  'corrupt identity field on merge survivor, corrected against nflverse and Pro Football Reference',
  now()
FROM (VALUES
  ('first_name', 'James', 'Jamir'),
  ('formatted_name', 'james jones', 'jamir jones'),
  ('nfl_draft_year', '1958', '2020')
) AS v(col, prev, new)
WHERE EXISTS (SELECT 1 FROM player p WHERE p.pid = 'JAME-JONE-025111');

UPDATE player SET first_name = 'Jamir', formatted_name = 'jamir jones', nfl_draft_year = 2020
WHERE pid = 'JAME-JONE-025111'
  AND first_name = 'James' AND nfl_draft_year = 1958;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM player
  WHERE pid = 'JAME-JONE-025111' AND first_name = 'Jamir' AND nfl_draft_year = 2020;
  IF n <> 1 THEN RAISE EXCEPTION 'Jamir Jones identity repair did not apply'; END IF;
END $$;

-- Step 11. Post-conditions. Any failure here rolls the whole file back.
DO $$
DECLARE n int; tbl text;
BEGIN
  -- every survivor still exists
  SELECT count(DISTINCT m.keep_pid) INTO n
  FROM merge_map m JOIN player p ON p.pid = m.keep_pid;
  IF n <> 167 THEN RAISE EXCEPTION 'expected 167 surviving rows, found %', n; END IF;

  -- nothing anywhere references a deleted pid
  FOR tbl IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN pg_class t ON t.relname = c.table_name
    JOIN pg_namespace ns ON ns.oid = t.relnamespace AND ns.nspname = 'public'
    WHERE c.column_name = 'pid' AND c.table_schema = 'public'
      AND NOT t.relispartition AND t.relkind IN ('r','p')
  LOOP
    EXECUTE format('SELECT count(*) FROM %I t JOIN merge_map m ON m.drop_pid = t.pid', tbl) INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'table % still references % deleted pids', tbl, n; END IF;
  END LOOP;

  -- no identifier was duplicated onto two rows by the fill
  SELECT count(*) INTO n FROM (
    SELECT nfl_player_id FROM player WHERE nfl_player_id IS NOT NULL
    GROUP BY 1 HAVING count(*) > 1) d;
  IF n > 0 THEN RAISE EXCEPTION '% nfl_player_id values are now held by more than one row', n; END IF;

  SELECT count(*) INTO n FROM (
    SELECT gsis_player_id FROM player WHERE gsis_player_id IS NOT NULL
    GROUP BY 1 HAVING count(*) > 1) d;
  IF n > 0 THEN RAISE EXCEPTION '% gsis_player_id values are now held by more than one row', n; END IF;

  SELECT count(*) INTO n FROM (
    SELECT esb_player_id FROM player WHERE esb_player_id IS NOT NULL
    GROUP BY 1 HAVING count(*) > 1) d;
  IF n > 0 THEN RAISE EXCEPTION '% esb_player_id values are now held by more than one row', n; END IF;

  -- the withheld carries really were withheld
  SELECT count(*) INTO n
  FROM merge_map m
  JOIN drop_snapshot s ON s.pid = m.drop_pid
  JOIN player c ON c.pid = m.keep_pid
  WHERE NOT m.carry_nfl_player_id
    AND s.nfl_player_id IS NOT NULL
    AND c.nfl_player_id IS NOT DISTINCT FROM s.nfl_player_id;
  IF n > 0 THEN RAISE EXCEPTION '% era-gated nfl_player_id values were carried anyway', n; END IF;

  -- one changelog row per non-null value on every deleted row, plus one per merge
  SELECT count(*) INTO n FROM player_changelog
  WHERE source = 'adhoc/2026-08-04-dedupe-duplicate-person-rows-round-2';
  RAISE NOTICE 'step 11: wrote % player_changelog rows', n;
  IF n < 170 THEN RAISE EXCEPTION 'too few changelog rows written: %', n; END IF;

  RAISE NOTICE 'step 11: all post-conditions passed';
END $$;
